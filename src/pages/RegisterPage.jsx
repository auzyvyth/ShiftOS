import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { generateSubdomain } from '../utils/generateSubdomain';

const MALAYSIAN_STATES = [
  'Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka',
  'Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya',
  'Sabah','Sarawak','Selangor','Terengganu',
];
const BIZ_TYPES = ['Sole Proprietorship','Sdn Bhd','Partnership','Enterprise','Other'];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .reg-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 32px 16px 48px; background: #09090b; font-family: 'DM Sans', sans-serif; overflow-x: hidden; }
  .reg-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .reg-brand-icon { width: 30px; height: 30px; background: linear-gradient(135deg,#dc2626,#7c3aed); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: #fff; }
  .reg-brand-text { font-family: 'Bebas Neue', sans-serif; letter-spacing: 3px; font-size: 26px; color: #fff; }

  .reg-stepper { display: flex; align-items: center; gap: 0; margin-bottom: 28px; width: min(520px,100%); }
  .reg-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; position: relative; }
  .reg-step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; transition: all 0.25s; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.3); }
  .reg-step-dot.active { background: #dc2626; border-color: #dc2626; color: #fff; box-shadow: 0 0 14px rgba(220,38,38,0.45); }
  .reg-step-dot.done { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.45); color: #4ade80; }
  .reg-step-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.25); font-weight: 500; white-space: nowrap; }
  .reg-step-label.active { color: #f87171; }
  .reg-step-label.done { color: #4ade80; }
  .reg-step-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); margin-top: -16px; transition: background 0.3s; }
  .reg-step-line.done { background: rgba(34,197,94,0.35); }

  .reg-card { width: min(520px,100%); background: #111114; border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,0.5); opacity: 0; transform: translateY(14px); transition: opacity 0.45s ease, transform 0.45s ease; overflow: hidden; }
  .reg-card.mounted { opacity: 1; transform: translateY(0); }

  .reg-card-head { padding: 28px 32px 0; }
  .reg-card-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #dc2626; font-weight: 500; margin-bottom: 6px; }
  .reg-card-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: #fff; letter-spacing: 2px; line-height: 1; margin-bottom: 4px; }
  .reg-card-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 24px; line-height: 1.5; }

  .reg-body { padding: 0 32px; }
  .reg-foot { padding: 20px 32px 28px; }

  .rfield { margin-bottom: 16px; }
  .rfield label { display: block; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 7px; font-weight: 500; }
  .rfield input, .rfield select, .rfield textarea { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; padding: 11px 14px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s, background 0.2s; appearance: none; }
  .rfield select { cursor: pointer; padding-right: 34px; }
  .rfield select option { background: #1a1a1e; color: #fff; }
  .rfield textarea { resize: none; line-height: 1.5; }
  .rfield input::placeholder, .rfield textarea::placeholder { color: rgba(255,255,255,0.15); }
  .rfield input:focus, .rfield select:focus, .rfield textarea:focus { border-color: rgba(220,38,38,0.55); background: rgba(220,38,38,0.04); }
  .rfield-hint { margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.35); line-height: 1.4; }
  .rfield-hint.ok { color: #4ade80; } .rfield-hint.warn { color: #fbbf24; } .rfield-hint.bad { color: #f87171; }

  .rgrid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rsel-wrap { position: relative; }
  .rsel-arrow { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; color: rgba(255,255,255,0.3); }

  .subdomain-preview { margin-top: 8px; padding: 10px 14px; background: rgba(96,165,250,0.06); border: 1px solid rgba(96,165,250,0.18); border-radius: 8px; display: flex; align-items: center; gap: 8px; }
  .subdomain-preview-text { font-size: 12px; color: #93c5fd; font-weight: 500; }
  .subdomain-preview-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }

  .pw-wrap { position: relative; }
  .pw-wrap input { padding-right: 40px; }
  .pw-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.25); display: flex; padding: 0; transition: color 0.2s; }
  .pw-eye:hover { color: rgba(255,255,255,0.6); }
  .pw-strength { margin-top: 8px; display: flex; gap: 5px; }
  .pw-strength span { height: 4px; border-radius: 999px; flex: 1; background: rgba(255,255,255,0.1); transition: background 0.2s; }
  .pw-strength span.s1 { background: #f87171; }
  .pw-strength span.s2 { background: #fb923c; }
  .pw-strength span.s3 { background: #fbbf24; }
  .pw-strength span.s4 { background: #86efac; }
  .pw-strength span.s5 { background: #4ade80; }

  .logo-upload { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
  .logo-circle { width: 72px; height: 72px; border-radius: 14px; border: 2px dashed rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; cursor: pointer; background: rgba(255,255,255,0.03); overflow: hidden; flex-shrink: 0; transition: border-color 0.2s; }
  .logo-circle:hover { border-color: rgba(220,38,38,0.45); }
  .logo-circle img { width: 100%; height: 100%; object-fit: contain; }
  .logo-hint { font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.6; }
  .logo-hint strong { color: rgba(255,255,255,0.5); font-weight: 500; }

  .reg-error { background: rgba(220,38,38,0.09); border: 1px solid rgba(220,38,38,0.28); border-radius: 8px; padding: 10px 14px; color: #f87171; font-size: 12px; margin-bottom: 14px; }

  .btn-primary { width: 100%; padding: 14px; background: #dc2626; border: none; border-radius: 10px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 17px; letter-spacing: 2px; cursor: pointer; position: relative; overflow: hidden; transition: background 0.2s, transform 0.1s; margin-bottom: 10px; }
  .btn-primary:hover:not(:disabled) { background: #b91c1c; }
  .btn-primary:active:not(:disabled) { transform: scale(0.99); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-shimmer { position: absolute; top: 0; left: -80%; width: 50%; height: 100%; background: linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent); animation: shimmer 2.2s infinite; }
  @keyframes shimmer { from { left: -60%; } to { left: 130%; } }

  .btn-ghost { width: 100%; padding: 10px; background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: rgba(255,255,255,0.4); font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer; transition: all 0.2s; }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }

  .done-card { text-align: center; padding: 40px 32px 32px; }
  .done-icon { width: 64px; height: 64px; background: rgba(34,197,94,0.12); border: 2px solid rgba(34,197,94,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
  .done-title { font-family: 'Bebas Neue', sans-serif; font-size: 38px; color: #fff; letter-spacing: 2px; margin-bottom: 8px; }
  .done-sub { font-size: 14px; color: rgba(255,255,255,0.4); line-height: 1.6; margin-bottom: 24px; }
  .done-url-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; }
  .done-url-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .done-url { font-size: 15px; color: #60a5fa; font-weight: 600; word-break: break-all; }
  .done-copy-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.25); border-radius: 7px; padding: 6px 12px; color: #93c5fd; font-size: 12px; font-weight: 500; cursor: pointer; margin-top: 8px; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
  .done-copy-btn:hover { background: rgba(96,165,250,0.18); }

  .confetti-canvas { position: fixed; inset: 0; pointer-events: none; z-index: 0; }

  .progress-bar-wrap { height: 3px; background: rgba(255,255,255,0.06); border-radius: 0 0 0 0; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg,#dc2626,#f87171); border-radius: 0 0 0 0; transition: width 0.4s ease; }

  .loading-dots span { animation: blink 1.4s infinite both; font-size: 20px; }
  .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
  .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100% { opacity:0; } 40% { opacity:1; } }

  @media (max-width: 560px) {
    .reg-card-head, .reg-body, .reg-foot { padding-left: 20px; padding-right: 20px; }
    .rgrid2 { grid-template-columns: 1fr; }
    .reg-stepper { gap: 0; }
    .reg-step-label { font-size: 9px; }
    .reg-card-title { font-size: 30px; }
  }
`;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(1);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);

  // Step 1 — Account
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);

  // Step 2 — Business
  const [dealership, setDealership]   = useState('');
  const [bizType, setBizType]         = useState('');
  const [bizReg, setBizReg]           = useState('');
  const [myState, setMyState]         = useState('');
  const [city, setCity]               = useState('');
  const [postcode, setPostcode]       = useState('');
  const [whatsapp, setWhatsapp]       = useState('+60');
  const [subdomain, setSubdomain]     = useState('');
  const [subStatus, setSubStatus]     = useState(null); // null | 'checking' | 'available' | 'taken'

  // Step 3 — Storefront
  const [logoFile, setLogoFile]       = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [siteName, setSiteName]       = useState('');
  const [aboutText, setAboutText]     = useState('');

  const [userId, setUserId]           = useState(null);
  const logoRef   = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    document.title = 'Create Account · ShiftOS';
  }, []);

  // Confetti on step 4
  useEffect(() => {
    if (step !== 4 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const COLORS = ['#dc2626','#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#fff','#fb923c'];
    const pieces = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 300,
      w: 5 + Math.random() * 9, h: 3 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 2.5,
      vy: 2.5 + Math.random() * 2.8,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.12,
      opacity: 1,
    }));
    let raf;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let any = false;
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        if (p.y > canvas.height * 0.65) p.opacity = Math.max(0, p.opacity - 0.018);
        if (p.opacity > 0 && p.y < canvas.height) any = true;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (any) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  /* ── Subdomain helpers ─────────────────────────────────────────────────── */
  const checkSubdomain = async (name) => {
    const base = generateSubdomain(name);
    if (!base) return;
    setSubStatus('checking');
    const { data } = await supabase
      .from('profiles').select('id').eq('subdomain', base).maybeSingle();
    if (!data) { setSubdomain(base); setSubStatus('available'); return; }
    for (let i = 2; i <= 9; i++) {
      const attempt = `${base.slice(0, 18)}${i}`;
      const { data: d } = await supabase
        .from('profiles').select('id').eq('subdomain', attempt).maybeSingle();
      if (!d) { setSubdomain(attempt); setSubStatus('available'); return; }
    }
    setSubdomain(base); setSubStatus('taken');
  };

  /* ── Password strength ─────────────────────────────────────────────────── */
  const pwChecks = {
    len: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    num: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const pwScore = Object.values(pwChecks).filter(Boolean).length;
  const pwStrong = pwScore === 5;

  /* ── Step handlers ─────────────────────────────────────────────────────── */
  const handleStep1 = async () => {
    if (!email.trim())         { setError('Email is required.'); return; }
    if (!pwStrong)             { setError('Please use a stronger password (8+ chars, uppercase, lowercase, number, special char).'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);

    const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password });
    if (e) { setError(e.message); setLoading(false); return; }

    const uid = data.user?.id;
    if (!uid) { setError('Signup failed — please try again.'); setLoading(false); return; }
    setUserId(uid);

    if (!data.session) {
      // Email confirmation required
      setLoading(false);
      setError('');
      // Jump to a "check email" screen — re-use step 4 layout
      setStep('confirm_email');
      return;
    }

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    await supabase.from('profiles').upsert({
      id: uid, email: email.trim(), role: 'dealer',
      trial_ends_at: trialEnds.toISOString(),
      onboarding_complete: false,
    });

    setLoading(false);
    setStep(2);
  };

  const handleStep2 = async () => {
    if (!dealership.trim()) { setError('Dealership name is required.'); return; }
    if (!bizType)           { setError('Please select a business type.'); return; }
    if (!myState)           { setError('Please select your state.'); return; }
    if (whatsapp === '+60' || whatsapp.length < 10) { setError('Please enter a valid WhatsApp number.'); return; }
    if (subStatus === 'taken') { setError('Subdomain is taken. Please edit the subdomain field.'); return; }
    setError(''); setLoading(true);

    let finalSub = subdomain;
    if (!finalSub) {
      finalSub = generateSubdomain(dealership);
    }

    const { error: e } = await supabase.from('profiles').update({
      dealership: dealership.trim(),
      business_type: bizType,
      business_reg_number: bizReg.trim() || null,
      state: myState,
      city: city.trim() || null,
      postcode: postcode.trim() || null,
      whatsapp_number: whatsapp,
      subdomain: finalSub,
    }).eq('id', userId);

    if (e) { setError(e.message); setLoading(false); return; }
    setLoading(false);
    setStep(3);
  };

  const handleStep3 = async () => {
    setError(''); setLoading(true);

    let logoUrl = null;
    if (logoFile) {
      const ext  = logoFile.name.split('.').pop();
      const path = `${userId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, logoFile, { upsert: true });
      if (!upErr) {
        const { data: ud } = supabase.storage.from('avatars').getPublicUrl(path);
        logoUrl = ud.publicUrl;
      }
    }

    const updates = {
      site_name: siteName.trim() || dealership.trim() || undefined,
      about_text: aboutText.trim() || null,
    };
    if (logoUrl) updates.site_logo_url = logoUrl;

    await supabase.from('profiles').update(updates).eq('id', userId);
    setLoading(false);
    setStep(4);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const storefrontUrl = `https://${subdomain}.xdrive.my`;

  const handleCopy = () => {
    navigator.clipboard.writeText(storefrontUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoDashboard = () => {
    window.location.href = 'https://xdrive.my/dashboard';
  };

  /* ── Stepper helpers ───────────────────────────────────────────────────── */
  const numericStep = typeof step === 'number' ? step : 4;
  const stepLabels  = ['Account','Business','Storefront','Done'];
  const progressPct = Math.min(100, ((numericStep - 1) / 3) * 100);

  const StepDot = ({ n }) => {
    const s = numericStep > n ? 'done' : numericStep === n ? 'active' : '';
    return (
      <div className={`reg-step-dot ${s}`}>
        {numericStep > n
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          : n}
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{STYLES}</style>

      {step === 4 && <canvas ref={canvasRef} className="confetti-canvas" />}

      <div className="reg-root">
        {/* Brand */}
        <div className="reg-brand">
          <div className="reg-brand-icon">S</div>
          <span className="reg-brand-text">ShiftOS</span>
        </div>

        {/* Stepper */}
        {step !== 'confirm_email' && (
          <div className="reg-stepper">
            {stepLabels.map((lbl, i) => {
              const n = i + 1;
              const isActive = numericStep === n;
              const isDone   = numericStep > n;
              return (
                <React.Fragment key={n}>
                  {i > 0 && <div className={`reg-step-line ${numericStep > n ? 'done' : ''}`} />}
                  <div className="reg-step">
                    <StepDot n={n} />
                    <span className={`reg-step-label ${isActive ? 'active' : isDone ? 'done' : ''}`}>{lbl}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Card */}
        <div className={`reg-card ${mounted ? 'mounted' : ''}`} style={{ position: 'relative', zIndex: 1 }}>
          {/* Progress bar */}
          {step !== 4 && step !== 'confirm_email' && (
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          )}

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <form noValidate onSubmit={e => { e.preventDefault(); handleStep1(); }}>
              <div className="reg-card-head">
                <p className="reg-card-eyebrow">Step 1 of 3</p>
                <h2 className="reg-card-title">Create Account</h2>
                <p className="reg-card-sub">Start your 14-day free trial. No credit card needed.</p>
              </div>
              <div className="reg-body">
                <div className="rfield">
                  <label>Email Address</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="rfield">
                  <label>Password</label>
                  <div className="pw-wrap">
                    <input type={showPw ? 'text' : 'password'} placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
                    <button type="button" className="pw-eye" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                      {showPw
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="pw-strength">
                      {[1,2,3,4,5].map(l => (
                        <span key={l} className={pwScore >= l ? `s${pwScore}` : ''} />
                      ))}
                    </div>
                  )}
                  <p className="rfield-hint" style={{ marginTop: 5 }}>
                    8+ chars · uppercase · lowercase · number · special character
                  </p>
                </div>
                <div className="rfield">
                  <label>Confirm Password</label>
                  <input type="password" placeholder="Re-enter password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                  {confirm.length > 0 && (
                    <p className={`rfield-hint ${password === confirm ? 'ok' : 'bad'}`}>
                      {password === confirm ? '✓ Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
                </div>
                {error && <div className="reg-error">⚠ {error}</div>}
              </div>
              <div className="reg-foot">
                <button type="submit" className="btn-primary" disabled={loading}>
                  <div className="btn-shimmer" />
                  {loading ? <span className="loading-dots"><span>·</span><span>·</span><span>·</span></span> : 'CONTINUE →'}
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                  Already have an account?{' '}
                  <Link to="/login" style={{ color: '#f87171', textDecoration: 'none' }}>Sign in</Link>
                </p>
              </div>
            </form>
          )}

          {/* ── Step 2: Business Info ── */}
          {step === 2 && (
            <form noValidate onSubmit={e => { e.preventDefault(); handleStep2(); }}>
              <div className="reg-card-head">
                <p className="reg-card-eyebrow">Step 2 of 3</p>
                <h2 className="reg-card-title">Business Info</h2>
                <p className="reg-card-sub">Tell us about your dealership so we can set up your storefront.</p>
              </div>
              <div className="reg-body">
                <div className="rfield">
                  <label>Dealership Name *</label>
                  <input
                    type="text"
                    placeholder="Auto City Sdn Bhd"
                    value={dealership}
                    onChange={e => { setDealership(e.target.value); setSubStatus(null); }}
                    onBlur={() => checkSubdomain(dealership)}
                  />
                  {/* Subdomain preview */}
                  {subdomain && subStatus !== 'taken' && (
                    <div className="subdomain-preview">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                      <div>
                        <p className="subdomain-preview-label">Your storefront</p>
                        <p className="subdomain-preview-text">{subdomain}.xdrive.my</p>
                      </div>
                      {subStatus === 'available' && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', fontWeight: 600 }}>✓ Available</span>}
                    </div>
                  )}
                  {subStatus === 'checking' && <p className="rfield-hint">Checking availability...</p>}
                  {subStatus === 'taken' && <p className="rfield-hint bad">⚠ That subdomain is taken. Try a different dealership name.</p>}
                </div>

                {/* Editable subdomain */}
                {subdomain && (
                  <div className="rfield">
                    <label>Subdomain (editable)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={subdomain}
                        onChange={e => { setSubdomain(generateSubdomain(e.target.value)); setSubStatus(null); }}
                        onBlur={async () => {
                          if (!subdomain) return;
                          setSubStatus('checking');
                          const { data } = await supabase.from('profiles').select('id').eq('subdomain', subdomain).maybeSingle();
                          setSubStatus(data ? 'taken' : 'available');
                        }}
                        style={{ flex: 1 }}
                        maxLength={20}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>.xdrive.my</span>
                    </div>
                  </div>
                )}

                <div className="rgrid2">
                  <div className="rfield">
                    <label>Business Type *</label>
                    <div className="rsel-wrap">
                      <select value={bizType} onChange={e => setBizType(e.target.value)}>
                        <option value="">Select type...</option>
                        {BIZ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="rsel-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></span>
                    </div>
                  </div>
                  <div className="rfield">
                    <label>Business Reg. No.</label>
                    <input type="text" placeholder="Optional" value={bizReg} onChange={e => setBizReg(e.target.value)} />
                  </div>
                </div>

                <div className="rgrid2">
                  <div className="rfield">
                    <label>State *</label>
                    <div className="rsel-wrap">
                      <select value={myState} onChange={e => setMyState(e.target.value)}>
                        <option value="">Select state...</option>
                        {MALAYSIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="rsel-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></span>
                    </div>
                  </div>
                  <div className="rfield">
                    <label>City</label>
                    <input type="text" placeholder="Petaling Jaya" value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                </div>

                <div className="rgrid2">
                  <div className="rfield">
                    <label>Postcode</label>
                    <input type="text" placeholder="47500" value={postcode} onChange={e => setPostcode(e.target.value)} maxLength={10} />
                  </div>
                  <div className="rfield">
                    <label>WhatsApp Number *</label>
                    <div style={{ display:'flex', alignItems:'center', border:'1px solid rgba(255,255,255,0.12)', borderRadius:4, overflow:'hidden', background:'rgba(255,255,255,0.04)' }}>
                      <span style={{ padding:'12px 12px', color:'rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.03)', borderRight:'1px solid rgba(255,255,255,0.08)', fontSize:14, whiteSpace:'nowrap', flexShrink:0 }}>+60</span>
                      <input type="tel" placeholder="123456789"
                        value={(whatsapp||'').replace(/^\+?60/,'')}
                        onChange={e => setWhatsapp('+60'+e.target.value.replace(/\D/g,''))}
                        style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:14, padding:'12px 10px', fontFamily:'inherit' }} />
                    </div>
                  </div>
                </div>

                {error && <div className="reg-error">⚠ {error}</div>}
              </div>
              <div className="reg-foot">
                <button type="submit" className="btn-primary" disabled={loading}>
                  <div className="btn-shimmer" />
                  {loading ? <span className="loading-dots"><span>·</span><span>·</span><span>·</span></span> : 'CONTINUE →'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
              </div>
            </form>
          )}

          {/* ── Step 3: Storefront Setup ── */}
          {step === 3 && (
            <form noValidate onSubmit={e => { e.preventDefault(); handleStep3(); }}>
              <div className="reg-card-head">
                <p className="reg-card-eyebrow">Step 3 of 3</p>
                <h2 className="reg-card-title">Storefront Setup</h2>
                <p className="reg-card-sub">Customise your public-facing XDrive storefront.</p>
              </div>
              <div className="reg-body">
                {/* Logo upload */}
                <div className="logo-upload">
                  <div className="logo-circle" onClick={() => logoRef.current.click()}>
                    {logoPreview
                      ? <img src={logoPreview} alt="logo preview" />
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    }
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
                  <div className="logo-hint">
                    <strong>Dealership Logo</strong> (optional)<br />
                    PNG / JPG · max 2 MB · recommended 400×400
                  </div>
                </div>

                <div className="rfield">
                  <label>Storefront Display Name</label>
                  <input
                    type="text"
                    placeholder={dealership || 'Your dealership tagline'}
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                  />
                  <p className="rfield-hint">Shown as your site title. Defaults to dealership name.</p>
                </div>

                <div className="rfield">
                  <label>About Your Dealership</label>
                  <textarea
                    rows={4}
                    placeholder="Tell buyers a bit about your dealership — experience, specialties, location..."
                    value={aboutText}
                    onChange={e => setAboutText(e.target.value)}
                    maxLength={600}
                  />
                  <p className="rfield-hint">{aboutText.length}/600 characters</p>
                </div>

                {error && <div className="reg-error">⚠ {error}</div>}
              </div>
              <div className="reg-foot">
                <button type="submit" className="btn-primary" disabled={loading}>
                  <div className="btn-shimmer" />
                  {loading ? <span className="loading-dots"><span>·</span><span>·</span><span>·</span></span> : 'FINISH SETUP →'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
              </div>
            </form>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && (
            <div className="done-card">
              <div className="done-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="done-title">YOU'RE IN!</h2>
              <p className="done-sub">
                Your dealership storefront is live on XDrive.<br />
                Your 14-day free trial has started.
              </p>

              <div className="done-url-box">
                <p className="done-url-label">Your Storefront URL</p>
                <p className="done-url">{storefrontUrl}</p>
                <button className="done-copy-btn" onClick={handleCopy}>
                  {copied
                    ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                    : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy link</>
                  }
                </button>
              </div>

              <button className="btn-primary" onClick={handleGoDashboard} style={{ marginBottom: 0 }}>
                <div className="btn-shimmer" />
                GO TO DASHBOARD →
              </button>
            </div>
          )}

          {/* ── Email confirmation required ── */}
          {step === 'confirm_email' && (
            <div className="done-card">
              <div className="done-icon" style={{ background: 'rgba(96,165,250,0.1)', border: '2px solid rgba(96,165,250,0.3)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h2 className="done-title" style={{ fontSize: 32 }}>CHECK EMAIL</h2>
              <p className="done-sub">
                We sent a confirmation link to <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{email}</strong>.<br />
                Click the link to confirm your account, then sign in to complete setup.
              </p>
              <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginBottom: 0 }}>
                <div className="btn-shimmer" />
                GO TO LOGIN →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>
          ShiftOS · 14-day free trial · No credit card required
        </p>
      </div>
    </>
  );
}
