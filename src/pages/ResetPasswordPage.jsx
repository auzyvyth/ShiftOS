import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

async function redirectByRole(session, navigate) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subdomain, dealer_id, onboarding_complete')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile) {
    navigate('/onboarding');
    return;
  }

  const { role, subdomain, dealer_id } = profile;

  if ((role === 'dealer' || role === 'superadmin') && profile.onboarding_complete === false) {
    navigate('/onboarding');
    return;
  }

  if (role === 'dealer' || role === 'superadmin') {
    if (subdomain) {
      const accessToken = session.access_token;
      const refreshToken = session.refresh_token;
      window.location.href = `https://${subdomain}.xdrive.my?access_token=${accessToken}&refresh_token=${refreshToken}`;
    } else {
      navigate('/dashboard');
    }
  } else if (role === 'salesman') {
    navigate(dealer_id ? '/salesman' : '/salesman-lite');
  } else if (role === 'manager') {
    navigate('/manager');
  } else if (role === 'accountant') {
    navigate('/accountant');
  } else if (role === 'fi_officer') {
    navigate('/fi');
  } else if (role === 'admin') {
    navigate('/admin');
  } else {
    navigate('/salesman');
  }
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | reset | expired
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const isRecovery =
      window.location.href.includes('type=recovery') ||
      window.location.hash.includes('type=recovery');

    supabase.auth.getSession().then(({ data, error: err }) => {
      if (err || !data.session) {
        setPhase('expired');
        return;
      }
      if (isRecovery) {
        setPhase('reset');
      } else {
        redirectByRole(data.session, navigate);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!STRONG_PW.test(password)) {
      setError('8+ chars · uppercase · lowercase · number · special char');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login'), 2000);
  };

  if (phase === 'loading') {
    return (
      <div style={styles.root}>
        <style>{CSS}</style>
        <div style={styles.brand}>
          <div className="rp-pulse" style={styles.icon}>⚡</div>
          <span style={styles.brandText}>SHIFTOS</span>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          <span className="rp-dot" style={styles.dot}>·</span>
          <span className="rp-dot rp-dot2" style={styles.dot}>·</span>
          <span className="rp-dot rp-dot3" style={styles.dot}>·</span>
        </div>
        <p style={styles.subLabel}>VERIFYING</p>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div style={styles.root}>
        <style>{CSS}</style>
        <div style={styles.brand}>
          <div style={styles.icon}>⚡</div>
          <span style={styles.brandText}>SHIFTOS</span>
        </div>
        <div style={styles.card}>
          <div style={styles.expiredIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={styles.cardHeading}>LINK EXPIRED</h2>
          <p style={styles.cardBody}>
            This link has expired. Request a new one.
          </p>
          <button style={styles.btnPrimary} onClick={() => navigate('/login')}>
            BACK TO SIGN IN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{CSS}</style>
      <div style={styles.brand}>
        <div className="rp-pulse" style={styles.icon}>⚡</div>
        <span style={styles.brandText}>SHIFTOS</span>
      </div>

      <div style={{ ...styles.card, opacity: 1 }}>
        <p style={styles.eyebrow}>ACCOUNT SECURITY</p>
        <h2 style={styles.cardHeading}>SET NEW PASSWORD</h2>

        {done ? (
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <div style={styles.successIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ color: '#4ade80', fontSize: 14, marginTop: 12, fontWeight: 500 }}>
              Password updated!
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>
              Redirecting to sign in…
            </p>
          </div>
        ) : (
          <>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>NEW PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 chars, mixed + symbol"
                  style={styles.input}
                  autoComplete="new-password"
                />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(p => !p)}>
                  {showPw
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {password && !STRONG_PW.test(password) && (
                <p style={styles.verr}>8+ chars · uppercase · lowercase · number · special char</p>
              )}
            </div>

            <div style={styles.fieldWrap}>
              <label style={styles.label}>CONFIRM PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  style={styles.input}
                  autoComplete="new-password"
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowConfirm(p => !p)}>
                  {showConfirm
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {confirm && confirm !== password && (
                <p style={styles.verr}>Passwords don't match</p>
              )}
            </div>

            {error && (
              <div style={styles.errorBox}>⚠ {error}</div>
            )}

            <button
              style={{ ...styles.btnPrimary, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'UPDATING…' : 'SET NEW PASSWORD'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#080C14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: '24px 16px',
    fontFamily: "'DM Sans', sans-serif",
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 34,
    height: 34,
    background: '#dc2626',
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  brandText: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 26,
    letterSpacing: 4,
    color: '#E8EDF5',
  },
  subLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 12,
    letterSpacing: 4,
    color: 'rgba(232,237,245,0.3)',
    marginTop: 2,
  },
  dot: {
    fontSize: 22,
    color: 'rgba(220,38,38,0.8)',
  },
  card: {
    width: 'min(420px, 100%)',
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '40px 36px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: '#dc2626',
    fontWeight: 500,
    marginBottom: 8,
    fontFamily: "'DM Sans', sans-serif",
  },
  cardHeading: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 36,
    color: '#E8EDF5',
    letterSpacing: 2,
    lineHeight: 1,
    marginBottom: 28,
  },
  cardBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  fieldWrap: {
    marginBottom: 18,
  },
  label: {
    display: 'block',
    fontSize: 10,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 7,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    padding: '13px 40px 13px 14px',
    color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.25)',
    display: 'flex',
  },
  verr: {
    fontSize: 11,
    color: '#f87171',
    marginTop: 6,
    letterSpacing: '0.03em',
  },
  errorBox: {
    background: 'rgba(220,38,38,0.1)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: 4,
    padding: '10px 14px',
    color: '#f87171',
    fontSize: 12,
    marginBottom: 16,
  },
  btnPrimary: {
    width: '100%',
    padding: '14px',
    background: '#dc2626',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 17,
    letterSpacing: 3,
    cursor: 'pointer',
  },
  expiredIcon: {
    width: 52,
    height: 52,
    background: 'rgba(220,38,38,0.08)',
    border: '1px solid rgba(220,38,38,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px',
  },
  successIcon: {
    width: 48,
    height: 48,
    background: 'rgba(74,222,128,0.08)',
    border: '1px solid rgba(74,222,128,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap');
  @keyframes rp-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(220,38,38,0.4); }
    50% { box-shadow: 0 0 36px rgba(220,38,38,0.75), 0 0 60px rgba(220,38,38,0.15); }
  }
  @keyframes rp-blink {
    0%, 80%, 100% { opacity: 0; }
    40% { opacity: 1; }
  }
  .rp-pulse { animation: rp-pulse 2.4s ease-in-out infinite; }
  .rp-dot { animation: rp-blink 1.4s infinite both; }
  .rp-dot2 { animation-delay: 0.2s; }
  .rp-dot3 { animation-delay: 0.4s; }
`;
