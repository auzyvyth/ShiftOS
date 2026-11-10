// The free Live calculator ad for new-car SAs (briefs/live-newcar.md, hook V3-A).
// App screens are the REAL Live presenter on a Proton line-up at official prices
// (harness/main.jsx?set=proton -> node harness/live.cjs -> public/real/live-*.png + rects.json).
// free / free9 / rebate are the FREE (Lite) presenter; viewer is Premium's Budget > Viewer.
import React from 'react';
import { AbsoluteFill, Sequence, Img, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { FPS, sec, pop, clamp, ease } from '../lib';
import { Ambient, Headline, Fine, Chip, glass, FONT, RED, RED2, INK, MUTED } from '../ui';
import { Card } from '../scenes/Card';
import { Cta } from '../scenes/Features';
import RECTS from './rects.json';
import TIMING from './timeline.json';

const CARD = TIMING.card;
export const L_TL = TIMING.scenes;
export const L_DUR = TIMING.dur;

const COPY = {
  ms: {
    hook: ['Excel bagi nombor.', '*Drevo bagi lead.*'],
    free: ['Kalkulator live.', '*Percuma.*'],
    rebate: ['Rebat, NCD.', '*Taip, siap.*'],
    lead: ['Link di bio.', '*Lead masuk sendiri.*'],
    viewer: ['Gaji RM3,000.', '*Dapat kereta apa?*'],
    cards: { rebate: ['Sekarang:', 'Rebat & NCD', '01'], lead: ['Sekarang:', 'Lead', '02'], viewer: ['Premium:', 'Ikut gaji', '03'] },
    pill: 'Percuma. Tiada kad kredit.', premium: 'Premium · cuba 7 hari percuma',
    steps: ['Link di bio', 'Page anda', 'WhatsApp'], now: 'sekarang',
    fine: 'Contoh data. Anggaran sahaja, bank yang tentukan.',
    fineLead: 'Contoh data. Notifikasi sebenar Drevo.',
    cta: { cta1: 'Kalkulator live:', cta2: 'percuma.', cta3: 'Page + senarai lead pun percuma. Premium: 7 hari percuma, kemudian RM35 sebulan.' },
  },
  en: {
    hook: ['Excel gives a number.', '*Drevo gives the lead.*'],
    free: ['Live calculator.', '*Free.*'],
    rebate: ['Rebate, NCD.', '*Type it. Done.*'],
    lead: ['Link in bio.', '*Leads come to you.*'],
    viewer: ['Pay RM3,000.', '*Which car fits?*'],
    cards: { rebate: ['Now:', 'Rebate & NCD', '01'], lead: ['Now:', 'Leads', '02'], viewer: ['Premium:', 'By salary', '03'] },
    pill: 'Free. No credit card.', premium: 'Premium · 7 days free',
    steps: ['Link in bio', 'Your page', 'WhatsApp'], now: 'now',
    fine: 'Sample data. Estimates only, the bank decides.',
    fineLead: 'Sample data. Real Drevo notification.',
    cta: { cta1: 'Live calculator:', cta2: 'free.', cta3: 'Your page + lead list are free too. Premium: 7 days free, then RM35 a month.' },
  },
};

// The push as the DB writes it (trigger in 20261005c_enquiry_notify_resolver.sql; English in both cuts).
const PUSH = { title: 'New Enquiry', body: 'Aiman enquired about a listing' };

// A crop of a real screenshot (CSS px of the 390x844 capture, taken at 3x), shown `width` px wide.
const Shot = ({ view, lang, crop, width, radius = 18, children }) => {
  const k = width / crop.w;
  return (
    <div style={{ position: 'relative', width, height: crop.h * k, borderRadius: radius * k, overflow: 'hidden', background: '#fff',
      boxShadow: '0 50px 110px rgba(11,12,15,0.30), 0 14px 30px rgba(11,12,15,0.18)' }}>
      <Img src={staticFile(`real/live-${view}-${lang}.png`)} style={{ position: 'absolute', width: 390 * k, height: 844 * k, left: -crop.x * k, top: -crop.y * k }} />
      {children?.(k)}
    </div>
  );
};
const Rise = ({ at = 0, top, children }) => {
  const f = useCurrentFrame();
  const p = pop(f, at);
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 90}px) scale(${0.94 + 0.06 * Math.min(1, p)})` }}>{children}</div>;
};
const Ring = ({ r, crop, k, at, pad = 5 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f / FPS, [at, at + 0.35], [0, 1], { ...clamp, easing: ease });
  return <div style={{ position: 'absolute', left: (r.x - crop.x - pad) * k, top: (r.y - crop.y - pad) * k, width: (r.w + pad * 2) * k, height: (r.h + pad * 2) * k,
    borderRadius: 12 * k, border: `5px solid ${RED}`, opacity: p, transform: `scale(${1.25 - 0.25 * p})`, boxShadow: '0 0 40px rgba(220,38,38,.45)' }} />;
};
const Tap = ({ r, crop, k, at }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const move = interpolate(t, [at - 0.7, at - 0.05], [0, 1], { ...clamp, easing: ease });
  const x = (r.x - crop.x + r.w / 2) * k, y = (r.y - crop.y + r.h / 2) * k;
  const since = t - at;
  const ring = since > 0 && since < 0.5 ? since / 0.5 : null;
  return (
    <>
      {ring !== null && <div style={{ position: 'absolute', left: x - 50, top: y - 50, width: 100, height: 100, borderRadius: 50, border: `5px solid ${RED}`, opacity: 1 - ring, transform: `scale(${0.3 + ring * 1.1})` }} />}
      <svg width="54" height="54" viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 8 + (1 - move) * 160, top: y - 5 + (1 - move) * 260, transform: `scale(${since > 0 && since < 0.12 ? 0.82 : 1})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.5))' }}>
        <path d="M4 2l15 11-7 1-3 7z" fill="#0B0C0F" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
};

// The notification card (the OS, drawn white), with the real push text.
const Push = ({ lang, at, top }) => {
  const f = useCurrentFrame();
  const drop = pop(f, at, FPS, { damping: 15, stiffness: 170 });
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top, opacity: Math.min(1, drop * 1.5), transform: `translateY(${(1 - drop) * -140}px) scale(${0.92 + 0.08 * Math.min(1, drop)})` }}>
      <div style={{ ...glass({ borderRadius: 40, padding: '30px 34px' }), display: 'flex', gap: 26, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: 88, height: 88, borderRadius: 22, background: 'linear-gradient(160deg,#ef4444,#dc2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 52px ${FONT}` }}>D</div>
        <div style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 26px ${FONT}`, color: MUTED }}><span>Drevo</span><span>{COPY[lang].now}</span></div>
          <div style={{ font: `700 46px/1.15 ${FONT}`, color: INK, marginTop: 6, letterSpacing: -1 }}>{PUSH.title}</div>
          <div style={{ font: `500 34px/1.3 ${FONT}`, color: 'rgba(11,12,15,0.72)', marginTop: 8 }}>{PUSH.body}</div>
        </div>
      </div>
    </div>
  );
};
const Pill = ({ at, top, children }) => {
  const f = useCurrentFrame(); const p = pop(f, at);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px)` }}>
      <Chip style={{ height: 76, padding: '0 34px', font: `700 32px ${FONT}`, background: INK, color: '#FFFFFF', border: 'none', boxShadow: '0 18px 40px rgba(80,0,0,.35)' }}><span style={{ width: 14, height: 14, borderRadius: 7, background: RED2 }} />{children}</Chip>
    </div>
  );
};

// ---------- scenes ----------
// 0-2.5 s: the number (the real free presenter) and what a sheet cannot give: the lead.
const Hook = ({ lang }) => {
  const C = COPY[lang];
  const crop = { x: 10, y: 63, w: 370, h: 205 };
  return (
    <>
      <Headline lines={C.hook} at={0.05} top={170} size={lang === 'ms' ? 96 : 88} />
      <Rise at={0.15} top={500}><Shot view="free" lang={lang} crop={crop} width={900} /></Rise>
      <Push lang={lang} at={1.0} top={1050} />
      <Fine text={C.fineLead} top={1380} />
    </>
  );
};
// 2.5-5 s: one continuous move, a tap on the 9-year tile; "free" lands here.
const Free = ({ lang }) => {
  const C = COPY[lang];
  const R = RECTS[`free9-${lang}`];
  const crop = { x: 10, y: 63, w: 370, h: 325 };
  const TAP = 0.9;                       // 7 years (591) until the tap, 9 years (480) after: two real captures
  const view = useCurrentFrame() / FPS < TAP ? 'free' : 'free9';
  return (
    <>
      <Headline lines={C.free} at={0.05} top={170} />
      <Rise at={0.1} top={440}>
        <Shot view={view} lang={lang} crop={crop} width={880}>{(k) => <Tap r={R.ten9} crop={crop} k={k} at={TAP} />}</Shot>
      </Rise>
      <Pill at={1.2} top={1280}>{C.pill}</Pill>
      <Fine text={C.fine} top={1390} />
    </>
  );
};
const Rebate = ({ lang }) => {
  const C = COPY[lang];
  const R = RECTS[`rebate-${lang}`];
  const brk = { x: R.brk.x - 6, y: R.brk.y - 4, w: R.brk.w + 12, h: R.brk.h + 6 };
  const ncd = { x: R.ncd.x - 6, y: R.ncd.y - 5, w: R.ncd.w + 12, h: R.ncd.h + 10 };
  const t = useCurrentFrame() / FPS;     // no rebate / 0% NCD first, then the typed rebate, then the NCD tap
  const brkView = t < 1.5 ? 'free9' : 'rebate';
  const ncdView = t < 2.3 ? 'free9' : 'rebate';
  return (
    <>
      <Headline lines={C.rebate} at={0.85} top={170} />
      <Rise at={0.2} top={460}>
        <Shot view={brkView} lang={lang} crop={brk} width={820}>{(k) => <Ring r={R.reb} crop={brk} k={k} at={1.5} pad={2} />}</Shot>
      </Rise>
      <Rise at={0.45} top={1150}>
        <Shot view={ncdView} lang={lang} crop={ncd} width={940} radius={12}>{(k) => <Ring r={{ x: R.ncd.x + R.ncd.w * 0.715, y: R.ncd.y + 2, w: R.ncd.w * 0.14, h: R.ncd.h - 4 }} crop={ncd} k={k} at={2.3} pad={1} />}</Shot>
      </Rise>
      <Fine text={C.fine} top={1320} />
    </>
  );
};
const Lead = ({ lang }) => {
  const C = COPY[lang];
  const R = RECTS[`free-${lang}`];
  const crop = { x: R.cta.x - 4, y: R.cta.y - 4, w: R.cta.w + 8, h: R.cta.h + 8 };
  const f = useCurrentFrame();
  return (
    <>
      <Headline lines={C.lead} at={0.85} top={170} size={lang === 'ms' ? 92 : 96} />
      <Rise at={0.2} top={470}><Shot view="free" lang={lang} crop={crop} width={940} radius={24} /></Rise>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 680, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        {C.steps.map((s, i) => {
          const p = pop(f, 1.3 + i * 0.35);
          return (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ font: `700 44px ${FONT}`, color: RED, opacity: Math.min(1, p * 1.4) }}>›</span>}
              <span style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 30}px)` }}>
                <Chip style={{ height: 84, padding: '0 30px', font: `700 34px ${FONT}`, color: INK }}>{s}</Chip>
              </span>
            </React.Fragment>
          );
        })}
      </div>
      <Push lang={lang} at={2.5} top={880} />
      <Fine text={C.fineLead} top={1320} />
    </>
  );
};
const Viewer = ({ lang }) => {
  const C = COPY[lang];
  const pay = { x: 16, y: 192, w: 358, h: 102 };
  const ans = { x: 16, y: 500, w: 358, h: 252 };
  return (
    <>
      <Headline lines={C.viewer} at={0.85} top={170} size={lang === 'ms' ? 92 : 100} />
      <Rise at={0.2} top={440}><Shot view="viewer" lang={lang} crop={pay} width={860} /></Rise>
      <Rise at={1.4} top={705}><Shot view="viewer" lang={lang} crop={ans} width={900} /></Rise>
      <Pill at={2.4} top={1362}>{C.premium}</Pill>
    </>
  );
};

const SCENES = { hook: Hook, free: Free, rebate: Rebate, lead: Lead, viewer: Viewer };

export const LiveAd = ({ lang = 'ms', audio = false }) => {
  const C = COPY[lang];
  return (
    <AbsoluteFill style={{ background: '#fff' }}>
      <Ambient />
      {L_TL.map(([k, at, len]) => {
        const S = SCENES[k];
        return (
          <Sequence key={k} from={sec(at)} durationInFrames={sec(len)}>
            {k === 'cta' ? <Cta lang={lang} copy={C.cta} /> : <S lang={lang} />}
          </Sequence>
        );
      })}
      {L_TL.filter((s) => s[3]).map(([k, at]) => (
        <Sequence key={`card-${k}`} from={sec(at)} durationInFrames={sec(CARD)}>
          <Card k={k} lang={lang} now={C.cards[k][0]} topic={C.cards[k][1]} num={C.cards[k][2]} />
        </Sequence>
      ))}
      {audio && <Audio src={staticFile(`audio/live-${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
