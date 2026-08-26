// FIXED: auth-first account creation
// PLAN: uses account_plan enum for role differentiation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith(".xdrive.my"))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  arr.forEach((b) => (pw += chars[b % chars.length]));
  return pw;
}

// Emails the salesman a one-time recovery link to set their own password and
// finish onboarding. Uses the SAME Resend channel as send-document
// (RESEND_API_KEY) — NOT Supabase Auth SMTP. Returns whether the email was
// actually sent so the caller can fall back to a temp password. Shared by the
// create flow and the "resend setup email" action from the dealer Team tab.
async function sendSetupEmail(
  adminClient: any,
  email: string,
  fullName: string,
  dealershipName: string,
): Promise<boolean> {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return false;
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      // Route through /reset-password (a known-allowlisted redirect URL) with a
      // flow marker; ResetPasswordPage hands a first-time salesman off to the
      // /salesman-setup welcome page once the recovery session is established.
      options: { redirectTo: "https://xdrive.my/reset-password?flow=setup" },
    });
    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) return false;
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px 0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
  <div style="background:#111827;padding:28px 32px;color:#fff;">
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">${dealershipName}</p>
    <h1 style="margin:0;font-size:22px;font-weight:700;">Welcome to the team</h1>
  </div>
  <div style="padding:28px 32px;color:#374151;font-size:14px;line-height:1.6;">
    <p style="margin:0 0 16px;">Hi ${fullName}, ${dealershipName} has created your salesman account on ShiftOS.</p>
    <p style="margin:0 0 24px;">Set your password to finish setting up and access your dashboard:</p>
    <a href="${actionLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:8px;">Set your password</a>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">This link expires in 24 hours. If it expires, use "Forgot password" on the ShiftOS login page.</p>
  </div>
  <div style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Sent by ${dealershipName} via ShiftOS</p>
  </div>
</div></body></html>`;
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${dealershipName} <${fromEmail}>`,
        to: [email],
        subject: `Set up your ${dealershipName} salesman account`,
        html,
      }),
    });
    if (!resendRes.ok) {
      console.error("[create-salesman] Resend error:", await resendRes.text());
    }
    return resendRes.ok;
  } catch (e) {
    console.error("[create-salesman] setup email failed:", e);
    return false;
  }
}

serve(async (req) => {
  // Echo the caller's real origin so dealer subdomains (*.xdrive.my) pass the
  // browser CORS check. Reusing a null-origin header set here hardcoded the
  // allow-origin to https://xdrive.my, so every request from a dealer
  // storefront subdomain was blocked pre-flight -> "Server unreachable".
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
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
      .select("role, id, dealership")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile || !["dealer", "superadmin", "owner"].includes(callerProfile.role)) {
      return json({ error: "forbidden" }, 403);
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));

    // ── Resend setup email (no new account) ─────────────────────────────────
    // The dealer's Team tab calls this when a salesman hasn't finished setup and
    // their emailed link has expired. Regenerates a fresh recovery link and
    // re-sends it; creates nothing.
    if (body.action === "resend_setup") {
      const targetEmail = body.email;
      if (!targetEmail) return json({ error: "invalid_input" }, 400);
      const { data: target } = await adminClient
        .from("profiles")
        .select("id, email, full_name, dealership, dealer_id, role")
        .eq("email", targetEmail)
        .maybeSingle();
      if (!target) return json({ error: "not_found" }, 404);
      // Authz: superadmin, or the salesman belongs to the caller's dealership
      // (owner/dealer are their own dealer, so their id IS the dealer_id).
      const isSuper = callerProfile.role === "superadmin";
      if (!isSuper && target.dealer_id !== callerProfile.id) {
        return json({ error: "forbidden" }, 403);
      }
      const dealershipName = target.dealership || callerProfile.dealership || target.full_name || "Your dealership";
      const sent = await sendSetupEmail(adminClient, targetEmail, target.full_name || "there", dealershipName);
      return json({ success: true, email_sent: sent });
    }

    const { email, full_name, dealer_id, plan, phone, slug } = body;

    if (!email || !full_name || !plan) {
      return json({ error: "invalid_input" }, 400);
    }
    if (!["salesman_full", "salesman_lite"].includes(plan)) {
      return json({ error: "invalid_input" }, 400);
    }

    // Authz: a dealer/owner caller may only create salesmen inside their OWN
    // tenant -- never trust a client-supplied dealer_id, or a dealer could
    // plant an account inside a competitor's tenant (cross-tenant IDOR).
    // Only superadmin may target an arbitrary dealer_id (or null, for a
    // standalone account).
    const isSuperCaller = callerProfile.role === "superadmin";
    const effectiveDealerId = isSuperCaller ? (dealer_id ?? null) : callerProfile.id;

    // Pay-first gate for solo Salesman Premium, mirrored from the DB trigger
    // prevent_profile_privilege_escalation's `gated` rule. That trigger no-ops
    // for this function's service-role writes (auth.uid() IS NULL short-
    // circuits it), so without this the row lands with payment_status NULL --
    // which SalesmanPremium.jsx treats as "grandfathered, pass" -- creating a
    // permanently free, unpaid Premium account.
    const paymentStatus = plan === "salesman_full" && !effectiveDealerId ? "pending" : null;

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
        dealer_id: effectiveDealerId,
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
          dealer_id: effectiveDealerId,
          payment_status: paymentStatus,
          phone: phone ?? null,
          // Seed whatsapp_number from the dealer-entered phone — the salesman
          // panel Settings, storefront and enquiry buttons all read
          // whatsapp_number, so without this the dealer's number never surfaces.
          // The salesman can confirm/change it in the /salesman-setup onboarding.
          whatsapp_number: phone ?? null,
          slug: slug ?? null,
          dealership: callerProfile.role !== "superadmin"
            ? undefined  // will be set by the dealer's own dealership value below
            : undefined,
          is_active: true,
          // Dealer-created salesmen are fully provisioned here (tier, name, slug,
          // dealership all set by the dealer), so they must NOT be sent through the
          // self-serve tier-picker onboarding on first login. Mark them onboarded;
          // the emailed setup link below lets them set their own password.
          onboarding_complete: true,
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
        dealer_id: effectiveDealerId,
        payment_status: paymentStatus,
        phone: phone ?? null,
        whatsapp_number: phone ?? null,
        slug: slug ?? null,
        is_active: true,
        onboarding_complete: true,
      });
      if (insertErr) {
        // Best-effort cleanup: delete auth user so no orphan is left
        await adminClient.auth.admin.deleteUser(newUserId);
        console.error("profile insert error:", insertErr);
        return json({ error: "profile_creation_failed" }, 500);
      }
    }

    // Propagate dealership name from parent dealer
    let dealershipName = full_name;
    if (effectiveDealerId) {
      const { data: dealerRow } = await adminClient
        .from("profiles")
        .select("dealership")
        .eq("id", effectiveDealerId)
        .maybeSingle();
      if (dealerRow?.dealership) {
        dealershipName = dealerRow.dealership;
        await adminClient
          .from("profiles")
          .update({ dealership: dealerRow.dealership })
          .eq("id", newUserId);
      }
    }

    // Email the salesman a one-time link to set their own password, so they don't
    // depend on the dealer relaying the temp password. Non-fatal: if the Resend
    // key is unset or Resend errors, the dealer still gets temp_password to share.
    const emailSent = await sendSetupEmail(adminClient, email, full_name, dealershipName);

    const { data: finalProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUserId)
      .maybeSingle();

    return json({
      success: true,
      user_id: newUserId,
      temp_password: tempPassword,
      email_sent: emailSent,
      profile: finalProfile,
    });
  } catch (e) {
    console.error("create-salesman error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
