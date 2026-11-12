// The small "posting" mark on a car card (ZERNIO-1): a red ring that spins while the post is
// being sent, then turns green and draws a tick, then the parent removes it. On failure the
// parent shows the sentence instead. Pure CSS/SVG, still under reduced motion.
import React from 'react';

const CSS = `
@keyframes pm-spin { to { transform: rotate(360deg); } }
@keyframes pm-tick { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
@keyframes pm-pop { 0% { transform: scale(.85); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
.pm-spin { transform-origin: 12px 12px; animation: pm-spin .9s linear infinite; }
.pm-done { transform-origin: 12px 12px; animation: pm-pop .35s ease-out; }
.pm-tickp { stroke-dasharray: 24; animation: pm-tick .35s ease-out .1s both; }
@media (prefers-reduced-motion: reduce) { .pm-spin { animation-duration: 2.4s; } .pm-done, .pm-tickp { animation: none; } }
`;

export default function PostStatusMark({ state, size = 22, red = '#dc2626', green = '#5fd3a0' }) {
  const done = state === 'done';
  return (
    <span role="status" aria-label={done ? 'Posted' : 'Posting'} style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
      <style>{CSS}</style>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={done ? 'pm-done' : undefined}>
        {done ? (
          <>
            <circle cx="12" cy="12" r="9" stroke={green} strokeWidth="2.4" />
            <path className="pm-tickp" d="M7.5 12.5l3 3 6-6.5" stroke={green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" stroke={red} strokeOpacity=".22" strokeWidth="2.4" />
            <path className="pm-spin" d="M12 3a9 9 0 0 1 9 9" stroke={red} strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}
