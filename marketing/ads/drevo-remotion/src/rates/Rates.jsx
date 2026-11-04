// Daily post 1 (briefs/rates.md): "Bank says 6.44%. SA says 3.5%. Who's right?"
// Open loop (owner, 2026-11-04): the question stays open through three clues and is answered
// ~10 s before the end, then one ask. Every screen is the real Live presenter
// (harness/rates.cjs -> public/real/rate-<step>-<lang>.png, positions in rects.json).
import React from 'react';
import { AbsoluteFill, Sequence, Img, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { FPS, sec, pop, clamp, ease } from '../lib';
import { Ambient, Headline, Fine, Chip, glass, FONT, RED, INK, MUTED } from '../ui';
import { Card } from '../scenes/Card';
import { Shot, Rise, Ring } from '../shots';
import RECTS from './rects.json';
import T from './timeline.json';

export const R_TL = {}; const R_CARDS = {}; const PRE = {};
let at = 0;
for (const [k, len, card, pre = 0] of T.scenes) {
  PRE[k] = pre;
  if (card) { R_CARDS[k] = [at, at + T.card]; at += T.card; }
  R_TL[k] = [at, at + len]; at += len;
}
export const R_DUR = +at.toFixed(3);
const LEN = (k) => R_TL[k][1] - R_TL[k][0] + PRE[k];

const COPY = {
  ms: {
    hook: ['Bank sebut *6.44%.*', 'SA sebut *3.5%.*', 'Siapa betul?'],
    stakes: ['Kereta sama.', 'Beza *RM 225* sebulan.'],
    clue1: ['SA taip 3.5%', 'sebagai *EIR...*'],
    clue2: ['Tapi itu', '*bukan jawapannya.*'],
    flatLine: ['Flat', 'Faedah atas pinjaman penuh, sampai habis.'],
    eirLine: ['EIR', 'Faedah atas baki yang tinggal.'],
    clue3: ['Ramai SA', '*silap kat sini.*'],
    card: ['Jadi,', 'siapa betul?', '?'],
    answer: ['*Dua-dua betul.*'],
    same: 'Bayaran bulanan sama.',
    cta1: 'Kalkulator live', cta2: 'yang kira betul.', ask: 'Komen SETUP', askSub: 'Saya setup percuma, 10 minit.',
    fine: { real: 'Rakaman sebenar Drevo Live. Contoh kadar.', law: 'Sejak 1 Jun 2026 pinjaman sewa beli baharu guna EIR (Akta Sewa Beli (Pindaan) 2026). 3.5% flat, 7 tahun = 6.44% EIR.' },
  },
  en: {
    hook: ['Bank says *6.44%.*', 'SA says *3.5%.*', "Who's right?"],
    stakes: ['Same car.', '*RM 225* a month apart.'],
    clue1: ['The SA types 3.5%', 'as *EIR...*'],
    clue2: ["But that's", '*not the answer.*'],
    flatLine: ['Flat', 'Interest on the full loan, to the end.'],
    eirLine: ['EIR', 'Interest on what is still owed.'],
    clue3: ['Most SAs', '*get this wrong.*'],
    card: ['So,', "who's right?", '?'],
    answer: ['*Both are right.*'],
    same: 'The same monthly.',
    cta1: 'A live calculator', cta2: 'that gets it right.', ask: 'Comment SETUP', askSub: 'I set it up free, 10 minutes.',
    fine: { real: 'Real Drevo Live recording. Sample rates.', law: 'Since 1 June 2026 new hire-purchase loans use EIR (Hire-Purchase (Amendment) Act 2026). 3.5% flat over 7 years = 6.44% EIR.' },
  },
};

const img = (step, lang) => `real/rate-${step}-${lang}.png`;
// the big monthly with the line above it ("7 tahun · Deposit RM 17,500")
const MONTHLY = { x: 12, y: 176, w: 366, h: 80 };

// 0-3 s: the question over the real screen, blurred so no number gives it away
const Hook = ({ lang }) => {
  const f = useCurrentFrame();
  const C = COPY[lang];
  const p = interpolate(f / FPS, [0.6, 1.4], [0, 1], { ...clamp, easing: ease });
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 960, opacity: 0.45 * p, filter: 'blur(30px)', transform: `translateY(${(1 - p) * 80}px)` }}>
        <Shot src={img('flat', lang)} crop={{ x: 6, y: 70, w: 378, h: 420 }} width={900} />
      </div>
      <Headline lines={C.hook} at={0.05} out={LEN('hook') - 0.3} top={300} size={104} />
    </>
  );
};

// 3-7 s: why it matters. Two real monthlies for the same car; which rate made which stays hidden.
const Stakes = ({ lang }) => (
  <>
    <Headline lines={COPY[lang].stakes} at={0.05} out={LEN('stakes') - 0.35} top={260} size={88} />
    <Rise at={0.5} top={620}><Shot src={img('wrong', lang)} crop={MONTHLY} width={900} /></Rise>
    <Rise at={1.0} top={880}><Shot src={img('eir', lang)} crop={MONTHLY} width={900} /></Rise>
    <Fine text={COPY[lang].fine.real} top={1380} />
  </>
);

// 7-11 s: clue 1. 3.5% typed on the EIR switch, and the app flags it.
const Clue1 = ({ lang }) => {
  const R = RECTS[lang];
  const crop = { x: 10, y: 172, w: 370, h: 412 };
  return (
    <>
      <Headline lines={COPY[lang].clue1} at={0.05} out={LEN('clue1') - 0.35} top={230} size={96} />
      <Rise at={0.3} top={470}>
        <Shot src={img('wrong', lang)} crop={crop} width={820}>
          {(k) => (<><Ring r={R.rate1} crop={crop} k={k} at={0.9} /><Ring r={R.warn} crop={crop} k={k} at={1.9} /></>)}
        </Shot>
      </Rise>
      <Fine text={COPY[lang].fine.real} top={1400} />
    </>
  );
};

// 11-15 s: clue 2, a fresh hook, then what the two words mean
const Clue2 = ({ lang }) => {
  const f = useCurrentFrame(); const C = COPY[lang];
  const row = (at, [name, line], top) => {
    const p = pop(f, at);
    return (
      <div style={{ position: 'absolute', left: 90, right: 90, top, ...glass({ borderRadius: 34 }), padding: '34px 40px', opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * -140}px)` }}>
        <div style={{ font: `700 64px/1 ${FONT}`, color: RED, letterSpacing: -2 }}>{name}</div>
        <div style={{ font: `600 46px/1.15 ${FONT}`, color: INK, marginTop: 14, letterSpacing: -1 }}>{line}</div>
      </div>
    );
  };
  return (
    <>
      <Headline lines={C.clue2} at={0.05} out={LEN('clue2') - 0.35} top={250} size={104} />
      {row(1.1, C.flatLine, 640)}
      {row(1.6, C.eirLine, 920)}
    </>
  );
};

// 15-19.25 s: clue 3. Adjust > Financing on flat works out each tenure as EIR.
const Clue3 = ({ lang }) => {
  const R = RECTS[lang];
  const crop = { x: 14, y: 262, w: 362, h: 200 };
  return (
    <>
      <Headline lines={COPY[lang].clue3} at={0.05} out={LEN('clue3') - 0.35} top={250} size={104} />
      <Rise at={0.3} top={620}>
        <Shot src={img('adjflat', lang)} crop={crop} width={900}>
          {(k) => <Ring r={R.hint} crop={crop} k={k} at={1.3} />}
        </Shot>
      </Rise>
      <Fine text={COPY[lang].fine.real} top={1380} />
    </>
  );
};

// 20-26 s: the answer. 3.5% flat and 6.44% EIR give the same monthly, on the real screen.
const Answer = ({ lang }) => {
  const f = useCurrentFrame(); const C = COPY[lang]; const R = RECTS[lang];
  const label = (at, text, top) => {
    const p = pop(f, at);
    return <div style={{ position: 'absolute', left: 90, top, opacity: Math.min(1, p * 1.4), transform: `scale(${0.9 + 0.1 * Math.min(1, p)})` }}>
      <Chip style={{ height: 70, font: `700 36px ${FONT}`, background: INK, color: '#fff', border: 'none' }}>{text}</Chip></div>;
  };
  const sameP = pop(f, 2.4);
  return (
    <>
      <Headline lines={C.answer} at={0.2} out={LEN('answer') - 0.35} top={250} size={120} />
      {label(0.6, R.rate_flat, 440)}
      <Rise at={0.6} top={525}><Shot src={img('flat', lang)} crop={MONTHLY} width={900}>{(k) => <Ring r={R.big2} crop={MONTHLY} k={k} at={1.4} />}</Shot></Rise>
      {label(1.0, R.rate_eir, 760)}
      <Rise at={1.0} top={845}><Shot src={img('eir', lang)} crop={MONTHLY} width={900}>{(k) => <Ring r={R.big4} crop={MONTHLY} k={k} at={1.8} />}</Shot></Rise>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 1095, textAlign: 'center', font: `700 64px ${FONT}`, color: RED, letterSpacing: -2,
        opacity: Math.min(1, sameP * 1.4), transform: `translateY(${(1 - sameP) * 50}px)` }}>{C.same}</div>
      <Fine text={C.fine.law} top={1200} />
    </>
  );
};

// 26-30 s: one ask
const Cta = ({ lang }) => {
  const f = useCurrentFrame(); const C = COPY[lang];
  const item = (at, style, children) => { const p = pop(f, at); return <div style={{ position: 'absolute', left: 60, right: 60, textAlign: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 70}px)`, ...style }}>{children}</div>; };
  const flash = interpolate(f / FPS, [0, 0.35], [0.55, 0], clamp);
  return (
    <>
      {item(0.05, { top: 340, font: `700 112px/1 ${FONT}`, letterSpacing: -5, color: INK }, C.cta1)}
      {item(0.2, { top: 470, font: `700 112px/1 ${FONT}`, letterSpacing: -5, color: RED }, C.cta2)}
      {item(0.7, { top: 720 }, <span style={{ display: 'inline-flex', alignItems: 'center', height: 150, padding: '0 70px', borderRadius: 75, background: RED, color: '#fff', font: `700 82px ${FONT}`, letterSpacing: -2, boxShadow: '0 30px 70px rgba(220,38,38,.35)' }}>{C.ask}</span>)}
      {item(1.0, { top: 920, font: `600 48px ${FONT}`, color: MUTED }, C.askSub)}
      {item(1.5, { top: 1200 }, <Chip style={{ height: 76, font: `700 34px ${FONT}`, background: INK, color: '#fff', border: 'none' }}>Drevo</Chip>)}
      <div style={{ position: 'absolute', inset: 0, background: RED, opacity: flash, pointerEvents: 'none' }} />
    </>
  );
};

const SCENES = { hook: Hook, stakes: Stakes, clue1: Clue1, clue2: Clue2, clue3: Clue3, answer: Answer, cta: Cta };
export const R_STILLS = Object.fromEntries(Object.keys(R_TL).map((k) => [k, +(R_TL[k][1] - 0.5).toFixed(2)]));

export const RatesAd = ({ lang = 'ms', audio = true }) => {
  const C = COPY[lang];
  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <Ambient />
      {Object.entries(R_TL).map(([k, [a, b]]) => {
        const S = SCENES[k];
        return <Sequence key={k} from={sec(a - PRE[k])} durationInFrames={sec(b) - sec(a - PRE[k])} name={k}><S lang={lang} /></Sequence>;
      })}
      {Object.entries(R_CARDS).map(([k, [a, b]]) => (
        <Sequence key={`card-${k}`} from={sec(a)} durationInFrames={sec(b) - sec(a)} name={`card-${k}`}>
          <Card k={k} lang={lang} now={C.card[0]} topic={C.card[1]} num={C.card[2]} />
        </Sequence>
      ))}
      {audio && <Audio src={staticFile(`audio/rates-${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
