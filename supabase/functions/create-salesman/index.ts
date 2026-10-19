// FIXED: auth-first account creation
// PLAN: uses account_plan enum for role differentiation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Origin allowlist lives in ../_shared/cors.ts (MOBILE-4) — one list for every function.

// The project's auth policy requires a lowercase letter, an uppercase letter,
// a digit AND a symbol. The old generator drew letters and digits only, so
// createUser rejected it ("Password should contain at least one character of
// each") and no account could be made. Guarantee one of each class, then shuffle.
function generatePassword(length = 14): string {
  const classes = [
    "abcdefghjkmnpqrstuvwxyz",
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "23456789",
    "!@#$%^&*-_",
  ];
  const all = classes.join("");
  const rand = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = classes.map((c) => c[rand(c.length)]);
  while (chars.length < length) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Same allowed values as the profiles CHECK constraints
// (profiles_seller_type_check, profiles_new_car_brand_check). Checked here so a
// bad value is a clear invalid_input instead of a failed profile write, which
// deletes the half-made login and reads "profile_creation_failed".
const SELLER_TYPES = ["broker", "new_car", "private"];
const NEW_CAR_BRANDS = ["Proton", "Perodua", "Toyota", "BYD"];

// What a platform-set-up page holds, as label/value rows for the setup email,
// so the seller sees exactly what was filled in for them. Built from the
// SAVED profile row, never the request body, so the email can't list
// something the database refused.
const DETAIL_COLUMNS =
  "full_name, email, dealership, slug, whatsapp_number, state, city, location, seller_type, new_car_brand, plan, plan_expires_at, job_title, bio";
function setupDetails(p: any, base: string): Array<[string, string]> {
  const how = p.seller_type === "private" ? "Private seller"
    : [p.seller_type === "broker" ? "Broker / Agent" : null, p.new_car_brand ? `New car advisor (${p.new_car_brand})` : null]
      .filter(Boolean).join(" + ");
  const until = p.plan_expires_at
    ? new Date(p.plan_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" })
    : null;
  const plan = p.plan === "salesman_full" ? `Premium${until ? `, free until ${until}` : ""}` : "Lite (free)";
  const rows: Array<[string, string | null]> = [
    ["Name", p.full_name],
    ["Email", p.email],
    ["Business name", p.dealership],
    ["Your page", p.slug ? `${base}/s/${p.slug}` : null],
    ["WhatsApp", p.whatsapp_number],
    ["Area", [p.city, p.state].filter(Boolean).join(", ") || null],
    ["Shop address", p.location],
    ["How you sell", how || null],
    ["Plan", plan],
    ["Job title", p.job_title],
    ["Bio", p.bio],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
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
  // Standalone seller whose page the platform owner set up for them (console >
  // Create seller). There is no dealership, so "X has created your salesman
  // account" would name the seller as their own employer.
  standalone = false,
  // Where the "Set your password" button points. null = the old Supabase
  // action link (kept for clients deployed before the set-password page).
  setPasswordBase: string | null = null,
  details: Array<[string, string]> = [],
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
    // The new link carries the hashed token to OUR page, which verifies it
    // only when the seller presses "Set password". Supabase's own action link
    // spends the token on the first GET, so a mail scanner or a second tap
    // burned it and the seller landed on a code screen they had no code for.
    const hashed = linkData?.properties?.hashed_token;
    const actionLink = setPasswordBase && hashed
      ? `${setPasswordBase}/salesman-setup?token_hash=${encodeURIComponent(hashed)}&type=recovery`
      : linkData?.properties?.action_link;
    if (!actionLink) return false;
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const brand = standalone ? "XDrive" : dealershipName;
    const heading = standalone ? "Your seller page is ready" : "Welcome to the team";
    const intro = standalone
      ? `Hi ${fullName}, XDrive has set up your seller page and added your cars.`
      : `Hi ${fullName}, ${dealershipName} has created your salesman account on ShiftOS.`;
    const ask = standalone
      // Cars go live without the ID check since 20261017b; it only earns the
      // Verified badge. This line used to say the opposite.
      ? "Set your own password to take it over. Your cars are already live on your page."
      : "Set your password to finish setting up and access your dashboard:";
    const detailsHtml = details.length
      ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">What we set up for you. You can change any of it in Settings.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:13px;">${details.map(([k, v]) =>
      `<tr><td style="padding:7px 12px 7px 0;color:#6b7280;vertical-align:top;white-space:nowrap;border-top:1px solid #f3f4f6;">${esc(k)}</td><td style="padding:7px 0;color:#111827;border-top:1px solid #f3f4f6;word-break:break-word;">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`
      : "";
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px 0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
  <div style="background:#111827;padding:28px 32px;color:#fff;">
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">${brand}</p>
    <h1 style="margin:0;font-size:22px;font-weight:700;">${heading}</h1>
  </div>
  <div style="padding:28px 32px;color:#374151;font-size:14px;line-height:1.6;">
    <p style="margin:0 0 16px;">${esc(intro)}</p>
    <p style="margin:0 0 24px;">${ask}</p>
    ${detailsHtml}
    <a href="${actionLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:8px;">Set your password</a>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">This link works once and expires. If we send you another setup email, only the newest link works. If it no longer works, use &quot;Forgot password&quot; on the sign-in page.</p>
  </div>
  <div style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Sent by ${brand} via ShiftOS</p>
  </div>
</div></body></html>`;
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${brand} <${fromEmail}>`,
        to: [email],
        subject: standalone ? "Your XDrive seller page is ready" : `Set up your ${dealershipName} salesman account`,
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

// The set-password page lives on xdrive.my. A staging preview gets links back
// to itself so the flow can be tested before it ships; a dealer subdomain does
// not (the salesman panel is on xdrive.my).
function setPasswordBaseFor(origin: string | null): string {
  if (origin && /^https:\/\/shift-[a-z0-9-]+-shift-os\.vercel\.app$/.test(origin)) return origin;
  return "https://xdrive.my";
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
    // Clients that ship the set-password page say so; older builds still get
    // the old link, which their /reset-password page understands.
    const setPasswordBase = body.link === "set_password" ? setPasswordBaseFor(origin) : null;

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
      // Rate limit: every send REPLACES the link, so a double tap (no feedback
      // on the button, 2026-10-12: three sends in 12 seconds) killed the email
      // the seller then opened. Within a minute of the last send, keep it.
      const { data: authTarget } = await adminClient.auth.admin.getUserById(target.id);
      const lastSent = authTarget?.user?.recovery_sent_at ? Date.parse(authTarget.user.recovery_sent_at) : 0;
      if (lastSent && Date.now() - lastSent < 60_000) {
        return json({ success: true, email_sent: true, throttled: true });
      }
      const dealershipName = target.dealership || callerProfile.dealership || target.full_name || "Your dealership";
      let details: Array<[string, string]> = [];
      if (!target.dealer_id) {
        const { data: full } = await adminClient.from("profiles").select(DETAIL_COLUMNS).eq("id", target.id).maybeSingle();
        if (full) details = setupDetails(full, setPasswordBaseFor(origin));
      }
      const sent = await sendSetupEmail(adminClient, targetEmail, target.full_name || "there", dealershipName, !target.dealer_id, setPasswordBase, details);
      return json({ success: true, email_sent: sent });
    }

    const { email, full_name, dealer_id, plan, phone, slug } = body;
    // false = create the account but hold the setup email, so the platform
    // owner can add the seller's cars first and send it from the account
    // record ("Send setup email" -> resend_setup). Default keeps the dealer
    // Team tab's behaviour: email at once.
    const sendEmail = body.send_email !== false;

    if (!email || !full_name || !plan) {
      return json({ error: "invalid_input" }, 400);
    }
    if (!["salesman_full", "salesman_lite"].includes(plan)) {
      return json({ error: "invalid_input" }, 400);
    }

    const sellerType = body.seller_type ?? null;
    const newCarBrand = body.new_car_brand ?? null;
    if (sellerType !== null && !SELLER_TYPES.includes(sellerType)) return json({ error: "invalid_input" }, 400);
    if (newCarBrand !== null && !NEW_CAR_BRANDS.includes(newCarBrand)) return json({ error: "invalid_input" }, 400);
    const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

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
    //
    // The one exception is the platform console's "Set up a seller" choosing
    // Premium (owner, 2026-10-18): that is the free month, granted the way
    // start_premium_trial() grants it (a paid-through date, the marker set so
    // it is never granted twice). Those triggers skip service-role writes, so
    // the fields are written here. Before this, the owner signed in as the
    // seller and started the free month from Lite settings by hand.
    const consoleFreeMonth = isSuperCaller && !effectiveDealerId && plan === "salesman_full";
    const paymentStatus = plan === "salesman_full" && !effectiveDealerId && !consoleFreeMonth ? "pending" : null;
    const freeMonth = consoleFreeMonth
      ? {
        plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        premium_trial_started_at: new Date().toISOString(),
      }
      : {};

    // Standalone page set up by the platform: what signup collects (how they
    // sell, where they are based, their trading name) plus what the seller
    // would otherwise type into Settings later. Used by both profile writes
    // below so the slow-trigger insert lands the same row.
    const standaloneFields = isSuperCaller && !effectiveDealerId
      ? {
        state: body.state ?? null,
        city: body.city ?? null,
        // Signup's rule: no business name -> the seller's own name
        // (SalesmanOnboarding.jsx activate()).
        dealership: text(body.dealership, 120) ?? full_name,
        seller_type: sellerType,
        new_car_brand: newCarBrand,
        location: text(body.location, 200),
        job_title: text(body.job_title, 60),
        bio: text(body.bio, 2000),
      }
      : {};

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
        // Same tags signUp() puts on an organic login (SalesmanOnboarding.jsx),
        // so anything that reads them treats both accounts alike.
        account_type: "salesman",
        tier: plan === "salesman_full" ? "premium" : "lite",
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
          ...standaloneFields,
          ...freeMonth,
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
        ...standaloneFields,
        ...freeMonth,
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
    const { data: finalProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUserId)
      .maybeSingle();

    const emailSent = sendEmail
      ? await sendSetupEmail(adminClient, email, full_name, dealershipName, !effectiveDealerId, setPasswordBase,
        !effectiveDealerId && finalProfile ? setupDetails(finalProfile, setPasswordBaseFor(origin)) : [])
      : false;

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
