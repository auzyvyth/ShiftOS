// Live presentation scene: the REAL LivePresenter (recorded at 3x by harness/record-phone.cjs) in the 3D phone.
// First the calculator (deposit and years tapped, the monthly rolls), then Budget > Viewer: a viewer's pay typed,
// the car that fits, by their @name. Taps are drawn where the recording tapped (clicks.json).
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, spring, interpolate } from 'remotion';
import { RED, FONT } from '../ui';
import { Phone, Caption, camAt, BEZ } from '../loan/LoanScene';
import TL from './timeline.json';
import CALC from './calc-ms.clicks.json';
import VIEWER from './viewer-ms.clicks.json';

export const V_FPS = TL.fps;
export const V_DUR = TL.dur;
const BG = '#07080B';
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const W = 400, H = 780, K = 1.22;                 // recorded css size, and its scale inside the phone
const PW = W * K, PH = H * K;
const COPY = {
  ms: { caps: [['Kira', '*depan penonton.*'], ['Deposit, tempoh,', '*satu tap.*'], ['Gaji berapa?', '*Ini yang muat.*'], ['Jawapan untuk', '*setiap penonton.*']],
    note: 'Anggaran sahaja. Keputusan loan dibuat oleh bank.' },
  en: { caps: [['Work it out', '*live.*'], ['Deposit and years,', '*one tap.*'], ["What's your pay?", "*Here's what fits.*"], ['An answer for', '*every viewer.*']],
    note: 'Estimates only. The bank makes the loan decision.' },
};
// the taps of a take, in scene frames
const tapsOf = (take, clicks) => clicks.clicks.map((c) => ({ f: Math.round(take.at + (c.t - take.from) * TL.fps), x: c.x * W, y: c.y * H }))
  .filter((c) => c.f >= take.at && c.f < take.at + take.len);
export const LIVE_TAPS = [...tapsOf(TL.calc, CALC), ...tapsOf(TL.viewer, VIEWER)];

const Ring = ({ t }) => {
  const f = useCurrentFrame();
  if (f < t.f - 1 || f > t.f + 16) return null;
  const p = interpolate(f, [t.f, t.f + 15], [0, 1], cl);
  const r = 34 + p * 46;
  return <div style={{ position: 'absolute', left: t.x * K - r, top: t.y * K - r, width: 2 * r, height: 2 * r, borderRadius: '50%',
    border: `${6 * (1 - p) + 2}px solid ${RED}`, opacity: 1 - p, background: `rgba(220,38,38,${0.18 * (1 - p)})` }} />;
};
const Take = ({ take, name }) => (
  <Sequence from={take.at} durationInFrames={take.len} layout="none">
    <OffthreadVideo src={staticFile(`takes3/${name}-ms.mp4`)} startFrom={Math.round(take.from * TL.fps)} muted
      style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH }} />
  </Sequence>
);

export const LiveScene = ({ lang = 'ms', audio = true }) => {
  const f = useCurrentFrame();
  const C = COPY[lang];
  const PY = 470;
  // camera keys in recorded css px: the big monthly, the deposit chips, the viewer's answer card
  const v = TL.viewer.at;
  const KEYS = [[0, 200, 390, 1], [24, 200, 200, 1.45], [60, 200, 200, 1.45], [76, 200, 330, 1.45], [140, 200, 330, 1.45],
    [v + 4, 200, 390, 1], [v + 40, 200, 200, 1.4], [v + 80, 200, 200, 1.4], [v + 100, 200, 470, 1.45], [TL.dur - 18, 200, 470, 1.45], [TL.dur, 200, 390, 1.05]];
  const cam = camAt(KEYS, f);
  const sx = 540 - PW / 2 + cam.x * K, sy = PY + BEZ + cam.y * K;
  const enter = spring({ frame: f, fps: V_FPS, config: { damping: 16, mass: 0.9, stiffness: 110 } });
  const swap = interpolate(f, [v - 4, v + 6], [0, 1], cl);
  const float = Math.sin(f / 26) * 1.5;
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: [
        `radial-gradient(640px 520px at ${540 + Math.sin(f / 60) * 140}px 1100px, rgba(220,38,38,0.22), transparent 70%)`,
        'radial-gradient(1100px 600px at 540px 0px, rgba(190,190,215,0.14), transparent 70%)' ].join(',') }} />
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(540px, 1120px) scale(${cam.z}) translate(${-sx}px, ${-sy}px)` }}>
        <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '540px 900px' }}>
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateX(${(1 - enter) * 520}px)` }}>
            <Phone x={540} y={PY} w={PW} h={PH} ry={-12 + (1 - enter) * 40 + float + swap * 0} glow={0.6}>
              <Take take={TL.calc} name="calc" />
              <div style={{ position: 'absolute', inset: 0, opacity: swap }}><Take take={TL.viewer} name="viewer" /></div>
              {LIVE_TAPS.map((t, i) => <Ring key={i} t={t} />)}
            </Phone>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG} 0%, ${BG} 22%, rgba(7,8,11,0.6) 27%, transparent 32%, transparent 80%, rgba(7,8,11,0.85) 92%, ${BG} 100%)` }} />
      {TL.captions.map((at, i) => <Caption key={i} lines={C.caps[i]} at={at} until={TL.captions[i + 1] ? TL.captions[i + 1] - 4 : null} />)}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 400, textAlign: 'center', fontFamily: FONT, fontWeight: 500, fontSize: 24,
        color: 'rgba(255,255,255,0.5)' }}>{C.note}</div>
      {audio && <Audio src={staticFile('audio/live.wav')} />}
    </AbsoluteFill>
  );
};
