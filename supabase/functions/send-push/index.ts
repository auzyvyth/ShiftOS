import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — esm.sh resolves web-push for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

webpush.setVapidDetails(
  "mailto:support@xdrive.my",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { user_ids, title, body, url, tag } = await req.json();
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: "user_ids required" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const validIds = user_ids.filter(Boolean);
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, subscription")
      .in("user_id", validIds);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: CORS });
    }

    const payload = JSON.stringify({ title, body, url: url || "/", tag: tag || "shiftos" });
    const staleIds: string[] = [];

    const results = await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, payload);
        } catch (err: unknown) {
          // 410 Gone = subscription expired; clean up
          if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
            staleIds.push(row.id);
          }
          throw err;
        }
      }),
    );

    if (staleIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, failed: results.length - sent }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
