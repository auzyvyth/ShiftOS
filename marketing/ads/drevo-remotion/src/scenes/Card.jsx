// Chapter card: a hard cut to full Drevo red between topics, so a viewer knows the subject changed.
// "Sekarang:" + the topic, the chapter number as a big shape behind. Cuts in and out with no fade.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COPY, CHAPTER, FPS, pop, clamp, ease } from '../lib';
import { FONT } from '../ui';

// now / topic / num override the main ad's copy, so other ads reuse the same card.
export const Card = ({ k, lang, now, topic, num }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const C = COPY[lang].card;
  // the topic slams in from big; "Sekarang:" is readable from the first frame
  const p = pop(f, 0.02, FPS, { damping: 14, stiffness: 260, mass: 0.6 });
  const drift = interpolate(t, [0, 0.75], [1.08, 1], { ...clamp, easing: ease });
  const nowIn = interpolate(t, [0, 0.12], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 42%, #ef4444 0%, #dc2626 45%, #a51b1b 100%)', overflow: 'hidden' }}>
      {/* the chapter number as a big shape, light from above, a long shadow under */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', font: `700 760px/1 ${FONT}`, letterSpacing: -40,
        color: 'rgba(0,0,0,0.13)', transform: `scale(${drift})` }}>{num ?? CHAPTER[k]}</div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 35%, rgba(0,0,0,0.28) 100%)' }} />
      <div style={{ position: 'absolute', left: 70, right: 70, top: 700, textAlign: 'center', fontFamily: FONT }}>
        <div style={{ font: `700 76px/1 ${FONT}`, color: 'rgba(255,255,255,0.88)', letterSpacing: -2, opacity: nowIn, transform: `translateY(${(1 - nowIn) * 24}px)` }}>{now ?? C.now}</div>
        <div style={{ font: `700 164px/0.98 ${FONT}`, color: '#fff', letterSpacing: -6, marginTop: 26, opacity: Math.min(1, p * 2),
          transform: `scale(${1.3 - 0.3 * p})`, textShadow: '0 18px 50px rgba(80,0,0,0.45)' }}>{topic ?? C[k]}</div>
      </div>
    </AbsoluteFill>
  );
};
