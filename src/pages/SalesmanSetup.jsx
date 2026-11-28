import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, INITIAL_URL } from '../supabaseClient';
import { resolvePostAuthRoute, goPostAuth, POST_AUTH_COLUMNS } from '../utils/postAuthRoute';
import { authErrorMessage, reportAuthFailure } from '../utils/authErrors';
import ProfileLoadError from '../components/ProfileLoadError';
import LeadAlertsStep from '../components/onboarding/LeadAlertsStep';
import { useTranslation } from 'react-i18next';

const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// The page a set-up email lands on, for a seller whose account somebody else
// made (a dealer's Team tab, or the platform console's "Set up a seller").
// Their name, page and cars already exist, so the ONE thing missing is a
// password: two fields and a consent tick, then straight into the dashboard.
// Photo, bio and the ID check are offered inside the dashboard instead (the
// "Get verified" card), never as a gate here.
//
// The emailed link carries `?token_hash=...&type=recovery` (create-salesman).
// The token is only spent when the seller presses the button, via verifyOtp.
// Supabase's own action link spent it on the first GET, so a mail scanner, a
// second tap, or a newer email sent seconds later left them on a code screen
// asking for a 6-digit code they were never sent (2026-10-12).
//
// Older emails still arrive via /reset-password?flow=setup with the session
// already live; that path shows the same form and skips the verify.
export default function SalesmanSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // loading | form | expired | alerts | done
  const [phase, setPhase] = useState('loading');
  // PUSH-ONBOARD: who to send where once the alerts step is done.
  const [handoff, setHandoff] = useState(null);
  const [tokenHash, setTokenHash] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(INITIAL_URL.includes('?') ? INITIAL_URL.slice(INITIAL_URL.indexOf('?') + 1).split('#')[0] : '');
    const th = query.get('token_hash');
    if (th && query.get('type') === 'recovery') {
      setTokenHash(th);
      setPhase('form');
      return;
    }
    // Legacy link: the recovery session was set up before we got here.
    supabase.auth.getSession().then(({ data }) => setPhase(data.session ? 'form' : 'expired'));
  }, []);

  const finish = async () => {
    if (!STRONG_PW.test(password)) { setError('8+ characters, with an uppercase letter, a lowercase letter, a number and a symbol.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (!consent) { setError('Tick the box to agree to the Terms and Privacy Policy.'); return; }
    setError('');
    setLoading(true);
    try {
      let session = null;
      if (tokenHash) {
        const { data, error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        if (vErr || !data?.session) {
          if (vErr) reportAuthFailure('setup_verify', vErr);
          // Expired, already used, or replaced by a newer email: Supabase
          // answers all three the same way, so the copy covers all three.
          setPhase('expired');
          return;
        }
        session = data.session;
        // The token is spent; keep it out of history and the address bar.
        window.history.replaceState(null, '', '/salesman-setup');
      } else {
        session = (await supabase.auth.getSession()).data.session;
        if (!session) { setPhase('expired'); return; }
      }
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        reportAuthFailure('setup_set_password', pwErr);
        setError(authErrorMessage(pwErr));
        // The link is spent but the session is live, so a retry needs no token.
        setTokenHash(null);
        return;
      }
      // Whoever set the account up may still be signed in with the temporary
      // password; once the seller has their own, nobody else stays in.
      await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
      const now = new Date().toISOString();
      // setup_complete: the dealer Team tab and the console key their
      // "pending setup / send setup email" state off it.
      // Whoever set the account up was signed in as this seller, so every
      // first-run intro already played for THEM and was marked done on the
      // account (Yazeed, 2026-10-17: landed on a dashboard with no tour). This
      // is the handover, so the seller starts like a fresh signup: dashboard
      // tour and starter checklist both come back. Self-signups never reach
      // this page, so nothing they have seen is reset.
      await supabase.from('profiles')
        .update({
          pdpa_consent: true, pdpa_consent_at: now, setup_complete: true,
          onboarding_tour_done: false, starter_tasks: {},
        })
        .eq('id', session.user.id);
      const { data: profile, error: profileErr } = await supabase.from('profiles').select(POST_AUTH_COLUMNS).eq('id', session.user.id).maybeSingle();
      // The password is saved; a failed read here is the database stalling.
      // Retry goes via /login, which forwards a signed-in seller to their panel.
      if (profileErr) { setProfileLoadFailed(true); return; }
      // PUSH-ONBOARD: lead alerts are the last step here too. A console-made
      // seller is exactly who never opened Settings to find the toggle.
      setHandoff({ profile, session, userId: session.user.id });
      setPhase('alerts');
    } catch (err) {
      reportAuthFailure('setup_finish', err);
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (profileLoadFailed) return <ProfileLoadError onRetry={() => window.location.assign('/login')} />;

  if (phase === 'alerts' && handoff) return (
    <LeadAlertsStep
      userId={handoff.userId}
      onDone={() => {
        setPhase('done');
        setTimeout(() => {
          if (handoff.profile) goPostAuth(resolvePostAuthRoute(handoff.profile, { session: handoff.session }), navigate);
          else navigate('/login', { replace: true });
        }, 900);
      }}
    />
  );

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.brand}>
        <div className="ss-pulse" style={S.icon}>⚡</div>
        <img src="/drevo-logo-white.png" alt="Drevo" width="688" height="120" style={{ height: 21, width: 'auto', display: 'block' }} />
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
          <h2 style={{ ...S.heading, textAlign: 'center' }}>{t("setupPage.thisLinkNoLongerWorks")}</h2>
          <p style={{ ...S.body, textAlign: 'center' }}>
            {t("setupPage.itHasExpiredWasAlready")}
          </p>
          <button style={S.btn} onClick={() => navigate('/login')}>{t("setupPage.goToSignIn")}</button>
        </div>
      )}

      {phase === 'done' && (
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={S.successIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p style={{ color: '#4ade80', fontSize: 14, marginTop: 12, fontWeight: 500 }}>{t("setupPage.passwordSet")}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{t("setupPage.openingYourDashboard")}</p>
          </div>
        </div>
      )}

      {phase === 'form' && (
        <form style={S.card} onSubmit={(e) => { e.preventDefault(); if (!loading) finish(); }}>
          <p style={S.eyebrow}>{t("setupPage.yourAccountIsReady")}</p>
          <h2 style={S.heading}>{t("setupPage.setYourPassword")}</h2>
          <p style={S.body}>{t("setupPage.chooseAPasswordAndYou")}</p>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label} htmlFor="ss-pw">{t("setupPage.newPassword")}</label>
            <div style={{ position: 'relative' }}>
              <input id="ss-pw" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={t("setupPage.min8CharsMixedSymbol")} style={S.input} autoComplete="new-password" />
              <button type="button" style={S.eyeBtn} onClick={() => setShowPw(p => !p)}>{showPw ? t("setupPage.hide") : t("setupPage.show")}</button>
            </div>
            {password && !STRONG_PW.test(password) && <p style={S.verr}>{t("setupPage.8CharsUppercaseLowercaseNumber")}</p>}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={S.label} htmlFor="ss-confirm">{t("setupPage.confirmPassword")}</label>
            <input id="ss-confirm" type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={t("setupPage.typeItAgain")} style={S.input} autoComplete="new-password" />
            {confirm && confirm !== password && <p style={S.verr}>{t("setupPage.passwordsDonTMatch")}</p>}
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: '#dc2626', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
              {t("setupPage.iAgreeToThe")} <a href="/terms" target="_blank" rel="noreferrer" style={S.link}>{t("setupPage.terms")}</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={S.link}>{t("setupPage.privacyPolicy")}</a>{t("setupPage.andConsentToMyData")}
            </span>
          </label>

          {error && <div role="alert" style={S.errorBox}>{error}</div>}
          <button type="submit" style={{ ...S.btn, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} disabled={loading}>
            {loading ? t("setupPage.settingUp") : t("setupPage.setPasswordAndEnter")}
          </button>
        </form>
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
