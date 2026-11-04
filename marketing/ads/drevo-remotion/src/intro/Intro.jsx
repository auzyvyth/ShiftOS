// The intro ad (briefs/intro.md): the video an advisor gets in a DM after saying yes to
// "nak tengok intro?". Live answers, their own page and posters, where the leads come from,
// then the ask (name, email, phone, dealership). Reuses the Premium ad's scenes where they
// already show the real product; new screens are real components on sample data
// (harness/intro.jsx -> public/real/intro-<view>-<lang>.png, positions in rects.json).
import React from 'react';
import { AbsoluteFill, Sequence, Img, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { FPS, sec, pop, clamp, ease } from '../lib';
import { Ambient, Headline, Fine, Chip, glass, FONT, RED, INK, MUTED } from '../ui';
import { Card } from '../scenes/Card';
import { HookCalc, Budget } from '../scenes/Presenter';
import { Page, Posters, Stats } from '../scenes/Features';
import { Shot, Rise, Ring, Tap } from '../shots';
import RECTS from './rects.json';
import T from './timeline.json';

export const I_CARD = T.card;
export const I_TL = {}; export const I_CARDS = {}; const PRE = {};
let at = 0;
for (const [k, len, card, pre = 0] of T.scenes) {
  PRE[k] = pre;
  if (card) { I_CARDS[k] = [at, at + I_CARD]; at += I_CARD; }
  I_TL[k] = [at, at + len]; at += len;
}
export const I_DUR = +at.toFixed(3);
const LEN = (k) => I_TL[k][1] - I_TL[k][0] + PRE[k];

const COPY = {
  ms: {
    hook: { hook: ['Viewer tanya:', '*berapa sebulan?*'] },
    contact: ['Nombor tersembunyi.', '*Tunjuk bila perlu.*'],
    report: ['Habis live,', '*nampak hasilnya.*'],
    sources: ['Lead datang', '*dari mana?*'],
    cards: {
      budget: ['Sekarang:', 'Gaji viewer', '02'], contact: ['Sekarang:', 'Nombor anda', '03'],
      page: ['Sekarang:', 'Page anda', '04'], posters: ['Sekarang:', 'Poster', '05'],
      report: ['Lepas live:', 'Laporan', '06'], stats: ['Sekarang:', 'Klik setiap kereta', '07'],
      sources: ['Sekarang:', 'Sumber lead', '08'],
    },
    fine: { contact: 'Nombor contoh. Tersembunyi bila live bermula.', report: 'Contoh data. Laporan sebenar Drevo Live.', sources: 'Contoh data. Kad sebenar Drevo Analytics.' },
    cta1: 'Setup percuma.', cta2: 'Saya buat, 10 minit.', ask: 'Balas mesej ini dengan:',
    fields: ['Nama', 'Email', 'Nombor telefon', 'Nama kedai'],
  },
  en: {
    hook: { hook: ['A viewer asks:', '*how much a month?*'] },
    contact: ['Number hidden.', '*Show it when you want.*'],
    report: ['Live ends,', '*see what it did.*'],
    sources: ['Where do', '*leads come from?*'],
    cards: {
      budget: ['Now:', "Viewer's salary", '02'], contact: ['Now:', 'Your number', '03'],
      page: ['Now:', 'Your own page', '04'], posters: ['Now:', 'Posters', '05'],
      report: ['After the live:', 'The report', '06'], stats: ['Now:', 'Clicks per car', '07'],
      sources: ['Now:', 'Lead sources', '08'],
    },
    fine: { contact: 'Sample number. Hidden when the live starts.', report: 'Sample data. The real Drevo Live report.', sources: 'Sample data. The real Drevo Analytics card.' },
    cta1: 'Free setup.', cta2: 'I do it, 10 minutes.', ask: 'Reply to this message with:',
    fields: ['Name', 'Email', 'Phone number', 'Dealership name'],
  },
};

const out = (f, k) => interpolate(f / FPS, [LEN(k) + 0.05, LEN(k) + 0.4], [0, 1], clamp);

// ---------- 03 Contact: the seller's number is off until they tap the top-bar button ----------
const Contact = ({ lang }) => {
  const f = useCurrentFrame();
  const C = COPY[lang]; const R = RECTS[`contact-${lang}`];
  const crop = { x: 6, y: 4, w: 378, h: 220 };
  return (
    <>
      <Headline lines={C.contact} at={0.1} out={LEN('contact') - 0.4} top={216} size={90} />
      <Rise at={0.3} top={520}>
        <Shot src={`real/intro-contact-${lang}.png`} crop={crop} width={940}>
          {(k) => (
            <>
              {/* the real screen before the tap (number hidden), cut to the real screen after it */}
              <Img src={staticFile(`real/intro-contact-off-${lang}.png`)} style={{ position: 'absolute', width: 390 * k, height: 844 * k, left: -crop.x * k, top: -crop.y * k,
                opacity: 1 - interpolate(f / FPS, [1.35, 1.5], [0, 1], clamp) }} />
              <Tap r={R.button} crop={crop} k={k} at={1.3} />
              <Ring r={R.banner} crop={crop} k={k} at={1.7} />
            </>
          )}
        </Shot>
      </Rise>
      <Fine text={C.fine.contact} top={1380} />
    </>
  );
};

// ---------- 06 Live report: the real end-of-live screen ----------
const Report = ({ lang }) => {
  const C = COPY[lang]; const R = RECTS[`report-${lang}`];
  const crop = { x: 8, y: 70, w: 374, h: 420 };
  return (
    <>
      <Headline lines={C.report} at={0.1} out={LEN('report') - 0.4} top={216} />
      <Rise at={0.3} top={470}>
        <Shot src={`real/intro-report-${lang}.png`} crop={crop} width={900}>
          {(k) => <Ring r={R.tiles} crop={crop} k={k} at={1.2} />}
        </Shot>
      </Rise>
      <Fine text={C.fine.report} top={1500} />
    </>
  );
};

// ---------- 08 Sources: Premium Analytics "traffic by platform" ----------
const Sources = ({ lang }) => {
  const C = COPY[lang]; const R = RECTS[`sources-${lang}`];
  const crop = { x: R.card.x - 4, y: R.card.y - 4, w: R.card.w + 8, h: R.card.h + 8 };
  return (
    <>
      <Headline lines={C.sources} at={0.1} out={LEN('sources') - 0.4} top={216} />
      <Rise at={0.3} top={560}>
        <Shot src={`real/intro-sources-${lang}.png`} crop={crop} width={940} radius={20} />
      </Rise>
      <Fine text={C.fine.sources} top={1380} />
    </>
  );
};

// ---------- the ask: reply with four details (owner, 2026-11-04), no signup link ----------
const IntroCta = ({ lang }) => {
  const f = useCurrentFrame(); const C = COPY[lang];
  const item = (at, style, children) => { const p = pop(f, at); return <div style={{ position: 'absolute', left: 60, right: 60, textAlign: 'center', opacity: Math.min(1, p * 1.4), filter: ((1 - Math.min(1, p)) * 14) > 0.05 ? `blur(${(1 - Math.min(1, p)) * 14}px)` : 'none', transform: `translateY(${(1 - p) * 70}px)`, ...style }}>{children}</div>; };
  const flash = interpolate(f / FPS, [0, 0.35], [0.55, 0], clamp);
  return (
    <>
      {item(0.05, { top: 300, font: `700 124px/1 ${FONT}`, letterSpacing: -6, color: INK }, C.cta1)}
      {item(0.25, { top: 440, font: `700 92px/1 ${FONT}`, letterSpacing: -4, color: RED }, C.cta2)}
      {item(0.7, { top: 610, font: `500 40px ${FONT}`, color: MUTED }, C.ask)}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 690, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {C.fields.map((x, i) => {
          const p = pop(f, 0.9 + i * 0.18);
          return (
            <div key={x} style={{ ...glass({ borderRadius: 30 }), height: 104, display: 'flex', alignItems: 'center', gap: 26, padding: '0 36px', opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * -120}px)` }}>
              <span style={{ width: 52, height: 52, borderRadius: 26, background: RED, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `700 28px ${FONT}` }}>{i + 1}</span>
              <span style={{ font: `700 44px ${FONT}`, color: INK, letterSpacing: -1 }}>{x}</span>
            </div>
          );
        })}
      </div>
      {item(1.9, { top: 1300 }, <Chip style={{ height: 76, font: `700 34px ${FONT}`, background: INK, color: '#fff', border: 'none' }}>Drevo</Chip>)}
      <div style={{ position: 'absolute', inset: 0, background: RED, opacity: flash, pointerEvents: 'none' }} />
    </>
  );
};

const SCENES = {
  hook: ({ lang }) => <HookCalc lang={lang} copy={COPY[lang].hook} />,
  budget: Budget, contact: Contact, page: Page, posters: Posters,
  report: Report, stats: Stats, sources: Sources, cta: IntroCta,
};

// Seconds at which each scene has settled: one still each (tools/stills.cjs).
export const I_STILLS = Object.fromEntries(Object.keys(I_TL).map((k) => [k, +(I_TL[k][1] - (k === 'hook' ? 1.2 : 0.6)).toFixed(2)]));

export const IntroAd = ({ lang = 'ms', audio = true }) => {
  const C = COPY[lang];
  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <Ambient />
      {Object.entries(I_TL).map(([k, [a, b]]) => {
        const S = SCENES[k];
        return <Sequence key={k} from={sec(a - PRE[k])} durationInFrames={sec(b) - sec(a - PRE[k])} name={k}><S lang={lang} /></Sequence>;
      })}
      {Object.entries(I_CARDS).map(([k, [a, b]]) => (
        <Sequence key={`card-${k}`} from={sec(a)} durationInFrames={sec(b) - sec(a)} name={`card-${k}`}>
          <Card k={k} lang={lang} now={C.cards[k][0]} topic={C.cards[k][1]} num={C.cards[k][2]} />
        </Sequence>
      ))}
      {audio && <Audio src={staticFile(`audio/intro-${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
