import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { markBuyerIntent, markBuyerConsent, ensureBuyerProfile, consumePostAuthReturn, hasPostAuthReturn } from "../lib/buyerAuth";
import { routeForProfile, ROUTE_PROFILE_COLUMNS } from "../hooks/useRoleRedirect";
import { Heart, Bell, MessageCircle, Tag, Check, Eye, EyeOff, ArrowLeft } from "lucide-react";
import LegalModal from "../components/LegalModal";
import { RESET_AFTER_FAILS, throttleCheck, throttleFail, throttleClear, emailActionGate, EMAIL_ACTIONS } from "../utils/authThrottle";
import useAuthCaptcha, { isCaptchaError, captchaErrorMessage } from "../hooks/useAuthCaptcha";
import { checkAccountStatus } from "../utils/authAccountStatus";
import { authErrorMessage, isWrongCredentials, reportAuthFailure } from "../utils/authErrors";
import { isPlatformRole, PLATFORM_ONLY_MESSAGE } from "../utils/platformOnly";
import { refusePlatformAccount, evictPlatformSession } from "../lib/platformEvict";
import { SITE_URL, isOwnHost } from "../config/site";
import { withTimeout } from "../config/marketplaceConfig";

// A magic-link send that has not answered in 20s is not coming back.
const OTP_SEND_TIMEOUT_MS = 20000;
const OTP_SEND_TIMEOUT_ERROR = { code: "send_timeout", message: "The server took too long to answer. Please try again." };

const CONSENT_ERR =
  "Please confirm you're 18+ and agree to the Terms of Service and Privacy Policy to continue.";

// Buyer SIGN-UP surface: it carries the PDPA consent tick and the shopper
// benefits, and it creates a role='buyer' profile. It is no longer offered as a
// separate sign-in door — the header now sends everyone to /login, which routes
// by role — but the route stays live because /account's guard and the buyer
// signup CTAs still link here, and because signup is where consent is recorded.

const BENEFITS = [
  { Icon: Heart,         title: "Save & compare cars",  desc: "Build a shortlist and pick up where you left off on any device." },
  { Icon: Bell,          title: "Price-drop alerts",    desc: "Get notified the moment a saved car drops in price." },
  { Icon: MessageCircle, title: "Faster enquiries",     desc: "Message dealers and book viewings without re-typing your details." },
  { Icon: Tag,           title: "Sell when you're ready", desc: "List your own car on XDrive in a few taps." },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.823-3.422-11.387-8.172l-6.516 5.022C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
    </svg>
  );
}

export default function BuyerAuthPage() {
  // AUTH-6: fresh proof-of-human token per auth call (inert until configured).
  const { getToken } = useAuthCaptcha();
  const isProd = isOwnHost(window.location.hostname);
  const base = isProd ? SITE_URL : window.location.origin;

  // /buyer-signup opens on Create account. Both routes render this page, and it
  // used to always start on Sign in, so "Sign up to buy" (LoginPage) and "Create
  // a buyer account" (FindMePage) landed buyers on the wrong form.
  const { pathname } = useLocation();
  const [mode, setMode] = useState(() => (pathname === "/buyer-signup" ? "signup" : "signin")); // 'signin' | 'signup'
  const isSignup = mode === "signup";
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // Google/OTP-only accounts have no password — offer a magic link instead of reset.
  const [showMagic, setShowMagic] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  // Brute-force lock, shared with /login and /platform (utils/authThrottle.js).
  // This page had NO throttle at all: the dealer login enforced one and the
  // buyer login did not, so unlimited password guessing was one URL away.
  const [lockSeconds, setLockSeconds] = useState(0);

  useEffect(() => {
    document.title = "Sign in — XDrive";
    setMounted(true);
    // Already signed in? Route them on.
    supabase.auth.getSession().then(({ data }) => {
      // A guest (anonymous chat session) is not signed in as far as this page
      // is concerned: bouncing them to /account made signup unreachable for
      // exactly the buyers most likely to need it.
      if (data.session?.user && !data.session.user.is_anonymous) redirectByRole(data.session.user);
    });
  }, []);

  const redirectByRole = async (user) => {
    if (!user?.id) return;
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select(ROUTE_PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    // The platform admin account signs in at /platform only (utils/platformOnly.js).
    if (isPlatformRole(profile?.role)) {
      await evictPlatformSession();
      setError(PLATFORM_ONLY_MESSAGE);
      setLoading(false);
      return;
    }
    // One shared resolver. A buyer resolves to /account, which is also the
    // fallback for a role this page does not expect, so a mis-typed role can
    // never send a shopper into a seller panel. dealer_id/plan are selected
    // because a standalone salesman's home is Lite or Premium, not /salesman.
    // A seller account that came here from "Chat here" / the heart goes back
    // to that car too (utils/postAuthRoute.js preferReturn), not its panel.
    const home = routeForProfile(profile);
    window.location.href = `${base}${home === "/account" || hasPostAuthReturn() ? consumePostAuthReturn(home) : home}`;
  };

  // Tick the visible lockout down. Same shape as LoginPage's.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const id = setInterval(() => setLockSeconds((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [lockSeconds]);

  const switchMode = (m) => { setMode(m); setError(""); setConfirmSent(false); setShowForgot(false); setShowMagic(false); setMagicSent(false); };
  // Following a link between the two routes keeps this page mounted.
  useEffect(() => {
    switchMode(pathname === "/buyer-signup" ? "signup" : "signin");
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMagicLink = async () => {
    if (isSignup && !consent) { setError(CONSENT_ERR); return; }
    if (!email.trim()) { setError("Enter your email address first."); return; }
    if (isSignup) markBuyerConsent();
    setError("");
    setMagicLoading(true);
    // AUTH-5: 3 sends per address per 15 min, checked before we send.
    const gate = await emailActionGate(email, EMAIL_ACTIONS.MAGIC);
    if (!gate.allowed) { setError(gate.message); setMagicLoading(false); return; }
    const captchaToken = await getToken();
    // Capped: the send waits on the auth lock, and a held lock or a stalled
    // server hangs it with no error, leaving the button on "Sending..." forever.
    const { error } = await withTimeout(supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        captchaToken,
        emailRedirectTo: `${base}/auth/callback`,
        // Only offered to an EXISTING password-less account (see handleSignIn),
        // so never mint a new one here — that would skip the PDPA consent tick.
        shouldCreateUser: false,
      },
    }), OTP_SEND_TIMEOUT_MS).catch(() => ({ error: OTP_SEND_TIMEOUT_ERROR }));
    setMagicLoading(false);
    if (error) {
      console.error("[BuyerAuthPage] magic link send failed:", error.code, error.message);
      reportAuthFailure("buyer_magic_link_send", error);
      setError(authErrorMessage(error));
    } else setMagicSent(true);
  };

  const handleGoogle = async () => {
    // Signing up via Google still needs the consent tick — the profile row is created
    // over at /auth/callback, so the answer rides across the redirect in sessionStorage.
    if (isSignup && !consent) { setError(CONSENT_ERR); return; }
    markBuyerIntent(); // OAuth callback materialises a buyer profile -> /account
    if (isSignup) markBuyerConsent();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/auth/callback` },
    });
    if (error) {
      reportAuthFailure("buyer_google_start", error);
      setError(authErrorMessage(error));
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    if (lockSeconds > 0) { setError(`Too many attempts. Try again in ${lockSeconds}s.`); return; }
    setError(""); setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    // Server-side lock check before the attempt — a reload cannot shake it off.
    const gate = await throttleCheck(cleanEmail);
    if (!gate.allowed) {
      setLockSeconds(gate.secondsLeft);
      setError(`Too many attempts. Try again in ${gate.secondsLeft}s.`);
      setLoading(false);
      return;
    }

    const captchaToken = await getToken();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password, options: { captchaToken } });
    if (error) {
      // A captcha rejection is also a 400, so it has to be caught before the
      // isInvalidCreds test below reads it as a wrong password — that would
      // spend one of the three attempts on a credential that was never judged.
      if (isCaptchaError(error)) {
        setShowMagic(false);
        setShowForgot(false);
        setError(captchaErrorMessage());
        setLoading(false);
        return;
      }
      // Only a rejected credential counts against the lock — an unconfirmed
      // email or a 5xx is not a guess, and it must not spend an attempt or get
      // answered with "wrong password".
      // Classified on error.code: status 400 is also what an unconfirmed email
      // returns, which the old test counted as a wrong password.
      const isInvalidCreds = isWrongCredentials(error);
      if (!isInvalidCreds) {
        console.error("[BuyerAuthPage] sign-in failed:", error.code, error.message);
        reportAuthFailure("buyer_password_signin", error);
        setShowMagic(false);
        setShowForgot(false);
        setError(authErrorMessage(error));
        setLoading(false);
        return;
      }
      const f = await throttleFail(cleanEmail);
      if (f.locked) setLockSeconds(f.secondsLeft);
      // Distinguish "no account" vs "wrong password" and offer the right recovery:
      // a password user gets a reset link; a Google/OTP-only user gets a magic link.
      // Goes through the Turnstile-gated api/auth-account-status.js — the RPC
      // itself is no longer anon-callable (SEC-B5 — it's an enumeration oracle).
      const statusToken = await getToken();
      const st = await checkAccountStatus(cleanEmail, statusToken);
      if (st?.account_exists && !st?.has_password) {
        // No password to get wrong — the link is their only way in, so it shows
        // on the first try and the lock never hides it.
        setShowForgot(false);
        setShowMagic(true);
        setError(f.locked
          ? `Too many attempts. Try again in ${f.secondsLeft}s, or get a magic link below.`
          : "This email signed up with Google. Use “Continue with Google”, or get a magic link below.");
      } else if (st?.account_exists) {
        // Reset offered from the 3rd wrong password, not the 1st — same rule as
        // /login. Three is also where the lock lands, so the way out arrives with it.
        const offerReset = f.attempts >= RESET_AFTER_FAILS;
        setShowMagic(false);
        setShowForgot(offerReset);
        setError(
          f.locked
            ? `Wrong password ${f.attempts} times. Try again in ${f.secondsLeft}s, or reset it below.`
            : offerReset
            ? "Wrong password. Try again, or reset it below."
            : "Wrong password. Please try again.",
        );
      } else {
        setShowMagic(false);
        setShowForgot(false);
        setError("No account found with that email. Check for typos or create one.");
      }
      setLoading(false);
      return;
    }
    throttleClear(cleanEmail);
    try {
      // Before ensureBuyerProfile: nothing on this page may write to the
      // platform admin account's profile. It signs in at /platform only.
      if (await refusePlatformAccount(data.user?.id)) {
        setError(PLATFORM_ONLY_MESSAGE);
        setLoading(false);
        return;
      }
      await ensureBuyerProfile(data.user);
      await redirectByRole(data.user);
    } catch (err) {
      // Used to be unguarded: a failed profile write left the button spinning forever.
      console.error("[BuyerAuthPage] post-login setup failed:", err);
      reportAuthFailure("buyer_profile_setup", err);
      setError(authErrorMessage(err, "You're signed in, but we couldn't load your account. Please try again."));
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) { setError("Enter your email and a password."); return; }
    if (!pwValid) { setError("Please meet all the password requirements below."); return; }
    if (!consent) { setError(CONSENT_ERR); return; }
    setError(""); setLoading(true);
    const captchaToken = await getToken();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { captchaToken, emailRedirectTo: `${base}/auth/callback`, data: { account_type: "buyer" } },
    });
    if (error) {
      console.error("[BuyerAuthPage] sign-up failed:", error.code, error.message);
      reportAuthFailure("buyer_signup", error);
      setError(authErrorMessage(error));
      setLoading(false);
      return;
    }
    // Empty identities array (no error) = email already registered.
    if (data?.user && (data.user.identities?.length ?? 0) === 0) {
      setError("An account with this email already exists. Please log in instead.");
      setLoading(false);
      return;
    }
    if (data.session) {
      try {
        await ensureBuyerProfile(data.user, { consent: true });
      } catch (err) {
        console.error("[BuyerAuthPage] buyer profile setup failed:", err);
        reportAuthFailure("buyer_profile_setup", err);
        setError(authErrorMessage(err, "Your account was created, but we couldn't finish setting it up. Please sign in again."));
        setLoading(false);
        return;
      }
      window.location.href = `${base}${consumePostAuthReturn()}`;
      return;
    }
    // No session means email confirmation is on; the profile is created at
    // /auth/callback instead, so hand the consent over the same way OAuth does.
    markBuyerConsent();
    setLoading(false);
    setConfirmSent(true);
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("Enter your email above first."); return; }
    setError("");
    setResetLoading(true);
    // AUTH-5, own bucket — see LoginPage. Same gate, same numbers.
    const gate = await emailActionGate(email, EMAIL_ACTIONS.RESET);
    if (!gate.allowed) { setError(gate.message); setResetLoading(false); return; }
    const captchaToken = await getToken();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { captchaToken, redirectTo: `${base}/reset-password` });
    setResetLoading(false);
    if (error) {
      console.error("[BuyerAuthPage] reset code send failed:", error.code, error.message);
      reportAuthFailure("buyer_reset_send", error);
      setError(authErrorMessage(error));
    } else setResetSent(true);
  };

  // Supabase password policy: 8+ chars and at least one of each character class.
  // Surfaced live below the field on sign-up so users never hit the server error.
  const pwChecks = [
    { label: "At least 8 characters",        ok: password.length >= 8 },
    { label: "A lowercase letter (a–z)",     ok: /[a-z]/.test(password) },
    { label: "An uppercase letter (A–Z)",    ok: /[A-Z]/.test(password) },
    { label: "A number (0–9)",               ok: /[0-9]/.test(password) },
    { label: "A symbol (!@#$%…)",            ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const pwValid = pwChecks.every((c) => c.ok);
  const showPwChecks = isSignup && (pwFocused || password.length > 0) && !pwValid;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        /* Light surface, same tokens as /login and the marketplace (DESIGN.md). */
        .ba { min-height: 100vh; display: flex; background: #F7F6F2; font-family: var(--xd-font-body); color: #111827; }

        .ba-left { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 48px 52px; background: #F7F6F2; border-right: 1px solid rgba(0,0,0,0.06); position: relative; overflow: hidden; }

        .ba-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; text-decoration: none; }
        .ba-brand-mark { width: 38px; height: 38px; background: #dc2626; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #fff; }
        /* The only XDrive wordmark is white-on-transparent. invert + hue-rotate
           turns the white to ink and leaves the red bar red. */
        .ba-brand-img { height: 20px; width: auto; display: block; filter: invert(1) hue-rotate(180deg); }

        .ba-hero { position: relative; z-index: 1; }
        .ba-hero-eyebrow { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: #dc2626; font-weight: 600; margin-bottom: 18px; }
        .ba-hero-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 4.2vw, 58px); color: #0f1115; letter-spacing: 2px; line-height: 1.05; margin-bottom: 28px; }
        .ba-hero-title span { color: #dc2626; }

        .ba-benefits { display: flex; flex-direction: column; gap: 18px; }
        .ba-benefit { display: flex; gap: 14px; align-items: flex-start; }
        .ba-benefit-ic { width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: #fff; border: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; color: #dc2626; }
        .ba-benefit-t { font-size: 14px; font-weight: 600; color: #111827; margin: 0; }
        .ba-benefit-d { font-size: 13px; color: #6b7280; line-height: 1.5; margin: 2px 0 0; }

        .ba-left-footer { font-size: 11px; color: #9ca3af; position: relative; z-index: 1; }

        .ba-right { width: 480px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; padding: 48px 52px; background: #FFFFFF; overflow-y: auto; }
        .ba-right { opacity: 0; transform: translateX(12px); transition: opacity .5s ease, transform .5s ease; }
        .ba-right.in { opacity: 1; transform: translateX(0); }

        .ba-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7280; text-decoration: none; margin-bottom: 22px; width: max-content; }
        .ba-back:hover { color: #111827; }

        /* Sign in | Sign up as two tabs with an underline, the shape a buyer
           knows from every marketplace app. */
        .ba-toggle { display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px; }
        .ba-toggle-btn { flex: 1; padding: 12px 0; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600; background: transparent; color: #6b7280; transition: color .15s, border-color .15s; }
        .ba-toggle-btn.on { color: #dc2626; border-bottom-color: #dc2626; }

        .ba-head { margin-bottom: 22px; }
        .ba-head-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: #0f1115; letter-spacing: 2px; line-height: 1; margin: 0; }
        .ba-head-sub { font-size: 14px; color: #6b7280; margin: 6px 0 0; }

        .ba-google { width: 100%; padding: 13px; background: #fff; border: 1px solid #d1d5db; border-radius: 10px; color: #111827; font-family: inherit; font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background .18s, border-color .18s; }
        .ba-google:hover { background: #f9fafb; border-color: #9ca3af; }

        .ba-or { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
        .ba-or-line { flex: 1; height: 1px; background: #e5e7eb; }
        .ba-or-text { font-size: 12px; color: #9ca3af; letter-spacing: 0.1em; }

        .ba-field { margin-bottom: 14px; }
        .ba-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .ba-label { font-size: 13px; color: #374151; font-weight: 600; }
        .ba-forgot { font-size: 13px; color: #dc2626; font-weight: 500; background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; }
        .ba-forgot:hover { color: #b91c1c; }
        .ba-input-wrap { position: relative; }
        /* 16px: anything smaller makes iOS Safari zoom the page on focus. */
        .ba-input { width: 100%; background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 14px; color: #111827; font-family: inherit; font-size: 16px; outline: none; transition: border-color .2s, box-shadow .2s; }
        .ba-input::placeholder { color: #9ca3af; }
        .ba-input:focus { border-color: #0f1115; box-shadow: 0 0 0 3px rgba(15,17,21,0.08); }
        .ba-input.pr { padding-right: 42px; }
        .ba-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: #6b7280; display: flex; }
        .ba-eye:hover { color: #111827; }

        .ba-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; color: #b91c1c; font-size: 13px; line-height: 1.5; margin-bottom: 14px; }
        .ba-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .ba-note-t { font-size: 13px; color: #92400e; font-weight: 600; margin: 0 0 3px; }
        .ba-note-b { font-size: 12.5px; color: #a16207; line-height: 1.5; margin: 0; }
        .ba-success { color: #15803d; font-size: 13px; display: flex; align-items: center; gap: 6px; margin: 0 0 12px; }

        .ba-pwreq { margin: -4px 0 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
        .ba-pwreq-head { font-size: 12px; color: #374151; margin: 0 0 7px; font-weight: 600; }
        .ba-pwreq-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #6b7280; padding: 2px 0; transition: color .15s; }
        .ba-pwreq-item.ok { color: #15803d; }
        .ba-pwreq-ic { width: 14px; height: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .ba-pwreq-dot { width: 5px; height: 5px; border-radius: 50%; background: #9ca3af; }

        .ba-reset { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .ba-reset-hint { font-size: 12.5px; color: #6b7280; margin: 0 0 10px; line-height: 1.5; }
        .ba-reset-btn { width: 100%; padding: 10px; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; color: #111827; font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 2px; cursor: pointer; }
        .ba-reset-btn:hover:not(:disabled) { border-color: #0f1115; }

        .ba-submit { width: 100%; padding: 14px; background: #dc2626; border: none; border-radius: 10px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; cursor: pointer; transition: background .2s, box-shadow .2s; margin-top: 4px; }
        .ba-submit:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 6px 18px rgba(220,38,38,0.22); }
        .ba-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .ba-foot { margin-top: 22px; padding-top: 18px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 14px; color: #6b7280; }
        .ba-foot-link { color: #dc2626; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; }
        .ba-foot-link:hover { color: #b91c1c; }
        .ba-seller { margin-top: 14px; text-align: center; font-size: 13px; color: #6b7280; }
        .ba-seller a { color: #111827; text-decoration: underline; }

        @media (max-width: 860px) {
          .ba { flex-direction: column; background: #FFFFFF; }
          .ba-left { display: none; }
          .ba-right { width: 100%; padding: 32px 20px; min-height: 100vh; justify-content: flex-start; }
        }
      `}</style>

      <div className="ba">
        {/* Left — buyer benefits */}
        <div className="ba-left">
          <Link to="/" className="ba-brand">
            <div className="ba-brand-mark">X</div>
            <img src="/logo-xdrive.png" alt="XDrive" width="349" height="58" className="ba-brand-img" />
          </Link>

          <div className="ba-hero">
            <p className="ba-hero-eyebrow">Your XDrive Account</p>
            <h1 className="ba-hero-title">Shop smarter,<br /><span>buy with confidence</span></h1>
            <div className="ba-benefits">
              {BENEFITS.map(({ Icon, title, desc }) => (
                <div className="ba-benefit" key={title}>
                  <div className="ba-benefit-ic"><Icon size={17} /></div>
                  <div>
                    <p className="ba-benefit-t">{title}</p>
                    <p className="ba-benefit-d">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ba-left-footer">
            &copy; {new Date().getFullYear()} XDrive &nbsp;&middot;&nbsp;
            <a href="/terms" style={{ color: "inherit", textDecoration: "underline" }}>Terms</a>
            &nbsp;&middot;&nbsp;
            <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>Privacy</a>
          </div>
        </div>

        {/* Right — form */}
        <div className={`ba-right${mounted ? " in" : ""}`}>
          <Link to="/" className="ba-back"><ArrowLeft size={14} /> Back to marketplace</Link>

          <div className="ba-toggle">
            <button className={`ba-toggle-btn${!isSignup ? " on" : ""}`} onClick={() => switchMode("signin")}>Sign In</button>
            <button className={`ba-toggle-btn${isSignup ? " on" : ""}`} onClick={() => switchMode("signup")}>Sign Up</button>
          </div>

          <div className="ba-head">
            <h2 className="ba-head-title">{isSignup ? "CREATE ACCOUNT" : "WELCOME BACK"}</h2>
            <p className="ba-head-sub">{isSignup ? "Join XDrive to save cars, set alerts & enquire faster" : "Sign in to your XDrive buyer account"}</p>
          </div>

          {/* Sits above both sign-up paths on purpose: Google and email each create the
              account, so the consent has to gate them both rather than only the form. */}
          {isSignup && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "0 0 16px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: "#dc2626", width: 15, height: 15, cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>
                I confirm I am at least 18 years old and agree to the{" "}
                <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc("terms"); }} style={{ background: "none", border: "none", padding: 0, color: "#dc2626", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Terms of Service</button>
                {" "}and{" "}
                <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc("privacy"); }} style={{ background: "none", border: "none", padding: 0, color: "#dc2626", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Privacy Policy</button>.
              </span>
            </label>
          )}

          <button type="button" className="ba-google" onClick={handleGoogle}
            disabled={isSignup && !consent}
            style={isSignup && !consent ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="ba-or"><div className="ba-or-line" /><span className="ba-or-text">OR</span><div className="ba-or-line" /></div>

          <form noValidate onSubmit={(e) => { e.preventDefault(); isSignup ? handleSignUp() : handleSignIn(); }}>
            <div className="ba-field">
              <div className="ba-label-row"><label className="ba-label">Email Address</label></div>
              <div className="ba-input-wrap">
                <input className="ba-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
            </div>

            <div className="ba-field">
              <div className="ba-label-row">
                <label className="ba-label">Password</label>
                {!isSignup && (
                  <button type="button" className="ba-forgot" onClick={() => setShowForgot((p) => !p)}>
                    {showForgot ? "← back" : "Forgot password?"}
                  </button>
                )}
              </div>
              <div className="ba-input-wrap">
                <input className="ba-input pr" type={showPassword ? "text" : "password"} placeholder={isSignup ? "Create a strong password" : "••••••••"} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)} autoComplete={isSignup ? "new-password" : "current-password"} />
                <button type="button" className="ba-eye" onClick={() => setShowPassword((p) => !p)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {showPwChecks && (
                <div className="ba-pwreq">
                  <p className="ba-pwreq-head">Your password must include:</p>
                  {pwChecks.map((c) => (
                    <div key={c.label} className={`ba-pwreq-item${c.ok ? " ok" : ""}`}>
                      <span className="ba-pwreq-ic">{c.ok ? <Check size={11} strokeWidth={3} /> : <span className="ba-pwreq-dot" />}</span>
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showForgot && !isSignup && (
              <div className="ba-reset">
                {resetSent ? (
                  <>
                    <p className="ba-success"><Check size={13} /> Code sent — check your inbox.</p>
                    {/* A code needs somewhere to be typed — see LoginPage. */}
                    <button
                      type="button"
                      className="ba-reset-btn"
                      onClick={() => { window.location.href = `${base}/reset-password?email=${encodeURIComponent(email.trim())}`; }}
                    >
                      ENTER THE CODE
                    </button>
                  </>
                ) : (
                  <>
                    <p className="ba-reset-hint">We'll email a 6-digit code to the address above. It lasts an hour and works on any device.</p>
                    <button type="button" className="ba-reset-btn" onClick={handleForgot} disabled={resetLoading}>
                      {resetLoading ? "SENDING…" : "SEND RESET CODE"}
                    </button>
                  </>
                )}
              </div>
            )}

            {showMagic && !isSignup && (
              <div className="ba-reset">
                {magicSent ? (
                  <p className="ba-success"><Check size={13} /> Magic link sent — check your inbox.</p>
                ) : (
                  <>
                    <p className="ba-reset-hint">No password on this account — we'll email you a one-tap magic link to sign in.</p>
                    <button type="button" className="ba-reset-btn" onClick={sendMagicLink} disabled={magicLoading}>
                      {magicLoading ? "SENDING…" : "EMAIL ME A MAGIC LINK"}
                    </button>
                  </>
                )}
              </div>
            )}

            {error && <div className="ba-error">⚠ {error}</div>}

            {confirmSent && (
              <div className="ba-note">
                <p className="ba-note-t">Check your inbox</p>
                <p className="ba-note-b">We sent a confirmation link to {email}. Click it to finish creating your account, then sign in.</p>
              </div>
            )}

            <button type="submit" className="ba-submit" disabled={loading || (isSignup && (!pwValid || !consent))}>
              {loading ? "PLEASE WAIT…" : isSignup ? "CREATE ACCOUNT" : "SIGN IN"}
            </button>
          </form>

          <div className="ba-foot">
            {isSignup ? (
              <>Already have an account? <button className="ba-foot-link" onClick={() => switchMode("signin")}>Sign in</button></>
            ) : (
              <>New to XDrive? <button className="ba-foot-link" onClick={() => switchMode("signup")}>Sign up</button></>
            )}
          </div>

          <p className="ba-seller">Are you a dealer or agent? <a href="/login">Seller sign in</a></p>
        </div>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </>
  );
}
