// The renewals ad (briefs/renewals.md). Same theme, card and CTA as the main ad.
// App screens are the REAL Sold-tab components on sample buyers (harness/sold.jsx -> public/real/sold-*.png).
import React from 'react';
import { AbsoluteFill, Sequence, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { FPS, sec, pop, clamp, ease } from '../lib';
import { Ambient, Headline, Fine, glass, FONT, RED, INK, MUTED } from '../ui';
import { Card } from '../scenes/Card';
import { Cta } from '../scenes/Features';
import RECTS from './rects.json';
import EN from '../../../../../src/i18n/locales/en.json';
import MS from '../../../../../src/i18n/locales/ms.json';

// [name, start, length]; a chapter card covers the first CARD seconds of a scene marked true.
const CARD = 0.75;
export const R_TL = [
  ['hook', 0, 4.0, false],
  ['forget', 4.0, 3.0, false],
  ['dates', 7.0, 4.0, true],
  ['remind', 11.0, 4.5, true],
  ['next', 15.5, 3.5, true],
  ['cta', 19.0, 3.75, false],
];
export const R_DUR = 22.75;

const COPY = {
  ms: {
    hook: ['Cukai jalan pembeli', '*tamat minggu depan.*'],
    forget: ['Dia lupa.', '*Drevo ingat.*'],
    dates: ['Tick sekali.', '*Setahun diingatkan.*'],
    remind: ['Mesej dah siap.', '*Anda tekan hantar.*'],
    next: ['Setiap renewal,', '*satu sebab untuk mesej.*'],
    cards: { dates: ['Sekarang:', 'Tarikh isi sendiri', '01'], remind: ['Sekarang:', 'Satu tap', '02'], next: ['Tahun depan:', 'Tukar kereta', '03'] },
    noSticker: 'Tiada sticker cukai jalan sejak 2023', draft: 'Draf mesej', send: 'Hantar',
    fine: 'Contoh data. Notifikasi sebenar Drevo, 7 hari sebelum tamat.',
    fineSticker: 'JPJ: tiada sticker sejak Feb 2023, tiada slip bercetak sejak Feb 2026.',
    cta: { cta3: 'Harga pengasas RM35 sebulan untuk 10 SA pertama. Tak perlu kad kredit.' },
  },
  en: {
    hook: ["Your buyer's road tax", '*ends next week.*'],
    forget: ['They forgot.', "*Drevo didn't.*"],
    dates: ['Tick once.', "*We'll remind you.*"],
    remind: ['Message written.', '*You press send.*'],
    next: ['Every renewal,', '*a reason to reach out.*'],
    cards: { dates: ['Now:', 'Dates fill themselves', '01'], remind: ['Now:', 'One tap', '02'], next: ['Next year:', 'Trade-up', '03'] },
    noSticker: 'No road tax sticker since 2023', draft: 'Draft message', send: 'Send',
    fine: 'Sample data. Real Drevo notification, 7 days before expiry.',
    fineSticker: 'JPJ: no sticker since Feb 2023, no printed slip since Feb 2026.',
    cta: { cta3: 'Founding price RM35 a month for the first 10 SAs. No credit card needed.' },
  },
};

// The push exactly as supabase/functions/expiry-reminders writes it (English there, in both cuts).
const PUSH = { title: 'Road tax due in 7 days', body: 'Aiman Hakim · Honda City WXY 1234 · expires 10 Nov 2026. Send them a reminder.' };

// The Remind button's WhatsApp text, from the app's own strings (SoldCustomers.jsx remindText).
const draftText = (lang) => {
  const L = lang === 'ms' ? MS : EN;
  const s = L.salesmanPremium.sold;
  const vars = { who: 'Aiman', me: 'Aida', what: s.insurance.toLowerCase(), car: '2023 Honda City', date: '10 Nov 2026' };
  return s.waRenewDue.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]);
};

// A crop of a real screenshot (CSS px of the 390x844 capture, taken at 3x), shown `width` px wide.
const Shot = ({ view, lang, crop, width, radius = 22, children }) => {
  const k = width / crop.w;
  return (
    <div style={{ position: 'relative', width, height: crop.h * k, borderRadius: radius * k, overflow: 'hidden',
      boxShadow: '0 50px 110px rgba(11,12,15,0.30), 0 14px 30px rgba(11,12,15,0.18)' }}>
      <Img src={staticFile(`real/sold-${view}-${lang}.png`)} style={{ position: 'absolute', width: 390 * k, height: 844 * k, left: -crop.x * k, top: -crop.y * k }} />
      {children?.(k)}
    </div>
  );
};

const Rise = ({ at = 0, top, children }) => {
  const f = useCurrentFrame();
  const p = pop(f, at);
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 90}px) scale(${0.94 + 0.06 * Math.min(1, p)})` }}>{children}</div>;
};

// A red ring that draws attention to a real element in the crop.
const Ring = ({ r, crop, k, at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f / FPS, [at, at + 0.35], [0, 1], { ...clamp, easing: ease });
  const pad = 6;
  return <div style={{ position: 'absolute', left: (r.x - crop.x - pad) * k, top: (r.y - crop.y - pad) * k, width: (r.w + pad * 2) * k, height: (r.h + pad * 2) * k,
    borderRadius: 14 * k, border: `${5}px solid ${RED}`, opacity: p, transform: `scale(${1.25 - 0.25 * p})`, boxShadow: '0 0 40px rgba(220,38,38,.45)' }} />;
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

// ---------- scenes ----------
const Hook = ({ lang }) => {
  const C = COPY[lang];
  const f = useCurrentFrame();
  const drop = pop(f, 0.45, FPS, { damping: 15, stiffness: 170 });
  return (
    <>
      <Headline lines={C.hook} at={0.05} top={150} size={98} />
      {/* the phone's lock screen (the OS, drawn), standing on the floor */}
      <div style={{ position: 'absolute', left: 540 - 284, top: 450, padding: 14, borderRadius: 70, background: 'linear-gradient(160deg,#1b1d22,#0b0c0f)', boxShadow: '0 60px 120px rgba(11,12,15,0.3)' }}>
        <div style={{ position: 'relative', width: 540, height: 1120, borderRadius: 58, overflow: 'hidden', background: 'radial-gradient(120% 70% at 50% 0%, #FFFFFF 0%, #F4F4F5 55%, #E4E4E7 100%)', fontFamily: FONT, color: INK, textAlign: 'center' }}>
          <div style={{ marginTop: 70, font: `500 30px ${FONT}`, opacity: 0.8 }}>{lang === 'ms' ? 'Selasa, 3 November' : 'Tuesday, 3 November'}</div>
          <div style={{ font: `600 170px/1 ${FONT}`, letterSpacing: -6 }}>8:00</div>
          {[70, 540 - 70 - 92].map((x) => <div key={x} style={{ position: 'absolute', left: x, bottom: 70, width: 92, height: 92, borderRadius: 46, background: 'rgba(11,12,15,0.08)' }} />)}
          <div style={{ position: 'absolute', left: 200, right: 200, bottom: 24, height: 8, borderRadius: 4, background: 'rgba(11,12,15,0.55)' }} />
        </div>
      </div>
      {/* the notification: wider than the phone so it reads on a small screen */}
      <div style={{ position: 'absolute', left: 70, right: 70, top: 760, opacity: Math.min(1, drop * 1.5), transform: `translateY(${(1 - drop) * -140}px) scale(${0.92 + 0.08 * Math.min(1, drop)})` }}>
        <div style={{ ...glass({ borderRadius: 40, padding: '30px 34px' }), display: 'flex', gap: 26, alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, width: 88, height: 88, borderRadius: 22, background: 'linear-gradient(160deg,#ef4444,#dc2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 52px ${FONT}` }}>D</div>
          <div style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 26px ${FONT}`, color: MUTED }}><span>Drevo</span><span>{lang === 'ms' ? 'sekarang' : 'now'}</span></div>
            <div style={{ font: `700 44px/1.15 ${FONT}`, color: INK, marginTop: 6, letterSpacing: -1 }}>{PUSH.title}</div>
            <div style={{ font: `500 32px/1.3 ${FONT}`, color: 'rgba(11,12,15,0.72)', marginTop: 8 }}>{PUSH.body}</div>
          </div>
        </div>
      </div>
      <Fine text={C.fine} top={1640} />
    </>
  );
};

const Forget = ({ lang }) => {
  const C = COPY[lang];
  const r = RECTS[`coming-${lang}`].first;
  return (
    <>
      <Headline lines={C.forget} at={0.05} top={150} />
      {/* the empty windscreen corner where the sticker used to be */}
      <Rise at={0.3} top={430}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, font: `700 34px ${FONT}`, color: INK }}>
          <span style={{ width: 78, height: 78, borderRadius: 39, border: `5px dashed ${RED}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 52, height: 5, background: RED, transform: 'rotate(-45deg)', borderRadius: 3 }} />
          </span>
          {C.noSticker}
        </div>
      </Rise>
      <Rise at={0.55} top={600}><Shot view="coming" lang={lang} crop={r} width={940} /></Rise>
      <Fine text={C.fineSticker} top={1640} />
    </>
  );
};

const Dates = ({ lang }) => {
  const C = COPY[lang];
  const R = RECTS[`checklist-${lang}`];
  const crop = { x: 16, y: 16, w: 358, h: 272 };
  return (
    <>
      <Headline lines={C.dates} at={0.85} top={170} />
      <Rise at={0.2} top={470}>
        <Shot view="checklist" lang={lang} crop={crop} width={940}>
          {(k) => <Ring r={{ x: 36, y: R.date.y - 12, w: 318, h: 70 }} crop={crop} k={k} at={1.6} />}
        </Shot>
      </Rise>
      <Fine text={lang === 'ms' ? 'Contoh data. Senarai handover sebenar Drevo.' : 'Sample data. Real Drevo handover checklist.'} top={1640} />
    </>
  );
};

const Remind = ({ lang }) => {
  const C = COPY[lang];
  const R = RECTS[`renewals-${lang}`];
  const crop = R.aiman;
  const f = useCurrentFrame();
  const TAP = 2.0;
  const msg = pop(f, TAP + 0.25);
  return (
    <>
      <Headline lines={C.remind} at={0.85} top={170} />
      <Rise at={0.2} top={440}>
        <Shot view="renewals" lang={lang} crop={crop} width={900}>
          {(k) => <Tap r={R.remind} crop={crop} k={k} at={TAP} />}
        </Shot>
      </Rise>
      {/* the drafted message the button opens; the seller presses send */}
      <div style={{ position: 'absolute', left: 90, right: 90, top: 1150, opacity: Math.min(1, msg * 1.4), transform: `translateY(${(1 - msg) * 80}px)` }}>
        <div style={{ ...glass({ borderRadius: 36, padding: '26px 30px' }), fontFamily: FONT }}>
          <div style={{ font: `700 24px ${FONT}`, letterSpacing: 3, textTransform: 'uppercase', color: MUTED }}>{C.draft}</div>
          <div style={{ font: `500 33px/1.35 ${FONT}`, color: INK, marginTop: 10 }}>{draftText(lang)}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <span style={{ padding: '14px 34px', borderRadius: 999, background: INK, color: '#fff', font: `700 30px ${FONT}` }}>{C.send}</span>
          </div>
        </div>
      </div>
    </>
  );
};

const Next = ({ lang }) => {
  const C = COPY[lang];
  const R = RECTS[`trade-${lang}`];
  const crop = R.hafiz;
  return (
    <>
      <Headline lines={C.next} at={0.85} top={170} size={lang === 'ms' ? 88 : 96} />
      <Rise at={0.2} top={520}>
        <Shot view="trade" lang={lang} crop={crop} width={940}>
          {(k) => <Ring r={{ x: crop.x + 8, y: R.message.y - 8, w: crop.w - 16, h: R.message.h + 16 }} crop={crop} k={k} at={1.5} />}
        </Shot>
      </Rise>
      <Fine text={lang === 'ms' ? 'Contoh data.' : 'Sample data.'} top={1640} />
    </>
  );
};

const SCENES = { hook: Hook, forget: Forget, dates: Dates, remind: Remind, next: Next };

export const RenewalsAd = ({ lang = 'ms' }) => {
  const C = COPY[lang];
  return (
    <AbsoluteFill style={{ background: '#fff' }}>
      <Ambient />
      {R_TL.map(([k, at, len]) => {
        const S = SCENES[k];
        return (
          <Sequence key={k} from={sec(at)} durationInFrames={sec(len)}>
            {k === 'cta' ? <Cta lang={lang} copy={C.cta} /> : <S lang={lang} />}
          </Sequence>
        );
      })}
      {R_TL.filter((s) => s[3]).map(([k, at]) => (
        <Sequence key={`card-${k}`} from={sec(at)} durationInFrames={sec(CARD)}>
          <Card k={k} lang={lang} now={C.cards[k][0]} topic={C.cards[k][1]} num={C.cards[k][2]} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
