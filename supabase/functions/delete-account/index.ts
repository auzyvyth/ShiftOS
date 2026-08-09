import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-service account deletion for a SOLO salesman (Lite / Premium, dealer_id
// NULL). This is a SOFT delete: it flips the caller's own profile to
// account_status='deleted' + is_active=false + deleted_at=now(). Their public
// mini page (get_salesman_by_slug filters is_active) and their marketplace
// listings (public_car_listings excludes deleted owners) disappear immediately,
// but nothing is destroyed — logging back in within 30 days restores the account.
// The purge-deleted-accounts cron hard-deletes the auth user after the grace
// window. A linked salesman (dealer_id set) is dealer-managed and cannot
// self-delete here.

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".xdrive.my"))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, origin);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "unauthorized" }, 401, origin);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Eligibility: solo salesman only ─────────────────────────────────────
    // Operate STRICTLY on user.id — this endpoint never accepts a target id, so
    // it can only ever delete the caller's own account.
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role, dealer_id, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "not_found" }, 404, origin);

    if (profile.role !== "salesman" || profile.dealer_id) {
      // Linked salesmen (and any other role) are managed by their dealer / admin.
      return json({ error: "not_eligible", message: "dealer_managed" }, 403, origin);
    }

    if (profile.account_status === "deleted") {
      // Idempotent — already scheduled for deletion.
      return json({ success: true, already: true }, 200, origin);
    }

    // ── Soft delete (reversible for 30 days) ────────────────────────────────
    const { error: updErr } = await adminClient
      .from("profiles")
      .update({
        account_status: "deleted",
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updErr) {
      console.error("[delete-account] update error:", updErr);
      return json({ error: "delete_failed" }, 500, origin);
    }

    return json({ success: true }, 200, origin);
  } catch (e) {
    console.error("[delete-account] error:", e);
    return json({ error: "internal_error" }, 500, req.headers.get("Origin"));
  }
});
