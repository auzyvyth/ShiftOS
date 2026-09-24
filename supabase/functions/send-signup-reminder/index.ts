import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Origin allowlist lives in ../_shared/cors.ts (MOBILE-4) — one list for every function.
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function buildHtml(name: string, continueUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Finish setting up ShiftOS</title></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f5;margin:0;padding:24px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <div style="background:#111827;padding:26px 30px;">
      <span style="display:inline-block;width:26px;height:26px;background:#dc2626;border-radius:6px;color:#fff;font-weight:800;font-size:14px;line-height:26px;text-align:center;">X</span>
      <span style="color:#fff;font-weight:700;font-size:16px;margin-left:8px;vertical-align:middle;">ShiftOS</span>
    </div>
    <div style="padding:30px 32px;">
      <h1 style="margin:0 0 14px;font-size:20px;color:#111827;">Hi ${name}, you're almost set up</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#374151;">
        Your ShiftOS account isn't finished setting up yet. Complete it now to start listing cars and selling faster.
      </p>
      <a href="${continueUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;padding:13px 26px;border-radius:8px;">Finish setting up</a>
      <p style="margin:22px 0 0;font-size:12px;color:#9ca3af;">If you didn't try to sign up for ShiftOS, you can ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401, origin);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, origin);

  // Superadmin only — this sends real email to a real signup, unlike
  // send-document which a dealer sends to their own buyer.
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "superadmin") return json({ error: "Forbidden" }, 403, origin);

  let body: { user_id: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }
  const { user_id } = body;
  if (!user_id) return json({ error: "user_id required" }, 400, origin);

  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, onboarding_complete")
    .eq("id", user_id)
    .single();
  if (targetErr || !target) return json({ error: "Account not found" }, 404, origin);
  // Guard against a stale button click racing a signup that finished onboarding
  // between page load and click — never nudge someone who is already in.
  if (target.onboarding_complete) return json({ error: "This account already finished onboarding" }, 400, origin);
  if (!target.email) return json({ error: "No email on this account" }, 400, origin);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return json({ error: "Email service not configured — RESEND_API_KEY not set" }, 500, origin);
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

  // Same shape as the original signup verification link, not a plain /login
  // link: a magiclink token_hash that /auth/confirm (AuthConfirmPage.jsx)
  // verifies and, on success, routes straight into the unfinished onboarding
  // wizard via its existing onboarding_complete===false branches — instead of
  // dropping the user on the sign-in form with no session and no memory of
  // where they were. type: "magiclink" (not "recovery") because this account
  // may have no password at all (Google sign-in never sets one).
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: { redirectTo: "https://xdrive.my/auth/confirm" },
  });
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    console.error("[send-signup-reminder] generateLink error:", linkErr);
    return json({ error: "Could not generate a continue link" }, 500, origin);
  }
  const continueUrl = `https://xdrive.my/auth/confirm?token_hash=${hashedToken}&type=magiclink`;

  const html = buildHtml(target.full_name || "there", continueUrl);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ShiftOS <${fromEmail}>`,
      to: [target.email],
      subject: "Finish setting up your ShiftOS account",
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    console.error("[send-signup-reminder] Resend error:", err);
    return json({ error: (err as { message?: string }).message || "Email send failed" }, 502, origin);
  }

  await supabase
    .from("profiles")
    .update({ signup_reminder_sent_at: new Date().toISOString() })
    .eq("id", user_id);

  return json({ ok: true }, 200, origin);
});
