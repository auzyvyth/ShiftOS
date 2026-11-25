// Dashboard pan: the REAL Salesman Premium dashboard (harness/dash.jsx, sample seller) lying in 3D,
// the camera glides from box to box and each box lifts off the page with a red outline.
// Motion from the owner's reference (.reanimate/pan/spec.md); timing from timeline.json, which
// make-audio-dash.py also reads, so every arrival lands on a downbeat.
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, spring, Easing } from 'remotion';
import { RED, FONT } from '../ui';
import TL from './timeline.json';
import RECTS from './rects.json';

export const D_FPS = TL.fps;
export const D_DUR = TL.dur;
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const BG = '#07080B';
const CY = 1010;
const TOP = 125;
// The page is LAID OUT K times bigger and the camera scale divided by K: Chrome rasters a 3D layer at its
// layout size, so a 1280 px page zoomed 3x came out pixelated. At K = 4 it rasters from the full 4x capture.
const K = 4;                                  // css px: the referral strip sits above this line                                   // where the focus point sits on screen (y)

const COPY = {
  ms: {
    boxes: [['Berapa orang', '*tekan WhatsApp.*'], ['Berapa ramai', '*buka page anda.*'], ['Naik turun', '*7 hari lepas.*'],
      ['Kereta mana', '*paling ramai tengok.*'], ['Link mana', '*bawa pembeli.*']],
    end: ['Semua angka,', '*satu dashboard.*'], note: 'Contoh data. Dashboard sebenar Drevo Premium.',
  },
  en: {
    boxes: [['How many', '*tapped WhatsApp.*'], ['How many', '*opened your page.*'], ['Up and down,', '*last 7 days.*'],
      ['Which car', '*gets the most looks.*'], ['Which link', '*brings buyers.*']],
    end: ['Every number,', '*one dashboard.*'], note: 'Sample data. The real Drevo Premium dashboard.',
  },
};

// ---------- the camera: keyframes of (focus x, focus y, scale, tilt x, tilt y, roll) ----------
const box = (lang) => {
  const r = RECTS[lang], t = r.tiles, s = r.sections;
  const by = (re) => s.find((x) => re.test(x.title));
  return [t[1], t[2], by(/Trafik|Traffic/), by(/Kereta teratas|Top cars/), by(/Halaman anda|Your page/)];
};
const fit = (b, w) => w / b.w;
const camKeys = (lang) => {
  const B = box(lang), W = RECTS[lang].size.w, H = RECTS[lang].size.h;
  const c = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  const tilt = [[14, -16, 2], [12, 14, -2], [24, 0, 0], [10, -14, 1.5], [12, 15, -2]];
  const width = [600, 600, 960, 880, 860];
  const keys = [
    { f: 0, x: W / 2, y: H * 0.75, s: 0.42, rx: 70, ry: 0, rz: -24 },
    { f: TL.overview, x: W / 2, y: H * 0.57, s: 0.8, rx: 40, ry: 0, rz: -9 },
  ];
  TL.boxes.forEach((d, i) => {
    const [x, y] = c(B[i]); const [rx, ry, rz] = tilt[i];
    const k = { x, y, s: fit(B[i], width[i]), rx, ry, rz };
    keys.push({ ...keys[keys.length - 1], f: d - TL.travel });   // hold, then travel
    keys.push({ f: d, ...k });
  });
  keys.push({ ...keys[keys.length - 1], f: TL.pullback - TL.travel });
  keys.push({ f: TL.pullback, x: W / 2, y: H * 0.57, s: 0.78, rx: 32, ry: -6, rz: -6 });
  keys.push({ f: TL.logo, x: W / 2, y: H * 0.54, s: 0.7, rx: 46, ry: 0, rz: -10 });
  keys.push({ f: TL.dur, x: W / 2, y: H * 0.5, s: 0.6, rx: 58, ry: 0, rz: -14 });
  return keys.filter((k, i, a) => i === 0 || k.f > a[i - 1].f);
};
const smooth = Easing.bezier(0.65, 0, 0.25, 1);    // slow out, glide, long settle
const camAt = (keys, f) => {
  let i = 0; while (i < keys.length - 2 && f >= keys[i + 1].f) i++;
  const a = keys[i], b = keys[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f))));
  const L = (k) => a[k] + (b[k] - a[k]) * t;
  // scale moves in log space so a zoom feels even all the way
  return { x: L('x'), y: L('y'), s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * t), rx: L('rx'), ry: L('ry'), rz: L('rz') };
};

// ---------- one box, lifted off the page: a copy of its pixels pushed up in Z, outlined red ----------
const Lift = ({ b: b0, at, img, W, H, out }) => {
  const b = { x: b0.x * K, y: b0.y * K, w: b0.w * K, h: b0.h * K };
  const f = useCurrentFrame();
  const up = spring({ frame: f - at, fps: D_FPS, config: { damping: 15, mass: 0.8, stiffness: 120 } });
  const down = out ? interpolate(f, [out, out + 8], [0, 1], { ...cl, easing: Easing.in(Easing.cubic) }) : 0;
  const lift = up * (1 - down);
  if (lift <= 0.001) return null;
  const draw = interpolate(f, [at - 2, at + 14], [0, 1], { ...cl, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const sheen = interpolate(f, [at + 4, at + 18], [-0.4, 1.4], cl);
  const pad = 7 * K, rad = 22 * K;
  return (
    <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, transformStyle: 'preserve-3d',
      transform: `translateZ(${lift * 70 * K}px) scale(${1 + lift * 0.04})` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: rad, overflow: 'hidden',
        backgroundImage: `url(${img})`, backgroundSize: `${W}px ${H}px`, backgroundPosition: `${-b.x}px ${-b.y}px`,
        boxShadow: `0 ${30 * K * lift}px ${70 * K * lift}px rgba(0,0,0,${0.75 * lift}), 0 0 ${60 * K * lift}px rgba(220,38,38,${0.35 * lift})` }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${sheen * 100 - 18}%, rgba(255,255,255,0.13) ${sheen * 100}%, transparent ${sheen * 100 + 18}%)` }} />
      </div>
      <svg style={{ position: 'absolute', left: -pad, top: -pad, overflow: 'visible' }} width={b.w + 2 * pad} height={b.h + 2 * pad}>
        <rect x={6} y={6} width={b.w + 2 * pad - 12} height={b.h + 2 * pad - 12} rx={rad + pad} fill="none" stroke={RED} strokeWidth={3 * K}
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={lift} />
      </svg>
    </div>
  );
};

// ---------- caption: two lines, words pop on the beat, line 2 red ----------
const Caption = ({ lines, at, out }) => {
  const f = useCurrentFrame();
  if (f < at - 1 || (out && f > out + 10)) return null;
  const gone = out ? interpolate(f, [out, out + 8], [0, 1], cl) : 0;
  let n = 0;
  return (
    <div style={{ position: 'absolute', top: 236, left: 60, right: 60, textAlign: 'center', fontFamily: FONT, fontWeight: 700,
      fontSize: 92, letterSpacing: -4, lineHeight: 1.05, opacity: 1 - gone, filter: `blur(${gone * 10}px)` }}>
      {lines.map((ln, li) => {
        const red = ln.startsWith('*');
        return (
          <div key={li} style={{ color: red ? RED : '#FFFFFF' }}>
            {ln.replace(/\*/g, '').split(' ').map((w, wi) => {
              const t0 = at + (n++) * 3;
              const p = interpolate(f, [t0, t0 + 10], [0, 1], { ...cl, easing: Easing.bezier(0.16, 1, 0.3, 1) });
              return <span key={wi} style={{ display: 'inline-block', marginRight: 20, opacity: p, filter: `blur(${(1 - p) * 12}px)`,
                transform: `translateY(${(1 - p) * 28}px)` }}>{w}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
};

export const DashPan = ({ lang = 'ms', audio = true }) => {
  const f = useCurrentFrame();
  const C = COPY[lang];
  const img = staticFile(`real/dash-${lang}.png`);
  const { w: W, h: H } = RECTS[lang].size;
  const keys = camKeys(lang);
  const cam = camAt(keys, f);
  const B = box(lang);
  const focused = TL.boxes.findIndex((d, i) => f >= d - 4 && f < (TL.boxes[i + 1] ?? TL.pullback) - TL.travel + 8);
  const dimTo = f >= TL.boxes[0] - 6 && f < TL.pullback - 6 ? 0.55 : 0;
  const dim = interpolate(f, [TL.boxes[0] - 10, TL.boxes[0]], [0, 1], cl) * interpolate(f, [TL.pullback - 14, TL.pullback], [1, 0], cl) * dimTo;
  const enter = interpolate(f, [0, 22], [0, 1], cl);
  const endFade = interpolate(f, [TL.logo, TL.logo + 18], [1, 0.28], cl);
  const logo = spring({ frame: f - TL.logo, fps: D_FPS, config: { damping: 12, mass: 0.8, stiffness: 140 } });
  const drift = Math.sin(f / 70) * 160;
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      {/* light behind the page: a red pool drifting, and a cool top light like the reference */}
      <AbsoluteFill style={{ background: [
        `radial-gradient(700px 520px at ${540 + drift}px ${CY + 120}px, rgba(220,38,38,${0.22 + 0.1 * (focused >= 0)}), transparent 70%)`,
        `radial-gradient(1100px 600px at 540px 0px, rgba(190,190,215,0.16), transparent 70%)` ].join(',') }} />
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: `540px ${CY - 160}px` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W * K, height: H * K, transformOrigin: '0 0', transformStyle: 'preserve-3d',
          opacity: enter * endFade,
          transform: `translate(540px, ${CY}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) rotateZ(${cam.rz}deg) scale(${cam.s / K}) translate(${-cam.x * K}px, ${-cam.y * K}px)` }}>
          {/* the page from the greeting down: the invite strip above it is cropped off */}
          <div style={{ position: 'absolute', left: 0, top: TOP * K, width: W * K, height: (H - TOP) * K, borderRadius: 28 * K, overflow: 'hidden',
            boxShadow: `0 ${60 * K}px ${160 * K}px rgba(0,0,0,0.8), 0 0 0 ${K}px rgba(255,255,255,0.06)` }}>
            <Img src={img} style={{ position: 'absolute', left: 0, top: -TOP * K, width: W * K, height: H * K }} />
            <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: Math.max(dim, 0.6 * (1 - enter)) }} />
          </div>
          {TL.boxes.map((d, i) => (
            <Lift key={i} b={B[i]} at={d} img={img} W={W * K} H={H * K} out={(TL.boxes[i + 1] ?? TL.pullback) - TL.travel + 2} />
          ))}
          {/* the pull-back: every box outlined at once, one per 8th note */}
          {f >= TL.pullback - 8 && f < TL.logo + 20 && B.map((b, i) => {
            const at = TL.pullback + i * 4;
            const p = interpolate(f, [at, at + 10], [0, 1], cl) * interpolate(f, [TL.logo, TL.logo + 14], [1, 0], cl);
            return <div key={`o${i}`} style={{ position: 'absolute', left: (b.x - 6) * K, top: (b.y - 6) * K, width: (b.w + 12) * K, height: (b.h + 12) * K,
              borderRadius: 26 * K, border: `${3 * K}px solid ${RED}`, opacity: p, transform: `translateZ(${p * 24 * K}px)`,
              boxShadow: `0 0 ${40 * K}px rgba(220,38,38,${0.5 * p})` }} />;
          })}
        </div>
      </AbsoluteFill>
      {/* fog top and bottom, the reference's depth falloff */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG} 0%, rgba(7,8,11,0.85) 9%, transparent 26%, transparent 74%, rgba(7,8,11,0.9) 90%, ${BG} 100%)` }} />
      {TL.boxes.map((d, i) => (
        <Caption key={i} lines={C.boxes[i]} at={d - TL.travel} out={(TL.boxes[i + 1] ?? TL.pullback) - TL.travel} />
      ))}
      <Caption lines={C.end} at={TL.pullback + 2} out={TL.logo - 6} />
      {f >= TL.logo && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Img src={staticFile('drevo-logo.svg')} style={{ width: 620, transform: `scale(${0.5 + 0.5 * logo})`, opacity: Math.min(1, logo * 2),
            filter: `drop-shadow(0 0 ${40 * logo}px rgba(244,0,0,0.55))`, marginTop: -120 }} />
          <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 700, fontSize: 46, color: '#fff',
            opacity: interpolate(f, [TL.logo + 16, TL.logo + 26], [0, 1], cl) }}>drevo.my</div>
        </AbsoluteFill>
      )}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 1400, textAlign: 'center', fontFamily: FONT, fontWeight: 500,
        fontSize: 26, color: 'rgba(255,255,255,0.5)', opacity: interpolate(f, [30, 50], [0, 1], cl) }}>{C.note}</div>
      {audio && <Audio src={staticFile('audio/dash.wav')} />}
    </AbsoluteFill>
  );
};
