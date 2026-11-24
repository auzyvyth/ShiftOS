// Calculator ad v2 (BM, EN subtitle pill). Same story as the owner's 61 s cut, rebuilt with
// ambient light, springs and real phone recordings of the Live presenter (harness/record-phone.cjs).
import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig,
  spring, interpolate, Easing, random, delayRender, continueRender, Audio,
} from 'remotion';
import TL from './timeline.json';
import CLICK_CALC from './calc-ms.clicks.json';
import CLICK_BUDGET from './budget-ms.clicks.json';
import CLICK_VIEWER from './viewer-ms.clicks.json';

export const C_FPS = TL.fps;
export const C_DUR = Math.round(TL.dur * TL.fps);
const S = (s) => Math.round(s * TL.fps);
const beat = Object.fromEntries(TL.beats.map((b, i) => [b[0], { at: b[1], end: TL.beats[i + 1]?.[1] ?? TL.dur, ms: b[2], en: b[3] }]));
const H = TL.hits;

const RED = '#dc2626';
const INK = '#0B0C0F';
const PAPER = '#F6F4F1';
const FONT = 'Outfit, system-ui, sans-serif';
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

const fontHandle = typeof window !== 'undefined' ? delayRender('calc2-fonts') : null;
if (typeof window !== 'undefined') {
  const faces = [
    new FontFace('Outfit', `url(${staticFile('fonts/outfit-latin-500-normal.woff')})`, { weight: '500' }),
    new FontFace('Outfit', `url(${staticFile('fonts/outfit-latin-700-normal.woff')})`, { weight: '700' }),
  ];
  Promise.all(faces.map((f) => f.load().then((l) => document.fonts.add(l))))
    .then(() => continueRender(fontHandle), () => continueRender(fontHandle));
}

const sp = (f, at, cfg = {}) => spring({ frame: f - S(at), fps: TL.fps, config: { damping: 14, stiffness: 140, mass: 1, ...cfg } });
const between = (f, a, b) => f >= S(a) && f < S(b);
// key light drifts all ad long; shadows and sheens read it
const light = (f) => ({ x: 50 + Math.sin(f / 70) * 28, y: 18 + Math.cos(f / 90) * 8 });

// ============ world: warm paper room, drifting coloured light, dust, faint grid ============
const ORBS = [
  { c: '255,120,90', r: 820, sx: 83, sy: 101, px: 0, py: 1, a: 0.20 },
  { c: '220,38,38', r: 700, sx: 97, sy: 71, px: 2, py: 0.4, a: 0.13 },
  { c: '255,214,170', r: 620, sx: 61, sy: 113, px: 4, py: 3, a: 0.30 },
];
const World = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const L = light(f);
  const kick = [H.phone, H.flip, H.plans].reduce((a, t) => a + (f >= S(t) ? Math.exp(-(f - S(t)) / 9) : 0), 0);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{
        backgroundImage: 'linear-gradient(rgba(11,12,15,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(11,12,15,0.045) 1px, transparent 1px)',
        backgroundSize: '54px 54px', backgroundPosition: `${(f * 0.25) % 54}px 0`,
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 45%, black 30%, transparent 75%)',
      }} />
      {ORBS.map((o, i) => {
        const x = width * (0.5 + Math.sin(f / o.sx + o.px) * 0.45);
        const y = height * (0.45 + Math.cos(f / o.sy + o.py) * 0.35);
        return <div key={i} style={{ position: 'absolute', left: x - o.r, top: y - o.r, width: o.r * 2, height: o.r * 2, borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(${o.c},${o.a * (1 + kick * 0.6)}), transparent)`, filter: 'blur(30px)' }} />;
      })}
      {/* soft spotlight cone from the key light */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 45% at ${L.x}% ${L.y}%, rgba(255,255,255,${0.75 + kick * 0.2}), transparent 70%)` }} />
      {/* dust in the light */}
      {Array.from({ length: 46 }).map((_, i) => {
        const d = 0.3 + random(`dz${i}`) * 0.7;
        const x = (random(`dx${i}`) * width + Math.sin(f / (40 + i % 11) + i) * 50 * d) % width;
        const y = ((random(`dy${i}`) * height - f * 1.4 * d) % height + height) % height;
        const near = Math.max(0, 1 - Math.hypot(x / width * 100 - L.x, y / height * 100 - L.y) / 55);
        const sz = 3 + d * 6;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: sz, height: sz, borderRadius: '50%',
          background: 'rgba(200,120,90,0.9)', opacity: (0.08 + near * 0.5) * d, filter: `blur(${(1 - d) * 3}px)` }} />;
      })}
    </AbsoluteFill>
  );
};

// ============ headline: words spring out of blur; red words get a swash ============
const Headline = ({ text, at, end, top = 150, size = 90 }) => {
  const f = useCurrentFrame();
  if (!text || f < S(at) - 2 || f > S(end) + 8) return null;
  const out = interpolate(f, [S(end) - 5, S(end) + 2], [0, 1], { ...cl, easing: Easing.in(Easing.cubic) });
  let k = 0;
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top, textAlign: 'center', fontFamily: FONT, zIndex: 50 }}>
      {text.split('|').map((line, li) => (
        <div key={li} style={{ font: `700 ${size}px/1.06 ${FONT}`, letterSpacing: -3, color: INK, whiteSpace: 'nowrap' }}>
          {line.split(' ').map((w, wi) => {
            const red = w.startsWith('*');
            const word = w.replace(/\*/g, '');
            const p = sp(f, at + 0.05 + k++ * 0.07, { damping: 11, stiffness: 170 });
            const blur = Math.max(0, 1 - p) * 14 + out * 16;
            const sw = sp(f, at + 0.35 + k * 0.07, { damping: 20, stiffness: 120 });
            return (
              <span key={wi} style={{ display: 'inline-block', position: 'relative', marginRight: size * 0.22, color: red ? RED : INK,
                opacity: Math.min(1, p * 1.5) * (1 - out), filter: blur > 0.1 ? `blur(${blur}px)` : 'none',
                transform: `translateY(${(1 - p) * 80 - out * 40}px) rotate(${(1 - p) * (wi % 2 ? 6 : -6)}deg) scale(${0.85 + 0.15 * p})`,
                fontStyle: red ? 'italic' : 'normal', textShadow: `0 0 24px ${PAPER}, 0 0 48px ${PAPER}` }}>
                {word}
                {red && <span style={{ position: 'absolute', left: '4%', bottom: -4, height: 10, borderRadius: 6, background: RED, opacity: 0.85,
                  width: `${92 * Math.min(1, sw)}%`, transformOrigin: 'left' }} />}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ============ EN subtitle pill ============
const Pill = () => {
  const f = useCurrentFrame();
  const b = TL.beats.findLast((x) => f >= S(x[1]));
  if (!b) return null;
  const p = sp(f, b[1] + 0.1, { damping: 16, stiffness: 180 });
  const onRed = f >= S(H.wipe);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1708, display: 'flex', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 30px', borderRadius: 999,
        background: onRed ? 'rgba(0,0,0,0.35)' : 'rgba(11,12,15,0.86)', color: '#fff', font: `500 30px ${FONT}`,
        boxShadow: '0 18px 40px rgba(0,0,0,0.18)', backdropFilter: 'blur(12px)',
        transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`, opacity: p }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: onRed ? '#fff' : RED }} />{b[3]}
      </div>
    </div>
  );
};

// ============ act 1: the spreadsheet on a string ============
const fmt = (n) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const flatMonthly = (loan, y) => loan * (1 + 0.023 * y) / (12 * y);
const COMMENTS = [
  ['aina_rahman', 'gaji 3k, kereta mana muat?'],
  ['hafiz.kl', '9 tahun, gaji cukup ke?'],
  ['mira_s', 'total semua berapa?'],
  ['zul88', 'deposit 20% berapa sebulan?'],
  ['kak_yan', 'NCD saya 25%, kira semula?'],
  ['azri.m', 'dokumen apa perlu?'],
];

const Sheet = () => {
  const f = useCurrentFrame();
  const t = f / TL.fps;
  const drop = sp(f, 0, { damping: 9, stiffness: 90 });
  // pendulum: decaying swing, re-kicked by the price tag landing
  const swing = 9 * Math.exp(-t / 1.1) * Math.cos(t * 4.2) + (t > H.tag ? 4 * Math.exp(-(t - H.tag) / 0.7) * Math.sin((t - H.tag) * 9) : 0);
  const retyped = t >= beat.retype.at + 0.7;
  const dep = retyped ? 17500 : 0;
  const loan = 175000 - dep;
  const tickN = Math.floor(interpolate(t, [beat.excel3.at + 0.1, beat.excel3.at + 1.2], [0, 6], cl));
  // retype: cursor blinks in deposit cell
  const typing = t >= beat.retype.at && t < beat.retype.at + 0.7;
  const typed = typing ? '17500'.slice(0, Math.floor((t - beat.retype.at) / 0.12)) : null;
  const flood = interpolate(t, [beat.flood.at, beat.flood.at + 2], [0, 1], cl);
  // crumple + fall
  const fallT = Math.max(0, t - H.crumple);
  const crumple = sp(f, H.crumple, { damping: 12, stiffness: 220 });
  const fallY = 1400 * fallT * fallT;
  const rows = [
    ['ON THE ROAD PRICE', 'RM' + fmt(175000)],
    ['DEPOSIT', typed !== null ? typed + (Math.floor(t * 6) % 2 ? '|' : '') : 'RM' + fmt(dep)],
    ['REBATE', 'RM0.00'],
    ['LOAN AMOUNT', 'RM' + fmt(loan)],
    ['NCD', '0.00%'],
    ['INTEREST', '2.30%'],
  ];
  const flashRow = (i) => retyped && (i === 1 || i === 3) ? Math.max(0, 1 - (t - beat.retype.at - 0.7) / 0.6) : 0;
  const L = light(f);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1920, transform: `translateY(${fallY}px) rotate(${fallT * 40}deg)`, transformOrigin: '50% 30%' }}>
      {/* string */}
      <div style={{ position: 'absolute', left: 539, top: -40, width: 2, height: 560 - (1 - drop) * 900, background: 'rgba(11,12,15,0.5)', transformOrigin: 'top', transform: `rotate(${swing * 0.3}deg)` }} />
      <div style={{
        position: 'absolute', left: 130, top: 520, width: 820, transformOrigin: '50% -40px',
        transform: `translateY(${(1 - drop) * -1100}px) rotate(${swing}deg) scale(${1 - crumple * 0.25}, ${1 - crumple * 0.55}) skewX(${crumple * 8}deg)`,
        filter: `grayscale(${flood * 0.6}) blur(${flood * 1.5}px)`,
      }}>
        <div style={{ borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: `${(50 - L.x) * 1.2}px 60px 90px rgba(60,20,10,0.22), 0 10px 20px rgba(0,0,0,0.08)` }}>
          <div style={{ background: '#217346', padding: '14px 22px', color: '#fff', font: `500 22px ${FONT}`, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.8)' }} />kalkulator_loan_FINAL_v5.xlsx
          </div>
          <div style={{ background: '#2E4A8C', color: '#fff', font: `700 46px ${FONT}`, textAlign: 'center', padding: '14px 0', letterSpacing: 1 }}>TOYOTA GR86 2.4L</div>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 26px',
              background: flashRow(i) ? `rgba(255,220,0,${0.5 * flashRow(i)})` : i % 2 ? '#F2F2F2' : '#fff', borderBottom: '1px solid #ddd', font: `700 28px ${FONT}`, color: '#222' }}>
              <span>{k}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'monospace', fontSize: 30 }}>{v}
                {i < tickN && <Tick f={f} at={beat.excel3.at + 0.1 + i * 0.18} />}</span>
            </div>
          ))}
          <div style={{ background: '#F4B183', padding: '16px 26px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ font: `700 44px ${FONT}`, color: '#222', alignSelf: 'center' }}>MONTHLY</span>
            <div>
              {[5, 7, 9].map((y) => (
                <div key={y} style={{ display: 'flex', gap: 30, justifyContent: 'flex-end', font: `700 30px ${FONT}`, color: '#222' }}>
                  <span style={{ fontSize: 22, alignSelf: 'center' }}>{y} YEARS</span>
                  <span style={{ fontFamily: 'monospace', textDecoration: 'underline' }}>RM{fmt(flatMonthly(loan, y))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PriceTag f={f} />
      </div>
      {COMMENTS.map(([who, txt], i) => <Bubble key={who} f={f} i={i} who={who} txt={txt} />)}
    </div>
  );
};

const Tick = ({ f, at }) => {
  const p = sp(f, at, { damping: 9, stiffness: 260 });
  return <span style={{ width: 34, height: 34, borderRadius: 17, background: INK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${p})` }}>
    <svg width="20" height="20" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>;
};

const PriceTag = ({ f }) => {
  const t = f / TL.fps;
  if (t < H.tag - 0.3) return null;
  const p = sp(f, H.tag - 0.3, { damping: 7, stiffness: 160 });
  const sw = 18 * Math.exp(-(t - H.tag) / 0.6) * Math.cos((t - H.tag) * 10);
  return (
    <div style={{ position: 'absolute', right: -40, top: 130, transformOrigin: '50% -50px', transform: `translateY(${(1 - p) * -600}px) rotate(${-14 + sw}deg)` }}>
      <div style={{ position: 'absolute', left: '50%', top: -50, width: 2, height: 50, background: INK }} />
      <div style={{ background: INK, color: '#fff', font: `700 52px ${FONT}`, padding: '12px 26px', borderRadius: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '50%', top: 8, width: 12, height: 12, marginLeft: -6, borderRadius: 6, background: PAPER }} />
        RM300
      </div>
    </div>
  );
};

const Bubble = ({ f, i, who, txt }) => {
  const at = beat.flood.at + 0.15 + i * 0.3;
  const t = f / TL.fps;
  if (t < at) return null;
  const p = sp(f, at, { damping: 10, stiffness: 170 });
  const pos = [[90, 1140], [430, 1000], [120, 840], [470, 1290], [150, 1420], [520, 720]][i];
  // blown away when the sheet crumples
  const blow = sp(f, H.crumple - 0.1, { damping: 18, stiffness: 90 });
  const dir = i % 2 ? 1 : -1;
  return (
    <div style={{ position: 'absolute', left: pos[0], top: pos[1], zIndex: 40,
      transform: `translate(${blow * dir * 900}px, ${(1 - p) * 120 - blow * 300}px) scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * dir * 10 + blow * dir * 30}deg)`,
      opacity: Math.min(1, p * 1.4) * (1 - blow) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(20,20,24,0.92)', borderRadius: 999, padding: '14px 28px 14px 14px', boxShadow: '0 24px 50px rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: `linear-gradient(135deg, hsl(${i * 55},60%,70%), hsl(${i * 55 + 40},55%,50%))` }} />
        <div>
          <div style={{ font: `500 20px ${FONT}`, color: 'rgba(255,255,255,0.6)' }}>@{who}</div>
          <div style={{ font: `700 30px ${FONT}`, color: '#fff' }}>{txt}</div>
        </div>
      </div>
    </div>
  );
};

// ============ act 2: the phone with the real presenter ============
const SW = 600, SH = 1170;           // screen size on canvas (take is 400x780 css)
const PX = (1080 - SW) / 2, PY = 440; // screen top-left
const Phone = () => {
  const f = useCurrentFrame();
  const t = f / TL.fps;
  if (t < H.phone - 0.2 || t > H.wipe + 0.6) return null;
  const rise = sp(f, H.phone - 0.2, { damping: 13, stiffness: 95 });
  const flip = sp(f, H.flip - 0.2, { damping: 16, stiffness: 110 });
  const flipDeg = flip * 360;
  const front = Math.abs(Math.cos(flipDeg * Math.PI / 180));
  // camera: push in on details per beat
  const zoom = (a, b, z, fy) => {
    const pin = sp(f, a, { damping: 20, stiffness: 80 }) - sp(f, b, { damping: 20, stiffness: 80 });
    return { s: 1 + (z - 1) * pin, fy, pin };
  };
  const zs = [zoom(beat.calc2.at + 0.2, beat.budget.at - 0.4, 1.45, 0.56), zoom(beat.bands.at + 0.1, beat.viewer.at - 0.4, 1.35, 0.62),
    zoom(beat.next.at + 0.3, beat.guide.at, 1.3, 0.6), zoom(beat.guide.at + 0.1, beat.plans.at - 0.1, 1.6, 0.8)];
  const z = zs.reduce((a, b) => (b.pin > a.pin ? b : a), { s: 1, fy: 0.5, pin: 0 });
  // exit to the side for the plans
  const away = sp(f, beat.plans.at - 0.1, { damping: 16, stiffness: 90 });
  const float = Math.sin(t * 1.3) * 8;
  const tiltY = Math.sin(t * 0.7) * 4 * (1 - z.pin) + flipDeg;
  const tiltX = (1 - rise) * 50 + Math.cos(t * 0.9) * 2;
  const L = light(f);
  const scale = z.s * interpolate(away, [0, 1], [1, 0.62]);
  // a push-in never climbs over the headline: the phone's top edge stays below y=400
  const keepTop = Math.max(0, 400 - (PY - 18 + z.fy * (SH + 36) * (1 - z.s)));
  return (
    <AbsoluteFill style={{ perspective: 2200, zIndex: 20 }}>
      {/* floor shadow */}
      <div style={{ position: 'absolute', left: 540 - 300 * scale, top: PY + SH + 70, width: 600 * scale, height: 70, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(70,20,10,0.35), transparent)', filter: 'blur(10px)', opacity: rise * (1 - z.pin * 0.8),
        transform: `translateX(${away * -310 + (50 - L.x) * 2}px)` }} />
      <div style={{
        position: 'absolute', left: PX - 18, top: PY - 18, width: SW + 36, height: SH + 36,
        transformOrigin: `50% ${z.fy * 100}%`,
        transform: `translate(${away * -310}px, ${(1 - rise) * 1300 + float + keepTop + away * -60}px) scale(${scale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
        borderRadius: 74, background: 'linear-gradient(150deg,#2a2c33,#0b0c0f 40%)', padding: 18,
        boxShadow: `${(50 - L.x) * 1.4}px 70px 120px rgba(60,15,5,0.32), 0 20px 40px rgba(0,0,0,0.2), inset 0 0 0 2px rgba(255,255,255,0.08), 0 0 ${120 + 0 * front}px rgba(220,38,38,0.16)`,
      }}>
        <div style={{ position: 'relative', width: SW, height: SH, borderRadius: 58, overflow: 'hidden', background: '#fff' }}>
          <div style={{ position: 'absolute', inset: 0, transform: flipDeg >= 90 && flipDeg < 270 ? 'scaleX(-1)' : 'none' }}>
            <Screen which={flipDeg < 90 && t < beat.budget.at ? 'calc' : t < beat.viewer.at ? 'budget' : 'viewer'} />
          </div>
          {/* glass: specular band following the key light */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen',
            background: `linear-gradient(${115 + tiltY * 0.5}deg, transparent ${L.x - 40}%, rgba(255,255,255,0.28) ${L.x - 25}%, transparent ${L.x - 5}%)` }} />
          <div style={{ position: 'absolute', top: 14, left: '50%', width: 120, height: 34, marginLeft: -60, borderRadius: 20, background: '#0b0c0f' }} />
        </div>
      </div>
      <Callouts />
    </AbsoluteFill>
  );
};

const CLICKS = { calc: CLICK_CALC, budget: CLICK_BUDGET, viewer: CLICK_VIEWER };
const Screen = ({ which }) => {
  const f = useCurrentFrame();
  const start = TL.takes[which];
  const takeT = f / TL.fps - start;
  const dur = { calc: 9, budget: 8, viewer: 10 }[which];
  // viewer screen swipes in from the right
  const sw = which === 'viewer' ? sp(f, H.swipe, { damping: 18, stiffness: 120 }) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(1 - sw) * SW}px)` }}>
      {takeT < 0 && <Img src={staticFile(`takes2/${which}-first.png`)} style={{ width: SW, height: SH }} />}
      {takeT >= dur - 0.04 && <Img src={staticFile(`takes2/${which}-last.png`)} style={{ width: SW, height: SH }} />}
      <Sequence from={S(start)} durationInFrames={S(dur) - 1} layout="none">
        <OffthreadVideo src={staticFile(`takes2/${which}-ms.mp4`)} muted style={{ width: SW, height: SH, display: 'block' }} />
      </Sequence>
      <Taps clicks={CLICKS[which].clicks} takeT={takeT} />
    </div>
  );
};

// finger taps: a press dot and a ripple at each recorded tap
const Taps = ({ clicks, takeT }) => (
  <>
    {clicks.map((c, i) => {
      const d = takeT - c.t;
      if (d < -0.25 || d > 0.7) return null;
      const pre = d < 0 ? 1 + d / 0.25 : 1;
      const r = Math.max(0, d) / 0.7;
      return (
        <React.Fragment key={i}>
          <div style={{ position: 'absolute', left: c.x * SW - 34, top: c.y * SH - 34, width: 68, height: 68, borderRadius: 34,
            background: 'rgba(11,12,15,0.25)', border: '3px solid rgba(255,255,255,0.9)', opacity: d < 0 ? pre : 1 - r,
            transform: `scale(${d < 0 ? 1.4 - pre * 0.4 : 1 - Math.min(1, d / 0.1) * 0.2})` }} />
          {d >= 0 && <div style={{ position: 'absolute', left: c.x * SW - 60, top: c.y * SH - 60, width: 120, height: 120, borderRadius: 60,
            border: `5px solid ${RED}`, opacity: 1 - r, transform: `scale(${0.3 + r * 1.2})` }} />}
        </React.Fragment>
      );
    })}
  </>
);

// red pills that pop out beside the phone on the taps that matter
const CALLOUTS = [
  [beat.calc.at + 0.95, 'Deposit 20%', -1, 900], [beat.calc.at + 2.15, '9 tahun', 1, 760], [beat.calc.at + 3.45, 'NCD 25%', -1, 1240],
  [beat.calc2.at + 0.3, 'Jumlah bayar', 1, 1340], [beat.budget.at + 0.7, 'Gaji RM 12,000', -1, 720], [beat.budget.at + 2.7, 'Komitmen RM 1,500', 1, 860],
  [beat.viewer.at + 0.7, '@aina_rahman', -1, 1260], [beat.next.at + 0.9, '@hafiz.kl', 1, 1180],
];
const Callouts = () => {
  const f = useCurrentFrame();
  const t = f / TL.fps;
  return CALLOUTS.map(([at, txt, side, y], i) => {
    if (t < at || t > at + 2.4) return null;
    const p = sp(f, at, { damping: 9, stiffness: 200 });
    const out = interpolate(t, [at + 2.0, at + 2.4], [0, 1], cl);
    return (
      <div key={i} style={{ position: 'absolute', top: y, [side < 0 ? 'left' : 'right']: 24, zIndex: 30,
        transform: `translateX(${(1 - p) * side * 200}px) scale(${(0.5 + 0.5 * p) * (1 - out * 0.3)}) rotate(${side * -4 * (1 - p) + side * 3}deg)`, opacity: Math.min(1, p * 1.5) * (1 - out) }}>
        <div style={{ background: RED, color: '#fff', font: `700 38px ${FONT}`, padding: '14px 28px', borderRadius: 999,
          boxShadow: '0 20px 44px rgba(220,38,38,0.45), inset 0 2px 0 rgba(255,255,255,0.25)' }}>{txt}</div>
      </div>
    );
  });
};

// ============ act 3: Lite vs Premium ============
const PLANS = [
  { name: 'Lite', tag: 'Percuma', rows: ['Kalkulator Live asas', 'Insurans & NCD', 'Laman anda sendiri'], red: false },
  { name: 'Premium', tag: 'Penuh', rows: ['Bajet + Mod Penonton', 'Jumlah bayar & faedah', 'Papan pemuka prestasi'], red: true },
];
const Plans = () => {
  const f = useCurrentFrame();
  const t = f / TL.fps;
  if (t < beat.plans.at - 0.1 || t > H.wipe + 0.6) return null;
  return (
    <AbsoluteFill style={{ perspective: 1800, zIndex: 25 }}>
      {PLANS.map((pl, i) => {
        const p = sp(f, beat.plans.at + 0.15 + i * 0.35, { damping: 12, stiffness: 120 });
        const glow = pl.red ? 0.5 + Math.sin(t * 3) * 0.15 : 0;
        return (
          <div key={pl.name} style={{ position: 'absolute', left: 400, width: 620, top: 560 + i * 470, borderRadius: 40, padding: '40px 44px',
            background: pl.red ? `linear-gradient(150deg, #ef4444, ${RED} 50%, #a51b1b)` : 'linear-gradient(160deg,#fff,#f6f6f7)',
            color: pl.red ? '#fff' : INK,
            boxShadow: pl.red ? `0 40px 90px rgba(220,38,38,${glow}), inset 0 2px 0 rgba(255,255,255,0.3)` : '0 40px 90px rgba(60,20,10,0.16)',
            transform: `translateX(${(1 - p) * 900}px) rotateY(${(1 - p) * -50}deg) rotateZ(${(1 - p) * 8}deg)`, opacity: Math.min(1, p * 2) }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span style={{ font: `700 64px ${FONT}`, letterSpacing: -2 }}>{pl.name}</span>
              <span style={{ font: `500 30px ${FONT}`, opacity: 0.7 }}>{pl.tag}</span>
            </div>
            {pl.rows.map((r, j) => {
              const q = sp(f, beat.plans.at + 0.5 + i * 0.35 + j * 0.12, { damping: 10, stiffness: 220 });
              return (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 20, font: `500 36px ${FONT}`,
                  opacity: q, transform: `translateX(${(1 - q) * 40}px)` }}>
                  <span style={{ width: 38, height: 38, borderRadius: 19, background: pl.red ? '#fff' : INK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${q})` }}>
                    <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke={pl.red ? RED : '#fff'} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>{r}
                </div>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ============ act 4: red close ============
const Close = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = f / TL.fps;
  if (t < H.wipe) return null;
  const w = sp(f, H.wipe, { damping: 22, stiffness: 70 });
  const r = w * Math.hypot(width, height);
  const logo = sp(f, H.logo, { damping: 10, stiffness: 140 });
  const line = sp(f, H.logo + 0.35, { damping: 14, stiffness: 160 });
  const btn = sp(f, H.logo + 0.6, { damping: 9, stiffness: 180 });
  const url = sp(f, H.logo + 0.85, { damping: 14, stiffness: 160 });
  const shimmer = interpolate(t, [H.logo + 1.2, H.logo + 2.0], [-30, 130], { ...cl, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ zIndex: 55 }}>
      <div style={{ position: 'absolute', left: 760 - r, top: 1060 - r, width: r * 2, height: r * 2, borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, #f04444, ${RED} 45%, #8f1414)` }} />
      <AbsoluteFill style={{ opacity: w, mixBlendMode: 'screen', background: `radial-gradient(ellipse 60% 40% at ${light(f).x}% 30%, rgba(255,170,140,0.35), transparent 70%)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 0, top: -60 }}>
        <div style={{ transform: `scale(${0.4 + 0.6 * logo}) translateY(${(1 - logo) * 120}px) skewX(${(1 - logo) * -20}deg)`, opacity: Math.min(1, logo * 2),
          filter: `drop-shadow(0 24px 40px rgba(80,0,0,0.4))` }}>
          <Img src={staticFile('drevo-logo.svg')} style={{ width: 640, filter: 'brightness(0) invert(1)' }} />
        </div>
        <div style={{ marginTop: 50, font: `700 60px ${FONT}`, color: '#fff', letterSpacing: -1.5, opacity: line, transform: `translateY(${(1 - line) * 50}px)` }}>Kira di depan penonton.</div>
        <div style={{ marginTop: 56, position: 'relative', overflow: 'hidden', background: '#fff', color: RED, font: `700 44px ${FONT}`, padding: '26px 52px', borderRadius: 999,
          boxShadow: '0 24px 50px rgba(80,0,0,0.35)', transform: `scale(${btn})` }}>
          Cuba Premium 7 hari percuma
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${shimmer}%`, width: '18%', background: 'linear-gradient(100deg, transparent, rgba(220,38,38,0.18), transparent)' }} />
        </div>
        <div style={{ marginTop: 40, font: `500 38px ${FONT}`, color: 'rgba(255,255,255,0.85)', letterSpacing: 4, opacity: url }}>drevo.my</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// vignette, grain, and a short warm flash on the big transitions
const Film = () => {
  const f = useCurrentFrame();
  const flash = [H.phone, H.flip + 0.15, H.wipe + 0.1].reduce((a, at) => a + interpolate(f, [S(at), S(at) + 3, S(at) + 14], [0, 0.5, 0], cl), 0);
  return (
    <>
      <AbsoluteFill style={{ zIndex: 70, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(40,10,5,0.22) 100%)' }} />
      <AbsoluteFill style={{ zIndex: 71, mixBlendMode: 'screen', opacity: flash, background: 'radial-gradient(ellipse at 80% 15%, rgba(255,200,150,0.9), transparent 55%)' }} />
      <AbsoluteFill style={{ zIndex: 72, opacity: 0.07, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%"><filter id="cg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 9} /></filter><rect width="100%" height="100%" filter="url(#cg)" /></svg>
      </AbsoluteFill>
    </>
  );
};

// camera shake on impacts
const shake = (f) => [[H.drop, 10], [H.tag, 8], [H.phone, 7], [H.logo, 6]].reduce(([x, y], [at, a]) => {
  const d = f - S(at); if (d < 0 || d > 14) return [x, y];
  const k = a * Math.exp(-d / 3.5); return [x + Math.sin(d * 2.9) * k, y + Math.cos(d * 3.4) * k];
}, [0, 0]);

export const CalcAd = ({ audio = true }) => {
  const f = useCurrentFrame();
  const [sx, sy] = shake(f);
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: 'hidden', fontFamily: FONT }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <World />
        {f < S(H.crumple + 1.2) && <Sheet />}
        <Phone />
        <Plans />
        {TL.beats.map((b) => <Headline key={b[0]} text={b[2]} at={b[1]} end={beat[b[0]].end} size={Math.max(...b[2].split('|').map((l) => l.replace(/\*/g, '').length)) > 21 ? 78 : 90} />)}
        <Close />
      </AbsoluteFill>
      <Pill />
      <Film />
      {audio && <Audio src={staticFile('audio/calc2.wav')} />}
    </AbsoluteFill>
  );
};
