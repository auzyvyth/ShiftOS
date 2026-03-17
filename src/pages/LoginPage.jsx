import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [isRegister, setIsRegister] = useState(false);
  const [focused, setFocused] = useState('');
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const photoRef = useRef(null);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
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
    setMounted(true);
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await redirectByRole(data.session.user);
      }
    });
  }, [navigate]);

  const ensureProfileForUser = async (user, fallbackProfile = null) => {
    if (!user?.id) return null;

    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to check existing profile:', fetchError.message);
      return null;
    }

    if (existingProfile) return existingProfile;

    const metadata = user.user_metadata || {};
    const profilePayload = {
      id: user.id,
      full_name: fallbackProfile?.full_name || metadata.full_name || metadata.name || user.email,
      email: fallbackProfile?.email || user.email,
      phone: fallbackProfile?.phone || metadata.phone || null,
      ic: fallbackProfile?.ic || metadata.ic || null,
      dealership: fallbackProfile?.dealership || metadata.dealership || null,
      location: fallbackProfile?.location || metadata.location || null,
      role: fallbackProfile?.role || metadata.role || 'manager',
      avatar_url: fallbackProfile?.avatar_url || metadata.avatar_url || null,
    };

    const { data: insertedProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(profilePayload)
      .select('*')
      .maybeSingle();

    if (insertError) {
      console.error('Failed to create profile after authentication:', insertError.message);
      return null;
    }

    return insertedProfile || profilePayload;
  };

  // ─── Role-based redirect ───────────────────────────────────────────────────
  const redirectByRole = async (user, fallbackProfile = null) => {
    const profile = await ensureProfileForUser(user, fallbackProfile);
    const role = profile?.role || user?.user_metadata?.role || 'manager';

    if (role === 'salesman') {
      navigate('/salesman');
    } else {
      navigate('/dashboard');
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      await redirectByRole(data.user);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setError('');
    const cleanedFullName = fullName.trim();
    const cleanedRegEmail = regEmail.trim();
    const cleanedDealership = dealership.trim();
    const cleanedLocation = location.trim();
    const cleanedRole = role.trim();
    const cleanedIc = formatMalaysianIc(ic);
    const cleanedPhone = formatMalaysianPhone(phone);

    const missingFields = [];
    if (!cleanedFullName) missingFields.push('Full Name');
    if (!cleanedRegEmail) missingFields.push('Email');
    if (!MY_PHONE_REGEX.test(cleanedPhone)) missingFields.push('Phone Number');
    if (!cleanedIc) missingFields.push('IC Number');
    if (!cleanedDealership) missingFields.push('Dealership Name');
    if (!cleanedLocation) missingFields.push('Location');
    if (!cleanedRole) missingFields.push('Job Title');
    if (!regPassword) missingFields.push('Password');

    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(', ')}.`);
      return;
    }
    if (!MY_PHONE_REGEX.test(cleanedPhone)) {
      setError('Phone Number must be a valid Malaysian format: +60 followed by 8 to 10 digits.');
      return;
    }
    if (!MY_IC_REGEX.test(cleanedIc)) {
      setError('IC Number must follow Malaysian format: XXXXXX-XX-XXXX.');
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(regPassword)) {
      setError('Use a strong password with at least 8 characters, including uppercase, lowercase, number, and special character.');
      return;
    }
    if (regPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);

    const registrationProfile = {
      full_name: cleanedFullName,
      email: cleanedRegEmail,
      phone: cleanedPhone,
      ic: cleanedIc,
      dealership: cleanedDealership,
      location: cleanedLocation,
      role: 'manager',
      job_title: cleanedRole,
    };

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: registrationProfile,
      },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    const userId = data.user?.id;
    if (!userId) { setError('Signup failed. Please try again.'); setLoading(false); return; }

    let avatarUrl = null;
    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, photoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }
    }

    if (data.session?.user) {
      if (avatarUrl) {
        await supabase.auth.updateUser({
          data: {
            ...registrationProfile,
            avatar_url: avatarUrl,
          },
        });
      }
      await redirectByRole(data.session.user, { ...registrationProfile, avatar_url: avatarUrl });
      setSuccess('Registration successful! Redirecting...');
    } else {
      setSuccess('Registration submitted! Check your email to confirm your account. Profile will be created on first sign in.');
    }
    setLoading(false);
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setSuccess('');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 24px 16px;
          background: #0a0a0c;
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
          overflow-y: auto;
        }

        .center-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #fff;
          z-index: 2;
        }
        .center-brand-icon {
          width: 30px;
          height: 30px;
          background: #dc2626;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 1px;
        }
        .center-brand-text {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 3px;
          font-size: 28px;
          line-height: 1;
        }

        .login-visual {
          display: none;
        }
        .login-visual::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 30% 60%, rgba(220,38,38,.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 70% 20%, rgba(251,191,36,.07) 0%, transparent 60%);
          pointer-events: none;
        }
        .grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .speedometer-ring {
          position: absolute;
          top: -80px;
          left: -80px;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          border: 1px solid rgba(220,38,38,.15);
          animation: slowspin 30s linear infinite;
        }
        .speedometer-ring::after {
          content: '';
          position: absolute;
          inset: 24px;
          border-radius: 50%;
          border: 1px dashed rgba(220,38,38,.08);
        }
        @keyframes slowspin { to { transform: rotate(360deg); } }

        .brand-logo {
          position: absolute;
          top: 48px;
          left: 48px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          letter-spacing: 4px;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-logo-icon {
          width: 32px;
          height: 32px;
          background: #dc2626;
          clip-path: polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
        }
        .brand-logo-accent { color: #dc2626; }

        .visual-tagline { position: relative; z-index: 2; }
        .visual-tagline h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(52px,6vw,80px);
          line-height: .95;
          color: #fff;
          letter-spacing: 2px;
          margin-bottom: 16px;
        }
        .visual-tagline h1 em { color: #dc2626; font-style: normal; }
        .visual-tagline p { color: rgba(255,255,255,.35); font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 300; }
        .stat-row { display: flex; gap: 32px; margin-top: 32px; }
        .stat { display: flex; flex-direction: column; gap: 2px; }
        .stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #fff; letter-spacing: 1px; }
        .stat-label { font-size: 10px; color: rgba(255,255,255,.25); letter-spacing: 2px; text-transform: uppercase; }
        .divider-v { width: 1px; background: rgba(255,255,255,.08); align-self: stretch; }

        .login-form-panel {
          width: min(560px, 100%);
          background: #111114;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          position: relative;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          box-shadow: 0 30px 80px rgba(0,0,0,.45);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity .6s ease, transform .6s ease;
          overflow: hidden;
          max-height: none;
        }
        .login-form-panel.mounted { opacity: 1; transform: translateY(0); }

        .form-scroll { padding: 40px 40px 0; }

        .form-heading { margin-bottom: 28px; }
        .form-heading .eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #dc2626; font-weight: 500; margin-bottom: 8px; }
        .form-heading h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: #fff; letter-spacing: 2px; line-height: 1; }

        .photo-upload-row { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .photo-circle {
          width: 64px; height: 64px; border-radius: 50%;
          border: 2px dashed rgba(255,255,255,.15); overflow: hidden;
          flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: border-color .2s; background: rgba(255,255,255,.03);
        }
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
        .field input, .field select {
          width: 100%;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 4px;
          padding: 13px 16px;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color .2s, background .2s;
          appearance: none;
        }
        .field select { cursor: pointer; padding-right: 36px; border-radius: 12px; border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.06); box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }
        .field select option { background: #1a1a1e; color: #fff; }
        .field input::placeholder { color: rgba(255,255,255,.12); }
        .field input:focus, .field select:focus { border-color: #dc2626; background: rgba(220,38,38,.05); }
        .field select:focus { box-shadow: 0 0 0 2px rgba(220,38,38,.25); }
        .field-bar { position: absolute; bottom: 0; left: 0; height: 2px; width: 0; background: #dc2626; border-radius: 0 0 12px 12px; transition: width .3s ease; }
        .field input:focus ~ .field-bar, .field select:focus ~ .field-bar { width: 100%; }
        .select-arrow { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: rgba(255,255,255,.45); }

        .pw-toggle {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: 0; cursor: pointer;
          color: rgba(255,255,255,.25); transition: color .2s; display: flex;
        }
        .pw-toggle:hover { color: rgba(255,255,255,.6); }

        .section-sep { border: none; border-top: 1px solid rgba(255,255,255,.06); margin: 16px 0 14px; }
        .section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,.2); margin-bottom: 12px; font-weight: 500; }

        .error-msg { background: rgba(220,38,38,.1); border: 1px solid rgba(220,38,38,.3); border-radius: 4px; padding: 10px 14px; color: #f87171; font-size: 12px; margin-bottom: 14px; letter-spacing: .3px; }
        .success-msg { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.25); border-radius: 4px; padding: 10px 14px; color: #4ade80; font-size: 12px; margin-bottom: 14px; letter-spacing: .3px; }

        .submit-bar { padding: 16px 40px 36px; flex-shrink: 0; }

        .password-hint {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.45;
          color: rgba(255,255,255,.45);
        }
        .password-hint.bad { color: #f87171; }
        .password-hint.ok { color: #4ade80; }

        .password-strength {
          margin-top: 10px;
          display: flex;
          gap: 6px;
        }
        .password-strength span {
          height: 5px;
          border-radius: 999px;
          flex: 1;
          background: rgba(255,255,255,.12);
          transition: background .2s ease;
        }
        .password-strength span.filled {
          background: rgba(220,38,38,.9);
        }
        .password-rules {
          margin-top: 8px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px;
        }
        .password-rule {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: rgba(255,255,255,.45);
          line-height: 1.3;
        }
        .password-rule.ok {
          color: #4ade80;
        }
        .password-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,.2);
          flex-shrink: 0;
        }
        .password-rule.ok .password-dot {
          background: #22c55e;
        }

        .ic-hint {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.35;
          color: rgba(255,255,255,.45);
        }
        .ic-hint.bad { color: #f87171; }
        .ic-hint.ok { color: #4ade80; }

        .phone-hint {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.35;
          color: rgba(255,255,255,.45);
        }
        .phone-hint.bad { color: #f87171; }
        .phone-hint.ok { color: #4ade80; }

        .confirm-hint {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.3;
          color: rgba(255,255,255,.45);
        }
        .confirm-hint.match { color: #4ade80; }
        .confirm-hint.miss { color: #f87171; }
        .btn-submit {
          width: 100%; padding: 15px;
          background: #dc2626;
          border: none; border-radius: 4px; color: #fff;
          font-family: 'Bebas Neue', sans-serif; font-size: 18px;
          letter-spacing: 3px; cursor: pointer; position: relative;
          overflow: hidden; transition: background .2s, transform .1s;
          margin-bottom: 12px;
        }
        .btn-submit:hover:not(:disabled) { background: #b91c1c; }
        .btn-submit:active:not(:disabled) { transform: scale(.99); }
        .btn-submit:disabled { opacity: .5; cursor: not-allowed; }
        .btn-shimmer {
          position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);
          animation: shimmer 2s infinite;
        }
        @keyframes shimmer { from { left: -60%; } to { left: 120%; } }

        .btn-toggle {
          background: none; border: none; color: rgba(255,255,255,.3);
          font-family: 'DM Sans', sans-serif; font-size: 12px; letter-spacing: .5px;
          cursor: pointer; width: 100%; text-align: center; padding: 6px; transition: color .2s;
        }
        .btn-toggle:hover { color: rgba(255,255,255,.6); }
        .btn-toggle span { color: #dc2626; text-decoration: underline; text-underline-offset: 2px; }

        .footer-note { text-align: center; font-size: 10px; color: rgba(255,255,255,.1); letter-spacing: 1px; text-transform: uppercase; padding-top: 14px; }

        .loading-dots span { animation: blink 1.4s infinite both; font-size: 22px; }
        .loading-dots span:nth-child(2) { animation-delay: .2s; }
        .loading-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%,80%,100% { opacity:0; } 40% { opacity:1; } }

        @media (max-width: 1024px) {
          .login-form-panel { width: min(520px, 100%); }
          .form-scroll { padding: 36px 36px 0; }
          .submit-bar { padding: 16px 36px 32px; }
        }
        @media (max-width: 768px) {
          .login-root { overflow-y: auto; padding: 20px 12px; }
          .center-brand-text { font-size: 24px; }
          .login-form-panel { width: 100%; max-width: 520px; min-height: 0; border-radius: 18px; }
          .form-scroll { padding: 34px 24px 0; }
          .submit-bar { padding: 14px 24px 30px; }
          .field-row { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .form-scroll { padding: 30px 18px 0; }
          .submit-bar { padding: 12px 18px 26px; }
          .field-row { grid-template-columns: 1fr; gap: 0; }
          .form-heading h2 { font-size: 34px; }
          .field input, .field select { padding: 12px 14px; font-size: 15px; }
          .btn-submit { font-size: 16px; padding: 14px; letter-spacing: 2px; }
          .photo-circle { width: 56px; height: 56px; }
          .stat-row { gap: 16px; }
        }
        @media (max-width: 360px) {
          .form-scroll { padding: 28px 16px 0; }
          .submit-bar { padding: 12px 16px 36px; }
        }
      `}</style>

      <div className="login-root">
        <div className="center-brand" aria-label="ShiftOS brand">
          <span className="center-brand-icon">S</span>
          <span className="center-brand-text">ShiftOS</span>
        </div>
        <div className="login-visual">
          <div className="grid-lines" />
          <div className="speedometer-ring" />
          <div className="brand-logo">
            <div className="brand-logo-icon" />
            <span>ShiftOS</span>
          </div>
          <div className="visual-tagline">
            <h1>DRIVE YOUR<br /><em>INVENTORY</em><br />FORWARD</h1>
            <p>Admin Portal</p>
            <div className="stat-row">
              <div className="stat"><span className="stat-num">100%</span><span className="stat-label">Uptime</span></div>
              <div className="divider-v" />
              <div className="stat"><span className="stat-num">Live</span><span className="stat-label">Listings</span></div>
              <div className="divider-v" />
              <div className="stat"><span className="stat-num">MY</span><span className="stat-label">Market</span></div>
            </div>
          </div>
        </div>

        <div className={`login-form-panel ${mounted ? 'mounted' : ''}`}>
          <form noValidate onSubmit={e => { e.preventDefault(); isRegister ? handleRegister() : handleLogin(); }} style={{display:'contents'}}>
          <div className="form-scroll">
            <div className="form-heading">
              <p className="eyebrow">{isRegister ? 'New Account' : 'Restricted Access'}</p>
              <h2>{isRegister ? 'REGISTER' : 'SIGN IN'}</h2>
            </div>

            {isRegister ? (
              <>
                <div className="photo-upload-row">
                  <div className="photo-circle" onClick={() => photoRef.current.click()}>
                    {photoPreview
                      ? <img src={photoPreview} alt="preview" />
                      : <div className="photo-placeholder">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          <span>Photo</span>
                        </div>
                    }
                  </div>
                  <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoChange} />
                  <div className="photo-hint">
                    <strong>Profile photo</strong> (optional)<br />
                    JPG or PNG, max 2MB
                  </div>
                </div>

                <p className="section-label">Personal Info</p>
                <Field id="fullName" label="Full Name" focused={focused}>
                  <TextInput id="fullName" placeholder="Ahmad bin Abdullah" value={fullName} onChange={setFullName} onFocusChange={setFocused} />
                </Field>
                <div className="field-row">
                  <Field id="ic" label="IC Number" focused={focused}>
                    <TextInput
                      id="ic"
                      placeholder="010203-10-1234"
                      value={ic}
                      onChange={(value) => setIc(formatMalaysianIc(value))}
                      onFocusChange={setFocused}
                      inputMode="numeric"
                      maxLength={14}
                    />
                    <p className={`ic-hint ${ic ? (isIcValid ? 'ok' : 'bad') : ''}`}>
                      Malaysian IC format: XXXXXX-XX-XXXX
                    </p>
                  </Field>
                  <Field id="phone" label="Phone Number" focused={focused}>
                    <TextInput
                      id="phone"
                      type="tel"
                      placeholder="+60123456789"
                      value={phone}
                      onChange={(value) => setPhone(formatMalaysianPhone(value))}
                      onFocusChange={setFocused}
                      inputMode="numeric"
                      maxLength={13}
                    />
                    <p className={`phone-hint ${phone ? (isPhoneValid ? 'ok' : 'bad') : ''}`}>
                      Malaysian numbers only. Format: +60XXXXXXXXX
                    </p>
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
                    <div className="select-arrow">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
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
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        placeholder="Min 8 characters"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        onFocus={() => setFocused('regPassword')}
                        onBlur={() => setFocused('')}
                        style={{paddingRight: '40px'}}
                      />
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
                        <p className={`password-hint ${regPassword ? (isRegPasswordStrong ? 'ok' : 'bad') : ''}`}>
                          Use at least 8 characters with uppercase, lowercase, number, and special character.
                        </p>
                        <div className="password-strength" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <span key={level} className={passwordScore >= level ? 'filled' : ''} />
                          ))}
                        </div>
                        <div className="password-rules">
                          <p className={`password-rule ${passwordChecks.minLength ? 'ok' : ''}`}><span className="password-dot" />At least 8 characters</p>
                          <p className={`password-rule ${passwordChecks.uppercase ? 'ok' : ''}`}><span className="password-dot" />One uppercase letter (A-Z)</p>
                          <p className={`password-rule ${passwordChecks.lowercase ? 'ok' : ''}`}><span className="password-dot" />One lowercase letter (a-z)</p>
                          <p className={`password-rule ${passwordChecks.number ? 'ok' : ''}`}><span className="password-dot" />One number (0-9)</p>
                          <p className={`password-rule ${passwordChecks.special ? 'ok' : ''}`}><span className="password-dot" />One special character (e.g. !@#$)</p>
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

                {error && <div className="error-msg">⚠ {error}</div>}
                {success && <div className="success-msg">✓ {success}</div>}
              </>
            ) : (
              <>
                <Field id="email" label="Email Address" focused={focused}>
                  <TextInput id="email" type="email" placeholder="admin@shiftos.my" value={email} onChange={setEmail} onFocusChange={setFocused} />
                </Field>
                <Field id="password" label="Password" focused={focused}>
                  <div className="field-inner">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused('')}
                      style={{paddingRight: '40px'}}
                    />
                    <button className="pw-toggle" type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                      {showPassword
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                    <div className="field-bar" />
                  </div>
                </Field>
                {error && <div className="error-msg">⚠ {error}</div>}
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
            <button type="button" className="btn-toggle" onClick={switchMode}>
              {isRegister
                ? <>Already registered? <span>Sign in instead</span></>
                : <>Need an account? <span>Register here</span></>
              }
            </button>
            <p className="footer-note">ShiftOS · Secure Admin Access</p>
          </div>
          </form>
        </div>
      </div>
    </>
  );
}