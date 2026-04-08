import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AuthConfirmPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') || 'email';

    if (!token_hash) {
      setErrorMsg('Invalid confirmation link — no token found.');
      setStatus('error');
      return;
    }

    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        console.error('[AuthConfirmPage] verifyOtp error:', error.message);
        setErrorMsg(error.message);
        setStatus('error');
      } else {
        navigate('/onboarding', { replace: true });
      }
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '24px 16px', background: '#0a0a0c', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
        <span style={{ width: 30, height: 30, background: '#dc2626', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>S</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 3, fontSize: 28 }}>ShiftOS</span>
      </div>
      <div style={{ width: 'min(420px, 100%)', background: '#111114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
        {status === 'verifying' ? (
          <>
            <div style={{ width: 48, height: 48, border: '2px solid rgba(220,38,38,0.3)', borderTop: '2px solid #dc2626', borderRadius: '50%', margin: '0 auto 24px', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Verifying your email…</p>
          </>
        ) : (
          <>
            <div style={{ width: 56, height: 56, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#fff', letterSpacing: 2, marginBottom: 12 }}>VERIFICATION FAILED</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.6 }}>{errorMsg}</p>
            <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '13px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
