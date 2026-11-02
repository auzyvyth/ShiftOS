import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, staticFile, continueRender, delayRender } from 'remotion';
import { clamp, ease, lerp, parseLine, sec, pop, FPS } from './lib';

export const RED = '#dc2626';
export const RED2 = '#ef4444';
export const MINT = '#6ee7b7';
export const INK = '#f4f5f7';

// ---------- fonts (local files, loaded before the first frame) ----------
const fontHandle = typeof window !== 'undefined' ? delayRender('fonts') : null;
if (typeof window !== 'undefined') {
  const faces = [
    new FontFace('Outfit', `url(${staticFile('fonts/outfit-latin-500-normal.woff')})`, { weight: '500' }),
    new FontFace('Outfit', `url(${staticFile('fonts/outfit-latin-700-normal.woff')})`, { weight: '700' }),
  ];
  Promise.all(faces.map((f) => f.load().then((l) => document.fonts.add(l)))).then(() => continueRender(fontHandle), () => continueRender(fontHandle));
}
export const FONT = 'Outfit, system-ui, sans-serif';

// ---------- ambient world: near-black, slow red light pools, floor, grain ----------
export const Ambient = ({ hue = RED, intensity = 1 }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const a = (x, y, r, o) => `radial-gradient(${r}px ${r * 0.8}px at ${x}px ${y}px, rgba(220,38,38,${o * intensity}), transparent 70%)`;
  return (
    <AbsoluteFill style={{ background: '#050608' }}>
      <AbsoluteFill style={{ background: [
        a(540 + Math.sin(t * 0.35) * 260, 520 + Math.cos(t * 0.27) * 140, 900, 0.20),
        a(160 + Math.cos(t * 0.22) * 120, 1500 + Math.sin(t * 0.31) * 90, 700, 0.14),
        a(980 + Math.sin(t * 0.19) * 80, 1100 + Math.cos(t * 0.41) * 160, 600, 0.10),
      ].join(',') }} />
      {/* floor: a darker band with a soft horizon line, gives the objects somewhere to stand */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 0%, transparent 62%, rgba(255,255,255,0.025) 62.2%, rgba(0,0,0,0.5) 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.75) 100%)' }} />
      {/* film grain is added at mux time (ffmpeg noise): a blend layer here doubled the render time */}
    </AbsoluteFill>
  );
};

// ---------- kinetic headline: words land with a spring and come out of a blur ----------
export const Headline = ({ lines, eyebrow, at = 0, out = 99, top = 150, size = 104, instant = false }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const exit = lerp(f, sec(out), sec(out + 0.3), 0, 1);
  let k = 0;
  const ebIn = instant ? 1 : lerp(f, sec(at), sec(at + 0.35), 0, 1);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top, textAlign: 'center', fontFamily: FONT }}>
      {eyebrow && (
        <div style={{ font: `700 28px ${FONT}`, letterSpacing: 5, color: RED2, textTransform: 'uppercase', opacity: ebIn * (1 - exit), transform: `translateY(${(1 - ebIn) * 20 - exit * 30}px)`, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: RED2, boxShadow: `0 0 18px ${RED2}` }} />{eyebrow}
        </div>
      )}
      {lines.map((line, li) => (
        <div key={li} style={{ font: `700 ${size}px/1.02 ${FONT}`, letterSpacing: -4, color: INK }}>
          {parseLine(line).map(({ w, r }, i) => {
            const idx = k++;
            const start = at + (instant ? -1 : idx * 0.065);
            const pulse = instant && r ? 1 + 0.07 * Math.sin(Math.min(1, Math.max(0, (t - 0.3 - idx * 0.05) / 0.35)) * Math.PI) : 1;
            const p = pop(f, start);
            const o = Math.min(1, p * 1.4);
            const blur = (1 - Math.min(1, p)) * 16 + exit * 18;
            return (
              <span key={i} style={{ display: 'inline-block', marginRight: size * 0.24, opacity: o * (1 - exit), filter: (blur) > 0.05 ? `blur(${blur}px)` : 'none',
                transform: `translateY(${(1 - p) * 70 - exit * (50 + idx * 6)}px) scale(${(0.9 + 0.1 * Math.min(1.05, p)) * pulse})`,
                color: r ? RED2 : INK, textShadow: r ? '0 0 50px rgba(239,68,68,.55), 0 0 12px rgba(239,68,68,.35)' : '0 10px 40px rgba(0,0,0,.6)' }}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ---------- glass card: depth from tone + rim light + long soft shadow ----------
export const glass = (extra = {}) => ({
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 50px 120px rgba(0,0,0,0.65), 0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14), 0 0 90px rgba(220,38,38,0.10)',
  borderRadius: 36,
  ...extra,
});

// ---------- a monitor/tablet frame for real screen recordings ----------
export const Device = ({ x, y, w, ratio, children, glow = 1, style = {} }) => {
  const h = w / ratio;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w + 28, height: h + 28, padding: 14, borderRadius: 34, background: 'linear-gradient(160deg,#1b1d22,#0b0c0f)',
      boxShadow: `0 80px 140px rgba(0,0,0,0.7), 0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 ${120 * glow}px rgba(220,38,38,${0.22 * glow})`, ...style }}>
      <div style={{ position: 'relative', width: w, height: h, borderRadius: 22, overflow: 'hidden', background: '#000' }}>
        {children}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 28%)', pointerEvents: 'none' }} />
      </div>
      {/* contact shadow on the floor */}
      <div style={{ position: 'absolute', left: '8%', right: '8%', bottom: -60, height: 50, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,0.75), transparent)', filter: 'blur(6px)' }} />
    </div>
  );
};

// ---------- cursor that moves to each recorded tap (positions are the real buttons) ----------
export const Cursor = ({ clicks, takeT, w, h }) => {
  if (!clicks?.length) return null;
  let prev = null, next = null;
  for (const c of clicks) { if (c.t <= takeT) prev = c; else { next = c; break; } }
  const home = { x: 0.5, y: 1.08 };
  const A = prev || { ...home, t: -1 };
  let x = A.x, y = A.y;
  if (next) {
    const start = Math.max(A.t + 0.15, next.t - 0.65);
    const k = interpolate(takeT, [start, next.t - 0.04], [0, 1], { ...clamp, easing: ease });
    x = A.x + (next.x - A.x) * k; y = A.y + (next.y - A.y) * k - Math.sin(k * Math.PI) * 0.03;
  }
  const since = prev ? takeT - prev.t : 9;
  const press = since < 0.12 ? 0.82 : 1;
  const ring = since < 0.5 ? since / 0.5 : 1;
  return (
    <>
      {since < 0.5 && <div style={{ position: 'absolute', left: x * w - 50, top: y * h - 50, width: 100, height: 100, borderRadius: 50, border: `5px solid ${RED2}`, opacity: 1 - ring, transform: `scale(${0.3 + ring * 1.1})`, boxShadow: `0 0 30px ${RED2}` }} />}
      <svg width="44" height="44" viewBox="0 0 24 24" style={{ position: 'absolute', left: x * w - 6, top: y * h - 4, transform: `scale(${press})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.5))' }}>
        <path d="M4 2l15 11-7 1-3 7z" fill="#0B0C0F" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
};

export const Fine = ({ text, top = 1560 }) => (
  <div style={{ position: 'absolute', left: 60, right: 60, top, textAlign: 'center', font: `500 22px ${FONT}`, color: 'rgba(255,255,255,0.42)' }}>{text}</div>
);

export const Chip = ({ children, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, height: 56, padding: '0 24px', borderRadius: 999, font: `700 24px ${FONT}`, color: INK, ...glass({ borderRadius: 999 }), ...style }}>{children}</div>
);
