// FIXED: auth-first account creation
// PLAN: uses account_plan enum for role differentiation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    // ── Role check ──────────────────────────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, id")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile || !["dealer", "superadmin", "owner"].includes(callerProfile.role)) {
      return json({ error: "forbidden" }, 403);
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { email, full_name, dealer_id, plan, phone, slug } = body;

    if (!email || !full_name || !plan) {
      return json({ error: "invalid_input" }, 400);
    }
    if (!["salesman_full", "salesman_lite"].includes(plan)) {
      return json({ error: "invalid_input" }, 400);
    }

    const tempPassword = generatePassword();

    // ── Create auth user ────────────────────────────────────────────────────
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: "salesman",
        plan,
        dealer_id: dealer_id ?? null,
      },
    });

    if (createErr) {
      if (createErr.message?.toLowerCase().includes("already registered") ||
          createErr.message?.toLowerCase().includes("already exists")) {
        return json({ error: "email_taken" }, 409);
      }
      console.error("createUser error:", createErr);
      return json({ error: createErr.message }, 500);
    }

    const newUserId = created.user.id;

    // ── Update the auto-created profile ─────────────────────────────────────
    // handle_new_user trigger may not have fired yet; retry with a short wait
    let profileUpdated = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      const { error: updateErr } = await adminClient
        .from("profiles")
        .update({
          full_name,
          role: "salesman",
          plan,
          dealer_id: dealer_id ?? null,
          phone: phone ?? null,
          slug: slug ?? null,
          dealership: callerProfile.role !== "superadmin"
            ? undefined  // will be set by the dealer's own dealership value below
            : undefined,
          is_active: true,
        })
        .eq("id", newUserId);

      if (!updateErr) {
        profileUpdated = true;
        break;
      }
      // Profile row might not exist yet if trigger is slow
    }

    if (!profileUpdated) {
      // Trigger never fired — create profile manually then clean up if it fails
      const { error: insertErr } = await adminClient.from("profiles").insert({
        id: newUserId,
        email,
        full_name,
        role: "salesman",
        plan,
        dealer_id: dealer_id ?? null,
        phone: phone ?? null,
        slug: slug ?? null,
        is_active: true,
      });
      if (insertErr) {
        // Best-effort cleanup: delete auth user so no orphan is left
        await adminClient.auth.admin.deleteUser(newUserId);
        console.error("profile insert error:", insertErr);
        return json({ error: "profile_creation_failed" }, 500);
      }
    }

    // Propagate dealership name from parent dealer
    if (dealer_id) {
      const { data: dealerRow } = await adminClient
        .from("profiles")
        .select("dealership")
        .eq("id", dealer_id)
        .maybeSingle();
      if (dealerRow?.dealership) {
        await adminClient
          .from("profiles")
          .update({ dealership: dealerRow.dealership })
          .eq("id", newUserId);
      }
    }

    const { data: finalProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUserId)
      .maybeSingle();

    return json({
      success: true,
      user_id: newUserId,
      temp_password: tempPassword,
      profile: finalProfile,
    });
  } catch (e) {
    console.error("create-salesman error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
