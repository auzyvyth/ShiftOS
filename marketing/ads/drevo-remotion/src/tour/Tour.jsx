// The Premium tour as ONE continuous shot: the Drevo logo, then a map of every part around it. The camera
// outlines a part, glides into it, and the part becomes the clip (each node IS its scene, frozen on the frame
// the clip opens on, so the zoom lands on the first frame with no cut). After the clip it glides back to the
// map, outlines the next part, and goes in again. Timing: timeline.json. Sound: make-audio-tour.py.
import React from 'react';
import { AbsoluteFill, Audio, Freeze, Img, staticFile, useCurrentFrame, spring, interpolate, Easing } from 'remotion';
import { RED, FONT } from '../ui';
import { Caption } from '../loan/LoanScene';
import { DashPan } from '../dash/DashPan';
import { BrokerScene } from '../broker/BrokerScene';
import { MiniScene } from '../mini/MiniScene';
import { LiveScene } from '../live/LiveScene';
import { LoanScene } from '../loan/LoanScene';
import TL from './timeline.json';

const SCENES = { dash: DashPan, broker: BrokerScene, mini: MiniScene, live: LiveScene, loan: LoanScene };
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const glide = Easing.bezier(0.65, 0, 0.25, 1);
const NS = TL.nodeScale, NW = 1080 * NS, NH = 1920 * NS;
const BG = '#07080B';

// every part's moments, in tour frames
export const PLAN = (() => {
  let c = TL.start;
  const parts = TL.parts.map((p) => {
    const outline = c, inStart = c + TL.outline, play = inStart + TL.zoomIn, outStart = play + p.clip, back = outStart + TL.zoomOut;
    c = back;
    return { ...p, outline, inStart, play, outStart, back };
  });
  return { parts, end: c, dur: c + TL.endLen };
})();
export const T_FPS = TL.fps;
export const T_DUR = PLAN.dur;

// camera: the map at zoom 1, a part at zoom 1/NS (it then fills the frame exactly)
const MAP = { x: 540, y: 960, z: 1 };
// The node stays pinned under the camera the whole way: its SCREEN position glides from where it sits on the map
// to the centre while the zoom grows, and the camera centre is solved from that. (Gliding the camera centre
// itself swung the shot across the map: one zoom crossed the logo at 3x.)
const camAt = (f) => {
  for (const p of PLAN.parts) {
    let t = null;
    if (f >= p.inStart && f < p.play) t = (f - p.inStart) / TL.zoomIn;
    else if (f >= p.play && f < p.outStart) t = 1;
    else if (f >= p.outStart && f < p.back) t = 1 - (f - p.outStart) / TL.zoomOut;
    if (t === null) continue;
    const e = glide(Math.min(1, Math.max(0, t)));
    const z = Math.exp(Math.log(1 / NS) * e);
    const sx = (p.x - MAP.x) * (1 - e), sy = (p.y - MAP.y) * (1 - e);      // node's offset from screen centre
    return { x: p.x - sx / z, y: p.y - sy / z, z };
  }
  return MAP;
};

const Node = ({ p, i, lang, cam }) => {
  const f = useCurrentFrame();
  const Scene = SCENES[p.id];
  const local = f < p.play ? p.o : f < p.outStart ? p.o + (f - p.play) : p.o + p.clip - 1;
  const pop = spring({ frame: f - TL.mapNodes[i], fps: TL.fps, config: { damping: 12, mass: 0.6, stiffness: 170 } });
  // how far this node fills the screen (0 on the map, 1 when it IS the frame): corners, ring and label fade with it
  const fill = Math.max(0, Math.min(1, (Math.log(cam.z) / Math.log(1 / NS)))) * (Math.hypot(cam.x - p.x, cam.y - p.y) < 400 ? 1 : 0);
  const ring = interpolate(f, [p.outline, p.outline + 8], [0, 1], cl) * interpolate(f, [p.back, p.back + 10], [1, 0.35], cl);
  const visited = f >= p.back;
  return (
    <div style={{ position: 'absolute', left: p.x - NW / 2, top: p.y - NH / 2, width: NW, height: NH, transform: `scale(${pop})`, opacity: Math.min(1, pop * 1.5) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22 * (1 - fill), overflow: 'hidden', background: BG,
        boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 0 ${1.5 * (1 - fill)}px rgba(255,255,255,0.12)` }}>
        <div style={{ width: 1080, height: 1920, transform: `scale(${NS})`, transformOrigin: '0 0' }}>
          <Freeze frame={local}><Scene lang={lang} audio={false} entered /></Freeze>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: (1 - fill) * (visited ? 0.15 : 0.35) }} />
      </div>
      {ring > 0 && <div style={{ position: 'absolute', inset: -7, borderRadius: 28, border: `4px solid ${RED}`, opacity: ring * (1 - fill),
        boxShadow: `0 0 ${30 * ring}px rgba(220,38,38,0.7)` }} />}
      <div style={{ position: 'absolute', top: NH + 14, left: -40, right: -40, textAlign: 'center', fontFamily: FONT, color: '#fff', opacity: (1 - fill) ** 4 }}>
        <span style={{ color: RED, fontWeight: 700, fontSize: 22, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>
        <span style={{ fontWeight: 700, fontSize: 30, letterSpacing: -0.5 }}>{p.label[lang]}</span>
      </div>
    </div>
  );
};

const Lines = () => {
  const f = useCurrentFrame();
  const { x: hx, y: hy } = TL.hub;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {PLAN.parts.map((p, i) => {
        const d = interpolate(f, [TL.mapLines + i * 4, TL.mapLines + i * 4 + 14], [0, 1], { ...cl, easing: glide });
        const lit = f >= p.outline ? 1 : 0;
        const midY = (hy + p.y) / 2;
        return <path key={p.id} d={`M ${hx} ${hy} C ${hx} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`} fill="none"
          stroke={lit ? RED : 'rgba(255,255,255,0.28)'} strokeWidth={lit ? 4 : 2.5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - d}
          style={lit ? { filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.8))' } : null} />;
      })}
    </svg>
  );
};

export const Tour = ({ lang = 'ms', audio = true }) => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  // the logo: alone and big first, then it shrinks into the hub of the map
  const lg = spring({ frame: f - TL.logo, fps: TL.fps, config: { damping: 12, mass: 0.8, stiffness: 140 } });
  const toHub = interpolate(f, [TL.mapLines - 12, TL.mapLines + 8], [0, 1], { ...cl, easing: glide });
  const endP = interpolate(f, [PLAN.end, PLAN.end + 16], [0, 1], { ...cl, easing: glide });
  const logoW = 640 - 330 * toHub + 90 * endP;
  const logoY = 960 + (TL.hub.y - 960) * toHub;
  const ending = f >= PLAN.end;
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(760px 620px at ${540 + Math.sin(f / 70) * 120}px 900px, rgba(220,38,38,0.2), transparent 70%)` }} />
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(540px, 960px) scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)` }}>
        {f >= TL.mapLines && <Lines />}
        <Img src={staticFile('drevo-logo.svg')} style={{ position: 'absolute', left: 540 - logoW / 2, top: logoY - (logoW * 120 / 688) / 2, width: logoW,
          transform: `scale(${0.5 + 0.5 * lg})`, opacity: Math.min(1, lg * 2), filter: `drop-shadow(0 0 ${30 * lg}px rgba(244,0,0,0.5))` }} />
        {PLAN.parts.map((p, i) => f >= TL.mapNodes[i] && <Node key={p.id} p={p} i={i} lang={lang} cam={cam} />)}
        {!ending && <Caption lines={lang === 'ms' ? ['Satu app,', '*semua kerja jualan.*'] : ['One app,', '*your whole sales job.*']} at={TL.mapLines} />}
      </AbsoluteFill>
      {ending && <Caption lines={lang === 'ms' ? ['Cuba Premium', '*7 hari percuma.*'] : ['Try Premium', '*free for 7 days.*']} at={PLAN.end + 8} />}
      {ending && <div style={{ position: 'absolute', top: 1400, left: 0, right: 0, textAlign: 'center', color: '#fff', fontFamily: FONT, fontSize: 46,
        fontWeight: 700, opacity: interpolate(f, [PLAN.end + 24, PLAN.end + 34], [0, 1], cl) }}>drevo.my</div>}
      {audio && <Audio src={staticFile(`audio/tour-${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
