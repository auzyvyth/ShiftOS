// The Premium tour ad: the five scenes joined (briefs/premium-tour.md), a red chapter card at every topic
// change (STYLE.md), an end card. Each scene renders silent here; the joined sound is audio/tour-<lang>.wav
// (make-audio-tour.py), cut from the scenes' own mixes on the same bar lines.
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, spring, interpolate } from 'remotion';
import { RED, FONT } from '../ui';
import { Caption } from '../loan/LoanScene';
import { DashPan } from '../dash/DashPan';
import { BrokerScene } from '../broker/BrokerScene';
import { MiniScene } from '../mini/MiniScene';
import { LiveScene } from '../live/LiveScene';
import { LoanScene } from '../loan/LoanScene';
import TL from './timeline.json';

export const T_FPS = TL.fps;
export const T_DUR = TL.segments.reduce((s, g) => s + g.len, 0);
const SCENES = { dash: DashPan, broker: BrokerScene, mini: MiniScene, live: LiveScene, loan: LoanScene };
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

// hard cut in, hard cut out: full red, the chapter number big behind, "Now:" + the topic
const Card = ({ n, topic, lang }) => {
  const f = useCurrentFrame();
  if (f >= TL.card) return null;
  const p = spring({ frame: f, fps: T_FPS, config: { damping: 12, mass: 0.5, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ background: RED, alignItems: 'center', justifyContent: 'center', fontFamily: FONT, zIndex: 100 }}>
      <div style={{ position: 'absolute', fontSize: 900, fontWeight: 700, color: 'rgba(255,255,255,0.12)', letterSpacing: -40,
        transform: `translateY(${(1 - p) * 60}px)` }}>{String(n).padStart(2, '0')}</div>
      <div style={{ textAlign: 'center', color: '#fff', transform: `scale(${0.9 + 0.1 * p})` }}>
        <div style={{ fontSize: 44, fontWeight: 500, opacity: 0.85 }}>{lang === 'ms' ? 'Sekarang:' : 'Now:'}</div>
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -5 }}>{topic}</div>
      </div>
    </AbsoluteFill>
  );
};

const End = ({ lang }) => {
  const f = useCurrentFrame();
  const g = spring({ frame: f, fps: T_FPS, config: { damping: 12, mass: 0.8, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ background: '#07080B', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: FONT }}>
      <AbsoluteFill style={{ background: 'radial-gradient(700px 520px at 540px 900px, rgba(220,38,38,0.28), transparent 70%)' }} />
      <Img src={staticFile('drevo-logo.svg')} style={{ width: 600, transform: `scale(${0.5 + 0.5 * g})`, opacity: Math.min(1, g * 2),
        filter: `drop-shadow(0 0 ${40 * g}px rgba(244,0,0,0.55))`, marginTop: -180 }} />
      <div style={{ position: 'absolute', top: 780, left: 0, right: 0 }}>
        <Caption lines={lang === 'ms' ? ['Cuba Premium', '*7 hari percuma.*'] : ['Try Premium', '*free for 7 days.*']} at={8} />
      </div>
      <div style={{ position: 'absolute', top: 1260, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 48, fontWeight: 700,
        opacity: interpolate(f, [30, 40], [0, 1], cl) }}>drevo.my</div>
    </AbsoluteFill>
  );
};

export const Tour = ({ lang = 'ms', audio = true }) => {
  let at = 0, n = 1;
  return (
    <AbsoluteFill style={{ background: '#07080B' }}>
      {TL.segments.map((g) => {
        const from = at; at += g.len;
        const Scene = SCENES[g.id];
        const num = g.topic ? ++n : null;
        return (
          <Sequence key={g.id} from={from} durationInFrames={g.len}>
            {Scene ? <Scene lang={lang} audio={false} /> : <End lang={lang} />}
            {g.topic && <Card n={num} topic={g.topic[lang]} lang={lang} />}
          </Sequence>
        );
      })}
      {audio && <Audio src={staticFile(`audio/tour-${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
