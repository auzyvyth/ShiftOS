import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LegalContent from '../components/onboarding/LegalContent';

// Same design system CSS as SalesmanOnboarding (eo- prefix)
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.eo-root{display:flex;height:100vh;overflow:hidden;background:#070A12;font-family:'DM Sans',sans-serif;}
.eo-left{width:380px;min-width:380px;background:#0C1120;border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;padding:40px 36px;overflow-y:auto;flex-shrink:0;}
.eo-right{flex:1;min-width:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 48px;position:relative;}
.eo-logo{display:flex;align-items:center;gap:10px;margin-bottom:32px;}
.eo-logo-icon{width:30px;height:30px;background:#dc2626;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;font-family:'Bebas Neue',cursive;letter-spacing:1px;}
.eo-logo-text{font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:4px;color:#E8EDF5;}
.eo-plan-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.25);border-radius:4px;font-size:10px;letter-spacing:0.2em;color:rgba(220,38,38,0.9);text-transform:uppercase;margin-bottom:36px;width:fit-content;}
.eo-step-list{display:flex;flex-direction:column;gap:0;flex:1;}
.eo-step{display:flex;align-items:flex-start;gap:14px;position:relative;}
.eo-step:not(:last-child)::after{content:'';position:absolute;left:13px;top:30px;bottom:-4px;width:1px;background:rgba(255,255,255,0.06);}
.eo-step-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;transition:all 0.2s;}
.eo-dot-active{background:#dc2626;color:#fff;}
.eo-dot-done{background:rgba(220,38,38,0.12);color:#dc2626;border:1px solid rgba(220,38,38,0.3);}
.eo-dot-pending{background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.07);}
.eo-step-info{padding-bottom:20px;}
.eo-step-name{font-size:12px;font-weight:500;letter-spacing:0.06em;margin-bottom:2px;}
.eo-name-active{color:#E8EDF5;}
.eo-name-done{color:rgba(220,38,38,0.55);}
.eo-name-pending{color:rgba(255,255,255,0.18);}
.eo-step-sub{font-size:10px;color:rgba(255,255,255,0.18);letter-spacing:0.04em;}
.eo-features{margin-top:8px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05);}
.eo-feature{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:12px;color:rgba(255,255,255,0.35);}
.eo-feature-dot{width:4px;height:4px;border-radius:50%;background:#dc2626;flex-shrink:0;opacity:0.6;}
.eo-trustline{margin-top:auto;padding-top:20px;font-size:10px;color:rgba(255,255,255,0.12);letter-spacing:0.1em;text-transform:uppercase;line-height:1.8;}
.eo-form{width:100%;max-width:480px;animation:eo-up 0.28s ease both;}
@keyframes eo-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.eo-eyebrow{font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(220,38,38,0.7);margin-bottom:10px;font-weight:500;}
.eo-heading{font-family:'Bebas Neue',cursive;font-size:clamp(28px,4vw,40px);letter-spacing:3px;color:#E8EDF5;line-height:1;margin-bottom:10px;}
.eo-sub{font-size:14px;color:rgba(255,255,255,0.32);line-height:1.65;margin-bottom:24px;}
.eo-label{display:block;font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:7px;margin-top:16px;}
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
.eo-legal-wrap{border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;margin-top:16px;height:300px;}
.eo-legal-scroll{flex:1;overflow-y:auto;padding:20px;scrollbar-width:thin;scrollbar-color:rgba(220,38,38,0.25) transparent;}
.eo-legal-foot{padding:10px 20px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);font-size:10px;color:rgba(255,255,255,0.28);letter-spacing:0.1em;text-transform:uppercase;}
.eo-legal-foot-ok{color:rgba(74,222,128,0.6);}
.eo-review-wrap{border:1px solid rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;margin:20px 0;}
.eo-review-row{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.05);}
.eo-review-row:last-child{border-bottom:none;}
.eo-review-key{font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:0.12em;text-transform:uppercase;}
.eo-review-val{font-size:13px;color:#E8EDF5;font-weight:500;max-width:58%;text-align:right;word-break:break-all;}
.eo-error{font-size:12px;color:#f87171;margin-top:12px;padding:10px 14px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.15);border-radius:6px;line-height:1.5;}
.eo-hint{font-size:12px;color:rgba(255,255,255,0.22);margin-top:7px;line-height:1.6;}
.eo-mobile-bar{display:none;justify-content:space-between;align-items:center;padding:0 0 28px;width:100%;max-width:480px;}
.eo-done-root{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#070A12;text-align:center;}
.eo-done-ring{width:64px;height:64px;border-radius:50%;background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:28px;}
.eo-done-title{font-family:'Bebas Neue',cursive;font-size:clamp(44px,7vw,72px);letter-spacing:4px;color:#E8EDF5;line-height:1;margin-bottom:16px;}
.eo-done-sub{font-size:11px;color:rgba(255,255,255,0.25);letter-spacing:0.2em;text-transform:uppercase;max-width:340px;line-height:1.8;}
.eo-slug-wrap{position:relative;}
.eo-slug-status{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;letter-spacing:0.1em;}
.eo-resume-root{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#070A12;text-align:center;}
.eo-pending-box{border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:20px;margin:20px 0;background:rgba(255,255,255,0.02);}
@media(max-width:820px){
  .eo-left{display:none;}
  .eo-right{padding:36px 20px;justify-content:flex-start;}
  .eo-mobile-bar{display:flex;}
}
`;

const STEPS = [
  { label: 'TERMS', sub: 'Required agreement' },
  { label: 'ACCOUNT', sub: 'Email or Google' },
  { label: 'IDENTITY', sub: 'Owner IC' },
  { label: 'PHONE', sub: 'Contact number' },
  { label: 'BUSINESS', sub: 'Dealership info' },
  { label: 'LOCATION', sub: 'State & city' },
  { label: 'SUBDOMAIN', sub: 'Your XDrive URL' },
  { label: 'SUBMIT', sub: 'Pending review' },
];

const TIERS = {
  starter: {
    label: 'DEALER STARTER',
    price: 'RM 700 / mo',
    trial: '14-day free trial',
    features: [
      'Up to 30 active listings',
      'Full dealer dashboard',
      'Lead CRM + pipeline',
      'Team of up to 2 salesmen',
      'Analytics & reports',
      'Custom subdomain',
    ],
  },
  growth: {
    label: 'DEALER GROWTH',
    price: 'RM 1,200 / mo',
    trial: '14-day free trial',
    features: [
      'Up to 80 active listings',
      'Everything in Starter',
      'Up to 5 salesmen',
      'F&I add-on revenue tracking',
      'Post-sale handover board',
      'Priority support',
    ],
  },
  pro: {
    label: 'DEALER PRO',
    price: 'RM 2,500 / mo',
    trial: '14-day free trial',
    features: [
      'Unlimited listings',
      'Everything in Growth',
      'Unlimited team size',
      'Custom branding',
      'Dedicated account manager',
      'SLA-backed uptime',
    ],
  },
};

const MY_STATES = [
  'Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka',
  'Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya',
  'Sabah','Sarawak','Selangor','Terengganu',
];

const DEALER_TYPES = [
  'Independent Dealer','Franchise Dealer','Used Car Lot',
  'Car Rental','Multi-Brand Showroom',
];

const FLEET_SIZES = ['1–5 cars','6–15 cars','16–30 cars','31–50 cars','50+ cars'];

function validateIC(ic) {
  return /^\d{12}$/.test(ic.replace(/-/g, ''));
}

function normalizePhone(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('60')) return '+' + d;
  if (d.startsWith('0')) return '+6' + d;
  return '+60' + d;
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

function LeftPanel({ step, tier }) {
  const cfg = TIERS[tier] || TIERS.starter;
  return (
    <div className="eo-left">
      <div className="eo-logo">
        <div className="eo-logo-icon">X</div>
        <span className="eo-logo-text">SHIFTOS</span>
      </div>
      <div className="eo-plan-badge">{cfg.label} &mdash; {cfg.price}</div>
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
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{cfg.trial}</p>
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

export default function DealerOnboarding() {
  const navigate = useNavigate();
  const { tier: tierParam } = useParams();
  const tier = ['starter', 'growth', 'pro'].includes(tierParam) ? tierParam : 'starter';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [legalScrolled, setLegalScrolled] = useState(false);
  const [showResumeChoice, setShowResumeChoice] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [subTaken, setSubTaken] = useState(false);
  const [subChecking, setSubChecking] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '',
    fullName: '', icNumber: '',
    phone: '+60',
    dealerName: '', dealerType: '', ssmNumber: '', fleetSize: '',
    state: '', city: '', address: '',
    subdomain: '',
  });

  const legalRef = useRef(null);
  const subTimer = useRef(null);

  const upd = (k) => (val) => setForm(p => ({ ...p, [k]: val }));

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      setUserEmail(session.user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete, full_name, phone, ic_number, dealership, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.onboarding_complete && profile?.role === 'dealer') {
        navigate('/dashboard');
        return;
      }

      if (profile) {
        setForm(p => ({
          ...p,
          fullName: profile.full_name || p.fullName,
          icNumber: profile.ic_number || p.icNumber,
          phone: profile.phone || p.phone,
          dealerName: profile.dealership || p.dealerName,
        }));
        setShowResumeChoice(true);
        return;
      }

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
    sessionStorage.setItem('ob_account_type', 'dealer');
    sessionStorage.setItem('ob_agreed', '1');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signUp = async () => {
    setErr('');
    if (form.password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
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
          role: 'dealer',
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

  const checkSubdomain = async (sub) => {
    if (!sub || sub.length < 3) { setSubTaken(false); return; }
    setSubChecking(true);
    try {
      const { data } = await supabase.from('profiles').select('id').eq('subdomain', sub).maybeSingle();
      setSubTaken(!!data && data.id !== userId);
    } finally {
      setSubChecking(false);
    }
  };

  const handleSubChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    upd('subdomain')(clean);
    clearTimeout(subTimer.current);
    subTimer.current = setTimeout(() => checkSubdomain(clean), 450);
  };

  const submit = async () => {
    setErr('');
    if (!form.dealerName.trim()) { setErr('Dealership name is required'); return; }
    if (!form.subdomain || form.subdomain.length < 3) { setErr('Choose a subdomain (at least 3 characters)'); return; }
    if (subTaken) { setErr('That subdomain is already taken'); return; }
    if (!form.state) { setErr('Please select your state'); return; }
    setLoading(true);
    try {
      const planMap = { starter: 'standard', growth: 'standard', pro: 'dealer_full' };
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: userEmail,
        full_name: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        ic_number: form.icNumber.replace(/-/g, ''),
        role: 'dealer',
        dealership: form.dealerName.trim(),
        subdomain: form.subdomain,
        state: form.state,
        city: form.city || null,
        ssm_number: form.ssmNumber || null,
        fleet_size: form.fleetSize || null,
        dealer_type: form.dealerType || null,
        is_active: true,
        onboarding_complete: true,
        selected_plan: planMap[tier] || 'standard',
        pdpa_consent: true,
        pdpa_consent_at: new Date().toISOString(),
        ic_deadline: null,
      }, { onConflict: 'id' });
      if (error) throw error;
      sessionStorage.removeItem('ob_agreed');
      sessionStorage.removeItem('ob_plan_slug');
      sessionStorage.removeItem('ob_account_type');
      setSubmitted(true);
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
    setForm({ email: '', password: '', fullName: '', icNumber: '', phone: '+60', dealerName: '', dealerType: '', ssmNumber: '', fleetSize: '', state: '', city: '', address: '', subdomain: '' });
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

  if (submitted) return (
    <>
      <style>{CSS}</style>
      <div className="eo-done-root">
        <div className="eo-done-ring">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="eo-done-title">APPLICATION SUBMITTED</div>
        <p className="eo-done-sub">
          Our team will review your dealership application within 24 hours.<br />
          You'll receive an email at {userEmail} once approved.
        </p>
        <a href="/login" style={{ marginTop: 40, fontSize: 12, color: 'rgba(220,38,38,0.55)', textDecoration: 'none', letterSpacing: '0.1em' }}>
          SIGN IN TO CHECK STATUS
        </a>
      </div>
    </>
  );

  const canSubContinue = form.subdomain.length >= 3 && !subTaken && !subChecking;

  return (
    <>
      <style>{CSS}</style>
      <div className="eo-root">
        <LeftPanel step={step} tier={tier} />
        <div className="eo-right">
          <div className="eo-form" key={step}>

            <div className="eo-mobile-bar">
              <div className="eo-logo" style={{ marginBottom: 0 }}>
                <div className="eo-logo-icon">X</div>
                <span className="eo-logo-text">SHIFTOS</span>
              </div>
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 11, letterSpacing: 3, color: 'rgba(220,38,38,0.6)' }}>
                {step + 1} / {STEPS.length}
              </span>
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
                <p className="eo-sub">Sign up with your work email or continue with Google. Your 14-day free trial starts immediately — no credit card required.</p>
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
                <label className="eo-label">WORK EMAIL ADDRESS</label>
                <input className="eo-inp" type="email" placeholder="owner@yourdealership.com" value={form.email}
                  onChange={e => upd('email')(e.target.value)} autoComplete="email" />
                <label className="eo-label">PASSWORD</label>
                <input className="eo-inp" type="password" placeholder="Min 8 chars" value={form.password}
                  onChange={e => upd('password')(e.target.value)} autoComplete="new-password" />
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={signUp} disabled={loading || !form.email || form.password.length < 8}>
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
                <p className="eo-eyebrow">OWNER IDENTITY — REQUIRED</p>
                <div className="eo-heading">Verify Owner Identity</div>
                <p className="eo-sub">We verify the dealership owner's identity to maintain trust and compliance with Malaysian business regulations.</p>
                <label className="eo-label">OWNER FULL NAME (AS PER IC)</label>
                <input className="eo-inp" type="text" placeholder="Ahmad bin Abdullah" value={form.fullName}
                  onChange={e => upd('fullName')(e.target.value)} autoComplete="name" />
                <label className="eo-label">OWNER IC NUMBER (MYKAD)</label>
                <input className="eo-inp" type="text" placeholder="901231-10-1234" maxLength={14} value={form.icNumber}
                  onChange={e => upd('icNumber')(e.target.value.replace(/[^\d-]/g, ''))} />
                <p className="eo-hint">Format: YYMMDD-NN-XXXX (12 digits). Stored encrypted. Required by PDPA 2010 for business account verification.</p>
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
                <p className="eo-sub">Your mobile number is used for dealership notifications and WhatsApp enquiries from buyers.</p>
                <label className="eo-label">OWNER MOBILE NUMBER</label>
                <input className="eo-inp" type="tel" placeholder="+60123456789" value={form.phone}
                  onChange={e => upd('phone')(e.target.value)} autoComplete="tel" />
                <p className="eo-hint">Malaysian numbers only (+60).</p>
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
                <div className="eo-heading">Business Details</div>
                <p className="eo-sub">Tell us about your dealership so we can set up your account correctly.</p>
                <label className="eo-label">DEALERSHIP NAME</label>
                <input className="eo-inp" type="text" placeholder="Fast Track Auto Sdn Bhd" value={form.dealerName}
                  onChange={e => upd('dealerName')(e.target.value)} />
                <label className="eo-label">TYPE OF DEALERSHIP</label>
                <select className="eo-select" value={form.dealerType} onChange={e => upd('dealerType')(e.target.value)}>
                  <option value="">Select type</option>
                  {DEALER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="eo-label">
                  SSM REGISTRATION NUMBER <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: 400 }}>— OPTIONAL</span>
                </label>
                <input className="eo-inp" type="text" placeholder="e.g. 1234567-A" value={form.ssmNumber}
                  onChange={e => upd('ssmNumber')(e.target.value)} />
                <p className="eo-hint">Required within 14 days for full verification and access to advanced features.</p>
                <label className="eo-label">CURRENT FLEET SIZE</label>
                <select className="eo-select" value={form.fleetSize} onChange={e => upd('fleetSize')(e.target.value)}>
                  <option value="">Select fleet size</option>
                  {FLEET_SIZES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn"
                  disabled={!form.dealerName.trim() || loading}
                  onClick={() => { setErr(''); setStep(5); }}>
                  CONTINUE
                </button>
              </>
            )}

            {step === 5 && (
              <>
                <p className="eo-eyebrow">STEP 6 OF {STEPS.length}</p>
                <div className="eo-heading">Location</div>
                <p className="eo-sub">Your location helps buyers find your dealership on xdrive.my.</p>
                <label className="eo-label">STATE</label>
                <select className="eo-select" value={form.state} onChange={e => upd('state')(e.target.value)}>
                  <option value="">Select state</option>
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="eo-label">
                  CITY / AREA <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: 400 }}>— OPTIONAL</span>
                </label>
                <input className="eo-inp" type="text" placeholder="e.g. Butterworth" value={form.city}
                  onChange={e => upd('city')(e.target.value)} />
                <label className="eo-label">
                  SHOWROOM ADDRESS <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: 400 }}>— OPTIONAL</span>
                </label>
                <input className="eo-inp" type="text" placeholder="No. 1, Jalan Utama" value={form.address}
                  onChange={e => upd('address')(e.target.value)} />
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" disabled={!form.state || loading}
                  onClick={() => { setErr(''); setStep(6); }}>
                  CONTINUE
                </button>
                <button className="eo-ghost" onClick={() => { setErr(''); setStep(4); }}>BACK</button>
              </>
            )}

            {step === 6 && (
              <>
                <p className="eo-eyebrow">STEP 7 OF {STEPS.length}</p>
                <div className="eo-heading">Your XDrive URL</div>
                <p className="eo-sub">Choose a unique subdomain for your dealership on xdrive.my. This will be your public storefront URL.</p>
                <label className="eo-label">SUBDOMAIN</label>
                <div className="eo-slug-wrap">
                  <input className="eo-inp" type="text" placeholder="yourbrand" value={form.subdomain}
                    onChange={e => handleSubChange(e.target.value)}
                    style={{ paddingRight: 90 }} />
                  {form.subdomain.length >= 3 && (
                    <span className="eo-slug-status" style={{ color: subTaken ? '#f87171' : subChecking ? 'rgba(255,255,255,0.3)' : '#4ade80' }}>
                      {subChecking ? 'CHECKING' : subTaken ? 'TAKEN' : 'AVAILABLE'}
                    </span>
                  )}
                </div>
                <p className="eo-hint">
                  {form.subdomain ? `${form.subdomain}.xdrive.my` : 'yourbrand.xdrive.my'} &middot; Letters and numbers, 3–30 chars
                </p>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" disabled={!canSubContinue || loading}
                  onClick={() => { setErr(''); setStep(7); }}>
                  CONFIRM SUBDOMAIN
                </button>
                <button className="eo-ghost" onClick={() => { setErr(''); setStep(5); }}>BACK</button>
              </>
            )}

            {step === 7 && (
              <>
                <p className="eo-eyebrow">REVIEW & SUBMIT</p>
                <div className="eo-heading">Review Application</div>
                <p className="eo-sub">Confirm your details before submitting. Our team will review and activate your dealership account within 24 hours.</p>
                <div className="eo-review-wrap">
                  {[
                    ['PLAN', (TIERS[tier] || TIERS.starter).label],
                    ['OWNER', form.fullName],
                    ['EMAIL', userEmail],
                    ['IC NUMBER', form.icNumber ? '••••••-••-' + form.icNumber.replace(/-/g, '').slice(-4) : '—'],
                    ['PHONE', normalizePhone(form.phone)],
                    ['DEALERSHIP', form.dealerName],
                    ['TYPE', form.dealerType || '—'],
                    ['STATE', form.state],
                    ['SUBDOMAIN', form.subdomain + '.xdrive.my'],
                  ].map(([k, v]) => (
                    <div key={k} className="eo-review-row">
                      <span className="eo-review-key">{k}</span>
                      <span className="eo-review-val" style={k === 'SUBDOMAIN' ? { color: 'rgba(220,38,38,0.75)' } : {}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="eo-pending-box">
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>REVIEW PROCESS</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                    Our team verifies dealership details within 24 hours. You'll receive an email once your account is approved and ready to use.
                  </p>
                </div>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={submit} disabled={loading}>
                  {loading ? 'SUBMITTING…' : 'SUBMIT APPLICATION'}
                </button>
                <button className="eo-ghost" onClick={() => { setErr(''); setStep(6); }} disabled={loading}>BACK</button>
                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.15)', lineHeight: 1.7 }}>
                  By submitting, you confirm all information is accurate and you have agreed to our Terms, Privacy Policy, and DPA.
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
