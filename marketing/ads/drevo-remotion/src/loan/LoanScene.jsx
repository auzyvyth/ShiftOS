// Loan check scene: the seller's phone runs the REAL Loan check (credit -> what to fix -> what to bring),
// sends it on WhatsApp, and the buyer's phone opens the REAL loan page (what is still needed, which bank
// is looking). Screens + tap points from harness/loan.cjs. Same dark 3D world and beat grid as DashPan.
// The chat screen is drawn neutral (no messaging-app branding); its two messages are the app's real text:
// the loan check's document list (message.json) and the bank application's "Share with buyer" link.
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, spring, Easing } from 'remotion';
import { RED, FONT } from '../ui';
import TL from './timeline.json';
import RECTS from './rects.json';
import MSG from './message.json';

export const L_FPS = TL.fps;
export const L_DUR = TL.dur;
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const BG = '#07080B';
const out = Easing.bezier(0.16, 1, 0.3, 1);
const sp = (f, at, c = { damping: 14, mass: 0.7, stiffness: 150 }) => spring({ frame: f - at, fps: L_FPS, config: c });

const COPY = {
  ms: {
    caps: [['Semak dulu,', '*sebelum bank.*'], ['Tahu apa', '*nak dibetulkan.*'], ['Senarai dokumen,', '*siap dihantar.*'],
      ['Terus ke', '*WhatsApp pembeli.*'], ['Pembeli nampak', '*apa masih kurang.*'], ['Dan bank mana', '*sedang semak.*']],
    seller: 'Aiman · Jurujual', note: 'Contoh pembeli. Keputusan loan dibuat oleh bank.',
  },
  en: {
    caps: [['Check first,', '*before the bank.*'], ['Know what', '*to fix.*'], ['The document list,', '*ready to send.*'],
      ['Straight to', "*the buyer's WhatsApp.*"], ['The buyer sees', '*what is still missing.*'], ['And which bank', '*is looking.*']],
    seller: 'Aiman · Sales advisor', note: 'Sample buyer. The bank makes the loan decision.',
  },
};
// The bank application's "Share with buyer" message (LoanDesk.jsx shareWithBuyer), English in the app today.
const LINK_MSG = "Hi Nadia, here's your car loan page — where each bank stands and what documents are still needed. It updates as things move:";

// ---------- phone: 390x844 screen at S, standing in 3D ----------
export const S = 1.25, SW = 390 * S, SH = 844 * S, BEZ = 16;
export const Phone = ({ x, y, ry, rx = 6, z = 0, children, glow = 0, w = SW, h = SH }) => (
  <div style={{ position: 'absolute', left: x - w / 2 - BEZ, top: y, width: w + 2 * BEZ, height: h + 2 * BEZ, borderRadius: 64,
    background: '#16181d', boxShadow: `0 60px 120px rgba(0,0,0,0.75), 0 0 0 2px #2a2d34, 0 0 ${90 * glow}px rgba(220,38,38,${0.45 * glow})`,
    transform: `translateZ(${z}px) rotateY(${ry}deg) rotateX(${rx}deg)`, transformStyle: 'preserve-3d' }}>
    <div style={{ position: 'absolute', left: BEZ, top: BEZ, width: w, height: h, borderRadius: 50, overflow: 'hidden', background: '#0b0c0f' }}>
      {children}
    </div>
  </div>
);
export const Shot = ({ src, y = 0, h = 844 }) => <Img src={src} style={{ position: 'absolute', left: 0, top: -y * S, width: SW, height: h * S }} />;
// a new screen slides over the old one, like app navigation
export const Push = ({ at, children, up = false, fade = false }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = interpolate(f, [at, at + 10], [0, 1], { ...cl, easing: out });
  const move = fade ? 'none' : up ? `translateY(${(1 - p) * SH * 0.6}px)` : `translateX(${(1 - p) * SW}px)`;
  return <div style={{ position: 'absolute', inset: 0, transform: move, opacity: fade || up ? Math.min(1, p * 1.5) : 1, boxShadow: fade ? 'none' : '-20px 0 40px rgba(0,0,0,0.5)' }}>{children}</div>;
};
// a tap: the button dims for a moment and a red ring opens from it
export const Tap = ({ at, r }) => {
  const f = useCurrentFrame();
  if (!r || f < at - 2 || f > at + 18) return null;
  const p = interpolate(f, [at, at + 16], [0, 1], { ...cl, easing: out });
  const cx = (r.x + r.w / 2) * S, cy = (r.y + r.h / 2) * S;
  return (
    <>
      <div style={{ position: 'absolute', left: r.x * S, top: r.y * S, width: r.w * S, height: r.h * S, borderRadius: 14,
        background: `rgba(255,255,255,${0.25 * (1 - p)})` }} />
      <div style={{ position: 'absolute', left: cx - 40 - p * 40, top: cy - 40 - p * 40, width: 80 + p * 80, height: 80 + p * 80, borderRadius: '50%',
        border: `${6 * (1 - p) + 2}px solid ${RED}`, opacity: 1 - p }} />
    </>
  );
};
// a red outline drawn around a block, inside the screen
export const Outline = ({ at, r, until }) => {
  const f = useCurrentFrame();
  if (!r || f < at - 1 || (until && f > until + 8)) return null;
  const d = interpolate(f, [at, at + 12], [0, 1], { ...cl, easing: out });
  const gone = until ? interpolate(f, [until, until + 8], [0, 1], cl) : 0;
  const pad = 6;
  return (
    <svg style={{ position: 'absolute', left: (r.x - pad) * S, top: (r.y - pad) * S, overflow: 'visible', opacity: 1 - gone }} width={(r.w + 2 * pad) * S} height={(r.h + 2 * pad) * S}>
      <rect x={2} y={2} width={(r.w + 2 * pad) * S - 4} height={(r.h + 2 * pad) * S - 4} rx={18} fill="none" stroke={RED} strokeWidth={4}
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - d} style={{ filter: 'drop-shadow(0 0 10px rgba(220,38,38,0.7))' }} />
    </svg>
  );
};

// ---------- the buyer's chat (neutral, no app branding) ----------
const Bubble = ({ at, children }) => {
  const f = useCurrentFrame();
  const p = sp(f, at, { damping: 13, mass: 0.6, stiffness: 180 });
  if (f < at) return null;
  return <div style={{ alignSelf: 'flex-start', maxWidth: '86%', background: '#1f2229', color: '#f3f4f6', borderRadius: '6px 22px 22px 22px',
    padding: '16px 18px', fontSize: 19, lineHeight: 1.38, whiteSpace: 'pre-wrap', transformOrigin: 'top left',
    transform: `scale(${0.6 + 0.4 * p}) translateY(${(1 - p) * 20}px)`, opacity: Math.min(1, p * 1.6) }}>{children}</div>;
};
const Chat = ({ lang }) => {
  const f = useCurrentFrame();
  const lines = MSG[lang].split('\n');
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0d0e12', fontFamily: FONT }}>
      <div style={{ height: 118, display: 'flex', alignItems: 'flex-end', gap: 14, padding: '0 22px 16px', background: '#15171c', borderBottom: '1px solid #23262d' }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: RED, color: '#fff', fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A</div>
        <div style={{ color: '#f3f4f6', fontSize: 22, fontWeight: 700, paddingBottom: 10 }}>{COPY[lang].seller}</div>
      </div>
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 26, display: 'flex', flexDirection: 'column', gap: 14,
        transform: `translateY(${interpolate(f, [TL.msg2, TL.msg2 + 10], [0, -40], { ...cl, easing: out })}px)` }}>
        <Bubble at={TL.msg1}>{lines.slice(0, 9).join('\n')}{'\n'}…</Bubble>
        <Bubble at={TL.msg2}>
          {LINK_MSG}
          <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', background: '#2a2d35' }}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Car loan · Drevo</div>
              <div style={{ color: '#7aa7ff', fontSize: 17, marginTop: 2 }}>drevo.my/loan/••••••</div>
            </div>
          </div>
        </Bubble>
      </div>
    </div>
  );
};

// ---------- caption ----------
export const Caption = ({ lines, at, until }) => {
  const f = useCurrentFrame();
  if (f < at || (until && f > until + 8)) return null;
  const gone = until ? interpolate(f, [until, until + 6], [0, 1], cl) : 0;
  let n = 0;
  return (
    <div style={{ position: 'absolute', top: 214, left: 50, right: 50, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 84,
      letterSpacing: -3.5, lineHeight: 1.04, opacity: 1 - gone, filter: `blur(${gone * 10}px)`, zIndex: 20 }}>
      {lines.map((ln, li) => (
        <div key={li} style={{ color: ln.startsWith('*') ? RED : '#fff' }}>
          {ln.replace(/\*/g, '').split(' ').map((w, wi) => {
            const t0 = at + (n++) * 3;
            const p = interpolate(f, [t0, t0 + 9], [0, 1], { ...cl, easing: out });
            return <span key={wi} style={{ display: 'inline-block', marginRight: 18, opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 24}px)` }}>{w}</span>;
          })}
        </div>
      ))}
    </div>
  );
};

// ---------- camera: zooms into the part of the screen that matters, glides between them ----------
// keys: [frame, x, y (css px on the 390x844 screen), zoom]; the point lands at (540, FOCUS_Y) on video.
const FOCUS_Y = 1120;
const camKeys = (R, scrollMax) => [
  [0, 195, 430, 1], [TL.fix - 4, 195, 430, 1],
  [TL.outlineFix + 2, 195, R.fixList.y + R.fixList.h / 2 - 20, 1.55], [TL.tapBring - 8, 195, R.fixList.y + R.fixList.h / 2 - 20, 1.55],
  [TL.tapBring, 195, 330, 1.05], [TL.bring + 10, 195, 650, 1.45], [TL.tapSend - 6, 195, 650, 1.45],
  [TL.tapSend + 2, 195, 560, 1.0], [TL.swap + 16, 195, 560, 1.0],
  [TL.msg1 + 10, 195, 560, 1.35], [TL.msg2 + 6, 195, 660, 1.4], [TL.tapLink + 2, 195, 660, 1.4],
  [TL.share + 12, 195, R.needed.y + R.needed.h / 2, 1.5], [TL.scroll[0], 195, R.needed.y + R.needed.h / 2, 1.5],
  [TL.outlineBanks + 2, 195, R.banks.y - scrollMax + R.banks.h / 2, 1.5], [TL.dur - 28, 195, R.banks.y - scrollMax + R.banks.h / 2, 1.5],
  [TL.dur, 195, 430, 1.0],
];
export const glide = Easing.bezier(0.65, 0, 0.25, 1);
export const camAt = (keys, f) => {
  let i = 0; while (i < keys.length - 2 && f >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const t = glide(Math.min(1, Math.max(0, (f - a[0]) / (b[0] - a[0]))));
  return { x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, z: Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * t) };
};

export const LoanScene = ({ lang = 'ms', audio = true }) => {
  const f = useCurrentFrame();
  const R = RECTS[lang], C = COPY[lang];
  const img = (n) => staticFile(`real/loan-${n}-${lang}.png`);
  // seller phone: swings in, holds, then steps back left when the message goes out
  const enter = sp(f, TL.enter, { damping: 16, mass: 0.9, stiffness: 110 });
  const away = interpolate(f, [TL.swap, TL.swap + 16], [0, 1], { ...cl, easing: Easing.bezier(0.65, 0, 0.25, 1) });
  const buyerIn = interpolate(f, [TL.swap, TL.swap + 16], [0, 1], { ...cl, easing: Easing.bezier(0.65, 0, 0.25, 1) });
  const float = Math.sin(f / 26) * 1.5;
  const scrollY = interpolate(f, TL.scroll, [0, R.banks.y - 330], { ...cl, easing: Easing.bezier(0.65, 0, 0.25, 1) });
  const PY = 450;
  const scrollMax = R.banks.y - 330;
  const cam = camAt(camKeys(R, scrollMax), f);
  const sx = 540 - SW / 2 + cam.x * S, sy = PY + BEZ + cam.y * S;   // the focus point on the unzoomed stage
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: [
        `radial-gradient(640px 520px at ${540 + Math.sin(f / 60) * 140}px 1100px, rgba(220,38,38,0.22), transparent 70%)`,
        'radial-gradient(1100px 600px at 540px 0px, rgba(190,190,215,0.14), transparent 70%)' ].join(',') }} />
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(540px, ${FOCUS_Y}px) scale(${cam.z}) translate(${-sx}px, ${-sy}px)` }}>
      <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '540px 900px' }}>
        {/* the seller's phone */}
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', opacity: 1 - away * 0.65,
          transform: `translateX(${(1 - enter) * 500 - away * 330}px) translateZ(${-away * 520}px)` }}>
          <Phone x={540} y={PY} ry={-14 + (1 - enter) * 40 + away * 22 + float} glow={f < TL.swap ? 0.6 : 0}>
            <Shot src={img('check')} />
            <Tap at={TL.tapLate} r={R.late} />
            <Tap at={TL.tapCcris} r={R.ccris} />
            <Push at={TL.fix}><Shot src={img('fix')} /><Outline at={TL.outlineFix} r={R.fixList} until={TL.tapBring} /></Push>
            <Tap at={TL.tapBring} r={R.bringTab} />
            <Push at={TL.bring}><Shot src={img('bring')} /></Push>
            <Tap at={TL.tapSend} r={R.send} />
          </Phone>
        </div>
        {/* the buyer's phone */}
        {f >= TL.swap - 1 && (
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateX(${(1 - buyerIn) * 640}px)` }}>
            <Phone x={540} y={PY} ry={12 - (1 - buyerIn) * 30 - float} glow={0.6 * buyerIn}>
              <Chat lang={lang} />
              <Tap at={TL.tapLink} r={{ x: 30, y: 700, w: 300, h: 70 }} />
              <Push at={TL.share}>
                <Shot src={img('share')} y={scrollY} h={R.shareH} />
                <div style={{ position: 'absolute', left: 0, top: -scrollY * S, width: SW }}>
                  <Outline at={TL.outlineNeeded} r={R.needed} until={TL.scroll[0]} />
                  <Outline at={TL.outlineBanks} r={R.banks} />
                </div>
              </Push>
            </Phone>
          </div>
        )}
      </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG} 0%, ${BG} 22%, rgba(7,8,11,0.6) 27%, transparent 32%, transparent 80%, rgba(7,8,11,0.85) 92%, ${BG} 100%)` }} />
      {TL.captions.map((at, i) => <Caption key={i} lines={C.caps[i]} at={at} until={TL.captions[i + 1] ? TL.captions[i + 1] - 4 : null} />)}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 400, textAlign: 'center', fontFamily: FONT, fontWeight: 500, fontSize: 24,
        color: 'rgba(255,255,255,0.5)' }}>{C.note}</div>
      {audio && <Audio src={staticFile(`audio/loan.wav`)} />}
    </AbsoluteFill>
  );
};
