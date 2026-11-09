import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Daily cron worker. Hard-deletes the auth user for any account that has been
// soft-deleted (account_status='deleted') for more than the 30-day grace window.
// Deleting the auth user cascades to profiles and all owned data thanks to the
// FK delete rules set in migration profiles_fk_delete_rules_for_account_purge
// (owned rows CASCADE, attribution pointers SET NULL). Reversible up to this
// point — a user who logs back in before the window clears their flags.
//
// AUTH — read this before changing it.
//
// This used to compare the caller's bearer token against SUPABASE_SERVICE_ROLE_KEY
// while the pg_cron job sent `current_setting('app.service_role_key', true)`. That
// database setting was never set, so current_setting() returned NULL, the whole
// header string collapsed to NULL (concatenating NULL yields NULL), and the job
// posted with no Authorization header at all. Every nightly run returned 401 and
// nothing was ever purged — silently, because the job still "succeeded" from
// pg_cron's point of view: it got an HTTP response, just not a useful one.
//
// Pointing the job at the shared key in Vault (`cron_edge_key`, what every other
// cron already sends) was not enough on its own: that key and the function's
// SUPABASE_SERVICE_ROLE_KEY env var are two different strings, both valid
// service_role credentials for this project. So the comparison still failed.
//
// The rule that fixes it for good: NEVER authenticate against a secret this
// function cannot read. It now resolves the accepted key from Vault through its
// own service-role client, which is the same single value the cron sends. Rotate
// that secret and both sides move together — there is no second copy to drift.
// The raw service-role key stays accepted so a manual invoke still works.
//
// verify_jwt is deliberately left OFF: the check below is the real gate, and an
// attacker who held a valid service_role JWT would already own the database, so
// the platform's JWT check would add nothing here.

//
// SILENCE — the other way this job failed (OPS-PURGE, 2026-11-09).
// pg_cron only proves the HTTP call went out, and nobody reads this function's
// reply. So a run that found accounts and could not delete them looked exactly
// like a healthy run. Now any failure (lookup or per-account delete) goes to
// notify_ops (Telegram + superadmin push), and every run logs one summary line
// to the function logs. `?dry=1` lists what WOULD be purged and deletes nothing.

const GRACE_DAYS = 30;

// deno-lint-ignore no-explicit-any
async function alertOps(admin: any, text: string) {
  try {
    await admin.rpc("notify_ops", { p_key: "err:account_purge", p_text: text.slice(0, 900) });
  } catch (e) {
    console.error("[purge-deleted-accounts] notify_ops failed:", e);
  }
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  try {
    const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();

    let cronKey = "";
    try {
      const { data, error } = await admin.rpc("get_cron_edge_key");
      if (error) console.error("[purge-deleted-accounts] cron key lookup:", error.message);
      cronKey = (data || "").trim();
    } catch (e) {
      console.error("[purge-deleted-accounts] cron key lookup threw:", e);
    }

    // Fails CLOSED. If neither secret resolved we cannot authenticate anyone, and
    // an endpoint that hard-deletes accounts must never default to open.
    const accepted = [cronKey, serviceKey].filter((k) => k.length > 0);
    if (accepted.length === 0 || !token || !accepted.includes(token)) return unauthorized();

    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: due, error: selErr } = await admin
      .from("profiles")
      .select("id, deleted_at")
      .eq("account_status", "deleted")
      .lt("deleted_at", cutoff);

    if (selErr) {
      console.error("[purge-deleted-accounts] select error:", selErr);
      await alertOps(admin, `Account purge failed\nCould not list deleted accounts: ${selErr.message}`);
      return new Response(JSON.stringify({ error: "select_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (dry) {
      const ids = (due || []).map((r) => ({ id: r.id, deleted_at: r.deleted_at }));
      console.log(`[purge-deleted-accounts] dry run: ${ids.length} due, cutoff ${cutoff}`);
      return new Response(
        JSON.stringify({ success: true, dry: true, cutoff, candidates: ids.length, due: ids }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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

    const candidates = (due || []).length;
    console.log(`[purge-deleted-accounts] candidates ${candidates}, purged ${purged}, failed ${failures.length}`);
    if (failures.length > 0) {
      await alertOps(
        admin,
        `Account purge: ${failures.length} of ${candidates} deletes failed\n` +
          failures.map((f) => `${f.id}: ${f.message}`).join("\n"),
      );
    }

    return new Response(
      JSON.stringify({ success: true, candidates: (due || []).length, purged, failures }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[purge-deleted-accounts] error:", e);
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
      await alertOps(admin, `Account purge crashed\n${String(e)}`);
    } catch { /* already logged */ }
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
