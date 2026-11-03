import React from 'react';
import { useCurrentFrame, Img, OffthreadVideo, Freeze, staticFile, interpolate } from 'remotion';
import { COPY, TL, LEN, CARS, FPS, sec, lerp, pop, clamp, ease, easeIO } from '../lib';
import { Headline, Fine, Chip, glass, Device, FONT, RED, RED2, MINT, INK, MUTED } from '../ui';
// The coach scene runs the APP's own rules and component (not a drawing of them)
import { carNextStep } from '../../../../../src/utils/carCoach.js';
import CarNextStep from '../../../../../src/components/coach/CarNextStep.jsx';

// 60/30/10: every stage light is Drevo red (the app's per-stage hues stay in the app)
const HUES = Array(7).fill(RED);
// exits start AT the hard cut, so they never show (the next chapter card cuts in instead)
const len = (k) => LEN(k) + 0.4;
const Icon = ({ d, c = INK, s = 30 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const exitOf = (f, k) => lerp(f, sec(len(k) - 0.35), sec(len(k)), 0, 1);

// ---------- 03 Leads: one buyer travels the pipeline, stage by stage, no cuts ----------
export const Leads = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const hop = [0.5, 1.0, 1.5, 3.6, 4.0, 4.4, 4.8];                // stage changes (scene seconds)
  let st = 0; hop.forEach((h, i) => { if (t >= h) st = i; });
  const p = pop(f, hop[st]);
  const ex = exitOf(f, 'leads');
  const cardIn = pop(f, 0.25);
  const won = t >= hop[6];
  const toast = (at, until) => interpolate(t, [at, at + 0.25, until, until + 0.25], [0, 1, 1, 0], clamp);
  return (
    <>
      <Headline lines={C.leads} at={0.1} out={len('leads') - 0.4} top={216} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ex, filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none' }}>
        {/* stage rail: 7 lights, the reached ones glow */}
        <div style={{ position: 'absolute', left: 90, right: 90, top: 640, height: 12, borderRadius: 6, background: 'rgba(11,12,15,0.08)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, width: `${(st + Math.min(1, p) - 1 + 1) / 7 * 100}%`, background: RED }} />
          {HUES.map((h, i) => (
            <div key={i} style={{ position: 'absolute', left: `calc(${(i + 0.5) / 7 * 100}% - 15px)`, top: -9, width: 30, height: 30, borderRadius: 15, background: i <= st ? h : '#E5E7EB', boxShadow: i === st ? `0 0 0 8px rgba(220,38,38,.18)` : 'none', border: '4px solid #FFFFFF' }} />
          ))}
        </div>
        {/* the stage pill morphs to each new stage */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 720, display: 'flex', justifyContent: 'center' }}>
          <div style={{ ...glass({ borderRadius: 999 }), height: 84, padding: '0 40px', display: 'flex', alignItems: 'center', gap: 18, font: `700 40px ${FONT}`, color: INK, transform: `scale(${0.85 + 0.15 * Math.min(1.1, p)})`, boxShadow: '0 30px 70px rgba(11,12,15,.14), 0 8px 20px rgba(11,12,15,.08)' }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: RED }} />
            <span style={{ filter: ((1 - Math.min(1, p)) * 8) > 0.05 ? `blur(${(1 - Math.min(1, p)) * 8}px)` : 'none' }}>{C.stages[st]}</span>
          </div>
        </div>
        {/* the buyer */}
        <div style={{ position: 'absolute', left: 110, right: 110, top: 860, height: 300, ...glass(), padding: 40, display: 'flex', gap: 30, alignItems: 'center', opacity: Math.min(1, cardIn * 1.5), transform: `translateY(${(1 - cardIn) * 120}px) rotate(${Math.sin(t * 1.4) * 0.6}deg)`, boxShadow: won ? `0 0 0 4px ${RED}, 0 40px 90px rgba(220,38,38,.25)` : glass().boxShadow }}>
          <div style={{ width: 140, height: 140, borderRadius: 70, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 64px ${FONT}`, color: '#FFFFFF', flex: 'none' }}>H</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 54px ${FONT}`, color: INK }}>Hafiz</div>
            <div style={{ font: `500 30px ${FONT}`, color: MUTED, marginTop: 6 }}>2025 Toyota GR86 2.4L RZ</div>
            <div style={{ font: `700 34px ${FONT}`, color: INK, marginTop: 12 }}>RM 175,000</div>
          </div>
          {won && <div style={{ position: 'absolute', right: 34, top: 34, width: 70, height: 70, borderRadius: 35, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(f, hop[6] + 0.1)})`, }}><Icon d="M5 12.5l4.5 4.5L19 7.5" c="#FFFFFF" s={42} /></div>}
        </div>
        {/* what happened between: a call logged, a reminder set */}
        {[[1.9, 3.4, 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z', C.callLogged, ''],
          [2.4, 3.5, 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', C.reminderSet, C.tomorrow]].map(([a, b, d, label, sub], i) => {
          const o = toast(a, b);
          return (
            <div key={i} style={{ position: 'absolute', left: i ? 300 : 150, top: i ? 1290 : 1180, ...glass({ borderRadius: 28 }), padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 18, opacity: o, transform: `translateY(${(1 - o) * 40}px) scale(${0.9 + 0.1 * o})` }}>
              <div style={{ width: 58, height: 58, borderRadius: 18, background: 'rgba(220,38,38,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={d} c={RED} /></div>
              <div><div style={{ font: `700 30px ${FONT}`, color: INK }}>{label}</div>{sub && <div style={{ font: `500 24px ${FONT}`, color: MUTED }}>{sub}</div>}</div>
            </div>
          );
        })}
      </div>
      <Fine text={C.fine.leads} top={1530} />
    </>
  );
};

// ---------- 04 Listing stats: the counts a seller never had (real premiummotors numbers) ----------
export const Stats = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const ex = exitOf(f, 'stats');
  const k = interpolate(t, [0.5, 2.0], [0, 1], { ...clamp, easing: ease });
  const tile = (at, n, label, color, d) => {
    const p = pop(f, at);
    return (
      <div style={{ flex: 1, minWidth: 0, ...glass({ borderRadius: 30 }), padding: '32px 26px', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 100}px)` }}>
        <Icon d={d} c={color} s={40} />
        <div style={{ font: `700 124px/1 ${FONT}`, letterSpacing: -5, color, marginTop: 12 }}>{Math.round(n * k)}</div>
        <div style={{ font: `500 27px/1.2 ${FONT}`, color: MUTED, marginTop: 8 }}>{label}</div>
      </div>
    );
  };
  return (
    <>
      <Headline lines={C.stats} at={0.1} out={len('stats') - 0.4} top={216} size={86} />
      <div style={{ position: 'absolute', left: 56, right: 56, top: 640, display: 'flex', gap: 22, opacity: 1 - ex, filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none' }}>
        {tile(0.3, 89, C.views, INK, 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z')}
        {tile(0.42, 10, C.taps, RED, 'M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z')}
        {tile(0.54, 1, C.saves, INK, 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z')}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1010, textAlign: 'center', font: `700 34px ${FONT}`, color: INK, opacity: lerp(f, sec(0.8), sec(1.2), 0, 1) * (1 - ex) }}>{C.statCar}</div>
      <Fine text={C.fine.real} top={1530} />
    </>
  );
};

// ---------- 05 Sales coach: the app's own rules on premiummotors' real numbers (read 2026-11-03) ----------
// carNextStep + CarNextStep are the app's code; the inputs are what the database held that day
// (listed 29 Oct, photo counts, 30-day views, last 7 days by day). No AI anywhere in it.
const COACH_NOW = new Date('2026-11-03T12:00:00+08:00');
const COACH_CARS = [
  { img: 'photos/defender-90-2023.jpg', car: { status: 'available', created_at: '2026-10-29T00:00:00+08:00', images: Array(23).fill('p'), selling_price: 270000, year: 2023, brand: 'Land Rover', model: 'Defender', variant: '90' }, stats: { views: 4, enquiries: 0, daily: [0, 0, 3, 1, 0, 0, 0] } },
  { img: 'photos/civic-fl5-2025.jpg', car: { status: 'available', created_at: '2026-10-29T00:00:00+08:00', images: Array(9).fill('p'), selling_price: 250000, year: 2025, brand: 'Honda', model: 'Civic', variant: 'FL5 Type R' }, stats: { views: 23, enquiries: 0, daily: [0, 0, 0, 1, 0, 22, 0] } },
  { img: null, car: { status: 'available', created_at: '2026-10-29T00:00:00+08:00', images: [], selling_price: 252000, year: 2023, brand: 'Toyota', model: 'Alphard', variant: '2.5 Z' }, stats: { views: 1, enquiries: 0, daily: [0, 0, 0, 1, 0, 0, 0] } },
];
const COACH_COLORS = { soft: '#F4F4F5', text: INK, sub: '#52525B', accent: RED, onAccent: '#FFFFFF', line: 'rgba(11,12,15,0.2)' };
const ROW_TOP = 470, ROW_H = 300, ROW_GAP = 22, K = 2.75, PH = 100;   // K: the app's 12.5px line, scaled for a phone screen

export const Coach = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const TAP = 2.3;
  const tapAt = { x: 860, y: ROW_TOP + 22 + PH + 12 + 70 };      // the Defender's red button
  const cur = interpolate(t, [1.5, TAP - 0.05], [0, 1], { ...clamp, easing: ease });
  const since = t - TAP;
  return (
    <>
      <Headline lines={C.coach} at={0.1} out={len('coach') - 0.4} top={216} />
      {COACH_CARS.map(({ img, car, stats }, i) => {
        const step = carNextStep(car, stats, {}, COACH_NOW);
        const p = pop(f, 0.15 + i * 0.3);
        return (
          <div key={i} style={{ position: 'absolute', left: 60, right: 60, top: ROW_TOP + i * (ROW_H + ROW_GAP), height: ROW_H, ...glass({ borderRadius: 30 }), padding: 22,
            opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 90}px) scale(${0.96 + 0.04 * Math.min(1, p)})` }}>
            <div style={{ display: 'flex', gap: 22, alignItems: 'center', height: PH }}>
              {img ? <Img src={staticFile(img)} style={{ width: 134, height: PH, objectFit: 'cover', borderRadius: 18, flex: 'none' }} />
                : <div style={{ width: 134, height: PH, borderRadius: 18, flex: 'none', background: '#EDEDEF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" c="#A1A1AA" s={44} /></div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `700 32px/1.15 ${FONT}`, color: INK }}>{car.year} {car.brand} {car.model}</div>
                <div style={{ font: `500 26px ${FONT}`, color: MUTED, marginTop: 6 }}>{car.variant} · RM {car.selling_price.toLocaleString('en-MY')}</div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 22, top: 22 + PH + 12, width: (1080 - 120 - 44) / K, transformOrigin: '0 0', transform: `scale(${K})`, fontFamily: FONT }}>
              <div style={{ transform: i === 0 && since >= 0 && since < 0.16 ? 'scale(0.98)' : 'none' }}>
                <CarNextStep step={step} car={car} lang={lang} colors={COACH_COLORS} onAction={() => {}} />
              </div>
            </div>
          </div>
        );
      })}
      {/* a finger-tap on the Defender's button: the coach says what to do, the seller does it */}
      {since > -0.9 && (
        <>
          {since >= 0 && since < 0.5 && <div style={{ position: 'absolute', left: tapAt.x - 50, top: tapAt.y - 50, width: 100, height: 100, borderRadius: 50, border: `5px solid ${RED}`, opacity: 1 - since / 0.5, transform: `scale(${0.3 + since / 0.5 * 1.1})` }} />}
          <svg width="44" height="44" viewBox="0 0 24 24" style={{ position: 'absolute', left: 980 + (tapAt.x - 980) * cur - 6, top: 1300 + (tapAt.y - 1300) * cur - 4, transform: `scale(${since >= 0 && since < 0.12 ? 0.82 : 1})`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.25))' }}>
            <path d="M4 2l15 11-7 1-3 7z" fill="#0B0C0F" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </>
      )}
      <Fine text={C.fine.coach} top={1530} />
    </>
  );
};

// ---------- 05 Studio: the app's own AI cut-out of the seller's GR86 photo ----------
export const Studio = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const ex = exitOf(f, 'studio');
  const inP = pop(f, 0.1);
  const scan = interpolate(t, [1.0, 2.2], [0, 1], { ...clamp, easing: easeIO });
  const lift = interpolate(t, [2.2, 2.8], [0, 1], { ...clamp, easing: ease });
  const tpl = (at) => pop(f, at);
  // the window (a 9:16-ish Studio canvas) and the car's box inside it: photo and cut-out share
  // the SAME box, so the scan reveals the cut-out exactly where the photo was
  const W0 = 680, H0 = 900, CX = 60, CY = 230, CW = 560, CH = 420;
  return (
    <>
      <Headline lines={C.studio} at={0.1} out={len('studio') - 0.4} top={216} />
      <div style={{ position: 'absolute', left: (1080 - W0) / 2, top: 450, width: W0, height: H0, borderRadius: 40, overflow: 'hidden', opacity: Math.min(1, inP * 1.4) * (1 - ex), filter: ex > 0.05 ? `blur(${ex * 10}px)` : 'none',
        transform: `translateY(${(1 - inP) * 140}px) scale(${0.94 + 0.06 * Math.min(1, inP)})`, boxShadow: '0 60px 120px rgba(11,12,15,.28), 0 0 0 1px rgba(11,12,15,.06)' }}>
        {/* backdrop: red studio sweep + floor, lit once the car lands */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 70% at 50% 35%, #3a0d0d 0%, #160606 55%, #070303 100%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: CY + CH - 40, bottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.6))' }} />
        <div style={{ position: 'absolute', left: 140, top: -40, width: 400, height: CY + CH, background: 'linear-gradient(180deg, rgba(255,255,255,.16), transparent)', clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)', opacity: lift }} />
        {/* the seller's photo, wiped top to bottom */}
        <Img src={staticFile('photos/gr86-2025.jpg')} style={{ position: 'absolute', left: CX, top: CY, width: CW, height: CH, objectFit: 'cover', borderRadius: 18, clipPath: `inset(${scan * 100}% 0 0 0 round 18px)` }} />
        {/* the cut-out (real model output) + contact shadow */}
        <div style={{ position: 'absolute', left: CX + 30, width: CW - 60, top: CY + CH - 46, height: 40, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.85), transparent)', opacity: lift }} />
        <Img src={staticFile('real/gr86-cutout.png')} style={{ position: 'absolute', left: CX, top: CY - lift * 24, width: CW, height: CH, objectFit: 'contain', clipPath: `inset(0 0 ${(1 - scan) * 100}% 0)`, filter: 'drop-shadow(0 24px 24px rgba(11,12,15,0.21))' }} />
        {scan > 0 && scan < 1 && <div style={{ position: 'absolute', left: CX, width: CW, top: CY + scan * CH - 3, height: 6, background: '#fff', boxShadow: `0 0 30px 10px ${RED2}` }} />}
        {/* template words */}
        <div style={{ position: 'absolute', left: 44, top: 50, opacity: Math.min(1, tpl(3.2) * 1.4), transform: `translateY(${(1 - tpl(3.2)) * -40}px)` }}>
          <div style={{ display: 'inline-block', background: RED, color: '#fff', font: `700 24px ${FONT}`, padding: '8px 16px', borderRadius: 10 }}>TOYOTA GR86</div>
          <div style={{ font: `700 54px/1 ${FONT}`, color: '#FFFFFF', marginTop: 14, letterSpacing: -2 }}>2.4L RZ · 2025</div>
        </div>
        {/* the monthly is the presenter's own figure: 10% deposit, 7 years, 6.5% EIR */}
        <div style={{ position: 'absolute', left: 36, right: 36, top: 690, ...glass({ borderRadius: 28 }), padding: '22px 28px', opacity: Math.min(1, tpl(3.45) * 1.4), transform: `translateY(${(1 - tpl(3.45)) * 100}px)` }}>
          <div style={{ font: `500 24px ${FONT}`, color: MUTED }}>{lang === 'en' ? 'From' : 'Dari'}</div>
          <div style={{ font: `700 92px/1 ${FONT}`, color: RED, letterSpacing: -3, whiteSpace: 'nowrap' }}>RM 2,417<span style={{ font: `700 30px ${FONT}`, color: MUTED, letterSpacing: 0 }}>{lang === 'en' ? ' /month' : ' /bulan'}</span></div>
          <div style={{ font: `700 24px ${FONT}`, color: INK, marginTop: 8 }}>{lang === 'en' ? '10% deposit · 7 years' : 'Deposit 10% · 7 tahun'}</div>
        </div>
      </div>
      {/* the two Studio buttons that did it, on their own row under the window */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1386, display: 'flex', justifyContent: 'center', gap: 24, opacity: 1 - ex }}>
        {[[0.7, 1.0, C.removeBg, 'M4 20L20 4M8 4h12v12'], [2.3, 2.6, C.backdrop, 'M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6']].map(([a, press, label, d], i) => {
          const p = pop(f, a); const down = t >= press && t < press + 0.18;
          return (
            <div key={i} style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 50}px) scale(${down ? 0.92 : 1})` }}>
              <Chip style={t >= press ? { background: INK, color: '#FFFFFF', border: 'none' } : {}}><Icon d={d} s={26} c={t >= press ? '#FFFFFF' : INK} />{label}</Chip>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ---------- 06 Posters: the real loan poster + the real moving poster ----------
export const Posters = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const ex = exitOf(f, 'posters');
  const a = pop(f, 0.1), b = pop(f, 0.5);
  return (
    <>
      <Headline lines={C.posters} at={0.1} out={len('posters') - 0.4} top={216} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ex, filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none' }}>
        <div style={{ position: 'absolute', left: 50, top: 560, width: 520, transform: `translateX(${(1 - a) * -500}px) rotate(${-5 + (1 - Math.min(1, a)) * -8}deg)` }}>
          <Img src={staticFile(`real/loan-poster-${lang}.jpg`)} style={{ width: 520, borderRadius: 26, boxShadow: '0 70px 140px rgba(11,12,15,0.26), 0 0 0 1px rgba(11,12,15,.06), 0 0 90px rgba(220,38,38,.2)' }} />
          <div style={{ marginTop: 26 }}><Chip>{C.jpeg}</Chip></div>
        </div>
        <div style={{ position: 'absolute', left: 600, top: 500, width: 430, transform: `translateX(${(1 - b) * 520}px) rotate(${4 + (1 - Math.min(1, b)) * 8}deg)` }}>
          <div style={{ width: 430, height: 764, borderRadius: 54, padding: 14, background: '#0b0c0f', boxShadow: '0 70px 140px rgba(11,12,15,0.26), 0 0 0 1px rgba(11,12,15,.06), 0 0 90px rgba(220,38,38,.25)' }}>
            <div style={{ width: 402, height: 736, borderRadius: 42, overflow: 'hidden', background: '#000' }}>
              <OffthreadVideo src={staticFile(`real/motion-${lang}.mp4`)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <div style={{ marginTop: 26 }}><Chip style={{ background: INK, color: '#FFFFFF', border: 'none' }}>▶ {C.mp4}</Chip></div>
        </div>
      </div>
      <Fine text={C.fine.real} top={1560} />
    </>
  );
};

// ---------- 07 Mini page: premiummotors, the seller's own page, real photos ----------
const URL = 'drevo.my/s/premiummotors';
export const PagePhone = ({ t, lang, scroll = 0, typed = URL.length }) => {
  const C = COPY[lang];
  const s = URL.slice(0, typed);
  return (
    <div style={{ width: 560, height: 1060, borderRadius: 64, padding: 16, background: '#0b0c0f', boxShadow: '0 90px 160px rgba(11,12,15,0.26), 0 0 0 1px rgba(11,12,15,.06), 0 0 120px rgba(37,99,235,.25)' }}>
      <div style={{ position: 'relative', width: 528, height: 1028, borderRadius: 50, overflow: 'hidden', background: '#EEF2FD', fontFamily: FONT }}>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 16, height: 60, borderRadius: 30, background: '#E2E8F7', zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', font: `500 25px ${FONT}`, color: '#33363d', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(30,41,90,.12)' }}>
          <Icon d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" c="#33363d" s={22} />
          <span>{s.slice(0, 11)}<b style={{ color: '#0B0C0F' }}>{s.slice(11)}</b></span>
          {typed < URL.length && <span style={{ width: 3, height: 30, background: '#2563EB', opacity: Math.floor(t * 4) % 2 ? 1 : 0.2 }} />}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 92 - scroll }}>
          <div style={{ height: 220, background: 'linear-gradient(120deg,#2563EB,#4338CA)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,.3), transparent 45%)' }} />
          </div>
          <div style={{ position: 'absolute', left: 28, top: 150, width: 134, height: 134, borderRadius: 67, padding: 6, background: 'linear-gradient(135deg,#2563EB,#4338CA)', boxShadow: '0 12px 30px rgba(37,99,235,.35)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '5px solid #EEF2FD', background: 'linear-gradient(135deg,#1E293B,#334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 54px ${FONT}`, color: '#fff' }}>A</div>
          </div>
          <div style={{ padding: '80px 28px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: `700 42px ${FONT}`, color: '#0B0C0F' }}>Auzyvyth
              <svg width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2563EB" /><path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2.6" fill="none" /></svg></div>
            <div style={{ font: `500 22px ${FONT}`, color: '#4B5563', marginTop: 4 }}>{C.role}</div>
            <div style={{ font: `500 22px/1.35 ${FONT}`, color: '#1F2937', marginTop: 12 }}>{C.bio}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>{[C.carsN, C.verified].map((x) => <span key={x} style={{ font: `700 19px ${FONT}`, background: '#fff', padding: '8px 14px', borderRadius: 999, color: '#1E3A8A' }}>{x}</span>)}</div>
            <div style={{ height: 70, marginTop: 18, borderRadius: 20, background: 'linear-gradient(180deg,#3B82F6,#2563EB)', boxShadow: '0 3px 0 #1E40AF, 0 12px 26px rgba(37,99,235,.35)', color: '#fff', font: `700 26px ${FONT}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" c="#fff" s={28} />WhatsApp</div>
            <div style={{ font: `700 28px ${FONT}`, color: '#0B0C0F', marginTop: 28 }}>{C.myCars}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              {CARS.map((c) => (
                <div key={c.img} style={{ borderRadius: 20, background: '#fff', overflow: 'hidden', boxShadow: '0 8px 20px rgba(30,41,90,.10)' }}>
                  <Img src={staticFile(c.img)} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '12px 14px', font: `700 20px/1.2 ${FONT}`, color: '#0B0C0F' }}>{c.name}<div style={{ font: `500 16px ${FONT}`, color: '#6B6F78' }}>{c.v}</div><div style={{ color: '#1d4ed8', marginTop: 6 }}>{c.price}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Page = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const inP = pop(f, 0.05);
  const typed = Math.floor(interpolate(t, [0.25, 1.45], [0, URL.length], clamp));
  const z = interpolate(t, [0, 1.8, 2.5], [1.75, 1.75, 1], { ...clamp, easing: easeIO });
  const scroll = interpolate(t, [3.1, 5.0], [0, 700], { ...clamp, easing: easeIO });
  const ex = exitOf(f, 'page');
  return (
    <>
      <Headline lines={C.page} at={0.1} out={len('page') - 0.4} top={216} />
      <div style={{ position: 'absolute', left: 260, top: 470, transformOrigin: '280px 46px', opacity: Math.min(1, inP * 1.4) * (1 - ex), filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none',
        transform: `translateY(${(1 - inP) * 200}px) scale(${z})` }}>
        <PagePhone t={t} lang={lang} scroll={scroll} typed={typed} />
      </div>
    </>
  );
};

// ---------- 08 Phone & laptop ----------
export const Devices = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const a = pop(f, 0.05), b = pop(f, 0.25);
  const ex = exitOf(f, 'devices');
  return (
    <>
      <Headline lines={C.devices} at={0.05} out={len('devices') - 0.35} top={216} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ex, filter: (ex * 12) > 0.05 ? `blur(${ex * 12}px)` : 'none', transform: `translateY(${-ex * 80}px)` }}>
        <div style={{ position: 'absolute', left: 30, top: 640, transform: `translateX(${(1 - a) * -500}px)` }}>
          <div style={{ width: 700, height: 470, borderRadius: '26px 26px 8px 8px', padding: 16, background: '#0b0c0f', boxShadow: '0 70px 140px rgba(11,12,15,0.26), 0 0 0 1px rgba(11,12,15,.06), 0 0 100px rgba(220,38,38,.25)' }}>
            <div style={{ width: 668, height: 438, borderRadius: 10, overflow: 'hidden', background: '#f4f4f5', display: 'flex', justifyContent: 'center' }}>
              <Freeze frame={sec(8.6)}><OffthreadVideo src={staticFile(`takes/calc-${lang}.mp4`)} muted style={{ height: '100%' }} /></Freeze>
            </div>
          </div>
          <div style={{ width: 780, height: 30, marginLeft: -40, borderRadius: '6px 6px 30px 30px', background: 'linear-gradient(180deg,#3f3f46,#18181b)', boxShadow: '0 30px 60px rgba(11,12,15,0.21)' }} />
        </div>
        <div style={{ position: 'absolute', left: 690, top: 700, transformOrigin: '0 0', transform: `translateX(${(1 - b) * 500}px) scale(0.6)` }}>
          <PagePhone t={9} lang={lang} />
        </div>
      </div>
    </>
  );
};

// ---------- CTA ----------
export const Cta = ({ lang, copy }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = { ...COPY[lang], ...copy };
  const item = (at, style, children) => { const p = pop(f, at); return <div style={{ position: 'absolute', left: 60, right: 60, textAlign: 'center', opacity: Math.min(1, p * 1.4), filter: ((1 - Math.min(1, p)) * 14) > 0.05 ? `blur(${(1 - Math.min(1, p)) * 14}px)` : 'none', transform: `translateY(${(1 - p) * 70}px)`, ...style }}>{children}</div>; };
  const pulse = t > 2.2 ? 1 + 0.03 * Math.sin((t - 2.2) * Math.PI * 2) : 1;
  const flash = interpolate(t, [0, 0.35], [0.55, 0], clamp);
  return (
    <>
      {item(0.05, { top: 520, font: `700 132px/1 ${FONT}`, letterSpacing: -6, color: INK }, C.cta1)}
      {item(0.25, { top: 665, font: `700 116px/1 ${FONT}`, letterSpacing: -5, color: RED }, C.cta2)}
      {item(0.8, { top: 840, font: `500 38px/1.35 ${FONT}`, color: MUTED }, C.cta3)}
      {item(1.1, { top: 980 }, (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, height: 140, padding: '0 70px', borderRadius: 44, background: 'linear-gradient(180deg,#ef4444,#dc2626)', color: '#fff', font: `700 64px ${FONT}`, transform: `scale(${pulse})`,
          boxShadow: '0 4px 0 #991b1b, 0 0 90px rgba(220,38,38,.6), 0 40px 80px rgba(11,12,15,0.21), inset 0 1px 0 rgba(255,255,255,.35)' }}>
          drevo.my <Icon d="M5 12h14M13 6l6 6-6 6" c="#fff" s={52} />
        </div>
      ))}
      {item(1.5, { top: 1300, font: `700 38px ${FONT}`, color: '#FFFFFF' }, (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}><span style={{ width: 58, height: 58, borderRadius: 29, background: '#fff', color: '#0b0c0f', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `700 30px ${FONT}` }}>@</span>{C.tag}</span>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: RED, opacity: flash, pointerEvents: 'none' }} />
    </>
  );
};

// ---------- persistent offer pill ----------
export const OfferPill = ({ lang, t }) => {
  const on = interpolate(t, [4.9, 5.3, TL.devices[1] - 0.01, TL.devices[1]], [0, 1, 1, 0], clamp);
  const hidePage = (t >= TL.page[0] && t < TL.page[1]) || (t >= TL.studio[0] && t < TL.studio[1]) ? 0 : 1;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1440, display: 'flex', justifyContent: 'center', opacity: on * hidePage, transform: `translateY(${(1 - on) * 40}px)` }}>
      <Chip style={{ height: 64, font: `700 27px ${FONT}`, background: INK, color: '#FFFFFF', border: 'none', boxShadow: '0 18px 40px rgba(80,0,0,.35)' }}><span style={{ width: 12, height: 12, borderRadius: 6, background: RED2 }} />{COPY[lang].pill}</Chip>
    </div>
  );
};
