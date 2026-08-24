import React, { useEffect, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getConsent, setConsent, CONSENT_OPEN_EVENT } from '../utils/consent';
import { matchesPathPrefix } from '../utils/routeMatch';

// Lazy: the banner itself renders on first load, but the legal modal only opens
// if the visitor taps through to the policy. LegalModal statically pulls
// src/legal/legalDocs.js (the full Terms + Privacy + DPA prose, ~6 KB gzipped),
// which has no business in the entry bundle for a click most visitors never make.
const LegalModal = lazy(() => import('./LegalModal'));

// The consent banner governs first-party analytics + enquiry prefill, which only
// exist on the public marketplace (xdrive.my) and dealer storefronts (sub.xdrive.my).
// It has no business on the login flow or any authenticated/internal system page, so
// suppress it there. Path-based, not host-based: internal pages live on the same
// hosts as the public surfaces, so the route is the real discriminator. Boundary-aware
// match (exact or `<prefix>/…`) so a public route can't be caught by a shared prefix.
const INTERNAL_PREFIXES = [
  // auth + onboarding
  '/login', '/buyer-login', '/buyer-signup', '/signup', '/register',
  '/onboarding', '/salesman-onboarding', '/dealer-onboarding', '/choose-plan',
  '/auth', '/reset-password', '/salesman-setup',
  // authenticated panels / internal system
  '/dashboard', '/salesman', '/salesman-lite', '/salesman-premium',
  '/manager', '/accountant', '/fi', '/admin', '/accounts', '/platform', '/account',
];
function isInternalPath(pathname) {
  return matchesPathPrefix(pathname, INTERNAL_PREFIXES);
}

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
  const { pathname } = useLocation();
  const suppressed = isInternalPath(pathname);

  // Decide whether to show on mount, and honor re-open requests.
  useEffect(() => {
    if (suppressed) { setOpen(false); return; }
    const c = getConsent();
    let scrollHandler, timer;
    if (!c.decided) {
      setAnalytics(c.analytics); setPreferences(c.preferences);
      // Scrolling is what surfaces the banner. It stays out of the way on
      // arrival (so it doesn't fight the Google One Tap prompt for the screen on
      // first paint — One Tap only needs strictly-necessary auth storage, which
      // is never gated) and meets the visitor once they've engaged with the page.
      // Threshold is half a screen so it means the same thing on a phone as on a
      // desktop, rather than a fixed 250px that is most of a phone viewport.
      const threshold = Math.min(320, Math.round(window.innerHeight * 0.5));
      const reveal = () => {
        setOpen(true);
        window.removeEventListener('scroll', scrollHandler);
        clearTimeout(timer);
      };
      scrollHandler = () => { if (window.scrollY > threshold) reveal(); };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      // Already scrolled on mount (back-navigation restores the position, and no
      // scroll event fires for that) — check once up front.
      scrollHandler();
      // Fallback for a visitor who never scrolls: they still have to be able to
      // make a choice. It used to be 8s, which fired while people were reading
      // and made the banner look like it appeared on its own. Long now, so
      // scrolling is what actually reveals it in practice — except on a page too
      // short to ever reach the threshold, where the scroll trigger can never
      // fire and the timer is the only way the banner is reachable at all.
      const canScroll = document.documentElement.scrollHeight > window.innerHeight + threshold;
      timer = setTimeout(reveal, canScroll ? 45000 : 6000);
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
  }, [suppressed]);

  if (suppressed || !open) return null;

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
      {showLegal && (
        <Suspense fallback={null}>
          <LegalModal doc="privacy" onClose={() => setShowLegal(false)} />
        </Suspense>
      )}
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
