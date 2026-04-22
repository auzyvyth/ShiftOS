// FIXED LoginPage — two changes marked with ← FIX
// 1. redirectByRole checks onboarding_complete
// 2. handleRegister uses upsert + onboarding_complete: true

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';

const ROLES = ['Sales Executive', 'Sales Manager', 'General Manager', 'Admin', 'Other'];
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const MY_IC_REGEX = /^\d{6}-\d{2}-\d{4}$/;
const MY_PHONE_REGEX = /^\+60\d{8,10}$/;

const formatMalaysianIc = (value = '') => {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

const formatMalaysianPhone = (value = '') => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '+60';
  let local = digits;
  if (local.startsWith('60')) local = local.slice(2);
  else if (local.startsWith('0')) local = local.slice(1);
  local = local.slice(0, 10);
  return `+60${local}`;
};

const Field = ({ id, label, focused, children }) => (
  <div className={`field ${focused === id ? 'is-focused' : ''}`}>
    <label>{label}</label>
    {children}
  </div>
);

const TextInput = ({ id, type = 'text', placeholder, value, onChange, onFocusChange, inputMode, maxLength }) => (
  <div className="field-inner">
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => onFocusChange(id)}
      onBlur={() => onFocusChange('')}
      autoComplete="off"
      inputMode={inputMode}
      maxLength={maxLength}
    />
    <div className="field-bar" />
  </div>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(searchParams.get('unconfirmed') === '1');
  const [focused, setFocused] = useState('');
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const photoRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('+60');
  const [ic, setIc] = useState('');
  const [dealership, setDealership] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const passwordChecks = {
    minLength: regPassword.length >= 8,
    uppercase: /[A-Z]/.test(regPassword),
    lowercase: /[a-z]/.test(regPassword),
    number: /\d/.test(regPassword),
    special: /[^A-Za-z0-9]/.test(regPassword),
  };
  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;
  const confirmPasswordMatches = confirmPassword.length > 0 && regPassword === confirmPassword;
  const isRegPasswordStrong = STRONG_PASSWORD_REGEX.test(regPassword);
  const normalizedIc = formatMalaysianIc(ic);
  const isIcValid = MY_IC_REGEX.test(normalizedIc);
  const normalizedPhone = formatMalaysianPhone(phone);
  const isPhoneValid = MY_PHONE_REGEX.test(normalizedPhone);

  useEffect(() => {
    document.title = t('login.meta.title', { defaultValue: 'ShiftOS · Login' });
  }, [t]);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectByRole(data.session.user);
    });
  }, []);

  const redirectByRole = async (user) => {
    if (!user?.id) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('subdomain, role, dealer_id')
      .eq('id', user.id)
      .maybeSingle();

    const subdomain = profile?.subdomain;
    const role = profile?.role;

    if (role === 'superadmin' || role === 'dealer') {
      if (subdomain) {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session.access_token;
        const refreshToken = session.refresh_token;
        window.location.href = `https://${subdomain}.xdrive.my?access_token=${accessToken}&refresh_token=${refreshToken}`;
      } else {
        window.location.href = 'https://xdrive.my/dashboard';
      }
    } else if (role === 'salesman') {
      if (profile?.dealer_id) {
        window.location.href = 'https://xdrive.my/salesman';
      } else {
        window.location.href = 'https://xdrive.my/salesman-lite';
      }
    } else {
      window.location.href = 'https://xdrive.my/salesman';
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2MB.'); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError(''); setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }
    await redirectByRole(data.user);
    setLoading(false);
  };

  const handleRegister = async () => {
    setError('');
    const cleanedFullName   = fullName.trim();
    const cleanedRegEmail   = regEmail.trim();
    const cleanedDealership = dealership.trim();
    const cleanedLocation   = location.trim();
    const cleanedRole       = role.trim();
    const cleanedIc         = formatMalaysianIc(ic);
    const cleanedPhone      = formatMalaysianPhone(phone);

    const missingFields = [];
    if (!cleanedFullName)                   missingFields.push('Full Name');
    if (!cleanedRegEmail)                   missingFields.push('Email');
    if (!MY_PHONE_REGEX.test(cleanedPhone)) missingFields.push('Phone Number');
    if (!cleanedIc)                         missingFields.push('IC Number');
    if (!cleanedDealership)                 missingFields.push('Dealership Name');
    if (!cleanedLocation)                   missingFields.push('Location');
    if (!cleanedRole)                       missingFields.push('Job Title');
    if (!regPassword)                       missingFields.push('Password');

    if (missingFields.length > 0) { setError(`Please fill in: ${missingFields.join(', ')}.`); return; }
    if (!MY_IC_REGEX.test(cleanedIc)) { setError('IC Number must follow Malaysian format: XXXXXX-XX-XXXX.'); return; }
    if (!STRONG_PASSWORD_REGEX.test(regPassword)) { setError('Use a strong password: 8+ characters with uppercase, lowercase, number, and special character.'); return; }
    if (regPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanedRegEmail,
      password: regPassword,
    });

    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    const userId = data.user?.id;
    if (!userId) { setError('Signup failed. Please try again.'); setLoading(false); return; }

    let avatarUrl = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }
    }

    // Pre-populate profile so it exists even before email confirmation
    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id:                  userId,
          full_name:           cleanedFullName,
          email:               cleanedRegEmail,
          phone:               cleanedPhone,
          ic:                  cleanedIc,
          dealership:          cleanedDealership,
          location:            cleanedLocation,
          role:                'dealer',
          job_title:           cleanedRole,
          avatar_url:          avatarUrl,
          is_active:           true,
          onboarding_complete: false,
        });
      if (profileError) console.error('Profile upsert error:', profileError.message);
    }

    setLoading(false);
    setConfirmEmail(cleanedRegEmail);
  };

  const handleResend = async () => {
    if (!confirmEmail || resendLoading) return;
    setResendLoading(true);
    setResendSent(false);
    await supabase.auth.resend({ type: 'signup', email: confirmEmail });
    setResendLoading(false);
    setResendSent(true);
  };

  const switchMode = () => { setIsRegister(!isRegister); setError(''); setSuccess(''); };

  if (unconfirmed) {
    const unconfirmedEmail = searchParams.get('email') || '';
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '24px 16px', background: '#0a0a0c', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <span style={{ width: 30, height: 30, background: '#dc2626', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>S</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 3, fontSize: 28 }}>ShiftOS</span>
        </div>
        <div style={{ width: 'min(420px, 100%)', background: '#111114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ width: 56, height: 56, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5"><path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/></svg>
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff', letterSpacing: 2, marginBottom: 12 }}>CONFIRM YOUR EMAIL</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 24 }}>Your account isn't confirmed yet. Check your inbox for the confirmation link before signing in.</p>
          {resendSent && <p style={{ fontSize: 12, color: '#4ade80', marginBottom: 16 }}>Confirmation email resent!</p>}
          {unconfirmedEmail && (
            <button onClick={async () => {
              setResendLoading(true); setResendSent(false);
              await supabase.auth.resend({ type: 'signup', email: unconfirmedEmail });
              setResendLoading(false); setResendSent(true);
            }} disabled={resendLoading} style={{ width: '100%', padding: '13px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: resendLoading ? 'not-allowed' : 'pointer', marginBottom: 16 }}>
              {resendLoading ? 'Sending...' : 'Resend confirmation email'}
            </button>
          )}
          <button onClick={() => setUnconfirmed(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (confirmEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '24px 16px', background: '#0a0a0c', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <span style={{ width: 30, height: 30, background: '#dc2626', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>S</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 3, fontSize: 28 }}>ShiftOS</span>
        </div>
        <div style={{ width: 'min(480px, 100%)', background: '#111114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ width: 64, height: 64, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5"><path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/></svg>
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#fff', letterSpacing: 2, marginBottom: 12 }}>CHECK YOUR INBOX</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 8 }}>We sent a confirmation link to</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#f3f4f6', marginBottom: 28, wordBreak: 'break-all' }}>{confirmEmail}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: 28 }}>Click the link in your email to activate your account. Check your spam folder if you don't see it.</p>
          {resendSent && (
            <p style={{ fontSize: 12, color: '#4ade80', marginBottom: 16 }}>Confirmation email resent!</p>
          )}
          <button onClick={handleResend} disabled={resendLoading} style={{ width: '100%', padding: '13px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: resendLoading ? 'not-allowed' : 'pointer', marginBottom: 16 }}>
            {resendLoading ? 'Sending...' : 'Resend confirmation email'}
          </button>
          <button onClick={() => { setConfirmEmail(null); setIsRegister(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}>
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
        .login-form-panel { width: min(560px, 100%); background: #111114; display: flex; flex-direction: column; align-items: stretch; justify-content: center; position: relative; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,.45); opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease; overflow: hidden; }
        .login-form-panel.mounted { opacity: 1; transform: translateY(0); }
        .form-scroll { padding: 40px 40px 0; }
        .form-heading { margin-bottom: 28px; }
        .form-heading .eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #dc2626; font-weight: 500; margin-bottom: 8px; }
        .form-heading h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: #fff; letter-spacing: 2px; line-height: 1; }
        .photo-upload-row { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .photo-circle { width: 64px; height: 64px; border-radius: 50%; border: 2px dashed rgba(255,255,255,.15); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color .2s; background: rgba(255,255,255,.03); }
        .photo-circle:hover { border-color: #dc2626; }
        .photo-circle img { width: 100%; height: 100%; object-fit: cover; }
        .photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .photo-placeholder svg { opacity: .3; }
        .photo-placeholder span { font-size: 9px; letter-spacing: 1px; color: rgba(255,255,255,.25); text-transform: uppercase; }
        .photo-hint { font-size: 11px; color: rgba(255,255,255,.25); line-height: 1.6; }
        .photo-hint strong { color: rgba(255,255,255,.5); font-weight: 500; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.35); margin-bottom: 7px; font-weight: 500; transition: color .2s; }
        .field.is-focused label { color: #dc2626; }
        .field-inner { position: relative; }
        .field input, .field select { width: 100%; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 4px; padding: 13px 16px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .2s, background .2s; appearance: none; }
        .field select { cursor: pointer; padding-right: 36px; border-radius: 12px; border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.06); }
        .field select option { background: #1a1a1e; color: #fff; }
        .field input::placeholder { color: rgba(255,255,255,.12); }
        .field input:focus, .field select:focus { border-color: #dc2626; background: rgba(220,38,38,.05); }
        .field-bar { position: absolute; bottom: 0; left: 0; height: 2px; width: 0; background: #dc2626; border-radius: 0 0 12px 12px; transition: width .3s ease; }
        .field input:focus ~ .field-bar { width: 100%; }
        .select-arrow { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: rgba(255,255,255,.45); }
        .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: rgba(255,255,255,.25); transition: color .2s; display: flex; }
        .pw-toggle:hover { color: rgba(255,255,255,.6); }
        .section-sep { border: none; border-top: 1px solid rgba(255,255,255,.06); margin: 16px 0 14px; }
        .section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,.2); margin-bottom: 12px; font-weight: 500; }
        .error-msg { background: rgba(220,38,38,.1); border: 1px solid rgba(220,38,38,.3); border-radius: 4px; padding: 10px 14px; color: #f87171; font-size: 12px; margin-bottom: 14px; }
        .success-msg { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.25); border-radius: 4px; padding: 10px 14px; color: #4ade80; font-size: 12px; margin-bottom: 14px; }
        .submit-bar { padding: 16px 40px 36px; flex-shrink: 0; }
        .password-hint { margin-top: 8px; font-size: 11px; line-height: 1.45; color: rgba(255,255,255,.45); }
        .password-hint.bad { color: #f87171; } .password-hint.ok { color: #4ade80; }
        .password-strength { margin-top: 10px; display: flex; gap: 6px; }
        .password-strength span { height: 5px; border-radius: 999px; flex: 1; background: rgba(255,255,255,.12); transition: background .2s ease; }
        .password-strength span.filled { background: rgba(220,38,38,.9); }
        .password-rules { margin-top: 8px; display: grid; grid-template-columns: 1fr; gap: 4px; }
        .password-rule { display: flex; align-items: center; gap: 6px; font-size: 11px; color: rgba(255,255,255,.45); line-height: 1.3; }
        .password-rule.ok { color: #4ade80; }
        .password-dot { width: 6px; height: 6px; border-radius: 999px; background: rgba(255,255,255,.2); flex-shrink: 0; }
        .password-rule.ok .password-dot { background: #22c55e; }
        .ic-hint { margin-top: 8px; font-size: 11px; line-height: 1.35; color: rgba(255,255,255,.45); }
        .ic-hint.bad { color: #f87171; } .ic-hint.ok { color: #4ade80; }
        .phone-hint { margin-top: 8px; font-size: 11px; line-height: 1.35; color: rgba(255,255,255,.45); }
        .phone-hint.bad { color: #f87171; } .phone-hint.ok { color: #4ade80; }
        .confirm-hint { margin-top: 8px; font-size: 11px; line-height: 1.3; color: rgba(255,255,255,.45); }
        .confirm-hint.match { color: #4ade80; } .confirm-hint.miss { color: #f87171; }
        .btn-submit { width: 100%; padding: 15px; background: #dc2626; border: none; border-radius: 4px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; transition: background .2s, transform .1s; margin-bottom: 12px; }
        .btn-submit:hover:not(:disabled) { background: #b91c1c; }
        .btn-submit:active:not(:disabled) { transform: scale(.99); }
        .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
        .btn-shimmer { position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent); animation: shimmer 2s infinite; }
        @keyframes shimmer { from { left: -60%; } to { left: 120%; } }
        .btn-toggle { background: none; border: none; color: rgba(255,255,255,.3); font-family: 'DM Sans', sans-serif; font-size: 12px; letter-spacing: .5px; cursor: pointer; width: 100%; text-align: center; padding: 6px; transition: color .2s; }
        .btn-toggle:hover { color: rgba(255,255,255,.6); }
        .btn-toggle span { color: #dc2626; text-decoration: underline; text-underline-offset: 2px; }
        .footer-note { text-align: center; font-size: 10px; color: rgba(255,255,255,.1); letter-spacing: 1px; text-transform: uppercase; padding-top: 14px; }
        .loading-dots span { animation: blink 1.4s infinite both; font-size: 22px; }
        .loading-dots span:nth-child(2) { animation-delay: .2s; }
        .loading-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%,80%,100% { opacity:0; } 40% { opacity:1; } }
        @media (max-width: 768px) { .login-form-panel { width: 100%; max-width: 520px; border-radius: 18px; } .form-scroll { padding: 34px 24px 0; } .submit-bar { padding: 14px 24px 30px; } }
        @media (max-width: 480px) { .form-scroll { padding: 30px 18px 0; } .submit-bar { padding: 12px 18px 26px; } .field-row { grid-template-columns: 1fr; gap: 0; } .form-heading h2 { font-size: 34px; } .field input, .field select { padding: 12px 14px; font-size: 15px; } .btn-submit { font-size: 16px; padding: 14px; letter-spacing: 2px; } }
      `}</style>

      <div className="login-root">
        <div className="center-brand">
          <span className="center-brand-icon">S</span>
          <span className="center-brand-text">ShiftOS</span>
        </div>

        <div className={`login-form-panel ${mounted ? 'mounted' : ''}`}>
          <form noValidate onSubmit={e => { e.preventDefault(); isRegister ? handleRegister() : handleLogin(); }} style={{ display: 'contents' }}>
            <div className="form-scroll">
              <div className="form-heading">
                <p className="eyebrow">{isRegister ? 'New Account' : 'Restricted Access'}</p>
                <h2>{isRegister ? 'REGISTER' : 'SIGN IN'}</h2>
              </div>

              {isRegister ? (
                <>
                  <div className="photo-upload-row">
                    <div className="photo-circle" onClick={() => photoRef.current.click()}>
                      {photoPreview ? <img src={photoPreview} alt="preview" /> : (
                        <div className="photo-placeholder">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <span>Photo</span>
                        </div>
                      )}
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                    <div className="photo-hint"><strong>Profile photo</strong> (optional)<br />JPG or PNG, max 2MB</div>
                  </div>

                  <p className="section-label">Personal Info</p>
                  <Field id="fullName" label="Full Name" focused={focused}>
                    <TextInput id="fullName" placeholder="Ahmad bin Abdullah" value={fullName} onChange={setFullName} onFocusChange={setFocused} />
                  </Field>
                  <div className="field-row">
                    <Field id="ic" label="IC Number" focused={focused}>
                      <TextInput id="ic" placeholder="010203-10-1234" value={ic} onChange={(v) => setIc(formatMalaysianIc(v))} onFocusChange={setFocused} inputMode="numeric" maxLength={14} />
                      <p className={`ic-hint ${ic ? (isIcValid ? 'ok' : 'bad') : ''}`}>Malaysian IC format: XXXXXX-XX-XXXX</p>
                    </Field>
                    <Field id="phone" label="Phone Number" focused={focused}>
                      <TextInput id="phone" type="tel" placeholder="+60123456789" value={phone} onChange={(v) => setPhone(formatMalaysianPhone(v))} onFocusChange={setFocused} inputMode="numeric" maxLength={13} />
                      <p className={`phone-hint ${phone !== '+60' ? (isPhoneValid ? 'ok' : 'bad') : ''}`}>Format: +60XXXXXXXXX</p>
                    </Field>
                  </div>
                  <Field id="location" label="Location" focused={focused}>
                    <TextInput id="location" placeholder="Penang, Malaysia" value={location} onChange={setLocation} onFocusChange={setFocused} />
                  </Field>

                  <hr className="section-sep" />
                  <p className="section-label">Dealership</p>
                  <Field id="dealership" label="Dealership Name" focused={focused}>
                    <TextInput id="dealership" placeholder="Auto City Sdn Bhd" value={dealership} onChange={setDealership} onFocusChange={setFocused} />
                  </Field>
                  <Field id="role" label="Your Job Title" focused={focused}>
                    <div className="field-inner">
                      <select value={role} onChange={e => setRole(e.target.value)} onFocus={() => setFocused('role')} onBlur={() => setFocused('')}>
                        <option value="" disabled>Select role...</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <div className="select-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></div>
                      <div className="field-bar" />
                    </div>
                  </Field>

                  <hr className="section-sep" />
                  <p className="section-label">Account</p>
                  <Field id="regEmail" label="Email Address" focused={focused}>
                    <TextInput id="regEmail" type="email" placeholder="airy@shiftos.my" value={regEmail} onChange={setRegEmail} onFocusChange={setFocused} />
                  </Field>
                  <div className="field-row">
                    <Field id="regPassword" label="Password" focused={focused}>
                      <div className="field-inner">
                        <input type={showRegPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} onFocus={() => setFocused('regPassword')} onBlur={() => setFocused('')} style={{ paddingRight: '40px' }} />
                        <button className="pw-toggle" type="button" onClick={() => setShowRegPassword(p => !p)} tabIndex={-1}>
                          {showRegPassword
                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                        <div className="field-bar" />
                      </div>
                      {(regPassword.length > 0 || focused === 'regPassword') && (
                        <>
                          <p className={`password-hint ${regPassword ? (isRegPasswordStrong ? 'ok' : 'bad') : ''}`}>8+ chars with uppercase, lowercase, number, special character.</p>
                          <div className="password-strength">{[1,2,3,4,5].map(l => <span key={l} className={passwordScore >= l ? 'filled' : ''} />)}</div>
                          <div className="password-rules">
                            <p className={`password-rule ${passwordChecks.minLength ? 'ok' : ''}`}><span className="password-dot" />At least 8 characters</p>
                            <p className={`password-rule ${passwordChecks.uppercase ? 'ok' : ''}`}><span className="password-dot" />One uppercase (A-Z)</p>
                            <p className={`password-rule ${passwordChecks.lowercase ? 'ok' : ''}`}><span className="password-dot" />One lowercase (a-z)</p>
                            <p className={`password-rule ${passwordChecks.number ? 'ok' : ''}`}><span className="password-dot" />One number (0-9)</p>
                            <p className={`password-rule ${passwordChecks.special ? 'ok' : ''}`}><span className="password-dot" />One special character</p>
                          </div>
                        </>
                      )}
                    </Field>
                    <Field id="confirmPassword" label="Confirm Password" focused={focused}>
                      <TextInput id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={setConfirmPassword} onFocusChange={setFocused} />
                      {confirmPassword.length > 0 && (
                        <p className={`confirm-hint ${confirmPasswordMatches ? 'match' : 'miss'}`}>
                          {confirmPasswordMatches ? 'Passwords match.' : 'Passwords do not match yet.'}
                        </p>
                      )}
                    </Field>
                  </div>
                  {error   && <div className="error-msg">&#9888; {error}</div>}
                  {success && <div className="success-msg">&#10003; {success}</div>}
                </>
              ) : (
                <>
                  <Field id="email" label="Email Address" focused={focused}>
                    <TextInput id="email" type="email" placeholder="admin@shiftos.my" value={email} onChange={setEmail} onFocusChange={setFocused} />
                  </Field>
                  <Field id="password" label="Password" focused={focused}>
                    <div className="field-inner">
                      <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused('')} style={{ paddingRight: '40px' }} />
                      <button className="pw-toggle" type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                        {showPassword
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                      <div className="field-bar" />
                    </div>
                  </Field>
                  {error && <div className="error-msg">&#9888; {error}</div>}
                </>
              )}
            </div>

            <div className="submit-bar">
              <button type="submit" className="btn-submit" disabled={loading}>
                <div className="btn-shimmer" />
                {loading
                  ? <span className="loading-dots"><span>·</span><span>·</span><span>·</span></span>
                  : isRegister ? 'CREATE ACCOUNT' : 'ACCESS DASHBOARD'
                }
              </button>
              {!isRegister && (
                <a
                  href="/register"
                  style={{ display: 'block', width: '100%', textAlign: 'center', padding: '12px 0', marginBottom: 4, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 4, color: '#f87171', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.06)'}
                >
                  Create free account →
                </a>
              )}
              <button type="button" className="btn-toggle" onClick={switchMode}>
                {isRegister ? <>Already registered? <span>Sign in instead</span></> : <>Need an account? <span>Register here</span></>}
              </button>
              {!isRegister && (
                <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginBottom: 6, letterSpacing: '0.04em' }}>
                  14-day free trial · No credit card required
                </p>
              )}
              <p className="footer-note">ShiftOS · Secure Admin Access</p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}