import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  arr.forEach((b) => (pw += chars[b % chars.length]));
  return pw;
}

const ALLOWED_ROLES = ["manager", "accountant", "fi_officer", "admin"];

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
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

    // ── Role check ──────────────────────────────────────────────────────────
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, id, dealership")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile || !["dealer", "superadmin", "owner", "manager", "admin"].includes(callerProfile.role)) {
      return json({ error: "forbidden" }, 403, origin);
    }

    // ── DELETE /invites/:id ─────────────────────────────────────────────────
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const targetId = pathParts[pathParts.length - 1];

    if (req.method === "DELETE" && targetId && targetId !== "invites") {
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(targetId);
      if (deleteErr) {
        // Profile-only deletion if auth user not found
        await adminClient.from("profiles").delete().eq("id", targetId);
      }
      return json({ success: true }, 200, origin);
    }

    // ── POST /invites ────────────────────────────────────────────────────────
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, origin);
    }

    const body = await req.json().catch(() => ({}));
    const { email, full_name, phone, dealership, dealer_id, slug, password, role } = body;

    if (!email || !full_name || !role) {
      return json({ error: "invalid_input" }, 400, origin);
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ error: "invalid_role" }, 400, origin);
    }

    const pw = password && password.length >= 8 ? password : generatePassword();

    // ── Create auth user ────────────────────────────────────────────────────
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name, role, dealer_id: dealer_id ?? null },
    });

    if (createErr) {
      if (
        createErr.message?.toLowerCase().includes("already registered") ||
        createErr.message?.toLowerCase().includes("already exists")
      ) {
        return json({ error: "email_taken", message: "Email already in use." }, 409, origin);
      }
      console.error("createUser error:", createErr);
      return json({ error: createErr.message }, 500, origin);
    }

    const newUserId = created.user.id;

    // ── Upsert profile (wait for trigger) ───────────────────────────────────
    let profileOk = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      const { error: updateErr } = await adminClient
        .from("profiles")
        .update({
          full_name,
          role,
          dealer_id: dealer_id ?? null,
          phone: phone ?? null,
          slug: slug ?? null,
          dealership: dealership ?? null,
          is_active: true,
        })
        .eq("id", newUserId);
      if (!updateErr) { profileOk = true; break; }
    }

    if (!profileOk) {
      const { error: insertErr } = await adminClient.from("profiles").insert({
        id: newUserId, email, full_name, role,
        dealer_id: dealer_id ?? null,
        phone: phone ?? null,
        slug: slug ?? null,
        dealership: dealership ?? null,
        is_active: true,
      });
      if (insertErr) {
        await adminClient.auth.admin.deleteUser(newUserId);
        return json({ error: "profile_creation_failed" }, 500, origin);
      }
    }

    const { data: finalProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUserId)
      .maybeSingle();

    return json({ success: true, invite: finalProfile, temp_password: pw }, 200, origin);
  } catch (e) {
    console.error("invites error:", e);
    return json({ error: "internal_error" }, 500, null);
  }
});
