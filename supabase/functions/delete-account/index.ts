import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Self-service account deletion (MOBILE-7 — Apple guideline 5.1.1(v): any app
// that supports account creation must let the user start deletion in-app).
// Eligible: a solo salesman (Lite/Premium, dealer_id NULL), a self-owned
// dealer/owner (dealer_id NULL — they ARE the dealer), or a buyer. Dealer-
// provisioned staff (manager/admin/accountant/fi_officer, a linked salesman)
// are managed by their dealer/admin and cannot self-delete here — they didn't
// create their own account, the dealer invited them. superadmin (platform
// staff) is never self-deletable through this consumer endpoint.
//
// This is a SOFT delete: it flips the caller's own profile to
// account_status='deleted' + is_active=false + deleted_at=now(). A dealer's
// listings/leads/staff etc. all key off dealer_id CASCADE and are only
// actually destroyed by purge-deleted-accounts after the 30-day grace window
// (logging back in first restores everything). A buyer's chat threads
// survive that purge too (see migration 20260924j) — the seller keeps their
// side of the conversation even after the buyer's account is gone.

// Origin allowlist lives in ../_shared/cors.ts (MOBILE-4) — one list for every function.

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

    // ── Eligibility ──────────────────────────────────────────────────────────
    // Operate STRICTLY on user.id — this endpoint never accepts a target id, so
    // it can only ever delete the caller's own account.
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role, dealer_id, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "not_found" }, 404, origin);

    const selfOwned = !profile.dealer_id;
    const eligible =
      (profile.role === "salesman" && selfOwned) ||
      ((profile.role === "dealer" || profile.role === "owner") && selfOwned) ||
      profile.role === "buyer";

    if (!eligible) {
      // Dealer-managed staff and platform superadmin cannot self-delete here.
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
