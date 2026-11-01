import React, { useState } from 'react';
import { X } from 'lucide-react';
import { coachCopy } from './coachCopy';

// The dashboard's one coach card (COACH-1): the live car silent the longest
// (`pickSilentCar`), with "Show me how", which opens the share tour on the
// Listings tab. Renders nothing when no car is silent, so it never nags a
// seller whose cars are being seen.
// The X hides it until tomorrow on this device (owner, 2026-11-01), the same
// rule as the Premium status banner: never for good, or a seller who closed it
// once would never hear about a silent car again.
const CLOSED_KEY = 'xd_silent_card_closed';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });

export default function SilentCarCard({ pick, lang, colors, onShowMe }) {
  const [closed, setClosed] = useState(() => {
    try { return localStorage.getItem(CLOSED_KEY) === today(); } catch { return false; }
  });
  if (!pick || closed) return null;
  const copy = coachCopy(lang).card;
  const close = () => {
    setClosed(true);
    try { localStorage.setItem(CLOSED_KEY, today()); } catch { /* private mode */ }
  };
  return (
    <div data-coach-kind="silent-card" style={{ position: 'relative', background: colors.card, borderRadius: colors.radius ?? 16, padding: '16px 18px', margin: '0 0 16px' }}>
      <button
        type="button"
        onClick={close}
        aria-label={copy.close}
        title={copy.close}
        style={{ position: 'absolute', top: 6, right: 6, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: 'none', background: 'none', color: colors.sub, cursor: 'pointer' }}
      >
        <X size={16} />
      </button>
      <p style={{ margin: '0 0 6px', paddingRight: 28, fontSize: 15, fontWeight: 600, color: colors.text, lineHeight: 1.35 }}>
        {copy.title(pick.car, pick.step)}{copy.more(pick.count)}
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{copy.body}</p>
      {/* Raised red key (keys.css, loaded by both seller panels). No inline
          background: it would beat the class and flatten the key. */}
      <button
        type="button"
        className="lk-red"
        onClick={() => onShowMe(pick.car)}
        style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 'none', color: colors.onAccent, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {copy.btn}
      </button>
    </div>
  );
}
