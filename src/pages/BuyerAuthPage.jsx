import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { markBuyerIntent, markBuyerConsent, ensureBuyerProfile } from "../lib/buyerAuth";
import { routeForProfile } from "../hooks/useRoleRedirect";
import { Heart, Bell, MessageCircle, Tag, Check, Eye, EyeOff, ArrowLeft } from "lucide-react";
import LegalModal from "../components/LegalModal";
import { RESET_AFTER_FAILS, throttleCheck, throttleFail, throttleClear, emailActionGate, EMAIL_ACTIONS } from "../utils/authThrottle";

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
  { Icon: Tag,           title: "Sell when you're ready", desc: "List your own car to thousands of buyers in a few taps." },
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
  const isProd = window.location.hostname === "xdrive.my" || window.location.hostname.endsWith(".xdrive.my");
  const base = isProd ? "https://xdrive.my" : window.location.origin;

  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
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
      if (data.session?.user) redirectByRole(data.session.user);
    });
  }, []);

  const redirectByRole = async (user) => {
    if (!user?.id) return;
    const { data: profile } = await supabase
      .from("profiles").select("role, dealer_id, plan").eq("id", user.id).maybeSingle();
    // One shared resolver. A buyer resolves to /account, which is also the
    // fallback for a role this page does not expect, so a mis-typed role can
    // never send a shopper into a seller panel. dealer_id/plan are selected
    // because a standalone salesman's home is Lite or Premium, not /salesman.
    window.location.href = `${base}${routeForProfile(profile)}`;
  };

  // Tick the visible lockout down. Same shape as LoginPage's.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const id = setInterval(() => setLockSeconds((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [lockSeconds]);

  const switchMode = (m) => { setMode(m); setError(""); setConfirmSent(false); setShowForgot(false); setShowMagic(false); setMagicSent(false); };

  const sendMagicLink = async () => {
    if (isSignup && !consent) { setError(CONSENT_ERR); return; }
    if (isSignup) markBuyerConsent();
    setMagicLoading(true);
    // AUTH-5: 3 sends per address per 15 min, checked before we send.
    const gate = await emailActionGate(email, EMAIL_ACTIONS.MAGIC);
    if (!gate.allowed) { setError(gate.message); setMagicLoading(false); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${base}/auth/callback` },
    });
    setMagicLoading(false);
    if (error) setError(error.message); else setMagicSent(true);
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
    if (error) setError(error.message);
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

    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      // Only a rejected credential counts against the lock — an unconfirmed
      // email or a 5xx is not a guess, and it must not spend an attempt or get
      // answered with "wrong password".
      const isInvalidCreds =
        error.status === 400 || /invalid|credential/i.test(error.message || "");
      if (!isInvalidCreds) {
        setShowMagic(false);
        setShowForgot(false);
        setError(error.message);
        setLoading(false);
        return;
      }
      const f = await throttleFail(cleanEmail);
      if (f.locked) setLockSeconds(f.secondsLeft);
      // Distinguish "no account" vs "wrong password" and offer the right recovery:
      // a password user gets a reset link; a Google/OTP-only user gets a magic link.
      const { data: rows } = await supabase.rpc("auth_account_status", { p_email: cleanEmail });
      const st = Array.isArray(rows) ? rows[0] : rows;
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
    await ensureBuyerProfile(data.user);
    await redirectByRole(data.user);
  };

  const handleSignUp = async () => {
    if (!email || !password) { setError("Enter your email and a password."); return; }
    if (!pwValid) { setError("Please meet all the password requirements below."); return; }
    if (!consent) { setError(CONSENT_ERR); return; }
    setError(""); setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${base}/auth/callback`, data: { account_type: "buyer" } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    // Empty identities array (no error) = email already registered.
    if (data?.user && (data.user.identities?.length ?? 0) === 0) {
      setError("An account with this email already exists. Please log in instead.");
      setLoading(false);
      return;
    }
    if (data.session) {
      await ensureBuyerProfile(data.user, { consent: true });
      window.location.href = `${base}/account`;
      return;
    }
    // No session means email confirmation is on; the profile is created at
    // /auth/callback instead, so hand the consent over the same way OAuth does.
    markBuyerConsent();
    setLoading(false);
    setConfirmSent(true);
  };

  const handleForgot = async () => {
    if (!email) { setError("Enter your email above first."); return; }
    setResetLoading(true);
    // AUTH-5, own bucket — see LoginPage. Same gate, same numbers.
    const gate = await emailActionGate(email, EMAIL_ACTIONS.RESET);
    if (!gate.allowed) { setError(gate.message); setResetLoading(false); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${base}/reset-password` });
    setResetLoading(false);
    if (error) setError(error.message); else setResetSent(true);
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
        .ba { min-height: 100vh; display: flex; background: #080C14; font-family: system-ui, sans-serif; }

        .ba-left { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 48px 52px; background: #080C14; border-right: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; }
        .ba-left::before { content: ''; position: absolute; top: -120px; left: -120px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%); pointer-events: none; }

        .ba-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; text-decoration: none; }
        .ba-brand-mark { width: 38px; height: 38px; background: #dc2626; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #fff; box-shadow: 0 0 28px rgba(220,38,38,0.45); }
        .ba-brand-img { height: 20px; width: auto; display: block; }

        .ba-hero { position: relative; z-index: 1; }
        .ba-hero-eyebrow { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: rgba(220,38,38,0.85); font-weight: 600; margin-bottom: 18px; }
        .ba-hero-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 4.2vw, 58px); color: #fff; letter-spacing: 2px; line-height: 1.05; margin-bottom: 28px; }
        .ba-hero-title span { color: #dc2626; }

        .ba-benefits { display: flex; flex-direction: column; gap: 18px; }
        .ba-benefit { display: flex; gap: 14px; align-items: flex-start; }
        .ba-benefit-ic { width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2); display: flex; align-items: center; justify-content: center; color: #f87171; }
        .ba-benefit-t { font-size: 14px; font-weight: 600; color: #f0f0f0; }
        .ba-benefit-d { font-size: 12.5px; color: rgba(255,255,255,0.38); line-height: 1.5; margin-top: 2px; }

        .ba-left-footer { font-size: 11px; color: rgba(255,255,255,0.18); position: relative; z-index: 1; }

        .ba-right { width: 480px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center; padding: 48px 52px; background: #060A12; overflow-y: auto; }
        .ba-right { opacity: 0; transform: translateX(12px); transition: opacity .5s ease, transform .5s ease; }
        .ba-right.in { opacity: 1; transform: translateX(0); }

        .ba-back { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.35); text-decoration: none; margin-bottom: 22px; width: max-content; }
        .ba-back:hover { color: rgba(255,255,255,0.6); }

        .ba-toggle { display: flex; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 4px; margin-bottom: 26px; }
        .ba-toggle-btn { flex: 1; padding: 9px 0; border-radius: 9px; border: none; cursor: pointer; font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600; background: transparent; color: rgba(255,255,255,0.45); transition: background .15s, color .15s; }
        .ba-toggle-btn.on { background: #dc2626; color: #fff; }

        .ba-head { margin-bottom: 22px; }
        .ba-head-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: #fff; letter-spacing: 2px; line-height: 1; }
        .ba-head-sub { font-size: 13px; color: rgba(255,255,255,0.32); margin-top: 6px; }

        .ba-google { width: 100%; padding: 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; color: #e2e8f0; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: background .18s, border-color .18s; }
        .ba-google:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }

        .ba-or { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
        .ba-or-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .ba-or-text { font-size: 11px; color: rgba(255,255,255,0.18); letter-spacing: 0.1em; }

        .ba-field { margin-bottom: 14px; }
        .ba-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .ba-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.3); font-weight: 600; }
        .ba-forgot { font-size: 11px; color: rgba(255,255,255,0.25); background: none; border: none; cursor: pointer; padding: 0; font-family: system-ui, sans-serif; }
        .ba-forgot:hover { color: rgba(255,255,255,0.55); }
        .ba-input-wrap { position: relative; }
        .ba-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 14px; color: #fff; font-family: system-ui, sans-serif; font-size: 14px; outline: none; transition: border-color .2s, background .2s; }
        .ba-input::placeholder { color: rgba(255,255,255,0.12); }
        .ba-input:focus { border-color: rgba(220,38,38,0.5); background: rgba(220,38,38,0.03); }
        .ba-input.pr { padding-right: 42px; }
        .ba-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: rgba(255,255,255,0.25); display: flex; }
        .ba-eye:hover { color: rgba(255,255,255,0.5); }

        .ba-error { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.22); border-radius: 8px; padding: 10px 14px; color: #f87171; font-size: 12px; line-height: 1.5; margin-bottom: 14px; }
        .ba-note { background: rgba(251,191,36,0.05); border: 1px solid rgba(251,191,36,0.15); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .ba-note-t { font-size: 12px; color: rgba(251,191,36,0.9); font-weight: 600; margin-bottom: 3px; }
        .ba-note-b { font-size: 11.5px; color: rgba(251,191,36,0.55); line-height: 1.5; }
        .ba-success { color: #4ade80; font-size: 12px; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }

        .ba-pwreq { margin: -4px 0 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; }
        .ba-pwreq-head { font-size: 11px; color: rgba(255,255,255,0.4); margin: 0 0 7px; font-weight: 600; }
        .ba-pwreq-item { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: rgba(255,255,255,0.4); padding: 2px 0; transition: color .15s; }
        .ba-pwreq-item.ok { color: #4ade80; }
        .ba-pwreq-ic { width: 14px; height: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .ba-pwreq-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.25); }

        .ba-reset { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .ba-reset-hint { font-size: 11.5px; color: rgba(255,255,255,0.28); margin-bottom: 10px; line-height: 1.5; }
        .ba-reset-btn { width: 100%; padding: 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.5); font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; }
        .ba-reset-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.75); }

        .ba-submit { width: 100%; padding: 14px; background: #dc2626; border: none; border-radius: 10px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; cursor: pointer; transition: background .2s, box-shadow .2s; margin-top: 4px; }
        .ba-submit:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 8px 28px rgba(220,38,38,0.4); }
        .ba-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .ba-foot { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; font-size: 13px; color: rgba(255,255,255,0.3); }
        .ba-foot-link { color: #f87171; font-weight: 600; background: none; border: none; cursor: pointer; font-family: system-ui, sans-serif; font-size: 13px; }
        .ba-foot-link:hover { color: #fca5a5; }
        .ba-seller { margin-top: 14px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.22); }
        .ba-seller a { color: rgba(255,255,255,0.5); text-decoration: underline; }

        @media (max-width: 860px) {
          .ba { flex-direction: column; }
          .ba-left { display: none; }
          .ba-right { width: 100%; padding: 40px 24px; min-height: 100vh; }
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
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                I confirm I am at least 18 years old and agree to the{" "}
                <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc("terms"); }} style={{ background: "none", border: "none", padding: 0, color: "#f87171", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Terms of Service</button>
                {" "}and{" "}
                <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc("privacy"); }} style={{ background: "none", border: "none", padding: 0, color: "#f87171", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Privacy Policy</button>.
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
                  <p className="ba-success"><Check size={13} /> Reset link sent — check your inbox.</p>
                ) : (
                  <>
                    <p className="ba-reset-hint">We'll send a reset link to the email address you entered above.</p>
                    <button type="button" className="ba-reset-btn" onClick={handleForgot} disabled={resetLoading}>
                      {resetLoading ? "SENDING…" : "SEND RESET LINK"}
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
