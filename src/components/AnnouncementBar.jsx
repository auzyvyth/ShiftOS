import React, { useState } from 'react';
import useMarketplaceSettings from '../hooks/useMarketplaceSettings';

// Only http(s) and site-relative destinations. The href comes from a DB column
// (marketplace_settings.announcement_link, superadmin-writable) and React does
// not block a `javascript:` URL — it only warns — so the check has to be here.
// Anything else renders the bar with no link rather than a live one.
function safeHref(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  return /^https?:\/\//i.test(v) ? v : null;
}

export default function AnnouncementBar() {
  const { settings } = useMarketplaceSettings();
  const [dismissed, setDismissed] = useState(false);

  if (!settings.announcement_enabled || !settings.announcement_text || dismissed) return null;

  // This bar renders directly above MarketplaceHeader, which is now a DARK bar,
  // so the bar is dark too — a light strip capping a black masthead was the one
  // remaining palette break at the top of the page.
  // The original bug this file carries a scar from was NOT "dark": it was a
  // TRANSLUCENT 12%-alpha red that composited over whatever was behind it, under
  // a white header, so it rendered as a black band on top of white. The fix then
  // and the rule now is the same — paint an EXPLICIT OPAQUE colour, and paint it
  // to match the surface it actually sits on. #232932 is one step DARKER than the
  // header's charcoal #2B323D, so the very top of the page caps the masthead
  // without competing with it, and the red hairline stays as the "this is an
  // announcement" signal.
  const bar = (
    <div style={{
      background: '#232932',
      borderBottom: '1px solid rgba(220,38,38,0.35)',
      padding: '9px 48px 9px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 500, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {settings.announcement_text}
      </p>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setDismissed(true); }}
        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '4px 6px' }}
        aria-label="Dismiss announcement"
      >
        ×
      </button>
    </div>
  );

  const href = safeHref(settings.announcement_link);
  if (href) {
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {bar}
      </a>
    );
  }
  return bar;
}
