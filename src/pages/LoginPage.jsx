import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";

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

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [unconfirmed, setUnconfirmed] = useState(
    searchParams.get("unconfirmed") === "1",
  );
  const [focused, setFocused] = useState("");
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    document.title = t("login.meta.title", { defaultValue: "ShiftOS · Login" });
  }, [t]);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectByRole(data.session.user);
    });
  }, []);

  const handleMagicLink = async () => {
    if (!magicEmail) return;
    setMagicLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: { emailRedirectTo: "https://xdrive.my/auth/callback" },
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
      redirectTo: "https://xdrive.my/reset-password",
    });
    setResetLoading(false);
    if (error) setError(error.message);
    else setResetSent(true);
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://xdrive.my/auth/callback",
      },
    });
    if (error) setError(error.message);
  };

  const redirectByRole = async (user) => {
    if (!user?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("subdomain, role, dealer_id, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    const subdomain = profile?.subdomain;
    const role = profile?.role;

    if (role === "superadmin" || role === "dealer") {
      if (profile?.onboarding_complete === false) {
        window.location.href = "https://xdrive.my/onboarding";
        return;
      }
      if (subdomain) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session.access_token;
        const refreshToken = session.refresh_token;
        window.location.href = `https://${subdomain}.xdrive.my/dashboard?_at=${accessToken}&_rt=${refreshToken}`;
      } else {
        window.location.href = "https://xdrive.my/dashboard";
      }
    } else if (role === "salesman") {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const at = sess?.access_token;
      const rt = sess?.refresh_token;
      const target = profile?.dealer_id ? "salesman" : "salesman-lite";
      const suffix = at && rt ? `?_at=${at}&_rt=${rt}` : "";
      window.location.href = `https://xdrive.my/${target}${suffix}`;
    } else {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const at = sess?.access_token;
      const rt = sess?.refresh_token;
      const suffix = at && rt ? `?_at=${at}&_rt=${rt}` : "";
      window.location.href = `https://xdrive.my/salesman${suffix}`;
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    );
    if (signInError) {
      const isInvalidCreds =
        signInError.message.toLowerCase().includes("invalid") ||
        signInError.message.toLowerCase().includes("credentials") ||
        signInError.status === 400;

      if (isInvalidCreds) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.trim())
          .maybeSingle();
        if (existingProfile) {
          // Account exists but no password — Google/OTP user
          setError("");
          setShowForgotPassword(false);
          setShowMagicLink(true);
          setMagicEmail(email.trim());
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
    await redirectByRole(data.user);
    setLoading(false);
  };

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
          fontFamily: "'DM Sans', sans-serif",
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

  const GoogleIcon = () => (
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lr { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 32px 16px; background: #080C14; font-family: 'DM Sans', sans-serif; overflow-y: auto; }

        .lr-brand { display: flex; align-items: center; gap: 10px; }
        .lr-brand-dot { width: 32px; height: 32px; background: #dc2626; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: #fff; box-shadow: 0 0 20px rgba(220,38,38,0.35); }
        .lr-brand-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 4px; color: #fff; line-height: 1; }

        .lr-card { width: min(420px, 100%); background: #0f1420; border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 36px 32px 32px; box-shadow: 0 32px 80px rgba(0,0,0,0.5); opacity: 0; transform: translateY(14px); transition: opacity .5s ease, transform .5s ease; }
        .lr-card.in { opacity: 1; transform: translateY(0); }

        .lr-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #dc2626; font-weight: 500; margin-bottom: 6px; }
        .lr-heading { font-family: 'Bebas Neue', sans-serif; font-size: 38px; color: #fff; letter-spacing: 2px; line-height: 1; margin-bottom: 28px; }

        .lr-google { width: 100%; padding: 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e2e8f0; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: background .18s, border-color .18s; }
        .lr-google:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); }

        .lr-or { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
        .lr-or-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .lr-or-text { font-size: 11px; color: rgba(255,255,255,0.2); letter-spacing: 0.1em; }

        .lr-field { margin-bottom: 16px; }
        .lr-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .lr-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.35); font-weight: 500; }
        .lr-forgot { font-size: 11px; color: rgba(255,255,255,0.3); background: none; border: none; cursor: pointer; padding: 0; transition: color .15s; font-family: 'DM Sans', sans-serif; }
        .lr-forgot:hover { color: rgba(255,255,255,0.6); }
        .lr-forgot.active { color: #dc2626; }

        .lr-input-wrap { position: relative; }
        .lr-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .2s, background .2s; appearance: none; }
        .lr-input::placeholder { color: rgba(255,255,255,0.12); }
        .lr-input:focus { border-color: rgba(220,38,38,0.6); background: rgba(220,38,38,0.04); }
        .lr-input.pr { padding-right: 42px; }
        .lr-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: rgba(255,255,255,0.25); display: flex; transition: color .2s; }
        .lr-eye:hover { color: rgba(255,255,255,0.6); }

        .lr-error { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25); border-radius: 8px; padding: 10px 14px; color: #f87171; font-size: 12px; line-height: 1.5; margin-bottom: 14px; }

        .lr-magic { background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.18); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
        .lr-magic-title { font-size: 12px; color: rgba(251,191,36,0.9); font-weight: 600; margin-bottom: 4px; }
        .lr-magic-body { font-size: 11.5px; color: rgba(251,191,36,0.6); line-height: 1.55; margin-bottom: 10px; }
        .lr-magic-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 9px 12px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; margin-bottom: 8px; }
        .lr-magic-btn { width: 100%; padding: 10px; background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.25); border-radius: 6px; color: #fbbf24; font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; transition: background .15s; }
        .lr-magic-btn:hover:not(:disabled) { background: rgba(251,191,36,0.2); }
        .lr-magic-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .lr-reset-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .lr-reset-hint { font-size: 11.5px; color: rgba(255,255,255,0.3); margin-bottom: 10px; line-height: 1.5; }
        .lr-reset-btn { width: 100%; padding: 10px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: rgba(255,255,255,0.55); font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; transition: border-color .15s, color .15s; }
        .lr-reset-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
        .lr-reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .lr-submit { width: 100%; padding: 14px; background: #dc2626; border: none; border-radius: 10px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; transition: background .2s; margin-top: 4px; }
        .lr-submit:hover:not(:disabled) { background: #b91c1c; }
        .lr-submit:active:not(:disabled) { transform: scale(.99); }
        .lr-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .lr-shimmer { position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent); animation: shimmer 2.2s infinite; }
        @keyframes shimmer { from{left:-60%} to{left:130%} }

        .lr-dots span { animation: blink 1.4s infinite both; font-size: 22px; }
        .lr-dots span:nth-child(2) { animation-delay:.2s; }
        .lr-dots span:nth-child(3) { animation-delay:.4s; }
        @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }

        .lr-success { color: #4ade80; font-size: 12px; display: flex; align-items: center; gap: 6px; }

        .lr-below { width: min(420px, 100%); text-align: center; }
        .lr-create { display: block; padding: 13px; border: 1px solid rgba(220,38,38,0.2); border-radius: 10px; color: #f87171; font-size: 13px; font-weight: 500; text-decoration: none; transition: background .18s, border-color .18s; }
        .lr-create:hover { background: rgba(220,38,38,0.06); border-color: rgba(220,38,38,0.35); }
        .lr-tagline { margin-top: 14px; font-size: 10px; color: rgba(255,255,255,0.14); letter-spacing: 0.08em; text-transform: uppercase; }

        @media(max-width:480px){ .lr-card{ padding:28px 20px 24px; border-radius:16px; } .lr-heading{ font-size:32px; } }
      `}</style>

      <div className="lr">
        {/* Brand */}
        <div className="lr-brand">
          <div className="lr-brand-dot">S</div>
          <span className="lr-brand-name">SHIFTOS</span>
        </div>

        {/* Card */}
        <div className={`lr-card${mounted ? " in" : ""}`}>
          <p className="lr-eyebrow">Restricted Access</p>
          <h2 className="lr-heading">SIGN IN</h2>

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
            <button type="submit" className="lr-submit" disabled={loading}>
              <div className="lr-shimmer" />
              {loading ? (
                <span className="lr-dots">
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                </span>
              ) : (
                "SIGN IN"
              )}
            </button>
          </form>
        </div>

        {/* Below card — create account + tagline */}
        <div className="lr-below">
          <a href="/onboarding" className="lr-create">
            Don't have an account? <strong>Create for free →</strong>
          </a>
          <p className="lr-tagline">
            Free for salesmen · 14-day trial for dealers ·{" "}
            <a href="/terms" style={{ color: "inherit", textDecoration: "underline" }}>Terms</a>
            {" · "}
            <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>Privacy</a>
          </p>
        </div>
      </div>
    </>
  );
}
