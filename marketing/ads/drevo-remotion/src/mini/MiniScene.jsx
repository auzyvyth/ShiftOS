// Mini page scene: the REAL Premium seller page (/s/<slug>, SalesmanProfilePage) on a sample seller,
// scrolled inside the 3D phone: the name card, the cars with their monthly, the budget finder opened with a
// typed budget, the one WhatsApp button, "why buy from me". Phone parts and camera shared with the loan scene.
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, spring } from 'remotion';
import { FONT } from '../ui';
import { Phone, Shot, Push, Tap, Outline, Caption, camAt, glide, S, SW, SH, BEZ } from '../loan/LoanScene';
import TL from './timeline.json';
import RECTS from './rects.json';

export const M_FPS = TL.fps;
export const M_DUR = TL.dur;
const BG = '#FFFFFF';   // owner, 2026-11-25: white with a hint of red, so the app shows
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const COPY = {
  ms: { caps: [['Satu link,', '*semua kereta anda.*'], ['Harga dan bulanan,', '*setiap kereta.*'], ['Pembeli taip bajet,', '*nampak apa muat.*'],
    ['Satu tap,', '*terus ke WhatsApp anda.*'], ['Kenapa beli', '*dengan anda.*']], note: 'Contoh jurujual. Anggaran bulanan; bank yang memutuskan.' },
  en: { caps: [['One link,', '*all your cars.*'], ['Price and monthly,', '*every car.*'], ['Buyers type a budget,', '*see what fits.*'],
    ['One tap,', '*straight to your WhatsApp.*'], ['Why buy', '*from you.*']], note: 'Sample seller. Monthly figures are estimates; the bank decides.' },
};
const FOCUS_Y = 1120;

export const MiniScene = ({ lang = 'ms', audio = true, entered = false }) => {
  const f = useCurrentFrame();
  const R = RECTS[lang], C = COPY[lang];
  const img = (n) => staticFile(`real/mini-${n}-${lang}.png`);
  // page scroll (css px): top -> cars -> the budget finder (same scroll as the budget shot) -> why buy
  const sCars = R.cars.y - 60, sWhy = R.why.y - 70;
  const scroll = f < TL.scrollBudget[0] ? interpolate(f, TL.scrollCars, [0, sCars], { ...cl, easing: glide })
    : f < TL.scrollWhy[0] ? interpolate(f, TL.scrollBudget, [sCars, R.budgetScroll], { ...cl, easing: glide })
    : interpolate(f, TL.scrollWhy, [R.budgetScroll, sWhy], { ...cl, easing: glide });
  const onScreen = (r, s) => ({ ...r, y: r.y - s });
  const fitList = { x: 16, y: 440, w: 358, h: 338 };
  const whyBox = { x: 12, y: R.why.y - 8, w: 366, h: 335 };
  const mid = (r) => r.y + r.h / 2;
  const KEYS = [
    [0, 195, 430, 1], [TL.outlineCard + 10, 195, mid(R.card) - 40, 1.35], [TL.scrollCars[0], 195, mid(R.card) - 40, 1.35],
    [TL.outlineCar + 8, 195, mid(onScreen(R.firstCar, sCars)) + 20, 1.5], [TL.scrollBudget[0] - 4, 195, mid(onScreen(R.firstCar, sCars)) + 20, 1.5],
    [TL.budget + 14, 195, mid(fitList) - 40, 1.4], [TL.tapWa - 10, 195, mid(fitList) - 40, 1.4],
    [TL.tapWa, 260, 720, 1.5], [TL.scrollWhy[0], 260, 720, 1.5],
    [TL.outlineWhy + 10, 195, 330, 1.35], [TL.dur - 20, 195, 330, 1.35], [TL.dur, 195, 430, 1.05],
  ];
  const cam = camAt(KEYS, f);
  const PY = 450;
  const sx = 540 - SW / 2 + cam.x * S, sy = PY + BEZ + cam.y * S;
  const enter = entered ? 1 : spring({ frame: f, fps: M_FPS, config: { damping: 16, mass: 0.9, stiffness: 110 } });
  const float = Math.sin(f / 26) * 1.5;
  const inBudget = f >= TL.budget && f < TL.scrollWhy[0];
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: [
        `radial-gradient(640px 520px at ${540 + Math.sin(f / 60) * 140}px 1100px, rgba(220,38,38,0.09), transparent 70%)`,
        'radial-gradient(1100px 600px at 540px 0px, rgba(220,38,38,0.05), transparent 70%)' ].join(',') }} />
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(540px, ${FOCUS_Y}px) scale(${cam.z}) translate(${-sx}px, ${-sy}px)` }}>
        <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: '540px 900px' }}>
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateX(${(1 - enter) * 520}px)` }}>
            <Phone x={540} y={PY} ry={-12 + (1 - enter) * 40 + float} glow={0.6}>
              <Shot src={img('page')} y={scroll} h={R.H} />
              <Outline at={TL.outlineCard} r={R.card} until={TL.scrollCars[0]} />
              {f >= TL.outlineCar - 2 && f < TL.scrollBudget[0] + 6 && <Outline at={TL.outlineCar} r={onScreen(R.firstCar, sCars)} until={TL.scrollBudget[0]} />}
              <Tap at={TL.tapBudget} r={onScreen(R.budget, R.budgetScroll)} />
              {inBudget && <Push at={TL.budget} fade><Shot src={img('budget')} /><Outline at={TL.outlineFit} r={fitList} until={TL.tapWa - 6} /></Push>}
              {!inBudget && R.bar && <Img src={img('bar')} style={{ position: 'absolute', left: 0, top: R.bar.y * S, width: SW, height: R.bar.h * S }} />}
              <Tap at={TL.tapWa} r={{ x: 268, y: 789, w: 112, h: 44 }} />
              {f >= TL.outlineWhy - 2 && <Outline at={TL.outlineWhy} r={onScreen(whyBox, sWhy)} />}
            </Phone>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG} 0%, ${BG} 22%, rgba(255,255,255,0.6) 27%, transparent 32%, transparent 80%, rgba(255,255,255,0.85) 92%, ${BG} 100%)` }} />
      {TL.captions.map((at, i) => <Caption key={i} lines={C.caps[i]} at={at} until={TL.captions[i + 1] ? TL.captions[i + 1] - 4 : null} />)}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 400, textAlign: 'center', fontFamily: FONT, fontWeight: 500, fontSize: 24,
        color: 'rgba(11,12,15,0.5)' }}>{C.note}</div>
      {audio && <Audio src={staticFile('audio/mini.wav')} />}
    </AbsoluteFill>
  );
};
