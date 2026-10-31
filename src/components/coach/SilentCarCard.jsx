import React from 'react';
import { coachCopy } from './coachCopy';

// The dashboard's one coach card (COACH-1): the live car silent the longest
// (`pickSilentCar`), with "Show me how", which opens the share tour on the
// Listings tab. Renders nothing when no car is silent, so it never nags a
// seller whose cars are being seen.
export default function SilentCarCard({ pick, lang, colors, onShowMe }) {
  if (!pick) return null;
  const copy = coachCopy(lang).card;
  return (
    <div data-coach-kind="silent-card" style={{ background: colors.card, borderRadius: colors.radius ?? 16, padding: '16px 18px', margin: '0 0 16px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: colors.text, lineHeight: 1.35 }}>
        {copy.title(pick.car, pick.step)}{copy.more(pick.count)}
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{copy.body}</p>
      <button
        type="button"
        onClick={() => onShowMe(pick.car)}
        style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 'none', background: colors.accent, color: colors.onAccent, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {copy.btn}
      </button>
    </div>
  );
}
