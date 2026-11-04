// Scenes 1-3: the hook (Excel vs the REAL Drevo Live presenter), the calculator, the budget tab.
// The presenter is a screen recording of src/components/live/LivePresenter.jsx (harness/record.cjs),
// shown whole: nothing about it is redrawn.
import React from 'react';
import { useCurrentFrame, OffthreadVideo, Freeze, staticFile, interpolate } from 'remotion';
import { COPY, LEN, FPS, sec, lerp, easeIO, clamp } from '../lib';
import { Device, Cursor, Headline, Fine, Chip, FONT, RED, RED2, INK } from '../ui';
import calcMs from '../calc-ms.clicks.json';
import calcEn from '../calc-en.clicks.json';
import budMs from '../budget-ms.clicks.json';
import budEn from '../budget-en.clicks.json';

const RATIO = 1124 / 1000;           // the presenter's desktop stage, as recorded
const TAKE_LEN = 9.0;

// A take that plays from `from` (take seconds) at `rate`, then holds its last frame.
const Take = ({ src, takeT }) => {
  const last = sec(TAKE_LEN) - 1;
  const fr = Math.min(last, Math.max(0, Math.round(takeT * FPS)));
  return (
    <Freeze frame={fr}>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </Freeze>
  );
};

// ---------- the Excel sheet SAs run their lives on (a recreation, same GR86, flat rate) ----------
const Excel = ({ t, lang }) => {
  const typed = ['', '1', '17', '175', '1,750', '17,500'][[1.0, 1.3, 1.6, 1.9, 2.2].filter((k) => t >= k).length];
  const ok = t >= 2.7;
  const row = (label, value, opts = {}) => (
    <div style={{ display: 'flex', height: 32.5, alignItems: 'center', borderBottom: '1px solid #d9d9d9', background: opts.sel ? '#E8F2EC' : opts.bg || '#fff', outline: opts.sel ? '3px solid #1D6F42' : 'none', outlineOffset: -3 }}>
      <div style={{ width: 430, paddingLeft: 14, font: '700 19px Arial, sans-serif', color: '#222' }}>{label}</div>
      <div style={{ flex: 1, textAlign: 'right', paddingRight: 16, font: '700 20px Arial, sans-serif', color: opts.err ? '#B91C1C' : '#111' }}>{value}</div>
    </div>
  );
  const val = (s) => (ok ? s : '#VALUE!');
  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', overflow: 'hidden' }}>
      <div style={{ height: 40, background: '#1D6F42', color: '#fff', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', font: '500 18px Arial, sans-serif' }}>
        <span style={{ width: 20, height: 20, borderRadius: 4, background: '#fff', color: '#1D6F42', font: '700 14px Arial', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</span>
        GR86_KALKULATOR_FINAL(2).xlsx - Excel
      </div>
      <div style={{ height: 40, background: '#F3F3F3', borderBottom: '1px solid #d6d6d6', display: 'flex', alignItems: 'center', gap: 22, padding: '0 16px', font: '500 17px Arial', color: '#444' }}>
        {(lang === 'en' ? ['File', 'Home', 'Insert', 'Formulas', 'Data', 'View'] : ['Fail', 'Laman Utama', 'Sisip', 'Formula', 'Data', 'Paparan']).map((x, i) => <span key={i} style={i === 1 ? { color: '#1D6F42', fontWeight: 700, borderBottom: '3px solid #1D6F42', paddingBottom: 4 } : {}}>{x}</span>)}
      </div>
      <div style={{ height: 30, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', borderBottom: '1px solid #d6d6d6', font: '500 16px Arial', color: '#333' }}>
        <span style={{ color: '#888' }}>B7</span><span style={{ color: '#888' }}>fx</span><span>=(B5-B6)*(1+B8*9)/108</span>
      </div>
      <div style={{ height: 44, background: '#1F3B73', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 24px Arial', letterSpacing: 1 }}>TOYOTA GR86 2.4L RZ</div>
      {row('ON THE ROAD PRICE', 'RM 175,000.00')}
      {row('INSURANCE', 'RM 5,300.00')}
      {row('REBATE', 'RM 0.00')}
      {row('DOWNPAYMENT', typed ? `${typed}${ok ? '.00' : '|'}` : '', { sel: t > 0.9 && t < 2.8 })}
      {row('LOAN AMOUNT', val('RM 162,800.00'), { err: !ok })}
      {row('INTEREST (FLAT)', '3.50%')}
      {row('MONTHLY · 9 YEARS', val('RM 1,982.24'), { bg: '#F59E0B', err: !ok })}
      {row('MONTHLY · 7 YEARS', val('RM 2,412.93'), { bg: '#FBBF24', err: !ok })}
      {row('MONTHLY · 5 YEARS', val('RM 3,188.17'), { bg: '#FCD34D', err: !ok })}
    </div>
  );
};

// `copy` overrides the hook's words for other ads (the intro ad asks the viewer's question).
export const HookCalc = ({ lang, copy }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const C = { ...COPY[lang], ...copy };
  const clicks = (lang === 'en' ? calcEn : calcMs).clicks;

  // Excel leaves: tips over, blurs and falls out of the light
  const xOut = interpolate(t, [3.95, 4.6], [0, 1], { ...clamp, easing: easeIO });
  // the presenter moves from the bottom half to centre stage
  const g = interpolate(t, [4.0, 4.9], [0, 1], { ...clamp, easing: easeIO });
  const w = 780 + (980 - 780) * g;
  const x = (1080 - (w + 28)) / 2;
  const y = 905 + (520 - 905) * g;
  const h = w / RATIO;
  // camera inside the screen: push towards the big monthly figure while the seller taps
  const z = interpolate(t, [5.3, 6.0, 8.2, 8.9], [1, 1.2, 1.2, 1], { ...clamp, easing: easeIO });
  const out = interpolate(t, [9.45, 9.8], [0, 1], clamp);
  const secs = Math.floor(Math.min(t, 3.9) * 8);
  return (
    <>
      <Headline lines={C.hook} eyebrow={C.eb.hook} at={0} out={4.3} instant top={78} size={88} />
      <Headline lines={C.calc} eyebrow={C.eb.calc} at={4.75} out={9.45} top={170} />
      {xOut < 1 && (
        <div style={{ position: 'absolute', left: 126, top: 352, width: 828, height: 486, padding: 14, borderRadius: 26, background: 'linear-gradient(160deg,#1b1d22,#0b0c0f)',
          boxShadow: '0 60px 120px rgba(11,12,15,0.28), 0 0 0 1px rgba(11,12,15,0.06)', opacity: 1 - xOut,
          transform: `translate(${-xOut * 320}px, ${xOut * 380}px) rotate(${-xOut * 18}deg) scale(${1 - 0.35 * xOut})`, filter: `blur(${xOut * 14}px) saturate(${1 - xOut * 0.8})` }}>
          <div style={{ width: 800, height: 458, borderRadius: 14, overflow: 'hidden' }}><Excel t={t} lang={lang} /></div>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, filter: (out * 10) > 0.05 ? `blur(${out * 10}px)` : 'none' }}>
        <Device x={x} y={y} w={w} ratio={RATIO} glow={0.6 + 0.6 * g}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 26%', transform: `scale(${z})` }}>
            <Take src={`takes/calc-${lang}.mp4`} takeT={t} />
            <Cursor clicks={clicks} takeT={t} w={w} h={h} />
          </div>
        </Device>
      </div>
      <div style={{ position: 'absolute', right: 150, top: 326, opacity: 1 - xOut, transform: `translateY(${-xOut * 20}px)` }}>
        <Chip style={{ height: 52, font: `700 22px ${FONT}` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B0C0F" strokeWidth="2.4"><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9 2h6" /></svg>
          {C.excel} · 0:{String(secs).padStart(2, '0')}
        </Chip>
      </div>
      <div style={{ position: 'absolute', right: 150, top: 878, opacity: 1 - interpolate(t, [3.95, 4.3], [0, 1], clamp) }}>
        <Chip style={{ height: 52, font: `700 22px ${FONT}`, background: RED, color: '#FFFFFF', border: 'none', boxShadow: '0 16px 36px rgba(220,38,38,.3)' }}>
          {C.drevo}{t > 2.4 ? ` · 2 tap · ${C.done}` : ''}
        </Chip>
      </div>
      {t > 4.8 && <Fine text={C.fine.calc} top={1530} />}
    </>
  );
};

export const Budget = ({ lang }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const C = COPY[lang];
  const clicks = (lang === 'en' ? budEn : budMs).clicks;
  const takeT = 0.3 + t * 1.3;
  const w = 980, x = (1080 - 1008) / 2, y = 520, h = w / RATIO;
  const inn = interpolate(t, [0, 0.4], [0, 1], { ...clamp, easing: easeIO });
  const len = LEN('budget') + 0.4;   // exit sits past the hard cut
  const out = interpolate(t, [len - 0.35, len], [0, 1], clamp);
  // push into the inputs while they're typed, pull out for the sorted lists
  const k = interpolate(t, [0.4, 0.9, 2.2, 2.6, 2.9, 3.4, 4.2, 4.7], [1, 1.22, 1.22, 1, 1, 1.22, 1.22, 1], { ...clamp, easing: easeIO });
  return (
    <>
      <Headline lines={C.budget} at={0.15} out={len - 0.4} top={216} />
      <div style={{ position: 'absolute', inset: 0, opacity: inn * (1 - out), filter: ((1 - inn) * 12 + out * 10) > 0.05 ? `blur(${(1 - inn) * 12 + out * 10}px)` : 'none', transform: `scale(${1.04 - 0.04 * inn})` }}>
        <Device x={x} y={y} w={w} ratio={RATIO} glow={1.2}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 8%', transform: `scale(${k})` }}>
            <Take src={`takes/budget-${lang}.mp4`} takeT={takeT} />
            <Cursor clicks={clicks} takeT={takeT} w={w} h={h} />
          </div>
        </Device>
      </div>
      <Fine text={C.fine.calc} top={1530} />
    </>
  );
};
