import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const STATES = [
  "Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka",
  "Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya",
  "Sabah","Sarawak","Selangor","Terengganu",
];
const DEALERSHIP_TYPES = [
  "Independent Dealer","Franchise Dealer","Used Car Lot","Car Rental","Multi-Brand Showroom",
];
const FLEET_SIZES = ["1–5 cars","6–15 cars","16–30 cars","31–50 cars","50+ cars"];
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
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// ─── Components ────────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`ob-pill${active ? " ob-pill-on" : ""}`}>
      {label}
    </button>
  );
}

function OInput({ label, value, onChange, placeholder, type = "text", hint, children, style }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`oi${focused ? " oi-f" : ""}${value ? " oi-v" : ""}`} style={style}>
      <label className="oi-lbl">{label}</label>
      {children || (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="oi-inp"
          autoComplete="off"
        />
      )}
      <div className="oi-line" />
      {hint && <p className="oi-hint">{hint}</p>}
    </div>
  );
}

function OSelect({ label, value, onChange, options }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`oi${focused ? " oi-f" : ""}${value ? " oi-v" : ""}`}>
      <label className="oi-lbl">{label}</label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="oi-inp oi-sel"
        >
          <option value="">— select —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg style={{ position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",color:"rgba(200,210,230,0.3)",pointerEvents:"none" }}
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div className="oi-line" />
    </div>
  );
}

function TypeCard({ type, title, subtitle, bullets, active, onClick }) {
  const isDealer = type === "dealership";
  const acc = isDealer ? "#dc2626" : "#3b82f6";
  const cls = active ? (isDealer ? " tc-red" : " tc-blue") : "";
  return (
    <button type="button" onClick={onClick} className={`ob-tc${cls}`}>
      <div className="ob-tc-bar" style={{ background: active ? acc : "rgba(255,255,255,0.07)" }} />
      <div className="ob-tc-icon" style={{ color: active ? acc : "rgba(200,210,230,0.2)" }}>
        {isDealer ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div className="ob-tc-title" style={{ color: active ? "#E8EDF5" : "rgba(200,210,230,0.45)" }}>{title}</div>
        <div className="ob-tc-sub">{subtitle}</div>
        <ul className="ob-tc-ul">
          {bullets.map((b, i) => (
            <li key={i}>
              <span style={{ color: active ? acc : "rgba(255,255,255,0.15)", marginRight: 6 }}>—</span>
              <span style={{ color: active ? "rgba(200,210,230,0.45)" : "rgba(200,210,230,0.2)" }}>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ob-tc-check" style={{ borderColor: active ? acc : "rgba(255,255,255,0.1)", background: active ? acc : "transparent" }}>
        {active && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
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
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [accountType, setAccountType] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+60");
  const [ic, setIc] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [dealerType, setDealerType] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [ssmNumber, setSsmNumber] = useState("");
  const subdomainTouched = useRef(false);
  const [salesmanBrand, setSalesmanBrand] = useState("");
  const [salesmanState, setSalesmanState] = useState("");
  const [salesmanCity, setSalesmanCity] = useState("");
  const [salesmanSlug, setSalesmanSlug] = useState("");
  const salesmanSlugTouched = useRef(false);
  const [fleetSize, setFleetSize] = useState("");
  const [whatsapp, setWhatsapp] = useState("+60");
  const [website, setWebsite] = useState("");
  const [profileData, setProfileData] = useState(null);

  const STEPS = accountType === "salesman" ? STEPS_SALESMAN : STEPS_DEALER;
  const totalSteps = STEPS.length;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setAuthReady(true); return; }
      const uid = data.session.user.id;
      setUserId(uid);
      setUserEmail(data.session.user.email);
      setEmailConfirmed(!!data.session.user.email_confirmed_at);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (!profile) { setAuthReady(true); return; }
      setProfileData(profile);
      if (profile.role === "dealer" || profile.role === "superadmin") setAccountType("dealership");
      else if (profile.role === "salesman") setAccountType("salesman");
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.phone) setPhone(profile.phone);
      if (profile.dealership) setDealerName(profile.dealership);
      if (profile.subdomain) { setSubdomain(profile.subdomain); subdomainTouched.current = true; }
      if (profile.location) {
        const loc = profile.location;
        const ms = STATES.find((s) => loc.includes(s));
        if (ms) { setState(ms); const c = loc.replace(ms,"").replace(/^,\s*/,"").replace(/,\s*$/,"").trim(); if (c) setCity(c); }
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (subdomainTouched.current) return;
    setSubdomain(dealerName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20));
  }, [dealerName]);

  useEffect(() => {
    if (salesmanSlugTouched.current) return;
    setSalesmanSlug(fullName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20));
  }, [fullName]);

  const handleSignup = async () => {
    setSignupError("");
    if (!signupEmail.trim()) { setSignupError("Email is required."); return; }
    if (!STRONG_PASSWORD_REGEX.test(signupPassword)) { setSignupError("Password needs 8+ chars with uppercase, lowercase, number, and special character."); return; }
    if (signupPassword !== signupConfirm) { setSignupError("Passwords do not match."); return; }
    setSignupLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (err) { setSignupError(err.message); setSignupLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id, email: signupEmail.trim(),
        full_name: fullName.trim() || null,
        phone: phone !== "+60" ? phone : null,
        role: accountType === "salesman" ? "salesman" : "dealer",
        is_active: true, onboarding_complete: false,
      });
      setUserId(data.user.id); setUserEmail(signupEmail.trim());
    }
    setSignupLoading(false);
    setConfirmSent(true);
  };

  const goTo = (next) => {
    setAnimDir(next > step ? "forward" : "back");
    setVisible(false);
    setTimeout(() => { setStep(next); setVisible(true); setError(""); }, 160);
  };

  const canProceed = () => {
    if (step === 1) {
      if (!accountType) return false;
      if (fullName.trim().length < 2 || phone.length < 10) return false;
      if (!userId) return signupEmail.trim().length > 0 && STRONG_PASSWORD_REGEX.test(signupPassword) && signupPassword === signupConfirm;
      return true;
    }
    if (accountType === "salesman") {
      if (step === 2) return !!(salesmanBrand.trim() && salesmanState && /^[a-z0-9]{3,20}$/.test(salesmanSlug));
    } else {
      if (step === 2) return !!(dealerName.trim() && dealerType && state && /^[a-z0-9]{3,20}$/.test(subdomain));
      if (step === 3) return !!fleetSize;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email_confirmed_at) { setError("Please verify your email before activating."); setSubmitting(false); return; }
    try {
      const isSalesman = accountType === "salesman";
      const payload = isSalesman ? {
        id: userId, email: signupEmail || userEmail, full_name: fullName.trim(), phone,
        role: "salesman", is_active: true, onboarding_complete: true,
        slug: salesmanSlug, dealership: salesmanBrand.trim(),
        location: salesmanCity ? `${salesmanCity}, ${salesmanState}` : salesmanState,
        ic: ic || null, ic_submitted: !!(ic && ic.length > 0),
        ic_deadline: ic ? null : new Date(Date.now() + 10*24*60*60*1000).toISOString(),
        selected_plan: profileData?.selected_plan || "standard",
      } : {
        id: userId, email: signupEmail || userEmail, full_name: fullName.trim(), phone,
        dealership: dealerName.trim(), location: city ? `${city}, ${state}` : state,
        role: "dealer", is_active: true, onboarding_complete: true,
        subdomain, ssm_number: ssmNumber || null,
        ic: ic || null, ic_submitted: !!(ic && ic.length > 0),
        ic_deadline: ic ? null : new Date(Date.now() + 10*24*60*60*1000).toISOString(),
        selected_plan: profileData?.selected_plan || "standard",
      };
      const { error: err } = await supabase.from("profiles").upsert(payload);
      if (err) throw err;
      setDone(true);
      setTimeout(() => navigate(isSalesman ? "/salesman-lite" : "/dashboard"), 2800);
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  const progress = ((step - 1) / (totalSteps - 1)) * 100;
  if (!authReady) return null;

  const isFinal = (step === 4 && accountType === "dealership") || (step === 3 && accountType === "salesman");
  const currentS = STEPS[step - 1] || STEPS[0];
  const accentColor = accountType === "salesman" ? "#3b82f6" : "#dc2626";

  // ── Confirm email screen ──────────────────────────────────────────────────
  if (confirmSent) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <div className="ob-confirm-root">
          <div className="ob-confirm-glow" />
          <div className="ob-confirm-card">
            <div className="ob-logo" style={{ marginBottom: 40 }}>
              <div className="ob-logo-mark"><BoltIcon /></div>
              <span className="ob-logo-text">SHIFTOS</span>
            </div>
            <div className="ob-confirm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <h2 className="ob-confirm-title">CHECK YOUR INBOX</h2>
            <p className="ob-confirm-body">Confirmation link sent to</p>
            <p className="ob-confirm-email">{signupEmail}</p>
            <p className="ob-confirm-hint">Click the link to activate your account, then sign in to continue setup.</p>
            {resendSent && <p style={{ fontSize: 12, color: "#4ade80", marginBottom: 16, textAlign:"center" }}>↺ Email resent!</p>}
            <button
              onClick={async () => { setResendLoading(true); setResendSent(false); await supabase.auth.resend({ type:"signup", email: signupEmail }); setResendLoading(false); setResendSent(true); }}
              disabled={resendLoading}
              className="ob-btn-ghost"
              style={{ width:"100%", marginBottom: 16 }}
            >
              {resendLoading ? "Sending…" : "Resend confirmation email"}
            </button>
            <a href="/login" className="ob-confirm-back">← Back to sign in</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* ── Done overlay ── */}
      {done && (
        <div className="ob-done">
          <div className="ob-done-grid" />
          <div className="ob-done-ring">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="ob-done-words">
            <div className="ob-done-w1">SYSTEM</div>
            <div className="ob-done-w2">ACTIVATED</div>
          </div>
          <p className="ob-done-sub">
            {accountType === "salesman" ? "Launching your salesman panel…" : "Launching your command center…"}
          </p>
          <div className="ob-done-dots"><span/><span/><span/></div>
        </div>
      )}

      <div className="ob-root">
        {/* ── Left Panel ── */}
        <aside className="ob-panel">
          <div className="ob-panel-top">
            <div className="ob-logo">
              <div className="ob-logo-mark"><BoltIcon /></div>
              <span className="ob-logo-text">SHIFTOS</span>
            </div>
            {accountType && (
              <div className="ob-type-tag" style={{
                borderColor: accentColor + "40",
                background: accentColor + "10",
                color: accentColor,
              }}>
                <span className="ob-type-dot" style={{ background: accentColor }} />
                {accountType === "salesman" ? "SOLE SALESMAN" : "DEALERSHIP"}
              </div>
            )}
          </div>

          <div className="ob-panel-display">
            <div className="ob-panel-mega">{currentS.code}</div>
            <div className="ob-panel-step-label">{currentS.label}</div>
            <div className="ob-panel-step-hint">{currentS.hint}</div>
          </div>

          <div className="ob-steps-list">
            {STEPS.map((s, i) => {
              const done_ = step > s.id;
              const active_ = step === s.id;
              return (
                <React.Fragment key={s.id}>
                  <div
                    className={`ob-si${active_ ? " ob-si-active" : ""}${done_ ? " ob-si-done" : ""}`}
                    onClick={() => done_ ? goTo(s.id) : undefined}
                    style={{ cursor: done_ ? "pointer" : "default" }}
                  >
                    <div className="ob-si-dot">
                      {done_ ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : active_ ? (
                        <div className="ob-si-pulse" style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}80` }} />
                      ) : null}
                    </div>
                    <div className="ob-si-code">{s.code}</div>
                    <div className="ob-si-name">{s.label}</div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`ob-si-line${done_ ? " ob-si-line-done" : ""}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="ob-panel-footer">
            <div className="ob-plan-chip">
              <span className="ob-plan-dot" />
              14-DAY FREE TRIAL
            </div>
            <p className="ob-plan-price">RM 500 / month after trial</p>
          </div>
        </aside>

        {/* ── Right Main ── */}
        <main className="ob-main">
          {/* Progress tape */}
          <div className="ob-tape">
            <div className="ob-tape-fill" style={{ width: `${progress}%`, background: accentColor, boxShadow: `0 0 16px ${accentColor}80` }} />
          </div>

          <div className={`ob-content${visible ? " ob-vis" : animDir === "forward" ? " ob-fwd" : " ob-bk"}`}>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="ob-step-body">
                <div className="ob-eyebrow">STEP 01 / {String(totalSteps).padStart(2,"0")}</div>
                <h1 className="ob-heading">Let's get<br/>you set up.</h1>
                <p className="ob-subtitle">First, tell us how you're using ShiftOS — then we'll personalise everything.</p>

                <div className="ob-section-lbl">I AM A</div>
                <div className="ob-tc-stack">
                  <TypeCard type="dealership" title="Dealership" subtitle="A business with a team of salesmen"
                    bullets={["Team management & roles","Multi-salesman dashboard","Dealership storefront on XDrive"]}
                    active={accountType === "dealership"} onClick={() => setAccountType("dealership")} />
                  <TypeCard type="salesman" title="Sole Salesman" subtitle="An individual selling independently"
                    bullets={["Personal public profile","Your own listing page","Lead tracking & enquiries"]}
                    active={accountType === "salesman"} onClick={() => setAccountType("salesman")} />
                </div>

                {accountType && (
                  <>
                    <div className="ob-divider" />
                    <div className="ob-fields">
                      <div className="ob-row">
                        <OInput label="Full Name" value={fullName} onChange={setFullName} placeholder="Ahmad bin Abdullah" />
                        <OInput label="Phone Number" value={phone} onChange={setPhone} placeholder="+60123456789" />
                      </div>
                      <OInput label="IC Number (MyKad)" value={ic} onChange={setIc} placeholder="901231-10-1234" hint="Optional now — required within 10 days or account is terminated." />
                      <div className="ob-divider" />
                      <OInput label="Email Address" value={signupEmail} onChange={setSignupEmail} placeholder="you@example.com" type="email" />
                      <div className={`oi${signupPassword ? " oi-v" : ""}`}>
                        <label className="oi-lbl">Password</label>
                        <div style={{ position:"relative" }}>
                          <input
                            type={showPw ? "text" : "password"}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="Min 8 characters"
                            className="oi-inp"
                            autoComplete="new-password"
                            style={{ paddingRight: 36 }}
                          />
                          <button type="button" onClick={() => setShowPw(p => !p)} className="ob-pw-toggle">
                            {showPw ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                        <div className="oi-line" />
                        {signupPassword && !STRONG_PASSWORD_REGEX.test(signupPassword) && (
                          <p className="oi-hint" style={{ color:"#f87171" }}>8+ chars with uppercase, lowercase, number, special character</p>
                        )}
                      </div>
                      <OInput label="Confirm Password" value={signupConfirm} onChange={setSignupConfirm} placeholder="Repeat password" type="password"
                        hint={signupConfirm && signupConfirm !== signupPassword ? "Passwords do not match" : undefined} />
                      {signupError && <div className="ob-err">⚠ {signupError}</div>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 2 DEALER ── */}
            {step === 2 && accountType === "dealership" && (
              <div className="ob-step-body">
                <div className="ob-eyebrow">STEP 02 / 04</div>
                <h1 className="ob-heading">Your<br/>dealership.</h1>
                <p className="ob-subtitle">This creates your ShiftOS workspace. Editable later in Settings.</p>
                <div className="ob-fields">
                  <OInput label="Dealership Name" value={dealerName} onChange={setDealerName} placeholder="Fast Track Auto Sdn Bhd" />
                  <div className={`oi${subdomain ? " oi-v" : ""}`}>
                    <label className="oi-lbl">Your XDrive URL</label>
                    <input className="oi-inp" value={subdomain} maxLength={20} placeholder="yourbrand"
                      onChange={(e) => { subdomainTouched.current = true; setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20)); }}
                      autoComplete="off" />
                    <div className="oi-line" />
                    {subdomain ? (
                      <div style={{ marginTop: 8, display:"flex", alignItems:"center", gap: 10 }}>
                        <div className="ob-url-chip">
                          <span className="ob-url-slug">{subdomain}</span>
                          <span className="ob-url-domain">.xdrive.my</span>
                        </div>
                        {!/^[a-z0-9]{3,20}$/.test(subdomain) && <span style={{ fontSize:11,color:"#f87171" }}>Min 3 chars</span>}
                      </div>
                    ) : <p className="oi-hint">Auto-filled from dealership name</p>}
                  </div>
                  <div className="ob-pill-group">
                    <div className="ob-section-lbl" style={{ marginBottom: 12 }}>Dealership Type</div>
                    <div className="ob-pills">
                      {DEALERSHIP_TYPES.map(t => <Pill key={t} label={t} active={dealerType===t} onClick={() => setDealerType(t)} />)}
                    </div>
                  </div>
                  <div className="ob-divider" />
                  <div className="ob-row">
                    <OSelect label="State" value={state} onChange={setState} options={STATES} />
                    <OInput label="City / Area" value={city} onChange={setCity} placeholder="e.g. Butterworth" />
                  </div>
                  <OInput label="SSM Number" value={ssmNumber} onChange={setSsmNumber} placeholder="e.g. 1234567-A" hint="Required within 10 days for full verification" />
                </div>
              </div>
            )}

            {/* ── STEP 2 SALESMAN ── */}
            {step === 2 && accountType === "salesman" && (
              <div className="ob-step-body">
                <div className="ob-eyebrow">STEP 02 / 03</div>
                <h1 className="ob-heading">Your public<br/>profile.</h1>
                <p className="ob-subtitle">Your personal salesman page on XDrive. Buyers see this when they enquire.</p>
                <div className="ob-fields">
                  <OInput label="Your Name / Brand" value={salesmanBrand} onChange={setSalesmanBrand} placeholder="Ahmad Motors" hint="Appears on your XDrive profile and listings" />
                  <div className={`oi${salesmanSlug ? " oi-v" : ""}`}>
                    <label className="oi-lbl">Your Profile URL</label>
                    <input className="oi-inp" value={salesmanSlug} maxLength={20} placeholder="yourname"
                      onChange={(e) => { salesmanSlugTouched.current = true; setSalesmanSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20)); }}
                      autoComplete="off" />
                    <div className="oi-line" />
                    {salesmanSlug ? (
                      <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:10 }}>
                        <div className="ob-url-chip ob-url-chip-blue">
                          <span className="ob-url-slug" style={{ color:"#93c5fd" }}>xdrive.my/s/</span>
                          <span className="ob-url-domain" style={{ borderColor:"rgba(59,130,246,0.2)" }}>{salesmanSlug}</span>
                        </div>
                        {!/^[a-z0-9]{3,20}$/.test(salesmanSlug) && <span style={{ fontSize:11,color:"#f87171" }}>Min 3 chars</span>}
                      </div>
                    ) : <p className="oi-hint">Auto-filled from your name</p>}
                  </div>
                  <div className="ob-divider" />
                  <div className="ob-row">
                    <OSelect label="State" value={salesmanState} onChange={setSalesmanState} options={STATES} />
                    <OInput label="City / Area" value={salesmanCity} onChange={setSalesmanCity} placeholder="e.g. Cheras" />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3 DEALER ── */}
            {step === 3 && accountType === "dealership" && (
              <div className="ob-step-body">
                <div className="ob-eyebrow">STEP 03 / 04</div>
                <h1 className="ob-heading">How do you<br/>operate?</h1>
                <p className="ob-subtitle">Helps us personalise ShiftOS for your scale. No judgment.</p>
                <div className="ob-fields">
                  <div className="ob-pill-group">
                    <div className="ob-section-lbl" style={{ marginBottom: 12 }}>Current Fleet Size</div>
                    <div className="ob-pills">
                      {FLEET_SIZES.map(f => <Pill key={f} label={f} active={fleetSize===f} onClick={() => setFleetSize(f)} />)}
                    </div>
                  </div>
                  <div className="ob-divider" />
                  <OInput label="WhatsApp Business Number" value={whatsapp} onChange={setWhatsapp} placeholder="+60123456789" hint="Used for customer enquiry routing (optional)" />
                  <OInput label="Website / Social Link" value={website} onChange={setWebsite} placeholder="https://facebook.com/yourdealer" hint="Optional — completes your XDrive profile" />
                </div>
              </div>
            )}

            {/* ── FINAL STEP ── */}
            {isFinal && (
              <div className="ob-step-body">
                <div className="ob-eyebrow">STEP {accountType === "salesman" ? "03 / 03" : "04 / 04"}</div>
                <h1 className="ob-heading">Ready to<br/>activate.</h1>
                <p className="ob-subtitle">Review your details, then launch your account.</p>

                <div className="ob-trial-chip">
                  <span className="ob-plan-dot" />
                  14-DAY FREE TRIAL — NO CARD REQUIRED
                </div>

                <div className="ob-review">
                  <div className="ob-review-header">
                    <span className="ob-review-dot" />IDENTITY
                  </div>
                  <ReviewRow k="Name" v={fullName} />
                  <ReviewRow k="Phone" v={phone} />
                  <ReviewRow k="Email" v={signupEmail || userEmail} />
                </div>

                {accountType === "dealership" && (
                  <>
                    <div className="ob-review">
                      <div className="ob-review-header"><span className="ob-review-dot" />DEALERSHIP</div>
                      <ReviewRow k="Name" v={dealerName} />
                      <ReviewRow k="Type" v={dealerType} />
                      <ReviewRow k="Location" v={city ? `${city}, ${state}` : state} />
                      <ReviewRow k="XDrive URL" v={`${subdomain}.xdrive.my`} accent="#dc2626" />
                    </div>
                    <div className="ob-review">
                      <div className="ob-review-header"><span className="ob-review-dot" />OPERATIONS</div>
                      <ReviewRow k="Fleet Size" v={fleetSize} />
                      {whatsapp !== "+60" && <ReviewRow k="WhatsApp" v={whatsapp} />}
                      {website && <ReviewRow k="Website" v={website} />}
                    </div>
                  </>
                )}
                {accountType === "salesman" && (
                  <div className="ob-review">
                    <div className="ob-review-header"><span className="ob-review-dot" style={{ background:"#3b82f6" }} />PROFILE</div>
                    <ReviewRow k="Brand" v={salesmanBrand} />
                    <ReviewRow k="Location" v={salesmanCity ? `${salesmanCity}, ${salesmanState}` : salesmanState} />
                    <ReviewRow k="Profile URL" v={`xdrive.my/s/${salesmanSlug}`} accent="#93c5fd" />
                  </div>
                )}
                {error && <div className="ob-err" style={{ marginTop: 16 }}>⚠ {error}</div>}
              </div>
            )}

            {/* ── Navigation ── */}
            <div className="ob-actions">
              {step > 1 && (
                <button className="ob-btn-back" onClick={() => goTo(step - 1)}>← BACK</button>
              )}
              {!isFinal ? (
                <button
                  className="ob-btn-primary"
                  disabled={!canProceed() || signupLoading}
                  onClick={() => { if (step === 1 && !userId) handleSignup(); else goTo(step + 1); }}
                >
                  <span>{signupLoading ? "CREATING ACCOUNT…" : "CONTINUE"}</span>
                  {!signupLoading && <ArrowIcon />}
                </button>
              ) : emailConfirmed ? (
                <button className="ob-btn-activate" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "ACTIVATING…" : "ACTIVATE NOW"}
                  {!submitting && <BoltIcon style={{ width:16, height:16 }} />}
                </button>
              ) : (
                <button className="ob-btn-verify" onClick={() => setConfirmSent(true)}>
                  VERIFY EMAIL FIRST
                  <MailIcon />
                </button>
              )}
            </div>

          </div>
        </main>
      </div>
    </>
  );
}

function ReviewRow({ k, v, accent }) {
  return (
    <div className="ob-rr">
      <span className="ob-rr-k">{k}</span>
      <span className="ob-rr-v" style={accent ? { color: accent } : {}}>{v}</span>
    </div>
  );
}

function BoltIcon({ style }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={style}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  );
}

// ─── CSS ────────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Azeret+Mono:wght@400;500;600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #070A12;
    --panel-bg: #090D18;
    --surface: #0E1420;
    --red: #dc2626;
    --red-d: rgba(220,38,38,0.12);
    --red-g: rgba(220,38,38,0.4);
    --text: #E8EDF5;
    --muted: rgba(232,237,245,0.38);
    --faint: rgba(232,237,245,0.05);
    --border: rgba(255,255,255,0.07);
  }
  html, body { background: var(--bg); }

  /* ── Root grid ── */
  .ob-root {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 320px 1fr;
    background-color: var(--bg);
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 44px 44px;
    font-family: 'DM Sans', sans-serif;
    position: relative;
  }
  .ob-root::before {
    content: '';
    position: fixed;
    top: -30%; left: -15%;
    width: 70%; height: 70%;
    background: radial-gradient(ellipse, rgba(220,38,38,0.07) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
    animation: orb 20s ease-in-out infinite alternate;
  }
  .ob-root::after {
    content: '';
    position: fixed;
    bottom: -20%; right: -10%;
    width: 50%; height: 50%;
    background: radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  @keyframes orb { from { transform: translate(0,0); } to { transform: translate(40px,30px); } }

  /* ── Left Panel ── */
  .ob-panel {
    position: relative; z-index: 2;
    background: var(--panel-bg);
    border-right: 1px solid rgba(220,38,38,0.13);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ob-panel::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 160px;
    background: linear-gradient(180deg, rgba(220,38,38,0.07) 0%, transparent 100%);
    pointer-events: none;
  }

  .ob-panel-top {
    padding: 36px 32px 0;
    position: relative; z-index: 1;
  }
  .ob-logo {
    display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
  }
  .ob-logo-mark {
    width: 30px; height: 30px;
    background: var(--red); border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 24px var(--red-g), 0 0 8px rgba(220,38,38,0.3);
    animation: logoP 3s ease-in-out infinite;
  }
  @keyframes logoP {
    0%,100% { box-shadow: 0 0 24px var(--red-g), 0 0 8px rgba(220,38,38,0.3); }
    50% { box-shadow: 0 0 40px rgba(220,38,38,0.7), 0 0 80px rgba(220,38,38,0.2); }
  }
  .ob-logo-text {
    font-family: 'Bebas Neue', cursive;
    font-size: 22px; letter-spacing: 5px;
    color: var(--text);
  }
  .ob-type-tag {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 12px; border-radius: 2px;
    border: 1px solid;
    font-family: 'Azeret Mono', monospace;
    font-size: 9px; font-weight: 600; letter-spacing: 2.5px;
  }
  .ob-type-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

  /* ── Panel mega display ── */
  .ob-panel-display {
    flex: 1;
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 0 32px 24px;
    position: relative;
    overflow: hidden;
  }
  .ob-panel-mega {
    position: absolute; bottom: 40px; left: 16px;
    font-family: 'Bebas Neue', cursive;
    font-size: clamp(100px, 12vw, 160px);
    line-height: 1; letter-spacing: -2px;
    color: rgba(220,38,38,0.055);
    pointer-events: none; user-select: none;
    transition: opacity 0.4s;
  }
  .ob-panel-step-label {
    font-family: 'Bebas Neue', cursive;
    font-size: 32px; letter-spacing: 4px;
    color: var(--text);
    position: relative; z-index: 1;
  }
  .ob-panel-step-hint {
    font-family: 'Azeret Mono', monospace;
    font-size: 11px; color: var(--muted); letter-spacing: 1px;
    margin-top: 4px; position: relative; z-index: 1;
  }

  /* ── Step indicators ── */
  .ob-steps-list {
    padding: 0 32px;
    position: relative; z-index: 1;
  }
  .ob-si {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 4px;
    transition: background 0.2s;
  }
  .ob-si.ob-si-done { cursor: pointer; }
  .ob-si.ob-si-done:hover { background: var(--faint); }
  .ob-si.ob-si-active { background: rgba(220,38,38,0.06); }
  .ob-si-dot {
    width: 16px; height: 16px; border-radius: 50%;
    border: 1.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.3s;
  }
  .ob-si.ob-si-active .ob-si-dot { border-color: var(--red); background: var(--red-d); box-shadow: 0 0 10px var(--red-g); }
  .ob-si.ob-si-done .ob-si-dot { border-color: rgba(34,197,94,0.5); background: rgba(34,197,94,0.1); }
  .ob-si-pulse { width: 6px; height: 6px; border-radius: 50%; }
  .ob-si-code {
    font-family: 'Azeret Mono', monospace; font-size: 9px;
    color: var(--muted); letter-spacing: 1px; flex-shrink: 0;
    width: 20px;
    transition: color 0.3s;
  }
  .ob-si.ob-si-active .ob-si-code { color: var(--red); }
  .ob-si.ob-si-done .ob-si-code { color: rgba(34,197,94,0.7); }
  .ob-si-name {
    font-family: 'Azeret Mono', monospace; font-size: 10px;
    letter-spacing: 2px; color: var(--muted); text-transform: uppercase;
    transition: color 0.3s;
  }
  .ob-si.ob-si-active .ob-si-name { color: var(--text); }
  .ob-si.ob-si-done .ob-si-name { color: rgba(200,210,230,0.4); }
  .ob-si-line {
    width: 1px; height: 20px; background: var(--border);
    margin-left: 43px;
    transition: background 0.4s;
  }
  .ob-si-line.ob-si-line-done { background: rgba(34,197,94,0.25); }

  /* ── Panel footer ── */
  .ob-panel-footer {
    padding: 20px 32px 32px;
    border-top: 1px solid var(--border);
    position: relative; z-index: 1;
  }
  .ob-plan-chip {
    display: inline-flex; align-items: center; gap: 7px;
    font-family: 'Azeret Mono', monospace; font-size: 9px; font-weight: 600;
    letter-spacing: 2.5px; color: rgba(220,38,38,0.8); margin-bottom: 8px;
  }
  .ob-plan-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--red); box-shadow: 0 0 6px var(--red-g); animation: dotP 2s ease-in-out infinite; }
  @keyframes dotP { 0%,100%{opacity:1}50%{opacity:0.4} }
  .ob-plan-price { font-size: 11px; color: rgba(232,237,245,0.2); }

  /* ── Right Main ── */
  .ob-main {
    position: relative; z-index: 2;
    display: flex; flex-direction: column;
    overflow-y: auto;
    padding: 72px 64px 48px;
  }

  /* Progress tape */
  .ob-tape {
    position: fixed; top: 0; left: 320px; right: 0; height: 2px;
    background: rgba(255,255,255,0.04); z-index: 50;
  }
  .ob-tape-fill { height: 100%; transition: width 0.5s cubic-bezier(0.4,0,0.2,1); }

  /* Content transitions */
  .ob-content { max-width: 540px; transition: opacity 0.15s ease, transform 0.15s ease; }
  .ob-vis    { opacity: 1; transform: translateX(0); }
  .ob-fwd    { opacity: 0; transform: translateX(28px); }
  .ob-bk     { opacity: 0; transform: translateX(-28px); }

  .ob-step-body { display: flex; flex-direction: column; }
  .ob-eyebrow {
    font-family: 'Azeret Mono', monospace; font-size: 10px; font-weight: 500;
    letter-spacing: 3px; color: var(--red); margin-bottom: 14px;
  }
  .ob-heading {
    font-family: 'Bebas Neue', cursive; font-size: clamp(52px, 6vw, 72px);
    line-height: 0.92; color: var(--text); letter-spacing: 1px; margin-bottom: 14px;
  }
  .ob-subtitle { font-size: 14px; color: var(--muted); line-height: 1.65; margin-bottom: 32px; }
  .ob-section-lbl {
    font-family: 'Azeret Mono', monospace; font-size: 9px; font-weight: 600;
    letter-spacing: 3px; color: var(--muted); margin-bottom: 14px;
  }

  /* ── TypeCards ── */
  .ob-tc-stack { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .ob-tc {
    width: 100%; display: flex; align-items: flex-start; gap: 14px;
    padding: 16px 18px; background: rgba(255,255,255,0.025);
    border: 1px solid var(--border); border-left: 3px solid transparent;
    cursor: pointer; text-align: left; transition: all 0.2s;
    position: relative;
  }
  .ob-tc:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); border-left-color: rgba(255,255,255,0.15); }
  .ob-tc.tc-red { background: rgba(220,38,38,0.05); border-color: rgba(220,38,38,0.22); border-left-color: #dc2626; box-shadow: inset 0 0 20px rgba(220,38,38,0.04); }
  .ob-tc.tc-blue { background: rgba(59,130,246,0.05); border-color: rgba(59,130,246,0.22); border-left-color: #3b82f6; box-shadow: inset 0 0 20px rgba(59,130,246,0.04); }
  .ob-tc-bar { display: none; }
  .ob-tc-icon { flex-shrink: 0; margin-top: 2px; transition: color 0.2s; }
  .ob-tc-title { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 14px; margin-bottom: 3px; transition: color 0.2s; }
  .ob-tc-sub { font-size: 12px; color: var(--muted); margin-bottom: 8px; line-height: 1.4; }
  .ob-tc-ul { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .ob-tc-ul li { font-size: 11px; display: flex; align-items: center; }
  .ob-tc-check {
    flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
    border: 1.5px solid; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; margin-left: auto;
  }

  /* ── Fields ── */
  .ob-fields { display: flex; flex-direction: column; gap: 6px; }
  .ob-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .ob-divider { height: 1px; background: var(--border); margin: 20px 0; }
  .ob-pill-group { margin-top: 8px; }
  .ob-pills { display: flex; flex-wrap: wrap; gap: 7px; }
  .ob-pill {
    padding: 8px 16px; border: 1px solid rgba(255,255,255,0.1);
    background: transparent; color: var(--muted);
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all 0.18s; border-radius: 2px;
  }
  .ob-pill:hover { border-color: rgba(220,38,38,0.4); color: var(--text); }
  .ob-pill-on { border-color: var(--red); background: var(--red-d); color: var(--text); box-shadow: 0 0 12px rgba(220,38,38,0.15); }

  /* ── Input (oi = onboarding input) ── */
  .oi { position: relative; padding-top: 22px; padding-bottom: 6px; }
  .oi-lbl {
    position: absolute; top: 0; left: 0;
    font-family: 'Azeret Mono', monospace; font-size: 9px; font-weight: 500;
    letter-spacing: 3px; text-transform: uppercase; color: rgba(232,237,245,0.28);
    transition: color 0.2s; pointer-events: none;
  }
  .oi.oi-f .oi-lbl { color: var(--red); }
  .oi.oi-v .oi-lbl { color: rgba(232,237,245,0.42); }
  .oi-inp {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding: 8px 0; color: var(--text);
    font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none;
    transition: border-color 0.2s; appearance: none; -webkit-appearance: none;
  }
  .oi-inp::placeholder { color: rgba(232,237,245,0.1); }
  .oi.oi-f .oi-inp { border-color: rgba(220,38,38,0.35); }
  .oi-inp option { background: #141a27; }
  .oi-sel { cursor: pointer; padding-right: 22px; }
  .oi-line {
    position: absolute; bottom: 6px; left: 0; height: 1px; width: 0;
    background: var(--red); box-shadow: 0 0 8px rgba(220,38,38,0.6);
    transition: width 0.32s cubic-bezier(0.4,0,0.2,1);
  }
  .oi.oi-f .oi-line { width: 100%; }
  .oi-hint { font-size: 11px; color: rgba(232,237,245,0.22); margin-top: 7px; line-height: 1.5; }

  /* URL chip */
  .ob-url-chip {
    display: inline-flex; align-items: center;
    background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.18);
    overflow: hidden;
    font-family: 'Azeret Mono', monospace; font-size: 11px;
  }
  .ob-url-slug { padding: 4px 9px; color: #f87171; }
  .ob-url-domain { padding: 4px 9px; color: rgba(255,255,255,0.22); border-left: 1px solid rgba(220,38,38,0.15); }

  /* Password toggle */
  .ob-pw-toggle {
    position: absolute; right: 0; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.22); display: flex; padding: 0;
    transition: color 0.2s;
  }
  .ob-pw-toggle:hover { color: rgba(255,255,255,0.5); }

  /* ── Review section ── */
  .ob-trial-chip {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; margin-bottom: 20px;
    background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2);
    font-family: 'Azeret Mono', monospace; font-size: 9px; font-weight: 600;
    letter-spacing: 2px; color: rgba(220,38,38,0.9);
  }
  .ob-review {
    background: var(--surface); border: 1px solid var(--border);
    margin-bottom: 12px; overflow: hidden;
  }
  .ob-review-header {
    padding: 11px 18px; border-bottom: 1px solid var(--border);
    font-family: 'Azeret Mono', monospace; font-size: 9px; font-weight: 600;
    letter-spacing: 2.5px; color: var(--muted);
    display: flex; align-items: center; gap: 8px;
  }
  .ob-review-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--red); flex-shrink: 0; }
  .ob-rr { display: grid; grid-template-columns: 120px 1fr; padding: 10px 18px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; gap: 12px; }
  .ob-rr:last-child { border-bottom: none; }
  .ob-rr-k { color: var(--muted); font-size: 12px; }
  .ob-rr-v { color: var(--text); font-weight: 500; word-break: break-all; }

  /* ── Error ── */
  .ob-err {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 14px; background: rgba(220,38,38,0.07);
    border: 1px solid rgba(220,38,38,0.2); color: #f87171;
    font-size: 12px; line-height: 1.5; margin-top: 8px;
  }

  /* ── Buttons ── */
  .ob-actions { display: flex; align-items: center; gap: 12px; margin-top: 36px; }
  .ob-btn-primary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 0 28px; height: 50px;
    background: var(--red); border: none; color: white;
    font-family: 'Bebas Neue', cursive; font-size: 15px; letter-spacing: 3px;
    cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s;
  }
  .ob-btn-primary::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    animation: shimmer 2.5s ease-in-out infinite;
  }
  .ob-btn-primary:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 0 32px rgba(220,38,38,0.45), 0 6px 20px rgba(0,0,0,0.4); transform: translateY(-1px); }
  .ob-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
  @keyframes shimmer { from{left:-100%} to{left:200%} }

  .ob-btn-activate {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
    height: 56px; background: var(--red); border: none; color: white;
    font-family: 'Bebas Neue', cursive; font-size: 18px; letter-spacing: 5px;
    cursor: pointer; position: relative; overflow: hidden; transition: all 0.25s;
    box-shadow: 0 0 0 0 rgba(220,38,38,0.4);
  }
  .ob-btn-activate::after { content:''; position:absolute; top:0; left:-100%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent); animation:shimmer 2s ease-in-out infinite; }
  .ob-btn-activate:hover:not(:disabled) { background: #b91c1c; box-shadow: 0 0 48px rgba(220,38,38,0.55), 0 8px 32px rgba(0,0,0,0.5); transform: translateY(-2px); }
  .ob-btn-activate:disabled { opacity: 0.4; cursor: not-allowed; }

  .ob-btn-verify {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
    height: 50px; background: rgba(180,83,9,0.12); border: 1px solid rgba(180,83,9,0.3);
    color: #fb923c; font-family: 'Bebas Neue', cursive; font-size: 15px; letter-spacing: 3px;
    cursor: pointer; transition: all 0.2s;
  }
  .ob-btn-verify:hover { background: rgba(180,83,9,0.2); border-color: rgba(180,83,9,0.5); }

  .ob-btn-back {
    padding: 0 18px; height: 50px; background: transparent;
    border: 1px solid var(--border); color: var(--muted);
    font-family: 'Bebas Neue', cursive; font-size: 14px; letter-spacing: 2px;
    cursor: pointer; transition: all 0.2s; flex-shrink: 0;
  }
  .ob-btn-back:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }

  .ob-btn-ghost {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 20px; background: rgba(220,38,38,0.07);
    border: 1px solid rgba(220,38,38,0.2); color: #f87171;
    font-family: 'Bebas Neue', cursive; font-size: 14px; letter-spacing: 2.5px;
    cursor: pointer; transition: all 0.2s;
  }
  .ob-btn-ghost:hover:not(:disabled) { background: rgba(220,38,38,0.13); }
  .ob-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Done screen ── */
  .ob-done {
    position: fixed; inset: 0; z-index: 200;
    background: var(--bg); display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 28px;
    animation: fadeIn 0.4s ease forwards;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .ob-done-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);
    background-size: 44px 44px;
  }
  .ob-done-ring {
    width: 96px; height: 96px; border-radius: 50%;
    border: 1.5px solid var(--red); display: flex; align-items: center; justify-content: center;
    position: relative; animation: ringP 2s ease-in-out infinite;
  }
  .ob-done-ring::before {
    content: ''; position: absolute; inset: -14px; border-radius: 50%;
    border: 1px solid rgba(220,38,38,0.18); animation: ringP 2s ease-in-out infinite 0.35s;
  }
  .ob-done-ring::after {
    content: ''; position: absolute; inset: -28px; border-radius: 50%;
    border: 1px solid rgba(220,38,38,0.07); animation: ringP 2s ease-in-out infinite 0.7s;
  }
  @keyframes ringP { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.3)}50%{box-shadow:0 0 0 16px rgba(220,38,38,0)} }
  .ob-done-words { text-align: center; }
  .ob-done-w1 {
    font-family: 'Bebas Neue', cursive; font-size: clamp(56px, 8vw, 88px);
    letter-spacing: 18px; color: rgba(220,38,38,0.18); line-height: 1;
    animation: wordUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.3s both;
  }
  .ob-done-w2 {
    font-family: 'Bebas Neue', cursive; font-size: clamp(56px, 8vw, 88px);
    letter-spacing: 6px; color: var(--text); line-height: 1;
    animation: wordUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.5s both;
  }
  @keyframes wordUp { from{opacity:0;transform:translateY(16px) skewX(-2deg)} to{opacity:1;transform:translateY(0) skewX(0)} }
  .ob-done-sub {
    font-family: 'Azeret Mono', monospace; font-size: 12px; letter-spacing: 1.5px;
    color: var(--muted); animation: wordUp 0.6s ease 0.8s both;
  }
  .ob-done-dots { display: flex; gap: 7px; animation: wordUp 0.5s ease 1s both; }
  .ob-done-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--red); animation: db 1.2s ease-in-out infinite; }
  .ob-done-dots span:nth-child(2){ animation-delay:0.15s }
  .ob-done-dots span:nth-child(3){ animation-delay:0.3s }
  @keyframes db { 0%,80%,100%{transform:scale(0.5);opacity:0.3}40%{transform:scale(1.3);opacity:1} }

  /* ── Confirm screen ── */
  .ob-confirm-root {
    min-height: 100vh; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    padding: 24px 16px; position: relative; overflow: hidden;
  }
  .ob-confirm-glow {
    position: fixed; top: -30%; left: 50%; transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(ellipse, rgba(220,38,38,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .ob-confirm-card {
    width: min(420px, 100%);
    background: var(--panel-bg); border: 1px solid var(--border);
    padding: 48px 40px; position: relative;
    display: flex; flex-direction: column; align-items: center;
  }
  .ob-confirm-icon {
    width: 64px; height: 64px;
    background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    margin-bottom: 24px;
    animation: logoP 3s ease-in-out infinite;
  }
  .ob-confirm-title {
    font-family: 'Bebas Neue', cursive; font-size: 36px; letter-spacing: 4px;
    color: var(--text); margin-bottom: 16px; text-align: center;
  }
  .ob-confirm-body { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  .ob-confirm-email { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 20px; word-break: break-all; text-align: center; }
  .ob-confirm-hint { font-size: 12px; color: rgba(232,237,245,0.2); line-height: 1.6; margin-bottom: 28px; text-align: center; }
  .ob-confirm-back { font-size: 12px; color: rgba(232,237,245,0.22); text-decoration: none; font-family: 'Azeret Mono', monospace; letter-spacing: 1px; }
  .ob-confirm-back:hover { color: rgba(232,237,245,0.5); }

  /* ── Mobile ── */
  @media (max-width: 860px) {
    .ob-root { grid-template-columns: 1fr; }
    .ob-panel { display: none; }
    .ob-tape { left: 0; }
    .ob-main { padding: 56px 24px 40px; }
    .ob-heading { font-size: 52px; }
    .ob-row { grid-template-columns: 1fr; gap: 0; }
    .ob-tc-stack { gap: 6px; }
    .ob-btn-activate, .ob-btn-primary { width: 100%; }
    .ob-confirm-card { padding: 36px 24px; }
  }
`;
