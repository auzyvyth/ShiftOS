import React from 'react';
import { useCurrentFrame, Img, OffthreadVideo, Freeze, staticFile, interpolate } from 'remotion';
import { COPY, TL, CARS, FPS, sec, lerp, pop, clamp, ease, easeIO } from '../lib';
import { Headline, Fine, Chip, glass, Device, FONT, RED, RED2, MINT, INK } from '../ui';

const HUES = ['#60a5fa', '#fbbf24', '#c084fc', '#34d399', '#fb923c', '#4ade80', '#6ee7b7'];
const len = (k) => TL[k][1] - TL[k][0];
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
      <Headline lines={C.leads} eyebrow={C.eb.leads} at={0.1} out={len('leads') - 0.4} top={170} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ex, filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none' }}>
        {/* stage rail: 7 lights, the reached ones glow */}
        <div style={{ position: 'absolute', left: 90, right: 90, top: 640, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, width: `${(st + Math.min(1, p) - 1 + 1) / 7 * 100}%`, background: `linear-gradient(90deg, ${RED}, ${HUES[st]})`, boxShadow: `0 0 30px ${HUES[st]}` }} />
          {HUES.map((h, i) => (
            <div key={i} style={{ position: 'absolute', left: `calc(${(i + 0.5) / 7 * 100}% - 15px)`, top: -9, width: 30, height: 30, borderRadius: 15, background: i <= st ? h : '#1a1c21', boxShadow: i <= st ? `0 0 24px ${h}` : 'none', border: '3px solid #050608' }} />
          ))}
        </div>
        {/* the stage pill morphs to each new stage */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 720, display: 'flex', justifyContent: 'center' }}>
          <div style={{ ...glass({ borderRadius: 999 }), height: 84, padding: '0 40px', display: 'flex', alignItems: 'center', gap: 18, font: `700 40px ${FONT}`, color: INK, transform: `scale(${0.85 + 0.15 * Math.min(1.1, p)})`, boxShadow: `0 0 70px ${HUES[st]}55, 0 40px 80px rgba(0,0,0,.6)` }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: HUES[st], boxShadow: `0 0 20px ${HUES[st]}` }} />
            <span style={{ filter: ((1 - Math.min(1, p)) * 8) > 0.05 ? `blur(${(1 - Math.min(1, p)) * 8}px)` : 'none' }}>{C.stages[st]}</span>
          </div>
        </div>
        {/* the buyer */}
        <div style={{ position: 'absolute', left: 110, right: 110, top: 860, height: 300, ...glass(), padding: 40, display: 'flex', gap: 30, alignItems: 'center', opacity: Math.min(1, cardIn * 1.5), transform: `translateY(${(1 - cardIn) * 120}px) rotate(${Math.sin(t * 1.4) * 0.6}deg)`, boxShadow: won ? `0 0 0 4px ${MINT}88, 0 0 90px ${MINT}55, 0 50px 120px rgba(0,0,0,.65)` : glass().boxShadow }}>
          <div style={{ width: 140, height: 140, borderRadius: 70, background: 'linear-gradient(135deg,#2a2e36,#16181d)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 64px ${FONT}`, color: INK, flex: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)' }}>H</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 54px ${FONT}`, color: INK }}>Hafiz</div>
            <div style={{ font: `500 30px ${FONT}`, color: 'rgba(255,255,255,.6)', marginTop: 6 }}>2025 Toyota GR86 2.4L RZ</div>
            <div style={{ font: `700 34px ${FONT}`, color: INK, marginTop: 12 }}>RM 175,000</div>
          </div>
          {won && <div style={{ position: 'absolute', right: 34, top: 34, width: 70, height: 70, borderRadius: 35, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(f, hop[6] + 0.1)})`, boxShadow: `0 0 40px ${MINT}` }}><Icon d="M5 12.5l4.5 4.5L19 7.5" c="#06120d" s={42} /></div>}
        </div>
        {/* what happened between: a call logged, a reminder set */}
        {[[1.9, 3.4, 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z', C.callLogged, ''],
          [2.4, 3.5, 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', C.reminderSet, C.tomorrow]].map(([a, b, d, label, sub], i) => {
          const o = toast(a, b);
          return (
            <div key={i} style={{ position: 'absolute', left: i ? 300 : 150, top: i ? 1290 : 1180, ...glass({ borderRadius: 28 }), padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 18, opacity: o, transform: `translateY(${(1 - o) * 40}px) scale(${0.9 + 0.1 * o})` }}>
              <div style={{ width: 58, height: 58, borderRadius: 18, background: i ? 'rgba(251,191,36,.15)' : 'rgba(110,231,183,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={d} c={i ? '#fbbf24' : MINT} /></div>
              <div><div style={{ font: `700 30px ${FONT}`, color: INK }}>{label}</div>{sub && <div style={{ font: `500 24px ${FONT}`, color: 'rgba(255,255,255,.6)' }}>{sub}</div>}</div>
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
      <div style={{ flex: 1, ...glass(), padding: '40px 36px', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 100}px)` }}>
        <Icon d={d} c={color} s={44} />
        <div style={{ font: `700 150px/1 ${FONT}`, letterSpacing: -6, color, marginTop: 14, textShadow: `0 0 50px ${color}55` }}>{Math.round(n * k)}</div>
        <div style={{ font: `500 34px ${FONT}`, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>{label}</div>
      </div>
    );
  };
  return (
    <>
      <Headline lines={C.stats} eyebrow={C.eb.stats} at={0.1} out={len('stats') - 0.4} top={170} />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 660, display: 'flex', gap: 30, opacity: 1 - ex, filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none' }}>
        {tile(0.3, 131, C.views, INK, 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z')}
        {tile(0.45, 13, C.taps, MINT, 'M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z')}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', font: `700 36px ${FONT}`, color: INK, opacity: lerp(f, sec(0.8), sec(1.2), 0, 1) * (1 - ex) }}>{C.statCar}</div>
      <Fine text={C.fine.real} top={1530} />
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
  const W0 = 700, H0 = 1000;
  return (
    <>
      <Headline lines={C.studio} eyebrow={C.eb.studio} at={0.1} out={len('studio') - 0.4} top={170} />
      <div style={{ position: 'absolute', left: (1080 - W0) / 2, top: 470, width: W0, height: H0, borderRadius: 40, overflow: 'hidden', opacity: Math.min(1, inP * 1.4) * (1 - ex), filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none',
        transform: `translateY(${(1 - inP) * 140}px) scale(${0.94 + 0.06 * Math.min(1, inP)})`, boxShadow: '0 80px 160px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.1), 0 0 120px rgba(220,38,38,.25)' }}>
        {/* backdrop that appears behind the cut-out: red studio sweep + floor */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 70% at 50% 35%, #3a0d0d 0%, #160606 55%, #070303 100%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 560, bottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.6))' }} />
        <div style={{ position: 'absolute', left: 150, top: -60, width: 400, height: 800, background: 'linear-gradient(180deg, rgba(255,255,255,.18), transparent)', clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)', opacity: lift }} />
        {/* the original photo, wiped away top to bottom by the scan */}
        <Img src={staticFile('photos/gr86-2025.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(${scan * 100}% 0 0 0)` }} />
        {/* the cut-out (real model output), with a contact shadow once it lands */}
        <div style={{ position: 'absolute', left: 60, right: 60, top: 590, height: 50, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.85), transparent)', opacity: lift, filter: 'blur(4px)' }} />
        <Img src={staticFile('real/gr86-cutout.png')} style={{ position: 'absolute', left: -110, top: 300 - lift * 40, width: 920, height: 690, objectFit: 'contain', clipPath: `inset(0 0 ${(1 - scan) * 100}% 0)`, filter: `drop-shadow(0 30px 30px rgba(0,0,0,.6))` }} />
        {scan > 0 && scan < 1 && <div style={{ position: 'absolute', left: 0, right: 0, top: `${scan * 100}%`, height: 6, background: '#fff', boxShadow: `0 0 30px 10px ${RED2}` }} />}
        {/* template words: the real monthly from the presenter take (10% deposit, 7 years, 6.5% EIR) */}
        <div style={{ position: 'absolute', left: 44, top: 60, opacity: Math.min(1, tpl(3.2) * 1.4), transform: `translateY(${(1 - tpl(3.2)) * -40}px)` }}>
          <div style={{ display: 'inline-block', background: RED, color: '#fff', font: `700 24px ${FONT}`, padding: '8px 16px', borderRadius: 10 }}>TOYOTA GR86</div>
          <div style={{ font: `700 58px/1 ${FONT}`, color: INK, marginTop: 14, letterSpacing: -2 }}>2.4L RZ · 2025</div>
        </div>
        <div style={{ position: 'absolute', left: 40, right: 40, top: 760, ...glass({ borderRadius: 30 }), padding: '26px 30px', opacity: Math.min(1, tpl(3.45) * 1.4), transform: `translateY(${(1 - tpl(3.45)) * 120}px)` }}>
          <div style={{ font: `500 26px ${FONT}`, color: 'rgba(255,255,255,.7)' }}>{lang === 'en' ? 'From' : 'Dari'}</div>
          <div style={{ font: `700 104px/1 ${FONT}`, color: RED2, letterSpacing: -4, textShadow: '0 0 40px rgba(239,68,68,.5)' }}>RM 2,417<span style={{ font: `700 34px ${FONT}`, color: 'rgba(255,255,255,.7)', letterSpacing: 0 }}>{lang === 'en' ? ' /month' : ' /bulan'}</span></div>
          <div style={{ font: `700 26px ${FONT}`, color: INK, marginTop: 8 }}>{lang === 'en' ? '10% deposit · 7 years' : 'Deposit 10% · 7 tahun'}</div>
        </div>
      </div>
      {/* the two Studio buttons that did it */}
      {[[0.7, 1.0, C.removeBg, 'M4 20L20 4M8 4h12v12'], [2.3, 2.6, C.backdrop, 'M3 3h18v18H3zM3 15l5-5 4 4 3-3 6 6']].map(([a, press, label, d], i) => {
        const p = pop(f, a); const down = t >= press && t < press + 0.18;
        return (
          <div key={i} style={{ position: 'absolute', top: 1500, left: i ? 560 : 160, opacity: Math.min(1, p * 1.4) * (1 - ex), transform: `translateY(${(1 - p) * 50}px) scale(${down ? 0.92 : 1})` }}>
            <Chip style={t >= press ? { background: 'linear-gradient(180deg,#ef4444,#dc2626)', border: 'none', boxShadow: '0 0 40px rgba(220,38,38,.6)' } : {}}><Icon d={d} s={26} />{label}</Chip>
          </div>
        );
      })}
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
      <Headline lines={C.posters} eyebrow={C.eb.posters} at={0.1} out={len('posters') - 0.4} top={170} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ex, filter: (ex * 10) > 0.05 ? `blur(${ex * 10}px)` : 'none' }}>
        <div style={{ position: 'absolute', left: 50, top: 560, width: 520, transform: `translateX(${(1 - a) * -500}px) rotate(${-5 + (1 - Math.min(1, a)) * -8}deg)` }}>
          <Img src={staticFile(`real/loan-poster-${lang}.jpg`)} style={{ width: 520, borderRadius: 26, boxShadow: '0 70px 140px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.1), 0 0 90px rgba(220,38,38,.2)' }} />
          <div style={{ marginTop: 26 }}><Chip>{C.jpeg}</Chip></div>
        </div>
        <div style={{ position: 'absolute', left: 600, top: 500, width: 430, transform: `translateX(${(1 - b) * 520}px) rotate(${4 + (1 - Math.min(1, b)) * 8}deg)` }}>
          <div style={{ width: 430, height: 764, borderRadius: 54, padding: 14, background: '#0b0c0f', boxShadow: '0 70px 140px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.1), 0 0 90px rgba(220,38,38,.25)' }}>
            <div style={{ width: 402, height: 736, borderRadius: 42, overflow: 'hidden', background: '#000' }}>
              <OffthreadVideo src={staticFile(`real/motion-${lang}.mp4`)} startFrom={sec(2.0)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <div style={{ marginTop: 26 }}><Chip style={{ background: 'linear-gradient(180deg,#ef4444,#dc2626)', border: 'none' }}>▶ {C.mp4}</Chip></div>
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
    <div style={{ width: 560, height: 1060, borderRadius: 64, padding: 16, background: '#0b0c0f', boxShadow: '0 90px 160px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.1), 0 0 120px rgba(37,99,235,.25)' }}>
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
      <Headline lines={C.page} eyebrow={C.eb.page} at={0.1} out={len('page') - 0.4} top={170} />
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
      <Headline lines={C.devices} eyebrow={C.eb.devices} at={0.05} out={len('devices') - 0.35} top={170} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ex, filter: (ex * 12) > 0.05 ? `blur(${ex * 12}px)` : 'none', transform: `translateY(${-ex * 80}px)` }}>
        <div style={{ position: 'absolute', left: 30, top: 640, transform: `translateX(${(1 - a) * -500}px)` }}>
          <div style={{ width: 700, height: 470, borderRadius: '26px 26px 8px 8px', padding: 16, background: '#0b0c0f', boxShadow: '0 70px 140px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.1), 0 0 100px rgba(220,38,38,.25)' }}>
            <div style={{ width: 668, height: 438, borderRadius: 10, overflow: 'hidden', background: '#f4f4f5', display: 'flex', justifyContent: 'center' }}>
              <Freeze frame={sec(8.6)}><OffthreadVideo src={staticFile(`takes/calc-${lang}.mp4`)} muted style={{ height: '100%' }} /></Freeze>
            </div>
          </div>
          <div style={{ width: 780, height: 30, marginLeft: -40, borderRadius: '6px 6px 30px 30px', background: 'linear-gradient(180deg,#3f3f46,#18181b)', boxShadow: '0 30px 60px rgba(0,0,0,.6)' }} />
        </div>
        <div style={{ position: 'absolute', left: 690, top: 700, transformOrigin: '0 0', transform: `translateX(${(1 - b) * 500}px) scale(0.6)` }}>
          <PagePhone t={9} lang={lang} />
        </div>
      </div>
    </>
  );
};

// ---------- CTA ----------
export const Cta = ({ lang }) => {
  const f = useCurrentFrame(); const t = f / FPS; const C = COPY[lang];
  const item = (at, style, children) => { const p = pop(f, at); return <div style={{ position: 'absolute', left: 60, right: 60, textAlign: 'center', opacity: Math.min(1, p * 1.4), filter: ((1 - Math.min(1, p)) * 14) > 0.05 ? `blur(${(1 - Math.min(1, p)) * 14}px)` : 'none', transform: `translateY(${(1 - p) * 70}px)`, ...style }}>{children}</div>; };
  const pulse = t > 2.2 ? 1 + 0.03 * Math.sin((t - 2.2) * Math.PI * 2) : 1;
  const flash = interpolate(t, [0, 0.35], [0.55, 0], clamp);
  return (
    <>
      {item(0.05, { top: 520, font: `700 132px/1 ${FONT}`, letterSpacing: -6, color: INK }, C.cta1)}
      {item(0.25, { top: 665, font: `700 116px/1 ${FONT}`, letterSpacing: -5, color: RED2, textShadow: '0 0 60px rgba(239,68,68,.6)' }, C.cta2)}
      {item(0.8, { top: 840, font: `500 38px/1.35 ${FONT}`, color: 'rgba(255,255,255,.75)' }, C.cta3)}
      {item(1.1, { top: 980 }, (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, height: 140, padding: '0 70px', borderRadius: 44, background: 'linear-gradient(180deg,#ef4444,#dc2626)', color: '#fff', font: `700 64px ${FONT}`, transform: `scale(${pulse})`,
          boxShadow: '0 4px 0 #991b1b, 0 0 90px rgba(220,38,38,.6), 0 40px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.35)' }}>
          drevo.my <Icon d="M5 12h14M13 6l6 6-6 6" c="#fff" s={52} />
        </div>
      ))}
      {item(1.5, { top: 1190, font: `700 38px ${FONT}`, color: INK }, (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}><span style={{ width: 58, height: 58, borderRadius: 29, background: '#fff', color: '#0b0c0f', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `700 30px ${FONT}` }}>@</span>{C.tag}</span>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash, pointerEvents: 'none' }} />
    </>
  );
};

// ---------- persistent offer pill ----------
export const OfferPill = ({ lang, t }) => {
  const on = interpolate(t, [4.9, 5.3, TL.devices[1] - 0.3, TL.devices[1]], [0, 1, 1, 0], clamp);
  const hidePage = t > TL.page[0] && t < TL.page[1] - 0.2 ? 0 : 1;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1440, display: 'flex', justifyContent: 'center', opacity: on * hidePage, transform: `translateY(${(1 - on) * 40}px)` }}>
      <Chip style={{ height: 64, font: `700 27px ${FONT}` }}><span style={{ width: 12, height: 12, borderRadius: 6, background: RED2, boxShadow: `0 0 14px ${RED2}` }} />{COPY[lang].pill}</Chip>
    </div>
  );
};
