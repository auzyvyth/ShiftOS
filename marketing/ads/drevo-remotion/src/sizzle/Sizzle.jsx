// 5-second sizzle: drop -> red bloom -> kinetic type -> 3D car fan -> collapse -> logo.
// Every move is a spring or an eased curve; nothing is linear except the slow drift layers.
import React from 'react';
import {
  AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring,
  interpolate, Easing, random, delayRender, continueRender, Audio,
} from 'remotion';
import { Trail } from '@remotion/motion-blur';

export const S_FPS = 30;
export const S_DUR = 150;

const RED = '#E10600';
const DEEP = '#7A0300';
const INK = '#0B0C0F';
const WHITE = '#FFFFFF';

const fontHandle = typeof window !== 'undefined' ? delayRender('sizzle-fonts') : null;
if (typeof window !== 'undefined') {
  const faces = [
    new FontFace('Bebas', `url(${staticFile('fonts/bebas-neue-latin-400-normal.woff')})`),
    new FontFace('Outfit', `url(${staticFile('fonts/outfit-latin-700-normal.woff')})`, { weight: '700' }),
  ];
  Promise.all(faces.map((f) => f.load().then((l) => document.fonts.add(l))))
    .then(() => continueRender(fontHandle), () => continueRender(fontHandle));
}

// ONE key light drifts over the whole piece; shadows, rim light and specular all read it
const lightAt = (f) => ({ x: 50 + Math.sin(f / 24) * 32, y: 26 + Math.cos(f / 31) * 14 });
// a flare that blooms on each impact and fades on an exponential tail
const flare = (f) => [9, 110, 116].reduce((a, at) => a + (f >= at ? Math.exp(-(f - at) / 6) : 0), 0);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const sp = (frame, fps, delay, config = {}) =>
  spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140, mass: 1, ...config } });

// ---------- 1. the drop: a red ball falls, squashes on impact, blooms to fill ----------
const Drop = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // gravity fall: ease-in quad, lands at frame 9
  const t = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const y = interpolate(t, [0, 1], [-200, height / 2]);
  // squash on impact then rebound wobble
  const impact = sp(f, fps, 9, { damping: 6, stiffness: 400, mass: 0.6 });
  // bloom: circle grows past the corners with overshoot
  const bloom = sp(f, fps, 13, { damping: 14, stiffness: 90 });
  const calm = interpolate(bloom, [0, 0.35], [1, 0], clamp); // squash dies as it blooms
  const squash = f < 9 ? 1 + t * 0.25 : 1 + Math.sin(impact * Math.PI) * -0.45 * calm;
  const sx = 1 / squash;
  const sy = squash;
  const diag = Math.hypot(width, height);
  const r = interpolate(bloom, [0, 1], [60, diag * 0.62]);
  // shockwave ring at impact
  const ring = interpolate(f, [9, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{
        position: 'absolute', left: width / 2 - 520 * ring, top: height / 2 - 520 * ring,
        width: 1040 * ring, height: 1040 * ring, borderRadius: '50%',
        border: `${interpolate(ring, [0, 1], [30, 0])}px solid ${RED}`, opacity: 1 - ring,
      }} />
      <div style={{
        position: 'absolute', left: width / 2 - r, top: (f < 13 ? y : height / 2) - r,
        width: r * 2, height: r * 2, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, #FF3B2F, ${RED} 45%, ${DEEP})`,
        transform: `scale(${sx}, ${sy})`, transformOrigin: '50% 100%',
      }} />
    </AbsoluteFill>
  );
};

// ---------- 2. kinetic type: letters spring up with rotation, words stagger ----------
const WORDS = ['SELL', 'MORE', 'CARS'];
const Kinetic = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = sp(f, fps, 62, { damping: 18, stiffness: 120 });
  return (
    <AbsoluteFill style={{
      justifyContent: 'center', alignItems: 'center',
      transform: `translateY(${interpolate(exit, [0, 1], [0, -620])}px) scale(${interpolate(exit, [0, 1], [1, 0.55])})`,
      opacity: interpolate(exit, [0.6, 1], [1, 0], clamp),
    }}>
      {WORDS.map((w, wi) => (
        <div key={w} style={{ display: 'flex', height: 300, overflow: 'visible' }}>
          {w.split('').map((ch, ci) => {
            const d = 20 + wi * 7 + ci * 1.6;
            const s = sp(f, fps, d, { damping: 9, stiffness: 180, mass: 0.8 });
            const stretch = interpolate(s, [0, 0.5, 1], [1.6, 0.85, 1]);
            return (
              <span key={ci} style={{
                fontFamily: 'Bebas', fontSize: 340, lineHeight: '300px', color: wi === 1 ? INK : WHITE,
                display: 'inline-block', letterSpacing: 4,
                transform: `translateY(${interpolate(s, [0, 1], [420, 0])}px) rotate(${interpolate(s, [0, 1], [ci % 2 ? 28 : -28, 0])}deg) scaleY(${stretch}) scaleX(${1 / stretch})`,
                transformOrigin: '50% 100%', opacity: s > 0.01 ? 1 : 0,
                textShadow: (() => {
                  const L = lightAt(f); const dx = (50 - L.x) * 0.9; const dy = (50 - L.y) * 0.9;
                  return `${dx}px ${dy}px 50px rgba(40,0,0,0.55), ${-dx * 0.08}px ${-dy * 0.08}px 2px rgba(255,210,170,0.7), 0 0 80px rgba(255,90,40,0.35)`;
                })(),
              }}>{ch}</span>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------- 3. car fan: cards fly in 3D, fan out, spin, then collapse ----------
const CARS = ['gr86-2025.jpg', 'civic-fl5-2025.jpg', 'mx5-2024.jpg', 'defender-90-2023.jpg', 'mini-jcw-2022.jpg'];
const Fan = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const collapse = sp(f, fps, 104, { damping: 16, stiffness: 160 });
  const spin = interpolate(f, [70, 110], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ perspective: 1800 }}>
      {CARS.map((src, i) => {
        const n = CARS.length;
        const mid = (n - 1) / 2;
        const s = sp(f, fps, 62 + i * 3, { damping: 13, stiffness: 110, mass: 1.1 });
        const fanAngle = (i - mid) * 13 + spin * (i - mid) * 4;
        const fromX = (i % 2 ? 1 : -1) * 1400;
        const x = interpolate(s, [0, 1], [fromX, (i - mid) * 120]) * (1 - collapse);
        const y = interpolate(s, [0, 1], [900, Math.abs(i - mid) * 50]) * (1 - collapse) + 80;
        const rz = interpolate(s, [0, 1], [(i - mid) * 60, fanAngle]) * (1 - collapse);
        const ry = interpolate(s, [0, 1], [i % 2 ? -70 : 70, 0]) + spin * 18 * (1 - collapse);
        const scale = interpolate(collapse, [0, 1], [1, 0.2]);
        return (
          <div key={src} style={{
            position: 'absolute', left: width / 2 - 330, top: height / 2 - 230, width: 660, height: 460,
            borderRadius: 36, overflow: 'hidden', background: INK,
            boxShadow: (() => {
              const L = lightAt(f); const dx = (50 - L.x) * 1.4; const dy = 40 + (50 - L.y);
              return `${dx * s}px ${dy * s}px ${110 * s}px rgba(30,0,0,0.6), 0 0 ${90 * s}px rgba(255,60,20,${0.35 * s}), inset 0 0 0 2px rgba(255,220,200,0.6)`;
            })(),
            transform: `translate3d(${x}px, ${y}px, ${i * 4}px) rotateZ(${rz}deg) rotateY(${ry}deg) scale(${scale})`,
            border: '8px solid #fff', zIndex: i === Math.round(mid) ? 10 : i,
          }}>
            <Img src={staticFile(`photos/${src}`)} style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: `scale(${interpolate(f, [62, 120], [1.25, 1.05], clamp)})`,
            }} />
            {/* specular sheen: a soft band of light sweeping with the key light */}
            <div style={{
              position: 'absolute', inset: 0, mixBlendMode: 'screen',
              background: `linear-gradient(${110 + rz}deg, transparent ${lightAt(f).x - 30}%, rgba(255,240,225,0.55) ${lightAt(f).x - 8}%, transparent ${lightAt(f).x + 12}%)`,
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.18), transparent 35%, rgba(60,0,0,0.35))' }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- 4. white wipe from the collapse point ----------
const Wipe = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = sp(f, fps, 110, { damping: 20, stiffness: 70 });
  const r = interpolate(s, [0, 1], [0, Math.hypot(width, height) * 0.6]);
  return (
    <div style={{
      position: 'absolute', left: width / 2 - r, top: height / 2 + 80 - r, width: r * 2, height: r * 2,
      borderRadius: '50%', background: WHITE,
    }} />
  );
};

// ---------- 5. logo + particle burst ----------
const Burst = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = interpolate(f, [116, 146], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
  if (f < 116) return null;
  return (
    <>
      {Array.from({ length: 48 }).map((_, i) => {
        const a = random(`a${i}`) * Math.PI * 2;
        const dist = 200 + random(`d${i}`) * 620;
        const size = 22 + random(`s${i}`) * 46;
        const x = width / 2 + Math.cos(a) * dist * t;
        const y = height / 2 + Math.sin(a) * dist * t + 260 * t * t * random(`g${i}`);
        return (
          <div key={i} style={{
            position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size,
            borderRadius: i % 3 ? '50%' : 4, background: i % 4 ? RED : INK,
            opacity: interpolate(t, [0, 0.6, 1], [1, 0.9, 0]), transform: `scale(${1 - t * 0.7}) rotate(${t * 360 * (i % 2 ? 1 : -1)}deg)`,
          }} />
        );
      })}
    </>
  );
};

const Logo = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = sp(f, fps, 116, { damping: 10, stiffness: 150 });
  const bar = sp(f, fps, 124, { damping: 15, stiffness: 120 });
  const tag = 'Sell smarter.'.split('');
  const float = Math.sin((f - 116) / 9) * 6 * interpolate(f, [130, 150], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        transform: `translateY(${float}px) translateX(${interpolate(s, [0, 1], [-260, 0])}px) skewX(${interpolate(s, [0, 1], [-30, 0])}deg) scale(${interpolate(s, [0, 1], [0.4, 1])})`,
        opacity: s > 0.01 ? 1 : 0,
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: -120, right: -120, top: -80, bottom: -80, borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(255,40,0,0.32), transparent)', filter: 'blur(30px)',
            opacity: interpolate(s, [0, 1], [0, 1]) * (0.85 + Math.sin(f / 7) * 0.15),
          }} />
          <Img src={staticFile('drevo-logo.svg')} style={{ width: 860, position: 'relative', filter: 'drop-shadow(0 30px 40px rgba(160,0,0,0.25))' }} />
          {/* sweep of light across the wordmark, masked to its shape */}
          <div style={{
            position: 'absolute', inset: 0,
            WebkitMaskImage: `url(${staticFile('drevo-logo.svg')})`, WebkitMaskSize: '100% 100%',
            background: `linear-gradient(105deg, transparent ${interpolate(f, [126, 146], [-40, 120], { ...clamp, easing: Easing.inOut(Easing.cubic) })}%, rgba(255,235,220,0.5) ${interpolate(f, [126, 146], [-25, 135], { ...clamp, easing: Easing.inOut(Easing.cubic) })}%, transparent ${interpolate(f, [126, 146], [-10, 150], { ...clamp, easing: Easing.inOut(Easing.cubic) })}%)`,
          }} />
          {/* floor reflection */}
          <Img src={staticFile('drevo-logo.svg')} style={{
            width: 860, position: 'absolute', left: 0, top: 160, transform: 'scaleY(-1)', opacity: 0.16, filter: 'blur(3px)',
            WebkitMaskImage: 'linear-gradient(0deg, black, transparent 70%)',
          }} />
        </div>
      </div>
      <div style={{
        width: 620 * bar, height: 14, borderRadius: 7, background: INK, marginTop: 40,
      }} />
      <div style={{ display: 'flex', marginTop: 46 }}>
        {tag.map((ch, i) => {
          const c = sp(f, fps, 128 + i * 0.9, { damping: 11, stiffness: 200 });
          return (
            <span key={i} style={{
              fontFamily: 'Outfit', fontWeight: 700, fontSize: 84, color: INK, whiteSpace: 'pre',
              display: 'inline-block', opacity: c,
              transform: `translateY(${interpolate(c, [0, 1], [70, 0])}px) scale(${interpolate(c, [0, 1], [0.3, 1])})`,
            }}>{ch}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- ambient light ----------
// soft coloured orbs that drift on their own slow paths, brighter on impacts
const ORBS = [
  { c: '255,140,60', r: 900, sx: 23, sy: 29, px: 0, py: 1 },
  { c: '255,40,90', r: 760, sx: 31, sy: 19, px: 2, py: 0.5 },
  { c: '255,200,140', r: 520, sx: 17, sy: 37, px: 4, py: 3 },
  { c: '120,0,10', r: 1100, sx: 41, sy: 27, px: 1, py: 2 },
];
const Ambient = ({ on }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const boost = 1 + flare(f) * 0.8;
  return (
    <AbsoluteFill style={{ opacity: on, mixBlendMode: 'screen' }}>
      {ORBS.map((o, i) => {
        const x = width * (0.5 + Math.sin(f / o.sx + o.px) * 0.42);
        const y = height * (0.45 + Math.cos(f / o.sy + o.py) * 0.38);
        return (
          <div key={i} style={{
            position: 'absolute', left: x - o.r, top: y - o.r, width: o.r * 2, height: o.r * 2, borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(${o.c},${0.42 * boost}), transparent)`, filter: 'blur(40px)',
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// god rays from the key light, slowly turning
const Rays = ({ on }) => {
  const f = useCurrentFrame();
  const L = lightAt(f);
  const rot = f * 0.35;
  return (
    <AbsoluteFill style={{
      opacity: on * (0.55 + flare(f) * 0.4), mixBlendMode: 'screen',
      background: `repeating-conic-gradient(from ${rot}deg at ${L.x}% ${L.y - 30}%, rgba(255,210,170,0.16) 0deg 3deg, transparent 3deg 11deg)`,
      WebkitMaskImage: `radial-gradient(circle at ${L.x}% ${L.y - 30}%, black 5%, transparent 70%)`, filter: 'blur(6px)',
    }} />
  );
};

// dust caught in the light: floats up, sways, only bright near the key light
const Dust = ({ on }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const L = lightAt(f);
  return (
    <AbsoluteFill style={{ opacity: on, mixBlendMode: 'screen' }}>
      {Array.from({ length: 70 }).map((_, i) => {
        const depth = 0.3 + random(`z${i}`) * 0.7;
        const x = (random(`x${i}`) * width + Math.sin(f / (20 + i % 9) + i) * 40 * depth) % width;
        const y = ((random(`y${i}`) * height - f * 3.2 * depth) % height + height) % height;
        const near = Math.max(0, 1 - Math.hypot(x / width * 100 - L.x, y / height * 100 - L.y) / 60);
        const size = 3 + depth * 9;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
            background: 'rgb(255,225,200)', opacity: (0.15 + near * 0.85) * depth,
            filter: `blur(${(1 - depth) * 4}px)`, boxShadow: `0 0 ${size * 2}px rgba(255,180,120,0.8)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// vignette + grain over everything, and a light leak at the two big transitions
const Film = () => {
  const f = useCurrentFrame();
  const leak = (at) => interpolate(f, [at, at + 4, at + 16], [0, 1, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const l = leak(15) * 0.7 + leak(112) * 0.8;
  const white = interpolate(f, [114, 122], [0, 1], clamp);
  return (
    <>
      <AbsoluteFill style={{
        mixBlendMode: 'screen', opacity: l,
        background: 'radial-gradient(ellipse at 85% 10%, rgba(255,190,120,0.9), transparent 45%), radial-gradient(ellipse at 10% 90%, rgba(255,60,80,0.6), transparent 50%)',
      }} />
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${interpolate(white, [0, 1], [0.6, 0.12])}) 100%)`,
      }} />
      <AbsoluteFill style={{ opacity: 0.14, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%">
          <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 12} /></filter>
          <rect width="100%" height="100%" filter="url(#g)" />
        </svg>
      </AbsoluteFill>
    </>
  );
};

// warm studio light on the white logo stage
const Studio = () => {
  const f = useCurrentFrame();
  const on = interpolate(f, [114, 126], [0, 1], clamp);
  return (
    <AbsoluteFill style={{
      opacity: on, mixBlendMode: 'multiply',
      background: `radial-gradient(ellipse at ${50 + Math.sin(f / 14) * 6}% 30%, #fff 0%, #fff4ee 40%, #f3d9d2 100%)`,
    }} />
  );
};

// the ball lights the black room around it
const BallGlow = () => {
  const f = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const y = f < 9 ? interpolate(t, [0, 1], [-200, height / 2]) / height * 100 : 50;
  const o = interpolate(f, [0, 4, 16, 22], [0, 1, 1, 0], clamp) * (1 + flare(f));
  return (
    <AbsoluteFill style={{
      mixBlendMode: 'screen', opacity: Math.min(o, 1.6),
      background: `radial-gradient(circle at 50% ${y}%, rgba(255,60,20,0.75), rgba(255,30,0,0.2) 18%, transparent 40%)`,
    }} />
  );
};

// slow light drifting across the red phase
const Glow = () => {
  const f = useCurrentFrame();
  const x = 30 + Math.sin(f / 22) * 30;
  const y = 30 + Math.cos(f / 27) * 20;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at ${x}% ${y}%, rgba(255,120,90,0.45), transparent 55%)`,
      opacity: interpolate(f, [14, 30, 108, 116], [0, 1, 1, 0], clamp), mixBlendMode: 'screen',
    }} />
  );
};

// camera shake on the two impacts, decaying spring-like
const shake = (f) => {
  const hit = (at, amp) => {
    const d = f - at;
    if (d < 0 || d > 14) return [0, 0];
    const k = amp * Math.exp(-d / 3.5);
    return [Math.sin(d * 2.7) * k, Math.cos(d * 3.3) * k];
  };
  const a = hit(9, 22); const b = hit(116, 14);
  return [a[0] + b[0], a[1] + b[1]];
};

export const Sizzle = ({ audio = true }) => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  return (
    <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <Drop />
        <BallGlow />
        <Glow />
        <Ambient on={interpolate(f, [16, 30, 108, 118], [0, 1, 1, 0], clamp)} />
        <Rays on={interpolate(f, [16, 34, 108, 118], [0, 1, 1, 0], clamp)} />
        <Dust on={interpolate(f, [10, 24, 112, 120], [0, 1, 1, 0], clamp)} />
        {f >= 18 && f < 100 && (
          <Trail layers={6} lagInFrames={0.3} trailOpacity={0.55}><Kinetic /></Trail>
        )}
        {f >= 58 && f < 130 && (
          <Trail layers={6} lagInFrames={0.4} trailOpacity={0.6}><Fan /></Trail>
        )}
        <Wipe />
        <Studio />
        <Dust on={interpolate(f, [120, 132], [0, 0.6], clamp)} />
        <Burst />
        <Logo />
      </AbsoluteFill>
      <Film />
      {audio && <Audio src={staticFile('audio/sizzle.wav')} />}
    </AbsoluteFill>
  );
};
