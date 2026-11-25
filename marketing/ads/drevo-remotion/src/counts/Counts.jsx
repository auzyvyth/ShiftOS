// Counts: Drevo's take on the owner's reference (a "price counted, not guessed" scene).
// Motion copied from the reference (see .reanimate/counts/spec.md), content and colours ours.
// Every event sits on the beat grid in timeline.json; make-audio-counts.py reads the same file.
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, spring, Easing } from 'remotion';
import { WHITE, RED, INK, FONT } from '../ui';
import TL from './timeline.json';

export const N_FPS = TL.fps;
export const N_DUR = TL.dur;
const MONO = 'ui-monospace, "DejaVu Sans Mono", Menlo, monospace';
const LINE = 'rgba(11,12,15,0.12)';
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
const sp = (f, at, cfg = { damping: 14, mass: 0.6, stiffness: 170 }) => spring({ frame: f - at, fps: N_FPS, config: cfg });

// ---------- sample numbers (labelled "Contoh data" on screen) ----------
const VISITS = 1284, VIEWS = 3410, TAPS = 212;
const RATE = Math.round((TAPS / VIEWS) * 1000) / 10;           // 6.2, the app's "tap-through"
const fmt = (n) => Math.round(n).toLocaleString('de-DE');      // 3.410, Malaysian ads read either way
const fmt1 = (n) => n.toFixed(1).replace('.', ',');

// ---------- the reference's cut: black staircase blocks sweep across, cover, then uncover ----------
const BlockWipe = ({ at }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 24) return null;
  const rows = 10;
  return (
    <AbsoluteFill style={{ zIndex: 90, pointerEvents: 'none' }}>
      {Array.from({ length: rows }, (_, i) => {
        const d = (rows - 1 - i) * 0.5;                    // bottom rows lead: a staircase
        const cover = interpolate(f, [d, d + 6], [0, 1], { ...cl, easing: outExpo });
        const leave = interpolate(f, [d + 12, d + 18], [0, 1], { ...cl, easing: Easing.in(Easing.cubic) });
        return (
          <div key={i} style={{ position: 'absolute', top: (i * 1920) / rows - 1, height: 1920 / rows + 2,
            left: `${leave * 100}%`, width: `${(cover - leave) * 100}%`, background: INK }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- HUD: corner brackets, tiny mono labels, timecode, progress line ----------
const Hud = ({ dark, label }) => {
  const f = useCurrentFrame();
  const c = dark ? 'rgba(255,255,255,0.55)' : 'rgba(11,12,15,0.45)';
  const br = (s) => <div style={{ position: 'absolute', width: 34, height: 34, borderColor: c, borderStyle: 'solid', borderWidth: 0, ...s }} />;
  const tc = `00:00:${String(Math.floor(f / 30)).padStart(2, '0')}:${String(f % 30).padStart(2, '0')}`;
  const txt = { position: 'absolute', fontFamily: MONO, fontSize: 19, letterSpacing: 3, color: c, textTransform: 'uppercase' };
  return (
    <AbsoluteFill style={{ zIndex: 60, pointerEvents: 'none' }}>
      {br({ left: 44, top: 150, borderLeftWidth: 2, borderTopWidth: 2 })}
      {br({ right: 44, top: 150, borderRightWidth: 2, borderTopWidth: 2 })}
      {br({ left: 44, bottom: 420, borderLeftWidth: 2, borderBottomWidth: 2 })}
      {br({ right: 44, bottom: 420, borderRightWidth: 2, borderBottomWidth: 2 })}
      <div style={{ ...txt, left: 92, top: 158 }}>Drevo / Analitik</div>
      <div style={{ ...txt, right: 92, top: 158 }}><span style={{ color: RED }}>●</span> {tc}</div>
      <div style={{ ...txt, left: 92, bottom: 428 }}>{label}</div>
      <div style={{ position: 'absolute', left: 300, right: 300, bottom: 438, height: 2, background: dark ? 'rgba(255,255,255,0.15)' : LINE }}>
        <div style={{ width: `${(f / N_DUR) * 100}%`, height: '100%', background: c }} />
      </div>
      <div style={{ ...txt, right: 92, bottom: 428 }}>Contoh data</div>
    </AbsoluteFill>
  );
};

// ---------- headline: words come in from a blur, line 2 red and leaning ----------
const Word = ({ at, children, red }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 12], [0, 1], { ...cl, easing: outExpo });
  return (
    <span style={{ display: 'inline-block', marginRight: 22, opacity: p, filter: `blur(${(1 - p) * 14}px)`,
      transform: `translateY(${(1 - p) * 26}px) ${red ? 'skewX(-9deg)' : ''}`, color: red ? RED : INK }}>{children}</span>
  );
};
const Headline = () => {
  const w = TL.words;
  return (
    <div style={{ position: 'absolute', top: 380, left: 60, right: 60, textAlign: 'center', fontFamily: FONT, fontWeight: 700, lineHeight: 1.05 }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: 'rgba(11,12,15,0.5)', marginBottom: 26,
        opacity: interpolate(useCurrentFrame(), [w[0], w[0] + 10], [0, 1], cl) }}>
        <span style={{ color: RED }}>●</span> SEMUA DIKIRA · SATU SKRIN
      </div>
      <div style={{ fontSize: 104, letterSpacing: -4 }}><Word at={w[0]}>Setiap</Word><Word at={w[1]}>klik,</Word></div>
      <div style={{ fontSize: 104, letterSpacing: -4 }}><Word at={w[2]} red>ada</Word><Word at={w[3]} red>angkanya.</Word></div>
    </div>
  );
};

// ---------- a chip: number scrambles before it settles, then the scan marker passes it ----------
const scramble = (target, f, seed) => {
  const s = fmt(target);
  return s.replace(/\d/g, (_, i) => String(Math.floor(Math.abs(Math.sin((f + 1) * 12.9898 + i * 78.233 + seed) * 43758.5453)) % 10));
};
const CHIP_W = 290, CHIP_H = 230, GAP = 40, ROW_Y = 840;
const chipX = (i) => 540 - (3 * CHIP_W + 2 * GAP) / 2 + i * (CHIP_W + GAP);
const Chip = ({ i, value, label, sub }) => {
  const f = useCurrentFrame();
  const at = TL.chips[i], scan = TL.scan[i];
  const p = interpolate(f, [at, at + 10], [0, 1], { ...cl, easing: outExpo });
  const settled = f >= at + 14;
  const sweep = interpolate(f, [scan, scan + 9], [0, 1], { ...cl, easing: Easing.inOut(Easing.cubic) });
  const on = f >= scan;
  const kick = on ? 1 + 0.05 * Math.exp(-(f - scan) / 3) : 1;
  return (
    <div style={{ position: 'absolute', left: chipX(i), top: ROW_Y, width: CHIP_W, height: CHIP_H, opacity: p,
      transform: `translateY(${(1 - p) * 40}px) scale(${kick})`, filter: `blur(${(1 - p) * 10}px)`,
      background: WHITE, borderRadius: 26, border: `2px solid ${on ? INK : LINE}`, overflow: 'hidden',
      boxShadow: '0 18px 40px rgba(11,12,15,0.08)', fontFamily: FONT, padding: '22px 24px', boxSizing: 'border-box' }}>
      {/* the scan marker: a red bar sweeps the chip, leaves a red edge behind */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sweep * 100}%`, width: 14, marginLeft: -14,
        background: RED, opacity: sweep > 0 && sweep < 1 ? 0.9 : 0 }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: on && sweep >= 1 ? 8 : 0, background: RED }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 17, letterSpacing: 2, color: 'rgba(11,12,15,0.5)' }}>
        <span>{label}</span><span>0{i + 1}</span>
      </div>
      <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -3, color: INK, marginTop: 34, fontVariantNumeric: 'tabular-nums',
        opacity: settled ? 1 : 0.55 }}>{settled ? fmt(value) : scramble(value, f, i)}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: 'rgba(11,12,15,0.55)', marginTop: 4 }}>{sub}</div>
    </div>
  );
};

// ---------- curves from every chip down to one point, then the pill that counts ----------
const PILL_Y = 1190;
const Curves = () => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {[0, 1, 2].map((i) => {
        const x = chipX(i) + CHIP_W / 2, y0 = ROW_Y + CHIP_H + 8;
        const d = `M ${x} ${y0} C ${x} ${y0 + 90}, 540 ${PILL_Y - 120}, 540 ${PILL_Y - 4}`;
        const p = interpolate(f, [TL.lines + i, TL.lines + i + 10], [0, 1], { ...cl, easing: outExpo });
        return <path key={i} d={d} fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={2.5} pathLength={1}
          strokeDasharray="1 1" strokeDashoffset={1 - p} />;
      })}
      <circle cx={540} cy={PILL_Y - 4} r={7 * interpolate(f, [TL.pill - 2, TL.pill + 2], [0, 1], cl)} fill={RED} />
    </svg>
  );
};
const Pill = () => {
  const f = useCurrentFrame();
  const g = sp(f, TL.pill, { damping: 13, mass: 0.7, stiffness: 150 });
  const w = interpolate(g, [0, 1], [90, 760]);
  const t = interpolate(f, [TL.pill + 4, TL.countEnd], [0, 1], { ...cl, easing: Easing.bezier(0.05, 0.7, 0.1, 1) });
  const v = RATE * t;
  const ghost = f < TL.countEnd ? 0.35 : 0;                       // the reference's smeared digits while counting
  const land = f >= TL.countEnd ? 1 + 0.06 * Math.exp(-(f - TL.countEnd) / 4) : 1;
  if (f < TL.pill) return null;
  return (
    <div style={{ position: 'absolute', top: PILL_Y, left: 540 - w / 2, width: w, height: 150, borderRadius: 75, background: INK,
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', boxSizing: 'border-box',
      boxShadow: '0 24px 60px rgba(11,12,15,0.28)', fontFamily: FONT }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 3, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)', opacity: g, whiteSpace: 'nowrap' }}>
        KADAR<br />TEKAN
      </div>
      <div style={{ position: 'relative', fontSize: 92, fontWeight: 700, letterSpacing: -3, color: '#ef4444', opacity: g,
        transform: `scale(${land})`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        textShadow: ghost ? `0 -14px 0 rgba(239,68,68,${ghost}), 0 14px 0 rgba(239,68,68,${ghost * 0.6})` : 'none' }}>
        {fmt1(v)}%
      </div>
    </div>
  );
};
const Formula = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [TL.countEnd, TL.countEnd + 8], [0, 1], cl);
  return (
    <div style={{ position: 'absolute', top: PILL_Y + 180, left: 0, right: 0, textAlign: 'center', opacity: p,
      transform: `translateY(${(1 - p) * 14}px)`, fontFamily: MONO, fontSize: 24, letterSpacing: 1, color: 'rgba(11,12,15,0.6)' }}>
      {fmt(TAPS)} tekan WhatsApp ÷ {fmt(VIEWS)} lihat kereta
    </div>
  );
};
const Arrows = () => {
  const f = useCurrentFrame();
  return [0, 1].map((i) => {
    const p = interpolate(f, [TL.chips[i + 1], TL.chips[i + 1] + 8], [0, 1], cl);
    return <div key={i} style={{ position: 'absolute', top: ROW_Y + CHIP_H / 2 - 22, left: chipX(i) + CHIP_W + GAP / 2 - 13, opacity: p,
      fontFamily: FONT, fontSize: 34, fontWeight: 700, color: RED }}>›</div>;
  });
};

// ---------- odometer: each digit is a rolling column, blurred by its own speed ----------
const DIG_H = 1.0; // in em
const Odo = ({ from, to, at, len = 13, decimals = 0, suffix = '', color }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [at, at + len], [0, 1], { ...cl, easing: outExpo });
  const scale = 10 ** decimals;
  const v = (from + (to - from) * t) * scale;
  const vPrev = (from + (to - from) * interpolate(f - 1, [at, at + len], [0, 1], { ...cl, easing: outExpo })) * scale;
  const digits = String(Math.round(to * scale)).length;
  const cols = [];
  for (let p = digits - 1; p >= 0; p--) {
    const q = 10 ** p;
    const pos = p === 0 ? v % 10 : (Math.floor(v / q) % 10) + Math.min(1, Math.max(0, (v % q) - (q - 1)));  // real odometer: a digit turns only on the carry
    const speed = p === 0 ? Math.abs(vPrev - v) : (Math.abs(vPrev - v) > q * 0.5 ? Math.abs(vPrev - v) / q : 0);
    cols.push(
      <span key={p} style={{ display: 'inline-block', height: `${DIG_H}em`, overflow: 'hidden', verticalAlign: 'top' }}>
        <span style={{ display: 'block', transform: `translateY(${-pos * DIG_H}em)`, filter: `blur(${Math.min(speed * 4, 14)}px)` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, k) => <span key={k} style={{ display: 'block', height: `${DIG_H}em` }}>{d}</span>)}
        </span>
      </span>
    );
    if (decimals && p === decimals) cols.push(<span key={`c${p}`}>,</span>);
    if (!decimals && p > 0 && p % 3 === 0) cols.push(<span key={`d${p}`}>.</span>);
  }
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', lineHeight: DIG_H, display: 'inline-flex' }}>{cols}{suffix}</span>;
};

const STATS = [
  { bg: WHITE, fg: INK, acc: RED, from: 2900, to: VIEWS, label: 'Lihat kereta · 30 hari' },
  { bg: INK, fg: WHITE, acc: '#ef4444', from: 150, to: TAPS, label: 'Tekan WhatsApp' },
  { bg: WHITE, fg: INK, acc: RED, from: 1.0, to: RATE, decimals: 1, suffix: '%', label: 'Kadar tekan' },
  { bg: RED, fg: WHITE, acc: WHITE, from: 20, to: 48, suffix: '%', label: 'Datang dari TikTok' },
];
const Stats = () => {
  const f = useCurrentFrame();
  let k = -1;
  TL.stats.forEach((s, i) => { if (f >= s) k = i; });
  if (k < 0 || f >= TL.logo) return null;
  const s = STATS[k], at = TL.stats[k];
  const punch = 1 + 0.035 * Math.exp(-(f - at) / 4);
  const lp = interpolate(f, [at + 4, at + 12], [0, 1], cl);
  return (
    <AbsoluteFill style={{ background: k === 0 || k === 2 ? '#F4F4F5' : s.bg }}>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 230, bottom: 500, borderRadius: 56, background: s.bg,
        border: s.bg === WHITE ? `2px solid ${LINE}` : 'none', transform: `scale(${punch})`,
        boxShadow: '0 30px 80px rgba(11,12,15,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ position: 'absolute', top: 44, left: 52, fontFamily: MONO, fontSize: 22, letterSpacing: 3, color: s.fg, opacity: 0.5 }}>0{k + 1} / 04</div>
        <div style={{ fontSize: 250, fontWeight: 700, letterSpacing: -12, color: s.fg }}>
          <Odo from={s.from} to={s.to} at={at} decimals={s.decimals || 0} suffix={s.suffix || ''} color={k === 1 ? s.acc : s.fg} />
        </div>
        <div style={{ marginTop: 34, fontFamily: MONO, fontSize: 28, letterSpacing: 8, textTransform: 'uppercase', color: s.fg, opacity: 0.7 * lp,
          transform: `translateY(${(1 - lp) * 12}px)` }}>{s.label}</div>
        <div style={{ marginTop: 40, width: 120 * lp, height: 6, borderRadius: 3, background: s.acc }} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- the close: logo lands on the downbeat, a ring of dots bursts, tagline on beats ----------
const Close = () => {
  const f = useCurrentFrame();
  if (f < TL.logo) return null;
  const g = sp(f, TL.logo, { damping: 11, mass: 0.8, stiffness: 160 });
  const ring = interpolate(f, [TL.logo, TL.logo + 20], [0, 1], { ...cl, easing: outExpo });
  const tw = TL.tagline;
  return (
    <AbsoluteFill style={{ background: WHITE, fontFamily: FONT }}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2, r = 120 + ring * 300;
        return <div key={i} style={{ position: 'absolute', left: 540 + Math.cos(a) * r - 9, top: 760 + Math.sin(a) * r - 9, width: 18, height: 18,
          borderRadius: 9, background: i % 3 ? INK : RED, opacity: 1 - ring }} />;
      })}
      <Img src={staticFile('drevo-logo.svg')} style={{ position: 'absolute', left: 540 - 300, top: 760 - 52, width: 600,
        transform: `scale(${0.4 + 0.6 * g})`, opacity: Math.min(1, g * 2) }} />
      <div style={{ position: 'absolute', top: 920, left: 60, right: 60, textAlign: 'center', fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1.1 }}>
        <div><Word at={tw[0]}>Berhenti</Word><Word at={tw[1]}>meneka.</Word></div>
        <div style={{ fontSize: 40, fontWeight: 500, letterSpacing: 0, color: 'rgba(11,12,15,0.6)', marginTop: 30,
          opacity: interpolate(f, [tw[2], tw[2] + 10], [0, 1], cl) }}>Pelawat, klik, kadar tekan. Satu skrin.</div>
      </div>
    </AbsoluteFill>
  );
};

export const Counts = ({ audio = true }) => {
  const f = useCurrentFrame();
  const inStats = f >= TL.stats[0] && f < TL.logo;
  const k = TL.stats.filter((s) => f >= s).length - 1;
  const dark = inStats && (k === 1 || k === 3);
  return (
    <AbsoluteFill style={{ background: WHITE, overflow: 'hidden' }}>
      {f < TL.stats[0] && (
        <AbsoluteFill style={{ background: 'radial-gradient(1200px 900px at 540px 800px, #FFFFFF, #F2F2F4)' }}>
          <Headline />
          <Arrows />
          <Chip i={0} value={VISITS} label="PELAWAT" sub="buka page anda" />
          <Chip i={1} value={VIEWS} label="LIHAT" sub="buka kereta" />
          <Chip i={2} value={TAPS} label="WHATSAPP" sub="tekan butang" />
          <Curves />
          <Pill />
          <Formula />
        </AbsoluteFill>
      )}
      <Stats />
      <Close />
      <Hud dark={dark} label={f < TL.stats[0] ? '01 · Formula' : f < TL.logo ? '02 · Angka' : '03 · Drevo'} />
      <BlockWipe at={TL.wipeIn - 11} />
      <BlockWipe at={TL.wipeStats} />
      <BlockWipe at={TL.wipeEnd} />
      {audio && <Audio src={staticFile('audio/counts.wav')} />}
    </AbsoluteFill>
  );
};
