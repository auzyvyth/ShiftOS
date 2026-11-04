// Daily post (briefs/live.md): the WHOLE Live presentation (owner, 2026-11-04).
// Open loop: "the SA answers every viewer question in one tap. What is he using?" Three clues are
// tight zooms into the real presenter recording (no top bar, no name); at ~10 s before the end the
// camera pulls back to the whole screen. Footage: public/takes/calc-*.mp4, budget-*.mp4 (harness/record.cjs).
import React from 'react';
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { FPS, sec, pop, clamp, ease, easeIO } from '../lib';
import { Ambient, Headline, Fine, Chip, Device, Cursor, glass, FONT, RED, INK, MUTED } from '../ui';
import { Card } from '../scenes/Card';
import { Take, Excel } from '../scenes/Presenter';
import calcMs from '../calc-ms.clicks.json';
import calcEn from '../calc-en.clicks.json';
import budMs from '../budget-ms.clicks.json';
import budEn from '../budget-en.clicks.json';
import { Shot, Ring } from '../shots';
import RECTS from './rects.json';
import T from './timeline.json';

const RATIO = 1124 / 1000;
// The Promote cut (TikTok paid boost) drops clue5 (salary / "layak") and clue6 (bank documents):
// finance-eligibility lines are what ad review flags, and it must stay under ~35 s.
const build = (keys) => {
  const tl = {}, cards = {}; let at = 0;
  for (const [k, len, card] of T.scenes) {
    if (keys && !keys.includes(k)) continue;
    if (card) { cards[k] = [at, at + T.card]; at += T.card; }
    tl[k] = [at, at + len]; at += len;
  }
  return { tl, cards, dur: +at.toFixed(3) };
};
const PRE = Object.fromEntries(T.scenes.map(([k, , , pre = 0]) => [k, pre]));
const FULL = build(), PROMO = build(T.promote);
export const L_TL = FULL.tl; const L_CARDS = FULL.cards;
export const L_DUR = FULL.dur, LP_DUR = PROMO.dur;
const LEN = (k) => L_TL[k][1] - L_TL[k][0] + PRE[k];

const COPY = {
  ms: {
    hook: ['Viewer tanya,', 'SA ni jawab *dalam 1 tap.*', '*Dia guna apa?*'],
    stakes: ['Bukan Excel.', 'Bukan kalkulator *phone.*'],
    q1: 'Berapa sebulan?', clue1: ['Satu tap,', '*monthly keluar.*'],
    q2: 'Kalau deposit 30%?', clue2: ['Tunggu,', '*ada lagi.*'],
    q3: 'Ada rebat tak?', clue3: ['Rebat bulan ni?', '*Tolak terus.*'],
    q4: 'NCD saya 55%.', clue4: ['Insurans pun', '*ikut NCD viewer.*'],
    q5: 'Gaji RM 10k, layak apa?', clue5: ['Ramai SA', '*tak tahu ni wujud.*'],
    q6: 'Dokumen apa nak bawa?', clue6: ['Dan satu lagi,', '*terus dari live.*'],
    card: ['Jawapannya:', 'Drevo Live', '?'],
    answer: ['*Drevo Live.*', 'Satu skrin, semua jawapan.'],
    cta1: 'Nak skrin ni', cta2: 'untuk live anda?', ask: 'Komen SETUP', askSub: 'Saya setup percuma, 10 minit.',
    pAsk: 'Setup percuma', pSub: 'drevo.my/for-salesmen',
    fine: 'Rakaman sebenar Drevo Live. Anggaran 6.5% EIR, bank yang tentukan.',
  },
  en: {
    hook: ['A viewer asks.', 'The SA answers *in 1 tap.*', '*What is it?*'],
    stakes: ['Not Excel.', 'Not a *phone calculator.*'],
    q1: 'How much a month?', clue1: ['One tap,', '*the monthly is up.*'],
    q2: 'What if I put 30% down?', clue2: ['Wait,', "*there's more.*"],
    q3: 'Any rebate?', clue3: ['A rebate this month?', '*Taken off.*'],
    q4: 'My NCD is 55%.', clue4: ['Insurance follows', "*the viewer's NCD.*"],
    q5: 'RM 10k salary, what fits?', clue5: ['Most SAs', "*don't know this exists.*"],
    q6: 'What documents do I bring?', clue6: ['And one more,', '*right from the live.*'],
    card: ['The answer:', 'Drevo Live', '?'],
    answer: ['*Drevo Live.*', 'One screen, every answer.'],
    cta1: 'Want this screen', cta2: 'for your live?', ask: 'Comment SETUP', askSub: 'I set it up free, 10 minutes.',
    pAsk: 'Free setup', pSub: 'drevo.my/for-salesmen',
    fine: 'Real Drevo Live recording. Estimate at 6.5% EIR, the bank decides.',
  },
};

// A tight window into the real recording: focus point (fx, fy) of the stage, magnified z times.
// The top bar (tabs, name) stays out of frame, so the clues never say what the screen is.
const Zoom = ({ src, clicks, takeT, fx, fy, z, top, width = 900, height = 640 }) => {
  const IW = width * z, IH = IW / RATIO;
  return (
    <div style={{ position: 'absolute', left: (1080 - width) / 2, top, width, height, borderRadius: 36, overflow: 'hidden', background: '#fff',
      boxShadow: '0 50px 110px rgba(11,12,15,0.30), 0 14px 30px rgba(11,12,15,0.18)' }}>
      <div style={{ position: 'absolute', left: width / 2 - fx * IW, top: height / 2 - fy * IH, width: IW, height: IH }}>
        <Take src={src} takeT={takeT} />
        <Cursor clicks={clicks} takeT={takeT} w={IW} h={IH} />
      </div>
    </div>
  );
};
// the viewer's question, as our own speech bubble (never TikTok's comment UI)
const Ask = ({ text, at = 0.15, top }) => {
  const f = useCurrentFrame(); const p = pop(f, at);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px) scale(${0.92 + 0.08 * Math.min(1, p)})` }}>
      <div style={{ ...glass({ borderRadius: 44 }), height: 96, padding: '0 44px', display: 'flex', alignItems: 'center', gap: 22, font: `700 50px ${FONT}`, color: INK, letterSpacing: -1 }}>
        <span style={{ width: 56, height: 56, borderRadius: 28, background: RED, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `700 36px ${FONT}` }}>?</span>{text}
      </div>
    </div>
  );
};
const zIn = (f) => interpolate(f / FPS, [0.2, 0.7], [0, 1], { ...clamp, easing: ease });

// 0-3 s: the question over a sharp close-up of a real tap (owner, 2026-11-04: the blurred screen read
// as broken). The zoom keeps the top bar out of frame, so what the screen is stays the question.
const Hook = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const calc = (lang === 'en' ? calcEn : calcMs).clicks;
  const p = pop(f, 0, FPS, { damping: 16, stiffness: 260, mass: 0.6 });
  const z = 1.9 * (1.12 - 0.12 * Math.min(1, p));
  return (
    <>
      <Headline lines={COPY[lang].hook} at={0} out={LEN('hook') - 0.3} top={260} size={80} instant />
      <div style={{ position: 'absolute', inset: 0 }}>
        <Zoom src={`takes/calc-${lang}.mp4`} clicks={calc} takeT={1.4 + t * 0.5} fx={0.5} fy={0.33} z={z} top={640} height={600} />
      </div>
    </>
  );
};

// 3-7 s: what it is not. The spreadsheet SAs use, stuck on #VALUE!.
const Stakes = ({ lang }) => {
  const f = useCurrentFrame(); const p = pop(f, 0.3);
  return (
    <>
      <Headline lines={COPY[lang].stakes} at={0.05} out={LEN('stakes') - 0.35} top={260} size={92} />
      <div style={{ position: 'absolute', left: 126, top: 640, width: 828, height: 486, padding: 14, borderRadius: 26, background: 'linear-gradient(160deg,#1b1d22,#0b0c0f)',
        boxShadow: '0 60px 120px rgba(11,12,15,0.28)', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 90}px) rotate(${-2 * Math.min(1, p)}deg)` }}>
        <div style={{ width: 800, height: 458, borderRadius: 14, overflow: 'hidden' }}><Excel t={1.5} lang={lang} /></div>
      </div>
    </>
  );
};

// Phone screenshots (harness/live.cjs): a crop, with a crossfade from one real screen to the next.
const PhoneShot = ({ lang, from, to, crop, ring, swap = 1.2, top = 600, width = 820 }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const o = interpolate(t, [swap, swap + 0.2], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: (1080 - width) / 2, top }}>
      <Shot src={`real/live-${from}-${lang}.png`} crop={crop} width={width}>
        {(k) => (<>
          {to && <Img src={staticFile(`real/live-${to}-${lang}.png`)} style={{ position: 'absolute', width: 390 * k, height: 844 * k, left: -crop.x * k, top: -crop.y * k, opacity: o }} />}
          {ring && <Ring r={ring} crop={crop} k={k} at={swap + 0.4} />}
        </>)}
      </Shot>
    </div>
  );
};

const clue = (n) => ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang]; const R = RECTS[lang];
  const calc = (lang === 'en' ? calcEn : calcMs).clicks, bud = (lang === 'en' ? budEn : budMs).clicks;
  const g = zIn(f);
  const zoom = (z0, s) => <Zoom {...s} z={z0 * (1.15 - 0.15 * g)} top={620} />;
  const pic = {
    1: () => zoom(2.1, { src: `takes/calc-${lang}.mp4`, clicks: calc, takeT: 0.6 + t * 0.6, fx: 0.42, fy: 0.27 }),
    2: () => zoom(1.75, { src: `takes/calc-${lang}.mp4`, clicks: calc, takeT: 5.2 + t * 0.6, fx: 0.56, fy: 0.36 }),
    3: () => <PhoneShot lang={lang} from="rebadj" to="rebate" crop={{ x: 10, y: 172, w: 370, h: 330 }} ring={R.rebrow} swap={1.3} />,
    4: () => zoom(1.7, { src: `takes/calc-${lang}.mp4`, clicks: calc, takeT: 2.5 + t * 0.6, fx: 0.7, fy: 0.64 }),
    5: () => zoom(1.25, { src: `takes/budget-${lang}.mp4`, clicks: bud, takeT: 3.6 + t * 1.2, fx: 0.5, fy: 0.42 }),
    6: () => <PhoneShot lang={lang} from="docs" crop={{ x: 10, y: 69, w: 370, h: 440 }} top={600} width={780} />,
  }[n];
  return (
    <>
      <Headline lines={C[`clue${n}`]} at={0.05} out={LEN(`clue${n}`) - 0.35} top={230} size={92} />
      <Ask text={C[`q${n}`]} top={480} />
      <div style={{ position: 'absolute', inset: 0, opacity: g, transform: `translateY(${(1 - g) * 80}px)` }}>{pic()}</div>
      <Fine text={C.fine} top={1340} />
    </>
  );
};

// 20-26 s: the pull-back. The whole presenter, the recording playing.
const Answer = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS;
  const calc = (lang === 'en' ? calcEn : calcMs).clicks;
  const g = interpolate(t, [0.1, 1.1], [0, 1], { ...clamp, easing: easeIO });
  const w = 980, h = w / RATIO;
  const z = 2.1 - 1.1 * g;   // starts at clue 1's zoom, lands on the whole stage
  return (
    <>
      <Headline lines={COPY[lang].answer} at={0.9} out={LEN('answer') - 0.35} top={230} size={78} />
      <Device x={50} y={560} w={w} ratio={RATIO} glow={1.2}>
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '42% 27%', transform: `scale(${z})` }}>
          <Take src={`takes/calc-${lang}.mp4`} takeT={0.6 + t * 1.3} />
          <Cursor clicks={calc} takeT={0.6 + t * 1.3} w={w} h={h} />
        </div>
      </Device>
      <Fine text={COPY[lang].fine} top={1470} />
    </>
  );
};

const Cta = ({ lang, promote }) => {
  const f = useCurrentFrame(); const C = COPY[lang];
  const item = (at, style, children) => { const p = pop(f, at); return <div style={{ position: 'absolute', left: 60, right: 60, textAlign: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 70}px)`, ...style }}>{children}</div>; };
  const flash = interpolate(f / FPS, [0, 0.35], [0.55, 0], clamp);
  return (
    <>
      {item(0.05, { top: 340, font: `700 112px/1 ${FONT}`, letterSpacing: -5, color: INK }, C.cta1)}
      {item(0.2, { top: 470, font: `700 112px/1 ${FONT}`, letterSpacing: -5, color: RED }, C.cta2)}
      {item(0.7, { top: 720 }, <span style={{ display: 'inline-flex', alignItems: 'center', height: 150, padding: '0 70px', borderRadius: 75, background: RED, color: '#fff', font: `700 82px ${FONT}`, letterSpacing: -2, boxShadow: '0 30px 70px rgba(220,38,38,.35)' }}>{promote ? C.pAsk : C.ask}</span>)}
      {item(1.0, { top: 920, font: `600 48px ${FONT}`, color: MUTED }, promote ? C.pSub : C.askSub)}
      {item(1.5, { top: 1200 }, <Chip style={{ height: 76, font: `700 34px ${FONT}`, background: INK, color: '#fff', border: 'none' }}>Drevo</Chip>)}
      <div style={{ position: 'absolute', inset: 0, background: RED, opacity: flash, pointerEvents: 'none' }} />
    </>
  );
};

const SCENES = { hook: Hook, stakes: Stakes, clue1: clue(1), clue2: clue(2), clue3: clue(3), clue4: clue(4), clue5: clue(5), clue6: clue(6), answer: Answer, cta: Cta };

export const LiveAd = ({ lang = 'ms', audio = true, promote = false }) => {
  const C = COPY[lang]; const { tl, cards } = promote ? PROMO : FULL;
  return (
    <AbsoluteFill style={{ background: '#fff', overflow: 'hidden' }}>
      <Ambient />
      {Object.entries(tl).map(([k, [a, b]]) => {
        const S = SCENES[k];
        return <Sequence key={k} from={sec(a - PRE[k])} durationInFrames={sec(b) - sec(a - PRE[k])} name={k}><S lang={lang} promote={promote} /></Sequence>;
      })}
      {Object.entries(cards).map(([k, [a, b]]) => (
        <Sequence key={`card-${k}`} from={sec(a)} durationInFrames={sec(b) - sec(a)} name={`card-${k}`}>
          <Card k={k} lang={lang} now={C.card[0]} topic={C.card[1]} num={C.card[2]} />
        </Sequence>
      ))}
      {audio && <Audio src={staticFile(`audio/live-${promote ? 'p-' : ''}${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
