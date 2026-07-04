import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Landing page for a dealer-created salesman who clicked the setup link emailed
// by create-salesman. The link is a Supabase recovery action link, so by the time
// this mounts the user already has an authenticated session — they just need to
// set their own password (replacing the temp one) and land in their panel.
export default function SalesmanSetup() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | setup | expired
  const [dealership, setDealership] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery hash is exchanged for a session asynchronously; wait for it.
    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setPhase('expired'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, dealership, role')
        .eq('id', data.session.user.id)
        .maybeSingle();
      setDealership(profile?.dealership || '');
      setFirstName((profile?.full_name || '').split(' ')[0] || '');
      setPhase('setup');
    };
    // Give supabase-js a beat to parse the URL hash into a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) { subscription.unsubscribe(); resolve(); }
    });
    resolve();
    const t = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => { if (!data.session) setPhase('expired'); });
    }, 4000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const submit = async () => {
    if (!STRONG_PW.test(password)) {
      setError('8+ chars · uppercase · lowercase · number · special char');
      return;
    }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    setDone(true);
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

      {phase === 'setup' && (
        <div style={S.card}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={S.successIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <p style={{ color: '#4ade80', fontSize: 14, marginTop: 12, fontWeight: 500 }}>You're all set!</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>Opening your panel…</p>
            </div>
          ) : (
            <>
              <p style={S.eyebrow}>{dealership ? `Welcome to ${dealership}` : 'Welcome'}</p>
              <h2 style={S.heading}>{firstName ? `HI ${firstName.toUpperCase()},` : 'SET YOUR PASSWORD'}</h2>
              <p style={S.body}>Set a password to finish setting up your salesman account and access your dashboard.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>NEW PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 chars, mixed + symbol"
                    style={S.input}
                    autoComplete="new-password"
                  />
                  <button type="button" style={S.eyeBtn} onClick={() => setShowPw(p => !p)}>{showPw ? 'HIDE' : 'SHOW'}</button>
                </div>
                {password && !STRONG_PW.test(password) && (
                  <p style={S.verr}>8+ chars · uppercase · lowercase · number · special char</p>
                )}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>CONFIRM PASSWORD</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  style={S.input}
                  autoComplete="new-password"
                  onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                />
                {confirm && confirm !== password && <p style={S.verr}>Passwords don't match</p>}
              </div>

              {error && <div style={S.errorBox}>⚠ {error}</div>}

              <button style={{ ...S.btn, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} onClick={submit} disabled={loading}>
                {loading ? 'SETTING UP…' : 'ENTER MY DASHBOARD'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#080C14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '24px 16px', fontFamily: "'DM Sans', sans-serif" },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, background: '#dc2626', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  brandText: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 4, color: '#E8EDF5' },
  dot: { fontSize: 22, color: 'rgba(220,38,38,0.8)' },
  card: { width: 'min(420px, 100%)', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' },
  eyebrow: { fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 500, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" },
  heading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: '#E8EDF5', letterSpacing: 2, lineHeight: 1, marginBottom: 12 },
  body: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 24 },
  label: { display: 'block', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 7, fontWeight: 500 },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '13px 54px 13px 14px', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em' },
  verr: { fontSize: 11, color: '#f87171', marginTop: 6, letterSpacing: '0.03em' },
  errorBox: { background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 4, padding: '10px 14px', color: '#f87171', fontSize: 12, marginBottom: 16 },
  btn: { width: '100%', padding: '14px', background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 3, cursor: 'pointer' },
  expiredIcon: { width: 52, height: 52, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' },
  successIcon: { width: 48, height: 48, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap');
  @keyframes ss-pulse { 0%,100% { box-shadow: 0 0 20px rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 36px rgba(220,38,38,0.75), 0 0 60px rgba(220,38,38,0.15); } }
  @keyframes ss-blink { 0%,80%,100% { opacity: 0; } 40% { opacity: 1; } }
  .ss-pulse { animation: ss-pulse 2.4s ease-in-out infinite; }
  .ss-dot { animation: ss-blink 1.4s infinite both; }
  .ss-dot2 { animation-delay: 0.2s; }
  .ss-dot3 { animation-delay: 0.4s; }
`;
