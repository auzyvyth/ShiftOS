import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { handoffSuffix } from "../lib/authHandoff";
import { markBuyerIntent } from "../lib/buyerAuth";

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const isProd = window.location.hostname === "xdrive.my" || window.location.hostname.endsWith(".xdrive.my");
  const base = isProd ? "https://xdrive.my" : window.location.origin;
  const [unconfirmed, setUnconfirmed] = useState(
    searchParams.get("unconfirmed") === "1",
  );
  const [focused, setFocused] = useState("");
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Client-side brute-force throttle: lock the button for 60s after 5 failed
  // password attempts (Supabase also rate-limits server-side; this is UX).
  const [attempts, setAttempts] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
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
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const proceed = await checkMfaAndProceed(data.session.user);
      if (proceed) redirectByRole(data.session.user, data.session);
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
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: { emailRedirectTo: `${base}/auth/callback` },
    });
    setMagicLoading(false);
    if (error) setError(error.message);
    else setMagicSent(true);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
        window.location.href = `${base}/salesman-onboarding/${savedPlan}`;
      } else if (savedPlan === 'starter' || savedPlan === 'growth' || savedPlan === 'pro') {
        window.location.href = `${base}/dealer-onboarding/${savedPlan}`;
      } else {
        window.location.href = `${base}/onboarding`;
      }
      return;
    }

    const subdomain = profile?.subdomain;
    const role = profile?.role;

    // Buyers live on /account, never a seller dashboard.
    if (role === "buyer") {
      window.location.href = `${base}/account`;
      return;
    }

    const getActiveSession = async () => {
      if (session) return session;
      const { data: { session: s } } = await supabase.auth.getSession();
      return s;
    };

    if (role === "superadmin" || role === "dealer" || role === "owner") {
      if (profile?.onboarding_complete === false && !subdomain) {
        window.location.href = `${base}/onboarding`;
        return;
      }
      if (subdomain && isProd) {
        const activeSession = await getActiveSession();
        window.location.href = `https://${subdomain}.xdrive.my/dashboard${handoffSuffix(activeSession)}`;
      } else {
        window.location.href = `${base}/dashboard`;
      }
    } else if (role === "salesman") {
      // A salesman who hasn't finished onboarding (no name/IC/phone/profile yet)
      // must go back to the wizard, never straight to the dashboard. Without this
      // an authenticated-but-half-signed-up salesman who lands on /login for any
      // reason (auth-callback fallback race, bookmark, back button, session
      // restore) drops into an empty dashboard. Mirror the dealer branch above.
      if (profile?.onboarding_complete === false) {
        const tier = profile?.plan === "salesman_full" ? "premium" : "lite";
        window.location.href = `${base}/salesman-onboarding/${tier}`;
        return;
      }
      const activeSession = await getActiveSession();
      const target = profile?.dealer_id
        ? "salesman"
        : profile?.plan === "salesman_full"
        ? "salesman-premium"
        : "salesman-lite";
      const suffix = isProd ? handoffSuffix(activeSession) : "";
      window.location.href = `${base}/${target}${suffix}`;
    } else {
      const activeSession = await getActiveSession();
      const suffix = isProd ? handoffSuffix(activeSession) : "";
      window.location.href = `${base}/salesman${suffix}`;
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
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email: cleanEmail, password },
    );
    if (signInError) {
      const isInvalidCreds =
        signInError.message.toLowerCase().includes("invalid") ||
        signInError.message.toLowerCase().includes("credentials") ||
        signInError.status === 400;

      // Count failed attempts; lock the button for 60s after 5.
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= 5) { setLockSeconds(60); setAttempts(0); }

      if (isInvalidCreds) {
        // Resolve account existence via a SECURITY DEFINER RPC — the old direct
        // profiles query ran as anon and was RLS-blocked, so it returned null for
        // real accounts and falsely showed "No account found" on a wrong password.
        const { data: statusRows } = await supabase.rpc("auth_account_status", { p_email: cleanEmail });
        const st = Array.isArray(statusRows) ? statusRows[0] : statusRows;
        if (st?.account_exists && !st?.has_password) {
          // Account exists but has no password — Google/OTP user → magic link
          setError("");
          setShowForgotPassword(false);
          setShowMagicLink(true);
          setMagicEmail(cleanEmail);
        } else if (st?.account_exists) {
          // Account + password exist → it's the wrong password
          setError("Wrong password. Try again or reset it below.");
          setShowMagicLink(false);
          setShowForgotPassword(true);
        } else {
          // No account found at all
          setError(
            "No account found with that email. Check for typos or create a free account.",
          );
          setShowMagicLink(false);
          setShowForgotPassword(false);
        }
      } else {
        // Other errors (e.g. email not confirmed) — just show the message
        setError(signInError.message);
        setShowMagicLink(false);
        setShowForgotPassword(false);
      }
      setLoading(false);
      return;
    }
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
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 3, fontSize: 28 }}>ShiftOS</span>
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
          {unconfirmedEmail && (
            <button
              onClick={async () => {
                setResendLoading(true);
                setResendSent(false);
                await supabase.auth.resend({
                  type: "signup",
                  email: unconfirmedEmail,
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
        .lr-brand-name { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 5px; color: #fff; line-height: 1; }

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
              <span className="lr-brand-name">SHIFTOS</span>
            </div>

            <div className="lr-hero">
              <p className="lr-hero-eyebrow">Dealer Management Platform</p>
              <h1 className="lr-hero-title">
                The OS for<br />
                Malaysian<br />
                <span>Car Dealers</span>
              </h1>
              <p className="lr-hero-sub">
                Pipeline, HP financing, F&I, team management and revenue analytics — built for how Malaysian used car dealerships actually operate.
              </p>
            </div>

            <div>
              <div className="lr-stats">
                <div>
                  <div className="lr-stat-num">6</div>
                  <div className="lr-stat-label">Role Dashboards</div>
                </div>
                <div>
                  <div className="lr-stat-num">15+</div>
                  <div className="lr-stat-label">Panel Banks</div>
                </div>
                <div>
                  <div className="lr-stat-num">RM1k</div>
                  <div className="lr-stat-label">Starting / mo</div>
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
          <div className="lr-form-head">
            <p className="lr-form-eyebrow">Welcome Back</p>
            <h2 className="lr-form-title">SIGN IN</h2>
            <p className="lr-form-sub">Sign in to your account</p>
          </div>

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
                  <p className="lr-success">
                    ✓ Reset link sent — check your inbox.
                  </p>
                ) : (
                  <>
                    <p className="lr-reset-hint">
                      We'll send a reset link to the email address you entered
                      above.
                    </p>
                    <button
                      type="button"
                      className="lr-reset-btn"
                      onClick={handlePasswordReset}
                      disabled={resetLoading}
                    >
                      {resetLoading ? "SENDING…" : "SEND RESET LINK"}
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
                  Looks like you use Google or a magic link
                </p>
                <p className="lr-magic-body">
                  No password on file. We'll email you a one-tap sign-in link
                  instead.
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
          </form>

          <div className="lr-create-row">
            <span className="lr-create-text">Don't have an account?</span>
            <a href="/onboarding" className="lr-create-link">Create for free →</a>
          </div>
        </div>
      </div>
    </>
  );
}
