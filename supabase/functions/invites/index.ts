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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Vary": "Origin",
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

const ROLE_LABELS: Record<string, string> = {
  manager: "manager",
  admin: "admin",
  accountant: "accountant",
  fi_officer: "F&I officer",
};

// Emails a newly-invited back-office team member a one-time link to set their
// own password. Uses the SAME Resend channel as create-salesman/send-document
// (RESEND_API_KEY) — NOT Supabase Auth SMTP. Routes to /reset-password (the
// standard set-a-new-password page); once set they log in and are redirected by
// role. Returns whether the email actually sent so the caller can fall back to
// the temp password.
async function sendTeamSetupEmail(
  adminClient: any,
  email: string,
  fullName: string,
  dealershipName: string,
  roleLabel: string,
): Promise<boolean> {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return false;
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://xdrive.my/reset-password" },
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
    <p style="margin:0 0 16px;">Hi ${fullName}, ${dealershipName} has created your ${roleLabel} account on ShiftOS.</p>
    <p style="margin:0 0 24px;">Set your password to finish setting up and access your dashboard:</p>
    <a href="${actionLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:8px;">Set your password</a>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">This link is single use and expires. If it no longer works, use &quot;Forgot password&quot; on the ShiftOS login page and we will email you a 6-digit code.</p>
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
        subject: `Set up your ${dealershipName} ${roleLabel} account`,
        html,
      }),
    });
    if (!resendRes.ok) {
      console.error("[invites] Resend error:", await resendRes.text());
    }
    return resendRes.ok;
  } catch (e) {
    console.error("[invites] setup email failed:", e);
    return false;
  }
}

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

    // Email the new team member a link to set their own password (parity with
    // the salesman flow). Non-fatal: if Resend is unset/errors, the dealer still
    // gets temp_password to relay.
    const dealershipName = dealership || callerProfile.dealership || "Your dealership";
    const emailSent = await sendTeamSetupEmail(
      adminClient, email, full_name, dealershipName, ROLE_LABELS[role] || "team",
    );

    const { data: finalProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUserId)
      .maybeSingle();

    return json({ success: true, invite: finalProfile, temp_password: pw, email_sent: emailSent }, 200, origin);
  } catch (e) {
    console.error("invites error:", e);
    // Return CORS for the caller's real origin so a dealer subdomain surfaces the
    // actual 500 instead of a browser CORS block masquerading as "server unreachable".
    return json({ error: "internal_error" }, 500, req.headers.get("Origin"));
  }
});
