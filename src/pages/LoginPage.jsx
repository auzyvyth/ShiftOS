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
        window.location.href = `https://${subdomain}.xdrive.my?access_token=${accessToken}&refresh_token=${refreshToken}`;
      } else {
        window.location.href = "https://xdrive.my/dashboard";
      }
    } else if (role === "salesman") {
      if (profile?.dealer_id) {
        window.location.href = "https://xdrive.my/salesman";
      } else {
        window.location.href = "https://xdrive.my/salesman-lite";
      }
    } else {
      window.location.href = "https://xdrive.my/salesman";
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
        signInError.message.toLowerCase().includes('invalid') ||
        signInError.message.toLowerCase().includes('credentials') ||
        signInError.status === 400;

      if (isInvalidCreds) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.trim())
          .maybeSingle();
        if (existingProfile) {
          setError("");
          setShowMagicLink(true);
          setMagicEmail(email.trim());
        } else {
          setError(signInError.message);
        }
        // Always surface forgot password on any credential failure
        setShowForgotPassword(true);
      } else {
        setError(signInError.message);
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px 16px; background: #0a0a0c; font-family: 'DM Sans', sans-serif; overflow-x: hidden; overflow-y: auto; }
        .center-brand { display: flex; align-items: center; justify-content: center; gap: 10px; color: #fff; z-index: 2; }
        .center-brand-icon { width: 30px; height: 30px; background: #dc2626; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; }
        .center-brand-text { font-family: 'Bebas Neue', sans-serif; letter-spacing: 3px; font-size: 28px; line-height: 1; }
        .login-form-panel { width: min(440px, 100%); background: #111114; display: flex; flex-direction: column; align-items: stretch; position: relative; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,.45); opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease; overflow: hidden; }
        .login-form-panel.mounted { opacity: 1; transform: translateY(0); }
        .form-scroll { padding: 40px 40px 0; }
        .form-heading { margin-bottom: 28px; }
        .form-heading .eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #dc2626; font-weight: 500; margin-bottom: 8px; }
        .form-heading h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: #fff; letter-spacing: 2px; line-height: 1; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.35); margin-bottom: 7px; font-weight: 500; transition: color .2s; }
        .field.is-focused label { color: #dc2626; }
        .field-inner { position: relative; }
        .field input { width: 100%; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 4px; padding: 13px 16px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .2s, background .2s; appearance: none; }
        .field input::placeholder { color: rgba(255,255,255,.12); }
        .field input:focus { border-color: #dc2626; background: rgba(220,38,38,.05); }
        .field-bar { position: absolute; bottom: 0; left: 0; height: 2px; width: 0; background: #dc2626; border-radius: 0 0 12px 12px; transition: width .3s ease; }
        .field input:focus ~ .field-bar { width: 100%; }
        .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: rgba(255,255,255,.25); transition: color .2s; display: flex; }
        .pw-toggle:hover { color: rgba(255,255,255,.6); }
        .error-msg { background: rgba(220,38,38,.1); border: 1px solid rgba(220,38,38,.3); border-radius: 4px; padding: 10px 14px; color: #f87171; font-size: 12px; margin-bottom: 14px; }
        .submit-bar { padding: 16px 40px 36px; flex-shrink: 0; }
        .btn-submit { width: 100%; padding: 15px; background: #dc2626; border: none; border-radius: 4px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; transition: background .2s, transform .1s; margin-bottom: 12px; }
        .btn-submit:hover:not(:disabled) { background: #b91c1c; }
        .btn-submit:active:not(:disabled) { transform: scale(.99); }
        .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
        .btn-shimmer { position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent); animation: shimmer 2s infinite; }
        @keyframes shimmer { from { left: -60%; } to { left: 120%; } }
        .footer-note { text-align: center; font-size: 10px; color: rgba(255,255,255,.1); letter-spacing: 1px; text-transform: uppercase; padding-top: 14px; }
        .loading-dots span { animation: blink 1.4s infinite both; font-size: 22px; }
        .loading-dots span:nth-child(2) { animation-delay: .2s; }
        .loading-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%,80%,100% { opacity:0; } 40% { opacity:1; } }
        @media (max-width: 480px) { .form-scroll { padding: 30px 18px 0; } .submit-bar { padding: 12px 18px 26px; } .form-heading h2 { font-size: 34px; } .field input { padding: 12px 14px; font-size: 15px; } .btn-submit { font-size: 16px; padding: 14px; letter-spacing: 2px; } }
      `}</style>

      <div className="login-root">
        <div className="center-brand">
          <span className="center-brand-icon">S</span>
          <span className="center-brand-text">ShiftOS</span>
        </div>

        <div className={`login-form-panel ${mounted ? "mounted" : ""}`}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            style={{ display: "contents" }}
          >
            <div className="form-scroll">
              <div className="form-heading">
                <p className="eyebrow">Restricted Access</p>
                <h2>SIGN IN</h2>
              </div>
              <Field id="email" label="Email Address" focused={focused}>
                <TextInput
                  id="email"
                  type="email"
                  placeholder="admin@shiftos.my"
                  value={email}
                  onChange={setEmail}
                  onFocusChange={setFocused}
                />
              </Field>
              <Field id="password" label="Password" focused={focused}>
                <div className="field-inner">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused("")}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    className="pw-toggle"
                    type="button"
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
                  <div className="field-bar" />
                </div>
              </Field>
              {error && <div className="error-msg">&#9888; {error}</div>}
              {showMagicLink && (
                <div
                  style={{
                    background: "rgba(251,191,36,0.08)",
                    border: "1px solid rgba(251,191,36,0.2)",
                    borderRadius: 4,
                    padding: "12px 14px",
                    marginBottom: 14,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(251,191,36,0.85)",
                      lineHeight: 1.6,
                      marginBottom: 10,
                    }}
                  >
                    Looks like you signed up with Google or a magic link. We'll
                    send you a sign in link instead.
                  </p>
                  <input
                    type="email"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "10px 12px",
                      color: "#fff",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      outline: "none",
                      marginBottom: 8,
                      boxSizing: "border-box",
                    }}
                  />
                  {magicSent ? (
                    <p style={{ fontSize: 12, color: "#4ade80" }}>
                      Magic link sent! Check your inbox.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={magicLoading}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "rgba(251,191,36,0.15)",
                        border: "1px solid rgba(251,191,36,0.3)",
                        borderRadius: 4,
                        color: "#fbbf24",
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 14,
                        letterSpacing: 2,
                        cursor: magicLoading ? "not-allowed" : "pointer",
                        opacity: magicLoading ? 0.6 : 1,
                      }}
                    >
                      {magicLoading ? "SENDING…" : "SEND MAGIC LINK"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="submit-bar">
              <button type="submit" className="btn-submit" disabled={loading}>
                <div className="btn-shimmer" />
                {loading ? (
                  <span className="loading-dots">
                    <span>·</span>
                    <span>·</span>
                    <span>·</span>
                  </span>
                ) : (
                  "ACCESS DASHBOARD"
                )}
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "12px 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(255,255,255,0.08)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    letterSpacing: "0.08em",
                  }}
                >
                  OR
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "rgba(255,255,255,0.08)",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  cursor: "pointer",
                  marginBottom: 12,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
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
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword((p) => !p)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 12,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                  marginBottom: 8,
                  padding: "2px 0",
                }}
              >
                Forgot password?
              </button>
              {showForgotPassword && (
                <div style={{ marginBottom: 12 }}>
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      marginBottom: 8,
                      textAlign: "center",
                    }}
                  >
                    We'll send a reset link to your email above.
                  </p>
                  {resetSent ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#4ade80",
                        textAlign: "center",
                      }}
                    >
                      Reset link sent! Check your inbox.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={resetLoading}
                      style={{
                        width: "100%",
                        padding: "11px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        color: "rgba(255,255,255,0.6)",
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 14,
                        letterSpacing: 2,
                        cursor: resetLoading ? "not-allowed" : "pointer",
                        opacity: resetLoading ? 0.6 : 1,
                      }}
                    >
                      {resetLoading ? "SENDING…" : "SEND RESET LINK"}
                    </button>
                  )}
                </div>
              )}
              <a
                href="/onboarding"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  padding: "12px 0",
                  marginBottom: 4,
                  background: "rgba(220,38,38,0.06)",
                  border: "1px solid rgba(220,38,38,0.18)",
                  borderRadius: 4,
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(220,38,38,0.12)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(220,38,38,0.06)")
                }
              >
                Create free account →
              </a>
              <p
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.2)",
                  marginBottom: 6,
                  letterSpacing: "0.04em",
                }}
              >
                Free for salesmen · 14-day trial for dealers
              </p>
              <p className="footer-note">ShiftOS · Secure Admin Access</p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
