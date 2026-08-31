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

  // This bar only ever renders inside MarketplaceHeader, i.e. on the LIGHT
  // marketplace. It used to be styled for a dark surface — pale red-300 text on
  // a 12%-alpha red that composited over the near-black body background — so it
  // read as a black band sitting on top of a white header. Light palette now:
  // red-50 ground, red-800 text (7.6:1).
  const bar = (
    <div style={{
      background: '#FEF2F2',
      borderBottom: '1px solid rgba(220,38,38,0.18)',
      padding: '9px 48px 9px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <p style={{ fontSize: 13, color: '#991b1b', fontWeight: 500, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {settings.announcement_text}
      </p>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setDismissed(true); }}
        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4b5563', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '4px 6px' }}
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
