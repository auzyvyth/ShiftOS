import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ─── Malaysian data ────────────────────────────────────────────────────────
const STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
];
const DEALERSHIP_TYPES = [
  "Independent Dealer",
  "Franchise Dealer",
  "Used Car Lot",
  "Car Rental",
  "Multi-Brand Showroom",
];
const FLEET_SIZES = [
  "1–5 cars",
  "6–15 cars",
  "16–30 cars",
  "31–50 cars",
  "50+ cars",
];

// ─── Steps config (dynamic per account type) ───────────────────────────────
const STEPS_DEALER = [
  { id: 1, code: "01", label: "SETUP", hint: "Who are you?" },
  { id: 2, code: "02", label: "DEALERSHIP", hint: "Your business" },
  { id: 3, code: "03", label: "OPERATIONS", hint: "How you work" },
  { id: 4, code: "04", label: "ACTIVATE", hint: "Go live" },
];
const STEPS_SALESMAN = [
  { id: 1, code: "01", label: "SETUP", hint: "Who are you?" },
  { id: 2, code: "02", label: "PROFILE", hint: "Your public profile" },
  { id: 3, code: "03", label: "ACTIVATE", hint: "Go live" },
];

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// ─── Small components ──────────────────────────────────────────────────────
function Pill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pill ${active ? "pill-active" : ""}`}
    >
      {label}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`inp-wrap ${focused ? "inp-focused" : ""} ${value ? "inp-filled" : ""}`}
    >
      <label className="inp-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="inp-field"
        autoComplete="off"
      />
      <div className="inp-line" />
      {hint && <p className="inp-hint">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`inp-wrap ${focused ? "inp-focused" : ""} ${value ? "inp-filled" : ""}`}
    >
      <label className="inp-label">{label}</label>
      <div className="sel-wrap">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="inp-field inp-select"
        >
          <option value="">— Select —</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg
          className="sel-arrow"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div className="inp-line" />
    </div>
  );
}

// ─── Account type card ─────────────────────────────────────────────────────
function TypeCard({ type, icon, title, subtitle, bullets, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`type-card ${active ? "type-card-active" : ""}`}
    >
      <div className="type-card-icon">{icon}</div>
      <div className="type-card-body">
        <div className="type-card-title">{title}</div>
        <div className="type-card-sub">{subtitle}</div>
        <ul className="type-card-bullets">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
      <div className="type-card-check">
        {active && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [animDir, setAnimDir] = useState("forward");
  const [visible, setVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [authReady, setAuthReady] = useState(false);

  // Signup state (used inside step 1 when not yet authenticated)
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // ── Account type ──
  const [accountType, setAccountType] = useState(""); // "dealership" | "salesman"

  // Step 1 — Identity
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+60");
  const [ic, setIc] = useState("");

  // Step 2 Dealer — Dealership
  const [dealerName, setDealerName] = useState("");
  const [dealerType, setDealerType] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [ssmNumber, setSsmNumber] = useState("");
  const subdomainTouched = useRef(false);

  // Step 2 Salesman — Profile
  const [salesmanBrand, setSalesmanBrand] = useState(""); // e.g. their name / personal brand
  const [salesmanState, setSalesmanState] = useState("");
  const [salesmanCity, setSalesmanCity] = useState("");
  const [salesmanSlug, setSalesmanSlug] = useState("");
  const salesmanSlugTouched = useRef(false);

  // Step 3 Dealer — Operations
  const [fleetSize, setFleetSize] = useState("");
  const [whatsapp, setWhatsapp] = useState("+60");
  const [website, setWebsite] = useState("");

  const [profileData, setProfileData] = useState(null);

  const STEPS = accountType === "salesman" ? STEPS_SALESMAN : STEPS_DEALER;
  const totalSteps = STEPS.length;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setAuthReady(true);
        return;
      }
      const uid = data.session.user.id;
      setUserId(uid);
      setUserEmail(data.session.user.email);
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (!profile) {
        setAuthReady(true);
        return;
      }
      setProfileData(profile);
      if (profile.role === "dealer" || profile.role === "superadmin")
        setAccountType("dealership");
      else if (profile.role === "salesman") setAccountType("salesman");
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.phone) setPhone(profile.phone);
      if (profile.dealership) setDealerName(profile.dealership);
      if (profile.subdomain) {
        setSubdomain(profile.subdomain);
        subdomainTouched.current = true;
      }
      if (profile.location) {
        const loc = profile.location;
        const matchedState = STATES.find((s) => loc.includes(s));
        if (matchedState) {
          setState(matchedState);
          const c = loc
            .replace(matchedState, "")
            .replace(/^,\s*/, "")
            .replace(/,\s*$/, "")
            .trim();
          if (c) setCity(c);
        }
      }
      setAuthReady(true);
    });
  }, []);

  // Auto-fill subdomain from dealer name
  useEffect(() => {
    if (subdomainTouched.current) return;
    setSubdomain(
      dealerName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20),
    );
  }, [dealerName]);

  // Auto-fill salesman slug from name
  useEffect(() => {
    if (salesmanSlugTouched.current) return;
    setSalesmanSlug(
      fullName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20),
    );
  }, [fullName]);

  const handleSignup = async () => {
    setSignupError("");
    if (!signupEmail.trim()) {
      setSignupError("Email is required.");
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(signupPassword)) {
      setSignupError(
        "Password needs 8+ chars with uppercase, lowercase, number, and special character.",
      );
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match.");
      return;
    }
    setSignupLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (err) {
      setSignupError(err.message);
      setSignupLoading(false);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: signupEmail.trim(),
        full_name: fullName.trim() || null,
        phone: phone !== "+60" ? phone : null,
        role: accountType === "salesman" ? "salesman" : "dealer",
        is_active: true,
        onboarding_complete: false,
      });
    }
    setSignupLoading(false);
    setConfirmSent(true);
  };

  const goTo = (next) => {
    const dir = next > step ? "forward" : "back";
    setAnimDir(dir);
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
      setError("");
    }, 320);
  };

  const canProceed = () => {
    if (step === 1) {
      if (!accountType) return false;
      if (fullName.trim().length < 2 || phone.length < 10) return false;
      if (!userId) {
        return (
          signupEmail.trim().length > 0 &&
          STRONG_PASSWORD_REGEX.test(signupPassword) &&
          signupPassword === signupConfirm
        );
      }
      return true;
    }
    if (accountType === "salesman") {
      if (step === 2)
        return (
          salesmanBrand.trim() &&
          salesmanState &&
          /^[a-z0-9]{3,20}$/.test(salesmanSlug)
        );
    } else {
      if (step === 2)
        return (
          dealerName.trim() &&
          dealerType &&
          state &&
          /^[a-z0-9]{3,20}$/.test(subdomain)
        );
      if (step === 3) return !!fleetSize;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError("");
    try {
      const isSalesman = accountType === "salesman";
      const payload = isSalesman
        ? {
            id: userId,
            email: userEmail,
            full_name: fullName.trim(),
            phone,
            role: "salesman",
            is_active: true,
            onboarding_complete: true,
            slug: salesmanSlug,
            dealership: salesmanBrand.trim(),
            location: salesmanCity
              ? `${salesmanCity}, ${salesmanState}`
              : salesmanState,
            ic: ic || null,
            ic_submitted: !!(ic && ic.length > 0),
            ic_deadline: ic
              ? null
              : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            selected_plan: profileData?.selected_plan || "standard",
          }
        : {
            id: userId,
            email: userEmail,
            full_name: fullName.trim(),
            phone,
            dealership: dealerName.trim(),
            location: city ? `${city}, ${state}` : state,
            role: "dealer",
            is_active: true,
            onboarding_complete: true,
            subdomain,
            ssm_number: ssmNumber || null,
            ic: ic || null,
            ic_submitted: !!(ic && ic.length > 0),
            ic_deadline: ic
              ? null
              : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            selected_plan: profileData?.selected_plan || "standard",
          };
      const { error: err } = await supabase.from("profiles").upsert(payload);
      if (err) throw err;
      setDone(true);
      setTimeout(() => navigate(isSalesman ? "/salesman" : "/dashboard"), 2800);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  if (!authReady) return null;

  // ── Auth screens ──────────────────────────────────────────────────────────
  const sharedAuthStyles = {
    root: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      padding: "24px 16px",
      background: "#080809",
      fontFamily: "'DM Sans', sans-serif",
    },
    logo: { display: "flex", alignItems: "center", gap: 10 },
    logoDot: {
      width: 28,
      height: 28,
      background: "#dc2626",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 0 20px rgba(220,38,38,0.35)",
    },
    logoName: {
      fontFamily: "'Syne', sans-serif",
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: 4,
      color: "#f0f0f0",
      textTransform: "uppercase",
    },
    card: {
      width: "min(440px,100%)",
      background: "#0f0f11",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 20,
      padding: "40px",
      boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
    },
    label: {
      display: "block",
      fontSize: 9,
      letterSpacing: 2.5,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.35)",
      marginBottom: 8,
      fontFamily: "'Syne', sans-serif",
      fontWeight: 600,
    },
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 4,
      padding: "13px 16px",
      color: "#f0f0f0",
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
    },
    btn: {
      width: "100%",
      padding: "14px",
      background: "#dc2626",
      border: "none",
      borderRadius: 4,
      color: "#fff",
      fontFamily: "'Syne', sans-serif",
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: 2,
      textTransform: "uppercase",
      cursor: "pointer",
      marginBottom: 16,
    },
  };

  if (confirmSent) {
    return (
      <div style={sharedAuthStyles.root}>
        <div style={sharedAuthStyles.logo}>
          <div style={sharedAuthStyles.logoDot}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={sharedAuthStyles.logoName}>ShiftOS</span>
        </div>
        <div style={{ ...sharedAuthStyles.card, textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f87171"
              strokeWidth="1.5"
            >
              <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: "#f0f0f0",
              letterSpacing: -0.5,
              marginBottom: 12,
            }}
          >
            Check your inbox
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.4)",
              lineHeight: 1.6,
              marginBottom: 8,
            }}
          >
            We sent a confirmation link to
          </p>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#f0f0f0",
              marginBottom: 28,
              wordBreak: "break-all",
            }}
          >
            {signupEmail}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.25)",
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            Click the link to activate your account, then sign in to continue
            your setup.
          </p>
          {resendSent && (
            <p style={{ fontSize: 12, color: "#4ade80", marginBottom: 16 }}>
              Confirmation email resent!
            </p>
          )}
          <button
            onClick={async () => {
              setResendLoading(true);
              setResendSent(false);
              await supabase.auth.resend({
                type: "signup",
                email: signupEmail,
              });
              setResendLoading(false);
              setResendSent(true);
            }}
            disabled={resendLoading}
            style={{
              ...sharedAuthStyles.btn,
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.2)",
              color: "#f87171",
            }}
          >
            {resendLoading ? "Sending…" : "Resend confirmation email"}
          </button>
          <a
            href="/login"
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.25)",
              textDecoration: "none",
            }}
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  // ── Main onboarding ────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Syne+Mono&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --red: #dc2626; --red-dim: rgba(220,38,38,0.15); --red-glow: rgba(220,38,38,0.35);
          --bg: #080809; --surface: #0f0f11; --border: rgba(255,255,255,0.07);
          --text: #f0f0f0; --muted: rgba(255,255,255,0.35); --faint: rgba(255,255,255,0.08);
        }
        body { background: var(--bg); }

        /* ── Layout ── */
        .ob-root {
          min-height: 100vh; background: var(--bg); font-family: 'DM Sans', sans-serif;
          display: grid; grid-template-columns: 280px 1fr; position: relative; overflow: hidden;
        }
        .ob-root::before {
          content: ''; position: fixed; top: -200px; left: -200px;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
          animation: driftA 18s ease-in-out infinite alternate;
        }
        .ob-root::after {
          content: ''; position: fixed; bottom: -150px; right: -100px;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(220,38,38,0.05) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
          animation: driftB 22s ease-in-out infinite alternate;
        }
        @keyframes driftA { from { transform: translate(0,0); } to { transform: translate(80px, 60px); } }
        @keyframes driftB { from { transform: translate(0,0); } to { transform: translate(-60px, -80px); } }

        /* ── Sidebar ── */
        .ob-sidebar {
          position: relative; z-index: 2; border-right: 1px solid var(--border);
          padding: 48px 32px; display: flex; flex-direction: column;
          background: linear-gradient(180deg, rgba(220,38,38,0.03) 0%, transparent 60%);
        }
        .ob-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 64px; }
        .ob-logo-dot {
          width: 28px; height: 28px; background: var(--red); border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px var(--red-glow);
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%,100% { box-shadow: 0 0 20px var(--red-glow); }
          50% { box-shadow: 0 0 40px rgba(220,38,38,0.6), 0 0 80px rgba(220,38,38,0.2); }
        }
        .ob-logo-dot svg { width: 14px; height: 14px; fill: white; }
        .ob-logo-name { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; letter-spacing: 4px; color: var(--text); text-transform: uppercase; }

        /* Account type badge in sidebar */
        .ob-type-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 7px 14px; border-radius: 999px; margin-bottom: 28px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 10px;
          letter-spacing: 2px; text-transform: uppercase;
        }
        .ob-type-badge.dealer {
          background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25); color: #f87171;
        }
        .ob-type-badge.salesman {
          background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); color: #93c5fd;
        }
        .ob-type-badge-dot { width: 6px; height: 6px; border-radius: 50%; }
        .ob-type-badge.dealer .ob-type-badge-dot { background: var(--red); }
        .ob-type-badge.salesman .ob-type-badge-dot { background: #60a5fa; }

        .ob-steps { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .ob-step { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-radius: 10px; cursor: default; transition: background 0.3s; position: relative; }
        .ob-step.clickable { cursor: pointer; }
        .ob-step.clickable:hover { background: var(--faint); }
        .ob-step.active { background: var(--red-dim); }
        .ob-step-num { font-family: 'Syne Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 1px; width: 24px; flex-shrink: 0; transition: color 0.3s; }
        .ob-step.active .ob-step-num { color: var(--red); }
        .ob-step.done .ob-step-num { color: #22c55e; }
        .ob-step-info { flex: 1; }
        .ob-step-label { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; transition: color 0.3s; }
        .ob-step.active .ob-step-label { color: var(--text); }
        .ob-step-hint { font-size: 11px; color: rgba(255,255,255,0.18); margin-top: 2px; }
        .ob-step.active .ob-step-hint { color: rgba(255,255,255,0.4); }
        .ob-step-tick { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; transition: all 0.3s; flex-shrink: 0; }
        .ob-step.active .ob-step-tick { border-color: var(--red); background: var(--red-dim); box-shadow: 0 0 12px var(--red-glow); }
        .ob-step.done .ob-step-tick { border-color: #22c55e; background: rgba(34,197,94,0.15); }
        .ob-step-connector { width: 1px; height: 24px; background: var(--border); margin-left: 31px; }
        .ob-step-connector.done-line { background: rgba(34,197,94,0.3); }
        .ob-sidebar-footer { padding-top: 32px; border-top: 1px solid var(--border); }
        .ob-sidebar-footer p { font-size: 11px; color: rgba(255,255,255,0.15); line-height: 1.7; }
        .ob-sidebar-footer strong { color: rgba(255,255,255,0.3); }

        /* ── Main ── */
        .ob-main { position: relative; z-index: 2; display: flex; flex-direction: column; padding: 48px 64px; overflow-y: auto; }
        .ob-progress { height: 2px; background: var(--border); border-radius: 999px; margin-bottom: 56px; overflow: hidden; flex-shrink: 0; }
        .ob-progress-fill { height: 100%; background: linear-gradient(90deg, var(--red) 0%, rgba(220,38,38,0.6) 100%); border-radius: 999px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 0 12px var(--red-glow); }

        .ob-content { flex: 1; max-width: 560px; transition: opacity 0.28s ease, transform 0.28s ease; }
        .ob-content.hidden-forward { opacity: 0; transform: translateX(32px); }
        .ob-content.hidden-back    { opacity: 0; transform: translateX(-32px); }
        .ob-content.visible        { opacity: 1; transform: translateX(0); }

        .ob-eyebrow { font-family: 'Syne Mono', monospace; font-size: 10px; letter-spacing: 3px; color: var(--red); text-transform: uppercase; margin-bottom: 12px; }
        .ob-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 42px; line-height: 1.05; color: var(--text); letter-spacing: -0.5px; margin-bottom: 8px; }
        .ob-subtitle { font-size: 15px; color: var(--muted); line-height: 1.6; margin-bottom: 40px; }

        /* ── Account type cards ── */
        .type-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 32px; }
        .type-card {
          position: relative; display: flex; align-items: flex-start; gap: 14px;
          padding: 20px; border-radius: 12px;
          background: var(--surface); border: 1.5px solid var(--border);
          cursor: pointer; text-align: left; transition: all 0.2s;
        }
        .type-card:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.03); }
        .type-card-active.dealer-card { border-color: var(--red); background: rgba(220,38,38,0.06); box-shadow: 0 0 24px rgba(220,38,38,0.12); }
        .type-card-active.salesman-card { border-color: #3b82f6; background: rgba(59,130,246,0.06); box-shadow: 0 0 24px rgba(59,130,246,0.12); }
        .type-card-icon {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
          background: var(--faint);
        }
        .type-card-active.dealer-card .type-card-icon { background: rgba(220,38,38,0.12); }
        .type-card-active.salesman-card .type-card-icon { background: rgba(59,130,246,0.12); }
        .type-card-body { flex: 1; }
        .type-card-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; color: var(--text); margin-bottom: 4px; }
        .type-card-sub { font-size: 12px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
        .type-card-bullets { list-style: none; display: flex; flex-direction: column; gap: 3px; }
        .type-card-bullets li { font-size: 11px; color: rgba(255,255,255,0.25); display: flex; align-items: center; gap: 6px; }
        .type-card-bullets li::before { content: '—'; color: rgba(255,255,255,0.12); font-size: 10px; }
        .type-card-active .type-card-bullets li { color: rgba(255,255,255,0.4); }
        .type-card-check {
          position: absolute; top: 12px; right: 12px;
          width: 20px; height: 20px; border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .type-card-active.dealer-card .type-card-check { background: var(--red); border-color: var(--red); }
        .type-card-active.salesman-card .type-card-check { background: #3b82f6; border-color: #3b82f6; }

        /* ── Fields ── */
        .ob-fields { display: flex; flex-direction: column; gap: 8px; }
        .ob-fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .ob-divider { height: 1px; background: var(--border); margin: 24px 0; }
        .pill-label { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
        .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; margin-bottom: 8px; }
        .pill { padding: 9px 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .pill:hover { border-color: rgba(220,38,38,0.4); color: var(--text); }
        .pill-active { border-color: var(--red); background: var(--red-dim); color: var(--text); box-shadow: 0 0 16px var(--red-dim); }

        .inp-wrap { position: relative; padding-top: 20px; padding-bottom: 4px; }
        .inp-label { position: absolute; top: 0; left: 0; font-size: 9px; font-family: 'Syne', sans-serif; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); transition: color 0.2s; pointer-events: none; }
        .inp-focused .inp-label, .inp-filled .inp-label { color: var(--red); }
        .inp-field { width: 100%; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); padding: 10px 0; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color 0.2s; appearance: none; }
        .inp-field::placeholder { color: rgba(255,255,255,0.12); }
        .inp-focused .inp-field { border-color: rgba(255,255,255,0.25); }
        .inp-line { position: absolute; bottom: 4px; left: 0; height: 1px; width: 0; background: var(--red); transition: width 0.35s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 0 8px var(--red-glow); }
        .inp-focused .inp-line { width: 100%; }
        .inp-hint { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 6px; }
        .sel-wrap { position: relative; }
        .inp-select { cursor: pointer; padding-right: 24px; }
        .inp-select option { background: #1a1a1e; }
        .sel-arrow { position: absolute; right: 0; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }

        /* ── Subdomain preview ── */
        .subdomain-preview {
          display: inline-flex; align-items: center; gap: 0;
          background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.18);
          border-radius: 6px; overflow: hidden; margin-top: 8px;
          font-family: 'Syne Mono', monospace; font-size: 12px;
        }
        .subdomain-preview .sub-slug { padding: 5px 10px; color: #f87171; }
        .subdomain-preview .sub-domain { padding: 5px 10px; color: rgba(255,255,255,0.2); border-left: 1px solid rgba(220,38,38,0.15); }

        /* ── Actions ── */
        .ob-actions { display: flex; align-items: center; gap: 16px; margin-top: 40px; }
        .ob-btn-primary {
          display: flex; align-items: center; gap: 10px; padding: 14px 32px;
          background: var(--red); border: none; border-radius: 6px; color: white;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
          cursor: pointer; transition: background 0.2s, box-shadow 0.2s, transform 0.1s; position: relative; overflow: hidden;
        }
        .ob-btn-primary::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%); pointer-events: none; }
        .ob-btn-primary:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 0 32px rgba(220,38,38,0.4); transform: translateY(-1px); }
        .ob-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .ob-btn-back { padding: 14px 20px; background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-family: 'Syne', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .ob-btn-back:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
        .ob-error { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2); border-radius: 6px; color: #f87171; font-size: 13px; margin-top: 16px; }

        /* ── Review ── */
        .review-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; margin-bottom: 16px; }
        .review-card-header { padding: 14px 20px; border-bottom: 1px solid var(--border); font-family: 'Syne', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 8px; }
        .review-card-header span { width: 6px; height: 6px; border-radius: 50%; background: var(--red); box-shadow: 0 0 8px var(--red-glow); }
        .review-row { display: grid; grid-template-columns: 140px 1fr; padding: 12px 20px; border-bottom: 1px solid var(--border); font-size: 13px; gap: 16px; }
        .review-row:last-child { border-bottom: none; }
        .review-key { color: var(--muted); font-size: 12px; }
        .review-val { color: var(--text); font-weight: 500; word-break: break-word; }
        .plan-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.25); border-radius: 999px; font-family: 'Syne', monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f87171; text-transform: uppercase; margin-bottom: 20px; }

        /* ── Done ── */
        .ob-done { position: fixed; inset: 0; background: var(--bg); z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .done-ring { width: 100px; height: 100px; border-radius: 50%; border: 2px solid var(--red); display: flex; align-items: center; justify-content: center; position: relative; animation: ringPulse 2s ease-in-out infinite; }
        @keyframes ringPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 20px rgba(220,38,38,0); } }
        .done-ring::before { content: ''; position: absolute; inset: -12px; border-radius: 50%; border: 1px solid rgba(220,38,38,0.2); animation: ringPulse 2s ease-in-out infinite 0.3s; }
        .done-check { font-size: 36px; animation: checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both; }
        @keyframes checkPop { from { transform: scale(0) rotate(-30deg); } to { transform: scale(1) rotate(0deg); } }
        .done-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px; color: var(--text); letter-spacing: -0.5px; text-align: center; }
        .done-sub { font-size: 15px; color: var(--muted); text-align: center; max-width: 340px; line-height: 1.6; }
        .done-loader { display: flex; gap: 6px; align-items: center; }
        .done-loader span { width: 6px; height: 6px; border-radius: 50%; background: var(--red); animation: dotBounce 1.2s ease-in-out infinite; }
        .done-loader span:nth-child(2) { animation-delay: 0.15s; }
        .done-loader span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes dotBounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.2); opacity: 1; } }

        @media (max-width: 900px) {
          .ob-root { grid-template-columns: 1fr; }
          .ob-sidebar { display: none; }
          .ob-main { padding: 32px 24px; }
          .ob-title { font-size: 32px; }
          .ob-fields-row { grid-template-columns: 1fr; }
          .type-cards { grid-template-columns: 1fr; }
        }
      `}</style>

      {done && (
        <div className="ob-done">
          <div className="done-ring">
            <span className="done-check">✓</span>
          </div>
          <h2 className="done-title">You're in.</h2>
          <p className="done-sub">
            {accountType === "salesman"
              ? "Your salesman profile is live on ShiftOS. Taking you to your panel…"
              : "Your dealership is now live on ShiftOS. Taking you to your dashboard…"}
          </p>
          <div className="done-loader">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      <div className="ob-root">
        {/* ── Sidebar ── */}
        <aside className="ob-sidebar">
          <div className="ob-logo">
            <div className="ob-logo-dot">
              <svg viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="ob-logo-name">ShiftOS</span>
          </div>

          {accountType && (
            <div className={`ob-type-badge ${accountType}`}>
              <div className="ob-type-badge-dot" />
              {accountType === "salesman" ? "Sole Salesman" : "Dealership"}
            </div>
          )}

          <div className="ob-steps">
            {STEPS.map((s, i) => {
              const isDone = step > s.id;
              const isActive = step === s.id;
              return (
                <React.Fragment key={s.id}>
                  <div
                    className={`ob-step ${isActive ? "active" : ""} ${isDone ? "done clickable" : ""}`}
                    onClick={() => (isDone ? goTo(s.id) : undefined)}
                  >
                    <span className="ob-step-num">{s.code}</span>
                    <div className="ob-step-info">
                      <div className="ob-step-label">{s.label}</div>
                      <div className="ob-step-hint">{s.hint}</div>
                    </div>
                    <div className="ob-step-tick">
                      {isDone && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {isActive && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--red)",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`ob-step-connector ${isDone ? "done-line" : ""}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="ob-sidebar-footer">
            <p>
              <strong>14-day free trial</strong>
              <br />
              No credit card required.
              <br />
              RM 500/month after trial.
            </p>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="ob-main">
          <div className="ob-progress">
            <div
              className="ob-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            className={`ob-content ${visible ? "visible" : animDir === "forward" ? "hidden-forward" : "hidden-back"}`}
          >
            {/* ── STEP 1: Setup (account type + identity) ── */}
            {step === 1 && (
              <>
                <p className="ob-eyebrow">
                  Step 01 / {totalSteps.toString().padStart(2, "0")}
                </p>
                <h1 className="ob-title">
                  Let's get
                  <br />
                  you set up.
                </h1>
                <p className="ob-subtitle">
                  First, tell us how you're using ShiftOS — then we'll
                  personalise your setup.
                </p>

                {/* Account type selector */}
                <div style={{ marginBottom: 8 }}>
                  <p className="pill-label" style={{ marginBottom: 14 }}>
                    I am a…
                  </p>
                  <div className="type-cards">
                    <TypeCard
                      type="dealership"
                      icon="🏢"
                      title="Dealership"
                      subtitle="A business with a team of salesmen"
                      bullets={[
                        "Team management & roles",
                        "Multi-salesman dashboard",
                        "Dealership storefront on XDrive",
                      ]}
                      active={accountType === "dealership"}
                      onClick={() => setAccountType("dealership")}
                    />
                    <TypeCard
                      type="salesman"
                      icon="🧑‍💼"
                      title="Sole Salesman"
                      subtitle="An individual selling independently"
                      bullets={[
                        "Personal public profile",
                        "Your own listing page",
                        "Lead tracking & enquiries",
                      ]}
                      active={accountType === "salesman"}
                      onClick={() => setAccountType("salesman")}
                    />
                  </div>
                </div>

                {accountType && (
                  <>
                    <div className="ob-divider" />
                    <div className="ob-fields">
                      <Input
                        label="Full Name"
                        value={fullName}
                        onChange={setFullName}
                        placeholder="Ahmad bin Abdullah"
                      />
                      <Input
                        label="Phone Number"
                        value={phone}
                        onChange={setPhone}
                        placeholder="+60123456789"
                        hint="WhatsApp-enabled number preferred"
                      />
                      <Input
                        label="IC Number (MyKad)"
                        value={ic}
                        onChange={setIc}
                        placeholder="901231-10-1234"
                        hint="Optional now — required within 10 days or account is terminated."
                      />
                      <div className="ob-divider" />
                      <Input
                        label="Email Address"
                        value={signupEmail}
                        onChange={setSignupEmail}
                        placeholder="you@example.com"
                        type="email"
                      />
                      <div
                        className={`inp-wrap ${signupPassword ? "inp-filled" : ""}`}
                        style={{ paddingTop: 20 }}
                      >
                        <label className="inp-label">Password</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showPw ? "text" : "password"}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="Min 8 characters"
                            className="inp-field"
                            autoComplete="new-password"
                            style={{ paddingRight: 40 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((p) => !p)}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "rgba(255,255,255,0.25)",
                              display: "flex",
                              padding: 0,
                            }}
                          >
                            {showPw ? (
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
                        <div className="inp-line" />
                        {signupPassword &&
                          !STRONG_PASSWORD_REGEX.test(signupPassword) && (
                            <p
                              className="inp-hint"
                              style={{ color: "#f87171" }}
                            >
                              8+ chars with uppercase, lowercase, number,
                              special character
                            </p>
                          )}
                      </div>
                      <Input
                        label="Confirm Password"
                        value={signupConfirm}
                        onChange={setSignupConfirm}
                        placeholder="••••••••"
                        type="password"
                        hint={
                          signupConfirm && signupConfirm !== signupPassword
                            ? "Passwords do not match"
                            : undefined
                        }
                      />
                      {signupError && (
                        <div
                          style={{
                            background: "rgba(220,38,38,0.08)",
                            border: "1px solid rgba(220,38,38,0.2)",
                            borderRadius: 6,
                            padding: "10px 14px",
                            color: "#f87171",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          ⚠ {signupError}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── STEP 2A: Dealership (dealer path) ── */}
            {step === 2 && accountType === "dealership" && (
              <>
                <p className="ob-eyebrow">Step 02 / 04</p>
                <h1 className="ob-title">
                  Your
                  <br />
                  dealership.
                </h1>
                <p className="ob-subtitle">
                  This creates your ShiftOS workspace. You can update these
                  details later in Settings.
                </p>
                <div className="ob-fields">
                  <Input
                    label="Dealership Name"
                    value={dealerName}
                    onChange={setDealerName}
                    placeholder="Fast Track Auto Sdn Bhd"
                  />
                  <div
                    className={`inp-wrap ${subdomain ? "inp-filled" : ""}`}
                    style={{ paddingTop: 20 }}
                  >
                    <label className="inp-label">Your XDrive URL</label>
                    <input
                      className="inp-field"
                      value={subdomain}
                      maxLength={20}
                      placeholder="yourbrand"
                      onChange={(e) => {
                        subdomainTouched.current = true;
                        setSubdomain(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "")
                            .slice(0, 20),
                        );
                      }}
                      autoComplete="off"
                    />
                    <div className="inp-line" />
                    {subdomain ? (
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div className="subdomain-preview">
                          <span className="sub-slug">{subdomain}</span>
                          <span className="sub-domain">.xdrive.my</span>
                        </div>
                        {!/^[a-z0-9]{3,20}$/.test(subdomain) && (
                          <span style={{ fontSize: 11, color: "#f87171" }}>
                            Min 3 chars, letters & numbers only
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="inp-hint">
                        Auto-filled from dealership name — you can edit it
                      </p>
                    )}
                  </div>
                  <div style={{ height: 8 }} />
                  <p className="pill-label">Dealership Type</p>
                  <div className="pills">
                    {DEALERSHIP_TYPES.map((t) => (
                      <Pill
                        key={t}
                        label={t}
                        active={dealerType === t}
                        onClick={() => setDealerType(t)}
                      />
                    ))}
                  </div>
                  <div className="ob-divider" />
                  <div className="ob-fields-row">
                    <Select
                      label="State"
                      value={state}
                      onChange={setState}
                      options={STATES}
                    />
                    <Input
                      label="City / Area"
                      value={city}
                      onChange={setCity}
                      placeholder="e.g. Butterworth"
                    />
                  </div>
                  <Input
                    label="SSM Number"
                    value={ssmNumber}
                    onChange={setSsmNumber}
                    placeholder="e.g. 1234567-A"
                    hint="Required within 10 days for full verification"
                  />
                </div>
              </>
            )}

            {/* ── STEP 2B: Profile (salesman path) ── */}
            {step === 2 && accountType === "salesman" && (
              <>
                <p className="ob-eyebrow">Step 02 / 03</p>
                <h1 className="ob-title">
                  Your public
                  <br />
                  profile.
                </h1>
                <p className="ob-subtitle">
                  This is your personal salesman page on XDrive. Buyers will see
                  this when they enquire on your listings.
                </p>
                <div className="ob-fields">
                  <Input
                    label="Your Name / Brand"
                    value={salesmanBrand}
                    onChange={setSalesmanBrand}
                    placeholder="Ahmad Motors"
                    hint="This appears on your XDrive profile and listings"
                  />
                  <div
                    className={`inp-wrap ${salesmanSlug ? "inp-filled" : ""}`}
                    style={{ paddingTop: 20 }}
                  >
                    <label className="inp-label">Your Profile URL</label>
                    <input
                      className="inp-field"
                      value={salesmanSlug}
                      maxLength={20}
                      placeholder="yourname"
                      onChange={(e) => {
                        salesmanSlugTouched.current = true;
                        setSalesmanSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "")
                            .slice(0, 20),
                        );
                      }}
                      autoComplete="off"
                    />
                    <div className="inp-line" />
                    {salesmanSlug ? (
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div className="subdomain-preview">
                          <span className="sub-slug">xdrive.my/s/</span>
                          <span className="sub-domain">{salesmanSlug}</span>
                        </div>
                        {!/^[a-z0-9]{3,20}$/.test(salesmanSlug) && (
                          <span style={{ fontSize: 11, color: "#f87171" }}>
                            Min 3 chars, letters & numbers only
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="inp-hint">
                        Auto-filled from your name — you can edit it
                      </p>
                    )}
                  </div>
                  <div className="ob-divider" />
                  <div className="ob-fields-row">
                    <Select
                      label="State"
                      value={salesmanState}
                      onChange={setSalesmanState}
                      options={STATES}
                    />
                    <Input
                      label="City / Area"
                      value={salesmanCity}
                      onChange={setSalesmanCity}
                      placeholder="e.g. Cheras"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: Operations (dealer path only) ── */}
            {step === 3 && accountType === "dealership" && (
              <>
                <p className="ob-eyebrow">Step 03 / 04</p>
                <h1 className="ob-title">
                  How do you
                  <br />
                  operate?
                </h1>
                <p className="ob-subtitle">
                  Help us personalise ShiftOS for your scale. No judgment — we
                  work for everyone.
                </p>
                <div className="ob-fields">
                  <p className="pill-label">Current Fleet Size</p>
                  <div className="pills">
                    {FLEET_SIZES.map((f) => (
                      <Pill
                        key={f}
                        label={f}
                        active={fleetSize === f}
                        onClick={() => setFleetSize(f)}
                      />
                    ))}
                  </div>
                  <div className="ob-divider" />
                  <Input
                    label="WhatsApp Business Number"
                    value={whatsapp}
                    onChange={setWhatsapp}
                    placeholder="+60123456789"
                    hint="Used for customer enquiry routing (optional)"
                  />
                  <Input
                    label="Website / Social Link"
                    value={website}
                    onChange={setWebsite}
                    placeholder="https://facebook.com/yourdealer"
                    hint="Optional — helps complete your XDrive profile"
                  />
                </div>
              </>
            )}

            {/* ── STEP FINAL: Review & Activate ── */}
            {((step === 4 && accountType === "dealership") ||
              (step === 3 && accountType === "salesman")) && (
              <>
                <p className="ob-eyebrow">
                  Step {accountType === "salesman" ? "03 / 03" : "04 / 04"}
                </p>
                <h1 className="ob-title">
                  Ready to
                  <br />
                  activate.
                </h1>
                <p className="ob-subtitle">
                  Review your details, then hit activate to go live.
                </p>
                <div className="plan-badge">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--red)",
                      display: "inline-block",
                    }}
                  />
                  14-Day Free Trial
                </div>

                {/* Account type strip */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: `1px solid ${accountType === "salesman" ? "rgba(59,130,246,0.2)" : "rgba(220,38,38,0.15)"}`,
                    background:
                      accountType === "salesman"
                        ? "rgba(59,130,246,0.05)"
                        : "rgba(220,38,38,0.04)",
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 18 }}>
                    {accountType === "salesman" ? "🧑‍💼" : "🏢"}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: accountType === "salesman" ? "#93c5fd" : "#f87171",
                    }}
                  >
                    {accountType === "salesman"
                      ? "Sole Salesman"
                      : "Dealership"}
                  </span>
                </div>

                <div className="review-card">
                  <div className="review-card-header">
                    <span />
                    Identity
                  </div>
                  <div className="review-row">
                    <span className="review-key">Name</span>
                    <span className="review-val">{fullName}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Phone</span>
                    <span className="review-val">{phone}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Email</span>
                    <span className="review-val">{userEmail}</span>
                  </div>
                </div>

                {accountType === "dealership" && (
                  <>
                    <div className="review-card">
                      <div className="review-card-header">
                        <span />
                        Dealership
                      </div>
                      <div className="review-row">
                        <span className="review-key">Name</span>
                        <span className="review-val">{dealerName}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-key">Type</span>
                        <span className="review-val">{dealerType}</span>
                      </div>
                      <div className="review-row">
                        <span className="review-key">Location</span>
                        <span className="review-val">
                          {city ? `${city}, ${state}` : state}
                        </span>
                      </div>
                      <div className="review-row">
                        <span className="review-key">XDrive URL</span>
                        <span
                          className="review-val"
                          style={{ color: "#f87171" }}
                        >
                          {subdomain}.xdrive.my
                        </span>
                      </div>
                    </div>
                    <div className="review-card">
                      <div className="review-card-header">
                        <span />
                        Operations
                      </div>
                      <div className="review-row">
                        <span className="review-key">Fleet Size</span>
                        <span className="review-val">{fleetSize}</span>
                      </div>
                      {whatsapp !== "+60" && (
                        <div className="review-row">
                          <span className="review-key">WhatsApp</span>
                          <span className="review-val">{whatsapp}</span>
                        </div>
                      )}
                      {website && (
                        <div className="review-row">
                          <span className="review-key">Website</span>
                          <span className="review-val">{website}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {accountType === "salesman" && (
                  <div className="review-card">
                    <div className="review-card-header">
                      <span />
                      Profile
                    </div>
                    <div className="review-row">
                      <span className="review-key">Brand</span>
                      <span className="review-val">{salesmanBrand}</span>
                    </div>
                    <div className="review-row">
                      <span className="review-key">Location</span>
                      <span className="review-val">
                        {salesmanCity
                          ? `${salesmanCity}, ${salesmanState}`
                          : salesmanState}
                      </span>
                    </div>
                    <div className="review-row">
                      <span className="review-key">Profile URL</span>
                      <span className="review-val" style={{ color: "#93c5fd" }}>
                        xdrive.my/s/{salesmanSlug}
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="ob-error">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}
              </>
            )}

            {/* ── Navigation ── */}
            <div className="ob-actions">
              {step > 1 && (
                <button className="ob-btn-back" onClick={() => goTo(step - 1)}>
                  ← Back
                </button>
              )}
              {step < totalSteps ? (
                <button
                  className="ob-btn-primary"
                  disabled={!canProceed() || signupLoading}
                  onClick={() => {
                    if (step === 1 && !userId) {
                      handleSignup();
                    } else {
                      goTo(step + 1);
                    }
                  }}
                >
                  {signupLoading ? "Creating account…" : "Continue"}
                  {!signupLoading && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              ) : (
                <button
                  className="ob-btn-primary"
                  disabled={submitting}
                  onClick={handleSubmit}
                  style={
                    submitting
                      ? {}
                      : {
                          background: "var(--red)",
                          boxShadow: "0 0 40px rgba(220,38,38,0.35)",
                        }
                  }
                >
                  {submitting ? "Activating…" : "Activate ShiftOS"}
                  {!submitting && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
