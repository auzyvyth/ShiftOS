// Shared pieces for scenes built on real phone screenshots (harness captures at 390x844, 3x):
// a crop, a rise-in, a ring on an element, a tapping cursor. Used by the intro ad and the daily posts.
import React from 'react';
import { Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { FPS, pop, clamp, ease } from './lib';
import { RED } from './ui';

// A crop of a real phone screenshot (CSS px of the 390x844 capture, taken at 3x), shown `width` px wide.
export const Shot = ({ src, crop, width, radius = 22, children }) => {
  const k = width / crop.w;
  return (
    <div style={{ position: 'relative', width, height: crop.h * k, borderRadius: radius * k, overflow: 'hidden',
      boxShadow: '0 50px 110px rgba(11,12,15,0.30), 0 14px 30px rgba(11,12,15,0.18)' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', width: 390 * k, height: 844 * k, left: -crop.x * k, top: -crop.y * k }} />
      {children?.(k)}
    </div>
  );
};
export const Rise = ({ at = 0, top, children }) => {
  const f = useCurrentFrame(); const p = pop(f, at);
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 90}px) scale(${0.94 + 0.06 * Math.min(1, p)})` }}>{children}</div>;
};
export const Ring = ({ r, crop, k, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f / FPS, [at, at + 0.35], [0, 1], { ...clamp, easing: ease });
  const pad = 5;
  return <div style={{ position: 'absolute', left: (r.x - crop.x - pad) * k, top: (r.y - crop.y - pad) * k, width: (r.w + pad * 2) * k, height: (r.h + pad * 2) * k,
    borderRadius: 12 * k, border: `5px solid ${RED}`, opacity: p, transform: `scale(${1.25 - 0.25 * p})`, boxShadow: '0 0 40px rgba(220,38,38,.45)' }} />;
};
export const Tap = ({ r, crop, k, at }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const move = interpolate(t, [at - 0.7, at - 0.05], [0, 1], { ...clamp, easing: ease });
  const x = (r.x - crop.x + r.w / 2) * k, y = (r.y - crop.y + r.h / 2) * k;
  const since = t - at;
  const ring = since > 0 && since < 0.5 ? since / 0.5 : null;
  return (
    <>
      {ring !== null && <div style={{ position: 'absolute', left: x - 50, top: y - 50, width: 100, height: 100, borderRadius: 50, border: `5px solid ${RED}`, opacity: 1 - ring, transform: `scale(${0.3 + ring * 1.1})` }} />}
      <svg width="54" height="54" viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 8 + (1 - move) * 160, top: y - 5 + (1 - move) * 260, transform: `scale(${since > 0 && since < 0.12 ? 0.82 : 1})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.5))' }}>
        <path d="M4 2l15 11-7 1-3 7z" fill="#0B0C0F" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
};
