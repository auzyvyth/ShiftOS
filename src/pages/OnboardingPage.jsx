import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const STATES = [
  "Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka",
  "Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya",
  "Sabah","Sarawak","Selangor","Terengganu",
];
const DEALER_TYPES = [
  "Independent Dealer","Franchise Dealer","Used Car Lot",
  "Car Rental","Multi-Brand Showroom",
];
const FLEET = ["1–5 cars","6–15 cars","16–30 cars","31–50 cars","50+ cars"];
const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function buildStages(accountType, hasUser) {
  const s = [
    { id: "type",  field: "accountType", q: "I'm signing up as…",      type: "cards" },
    { id: "legal", field: "_legal",       q: "Terms & Privacy Consent", type: "legal" },
    { id: "name",  field: "fullName",     q: "What's your name?",       type: "text", ph: "Ahmad bin Abdullah" },
    { id: "phone", field: "phone",        q: "Your WhatsApp number?",   type: "tel",  ph: "+60123456789" },
    {
      id: "ic", field: "ic", q: "IC number (MyKad)?", type: "text",
      ph: "901231-10-1234", opt: true,
      hint: "Optional now — required within 10 days or account is terminated.",
    },
  ];
  if (!hasUser)
    s.push(
      { id: "email", field: "email",    q: "Email address?",      type: "email", ph: "you@example.com" },
      { id: "pw",    field: "password", q: "Create a password",   type: "pw",    ph: "Min 8 chars, mixed + symbol" },
      { id: "cpw",   field: "confirm",  q: "Confirm your password", type: "pw",  ph: "Repeat it" },
    );
  if (accountType === "dealership")
    s.push(
      { id: "dname",  field: "dealerName",  q: "Dealership name?",     type: "text",  ph: "Fast Track Auto Sdn Bhd" },
      { id: "dtype",  field: "dealerType",  q: "Type of dealership?",  type: "pills", options: DEALER_TYPES },
      { id: "dstate", field: "state",       q: "Which state?",          type: "sel",   options: STATES },
      { id: "dcity",  field: "city",        q: "City or area?",         type: "text",  ph: "e.g. Butterworth", opt: true },
      { id: "sub",    field: "subdomain",   q: "Your XDrive URL",       type: "sub",   ph: "yourbrand", hint: "Letters & numbers only · min 3 chars" },
      { id: "ssm",    field: "ssmNumber",   q: "SSM number?",           type: "text",  ph: "e.g. 1234567-A", opt: true, hint: "Required within 10 days for full verification." },
      { id: "fleet",  field: "fleetSize",   q: "Current fleet size?",   type: "pills", options: FLEET },
    );
  if (accountType === "salesman")
    s.push(
      { id: "sbrand", field: "salesmanBrand", q: "Your name or brand?", type: "text", ph: "Ahmad Motors", hint: "Appears on your XDrive profile and listings." },
      { id: "sslug",  field: "salesmanSlug",  q: "Your profile URL",    type: "slug", ph: "yourname", hint: "xdrive.my/s/yourname" },
      { id: "sstate", field: "salesmanState", q: "Which state?",         type: "sel",  options: STATES },
      { id: "scity",  field: "salesmanCity",  q: "City or area?",        type: "text", ph: "e.g. Cheras", opt: true },
    );
  s.push({ id: "review", q: "Ready to activate.", type: "review" });
  return s;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [dir, setDir] = useState("fwd");
  const [showPw, setShowPw] = useState(false);
  const [legalScrolled, setLegalScrolled] = useState(false);
  const inputRef = useRef(null);
  const legalRef = useRef(null);
  const subTouched = useRef(false);
  const slugTouched = useRef(false);

  const [v, setV] = useState({
    accountType: "", fullName: "", phone: "+60", ic: "",
    email: "", password: "", confirm: "",
    dealerName: "", dealerType: "", state: "", city: "",
    subdomain: "", ssmNumber: "", fleetSize: "",
    salesmanBrand: "", salesmanSlug: "", salesmanState: "", salesmanCity: "",
  });
  const upd = (k) => (val) => setV((p) => ({ ...p, [k]: val }));

  const stages = buildStages(v.accountType, !!userId);
  const si = Math.min(idx, stages.length - 1);
  const stage = stages[si];
  const val = v[stage.field] ?? "";
  const progress = stages.length > 1 ? (si / (stages.length - 1)) * 100 : 0;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setAuthReady(true); return; }
      const uid = data.session.user.id;
      setUserId(uid);
      setUserEmail(data.session.user.email);
      setEmailConfirmed(!!data.session.user.email_confirmed_at);
      const meta = data.session.user.user_metadata || {};
      const savedType = sessionStorage.getItem("ob_account_type");
      if (savedType) sessionStorage.removeItem("ob_account_type");
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (prof) {
        setProfileData(prof);
        const updates = {};
        if (prof.role === "dealer" || prof.role === "superadmin") updates.accountType = "dealership";
        else if (prof.role === "salesman") updates.accountType = "salesman";
        else if (savedType) updates.accountType = savedType;
        if (prof.full_name) updates.fullName = prof.full_name;
        else if (!v.fullName && (meta.full_name || meta.name)) updates.fullName = meta.full_name || meta.name;
        if (prof.phone) updates.phone = prof.phone;
        if (prof.dealership) updates.dealerName = prof.dealership;
        if (prof.subdomain) { updates.subdomain = prof.subdomain; subTouched.current = true; }
        if (prof.location) {
          const ms = STATES.find((s) => prof.location.includes(s));
          if (ms) {
            updates.state = ms;
            const c = prof.location.replace(ms, "").replace(/^,\s*/, "").trim();
            if (c) updates.city = c;
          }
        }
        if (Object.keys(updates).length) setV((p) => ({ ...p, ...updates }));
      } else {
        const updates = {};
        if (savedType) updates.accountType = savedType;
        if (meta.full_name || meta.name) updates.fullName = meta.full_name || meta.name;
        if (Object.keys(updates).length) setV((p) => ({ ...p, ...updates }));
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!subTouched.current)
      upd("subdomain")(v.dealerName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
  }, [v.dealerName]);

  useEffect(() => {
    if (!slugTouched.current)
      upd("salesmanSlug")(v.fullName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
  }, [v.fullName]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [si, animKey]);

  const handleLegalScroll = () => {
    if (legalScrolled) return;
    const el = legalRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setLegalScrolled(true);
  };

  const canAdvance = () => {
    if (loading) return false;
    if (stage.opt) return true;
    switch (stage.id) {
      case "type":   return !!v.accountType;
      case "legal":  return legalScrolled;
      case "name":   return v.fullName.trim().length >= 2;
      case "phone":  return v.phone.replace(/\D/g, "").length >= 9;
      case "email":  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email);
      case "pw":     return STRONG_PW.test(v.password);
      case "cpw":    return v.confirm === v.password && v.confirm.length > 0;
      case "dname":  return v.dealerName.trim().length >= 2;
      case "dtype":  return !!v.dealerType;
      case "dstate": return !!v.state;
      case "sub":    return /^[a-z0-9]{3,20}$/.test(v.subdomain);
      case "fleet":  return !!v.fleetSize;
      case "sbrand": return v.salesmanBrand.trim().length >= 2;
      case "sslug":  return /^[a-z0-9]{3,20}$/.test(v.salesmanSlug);
      case "sstate": return !!v.salesmanState;
      case "review": return !loading;
      default:       return true;
    }
  };

  const goNext = () => { setDir("fwd"); setAnimKey((k) => k + 1); setIdx((i) => Math.min(i + 1, stages.length - 1)); setError(""); };
  const goPrev = () => { if (si === 0) return; setDir("bk"); setAnimKey((k) => k + 1); setIdx((i) => i - 1); setError(""); };

  const advance = async () => {
    if (!canAdvance()) return;
    if (stage.id === "cpw") {
      setLoading(true); setError("");
      const { data, error: err } = await supabase.auth.signUp({
        email: v.email.trim(), password: v.password,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id, email: v.email.trim(),
          full_name: v.fullName.trim() || null,
          phone: v.phone !== "+60" ? v.phone : null,
          role: v.accountType === "salesman" ? "salesman" : "dealer",
          is_active: true, onboarding_complete: false,
        });
        setUserId(data.user.id); setUserEmail(v.email.trim());
      }
      setLoading(false); setConfirmSent(true); return;
    }
    if (stage.id === "review") {
      if (!userId) return;
      setLoading(true); setError("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email_confirmed_at) { setError("Please verify your email first."); setLoading(false); return; }
      try {
        const isS = v.accountType === "salesman";
        const payload = isS
          ? {
              id: userId, email: v.email || userEmail, full_name: v.fullName.trim(),
              phone: v.phone, role: "salesman", plan: "salesman_lite", dealer_id: null,
              is_active: true, onboarding_complete: true, slug: v.salesmanSlug,
              dealership: v.salesmanBrand.trim(),
              location: v.salesmanCity ? `${v.salesmanCity}, ${v.salesmanState}` : v.salesmanState,
              ic: v.ic || null, ic_submitted: !!v.ic,
              ic_deadline: v.ic ? null : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
              selected_plan: "salesman_free", pdpa_consent: true, pdpa_consent_at: new Date().toISOString(),
            }
          : {
              id: userId, email: v.email || userEmail, full_name: v.fullName.trim(),
              phone: v.phone, dealership: v.dealerName.trim(),
              location: v.city ? `${v.city}, ${v.state}` : v.state,
              role: "dealer", is_active: true, onboarding_complete: true,
              subdomain: v.subdomain, ssm_number: v.ssmNumber || null,
              ic: v.ic || null, ic_submitted: !!v.ic,
              ic_deadline: v.ic ? null : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
              selected_plan: "standard", pdpa_consent: true, pdpa_consent_at: new Date().toISOString(),
            };
        const { error: err } = await supabase.from("profiles").upsert(payload);
        if (err) throw err;
        setDone(true);
        setTimeout(() => navigate(isS ? "/salesman-lite" : "/dashboard"), 2600);
      } catch (e) { setError(e.message); setLoading(false); }
      return;
    }
    goNext();
  };

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !["cards","pills","sel","legal"].includes(stage.type)) {
        e.preventDefault();
        if (canAdvance()) advance();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const handleGoogleSignUp = async () => {
    if (v.accountType) sessionStorage.setItem("ob_account_type", v.accountType);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) setError(error.message);
  };

  const setField = (newVal) => {
    if (stage.id === "sub") {
      subTouched.current = true;
      upd("subdomain")(newVal.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
    } else if (stage.id === "sslug") {
      slugTouched.current = true;
      upd("salesmanSlug")(newVal.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
    } else upd(stage.field)(newVal);
  };

  if (!authReady) return null;

  if (confirmSent)
    return (
      <>
        <style>{CSS}</style>
        <div className="ob-root" style={{ justifyContent: "center", alignItems: "center", display: "flex" }}>
          <div style={{ width: "min(420px,90%)", textAlign: "center" }}>
            <div className="ob-logo" style={{ justifyContent: "center", marginBottom: 32 }}>
              <div className="ob-lm">⚡</div>
              <span className="ob-lt">SHIFTOS</span>
            </div>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 28 }}>✉</div>
            <h2 style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 40, letterSpacing: 3, color: "#E8EDF5", marginBottom: 12 }}>CHECK YOUR INBOX</h2>
            <p style={{ color: "rgba(232,237,245,0.4)", fontSize: 13, marginBottom: 6 }}>Confirmation link sent to</p>
            <p style={{ color: "#E8EDF5", fontWeight: 600, fontSize: 14, marginBottom: 24, wordBreak: "break-all" }}>{v.email}</p>
            <p style={{ color: "rgba(232,237,245,0.2)", fontSize: 12, lineHeight: 1.7, marginBottom: 28 }}>Click the link to activate your account, then sign in to continue setup.</p>
            {resendSent && <p style={{ color: "#4ade80", fontSize: 12, marginBottom: 12 }}>↺ Email resent!</p>}
            <button className="ob-btn-ghost" style={{ width: "100%", marginBottom: 14 }}
              onClick={async () => { setResendLoading(true); setResendSent(false); await supabase.auth.resend({ type: "signup", email: v.email }); setResendLoading(false); setResendSent(true); }}
              disabled={resendLoading}>
              {resendLoading ? "SENDING…" : "RESEND CONFIRMATION EMAIL"}
            </button>
            <a href="/login" style={{ fontSize: 12, color: "rgba(232,237,245,0.2)", textDecoration: "none", fontFamily: "'Azeret Mono',monospace" }}>← Back to sign in</a>
          </div>
        </div>
      </>
    );

  if (done)
    return (
      <>
        <style>{CSS}</style>
        <div className="ob-root" style={{ justifyContent: "center", alignItems: "center", display: "flex" }}>
          <div style={{ textAlign: "center" }}>
            <div className="ob-done-ring">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: "clamp(52px,8vw,88px)", letterSpacing: 4, color: "#E8EDF5", lineHeight: 1, marginTop: 24, animation: "wUp .6s ease both" }}>ACTIVATED</div>
            <p style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 12, color: "rgba(232,237,245,0.4)", marginTop: 14, letterSpacing: 1, animation: "wUp .6s ease .3s both" }}>
              {v.accountType === "salesman" ? "Launching salesman panel…" : "Launching your command center…"}
            </p>
          </div>
        </div>
      </>
    );

  const isAutoAdv = ["cards","pills","sel"].includes(stage.type);
  const isReview = stage.id === "review";
  const isLegal = stage.type === "legal";

  return (
    <>
      <style>{CSS}</style>
      <div className="ob-root">
        <div className="ob-tape">
          <div className="ob-tf" style={{ width: `${progress}%` }} />
        </div>

        <div className="ob-topbar">
          <div className="ob-logo">
            <div className="ob-lm">⚡</div>
            <span className="ob-lt">SHIFTOS</span>
          </div>
          <span className="ob-counter">{String(si + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}</span>
        </div>

        <div className={`ob-body${isLegal ? " ob-body-legal" : ""}`}>
          <div className="ob-stage" key={animKey} data-dir={dir}>
            <p className="ob-eyebrow">
              {stage.opt
                ? "OPTIONAL"
                : isReview
                  ? v.accountType === "salesman" ? "FREE FOREVER — NO CARD REQUIRED" : "14-DAY FREE TRIAL — NO CARD REQUIRED"
                  : isLegal
                    ? "PDPA 2010 COMPLIANCE — REQUIRED"
                    : stage.id === "type" ? "WELCOME" : "QUESTION"}
            </p>
            <h1 className="ob-q">{stage.q}</h1>

            {/* Legal scroll */}
            {isLegal && (
              <div className="ob-legal-wrap">
                <div className="ob-legal-scroll" ref={legalRef} onScroll={handleLegalScroll}>
                  <LegalContent />
                </div>
                {!legalScrolled
                  ? <p className="ob-legal-prompt">↓ Scroll to the bottom to accept and continue</p>
                  : <p className="ob-legal-done">✓ Agreements reviewed — you may continue</p>}
              </div>
            )}

            {/* Cards */}
            {stage.type === "cards" && (
              <div className="ob-cards">
                {[
                  { val: "dealership", label: "Dealership",    sub: "Full team dashboard · RM700/mo after trial" },
                  { val: "salesman",   label: "Sole Salesman", sub: "Free forever · No credit card needed" },
                ].map((c) => (
                  <button key={c.val} className={`ob-card${v.accountType === c.val ? " ob-card-on" : ""}`}
                    onClick={() => { upd("accountType")(c.val); setTimeout(() => goNext(), 220); }}>
                    <div className="ob-card-label">{c.label}</div>
                    <div className="ob-card-sub">{c.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Pills */}
            {stage.type === "pills" && (
              <div className="ob-pills">
                {stage.options.map((opt) => (
                  <button key={opt} className={`ob-pill${val === opt ? " ob-pill-on" : ""}`}
                    onClick={() => { upd(stage.field)(opt); setTimeout(() => goNext(), 200); }}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Select */}
            {stage.type === "sel" && (
              <div className="ob-inp-wrap">
                <select ref={inputRef} className="ob-inp ob-sel" value={val}
                  onChange={(e) => { const nv = e.target.value; upd(stage.field)(nv); if (nv) setTimeout(() => goNext(), 150); }}>
                  <option value="">— select state —</option>
                  {stage.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <svg className="ob-sel-arr" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            )}

            {/* Subdomain / slug */}
            {(stage.type === "sub" || stage.type === "slug") && (
              <div className="ob-inp-wrap">
                <div className="ob-url-row">
                  <span className="ob-url-pre">{stage.type === "sub" ? "xdrive.my /" : "xdrive.my/s /"}</span>
                  <input ref={inputRef} className="ob-inp ob-inp-url" value={val}
                    onChange={(e) => setField(e.target.value)} placeholder={stage.ph} autoComplete="off" />
                </div>
                {val && !/^[a-z0-9]{3,20}$/.test(val) && <p className="ob-verr">Min 3 chars · letters & numbers only</p>}
              </div>
            )}

            {/* Password */}
            {stage.type === "pw" && (
              <div className="ob-inp-wrap" style={{ position: "relative" }}>
                <input ref={inputRef} type={showPw ? "text" : "password"} className="ob-inp" value={val}
                  onChange={(e) => setField(e.target.value)} placeholder={stage.ph}
                  autoComplete={stage.id === "pw" ? "new-password" : "off"} />
                <button className="ob-eye" type="button" onClick={() => setShowPw((p) => !p)}>{showPw ? "◉" : "○"}</button>
                {stage.id === "pw" && val && !STRONG_PW.test(val) && <p className="ob-verr">8+ chars · uppercase · lowercase · number · special char</p>}
                {stage.id === "cpw" && val && val !== v.password && <p className="ob-verr">Passwords don't match</p>}
              </div>
            )}

            {/* Text / email / tel */}
            {["text","email","tel"].includes(stage.type) && (
              <div className="ob-inp-wrap">
                <input ref={inputRef} type={stage.type === "tel" ? "tel" : stage.type} className="ob-inp" value={val}
                  onChange={(e) => setField(e.target.value)} placeholder={stage.ph} autoComplete="off" />
              </div>
            )}
            {stage.id === "email" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 10, color: "rgba(232,237,245,0.25)", letterSpacing: "0.1em" }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
                <button type="button" onClick={handleGoogleSignUp}
                  style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#E8EDF5", fontFamily: "'DM Sans',sans-serif", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer" }}>
                  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
                    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.823-3.422-11.387-8.172l-6.516 5.022C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
                    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                  </svg>
                  Sign up with Google
                </button>
              </>
            )}

            {/* Review */}
            {isReview && (
              <div className="ob-review">
                <RR k="Name"  v_={v.fullName} />
                <RR k="Email" v_={v.email || userEmail} />
                <RR k="Phone" v_={v.phone} />
                {v.accountType === "dealership" && (
                  <>
                    <RR k="Dealership" v_={v.dealerName} />
                    <RR k="Type"       v_={v.dealerType} />
                    <RR k="Location"   v_={v.city ? `${v.city}, ${v.state}` : v.state} />
                    <RR k="XDrive URL" v_={`${v.subdomain}.xdrive.my`} accent="#f87171" />
                    <RR k="Fleet"      v_={v.fleetSize} />
                  </>
                )}
                {v.accountType === "salesman" && (
                  <>
                    <RR k="Brand"      v_={v.salesmanBrand} />
                    <RR k="Location"   v_={v.salesmanCity ? `${v.salesmanCity}, ${v.salesmanState}` : v.salesmanState} />
                    <RR k="Profile URL" v_={`xdrive.my/s/${v.salesmanSlug}`} accent="#93c5fd" />
                  </>
                )}
                <div className="ob-rr" style={{ background: "rgba(220,38,38,0.04)" }}>
                  <span className="ob-rr-k">PDPA</span>
                  <span className="ob-rr-v" style={{ color: "#4ade80", fontSize: 11 }}>✓ Consent recorded</span>
                </div>
              </div>
            )}

            {stage.hint && <p className="ob-hint">{stage.hint}</p>}
            {error && <p className="ob-err">⚠ {error}</p>}
          </div>
        </div>

        <div className="ob-bottom">
          <button className="ob-back" onClick={goPrev} disabled={si === 0}>← BACK</button>
          {!isAutoAdv && (
            isReview ? (
              emailConfirmed
                ? <button className="ob-btn-act" onClick={advance} disabled={loading}>{loading ? "ACTIVATING…" : "ACTIVATE NOW ⚡"}</button>
                : <button className="ob-btn-verify" onClick={() => setConfirmSent(true)}>VERIFY EMAIL FIRST ✉</button>
            ) : (
              <div className="ob-enter"
                style={{ opacity: canAdvance() ? 1 : 0.25, pointerEvents: canAdvance() ? "auto" : "none" }}
                onClick={advance}>
                <span>{stage.opt ? "SKIP OR CONTINUE" : isLegal ? "I AGREE — CONTINUE" : "CONTINUE"}</span>
                {!isLegal && <kbd>ENTER ↵</kbd>}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}

function RR({ k, v_, accent }) {
  if (!v_) return null;
  return (
    <div className="ob-rr">
      <span className="ob-rr-k">{k}</span>
      <span className="ob-rr-v" style={accent ? { color: accent } : {}}>{v_}</span>
    </div>
  );
}

function LegalSection({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 18, letterSpacing: 3, color: "#E8EDF5", borderBottom: "1px solid rgba(220,38,38,0.3)", paddingBottom: 6, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function LP({ children }) {
  return <p style={{ fontSize: 12, color: "rgba(232,237,245,0.55)", lineHeight: 1.75, marginBottom: 10 }}>{children}</p>;
}

function LH({ children }) {
  return <p style={{ fontSize: 11, fontFamily: "'Azeret Mono',monospace", color: "rgba(220,38,38,0.8)", letterSpacing: 1, marginTop: 14, marginBottom: 6 }}>{children}</p>;
}

function LegalContent() {
  return (
    <div style={{ padding: "0 2px" }}>

      {/* ── TERMS OF SERVICE ── */}
      <LegalSection title="TERMS OF SERVICE — ShiftOS / xdrive.my">
        <LP>Effective Date: 20 May 2026. These Terms govern your access to and use of the ShiftOS platform, including the XDrive dealer dashboard and the xdrive.my marketplace. By creating an account or using the Platform, you agree to be bound by these Terms.</LP>

        <LH>1. DEFINITIONS</LH>
        <LP>"ShiftOS" / "we" / "us" refers to the Platform operated by ShiftOS (operated by Airy, sole proprietor). "Dealer" refers to a subscribed business user. "Salesman" refers to a sub-user account linked to a Dealer. "User" refers to any person accessing the Platform. "Content" refers to vehicle listings, images, descriptions, and other data uploaded. "Customer Data" refers to buyer information, leads, enquiries and other data uploaded by Dealers.</LP>

        <LH>2. ACCOUNT REGISTRATION</LH>
        <LP>To access the dealer dashboard you must register and provide accurate, complete information. You agree to: provide truthful registration information including your name, IC number, and business details; maintain the security of your login credentials and not share them with unauthorised persons; notify us immediately of any unauthorised access; ensure your use complies with all applicable Malaysian laws and regulations. We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.</LP>

        <LH>3. SUBSCRIPTION PLANS AND PAYMENT</LH>
        <LP>Standard Plan: RM 1,000/month. Premium Plan: RM 2,500/month. Salesman Lite: Free (limited features, subject to fair use). All prices are in MYR and exclusive of applicable taxes. New dealer accounts receive a 14-day free trial with full platform access. No payment information is required during the trial. Subscriptions are billed monthly in advance. You may cancel at any time by contacting Auzyvyth@gmail.com. Cancellation takes effect at the end of the current billing period. No refunds for partial months. Data remains accessible for 30 days after cancellation before deletion.</LP>

        <LH>4. ACCEPTABLE USE</LH>
        <LP>You agree not to: upload fraudulent, stolen, or non-existent vehicle listings; misrepresent vehicle condition, mileage, ownership history, or specifications; collect or process customer data without appropriate consent; violate any applicable Malaysian law including the Road Transport Act 1987, Consumer Protection Act 1999, or PDPA 2010; attempt to circumvent, reverse engineer, or compromise the Platform's security; use the Platform to harass, defraud, or deceive any person; upload defamatory, obscene, or intellectual-property-infringing content. Violation may result in immediate account suspension without refund.</LP>

        <LH>5. YOUR CONTENT AND DATA</LH>
        <LP>You retain ownership of all Content and Customer Data you upload. By uploading Content, you grant ShiftOS a non-exclusive, royalty-free licence to store, display, and process that Content solely for providing the Platform services. You are the data controller for your customers' personal data and are responsible for: obtaining valid consent from customers before uploading their personal data; ensuring compliance with PDPA 2010; responding to customer data access and correction requests. ShiftOS acts as a data processor on your behalf. Vehicle listings marked "available" will be publicly visible on xdrive.my.</LP>

        <LH>6. PLATFORM AVAILABILITY</LH>
        <LP>We aim to maintain 99% uptime, excluding scheduled maintenance. We will provide advance notice of planned maintenance where possible. We are not liable for downtime caused by third-party infrastructure providers, force majeure events, or circumstances beyond our reasonable control.</LP>

        <LH>7. INTELLECTUAL PROPERTY</LH>
        <LP>ShiftOS, XDrive, xdrive.my and associated branding are the intellectual property of the Platform operator. You may not use our trademarks, logos or branding without prior written consent. The Platform software, design, and underlying technology remain our exclusive property.</LP>

        <LH>8. LIMITATION OF LIABILITY</LH>
        <LP>ShiftOS is a software tool. We are not a party to any vehicle sale transaction between a dealer and a buyer. We are not liable for any loss arising from vehicle transactions facilitated by the Platform. Our total aggregate liability for any claim shall not exceed the total subscription fees paid by you in the three months preceding the claim. We exclude liability for indirect, consequential, special or punitive damages of any kind.</LP>

        <LH>9. INDEMNIFICATION</LH>
        <LP>You agree to indemnify and hold harmless ShiftOS and its operators from any claims, damages, losses or expenses (including legal fees) arising from: (a) your use of the Platform in violation of these Terms; (b) your vehicle listings or customer data; (c) your violation of any applicable law; or (d) any dispute between you and a buyer or third party.</LP>

        <LH>10. TERMINATION</LH>
        <LP>We may suspend or terminate your account immediately if you: breach any provision of these Terms; fail to pay subscription fees within 14 days of the due date; engage in fraudulent, illegal, or abusive conduct. Upon termination, access ceases and data is retained for 30 days during which you may request an export, after which it will be permanently deleted.</LP>

        <LH>11. GOVERNING LAW</LH>
        <LP>These Terms are governed by the laws of Malaysia. Any dispute shall be subject to the exclusive jurisdiction of the courts of Malaysia.</LP>

        <LH>12. CHANGES TO THESE TERMS</LH>
        <LP>We may update these Terms from time to time with at least 14 days notice of material changes via in-app notification or email. Continued use after the effective date constitutes acceptance.</LP>

        <LH>13. CONTACT</LH>
        <LP>For questions regarding these Terms: Email: Auzyvyth@gmail.com · Website: https://xdrive.my</LP>
      </LegalSection>

      {/* ── PRIVACY POLICY ── */}
      <LegalSection title="PRIVACY POLICY — ShiftOS / xdrive.my">
        <LP>Effective Date: 20 May 2026. This Privacy Policy describes how ShiftOS collects, uses, stores, and protects personal data in connection with the ShiftOS platform and xdrive.my marketplace. Prepared in compliance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.</LP>

        <LH>1. WHO WE ARE</LH>
        <LP>ShiftOS (operated by Airy, sole proprietor) operates ShiftOS, a SaaS platform for independent used car dealerships in Malaysia, accessible at https://xdrive.my. For data protection enquiries: Auzyvyth@gmail.com.</LP>

        <LH>2. DATA WE COLLECT</LH>
        <LP>Dealer and Salesman accounts: full name, email address, phone number, IC (MyKad) number (for account verification), dealership name, SSM registration number, business address, profile photo, subdomain, and platform usage data.</LP>
        <LP>Customer Data uploaded by Dealers: buyer names, phone numbers, state of residence, lead and enquiry information, appointment and booking details, loan application data including IC numbers and employment details. ShiftOS processes this data on behalf of dealers. Dealers are the data controllers for their customers' data and are responsible for obtaining appropriate consent.</LP>
        <LP>Automatically collected data: analytics events (page views, WhatsApp clicks, car views — no cookies, session-based only), browser type, device information, IP address (not stored persistently), and error logs for debugging.</LP>

        <LH>3. HOW WE USE YOUR DATA</LH>
        <LP>To provide, maintain and improve the platform; to authenticate users and manage account access; to process and display vehicle listings on xdrive.my; to send in-app notifications and Telegram alerts; to generate reports, analytics and performance insights; to comply with legal obligations; to communicate service updates, billing information, and security notices. We do not use your data for advertising purposes. ShiftOS is ad-free.</LP>

        <LH>4. LEGAL BASIS FOR PROCESSING (PDPA 2010)</LH>
        <LP>Contractual necessity — to deliver subscribed services. Legitimate interests — to improve the platform and prevent fraud. Consent — for optional features such as Telegram notifications. Legal obligation — where required by Malaysian law.</LP>

        <LH>5. DATA SHARING</LH>
        <LP>We do not sell, rent or trade your personal data. We may share data with: Supabase Inc. (database and authentication infrastructure); Vercel Inc. (hosting and edge network); Telegram (if you opt in to notifications, your chat ID is used to deliver alerts); Malaysian regulatory authorities if required by law or court order. All third-party providers maintain appropriate security and confidentiality obligations.</LP>

        <LH>6. DATA RETENTION</LH>
        <LP>Account data: retained for the duration of your subscription plus 12 months after termination. Customer lead and enquiry data: retained as long as your dealer account is active. Analytics data: retained for 24 months on a rolling basis. Error logs: retained for 90 days. You may request deletion at any time by contacting Auzyvyth@gmail.com. Deletion requests will be actioned within 30 days, subject to legal retention obligations.</LP>

        <LH>7. DATA SECURITY</LH>
        <LP>We implement: Row Level Security (RLS) on all database tables; encrypted data transmission via HTTPS/TLS; access controls limiting data access to authorised roles only; regular security audits and policy reviews. No method of transmission or storage is 100% secure. You are responsible for maintaining the confidentiality of your login credentials.</LP>

        <LH>8. YOUR RIGHTS UNDER PDPA 2010</LH>
        <LP>As a data subject under the Personal Data Protection Act 2010, you have the right to: access the personal data we hold about you; correct inaccurate or incomplete personal data; withdraw consent for processing where consent is the legal basis; request deletion of your personal data (subject to legal obligations); object to processing for purposes beyond what you were informed of. To exercise these rights, contact Auzyvyth@gmail.com. We will respond within 21 days.</LP>

        <LH>9. COOKIES AND LOCAL STORAGE</LH>
        <LP>ShiftOS does not use third-party tracking cookies. We use browser localStorage to maintain your authenticated session while logged in. This data is cleared when you log out. We do not use advertising or analytics cookies.</LP>

        <LH>10. CHILDREN'S DATA</LH>
        <LP>ShiftOS is a business-to-business platform intended for use by persons aged 18 and above. We do not knowingly collect personal data from individuals under 18 years of age.</LP>

        <LH>11. CHANGES TO THIS POLICY</LH>
        <LP>We will notify registered dealers of material changes via in-app notification or email at least 14 days before changes take effect. Continued use of the platform after the effective date constitutes acceptance.</LP>

        <LH>12. CONTACT</LH>
        <LP>For questions, concerns or data access requests: Email: Auzyvyth@gmail.com · Website: https://xdrive.my</LP>
      </LegalSection>

      {/* ── DATA PROCESSING AGREEMENT ── */}
      <LegalSection title="DATA PROCESSING AGREEMENT — ShiftOS / xdrive.my">
        <LP>Effective Date: 20 May 2026. This DPA forms part of the Terms of Service between ShiftOS ("Processor") and the registered Dealer ("Controller") and governs the processing of personal data by ShiftOS on behalf of the Dealer. Prepared in accordance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.</LP>

        <LH>1. DEFINITIONS</LH>
        <LP>"Controller" means the Dealer who determines the purposes and means of processing Customer Data. "Processor" means ShiftOS, which processes Customer Data on behalf of the Controller. "Customer Data" means any personal data relating to the Controller's customers uploaded to the Platform. "Personal Data" has the meaning given under the PDPA 2010. "Processing" includes collecting, storing, organising, retrieving, disclosing, and deleting data. "Sub-processor" means any third party engaged by ShiftOS to assist in processing Customer Data.</LP>

        <LH>2. ROLES AND RESPONSIBILITIES</LH>
        <LP>Controller (Dealer) confirms that: it has a lawful basis for collecting and uploading Customer Data; it has provided customers with appropriate privacy notices; it has obtained necessary consents where required under PDPA 2010; it will only upload Customer Data that is accurate and relevant to its legitimate business activities; it will promptly action any customer data access, correction or deletion requests.</LP>
        <LP>ShiftOS (Processor) agrees to: process Customer Data only on documented instructions from the Controller; ensure that all staff with access to Customer Data are bound by confidentiality obligations; implement appropriate technical and organisational security measures; not engage sub-processors without informing the Controller and ensuring equivalent protections apply; assist the Controller in responding to data subject requests; notify the Controller without undue delay upon becoming aware of a personal data breach affecting Customer Data; delete or return all Customer Data upon termination of the subscription, at the Controller's request.</LP>

        <LH>3. SUB-PROCESSORS</LH>
        <LP>ShiftOS currently engages the following sub-processors: Supabase Inc. (USA) — database hosting, authentication, and file storage; Vercel Inc. (USA) — web hosting and edge delivery; Telegram Messenger Inc. — notification delivery (only where Dealer has enabled Telegram integration). ShiftOS will notify Dealers of any intended changes to sub-processors at least 14 days in advance, giving the Dealer the opportunity to object.</LP>

        <LH>4. DATA SECURITY</LH>
        <LP>ShiftOS implements and maintains: Row Level Security (RLS) ensuring each Dealer can only access their own Customer Data; encrypted transmission of all data via HTTPS/TLS; role-based access controls limiting data access within the Platform; regular security reviews and vulnerability assessments; secure deletion of data upon account termination.</LP>

        <LH>5. DATA BREACH NOTIFICATION</LH>
        <LP>In the event of a personal data breach affecting Customer Data, ShiftOS will: notify the affected Dealer within 72 hours of becoming aware of the breach; provide details of the nature of the breach, the data affected, and likely consequences; describe the measures taken or proposed to address the breach. The Dealer is responsible for determining whether notification to affected customers or the Personal Data Protection Commissioner is required under PDPA 2010.</LP>

        <LH>6. DATA SUBJECT RIGHTS</LH>
        <LP>Where a Dealer's customer exercises rights under PDPA 2010 (access, correction, deletion), ShiftOS will provide reasonable assistance to the Dealer in fulfilling those requests, including providing tools to export or delete specific customer records from the Platform.</LP>

        <LH>7. AUDITS</LH>
        <LP>The Dealer may request information from ShiftOS to verify compliance with this DPA not more than once per calendar year, with reasonable advance notice. ShiftOS will respond within 30 days.</LP>

        <LH>8. TERM AND TERMINATION</LH>
        <LP>This DPA remains in effect for the duration of the Dealer's subscription. Upon termination: ShiftOS will retain Customer Data for 30 days to allow the Dealer to export it; after 30 days, Customer Data will be permanently deleted from all active systems; backups containing Customer Data will be purged within 90 days of termination.</LP>

        <LH>9. GOVERNING LAW</LH>
        <LP>This DPA is governed by the laws of Malaysia. Any disputes shall be subject to the jurisdiction of the Malaysian courts.</LP>

        <LH>10. CONTACT FOR DATA PROTECTION MATTERS</LH>
        <LP>For any data protection queries or to exercise rights under this DPA, contact ShiftOS at Auzyvyth@gmail.com.</LP>

        <LP style={{ marginTop: 20, padding: "12px 14px", background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 2 }}>
          By scrolling to the bottom and clicking "I Agree — Continue", you confirm that you have read, understood, and agree to the Terms of Service, Privacy Policy, and Data Processing Agreement above. Your consent is recorded with a timestamp in compliance with the Personal Data Protection Act 2010 (Malaysia).
        </LP>
      </LegalSection>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Azeret+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#070A12;--red:#dc2626;--text:#E8EDF5;--muted:rgba(232,237,245,0.38);--border:rgba(255,255,255,0.07)}
html,body{background:var(--bg);height:100%}

.ob-root{
  height:100vh;overflow:hidden;display:flex;flex-direction:column;
  background:var(--bg);
  background-image:linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px);
  background-size:44px 44px;
  font-family:'DM Sans',sans-serif;
  position:relative;
}
.ob-root::before{
  content:'';position:fixed;top:-20%;left:-10%;width:55%;height:55%;
  background:radial-gradient(ellipse,rgba(220,38,38,0.08) 0%,transparent 65%);
  pointer-events:none;animation:orb 18s ease-in-out infinite alternate;
}
@keyframes orb{from{transform:translate(0,0)}to{transform:translate(40px,30px)}}

.ob-tape{position:absolute;top:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.04);z-index:10}
.ob-tf{height:100%;background:var(--red);box-shadow:0 0 14px rgba(220,38,38,0.7);transition:width .5s cubic-bezier(.4,0,.2,1)}

.ob-topbar{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;flex-shrink:0;position:relative;z-index:2}
.ob-logo{display:flex;align-items:center;gap:9px}
.ob-lm{width:28px;height:28px;background:var(--red);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 20px rgba(220,38,38,0.5);animation:lp 3s ease-in-out infinite}
@keyframes lp{0%,100%{box-shadow:0 0 20px rgba(220,38,38,0.5)}50%{box-shadow:0 0 36px rgba(220,38,38,0.8),0 0 60px rgba(220,38,38,0.2)}}
.ob-lt{font-family:'Bebas Neue',cursive;font-size:20px;letter-spacing:5px;color:var(--text)}
.ob-counter{font-family:'Azeret Mono',monospace;font-size:11px;letter-spacing:2px;color:var(--muted)}

.ob-body{flex:1;display:flex;align-items:center;justify-content:center;padding:0 40px;position:relative;z-index:2;overflow:hidden}
.ob-body-legal{align-items:flex-start;padding-top:0;overflow:visible}

.ob-stage{width:min(580px,100%)}
.ob-stage[data-dir="fwd"]{animation:sIn .22s ease both}
.ob-stage[data-dir="bk"]{animation:sInBk .22s ease both}
@keyframes sIn{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:translateX(0)}}
@keyframes sInBk{from{opacity:0;transform:translateX(-36px)}to{opacity:1;transform:translateX(0)}}

.ob-eyebrow{font-family:'Azeret Mono',monospace;font-size:9px;font-weight:500;letter-spacing:3.5px;color:var(--red);margin-bottom:12px}
.ob-q{font-family:'Bebas Neue',cursive;font-size:clamp(36px,5vw,58px);line-height:.95;color:var(--text);letter-spacing:1px;margin-bottom:16px}

/* ── Legal ── */
.ob-legal-wrap{display:flex;flex-direction:column;gap:8px}
.ob-legal-scroll{
  height:calc(100vh - 290px);
  overflow-y:scroll;
  border:1px solid rgba(255,255,255,0.07);
  background:rgba(255,255,255,0.015);
  padding:20px 18px;
  scroll-behavior:smooth;
}
.ob-legal-scroll::-webkit-scrollbar{width:4px}
.ob-legal-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,0.03)}
.ob-legal-scroll::-webkit-scrollbar-thumb{background:rgba(220,38,38,0.4);border-radius:2px}
.ob-legal-prompt{font-family:'Azeret Mono',monospace;font-size:10px;letter-spacing:1.5px;color:rgba(220,38,38,0.7);text-align:center;padding:8px 0;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
.ob-legal-done{font-family:'Azeret Mono',monospace;font-size:10px;letter-spacing:1.5px;color:#4ade80;text-align:center;padding:8px 0}

/* ── Cards ── */
.ob-cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.ob-card{flex:1;min-width:200px;padding:20px 22px;background:rgba(255,255,255,0.025);border:1px solid var(--border);border-left:3px solid transparent;text-align:left;cursor:pointer;transition:all .18s}
.ob-card:hover{background:rgba(255,255,255,0.05);border-left-color:rgba(255,255,255,0.2)}
.ob-card-on{background:rgba(220,38,38,0.06);border-color:rgba(220,38,38,0.3);border-left-color:var(--red);box-shadow:inset 0 0 20px rgba(220,38,38,0.04)}
.ob-card-label{font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:2px;color:var(--text);margin-bottom:4px}
.ob-card-sub{font-size:12px;color:var(--muted);line-height:1.4}

/* ── Pills ── */
.ob-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.ob-pill{padding:10px 18px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .16s}
.ob-pill:hover{border-color:rgba(220,38,38,0.4);color:var(--text)}
.ob-pill-on{border-color:var(--red);background:rgba(220,38,38,0.1);color:var(--text);box-shadow:0 0 12px rgba(220,38,38,0.15)}

/* ── Inputs ── */
.ob-inp-wrap{position:relative;margin-bottom:4px}
.ob-inp{
  width:100%;background:transparent;border:none;border-bottom:2px solid rgba(255,255,255,0.12);
  padding:10px 0;color:var(--text);font-family:'DM Sans',sans-serif;font-size:22px;font-weight:300;
  outline:none;transition:border-color .2s;appearance:none;-webkit-appearance:none;
}
.ob-inp::placeholder{color:rgba(232,237,245,0.12);font-weight:300}
.ob-inp:focus{border-color:var(--red);box-shadow:0 2px 0 0 rgba(220,38,38,0.3)}
.ob-sel{cursor:pointer;padding-right:28px;font-size:18px}
.ob-sel option{background:#0f1520}
.ob-sel-arr{position:absolute;right:4px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}

/* URL row */
.ob-url-row{display:flex;align-items:baseline;gap:0;border-bottom:2px solid rgba(255,255,255,0.12);transition:border-color .2s}
.ob-url-row:focus-within{border-color:var(--red);box-shadow:0 2px 0 0 rgba(220,38,38,0.3)}
.ob-url-pre{font-family:'Azeret Mono',monospace;font-size:15px;color:rgba(232,237,245,0.3);white-space:nowrap;padding-bottom:10px;padding-top:10px}
.ob-inp-url{border:none;box-shadow:none;font-size:22px;flex:1;padding-left:4px}
.ob-inp-url:focus{border:none;box-shadow:none}

/* Password */
.ob-eye{position:absolute;right:0;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.25);font-size:18px;padding:0;transition:color .2s}
.ob-eye:hover{color:rgba(255,255,255,0.6)}

/* Validation / hint */
.ob-verr{font-size:11px;color:#f87171;margin-top:8px;font-family:'Azeret Mono',monospace;letter-spacing:.5px}
.ob-hint{font-size:12px;color:rgba(232,237,245,0.2);margin-top:10px;line-height:1.6}
.ob-err{font-size:12px;color:#f87171;margin-top:12px;padding:10px 14px;background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.2)}

/* ── Review ── */
.ob-review{display:flex;flex-direction:column;gap:0;background:rgba(255,255,255,0.025);border:1px solid var(--border);margin-bottom:8px}
.ob-rr{display:grid;grid-template-columns:110px 1fr;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;gap:10px}
.ob-rr:last-child{border-bottom:none}
.ob-rr-k{color:var(--muted);font-size:11px;font-family:'Azeret Mono',monospace;letter-spacing:.5px;align-self:center}
.ob-rr-v{color:var(--text);font-weight:500;word-break:break-all}

/* ── Bottom bar ── */
.ob-bottom{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;flex-shrink:0;position:relative;z-index:2;border-top:1px solid var(--border)}
.ob-back{background:transparent;border:none;color:rgba(232,237,245,0.25);font-family:'Bebas Neue',cursive;font-size:13px;letter-spacing:2px;cursor:pointer;padding:0;transition:color .2s}
.ob-back:hover:not(:disabled){color:var(--muted)}
.ob-back:disabled{opacity:0;pointer-events:none}

.ob-enter{display:flex;align-items:center;gap:12px;cursor:pointer;transition:opacity .2s}
.ob-enter span{font-family:'Bebas Neue',cursive;font-size:15px;letter-spacing:3px;color:var(--text)}
kbd{display:inline-flex;align-items:center;padding:4px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-bottom:2px solid rgba(255,255,255,0.15);font-family:'Azeret Mono',monospace;font-size:10px;letter-spacing:1.5px;color:var(--muted);border-radius:2px}

.ob-btn-act{display:flex;align-items:center;gap:10px;padding:0 32px;height:50px;background:var(--red);border:none;color:#fff;font-family:'Bebas Neue',cursive;font-size:16px;letter-spacing:3px;cursor:pointer;position:relative;overflow:hidden;transition:all .2s}
.ob-btn-act::after{content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);animation:sh 2.5s ease-in-out infinite}
@keyframes sh{from{left:-100%}to{left:200%}}
.ob-btn-act:hover:not(:disabled){background:#b91c1c;box-shadow:0 0 32px rgba(220,38,38,0.5)}
.ob-btn-act:disabled{opacity:.4;cursor:not-allowed}

.ob-btn-verify{display:flex;align-items:center;gap:10px;padding:0 24px;height:48px;background:rgba(180,83,9,.1);border:1px solid rgba(180,83,9,.3);color:#fb923c;font-family:'Bebas Neue',cursive;font-size:14px;letter-spacing:2px;cursor:pointer;transition:all .2s}
.ob-btn-verify:hover{background:rgba(180,83,9,.2)}

.ob-btn-ghost{display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.2);color:#f87171;font-family:'Bebas Neue',cursive;font-size:13px;letter-spacing:2px;cursor:pointer;transition:all .2s}
.ob-btn-ghost:hover:not(:disabled){background:rgba(220,38,38,.13)}
.ob-btn-ghost:disabled{opacity:.4;cursor:not-allowed}

/* ── Done ── */
.ob-done-ring{width:88px;height:88px;border-radius:50%;border:1.5px solid var(--red);display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;animation:rp 2s ease-in-out infinite}
.ob-done-ring::before{content:'';position:absolute;inset:-14px;border-radius:50%;border:1px solid rgba(220,38,38,.18);animation:rp 2s ease-in-out infinite .35s}
@keyframes rp{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.35)}50%{box-shadow:0 0 0 14px rgba(220,38,38,0)}}
@keyframes wUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

@media(max-width:600px){
  .ob-topbar,.ob-bottom{padding:16px 20px}
  .ob-body{padding:0 20px}
  .ob-q{font-size:36px}
  .ob-inp{font-size:18px}
  .ob-cards{flex-direction:column}
  .ob-legal-scroll{height:calc(100vh - 260px)}
}
`;
