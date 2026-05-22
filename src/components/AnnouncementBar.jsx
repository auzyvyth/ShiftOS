import React, { useState } from 'react';
import useMarketplaceSettings from '../hooks/useMarketplaceSettings';

export default function AnnouncementBar() {
  const { settings } = useMarketplaceSettings();
  const [dismissed, setDismissed] = useState(false);

  if (!settings.announcement_enabled || !settings.announcement_text || dismissed) return null;

  const bar = (
    <div style={{
      background: 'rgba(220,38,38,0.12)',
      borderBottom: '1px solid rgba(220,38,38,0.2)',
      padding: '9px 48px 9px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <p style={{ fontSize: 13, color: '#fca5a5', fontWeight: 500, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
        {settings.announcement_text}
      </p>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setDismissed(true); }}
        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '4px 6px' }}
        aria-label="Dismiss announcement"
      >
        ×
      </button>
    </div>
  );

  if (settings.announcement_link) {
    return (
      <a href={settings.announcement_link} style={{ textDecoration: 'none', display: 'block' }}>
        {bar}
      </a>
    );
  }
  return bar;
}
