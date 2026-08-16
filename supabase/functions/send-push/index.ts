import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — esm.sh resolves web-push for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

// NOTE: this function existed on Supabase for months without ever being committed
// here. This file is the deployed v11 source plus the auth hardening described
// below. Diff against `mcp__Supabase__get_edge_function` before redeploying.

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null) {
  // Subdomain storefronts (<dealer>.xdrive.my) are authenticated surfaces too.
  // Vercel previews are allowed so the staging branch can be tested end to end —
  // without this the "Send test" button fails CORS on every preview URL. The
  // blast radius is nil: a page on some other *.vercel.app still has to present
  // either the shared secret (server-only) or a logged-in ShiftOS user's token,
  // and a token-authenticated caller can only ever notify themselves.
  const allowed = origin && (
    ALLOWED_ORIGINS.includes(origin)
    || /^https:\/\/[a-z0-9-]+\.xdrive\.my$/.test(origin)
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)
  )
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace, x-push-secret",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

// VAPID keys identify this server to the push services. They are PERMANENT once
// users are subscribed — every stored subscription is bound to the public key it
// was created with, so regenerating them kills existing subscriptions. See CLAUDE.md.
//
// This used to run bare at module scope. web-push THROWS on a malformed key, and
// a throw at module scope kills the whole worker before serve() is ever reached —
// every request got an opaque `WORKER_ERROR / Function exited due to an error`
// with no hint of the cause. That is exactly what happened: the stored private
// key was not URL-safe base64, so this function never booted once in its life,
// and nothing downstream could tell the difference between "misconfigured" and
// "broken". Catch it, remember it, and say so on each request instead.
let vapidError: string | null = null;
try {
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:support@xdrive.my",
    Deno.env.get("VAPID_PUBLIC_KEY") || "",
    Deno.env.get("VAPID_PRIVATE_KEY") || "",
  );
} catch (err) {
  vapidError = String(err instanceof Error ? err.message : err);
  console.error("send-push: VAPID config rejected —", vapidError);
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (vapidError) {
    return new Response(
      JSON.stringify({ error: "vapid_misconfigured", detail: vapidError }),
      { status: 500, headers: cors },
    );
  }

  try {
    // AUTH. This endpoint used to be completely open: verify_jwt=false, CORS *,
    // and user_ids read straight from the body — so anyone who knew the URL could
    // push an arbitrary notification to any user whose id they could find (and
    // profile ids are exposed on public marketplace surfaces). Two callers are
    // legitimate, and nothing else is:
    //   1. server-side producers (DB triggers, crons) presenting the shared
    //      secret — these may target any user_ids
    //   2. a logged-in user testing their own device — forced to their own id
    // Fails CLOSED when the secret is not configured, so a missing env var can
    // never reopen the hole.
    const sharedSecret = (Deno.env.get("PUSH_SHARED_SECRET") || "").trim();
    const presented = (req.headers.get("x-push-secret") || "").trim();
    const isServerCaller = sharedSecret.length > 0 && presented === sharedSecret;

    let selfUserId: string | null = null;
    if (!isServerCaller) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
      }
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
      }
      selfUserId = user.id;
    }

    const { user_ids, title, body, url, tag } = await req.json();

    // A logged-in caller may only push to themselves, whatever they asked for.
    const targetIds: string[] = isServerCaller
      ? (Array.isArray(user_ids) ? user_ids.filter(Boolean) : [])
      : [selfUserId!];

    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ error: "user_ids required" }), { status: 400, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, subscription")
      .in("user_id", targetIds);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: cors });
    }

    const payload = JSON.stringify({
      title: title || "ShiftOS",
      body: body || "",
      url: url || "/",
      tag: tag || "shiftos",
    });
    const staleIds: string[] = [];

    const results = await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, payload);
        } catch (err: unknown) {
          // 410 Gone / 404 = the browser dropped this subscription for good.
          // Deleting it keeps the table from filling with undeliverable rows.
          const code = err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
          if (code === 410 || code === 404) staleIds.push(row.id);
          throw err;
        }
      }),
    );

    if (staleIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, failed: results.length - sent }), { headers: cors });
  } catch (err) {
    console.error("send-push:", err);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: cors });
  }
});
