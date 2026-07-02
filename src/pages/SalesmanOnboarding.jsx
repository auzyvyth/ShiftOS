import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LegalContent from '../components/onboarding/LegalContent';
import PlanPickerModal from '../components/onboarding/PlanPickerModal';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.eo-root{display:flex;height:100vh;overflow:hidden;background:#070A12;font-family:'DM Sans',sans-serif;}
.eo-left{width:380px;min-width:380px;background:#0C1120;border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;padding:40px 36px;overflow-y:auto;flex-shrink:0;}
.eo-right{flex:1;min-width:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 48px;position:relative;}
.eo-logo{display:flex;align-items:center;gap:10px;margin-bottom:32px;}
.eo-logo-icon{width:30px;height:30px;background:#dc2626;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;font-family:'Bebas Neue',cursive;letter-spacing:1px;}
.eo-logo-text{font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:4px;color:#E8EDF5;}
.eo-plan-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.25);border-radius:4px;font-size:10px;letter-spacing:0.2em;color:rgba(220,38,38,0.9);text-transform:uppercase;margin-bottom:10px;width:fit-content;}
.eo-changeplan{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:6px 11px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.5);cursor:pointer;margin-bottom:32px;font-family:'DM Sans',sans-serif;transition:border-color 0.15s,color 0.15s;}
.eo-changeplan:hover{border-color:rgba(220,38,38,0.45);color:rgba(255,255,255,0.8);}
.eo-step-list{display:flex;flex-direction:column;gap:0;flex:1;}
.eo-step{display:flex;align-items:flex-start;gap:14px;position:relative;}
.eo-step:not(:last-child)::after{content:'';position:absolute;left:13px;top:30px;bottom:-4px;width:1px;background:rgba(255,255,255,0.06);}
.eo-step-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;transition:all 0.2s;}
.eo-dot-active{background:#dc2626;color:#fff;}
.eo-dot-done{background:rgba(220,38,38,0.12);color:#dc2626;border:1px solid rgba(220,38,38,0.3);}
.eo-dot-pending{background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.07);}
.eo-step-info{padding-bottom:24px;}
.eo-step-name{font-size:12px;font-weight:500;letter-spacing:0.06em;margin-bottom:2px;}
.eo-name-active{color:#E8EDF5;}
.eo-name-done{color:rgba(220,38,38,0.55);}
.eo-name-pending{color:rgba(255,255,255,0.18);}
.eo-step-sub{font-size:10px;color:rgba(255,255,255,0.18);letter-spacing:0.04em;}
.eo-features{margin-top:8px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.05);}
.eo-feature{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px;color:rgba(255,255,255,0.35);}
.eo-feature-dot{width:4px;height:4px;border-radius:50%;background:#dc2626;flex-shrink:0;opacity:0.6;}
.eo-trustline{margin-top:auto;padding-top:24px;font-size:10px;color:rgba(255,255,255,0.12);letter-spacing:0.1em;text-transform:uppercase;line-height:1.8;}
.eo-form{width:100%;max-width:480px;animation:eo-up 0.28s ease both;}
@keyframes eo-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.eo-eyebrow{font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(220,38,38,0.7);margin-bottom:10px;font-weight:500;}
.eo-heading{font-family:'Bebas Neue',cursive;font-size:clamp(30px,4vw,42px);letter-spacing:3px;color:#E8EDF5;line-height:1;margin-bottom:10px;}
.eo-sub{font-size:14px;color:rgba(255,255,255,0.32);line-height:1.65;margin-bottom:28px;}
.eo-label{display:block;font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:7px;margin-top:18px;}
.eo-inp{width:100%;height:48px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;color:#E8EDF5;font-family:'DM Sans',sans-serif;font-size:15px;padding:0 14px;outline:none;transition:border-color 0.15s,background 0.15s;}
.eo-inp:focus{border-color:rgba(220,38,38,0.45);background:rgba(255,255,255,0.055);}
.eo-inp::placeholder{color:rgba(255,255,255,0.18);}
.eo-select{width:100%;height:48px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;color:#E8EDF5;font-family:'DM Sans',sans-serif;font-size:15px;padding:0 14px;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;}
.eo-select:focus{border-color:rgba(220,38,38,0.45);}
.eo-btn{width:100%;height:48px;background:#dc2626;border:none;border-radius:8px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:background 0.15s,opacity 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:24px;}
.eo-btn:hover:not(:disabled){background:#ef4444;}
.eo-btn:disabled{opacity:0.35;cursor:not-allowed;}
.eo-ghost{width:100%;height:48px;background:transparent;border:1px solid rgba(255,255,255,0.09);border-radius:8px;color:rgba(255,255,255,0.45);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;transition:border-color 0.15s,color 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
.eo-ghost:hover:not(:disabled){border-color:rgba(255,255,255,0.18);color:rgba(255,255,255,0.65);}
.eo-ghost:disabled{opacity:0.3;cursor:not-allowed;}
.eo-divider{display:flex;align-items:center;gap:14px;margin:18px 0;color:rgba(255,255,255,0.15);font-size:10px;letter-spacing:0.12em;}
.eo-divider::before,.eo-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.07);}
.eo-otp-row{display:flex;gap:8px;margin-top:14px;}
.eo-otp-box{width:48px;height:56px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;color:#E8EDF5;font-size:22px;font-weight:600;text-align:center;outline:none;transition:border-color 0.15s;caret-color:#dc2626;}
.eo-otp-box:focus{border-color:#dc2626;background:rgba(220,38,38,0.05);}
.eo-legal-wrap{border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;margin-top:16px;height:320px;}
.eo-legal-scroll{flex:1;overflow-y:auto;padding:20px;scrollbar-width:thin;scrollbar-color:rgba(220,38,38,0.25) transparent;}
.eo-legal-foot{padding:10px 20px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);font-size:10px;color:rgba(255,255,255,0.28);letter-spacing:0.1em;text-transform:uppercase;}
.eo-legal-foot-ok{color:rgba(74,222,128,0.6);}
.eo-review-wrap{border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;margin:20px 0;}
.eo-review-row{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;border-bottom:1px solid rgba(255,255,255,0.05);}
.eo-review-row:last-child{border-bottom:none;}
.eo-review-key{font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:0.12em;text-transform:uppercase;}
.eo-review-val{font-size:13px;color:#E8EDF5;font-weight:500;max-width:60%;text-align:right;word-break:break-all;}
.eo-error{font-size:12px;color:#f87171;margin-top:12px;padding:10px 14px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.15);border-radius:6px;line-height:1.5;}
.eo-hint{font-size:12px;color:rgba(255,255,255,0.22);margin-top:7px;line-height:1.6;}
.eo-mobile-bar{display:none;justify-content:space-between;align-items:center;padding:0 0 28px;width:100%;max-width:480px;}
.eo-done-root{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#070A12;text-align:center;gap:0;}
.eo-done-ring{width:64px;height:64px;border-radius:50%;background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:28px;}
.eo-done-title{font-family:'Bebas Neue',cursive;font-size:clamp(52px,8vw,84px);letter-spacing:4px;color:#E8EDF5;line-height:1;margin-bottom:16px;}
.eo-done-sub{font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.2em;text-transform:uppercase;}
.eo-slug-status{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;letter-spacing:0.1em;}
.eo-slug-wrap{position:relative;}
.eo-resume-root{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#070A12;text-align:center;}
@media(max-width:820px){
  .eo-left{display:none;}
  .eo-right{padding:36px 20px;justify-content:flex-start;}
  .eo-mobile-bar{display:flex;}
}
`;

const STEPS = [
  { label: 'TERMS', sub: 'Required agreement' },
  { label: 'ACCOUNT', sub: 'Email or Google' },
  { label: 'IDENTITY', sub: 'IC verification' },
  { label: 'PHONE', sub: 'Contact number' },
  { label: 'PROFILE', sub: 'Your public page' },
  { label: 'ACTIVATE', sub: 'Go live' },
];

const TIERS = {
  lite: {
    label: 'SALESMAN LITE',
    price: 'FREE',
    features: [
      'Up to 10 active listings',
      'Auto-published to xdrive.my',
      'Direct WhatsApp enquiries',
      'Basic performance analytics',
      'No credit card required',
    ],
  },
  premium: {
    label: 'SALESMAN PREMIUM',
    price: 'RM 50 / mo',
    features: [
      'Unlimited listings',
      'Priority marketplace placement',
      'Full CRM + lead pipeline',
      'Commission tracking',
      'Advanced analytics',
      'Custom profile subdomain',
    ],
  },
};

const MY_STATES = [
  'Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka',
  'Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya',
  'Sabah','Sarawak','Selangor','Terengganu',
];

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
}

function normalizePhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('60')) return '+' + d;
  if (d.startsWith('0')) return '+6' + d;
  return '+60' + d;
}

function validateIC(ic) {
  return /^\d{12}$/.test(ic.replace(/-/g, ''));
}

function StepDot({ state, num }) {
  const cls = state === 'active' ? 'eo-dot-active' : state === 'done' ? 'eo-dot-done' : 'eo-dot-pending';
  return (
    <div className={`eo-step-dot ${cls}`}>
      {state === 'done' ? (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polyline points="1.5 5 3.8 7.5 8.5 2.5" />
        </svg>
      ) : (
        String(num).padStart(2, '0')
      )}
    </div>
  );
}

function LeftPanel({ step, tier, onChangePlan }) {
  const cfg = TIERS[tier] || TIERS.lite;
  return (
    <div className="eo-left">
      <div className="eo-logo">
        <div className="eo-logo-icon">X</div>
        <span className="eo-logo-text">SHIFTOS</span>
      </div>
      <div className="eo-plan-badge">{cfg.label} &mdash; {cfg.price}</div>
      <button type="button" className="eo-changeplan" onClick={onChangePlan}>Change plan</button>
      <div className="eo-step-list">
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'pending';
          return (
            <div key={i} className="eo-step">
              <StepDot state={state} num={i + 1} />
              <div className="eo-step-info">
                <div className={`eo-step-name eo-name-${state}`}>{s.label}</div>
                <div className="eo-step-sub">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="eo-features">
        {cfg.features.map((f, i) => (
          <div key={i} className="eo-feature">
            <div className="eo-feature-dot" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <div className="eo-trustline">
        PDPA 2010 compliant<br />256-bit TLS encryption<br />Malaysia
      </div>
    </div>
  );
}

export default function SalesmanOnboarding() {
  const navigate = useNavigate();
  const { tier: tierParam } = useParams();
  const tier = ['lite', 'premium'].includes(tierParam) ? tierParam : 'lite';

  const [step, setStep] = useState(0);
  const [showPlans, setShowPlans] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [legalScrolled, setLegalScrolled] = useState(false);
  const [showResumeChoice, setShowResumeChoice] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [done, setDone] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    fullName: '', icNumber: '',
    phone: '+60',
    brand: '', slug: '', state: '', city: '',
  });

  const legalRef = useRef(null);
  const slugTimer = useRef(null);

  const upd = (k) => (val) => setForm(p => ({ ...p, [k]: val }));

  // Mirror Supabase's password policy (8+ chars + one of each class) so users
  // never hit an opaque server-side rejection on sign-up.
  const pwChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'A lowercase letter (a-z)', ok: /[a-z]/.test(form.password) },
    { label: 'An uppercase letter (A-Z)', ok: /[A-Z]/.test(form.password) },
    { label: 'A number (0-9)', ok: /[0-9]/.test(form.password) },
    { label: 'A symbol (!@#$%…)', ok: /[^a-zA-Z0-9]/.test(form.password) },
  ];
  const pwValid = pwChecks.every(c => c.ok);
  const pwMatch = form.password.length > 0 && form.password === form.confirmPassword;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      setUserEmail(session.user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete, full_name, phone, ic_number, slug, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.onboarding_complete && profile?.role === 'salesman') {
        navigate('/salesman');
        return;
      }

      if (profile) {
        setForm(p => ({
          ...p,
          fullName: profile.full_name || p.fullName,
          icNumber: profile.ic_number || p.icNumber,
          phone: profile.phone || p.phone,
          slug: profile.slug || p.slug,
        }));
        setShowResumeChoice(true);
        return;
      }

      // Just completed OAuth — skip to identity (legal saved in sessionStorage)
      const agreed = sessionStorage.getItem('ob_agreed') === '1';
      setStep(agreed ? 2 : 0);
    };
    init();
  }, []);

  const handleLegalScroll = () => {
    const el = legalRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) setLegalScrolled(true);
  };

  const agreeLegal = () => {
    sessionStorage.setItem('ob_agreed', '1');
    setErr('');
    setStep(1);
  };

  const signInWithGoogle = async () => {
    sessionStorage.setItem('ob_plan_slug', tier);
    sessionStorage.setItem('ob_account_type', 'salesman');
    sessionStorage.setItem('ob_agreed', '1');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signUp = async () => {
    setErr('');
    if (!pwValid) { setErr('Password needs 8+ characters with an uppercase, lowercase, number and symbol.'); return; }
    if (form.password !== form.confirmPassword) { setErr('Passwords do not match.'); return; }
    setLoading(true);
    try {
      // Persist onboarding context so the post-confirmation callback (which runs
      // in a fresh page load, no React state) knows to resume salesman onboarding
      // instead of defaulting to the dealer flow.
      sessionStorage.setItem('ob_plan_slug', tier);
      sessionStorage.setItem('ob_account_type', 'salesman');
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        // Persist onboarding context on the ACCOUNT (user_metadata), not just
        // sessionStorage — so confirming the email on a different device still
        // resumes the correct (salesman) flow at the right tier.
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { account_type: 'salesman', tier },
        },
      });
      if (error) throw error;
      // Supabase returns a user with an empty identities array (and no error)
      // when the email is already registered — anti-enumeration. Detect it so we
      // don't silently advance into a broken signup.
      if (data?.user && (data.user.identities?.length ?? 0) === 0) {
        setErr('An account with this email already exists. Please log in instead.');
        return;
      }
      // Email confirmation is required — Supabase returns a user but no session,
      // so there's no JWT to write the profile row with yet. Wait for the click.
      if (data?.user && !data.session) {
        setUserEmail(data.user.email);
        setAwaitingConfirm(true);
        return;
      }
      if (data?.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email);
        setStep(2);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    setResendMsg('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: form.email });
      if (error) throw error;
      setResendMsg('Sent. Check your inbox (and spam folder).');
    } catch (e) {
      setResendMsg(e.message);
    }
  };

  const saveIdentity = async () => {
    setErr('');
    if (!form.fullName.trim()) { setErr('Full name is required'); return; }
    if (!validateIC(form.icNumber)) { setErr('Enter a valid 12-digit IC number (e.g. 901231-10-1234)'); return; }
    setLoading(true);
    try {
      if (userId) {
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: form.fullName.trim(),
          ic_number: form.icNumber.replace(/-/g, ''),
          role: 'salesman',
          onboarding_complete: false,
        }, { onConflict: 'id' });
        if (error) throw error;
      }
      setStep(3);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkSlug = async (slug) => {
    if (!slug || slug.length < 3) { setSlugTaken(false); return; }
    setSlugChecking(true);
    try {
      // SECURITY DEFINER RPC — profiles RLS hides other dealers' rows, so a plain
      // select would wrongly report every taken slug as available.
      const { data: available } = await supabase.rpc('is_slug_available', { p_slug: slug });
      setSlugTaken(available === false);
    } finally {
      setSlugChecking(false);
    }
  };

  const handleSlugChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    upd('slug')(clean);
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(() => checkSlug(clean), 450);
  };

  const activate = async () => {
    setErr('');
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: userEmail,
        full_name: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        ic_number: form.icNumber.replace(/-/g, ''),
        role: 'salesman',
        slug: form.slug,
        dealership: (form.brand || form.fullName).trim(),
        state: form.state || null,
        city: form.city || null,
        is_active: true,
        onboarding_complete: true,
        plan: tier === 'premium' ? 'salesman_full' : 'salesman_lite',
        pdpa_consent: true,
        pdpa_consent_at: new Date().toISOString(),
        ic_deadline: null,
      }, { onConflict: 'id' });
      if (error) throw error;
      sessionStorage.removeItem('ob_agreed');
      sessionStorage.removeItem('ob_plan_slug');
      sessionStorage.removeItem('ob_account_type');
      setDone(true);
      setTimeout(() => navigate('/salesman'), 2400);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAndStart = async () => {
    await supabase.auth.signOut();
    setShowResumeChoice(false);
    setUserId(null);
    setUserEmail('');
    setForm({ email: '', password: '', confirmPassword: '', fullName: '', icNumber: '', phone: '+60', brand: '', slug: '', state: '', city: '' });
    setStep(0);
  };

  if (showResumeChoice) return (
    <>
      <style>{CSS}</style>
      <div className="eo-resume-root">
        <div style={{ width: 'min(420px, 90%)', padding: '0 20px' }}>
          <div className="eo-logo" style={{ justifyContent: 'center', marginBottom: 32 }}>
            <div className="eo-logo-icon">X</div>
            <span className="eo-logo-text">SHIFTOS</span>
          </div>
          <p className="eo-eyebrow" style={{ textAlign: 'center', marginBottom: 20 }}>INCOMPLETE SIGN-UP FOUND</p>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 40, letterSpacing: 3, color: '#E8EDF5', marginBottom: 10, textAlign: 'center' }}>WELCOME BACK</div>
          <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, marginBottom: 4, textAlign: 'center' }}>You have an incomplete sign-up as</p>
          <p style={{ color: '#E8EDF5', fontWeight: 600, fontSize: 14, marginBottom: 36, textAlign: 'center', wordBreak: 'break-all' }}>{userEmail}</p>
          <button className="eo-btn" style={{ marginTop: 0 }} onClick={() => { setShowResumeChoice(false); setStep(2); }}>CONTINUE SIGN-UP</button>
          <button className="eo-ghost" onClick={resetAndStart}>USE A DIFFERENT ACCOUNT</button>
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            <a href="/login" style={{ color: 'rgba(220,38,38,0.5)', textDecoration: 'none' }}>Sign in to existing account</a>
          </p>
        </div>
      </div>
    </>
  );

  if (awaitingConfirm) return (
    <>
      <style>{CSS}</style>
      <div className="eo-resume-root">
        <div style={{ width: 'min(420px, 90%)', padding: '0 20px' }}>
          <div className="eo-logo" style={{ justifyContent: 'center', marginBottom: 32 }}>
            <div className="eo-logo-icon">X</div>
            <span className="eo-logo-text">SHIFTOS</span>
          </div>
          <p className="eo-eyebrow" style={{ textAlign: 'center', marginBottom: 20 }}>ONE MORE STEP</p>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 40, letterSpacing: 3, color: '#E8EDF5', marginBottom: 10, textAlign: 'center' }}>CHECK YOUR EMAIL</div>
          <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, marginBottom: 4, textAlign: 'center' }}>We sent a confirmation link to</p>
          <p style={{ color: '#E8EDF5', fontWeight: 600, fontSize: 14, marginBottom: 36, textAlign: 'center', wordBreak: 'break-all' }}>{userEmail}</p>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, marginBottom: 24, textAlign: 'center', lineHeight: 1.6 }}>
            Click the link to verify your account — it'll bring you straight back here to finish signing up.
          </p>
          <button className="eo-ghost" style={{ marginTop: 0 }} onClick={resendConfirmation}>RESEND EMAIL</button>
          {resendMsg && <div className="eo-hint" style={{ textAlign: 'center', marginTop: 10 }}>{resendMsg}</div>}
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            <a href="/login" style={{ color: 'rgba(220,38,38,0.5)', textDecoration: 'none' }}>Sign in to existing account</a>
          </p>
        </div>
      </div>
    </>
  );

  if (done) return (
    <>
      <style>{CSS}</style>
      <div className="eo-done-root">
        <div className="eo-done-ring">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="eo-done-title">ACTIVATED</div>
        <p className="eo-done-sub">Launching your salesman panel</p>
      </div>
    </>
  );

  const canSlugContinue = form.slug.length >= 3 && !slugTaken && !slugChecking;

  return (
    <>
      <style>{CSS}</style>
      {showPlans && <PlanPickerModal currentTier={tier} onClose={() => setShowPlans(false)} />}
      <div className="eo-root">
        <LeftPanel step={step} tier={tier} onChangePlan={() => setShowPlans(true)} />
        <div className="eo-right">
          <div className="eo-form" key={step}>

            {/* Mobile top bar */}
            <div className="eo-mobile-bar">
              <div className="eo-logo" style={{ marginBottom: 0 }}>
                <div className="eo-logo-icon">X</div>
                <span className="eo-logo-text">SHIFTOS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 11, letterSpacing: 3, color: 'rgba(220,38,38,0.6)' }}>
                  {step + 1} / {STEPS.length}
                </span>
                <button type="button" className="eo-changeplan" style={{ margin: 0, padding: '4px 9px' }} onClick={() => setShowPlans(true)}>Change plan</button>
              </div>
            </div>

            {step === 0 && (
              <>
                <p className="eo-eyebrow">PDPA 2010 — REQUIRED</p>
                <div className="eo-heading">Terms &amp; Conditions</div>
                <p className="eo-sub">Read our Terms of Service, Privacy Policy, and Data Processing Agreement before continuing.</p>
                <div className="eo-legal-wrap">
                  <div className="eo-legal-scroll" ref={legalRef} onScroll={handleLegalScroll}>
                    <LegalContent />
                  </div>
                  <div className={`eo-legal-foot ${legalScrolled ? 'eo-legal-foot-ok' : ''}`}>
                    {legalScrolled ? 'Reviewed — you may now accept and continue' : 'Scroll to the bottom to enable the accept button'}
                  </div>
                </div>
                <button className="eo-btn" onClick={agreeLegal} disabled={!legalScrolled}>
                  I AGREE — CONTINUE
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <p className="eo-eyebrow">STEP 2 OF {STEPS.length}</p>
                <div className="eo-heading">Create Account</div>
                <p className="eo-sub">Sign up with your work email or continue with Google.</p>
                <button className="eo-ghost" style={{ marginTop: 0, borderColor: 'rgba(255,255,255,0.14)', height: 48 }} onClick={signInWithGoogle} disabled={loading}>
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  CONTINUE WITH GOOGLE
                </button>
                <div className="eo-divider">OR</div>
                <label className="eo-label">EMAIL ADDRESS</label>
                <input className="eo-inp" type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => upd('email')(e.target.value)} autoComplete="email" />
                <label className="eo-label">PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input className="eo-inp" type={showPw ? 'text' : 'password'} placeholder="Create a strong password" value={form.password}
                    onChange={e => upd('password')(e.target.value)} autoComplete="new-password" style={{ paddingRight: 62 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                {form.password.length > 0 && !pwValid && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {pwChecks.map(c => (
                      <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: c.ok ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                        <span style={{ width: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.ok
                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            : <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />}
                        </span>
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}
                <label className="eo-label">CONFIRM PASSWORD</label>
                <input className="eo-inp" type={showPw ? 'text' : 'password'} placeholder="Re-enter your password" value={form.confirmPassword}
                  onChange={e => upd('confirmPassword')(e.target.value)} autoComplete="new-password" />
                {form.confirmPassword.length > 0 && !pwMatch && (
                  <div className="eo-hint" style={{ color: '#f87171', marginTop: 6 }}>Passwords don't match</div>
                )}
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={signUp} disabled={loading || !form.email || !pwValid || !pwMatch}>
                  {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}
                </button>
                <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>
                  Already have an account?{' '}
                  <a href="/login" style={{ color: 'rgba(220,38,38,0.55)', textDecoration: 'none' }}>Sign in</a>
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <p className="eo-eyebrow">IDENTITY VERIFICATION — REQUIRED</p>
                <div className="eo-heading">Verify Your Identity</div>
                <p className="eo-sub">Your IC number is required before your listings appear on the xdrive.my marketplace.</p>
                <label className="eo-label">FULL LEGAL NAME (AS PER IC)</label>
                <input className="eo-inp" type="text" placeholder="Ahmad bin Abdullah" value={form.fullName}
                  onChange={e => upd('fullName')(e.target.value)} autoComplete="name" />
                <label className="eo-label">IC NUMBER (MYKAD)</label>
                <input className="eo-inp" type="text" placeholder="901231-10-1234" maxLength={14} value={form.icNumber}
                  onChange={e => upd('icNumber')(e.target.value.replace(/[^\d-]/g, ''))} />
                <p className="eo-hint">Format: YYMMDD-NN-XXXX (12 digits). Stored encrypted. Used for account verification only.</p>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={saveIdentity}
                  disabled={loading || !form.fullName.trim() || !validateIC(form.icNumber)}>
                  {loading ? 'SAVING…' : 'SAVE & CONTINUE'}
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <p className="eo-eyebrow">STEP 4 OF {STEPS.length}</p>
                <div className="eo-heading">Contact Number</div>
                <p className="eo-sub">Your WhatsApp number is shown to buyers on your listings and used for account notifications.</p>
                <label className="eo-label">WHATSAPP / MOBILE NUMBER</label>
                <input className="eo-inp" type="tel" placeholder="+60123456789" value={form.phone}
                  onChange={e => upd('phone')(e.target.value)} autoComplete="tel" />
                <p className="eo-hint">Malaysian numbers only (+60). This appears on your public listing page.</p>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn"
                  onClick={() => { setErr(''); setStep(4); }}
                  disabled={form.phone.replace(/\D/g, '').length < 9}>
                  CONTINUE
                </button>
              </>
            )}

            {step === 4 && (
              <>
                <p className="eo-eyebrow">STEP 5 OF {STEPS.length}</p>
                <div className="eo-heading">Setup Your Profile</div>
                <p className="eo-sub">This is what buyers will see on your public listing page.</p>
                <label className="eo-label">DISPLAY NAME / BRAND</label>
                <input className="eo-inp" type="text" placeholder="Ahmad Motors" value={form.brand}
                  onChange={e => {
                    upd('brand')(e.target.value);
                    if (!form.slug) upd('slug')(slugify(e.target.value));
                  }} />
                <label className="eo-label">PROFILE URL HANDLE</label>
                <div className="eo-slug-wrap">
                  <input className="eo-inp" type="text" placeholder="yourname" value={form.slug}
                    onChange={e => handleSlugChange(e.target.value)} style={{ paddingRight: 80 }} />
                  {form.slug.length >= 3 && (
                    <span className="eo-slug-status" style={{ color: slugTaken ? '#f87171' : slugChecking ? 'rgba(255,255,255,0.3)' : '#4ade80' }}>
                      {slugChecking ? 'CHECKING' : slugTaken ? 'TAKEN' : 'AVAILABLE'}
                    </span>
                  )}
                </div>
                <p className="eo-hint">xdrive.my/s/{form.slug || 'yourname'} &middot; Letters and numbers, 3–20 chars</p>
                <label className="eo-label">STATE</label>
                <select className="eo-select" value={form.state} onChange={e => upd('state')(e.target.value)}>
                  <option value="">Select state</option>
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="eo-label">
                  CITY / AREA <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: 400 }}>— OPTIONAL</span>
                </label>
                <input className="eo-inp" type="text" placeholder="e.g. Cheras" value={form.city}
                  onChange={e => upd('city')(e.target.value)} />
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" disabled={!canSlugContinue || loading}
                  onClick={() => { setErr(''); setStep(5); }}>
                  CONTINUE
                </button>
              </>
            )}

            {step === 5 && (
              <>
                <p className="eo-eyebrow">REVIEW YOUR DETAILS</p>
                <div className="eo-heading">Almost There</div>
                <p className="eo-sub">Confirm everything is accurate before activating your account.</p>
                <div className="eo-review-wrap">
                  {[
                    ['PLAN', (TIERS[tier] || TIERS.lite).label + ' — ' + (TIERS[tier] || TIERS.lite).price],
                    ['NAME', form.fullName],
                    ['EMAIL', userEmail],
                    ['IC NUMBER', form.icNumber ? '••••••-••-' + form.icNumber.replace(/-/g, '').slice(-4) : '—'],
                    ['PHONE', normalizePhone(form.phone)],
                    ['PROFILE URL', 'xdrive.my/s/' + form.slug],
                    ['STATE', form.state || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="eo-review-row">
                      <span className="eo-review-key">{k}</span>
                      <span className="eo-review-val" style={k === 'PROFILE URL' ? { color: 'rgba(220,38,38,0.75)' } : {}}>{v}</span>
                    </div>
                  ))}
                </div>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={activate} disabled={loading}>
                  {loading ? 'ACTIVATING…' : 'ACTIVATE ACCOUNT'}
                </button>
                <button className="eo-ghost" onClick={() => { setErr(''); setStep(4); }} disabled={loading}>
                  BACK
                </button>
                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.15)', lineHeight: 1.7 }}>
                  By activating, you confirm all information is accurate and you have agreed to our Terms, Privacy Policy, and DPA.
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
