import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getConsent, setConsent, CONSENT_OPEN_EVENT } from '../utils/consent';
import LegalModal from './LegalModal';

// Tiered first-party cookie/consent banner for the public marketplace + storefronts.
// No third-party cookies are used anywhere — this governs first-party analytics
// (trackEvent -> analytics_events) and the "remember my details" prefill only.
// Necessary/security storage (auth session, Turnstile) is always on and not gated.
//
// Mounted once at the app root. Shows on first visit (no stored decision) and can
// be re-opened later via openConsentSettings() from a "Cookie settings" link.
export default function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [preferences, setPreferences] = useState(true);
  const [showLegal, setShowLegal] = useState(false);

  // Decide whether to show on mount, and honor re-open requests.
  useEffect(() => {
    const c = getConsent();
    let scrollHandler, timer;
    if (!c.decided) {
      setAnalytics(c.analytics); setPreferences(c.preferences);
      // Defer the banner so it doesn't fight the Google One Tap prompt for the
      // screen on first paint (One Tap only needs strictly-necessary auth
      // storage, which is never gated). Reveal it once the visitor scrolls into
      // the page, with a timed fallback so a non-scrolling visitor still gets
      // the choice.
      const reveal = () => {
        setOpen(true);
        window.removeEventListener('scroll', scrollHandler);
        clearTimeout(timer);
      };
      scrollHandler = () => { if (window.scrollY > 250) reveal(); };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      timer = setTimeout(reveal, 8000);
    }
    const reopen = () => {
      const cur = getConsent();
      setAnalytics(cur.analytics); setPreferences(cur.preferences);
      setCustomize(true); setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
      if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!open) return null;

  const save = (a, p) => { setConsent({ analytics: a, preferences: p }); setOpen(false); setCustomize(false); };
  const acceptAll = () => save(true, true);
  const rejectAll = () => save(false, false);
  const saveChoices = () => save(analytics, preferences);

  const btnBase = {
    padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent', whiteSpace: 'nowrap',
  };

  return (
    <>
      {createPortal(
        <div
          role="dialog"
          aria-label="Cookie preferences"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100000,
            background: '#ffffff',
            borderTop: '1px solid #ECEAE3',
            boxShadow: '0 -12px 40px rgba(15,23,42,0.14)',
            padding: 'max(18px, env(safe-area-inset-bottom, 18px)) 18px 18px',
            fontFamily: 'system-ui, sans-serif', color: '#0f1115',
          }}
        >
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0f1115' }}>We value your privacy</p>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, lineHeight: 1.6, color: '#4b5563' }}>
              We use first-party storage only (no third-party tracking cookies) to keep the site working, measure
              how listings perform, and remember your details on this device so you don&apos;t retype them. You choose
              what&apos;s on. See our{' '}
              <button type="button" onClick={() => setShowLegal(true)}
                style={{ background: 'none', border: 'none', padding: 0, color: '#dc2626', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>
                Privacy Policy
              </button>.
            </p>

            {customize && (
              <div style={{ margin: '14px 0 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ConsentRow
                  title="Strictly necessary" desc="Login session, security checks. Always on."
                  checked disabled onChange={() => {}}
                />
                <ConsentRow
                  title="Analytics" desc="Anonymous listing views and clicks so dealers can see what buyers look at."
                  checked={analytics} onChange={() => setAnalytics(v => !v)}
                />
                <ConsentRow
                  title="Preferences" desc="Remember your name, phone and state on this device to prefill enquiry forms."
                  checked={preferences} onChange={() => setPreferences(v => !v)}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <button onClick={acceptAll} style={{ ...btnBase, background: '#dc2626', color: '#fff' }}>Accept all</button>
              <button onClick={rejectAll} style={{ ...btnBase, background: '#fff', color: '#0f1115', border: '1px solid #d1d5db' }}>Reject non-essential</button>
              {customize ? (
                <button onClick={saveChoices} style={{ ...btnBase, background: '#F5F3EE', color: '#0f1115', border: '1px solid #d1d5db' }}>Save choices</button>
              ) : (
                <button onClick={() => setCustomize(true)} style={{ ...btnBase, background: 'transparent', color: '#6b7280', border: 'none', textDecoration: 'underline' }}>Customize</button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <LegalModal doc={showLegal ? 'privacy' : null} onClose={() => setShowLegal(false)} />
    </>
  );
}

function ConsentRow({ title, desc, checked, disabled, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: disabled ? 'default' : 'pointer' }}>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={title} disabled={disabled}
        onClick={disabled ? undefined : onChange}
        style={{
          flexShrink: 0, marginTop: 2, width: 38, height: 22, borderRadius: 999, border: 'none',
          background: checked ? '#dc2626' : '#d1d5db', position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.15s',
        }} />
      </button>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0f1115' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{desc}</span>
      </span>
    </label>
  );
}
