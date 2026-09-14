import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { readLogoutNotice, clearLogoutNotice, daysSince } from "../utils/authNotice";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock } from "lucide-react";
import { supabase } from "../supabaseClient";
import { handoffSuffix } from "../lib/authHandoff";
import { markBuyerIntent } from "../lib/buyerAuth";
import { RESET_AFTER_FAILS, throttleCheck, throttleFail, throttleClear, emailActionGate, EMAIL_ACTIONS } from "../utils/authThrottle";
import useAuthCaptcha, { isCaptchaError, captchaErrorMessage } from "../hooks/useAuthCaptcha";
import { checkAccountStatus } from "../utils/authAccountStatus";

const Field = ({ id, label, focused, children }) => (
  <div className={`field ${focused === id ? "is-focused" : ""}`}>
    <label>{label}</label>
    {children}
  </div>
);

const TextInput = ({
  id,
  type = "text",
  placeholder,
  value,
  onChange,
  onFocusChange,
}) => (
  <div className="field-inner">
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => onFocusChange(id)}
      onBlur={() => onFocusChange("")}
      autoComplete="off"
    />
    <div className="field-bar" />
  </div>
);

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        fill="#FFC107"
      />
      <path
        d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.823-3.422-11.387-8.172l-6.516 5.022C9.505 39.556 16.227 44 24 44z"
        fill="#4CAF50"
      />
      <path
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        fill="#1976D2"
      />
    </svg>
  );
}

export default function LoginPage() {
  // AUTH-6: a fresh proof-of-human token per auth call. Inert until
  // VITE_TURNSTILE_SITE_KEY is set and the Supabase captcha toggle is on.
  const { getToken } = useAuthCaptcha();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const isProd = window.location.hostname === "xdrive.my" || window.location.hostname.endsWith(".xdrive.my");
  const base = isProd ? "https://xdrive.my" : window.location.origin;
  const [unconfirmed, setUnconfirmed] = useState(
    searchParams.get("unconfirmed") === "1",
  );
  // Why the person is looking at a login screen they did not ask for. The idle
  // logout parks this instead of redirecting; ?timeout=1 is the old contract,
  // kept so a bookmark or an in-flight tab from before this change still
  // explains itself rather than showing a bare form.
  const [logoutNotice] = useState(() =>
    readLogoutNotice() || (searchParams.get("timeout") === "1" ? { reason: "idle" } : null),
  );
  const idleDays = logoutNotice?.idleSince ? daysSince(logoutNotice.idleSince) : null;
  // Consume it once. The copy captured in state above renders this visit; the
  // stored notice goes, so a second trip to /login is a plain login page.
  useEffect(() => { if (logoutNotice) clearLogoutNotice(); }, [logoutNotice]);
  const [focused, setFocused] = useState("");
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Server-enforced brute-force throttle (login_throttle_* RPCs): 3 failed
  // password attempts in 15 min -> 60s lock, keyed on the email. Enforced in the
  // DB so it survives page reloads, new tabs and incognito — unlike the old
  // local counter, which reset the moment the page reloaded. lockSeconds drives
  // the visible countdown; the DB is the source of truth.
  const [lockSeconds, setLockSeconds] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  // The confirm-your-email screen renders none of the page's shared `error`
  // line, so a refusal from the AUTH-5 gate needs its own slot here or the
  // button would just silently do nothing.
  const [resendError, setResendError] = useState("");
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // 2FA challenge state (SEC-1)
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    document.title = t("login.meta.title", { defaultValue: "ShiftOS · Login" });
  }, [t]);

  // Tick down the lockout countdown.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const id = setInterval(() => setLockSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [lockSeconds]);

  useEffect(() => {
    setMounted(true);
    // Intentionally do NOT auto-redirect an existing session away from /login.
    // Visiting the login page should always let you sign in as a DIFFERENT
    // account — signing in with new credentials replaces the current session
    // (so e.g. a superadmin can switch to a dealer account without first having
    // to sign out). We still surface an outstanding 2FA challenge if the current
    // session is mid-step (aal1 with a verified factor), so that flow isn't lost.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      await checkMfaAndProceed(data.session.user);
    });
  }, []);

  // Returns true if login can proceed; false if a 2FA challenge is now required.
  const checkMfaAndProceed = async (user) => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.totp || []).find((f) => f.status === "verified");
      if (totp) {
        setMfaFactorId(totp.id);
        setPendingUser(user);
        setMfaRequired(true);
        setLoading(false);
        return false;
      }
    }
    return true;
  };

  const handleMfaVerify = async (codeOverride) => {
    const code = (codeOverride ?? mfaCode).trim();
    if (code.length < 6) { setError("Enter the 6-digit code."); return; }
    setError("");
    setMfaLoading(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (chErr) { setError(chErr.message); setMfaLoading(false); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId, challengeId: ch.id, code,
    });
    if (vErr) { setError("Invalid code. Please try again."); setMfaLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    setMfaLoading(false);
    await redirectByRole(pendingUser || session?.user, session);
  };

  const handleMagicLink = async () => {
    if (!magicEmail) return;
    setMagicLoading(true);
    // AUTH-5: cap how many of these we will send to one address (3 / 15 min).
    // Checked BEFORE the send, so a refusal costs nobody an email.
    const gate = await emailActionGate(magicEmail, EMAIL_ACTIONS.MAGIC);
    if (!gate.allowed) { setError(gate.message); setMagicLoading(false); return; }
    const captchaToken = await getToken();
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: {
        captchaToken,
        emailRedirectTo: `${base}/auth/callback`,
        // Never mint a brand-new account from the login page's magic link — that
        // path is for signing INTO an existing account. A typo'd/unknown email
        // otherwise creates a profile-less phantom user. New users go to /onboarding.
        shouldCreateUser: false,
      },
    });
    setMagicLoading(false);
    if (error) setError(error.message);
    else setMagicSent(true);
  };

  // Always-available "email me a sign-in link" entry (not just the passwordless
  // fallback). Prefills from whatever's typed in the email field.
  const openMagicLink = () => {
    setError("");
    setShowForgotPassword(false);
    setMagicSent(false);
    setMagicEmail((prev) => prev || email.trim());
    setShowMagicLink(true);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    setResetLoading(true);
    // AUTH-5. Its own bucket, separate from the magic link: filling one must
    // not block the other, since either might be this person's only way in.
    const gate = await emailActionGate(email, EMAIL_ACTIONS.RESET);
    if (!gate.allowed) { setError(gate.message); setResetLoading(false); return; }
    const captchaToken = await getToken();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      captchaToken,
      redirectTo: `${base}/reset-password`,
    });
    setResetLoading(false);
    if (error) setError(error.message);
    else setResetSent(true);
  };

  const handleGoogleSignIn = async () => {
    // Marketplace buyer links carry ?as=buyer so the OAuth callback materialises a
    // buyer profile -> /account. No visible buyer/seller choice on the page itself.
    if (searchParams.get("as") === "buyer") markBuyerIntent();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${base}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  const redirectByRole = async (user, session = null) => {
    if (!user?.id) return;
    // Use replace() for every post-auth redirect so /login does NOT stay in the
    // browser history. Without this, pressing Back from the app's first screen
    // (e.g. the Salesman Lite dashboard) re-shows the sign-in page.
    const go = (url) => window.location.replace(url);
    const { data: profile } = await supabase
      .from("profiles")
      .select("subdomain, role, dealer_id, onboarding_complete, plan")
      .eq("id", user.id)
      .maybeSingle();

    // No profiles row — auth account exists but sign-up was never completed.
    // Send them back to onboarding instead of falling through to the salesman
    // default below, which would loop them between /login and /salesman forever.
    if (!profile) {
      const savedPlan = sessionStorage.getItem('ob_plan_slug');
      if (savedPlan === 'lite' || savedPlan === 'premium') {
        go(`${base}/salesman-onboarding/${savedPlan}`);
      } else if (savedPlan === 'starter' || savedPlan === 'growth' || savedPlan === 'pro') {
        go(`${base}/dealer-onboarding/${savedPlan}`);
      } else {
        go(`${base}/onboarding`);
      }
      return;
    }

    const subdomain = profile?.subdomain;
    const role = profile?.role;

    // Buyers live on /account, never a seller dashboard.
    if (role === "buyer") {
      go(`${base}/account`);
      return;
    }

    const getActiveSession = async () => {
      if (session) return session;
      const { data: { session: s } } = await supabase.auth.getSession();
      return s;
    };

    // Platform superadmin has its own console (/platform) — never a dealer
    // dashboard. Keeping it separate stops the admin account from landing on an
    // empty, onboarding-less dealer dashboard.
    if (role === "superadmin") {
      go(`${base}/platform`);
      return;
    }

    if (role === "dealer" || role === "owner") {
      if (profile?.onboarding_complete === false && !subdomain) {
        go(`${base}/onboarding`);
        return;
      }
      if (subdomain && isProd) {
        const activeSession = await getActiveSession();
        go(`https://${subdomain}.xdrive.my/dashboard${handoffSuffix(activeSession)}`);
      } else {
        go(`${base}/dashboard`);
      }
    } else if (role === "salesman") {
      // A salesman who hasn't finished onboarding (no name/IC/phone/profile yet)
      // must go back to the wizard, never straight to the dashboard. Without this
      // an authenticated-but-half-signed-up salesman who lands on /login for any
      // reason (auth-callback fallback race, bookmark, back button, session
      // restore) drops into an empty dashboard. Mirror the dealer branch above.
      if (profile?.onboarding_complete === false) {
        const tier = profile?.plan === "salesman_full" ? "premium" : "lite";
        go(`${base}/salesman-onboarding/${tier}`);
        return;
      }
      const activeSession = await getActiveSession();
      const target = profile?.dealer_id
        ? "salesman"
        : profile?.plan === "salesman_full"
        ? "salesman-premium"
        : "salesman-lite";
      const suffix = isProd ? handoffSuffix(activeSession) : "";
      go(`${base}/${target}${suffix}`);
    } else {
      const activeSession = await getActiveSession();
      const suffix = isProd ? handoffSuffix(activeSession) : "";
      go(`${base}/salesman${suffix}`);
    }
  };

  const handleLogin = async () => {
    if (lockSeconds > 0) {
      setError(`Too many attempts. Try again in ${lockSeconds}s.`);
      return;
    }
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    // Ask the server if this email is currently locked out before we even try —
    // a reload can't shake off an active lock. Whatever recovery link is
    // already on screen stays there: a lock is the moment someone most needs it.
    const gate = await throttleCheck(cleanEmail);
    if (!gate.allowed) {
      setLockSeconds(gate.secondsLeft);
      setError(`Too many attempts. Try again in ${gate.secondsLeft}s.`);
      setLoading(false);
      return;
    }

    const captchaToken = await getToken();
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email: cleanEmail, password, options: { captchaToken } },
    );
    if (signInError) {
      // Check this FIRST. A captcha rejection also comes back as a 400, so the
      // isInvalidCreds test below would read it as a wrong password: it would
      // burn one of the three attempts and tell someone their correct password
      // is wrong. Nothing about their credentials failed here.
      if (isCaptchaError(signInError)) {
        setError(captchaErrorMessage());
        setLoading(false);
        return;
      }
      const isInvalidCreds =
        signInError.message.toLowerCase().includes("invalid") ||
        signInError.message.toLowerCase().includes("credentials") ||
        signInError.status === 400;

      // Record the failed attempt server-side; the DB locks after the 3rd and
      // hands back the running count, which is what gates the reset link below.
      let lockedNow = false;
      let lockSecs = 60;
      let fails = 0;
      if (isInvalidCreds) {
        const f = await throttleFail(cleanEmail);
        fails = f.attempts;
        if (f.locked) { lockedNow = true; lockSecs = f.secondsLeft; setLockSeconds(lockSecs); }
      }

      if (isInvalidCreds) {
        // Resolve account existence via api/auth-account-status.js, which fronts
        // a SECURITY DEFINER RPC — the old direct profiles query ran as anon and
        // was RLS-blocked, so it returned null for real accounts and falsely
        // showed "No account found" on a wrong password. The RPC itself is no
        // longer anon-callable (SEC-B5 — it's an enumeration oracle), so this
        // goes through the Turnstile-gated route instead of supabase.rpc().
        const statusToken = await getToken();
        const st = await checkAccountStatus(cleanEmail, statusToken);
        if (st?.account_exists && !st?.has_password) {
          // Account exists but has no password — Google/OTP user → magic link.
          // Offered on the FIRST failure and never withheld by the lock: this
          // person has no password to get right, so the link is not a fallback,
          // it is their only door in. Hiding it behind three failures (or behind
          // a 60s lock they will hit every time) would be a dead end.
          setError(lockedNow
            ? `Too many attempts. Try again in ${lockSecs}s, or use the sign-in link below.`
            : "");
          setShowForgotPassword(false);
          setShowMagicLink(true);
          setMagicEmail(cleanEmail);
        } else if (st?.account_exists) {
          // Account + password exist → it's the wrong password. The reset link
          // only appears from the RESET_AFTER_FAILS'th failure. One mistyped
          // password is a typo, not a forgotten password, and answering a typo
          // with "reset your password" pushes people into an email round-trip
          // they did not need. Three is also exactly where login_throttle_fail
          // locks the account, so the lock and the way out arrive together.
          const offerReset = fails >= RESET_AFTER_FAILS;
          setShowMagicLink(false);
          setShowForgotPassword(offerReset);
          setError(
            lockedNow
              ? `Wrong password ${fails} times. Try again in ${lockSecs}s, or reset your password below.`
              : offerReset
              ? "Wrong password. Try again, or reset it below."
              : "Wrong password. Please try again.",
          );
        } else {
          // No account found at all
          setError(
            "No account found with that email. Check for typos or create a free account.",
          );
          setShowMagicLink(false);
          setShowForgotPassword(false);
        }
      } else {
        // Other errors (e.g. email not confirmed) — just show the message.
        // A lock still takes priority: it is the reason the next try will fail.
        setError(lockedNow ? `Too many attempts. Try again in ${lockSecs}s.` : signInError.message);
        setShowMagicLink(false);
        setShowForgotPassword(false);
      }
      setLoading(false);
      return;
    }
    // Successful password — reset the throttle counter for this email.
    throttleClear(cleanEmail);
    try {
      const proceed = await checkMfaAndProceed(data.user);
      if (proceed) await redirectByRole(data.user, data.session);
      else return; // 2FA challenge UI now shown
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (mfaRequired) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "24px 16px", background: "#0a0a0c", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff" }}>
          <span style={{ width: 30, height: 30, background: "#dc2626", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>S</span>
          <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" style={{ height: 21, width: "auto", display: "block" }} />
        </div>
        <div style={{ width: "min(420px, 100%)", background: "#111114", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "40px 36px", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
          <div style={{ width: 56, height: 56, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.6">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#fff", letterSpacing: 2, marginBottom: 12 }}>TWO-FACTOR AUTH</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
            Enter the 6-digit code from your authenticator app.
          </p>
          <input
            type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
            value={mfaCode} onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setMfaCode(digits);
              if (digits.length === 6) handleMfaVerify(digits);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleMfaVerify(); }}
            placeholder="000000"
            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px", color: "#fff", fontSize: 24, letterSpacing: "0.4em", textAlign: "center", outline: "none", marginBottom: 16, fontFamily: "system-ui, sans-serif" }}
          />
          {error && <p style={{ fontSize: 12, color: "#f87171", marginBottom: 14 }}>⚠ {error}</p>}
          <button
            onClick={handleMfaVerify} disabled={mfaLoading || mfaCode.length < 6}
            style={{ width: "100%", padding: "13px", background: "#dc2626", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, cursor: "pointer", opacity: (mfaLoading || mfaCode.length < 6) ? 0.5 : 1, marginBottom: 14 }}>
            {mfaLoading ? "VERIFYING…" : "VERIFY"}
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); setMfaRequired(false); setMfaCode(""); setError(""); setPendingUser(null); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer" }}>
            Cancel and sign out
          </button>
        </div>
      </div>
    );
  }

  if (unconfirmed) {
    const unconfirmedEmail = searchParams.get("email") || "";
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "24px 16px",
          background: "#0a0a0c",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#fff",
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              background: "#dc2626",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18,
              letterSpacing: 1,
            }}
          >
            S
          </span>
          <span
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: 3,
              fontSize: 28,
            }}
          >
            ShiftOS
          </span>
        </div>
        <div
          style={{
            width: "min(420px, 100%)",
            background: "#111114",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "48px 40px",
            textAlign: "center",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: "rgba(251,191,36,0.1)",
              border: "1px solid rgba(251,191,36,0.25)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
            >
              <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28,
              color: "#fff",
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            CONFIRM YOUR EMAIL
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            Your account isn't confirmed yet. Check your inbox for the
            confirmation link before signing in.
          </p>
          {resendSent && (
            <p style={{ fontSize: 12, color: "#4ade80", marginBottom: 16 }}>
              Confirmation email resent!
            </p>
          )}
          {resendError && (
            <p style={{ fontSize: 12, color: "#f87171", marginBottom: 16 }}>{resendError}</p>
          )}
          {unconfirmedEmail && (
            <button
              onClick={async () => {
                setResendLoading(true);
                setResendSent(false);
                setResendError("");
                // AUTH-5, third bucket. This button is the easiest of the three
                // to lean on: it needs no password and no account lookup.
                const gate = await emailActionGate(unconfirmedEmail, EMAIL_ACTIONS.RESEND);
                if (!gate.allowed) {
                  setResendError(gate.message);
                  setResendLoading(false);
                  return;
                }
                const captchaToken = await getToken();
                await supabase.auth.resend({
                  type: "signup",
                  email: unconfirmedEmail,
                  options: { captchaToken },
                });
                setResendLoading(false);
                setResendSent(true);
              }}
              disabled={resendLoading}
              style={{
                width: "100%",
                padding: "13px",
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.3)",
                borderRadius: 8,
                color: "#f87171",
                fontSize: 13,
                fontWeight: 600,
                cursor: resendLoading ? "not-allowed" : "pointer",
                marginBottom: 16,
              }}
            >
              {resendLoading ? "Sending..." : "Resend confirmation email"}
            </button>
          )}
          <button
            onClick={() => setUnconfirmed(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
<>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* Layout */
        .lr { min-height: 100vh; display: flex; background: #080C14; font-family: system-ui, sans-serif; }

        /* Left panel — branding */
        .lr-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 52px;
          background: #080C14;
          border-right: 1px solid rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }
        .lr-left::before {
          content: '';
          position: absolute;
          top: -120px; left: -120px;
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .lr-left::after {
          content: '';
          position: absolute;
          bottom: -80px; right: -80px;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        /* Right panel — form */
        .lr-right {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 52px;
          background: #060A12;
          overflow-y: auto;
        }

        /* Brand */
        .lr-brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .lr-brand-mark {
          width: 36px; height: 36px;
          background: #dc2626;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #fff;
          box-shadow: 0 0 28px rgba(220,38,38,0.45);
        }
        .lr-brand-img { height: 21px; width: auto; display: block; }

        /* Left hero copy */
        .lr-hero { position: relative; z-index: 1; }
        .lr-hero-eyebrow {
          font-size: 10px; letter-spacing: 4px; text-transform: uppercase;
          color: rgba(220,38,38,0.8); font-weight: 600; margin-bottom: 20px;
          display: flex; align-items: center; gap: 10px;
        }
        .lr-hero-eyebrow::before {
          content: ''; display: inline-block; width: 24px; height: 1px; background: #dc2626;
        }
        .lr-hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(44px, 4.5vw, 64px);
          color: #fff; letter-spacing: 2px; line-height: 1.05;
          margin-bottom: 20px;
        }
        .lr-hero-title span { color: #dc2626; }
        .lr-hero-sub {
          font-size: 14px; color: rgba(255,255,255,0.38); line-height: 1.65;
          max-width: 380px;
        }

        /* Stats row */
        .lr-stats { display: flex; gap: 40px; position: relative; z-index: 1; }
        .lr-stat-num {
          font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #fff;
          letter-spacing: 1px; line-height: 1;
        }
        .lr-stat-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-top: 4px; }

        /* Left footer */
        .lr-left-footer { font-size: 11px; color: rgba(255,255,255,0.15); position: relative; z-index: 1; }

        .lr-back { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.35); text-decoration: none; margin-bottom: 22px; width: max-content; }
        .lr-back:hover { color: rgba(255,255,255,0.6); }

        /* Form area */
        .lr-form-head { margin-bottom: 32px; }
        .lr-form-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: rgba(220,38,38,0.8); font-weight: 600; margin-bottom: 8px; }
        .lr-form-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: #fff; letter-spacing: 2px; line-height: 1; }
        .lr-form-sub { font-size: 13px; color: rgba(255,255,255,0.3); margin-top: 6px; }

        .lr-google { width: 100%; padding: 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; color: #e2e8f0; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: background .18s, border-color .18s; }
        .lr-google:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }

        .lr-or { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
        .lr-or-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .lr-or-text { font-size: 11px; color: rgba(255,255,255,0.18); letter-spacing: 0.1em; }

        .lr-field { margin-bottom: 16px; }
        .lr-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .lr-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.3); font-weight: 600; }
        .lr-forgot { font-size: 11px; color: rgba(255,255,255,0.25); background: none; border: none; cursor: pointer; padding: 0; transition: color .15s; font-family: system-ui, sans-serif; }
        .lr-forgot:hover { color: rgba(255,255,255,0.55); }
        .lr-forgot.active { color: #dc2626; }

        .lr-input-wrap { position: relative; }
        .lr-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 14px; color: #fff; font-family: system-ui, sans-serif; font-size: 14px; outline: none; transition: border-color .2s, background .2s; appearance: none; }
        .lr-input::placeholder { color: rgba(255,255,255,0.1); }
        .lr-input:focus { border-color: rgba(220,38,38,0.5); background: rgba(220,38,38,0.03); }
        .lr-input.pr { padding-right: 42px; }
        .lr-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: rgba(255,255,255,0.2); display: flex; transition: color .2s; }
        .lr-eye:hover { color: rgba(255,255,255,0.5); }

        .lr-error { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.22); border-radius: 8px; padding: 10px 14px; color: #f87171; font-size: 12px; line-height: 1.5; margin-bottom: 14px; }
        /* Not an error — the account is fine, we closed the session on purpose.
           Neutral/informational, so it does not read as a failed login. */
        .lr-notice { display: flex; gap: 9px; align-items: flex-start; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; padding: 11px 14px; color: rgba(255,255,255,0.62); font-size: 12px; line-height: 1.55; margin-bottom: 20px; }

        .lr-magic { background: rgba(251,191,36,0.05); border: 1px solid rgba(251,191,36,0.15); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
        .lr-magic-title { font-size: 12px; color: rgba(251,191,36,0.9); font-weight: 600; margin-bottom: 4px; }
        .lr-magic-body { font-size: 11.5px; color: rgba(251,191,36,0.55); line-height: 1.55; margin-bottom: 10px; }
        .lr-magic-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 9px 12px; color: #fff; font-family: system-ui, sans-serif; font-size: 13px; outline: none; margin-bottom: 8px; }
        .lr-magic-btn { width: 100%; padding: 10px; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.22); border-radius: 6px; color: #fbbf24; font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; transition: background .15s; }
        .lr-magic-btn:hover:not(:disabled) { background: rgba(251,191,36,0.18); }
        .lr-magic-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .lr-reset-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .lr-reset-hint { font-size: 11.5px; color: rgba(255,255,255,0.28); margin-bottom: 10px; line-height: 1.5; }
        .lr-reset-btn { width: 100%; padding: 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.5); font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; transition: border-color .15s, color .15s; }
        .lr-reset-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.75); }
        .lr-reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .lr-submit { width: 100%; padding: 14px; background: #dc2626; border: none; border-radius: 10px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; transition: background .2s, box-shadow .2s; margin-top: 4px; }
        .lr-submit:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 8px 28px rgba(220,38,38,0.4); }
        .lr-submit:active:not(:disabled) { transform: scale(.99); }
        .lr-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .lr-shimmer { position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent); animation: shimmer 2.4s infinite; }
        @keyframes shimmer { from{left:-60%} to{left:130%} }

        .lr-dots span { animation: blink 1.4s infinite both; font-size: 22px; }
        .lr-dots span:nth-child(2) { animation-delay:.2s; }
        .lr-dots span:nth-child(3) { animation-delay:.4s; }
        @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }

        .lr-success { color: #4ade80; font-size: 12px; display: flex; align-items: center; gap: 6px; }

        .lr-create-row { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
        .lr-create-text { font-size: 12px; color: rgba(255,255,255,0.25); }
        .lr-create-link { font-size: 12px; color: #f87171; font-weight: 600; text-decoration: none; transition: color .15s; }
        .lr-create-link:hover { color: #fca5a5; }

        /* Fade-in */
        .lr-right { opacity: 0; transform: translateX(12px); transition: opacity .5s ease, transform .5s ease; }
        .lr-right.in { opacity: 1; transform: translateX(0); }
        .lr-left-content { opacity: 0; transform: translateX(-10px); transition: opacity .6s ease .1s, transform .6s ease .1s; }
        .lr-left-content.in { opacity: 1; transform: translateX(0); }

        /* Mobile: single column */
        @media(max-width: 860px) {
          .lr { flex-direction: column; }
          .lr-left { display: none; }
          .lr-right { width: 100%; padding: 40px 24px; min-height: 100vh; }
        }
      `}</style>

      <div className="lr">
        {/* Left — brand panel */}
        <div className="lr-left">
          <div className={`lr-left-content${mounted ? ' in' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div className="lr-brand">
              <div className="lr-brand-mark">S</div>
              <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" className="lr-brand-img" />
            </div>

            {/* This is now the ONE sign-in door for buyers and sellers alike, so
                the panel can no longer be a dealer sales pitch — a shopper who
                reads "Dealer Management Platform" above a login box concludes
                they are on the wrong page and leaves. It says what the single
                account actually is instead. */}
            <div className="lr-hero">
              <p className="lr-hero-eyebrow">One XDrive account</p>
              <h1 className="lr-hero-title">
                Buy a car.<br />
                Sell cars.<br />
                <span>Same sign in.</span>
              </h1>
              <p className="lr-hero-sub">
                Your saved cars, alerts and enquiries — or your full dealership pipeline, financing and team. Sign in once and we take you to the right place.
              </p>
            </div>

            <div>
              {/* Was "6 Role Dashboards / 15+ Panel Banks / RM1k Starting per
                  month" — all seller figures, and the RM1k was stale besides
                  (dealer plans start at RM299). A buyer reading a monthly price
                  over a sign-in box reasonably assumes they are about to be
                  charged for browsing. */}
              <div className="lr-stats">
                <div>
                  <div className="lr-stat-num">Free</div>
                  <div className="lr-stat-label">For car buyers</div>
                </div>
                <div>
                  <div className="lr-stat-num">Free</div>
                  <div className="lr-stat-label">Salesman Lite</div>
                </div>
                <div>
                  <div className="lr-stat-num">RM299</div>
                  <div className="lr-stat-label">Dealer plans from</div>
                </div>
              </div>
              <div className="lr-left-footer" style={{ marginTop: 32 }}>
                &copy; {new Date().getFullYear()} ShiftOS &nbsp;&middot;&nbsp;
                <a href="/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy</a>
              </div>
            </div>
          </div>
        </div>

        {/* Right — form panel */}
        <div className={`lr-right${mounted ? ' in' : ''}`}>
          <Link to="/" className="lr-back"><ArrowLeft size={14} /> Back to marketplace</Link>

          <div className="lr-form-head">
            <p className="lr-form-eyebrow">Welcome Back</p>
            <h2 className="lr-form-title">SIGN IN</h2>
            <p className="lr-form-sub">Sign in to your account</p>
          </div>

          {logoutNotice?.reason === "idle" && (
            <div className="lr-notice">
              <Clock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {idleDays
                  ? `You hadn't used ShiftOS for ${idleDays} day${idleDays === 1 ? "" : "s"}, so we signed you out to keep your account safe.`
                  : "You'd been away a while, so we signed you out to keep your account safe."}
                {" "}Sign in to pick up where you left off.
              </span>
            </div>
          )}

          {/* Google — first, most prominent */}
          <button
            type="button"
            className="lr-google"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* OR divider */}
          <div className="lr-or">
            <div className="lr-or-line" />
            <span className="lr-or-text">OR</span>
            <div className="lr-or-line" />
          </div>

          {/* Email */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div className="lr-field">
              <div className="lr-label-row">
                <label className="lr-label">Email Address</label>
              </div>
              <div className="lr-input-wrap">
                <input
                  className="lr-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password — "Forgot password?" inline on label row */}
            <div className="lr-field">
              <div className="lr-label-row">
                <label className="lr-label">Password</label>
                <button
                  type="button"
                  className={`lr-forgot${showForgotPassword ? " active" : ""}`}
                  onClick={() => setShowForgotPassword((p) => !p)}
                >
                  {showForgotPassword ? "← back" : "Forgot password?"}
                </button>
              </div>
              <div className="lr-input-wrap">
                <input
                  className="lr-input pr"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lr-eye"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password panel — inline, right below password */}
            {showForgotPassword && (
              <div className="lr-reset-panel">
                {resetSent ? (
                  <>
                    <p className="lr-success">
                      ✓ Code sent — check your inbox.
                    </p>
                    {/* The email carries a CODE, not a link, so the person needs
                        somewhere to type it. Leaving them on "check your inbox"
                        with no next step is the whole reason this flow changed. */}
                    <button
                      type="button"
                      className="lr-reset-btn"
                      onClick={() =>
                        navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)
                      }
                    >
                      ENTER THE CODE
                    </button>
                  </>
                ) : (
                  <>
                    <p className="lr-reset-hint">
                      We'll email a 6-digit code to the address above. It lasts an
                      hour and works on any device.
                    </p>
                    <button
                      type="button"
                      className="lr-reset-btn"
                      onClick={handlePasswordReset}
                      disabled={resetLoading}
                    >
                      {resetLoading ? "SENDING…" : "SEND RESET CODE"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Error */}
            {error && <div className="lr-error">⚠ {error}</div>}

            {/* Magic link panel — shown when Google/OTP user tries password */}
            {showMagicLink && (
              <div className="lr-magic">
                <p className="lr-magic-title">
                  Sign in with a magic link
                </p>
                <p className="lr-magic-body">
                  We'll email a one-tap sign-in link to the address below — no
                  password needed.
                </p>
                <input
                  className="lr-magic-input"
                  type="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                />
                {magicSent ? (
                  <p className="lr-success">
                    ✓ Magic link sent — check your inbox.
                  </p>
                ) : (
                  <button
                    type="button"
                    className="lr-magic-btn"
                    onClick={handleMagicLink}
                    disabled={magicLoading}
                  >
                    {magicLoading ? "SENDING…" : "SEND MAGIC LINK"}
                  </button>
                )}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="lr-submit" disabled={loading || lockSeconds > 0}>
              <div className="lr-shimmer" />
              {loading ? (
                <span className="lr-dots">
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                </span>
              ) : lockSeconds > 0 ? (
                `TRY AGAIN IN ${lockSeconds}s`
              ) : (
                "SIGN IN"
              )}
            </button>

            {!showMagicLink && (
              <button
                type="button"
                className="lr-forgot"
                onClick={openMagicLink}
                style={{ display: "block", margin: "14px auto 0", fontSize: 12 }}
              >
                Email me a one-time sign-in link instead
              </button>
            )}
          </form>

          {/* The buyer/seller question belongs HERE and only here. Signing in
              never needs it — the account's role already knows the answer — but
              signing UP is a real product choice, so this is the one place it is
              worth asking. It used to be a single "Create for free" pointing at
              /onboarding, which App.jsx redirects straight to
              /salesman-onboarding/lite: someone who only wanted to save a few
              cars was put into the salesman signup wizard. */}
          <div className="lr-create-row" style={{ flexWrap: 'wrap', rowGap: 6 }}>
            <span className="lr-create-text">New here?</span>
            <a href="/buyer-login" className="lr-create-link">Sign up to buy →</a>
            <span className="lr-create-text" aria-hidden>·</span>
            <a href="/plans" className="lr-create-link">Sign up to sell →</a>
          </div>
        </div>
      </div>
    </>
  );
}
