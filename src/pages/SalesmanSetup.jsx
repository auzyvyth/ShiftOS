import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MY_STATES, cityOptionsFor, matchKnownLocation } from '../utils/locations';

const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('60')) return '+' + d;
  if (d.startsWith('0')) return '+6' + d;
  return '+60' + d;
}
const validIC = (ic) => /^\d{12}$/.test((ic || '').replace(/-/g, ''));


// Onboarding page for a dealer-created salesman who clicked the emailed setup
// link. The link is a Supabase recovery action link, so a session is already
// live by the time this mounts. The dealer pre-filled name / phone / slug, so
// this collects: a password, the public-page basics buyers see (photo, title,
// bio) and the personal details (WhatsApp, location, IC) + PDPA consent.
export default function SalesmanSetup() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | setup | expired | done
  const [step, setStep] = useState(0);           // 0 = password, 1 = public page, 2 = details
  const [userId, setUserId] = useState(null);
  const [dealership, setDealership] = useState('');
  const [firstName, setFirstName] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Public page (Step 2)
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');

  // Details (Step 3)
  const [whatsapp, setWhatsapp] = useState('+60');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [ic, setIc] = useState('');
  const [consent, setConsent] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setPhase('expired'); return; }
      setUserId(data.session.user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, dealership, phone, whatsapp_number, ic_number, avatar_url, job_title, bio, city, state')
        .eq('id', data.session.user.id)
        .maybeSingle();
      setDealership(profile?.dealership || '');
      setFirstName((profile?.full_name || '').split(' ')[0] || '');
      setWhatsapp(profile?.whatsapp_number || profile?.phone || '+60');
      if (profile?.ic_number) setIc(profile.ic_number);
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
      if (profile?.job_title) setJobTitle(profile.job_title);
      if (profile?.bio) setBio(profile.bio);
      // Normalized on the way in: this page stored "Pulau Pinang" for months
      // while every other surface stored "Penang", so a returning salesman's
      // own state would not match its own dropdown.
      const loc = matchKnownLocation(profile?.state, profile?.city);
      if (loc.state) setStateVal(loc.state);
      if (loc.city) setCity(loc.city);
      setPhase('setup');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) { subscription.unsubscribe(); resolve(); }
    });
    resolve();
    const t = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => { if (!data.session) setPhase('expired'); });
    }, 4000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (!userId) { setError('Still connecting — try again in a moment.'); return; }
    setError('');
    setAvatarUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setError('Upload failed: ' + upErr.message); setAvatarUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`); // bust cache on re-upload (same path)
    setAvatarUploading(false);
  };

  const goPublic = () => {
    if (!STRONG_PW.test(password)) { setError('8+ chars · uppercase · lowercase · number · special char'); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setError('');
    setStep(1);
  };

  const goDetails = () => {
    if (!avatarUrl) { setError('Add a profile photo so buyers can see who they’re dealing with.'); return; }
    if (jobTitle.trim().length < 2) { setError('Enter your job title (e.g. Sales Consultant).'); return; }
    if (bio.trim().length < 10) { setError('Write a short bio — at least a sentence.'); return; }
    setError('');
    setStep(2);
  };

  const finish = async () => {
    if (whatsapp.replace(/\D/g, '').length < 9) { setError('Enter a valid WhatsApp number.'); return; }
    if (!city.trim()) { setError('Enter the city you’re based in.'); return; }
    if (!stateVal) { setError('Select your state.'); return; }
    if (!validIC(ic)) { setError('Enter a valid 12-digit IC number (e.g. 901231-10-1234).'); return; }
    if (!consent) { setError('Please agree to the Terms & Privacy Policy to continue.'); return; }
    setError('');
    setLoading(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) { setError(pwErr.message); setLoading(false); return; }
    const { error: profErr } = await supabase.from('profiles').update({
      avatar_url: avatarUrl,
      job_title: jobTitle.trim(),
      bio: bio.trim(),
      whatsapp_number: normalizePhone(whatsapp),
      phone: normalizePhone(whatsapp),
      city: city.trim(),
      state: stateVal,
      pdpa_consent: true,
      pdpa_consent_at: new Date().toISOString(),
      onboarding_complete: true,
      // Marks the account fully activated — the dealer's Team tab keys its
      // "pending setup / resend email" state off this flag.
      setup_complete: true,
    }).eq('id', userId);
    if (profErr) { setError(profErr.message); setLoading(false); return; }
    // Hash + store the IC (never plaintext) via set_my_ic.
    const { error: icErr } = await supabase.rpc('set_my_ic', { p_ic: ic.replace(/\D/g, '') });
    if (icErr) { setError(icErr.message === 'invalid_ic' ? 'Enter a valid 12-digit IC number.' : icErr.message); setLoading(false); return; }
    setPhase('done');
    setTimeout(() => navigate('/salesman'), 1600);
  };

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.brand}>
        <div className="ss-pulse" style={S.icon}>⚡</div>
        <span style={S.brandText}>SHIFTOS</span>
      </div>

      {phase === 'loading' && (
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          <span className="ss-dot" style={S.dot}>·</span>
          <span className="ss-dot ss-dot2" style={S.dot}>·</span>
          <span className="ss-dot ss-dot3" style={S.dot}>·</span>
        </div>
      )}

      {phase === 'expired' && (
        <div style={S.card}>
          <div style={S.expiredIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={S.heading}>LINK EXPIRED</h2>
          <p style={S.body}>This setup link has expired. Use "Forgot password" on the sign-in page to get a fresh one.</p>
          <button style={S.btn} onClick={() => navigate('/login')}>GO TO SIGN IN</button>
        </div>
      )}

      {phase === 'done' && (
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={S.successIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p style={{ color: '#4ade80', fontSize: 14, marginTop: 12, fontWeight: 500 }}>You're all set!</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>Opening your panel…</p>
          </div>
        </div>
      )}

      {phase === 'setup' && (
        <div style={S.card}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? '#dc2626' : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>

          {step === 0 && (
            <>
              <p style={S.eyebrow}>{dealership ? `Welcome to ${dealership}` : 'Welcome'} · Step 1 of 3</p>
              <h2 style={S.heading}>{firstName ? `HI ${firstName.toUpperCase()},` : 'SET YOUR PASSWORD'}</h2>
              <p style={S.body}>First, choose a password for your account.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, mixed + symbol" style={S.input} autoComplete="new-password" />
                  <button type="button" style={S.eyeBtn} onClick={() => setShowPw(p => !p)}>{showPw ? 'HIDE' : 'SHOW'}</button>
                </div>
                {password && !STRONG_PW.test(password) && <p style={S.verr}>8+ chars · uppercase · lowercase · number · special char</p>}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>CONFIRM PASSWORD</label>
                <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your password" style={S.input} autoComplete="new-password" onKeyDown={e => { if (e.key === 'Enter') goPublic(); }} />
                {confirm && confirm !== password && <p style={S.verr}>Passwords don't match</p>}
              </div>

              {error && <div style={S.errorBox}>⚠ {error}</div>}
              <button style={S.btn} onClick={goPublic}>CONTINUE</button>
            </>
          )}

          {step === 1 && (
            <>
              <p style={S.eyebrow}>Your public page · Step 2 of 3</p>
              <h2 style={S.heading}>HOW BUYERS SEE YOU</h2>
              <p style={S.body}>This is what appears on your listings and personal page. A real photo and a line about you win trust.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div style={S.avatarWrap}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={{ ...S.uploadBtn, opacity: avatarUploading ? 0.5 : 1 }}>
                    {avatarUploading ? 'Uploading…' : (avatarUrl ? 'Change photo' : 'Upload photo')}
                    <input type="file" accept="image/*" onChange={handleAvatarPick} disabled={avatarUploading} style={{ display: 'none' }} />
                  </label>
                  <p style={S.hint}>A clear headshot. JPG or PNG, max 5 MB.</p>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>JOB TITLE</label>
                <input type="text" value={jobTitle} maxLength={40} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Sales Consultant" style={S.input} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>SHORT BIO</label>
                <textarea value={bio} maxLength={220} onChange={e => setBio(e.target.value)} placeholder="One or two lines — who you are and what you help buyers with." style={{ ...S.input, minHeight: 72, resize: 'vertical', paddingRight: 14 }} />
                <p style={S.hint}>{bio.length}/220</p>
              </div>

              {error && <div style={S.errorBox}>⚠ {error}</div>}
              <button style={S.btn} onClick={goDetails}>CONTINUE</button>
              <button style={S.ghost} onClick={() => { setError(''); setStep(0); }}>BACK</button>
            </>
          )}

          {step === 2 && (
            <>
              <p style={S.eyebrow}>Your details · Step 3 of 3</p>
              <h2 style={S.heading}>ALMOST THERE</h2>
              <p style={S.body}>How buyers reach you and where you’re based — plus identity verification.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>WHATSAPP NUMBER</label>
                <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+60123456789" style={S.input} autoComplete="tel" />
                <p style={S.hint}>Shown to buyers on your listings. Pre-filled by your dealer — edit if needed.</p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={S.label}>CITY</label>
                  <select value={city} disabled={!stateVal} onChange={e => setCity(e.target.value)}
                    style={{ ...S.input, appearance: 'none', cursor: stateVal ? 'pointer' : 'not-allowed', paddingRight: 14, opacity: stateVal ? 1 : 0.5 }}>
                    <option value="" disabled>{stateVal ? 'Select…' : 'Pick a state first'}</option>
                    {cityOptionsFor(stateVal, city).map(c => <option key={c} value={c} style={{ color: '#000' }}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={S.label}>STATE</label>
                  <select value={stateVal} onChange={e => { setStateVal(e.target.value); setCity(''); }} style={{ ...S.input, appearance: 'none', cursor: 'pointer', paddingRight: 14 }}>
                    <option value="" disabled>Select…</option>
                    {MY_STATES.map(s => <option key={s} value={s} style={{ color: '#000' }}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>IC NUMBER (MYKAD)</label>
                <input type="text" value={ic} maxLength={14} onChange={e => setIc(e.target.value.replace(/[^\d-]/g, ''))} placeholder="901231-10-1234" style={S.input} />
                <p style={S.hint}>12 digits. Used for account verification only — stored securely.</p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                  I agree to the ShiftOS <a href="/terms" target="_blank" style={S.link}>Terms</a> and <a href="/privacy" target="_blank" style={S.link}>Privacy Policy</a>, and consent to my data being processed under PDPA 2010.
                </span>
              </label>

              {error && <div style={S.errorBox}>⚠ {error}</div>}
              <button style={{ ...S.btn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} onClick={finish} disabled={loading}>
                {loading ? 'SETTING UP…' : 'ENTER MY DASHBOARD'}
              </button>
              <button style={S.ghost} onClick={() => { setError(''); setStep(1); }} disabled={loading}>BACK</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#080C14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '24px 16px', fontFamily: "system-ui, sans-serif" },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, background: '#dc2626', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  brandText: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 4, color: '#E8EDF5' },
  dot: { fontSize: 22, color: 'rgba(220,38,38,0.8)' },
  card: { width: 'min(430px, 100%)', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 30px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' },
  eyebrow: { fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 500, marginBottom: 8, fontFamily: "system-ui, sans-serif" },
  heading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#E8EDF5', letterSpacing: 2, lineHeight: 1, marginBottom: 10 },
  body: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 22 },
  label: { display: 'block', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 7, fontWeight: 500 },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '13px 54px 13px 14px', color: '#fff', fontFamily: "system-ui, sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 6, lineHeight: 1.5 },
  link: { color: 'rgba(220,38,38,0.75)', textDecoration: 'none' },
  verr: { fontSize: 11, color: '#f87171', marginTop: 6, letterSpacing: '0.03em' },
  errorBox: { background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 4, padding: '10px 14px', color: '#f87171', fontSize: 12, marginBottom: 16 },
  btn: { width: '100%', padding: '14px', background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 3, cursor: 'pointer' },
  ghost: { width: '100%', padding: '12px', marginTop: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(255,255,255,0.45)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, cursor: 'pointer' },
  expiredIcon: { width: 52, height: 52, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' },
  successIcon: { width: 48, height: 48, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
  avatarWrap: { width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  uploadBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#E8EDF5', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  @keyframes ss-pulse { 0%,100% { box-shadow: 0 0 20px rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 36px rgba(220,38,38,0.75), 0 0 60px rgba(220,38,38,0.15); } }
  @keyframes ss-blink { 0%,80%,100% { opacity: 0; } 40% { opacity: 1; } }
  .ss-pulse { animation: ss-pulse 2.4s ease-in-out infinite; }
  .ss-dot { animation: ss-blink 1.4s infinite both; }
  .ss-dot2 { animation-delay: 0.2s; }
  .ss-dot3 { animation-delay: 0.4s; }
`;
