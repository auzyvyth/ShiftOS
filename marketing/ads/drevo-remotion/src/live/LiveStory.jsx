// The Live ad, story cut (briefs/live-newcar.md, "Story cut"). Look taken from the owner's reference
// reel (2026-11-10): paper, black and ONE red; a big serif word per beat; one object per frame; small
// mono labels. The app is still the REAL Live presenter, shown WHOLE at DESKTOP size on a monitor (owner,
// 2026-11-10: "make it the desktop version"): public/real/desk-*.png + desk-rects.json from harness/live-desk.cjs.
import React from 'react';
import { AbsoluteFill, Sequence, Img, Audio, staticFile, useCurrentFrame, interpolate, delayRender, continueRender } from 'remotion';
import { FPS, sec, pop, clamp, ease } from '../lib';
import { FONT, RED, INK } from '../ui';
import DESK from './desk-rects.json';
import TIMING from './story.json';

export const S_TL = TIMING.scenes;
export const S_DUR = TIMING.dur;

const fh = typeof window !== 'undefined' ? delayRender('story-fonts') : null;
if (typeof window !== 'undefined') {
  const faces = [
    new FontFace('Playfair', `url(${staticFile('fonts/playfair-display-latin-900-italic.woff')})`, { weight: '900', style: 'italic' }),
    new FontFace('Playfair', `url(${staticFile('fonts/playfair-display-latin-800-normal.woff')})`, { weight: '800' }),
    new FontFace('DM Mono', `url(${staticFile('fonts/dm-mono-latin-500-normal.woff')})`, { weight: '500' }),
  ];
  Promise.all(faces.map((f) => f.load().then((l) => document.fonts.add(l)))).then(() => continueRender(fh), () => continueRender(fh));
}
const SERIF = 'Playfair, Georgia, serif';
const MONO = '"DM Mono", ui-monospace, monospace';
const PAPER = '#F3EDE2';
const NIGHT = '#0E0C0B';

const COPY = {
  ms: {
    live: { word: 'Live', a: 'setiap malam,', b: 'soalan sama', chips: ['bulanan berapa?', 'deposit 0 boleh?', 'gaji 3k lepas tak?'] },
    excel: { pre: 'Excel cuma', a: 'BAGI NOMBOR', b: 'ITU SAJA' },
    lead: { word: 'Drevo', a: 'BAGI LEAD', note: 'link di bio  ›  page anda  ›  WhatsApp' },
    free: { pre: 'kalkulator live', word: 'Percuma.', tag: 'tiada kad kredit' },
    rebate: { pre: 'rebat, insurans, NCD', word: 'Satu tap.' },
    viewer: { pre: 'gaji RM3,000', word: 'Dapat apa?', tag: 'Premium · 7 hari percuma' },
    cta: { a: 'Kalkulator live.', b: 'Page sendiri. Senarai lead.', word: 'Percuma.', fine: 'Premium: 7 hari percuma, kemudian RM35 sebulan.' },
    fine: 'Contoh data. Anggaran sahaja, bank yang tentukan.', now: 'sekarang',
  },
  en: {
    live: { word: 'Live', a: 'every night,', b: 'same questions', chips: ['how much a month?', 'zero deposit ok?', 'RM3k pay, can I?'] },
    excel: { pre: 'Excel only', a: 'GIVES A NUMBER', b: "THAT'S ALL" },
    lead: { word: 'Drevo', a: 'GIVES THE LEAD', note: 'link in bio  ›  your page  ›  WhatsApp' },
    free: { pre: 'live calculator', word: 'Free.', tag: 'no credit card' },
    rebate: { pre: 'rebate, insurance, NCD', word: 'One tap.' },
    viewer: { pre: 'pay RM3,000', word: 'Which car?', tag: 'Premium · 7 days free' },
    cta: { a: 'Live calculator.', b: 'Your own page. Lead list.', word: 'Free.', fine: 'Premium: 7 days free, then RM35 a month.' },
    fine: 'Sample data. Estimates only, the bank decides.', now: 'now',
  },
};
// The push as the DB writes it (20261005c_enquiry_notify_resolver.sql; English in both cuts).
const PUSH = { title: 'New Enquiry', body: 'Aiman enquired about a listing' };

// ---------- surface ----------
const Grain = ({ dark }) => (
  <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, opacity: dark ? 0.16 : 0.22, mixBlendMode: dark ? 'screen' : 'multiply' }}>
    <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" /><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.55 0" /></filter>
    <rect width="1080" height="1920" filter="url(#g)" />
  </svg>
);
const Paper = ({ dark, children }) => (
  <AbsoluteFill style={{ background: dark ? NIGHT : PAPER, overflow: 'hidden' }}>
    <AbsoluteFill style={{ background: dark ? 'radial-gradient(90% 60% at 60% 40%, rgba(255,255,255,0.07), transparent 70%)' : 'radial-gradient(100% 70% at 50% 40%, rgba(255,255,255,0.75), rgba(160,140,110,0.16) 100%)' }} />
    {children}
    <Grain dark={dark} />
  </AbsoluteFill>
);
const Dots = ({ x, y, cols = 9, rows = 6, gap = 44, c = 'rgba(14,12,11,0.28)' }) => (
  <svg style={{ position: 'absolute', left: x, top: y }} width={cols * gap} height={rows * gap}>
    {Array.from({ length: cols * rows }, (_, i) => <circle key={i} cx={(i % cols) * gap + 6} cy={Math.floor(i / cols) * gap + 6} r="2.6" fill={c} />)}
  </svg>
);
const Barcode = ({ x, y, c = INK }) => (
  <div style={{ position: 'absolute', left: x, top: y, display: 'flex', gap: 4, height: 54, opacity: 0.8 }}>
    {[5, 2, 7, 2, 3, 6, 2, 4, 2, 8, 3, 2, 5, 2, 6, 3].map((w, i) => <span key={i} style={{ width: w, background: c }} />)}
  </div>
);
const In = ({ at = 0, y = 60, style, children }) => {
  const f = useCurrentFrame(); const p = pop(f, at);
  return <div style={{ position: 'absolute', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};
const Label = ({ children, red, dark }) => (
  <span style={{ display: 'inline-block', font: `500 34px ${MONO}`, letterSpacing: 1, padding: red ? '6px 16px' : 0, borderRadius: 6,
    background: red ? RED : 'transparent', color: red ? '#fff' : dark ? 'rgba(255,255,255,0.8)' : 'rgba(14,12,11,0.75)' }}>{children}</span>
);
const Fine = ({ text, dark, top = 1392 }) => (
  <div style={{ position: 'absolute', left: 70, right: 200, top, font: `500 22px ${MONO}`, color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(14,12,11,0.55)' }}>{text}</div>
);
// Slow drift for the frame's one object (the reference never holds a still frame).
const Drift = ({ children, from = 1.04, to = 1, style }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 110], [from, to], clamp);
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: '50% 60%', ...style }}>{children}</div>;
};

// ---------- the app ----------
// The WHOLE presenter stage at desktop size (864x768 capture at 2x) on a monitor.
const SW = 864, SH = 768;
const Monitor = ({ view, lang, x, y, w, children }) => {
  const k = w / SW;
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{ padding: 10, borderRadius: 26, background: 'linear-gradient(160deg,#26231f,#0b0a09)', boxShadow: '0 70px 120px rgba(14,12,11,0.34), 0 16px 34px rgba(14,12,11,0.22)' }}>
        <div style={{ position: 'relative', width: w, height: SH * k, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
          <Img src={staticFile(`real/desk-${view}-${lang}.png`)} style={{ width: w, height: SH * k }} />
          {children?.(k)}
        </div>
      </div>
      <div style={{ margin: '0 auto', width: 150, height: 54, background: 'linear-gradient(180deg,#0b0a09,#26231f)' }} />
      <div style={{ margin: '0 auto', width: 430, height: 20, borderRadius: 10, background: '#16130f', boxShadow: '0 26px 40px rgba(14,12,11,0.3)' }} />
    </div>
  );
};
const Ring = ({ r, k, at, pad = 4 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f / FPS, [at, at + 0.35], [0, 1], { ...clamp, easing: ease });
  if (!r || p <= 0) return null;
  return <div style={{ position: 'absolute', left: (r.x - pad) * k, top: (r.y - pad) * k, width: (r.w + pad * 2) * k, height: (r.h + pad * 2) * k, borderRadius: 10 * k, border: `6px solid ${RED}`, opacity: p, transform: `scale(${1.15 - 0.15 * p})`, boxShadow: '0 0 34px rgba(220,38,38,.4)' }} />;
};
const Tap = ({ r, k, at }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const move = interpolate(t, [at - 0.8, at - 0.05], [0, 1], { ...clamp, easing: ease });
  const x = (r.x + r.w / 2) * k, y = (r.y + r.h / 2) * k;
  const since = t - at; const ring = since > 0 && since < 0.5 ? since / 0.5 : null;
  return (
    <>
      {ring !== null && <div style={{ position: 'absolute', left: x - 50, top: y - 50, width: 100, height: 100, borderRadius: 50, border: `5px solid ${RED}`, opacity: 1 - ring, transform: `scale(${0.3 + ring * 1.1})` }} />}
      <svg width="64" height="64" viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 8 + (1 - move) * 220, top: y - 5 + (1 - move) * 300, transform: `scale(${since > 0 && since < 0.12 ? 0.82 : 1})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.5))' }}>
        <path d="M4 2l15 11-7 1-3 7z" fill="#0B0C0F" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
};
const Push = ({ lang, style }) => (
  <div style={{ width: 760, background: '#fff', borderRadius: 34, padding: '26px 30px', display: 'flex', gap: 22, alignItems: 'flex-start', boxShadow: '0 40px 80px rgba(14,12,11,0.35)', ...style }}>
    <div style={{ flexShrink: 0, width: 80, height: 80, borderRadius: 20, background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 48px ${FONT}` }}>D</div>
    <div style={{ flex: 1, fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 24px ${FONT}`, color: 'rgba(14,12,11,0.5)' }}><span>Drevo</span><span>{COPY[lang].now}</span></div>
      <div style={{ font: `700 42px/1.15 ${FONT}`, color: INK, marginTop: 4 }}>{PUSH.title}</div>
      <div style={{ font: `500 30px/1.3 ${FONT}`, color: 'rgba(14,12,11,0.7)', marginTop: 6 }}>{PUSH.body}</div>
    </div>
  </div>
);

// ---------- beats ----------
// 1. The seller's night: a ring light, and the same three comments.
const Live = ({ lang }) => {
  const C = COPY[lang].live;
  const f = useCurrentFrame();
  const spots = [[430, 760, -5], [120, 980, 4], [380, 1190, -3]];
  return (
    <Paper>
      <Barcode x={70} y={236} />
      <Dots x={560} y={250} />
      <Drift>
        {/* the ring light and the phone on its stand: the object of this frame, drawn */}
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          <g transform="translate(700 980)">
            <circle r="270" fill="none" stroke={INK} strokeWidth="46" />
            <circle r="270" fill="none" stroke="#fff" strokeWidth="22" opacity="0.9" />
            <rect x="-62" y="-118" width="124" height="236" rx="22" fill={INK} />
            <rect x="-50" y="-104" width="100" height="208" rx="12" fill={RED} />
            <rect x="-9" y="270" width="18" height="520" fill={INK} />
            <path d="M0 720 L-190 900 M0 720 L190 900" stroke={INK} strokeWidth="18" strokeLinecap="round" />
          </g>
        </svg>
      </Drift>
      <In at={0.02} y={40} style={{ left: 64, top: 300, font: `italic 900 330px/0.9 ${SERIF}`, color: INK, letterSpacing: -10 }}>{C.word}</In>
      <In at={0.35} y={30} style={{ left: 78, top: 630, display: 'flex', gap: 18, alignItems: 'center' }}><Label>{C.a}</Label><Label red>{C.b}</Label></In>
      {C.chips.map((t, i) => {
        const p = pop(f, 0.7 + i * 0.28);
        return (
          <div key={t} style={{ position: 'absolute', left: spots[i][0], top: spots[i][1], opacity: Math.min(1, p * 1.5), transform: `rotate(${spots[i][2]}deg) translateY(${(1 - p) * 50}px)` }}>
            <div style={{ background: '#fff', border: `4px solid ${INK}`, borderRadius: 18, padding: '18px 26px', font: `500 40px ${MONO}`, color: INK, boxShadow: `10px 10px 0 ${INK}` }}>{t}</div>
          </div>
        );
      })}
    </Paper>
  );
};
// 2. Night frame: a sheet of cells, one number in it, nothing else.
const Excel = ({ lang }) => {
  const C = COPY[lang].excel;
  const f = useCurrentFrame();
  const cell = pop(f, 0.5);
  return (
    <Paper dark>
      <Drift from={1.08}>
        <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={i * 150 - 30} y1="0" x2={i * 150 - 30} y2="1920" stroke="rgba(255,255,255,0.13)" strokeWidth="2" />)}
          {Array.from({ length: 26 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 78 + 20} x2="1080" y2={i * 78 + 20} stroke="rgba(255,255,255,0.13)" strokeWidth="2" />)}
        </svg>
      </Drift>
      <In at={0.02} y={20} style={{ left: 120, top: 268, font: `500 34px ${MONO}`, color: 'rgba(255,255,255,0.75)' }}>{C.pre}</In>
      {/* one block, so a line that wraps pushes the red line down and never sits on it */}
      <div style={{ position: 'absolute', left: 120, right: 70, top: 870, font: `800 ${C.a.length > 12 ? 82 : 96}px/1.12 ${SERIF}`, letterSpacing: C.a.length > 12 ? 9 : 14 }}>
        <div style={{ color: '#fff', opacity: Math.min(1, pop(f, 0.15) * 1.5), whiteSpace: 'nowrap' }}>{C.a}</div>
        <div style={{ color: RED, marginTop: 14, opacity: Math.min(1, pop(f, 0.95) * 1.5), whiteSpace: 'nowrap' }}>{C.b}</div>
      </div>
      {/* the lone cell */}
      <div style={{ position: 'absolute', left: 120, top: 560, width: 380, height: 190, border: `6px solid ${RED}`, background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: `500 110px ${MONO}`, color: '#fff', opacity: Math.min(1, cell * 1.5), transform: `scale(${0.9 + 0.1 * Math.min(1, cell)})` }}>480</div>
    </Paper>
  );
};
// 3. The red beam lands on what a sheet never gives: the buyer.
const Lead = ({ lang }) => {
  const C = COPY[lang].lead;
  const f = useCurrentFrame();
  const beam = interpolate(f / FPS, [0.05, 0.6], [0, 1], { ...clamp, easing: ease });
  const card = pop(f, 0.75);
  return (
    <Paper>
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
        <path d={`M1080 ${420 + (1 - beam) * 400} L1080 ${860 + (1 - beam) * 300} L${330 + (1 - beam) * 500} 1390 L${150 + (1 - beam) * 600} 1000 Z`} fill={RED} opacity={beam} />
        <circle cx="330" cy="1140" r={250 * beam} fill={RED} />
      </svg>
      <In at={0.1} y={40} style={{ left: 64, top: 290, font: `italic 900 270px/0.9 ${SERIF}`, color: INK, letterSpacing: -8 }}>{C.word}</In>
      <In at={0.4} y={30} style={{ left: 76, top: 585, whiteSpace: 'nowrap', font: `800 ${C.a.length > 10 ? 70 : 86}px/1 ${SERIF}`, letterSpacing: C.a.length > 10 ? 8 : 12, color: INK }}>{C.a}</In>
      <div style={{ position: 'absolute', left: 70, top: 1020, opacity: Math.min(1, card * 1.5), transform: `rotate(-4deg) translateY(${(1 - card) * 80}px)` }}><Push lang={lang} /></div>
      <In at={1.2} y={20} style={{ left: 76, top: 710, width: 520, font: `500 30px/1.5 ${MONO}`, color: 'rgba(14,12,11,0.7)' }}>{C.note}</In>
      <Fine text={lang === 'ms' ? 'Contoh data. Notifikasi sebenar Drevo.' : 'Sample data. Real Drevo notification.'} top={1420} />
    </Paper>
  );
};
// 4-6. The whole presenter on a monitor. Each change on screen is a cut between two REAL captures.
const AppBeat = ({ lang, views, word, pre, tag, children }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const view = views.reduce((v, [at, name]) => (t >= at ? name : v), views[0][1]);
  return (
    <Paper>
      <Dots x={640} y={236} cols={9} rows={4} />
      <In at={0.02} y={20} style={{ left: 70, top: 232 }}><Label>{pre}</Label></In>
      <In at={0.12} y={40} style={{ left: 64, top: 280, font: `italic 900 ${word.length > 9 ? 150 : 176}px/1 ${SERIF}`, color: RED, letterSpacing: -5 }}>{word}</In>
      {tag && <In at={1.0} y={20} style={{ left: 70, top: 478 }}><span style={{ display: 'inline-block', background: INK, color: '#fff', font: `500 30px ${MONO}`, padding: '10px 20px', borderRadius: 8 }}>{tag}</span></In>}
      <Drift from={1.025} style={{ transformOrigin: '50% 80%' }}>
        <Monitor view={view} lang={lang} x={40} y={570} w={980}>{children}</Monitor>
      </Drift>
      <div style={{ position: 'absolute', left: 600, right: 50, top: 484, textAlign: 'right', font: `500 21px/1.4 ${MONO}`, color: 'rgba(14,12,11,0.6)' }}>{COPY[lang].fine}</div>
    </Paper>
  );
};
const Free = ({ lang }) => {
  const C = COPY[lang].free; const R = DESK[`free9-${lang}`];
  return (
    <AppBeat lang={lang} views={[[0, 'free'], [1.5, 'free9']]} pre={C.pre} word={C.word} tag={C.tag}>
      {(k) => <Tap r={R.ten9} k={k} at={1.5} />}
    </AppBeat>
  );
};
const Rebate = ({ lang }) => {
  const C = COPY[lang].rebate; const R = DESK[`rebate-${lang}`];
  const pill = { x: R.ncd.x + R.ncd.w * 0.725, y: R.ncd.y + 2, w: R.ncd.w * 0.125, h: R.ncd.h - 4 };
  return (
    <AppBeat lang={lang} views={[[0, 'free9'], [1.0, 'rebate1'], [2.0, 'rebate']]} pre={C.pre} word={C.word}>
      {(k) => (<><Ring r={R.reb} k={k} at={1.0} pad={2} /><Ring r={pill} k={k} at={2.0} pad={1} /></>)}
    </AppBeat>
  );
};
const Viewer = ({ lang }) => {
  const C = COPY[lang].viewer;
  return <AppBeat lang={lang} views={[[0, 'viewer0'], [1.3, 'viewer']]} pre={C.pre} word={C.word} tag={C.tag} />;
};
// 7. End card: the road and the name.
const Cta = ({ lang }) => {
  const C = COPY[lang].cta;
  const f = useCurrentFrame();
  const road = interpolate(f / FPS, [0.05, 0.7], [0, 1], { ...clamp, easing: ease });
  return (
    <Paper>
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
        <path d={`M300 1920 L780 1920 L600 ${1920 - 560 * road} L480 ${1920 - 560 * road} Z`} fill={RED} />
        <path d={`M540 ${1250 - 20} L700 ${1400} L380 ${1400} Z`} fill={RED} opacity={road} />
      </svg>
      <Barcode x={70} y={236} />
      <In at={0.1} y={30} style={{ left: 0, right: 0, top: 380, display: 'flex', justifyContent: 'center' }}><Img src={staticFile('drevo-logo-dark.png')} style={{ width: 620, height: 108 }} /></In>
      <In at={0.45} y={30} style={{ left: 60, right: 60, top: 560, textAlign: 'center', font: `500 38px/1.5 ${MONO}`, color: INK }}>{C.a}<br />{C.b}</In>
      <In at={0.8} y={40} style={{ left: 0, right: 0, top: 700, textAlign: 'center', font: `italic 900 210px/1 ${SERIF}`, color: RED, letterSpacing: -6 }}>{C.word}</In>
      <In at={1.2} y={30} style={{ left: 0, right: 0, top: 990, display: 'flex', justifyContent: 'center' }}>
        <span style={{ background: INK, color: '#fff', font: `500 54px ${MONO}`, padding: '22px 46px', borderRadius: 14 }}>drevo.my</span>
      </In>
      <In at={1.5} y={20} style={{ left: 60, right: 60, top: 1130, textAlign: 'center', font: `500 26px ${MONO}`, color: 'rgba(14,12,11,0.65)' }}>{C.fine}</In>
    </Paper>
  );
};

const SCENES = { live: Live, excel: Excel, lead: Lead, free: Free, rebate: Rebate, viewer: Viewer, cta: Cta };
export const LiveStory = ({ lang = 'ms', audio = false }) => (
  <AbsoluteFill style={{ background: PAPER }}>
    {audio && <Audio src={staticFile(`audio/story-${lang}.wav`)} />}
    {S_TL.map(([k, at, len]) => { const S = SCENES[k]; return <Sequence key={k} from={sec(at)} durationInFrames={sec(len)}><S lang={lang} /></Sequence>; })}
  </AbsoluteFill>
);
