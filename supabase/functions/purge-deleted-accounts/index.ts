import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Daily cron worker. Hard-deletes the auth user for any account that has been
// soft-deleted (account_status='deleted') for more than the 30-day grace window.
// Deleting the auth user cascades to profiles and all owned data thanks to the
// FK delete rules set in migration profiles_fk_delete_rules_for_account_purge
// (owned rows CASCADE, attribution pointers SET NULL). Reversible up to this
// point — a user who logs back in before the window clears their flags.
//
// Invoked by the pg_cron job `purge-deleted-accounts-daily`, which passes the
// service-role key as a Bearer token. We also verify that token matches the
// service-role key so the endpoint can't be abused even with verify_jwt off.

const GRACE_DAYS = 30;

serve(async (req) => {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== serviceKey) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: due, error: selErr } = await admin
      .from("profiles")
      .select("id, deleted_at")
      .eq("account_status", "deleted")
      .lt("deleted_at", cutoff);

    if (selErr) {
      console.error("[purge-deleted-accounts] select error:", selErr);
      return new Response(JSON.stringify({ error: "select_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let purged = 0;
    const failures: { id: string; message: string }[] = [];

    for (const row of due || []) {
      const { error: delErr } = await admin.auth.admin.deleteUser(row.id);
      if (delErr) {
        console.error(`[purge-deleted-accounts] deleteUser ${row.id} failed:`, delErr.message);
        failures.push({ id: row.id, message: delErr.message });
      } else {
        purged++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, candidates: (due || []).length, purged, failures }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[purge-deleted-accounts] error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
