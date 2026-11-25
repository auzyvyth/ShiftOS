// Broker scene: the REAL "Dealer stock" tab (BrokerStock, Premium) on a sample dealer. A seller puts a
// dealer's car on their own page, registers a buyer, the buyer is held for them 14 days, the commission
// is on record. Phone parts, camera and captions shared with the loan scene; timing in timeline.json.
// The tab is English in the app today, so both cuts show the same screens; only the captions change.
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, interpolate, spring } from 'remotion';
import { RED, FONT } from '../ui';
import { Phone, Shot, Push, Tap, Outline, Caption, camAt, S, SW, BEZ } from '../loan/LoanScene';
import TL from './timeline.json';
import R from './rects.json';

export const B_FPS = TL.fps;
export const B_DUR = TL.dur;
const BG = '#FFFFFF';   // owner, 2026-11-25: white with a hint of red, so the app shows
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

const COPY = {
  ms: { caps: [['Jual stok dealer,', '*dari page anda.*'], ['Satu tap,', '*masuk page anda.*'], ['Daftar', '*pembeli anda.*'],
    ['Dipegang untuk anda', '*14 hari.*'], ['Komisen', '*direkod.*']], note: 'Contoh dealer dan pembeli. Komisen dipersetujui dengan dealer.' },
  en: { caps: [['Sell dealer stock', '*from your page.*'], ['One tap,', "*it's on your page.*"], ['Register', '*your buyer.*'],
    ['Held for you', '*14 days.*'], ['The commission,', '*on record.*']], note: 'Sample dealer and buyer. Commission is agreed with the dealer.' },
};

const FOCUS_Y = 1120;
const mid = (r) => r.y + r.h / 2;
const KEYS = [
  [0, 195, 430, 1], [TL.outlineCar - 4, 195, 430, 1],
  [TL.outlineCar + 10, 195, mid(R.first), 1.6], [TL.tapAdd - 6, 195, mid(R.first), 1.6],
  [TL.added + 8, 195, mid(R.first) + 40, 1.45], [TL.tapRegister - 4, 195, mid(R.first) + 40, 1.45],
  [TL.sheet + 12, 195, 560, 1.3], [TL.tapSubmit - 2, 195, 600, 1.3],
  [TL.held + 12, 195, mid(R.heldMsg), 1.4], [TL.buyers - 6, 195, mid(R.heldMsg), 1.4],
  [TL.buyers + 10, 195, mid(R.buyer), 1.6], [TL.dur - 24, 195, mid(R.buyer), 1.6], [TL.dur, 195, 430, 1.05],
];

export const BrokerScene = ({ lang = 'ms', audio = true, entered = false }) => {
  const f = useCurrentFrame();
  const C = COPY[lang];
  const img = (n) => staticFile(`real/broker-${n}.png`);
  const enter = entered ? 1 : spring({ frame: f, fps: B_FPS, config: { damping: 16, mass: 0.9, stiffness: 110 } });
  const cam = camAt(KEYS, f);
  const PY = 450;
  const sx = 540 - SW / 2 + cam.x * S, sy = PY + BEZ + cam.y * S;
  const float = Math.sin(f / 26) * 1.5;
  // the earning line pulses once, on its beat
  const earn = interpolate(f, [TL.earn, TL.earn + 6, TL.earn + 22], [0, 1, 0], cl);
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: [
        `radial-gradient(640px 520px at ${540 + Math.sin(f / 60) * 140}px 1100px, rgba(220,38,38,0.09), transparent 70%)`,
        'radial-gradient(1100px 600px at 540px 0px, rgba(220,38,38,0.05), transparent 70%)' ].join(',') }} />
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(540px, ${FOCUS_Y}px) scale(${cam.z}) translate(${-sx}px, ${-sy}px)` }}>
        <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '540px 900px' }}>
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateX(${(1 - enter) * 520}px)` }}>
            <Phone x={540} y={PY} ry={-12 + (1 - enter) * 40 + float} glow={0.6}>
              <Shot src={img('stock')} />
              <Outline at={TL.outlineCar} r={R.first} until={TL.tapAdd - 4} />
              {earn > 0 && <div style={{ position: 'absolute', left: (R.earn.x - 8) * S, top: (R.earn.y - 6) * S, width: (R.earn.w + 16) * S, height: (R.earn.h + 12) * S,
                borderRadius: 12, boxShadow: `0 0 ${30 * earn}px rgba(110,231,183,${0.7 * earn})`, border: `3px solid rgba(110,231,183,${earn})` }} />}
              <Tap at={TL.tapAdd} r={R.add} />
              <Push at={TL.added} fade><Shot src={img('added')} /></Push>
              <Tap at={TL.tapRegister} r={R.register} />
              <Push at={TL.sheet} up><Shot src={img('sheet')} /></Push>
              <Tap at={TL.tapSubmit} r={R.submit} />
              <Push at={TL.held} fade><Shot src={img('held')} /><Outline at={TL.outlineHeld} r={{ ...R.heldMsg, x: 10, w: 370, y: R.heldMsg.y + 10, h: R.heldMsg.h - 20 }} until={TL.buyers - 4} /></Push>
              <Push at={TL.buyers}><Shot src={img('buyers')} /><Outline at={TL.outlineBuyer} r={R.buyer} /></Push>
            </Phone>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG} 0%, ${BG} 22%, rgba(255,255,255,0.6) 27%, transparent 32%, transparent 80%, rgba(255,255,255,0.85) 92%, ${BG} 100%)` }} />
      {TL.captions.map((at, i) => <Caption key={i} lines={C.caps[i]} at={at} until={TL.captions[i + 1] ? TL.captions[i + 1] - 4 : null} />)}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 400, textAlign: 'center', fontFamily: FONT, fontWeight: 500, fontSize: 24,
        color: 'rgba(11,12,15,0.5)' }}>{C.note}</div>
      {audio && <Audio src={staticFile('audio/broker.wav')} />}
    </AbsoluteFill>
  );
};
