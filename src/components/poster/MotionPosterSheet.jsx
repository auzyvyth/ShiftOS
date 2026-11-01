// Moving poster sheet (IDEA-29, 2026-11-01). Premium only: opened from a car's
// ··· menu in Salesman Premium's Listings tab. Lite shows the row locked and
// sends the tap to the upgrade screen. Five designs play from the car's own
// photos; the numbers come from loanPosterNumbers(), the same as the loan
// poster. Download records the preview canvas itself while it plays once
// (MediaRecorder), so the file is the preview, frame for frame. MP4 where the
// browser can (Chrome 126+, Safari), else WebM with a warning: iPhone WhatsApp
// will not play WebM. A frame-exact WebCodecs MP4 export can replace this later.
//
// Portalled to document.body, body scroll locked, registered with
// useModalHistory (overlay rules 1, 2, 5).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { DEFAULT_EIR } from '../../utils/financing';
import { defaultDeposit, fmtRM, loanPosterNumbers, POSTER_COPY, POSTER_ERRORS, posterTitle } from '../../utils/loanPoster';
import { fetchDataUrl, loadImg } from '../../utils/posterImage';
import { useModalHistory } from '../../hooks/useModalHistory';
import { premiumDark as P } from '../../theme/tokens';
import { drawMotionFrame, MOTION_H, MOTION_W, TEMPLATE_LEN } from './motionPoster';

// The five designs. `tpl` is the renderer's key.
export const MOTION_DESIGNS = [
  { key: 'slide', label: 'Classic', note: 'Photo, title and the three monthly figures on one screen.' },
  { key: 'beats', label: 'Beats, tall photos', note: 'One fact per screen. The photo fills the screen, so use it with tall (portrait) photos.' },
  { key: 'wide', label: 'Beats, wide photos', note: 'One fact per screen. The photo shows whole in a band, never cut, so it suits wide photos.' },
  { key: 'stretch', label: 'Stretch', note: 'A light card. The photo sits across the middle, its edges stretched to fill. The words stay still; each photo zooms in slowly for 2.5 seconds, then the next one cuts in.' },
  { key: 'calc', label: 'Calculator', note: 'The deposit slides 0 to 30% and the monthly rolls down, then the years switch 9, 7, 5. Shows the take-home pay it fits, with the 35% rule.' },
];

const LANG_KEY = 'xd_poster_lang';
const readLang = () => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ms'; } catch { return 'ms'; } };
const num = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;
const titleCase = (s) => String(s || '').trim();
const MIMES = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
const pickMime = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) return null;
  return MIMES.find((m) => window.MediaRecorder.isTypeSupported(m)) || null;
};
const fileSafe = (s) => String(s || 'car').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'car';

export default function MotionPosterSheet({ car, seller, onClose }) {
  useModalHistory(true, onClose);
  const [design, setDesign] = useState(null); // picked once the photos load
  const [lang, setLang] = useState(readLang);
  const [price, setPrice] = useState(() => String(car?.selling_price || car?.price || ''));
  const [deposit, setDeposit] = useState(() => String(defaultDeposit(car?.selling_price || car?.price)));
  const [rate, setRate] = useState(String(DEFAULT_EIR));
  const [headline, setHeadline] = useState(() => POSTER_COPY[readLang()].kicker);
  const [offer, setOffer] = useState('');
  const [name, setName] = useState(() => String(seller?.full_name || '').trim());
  const [imgs, setImgs] = useState(null);
  const [startAt, setStartAt] = useState(() => performance.now());
  const [fontsReady, setFontsReady] = useState(false);
  const canvasRef = useRef(null);
  const [rec, setRec] = useState(null); // null | { left } while recording
  const [saved, setSaved] = useState(null); // { ext, mb, secs } | { error }
  const recRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* private mode */ } }, [lang]);

  // The car's own photos, up to 6. Then start on the Beats design that suits
  // their shape: tall photos -> full screen, wide photos -> band.
  useEffect(() => {
    let off = false;
    const urls = (Array.isArray(car?.images) ? car.images : []).slice(0, 6);
    Promise.all(urls.map((u) => fetchDataUrl(u).then(loadImg)))
      .then((list) => {
        if (off) return;
        const ok = list.filter(Boolean);
        setImgs(ok);
        const wide = ok.filter((i) => i.width > i.height * 1.1).length;
        setDesign((d) => d || (ok.length && wide <= ok.length / 2 ? 'beats' : 'wide'));
        setStartAt(performance.now());
      });
    return () => { off = true; };
  }, [car]);

  useEffect(() => {
    Promise.all([document.fonts.load("400 100px 'Bebas Neue'"), document.fonts.load("700 50px 'Outfit'")])
      .catch(() => {}).finally(() => setFontsReady(true));
  }, []);

  const numbers = useMemo(() => loanPosterNumbers({ price, deposit, rate, basis: 'eir' }), [price, deposit, rate]);
  const c = POSTER_COPY[lang];

  const frame = useMemo(() => {
    const P0 = num(price);
    const sweep = numbers.ok ? [0, 10, 20, 30].map((pct) => {
      const d = Math.round((P0 * pct) / 100 / 100) * 100;
      const r = loanPosterNumbers({ price: P0, deposit: d, rate, basis: 'eir' });
      return { pct, deposit: d, rows: r.ok ? r.rows : numbers.rows };
    }) : [];
    if (sweep.length) sweep.push({ pct: P0 ? (numbers.deposit / P0) * 100 : 0, deposit: numbers.deposit, rows: numbers.rows });
    const km = num(car?.mileage);
    const cond = c.cond[String(car?.condition || '').toLowerCase()] || '';
    const stretch = design === 'stretch';
    return {
      lang, headline, offer: offer.trim(), seller: name.trim(),
      title: `${car?.year || ''} ${posterTitle(car)}`.trim(),
      name: [car?.year, titleCase(car?.brand), titleCase(car?.model)].filter(Boolean).join(' '),
      variant: titleCase(car?.variant),
      tag: stretch ? cond : '',
      year: car?.year, make: posterTitle({ brand: car?.brand }), model: posterTitle({ model: car?.model, variant: car?.variant }),
      price: numbers.price, deposit: numbers.deposit,
      working: `${c.deposit} RM ${fmtRM(numbers.deposit)} · ${numbers.rate}% EIR`,
      rows: numbers.ok ? numbers.rows : [],
      sweep, ownIdx: 4,
      features: (stretch
        ? [km > 0 && `${fmtRM(km)} km`, car?.transmission, car?.state]
        : [km > 0 && `${fmtRM(km)} km`, car?.auction_grade && `${c.grade} ${car.auction_grade}`, car?.transmission, cond]
      ).filter(Boolean),
    };
  }, [lang, headline, offer, name, car, numbers, price, rate, c, design]);

  // Play loop.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !fontsReady || !design || !imgs) return undefined;
    let raf;
    const len = TEMPLATE_LEN[design] || 8;
    const tick = (now) => {
      const t = ((now - startAt) / 1000) % (len + 1);
      drawMotionFrame(ctx, Math.min(t, len), design, frame, imgs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [design, frame, imgs, startAt, fontsReady]);

  // Record the preview canvas while it plays once from the start, then save.
  const startDownload = () => {
    const canvas = canvasRef.current;
    const mime = pickMime();
    if (!canvas || !design || !imgs || rec) return;
    if (!mime || !canvas.captureStream) { setSaved({ error: 'This browser cannot save video. Try Chrome or Safari.' }); return; }
    const len = TEMPLATE_LEN[design] || 8;
    let recorder;
    try {
      recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    } catch { setSaved({ error: 'Could not start the recording on this browser.' }); return; }
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = () => {
      clearInterval(recRef.current?.timer);
      recRef.current = null;
      setRec(null);
      const type = mime.split(';')[0];
      const blob = new Blob(chunks, { type });
      if (!blob.size) { setSaved({ error: 'The recording came out empty. Keep this screen open while it records.' }); return; }
      const ext = type === 'video/mp4' ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${fileSafe(posterTitle(car))}-${design}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setSaved({ ext, mb: (blob.size / 1048576).toFixed(1), secs: len });
    };
    // Paint frame 0 before the first captured frame, then replay from the start.
    const ctx = canvas.getContext('2d');
    drawMotionFrame(ctx, 0, design, frame, imgs);
    setSaved(null);
    recorder.start(250);
    const t0 = performance.now();
    setStartAt(t0);
    const stopAt = (len + 0.4) * 1000; // the hold at the end is in the file
    const timer = setInterval(() => {
      const el = performance.now() - t0;
      if (el >= stopAt) { clearInterval(timer); if (recorder.state !== 'inactive') recorder.stop(); return; }
      setRec({ left: Math.ceil((stopAt - el) / 1000) });
    }, 200);
    recRef.current = { recorder, timer };
    setRec({ left: Math.ceil(stopAt / 1000) });
  };
  useEffect(() => () => {
    const r = recRef.current;
    if (r) { clearInterval(r.timer); r.recorder.ondataavailable = null; r.recorder.onstop = null; if (r.recorder.state !== 'inactive') r.recorder.stop(); }
  }, []);

  const pick = (key) => { setDesign(key); setStartAt(performance.now()); };
  const switchLang = (next) => {
    if (headline === POSTER_COPY[lang].kicker) setHeadline(POSTER_COPY[next].kicker);
    setLang(next);
  };
  const current = MOTION_DESIGNS.find((d) => d.key === design);
  const pill = (on) => ({
    height: 34, padding: '0 14px', borderRadius: P.radius.pill, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: on ? P.text : P.raised, color: on ? P.card : P.textSec,
  });
  const field = (label, value, set, extra = {}) => (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: P.textSec, marginBottom: 6 }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} {...extra}
        style={{ width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', borderRadius: P.radius.row, border: 'none', background: P.raised, color: P.text, fontSize: 15, outline: 'none' }} />
    </label>
  );

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="xd-motion-sheet"
        style={{ width: '100%', maxWidth: 880, maxHeight: '94dvh', overflowY: 'auto', background: P.card, color: P.text,
          borderRadius: `${P.radius.card}px ${P.radius.card}px 0 0`, fontFamily: 'var(--xd-font-body)' }}>
        <style>{'.xd-motion-sheet button, .xd-motion-sheet input { font-family: inherit; }'}</style>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: P.card, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${P.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Moving poster</p>
            <p style={{ margin: 0, fontSize: 12, color: P.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{posterTitle(car)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: P.raised, color: P.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: 16 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 'min(320px, 70vw)', aspectRatio: `${MOTION_W} / ${MOTION_H}`, borderRadius: 12, overflow: 'hidden', background: '#000', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
              <canvas ref={canvasRef} width={MOTION_W} height={MOTION_H} style={{ width: '100%', height: '100%', display: 'block' }} />
              {(!imgs || !design) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.textSec, fontSize: 13 }}>Loading photos...</div>
              )}
              {imgs && imgs.length === 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, background: 'rgba(0,0,0,0.7)', color: P.textSec, fontSize: 12, textAlign: 'center' }}>This car has no photos yet. Add some in Edit.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 'min(320px, 70vw)' }}>
              <button onClick={() => setStartAt(performance.now())} disabled={!!rec} style={{ ...pill(false), flex: 1, opacity: rec ? 0.5 : 1 }}>Play again</button>
              <button onClick={startDownload} disabled={!!rec || !imgs || !design || !numbers.ok}
                style={{ ...pill(false), flex: 1.4, background: P.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!imgs || !design || !numbers.ok) ? 0.5 : 1 }}>
                <Download size={14} /> {rec ? `Recording ${rec.left}s` : 'Download video'}
              </button>
            </div>
            {rec && <p style={{ margin: 0, fontSize: 12, color: P.textMuted, textAlign: 'center', maxWidth: 320 }}>Keep this screen open until it finishes.</p>}
            {saved && !saved.error && (
              <p style={{ margin: 0, fontSize: 12, color: saved.ext === 'mp4' ? P.textSec : P.accentText, textAlign: 'center', maxWidth: 320, lineHeight: 1.45 }}>
                Saved as {saved.ext.toUpperCase()}, {saved.mb} MB, {saved.secs}s.
                {saved.ext !== 'mp4' && ' This browser only makes WebM, which iPhone WhatsApp will not play. Use Chrome or Safari for MP4.'}
              </p>
            )}
            {saved?.error && <p style={{ margin: 0, fontSize: 12, color: P.accentText, textAlign: 'center', maxWidth: 320 }}>{saved.error}</p>}
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: P.textSec, marginBottom: 6 }}>Design</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MOTION_DESIGNS.map((d, i) => (
                  <button key={d.key} onClick={() => pick(d.key)} disabled={!!rec} style={pill(design === d.key)}>{i + 1} · {d.label}</button>
                ))}
              </div>
              {current && <p style={{ margin: '8px 0 0', fontSize: 12, color: P.textMuted, lineHeight: 1.45 }}>{current.note}</p>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {field('Price (RM)', price, setPrice, { inputMode: 'numeric' })}
              {field('Deposit (RM)', deposit, setDeposit, { inputMode: 'numeric' })}
              {field('Rate (EIR %)', rate, setRate, { inputMode: 'decimal' })}
            </div>
            {!numbers.ok && <p style={{ margin: 0, fontSize: 12.5, color: P.accentText }}>{POSTER_ERRORS[numbers.error]}</p>}
            {field('Headline', headline, setHeadline, { maxLength: 40 })}
            {field('Offer (leave empty to hide)', offer, setOffer, { maxLength: 40, placeholder: 'e.g. Free tinted + 1 year warranty' })}
            {field('Your name', name, setName, { maxLength: 40 })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1 }} />
              {['ms', 'en'].map((l) => (
                <button key={l} onClick={() => switchLang(l)} style={pill(lang === l)}>{l === 'ms' ? 'BM' : 'EN'}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
