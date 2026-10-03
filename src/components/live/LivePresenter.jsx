import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  monthlyPayment, DEFAULT_EIR, DEFAULT_LOAN_RATIO, MAX_TENURE_YEARS, HIGH_VALUE_THRESHOLD,
} from '../../utils/financing';

// Live presentation — the seller's full-screen view of their own cars, built
// to be shown on a TikTok / FB live (camera on the screen, or screen-share).
//
// TikTok strikes a live for a phone number, link, QR code or "WhatsApp me" on
// screen, so NOTHING here may ever render contact details, a URL, a QR or a
// messaging-app logo. Viewers reach the seller through the profile bio link,
// which lands on the mini page — and the car on this screen is pinned there
// ("Live now", set_live_listing). The #number is the shared language: a viewer
// comments "#3", the seller says "tap my profile, car #3".
//
// The monthly table is the calculation poster salesmen already hold up on
// lives, generated for every car: deposit rows x tenure columns. One formula
// (financing.js). The default cell (10% down, 7 years) is the same estimate
// the mini page card shows, so the two never disagree.

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-MY');
const TENURES = [5, 7, MAX_TENURE_YEARS];
const DEFAULT_DOWN = Math.round((1 - DEFAULT_LOAN_RATIO) * 100); // 10
const DOWN_ROWS = [DEFAULT_DOWN, 20, 30];
const DEFAULT_TENURE = 7;
const HEARTBEAT_MS = 4 * 60 * 1000; // live_until window is 10 min server-side

const carName = (c) => [c.year, c.brand, c.model].filter(Boolean).join(' ');

export default function LivePresenter({ listings, onClose }) {
  const [idx, setIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [eir, setEir] = useState(String(DEFAULT_EIR));
  const [customDown, setCustomDown] = useState('');
  const touchX = useRef(null);

  const car = listings[idx] || null;
  const images = Array.isArray(car?.images) ? car.images.filter(Boolean) : [];
  const price = Number(car?.selling_price) || 0;
  const rate = Math.max(0, Number(eir) || 0);

  const go = useCallback((d) => {
    setIdx((i) => (i + d + listings.length) % listings.length);
    setImgIdx(0);
  }, [listings.length]);

  // Overlay rules 1+2: portalled, body scroll locked while open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard for a laptop running LIVE Studio: arrows swipe, Esc closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // A live runs 30-60 minutes; a phone that dims and locks mid-pitch kills it.
  useEffect(() => {
    let lock = null;
    const acquire = async () => {
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported / denied */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      try { lock?.release(); } catch { /* ignore */ }
    };
  }, []);

  // Tell the mini page which car is on screen. Debounced so flicking through
  // five cars is one write; heartbeat keeps the 10-minute window open; closing
  // clears it. Errors are ignored on purpose: the presenter must keep working
  // even if the sync is down (or before migration 20261003a is applied).
  const carId = car?.id || null;
  useEffect(() => {
    if (!carId) return undefined;
    const push = () => { supabase.rpc('set_live_listing', { p_listing_id: carId }).then(() => {}, () => {}); };
    const t = setTimeout(push, 600);
    const hb = setInterval(push, HEARTBEAT_MS);
    return () => { clearTimeout(t); clearInterval(hb); };
  }, [carId]);
  useEffect(() => () => {
    supabase.rpc('set_live_listing', { p_listing_id: null }).then(() => {}, () => {});
  }, []);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  if (!car) return null;

  const custom = Number(customDown) || 0;
  const rows = [
    ...(custom > 0 && custom < price ? [{ key: 'c', label: `RM ${fmt(custom)}`, down: custom, custom: true }] : []),
    ...DOWN_ROWS.map((pct) => ({ key: pct, down: price * pct / 100 })),
  ];
  const financeable = price > 0 && price <= HIGH_VALUE_THRESHOLD;

  return createPortal(
    <div className="lp">
      {/* Light, on the marketplace tokens (DESIGN.md): page #F7F6F2, white cards,
          ink #0f1115, one red only for the selected cell's marker. Every block
          sits on the same 16px gutter so nothing touches a screen edge. */}
      <style>{`
        .lp { position: fixed; inset: 0; z-index: 1000; background: #F7F6F2; color: #111827; font-family: var(--xd-font-body); display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        .lp-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid rgba(0,0,0,.06); }
        .lp-count { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; font-variant-numeric: tabular-nums; }
        .lp-iconbtn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(0,0,0,.12); background: #fff; color: #111827; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .lp-iconbtn[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
        .lp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
        /* Stacked column on phones. It was a grid, and the photo (overflow:hidden,
           so its automatic min-height is 0) let its row shrink under the car
           name. Nothing in the column may shrink. */
        .lp-body > * { flex-shrink: 0; }
        .lp-card { background: #fff; border-radius: 16px; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.05); }
        .lp-photo { position: relative; aspect-ratio: 16 / 10; border-radius: 16px; overflow: hidden; background: #EDEAE3; }
        .lp-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lp-num { position: absolute; top: 12px; left: 12px; font-family: 'Bebas Neue', sans-serif; font-size: 30px; line-height: 1; letter-spacing: .02em; color: #fff; background: rgba(15,17,21,.78); border-radius: 8px; padding: 6px 10px 3px; }
        .lp-dots { position: absolute; bottom: 10px; left: 0; right: 0; display: flex; justify-content: center; gap: 5px; pointer-events: none; }
        .lp-dots span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.55); }
        .lp-dots span[data-on="1"] { background: #fff; }
        .lp-head { padding: 20px; }
        .lp-name { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(32px, 7vw, 48px); line-height: .95; letter-spacing: .015em; color: #0f1115; margin: 0; }
        .lp-spec { font-size: 14px; color: #6b7280; margin: 8px 0 0; }
        .lp-price { font-size: clamp(28px, 6vw, 40px); font-weight: 800; color: #0f1115; margin: 14px 0 0; padding-top: 14px; border-top: 1px solid rgba(0,0,0,.06); font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
        .lp-fin { padding: 20px; }
        .lp-eb { font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
        .lp-eb i { width: 16px; height: 2px; background: #dc2626; display: inline-block; }
        .lp-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
        .lp-table th { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #9ca3af; padding: 0 8px 10px; text-align: right; }
        .lp-table th:first-child { text-align: left; padding-left: 0; }
        .lp-table td { padding: 12px 8px; text-align: right; font-size: clamp(16px, 3.6vw, 20px); font-weight: 700; color: #111827; border-top: 1px solid rgba(0,0,0,.06); }
        .lp-table td:first-child { text-align: left; padding-left: 0; font-size: 13px; font-weight: 500; color: #4b5563; white-space: nowrap; }
        .lp-table td:first-child b { display: block; font-size: 15px; font-weight: 700; color: #111827; }
        .lp-table td.lp-def { background: #0f1115; color: #fff; border-radius: 8px; border-top-color: transparent; }
        .lp-note { font-size: 12px; color: #6b7280; line-height: 1.5; margin: 12px 0 0; }
        .lp-adjust { padding: 16px 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lp-adjust label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: #4b5563; min-width: 0; }
        .lp-adjust input { width: 100%; height: 44px; background: #fff; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; color: #111827; padding: 0 12px; font-size: 16px; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-adjust input:focus { outline: none; border-color: #0f1115; }
        .lp-nav { display: flex; gap: 12px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(0,0,0,.06); }
        .lp-navbtn { flex: 1; height: 52px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12); background: #fff; color: #111827; font-size: 16px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit; font-variant-numeric: tabular-nums; }
        .lp-navbtn.lp-next { background: #0f1115; border-color: #0f1115; color: #fff; }
        @media (min-width: 900px) and (orientation: landscape) {
          .lp-body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); grid-auto-rows: max-content; padding: 24px; gap: 24px; align-items: start; align-content: start; }
          .lp-photo { grid-row: span 3; aspect-ratio: 4 / 3; }
        }
      `}</style>

      {/* Top bar: position + controls. Deliberately no seller name or contact. */}
      <div className="lp-top">
        <span className="lp-count">Car {idx + 1} of {listings.length}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="lp-iconbtn" onClick={() => setAdjustOpen((v) => !v)} aria-label="Adjust financing" aria-pressed={adjustOpen}>
            <SlidersHorizontal size={17} />
          </button>
          <button className="lp-iconbtn" onClick={onClose} aria-label="Exit live presentation"><X size={18} /></button>
        </div>
      </div>

      <div className="lp-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Photo: tap the left / right third to step through this car's photos. */}
        <div className="lp-photo lp-card">
          {images[imgIdx]
            ? <img src={images[imgIdx]} alt={carName(car)} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>No photo</div>}
          {images.length > 1 && (
            <>
              <button aria-label="Previous photo" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }} />
              <button aria-label="Next photo" onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }} />
              <div className="lp-dots">
                {images.slice(0, 12).map((_, i) => <span key={i} data-on={i === imgIdx ? '1' : '0'} />)}
              </div>
            </>
          )}
          <span className="lp-num">#{idx + 1}</span>
        </div>

        <div className="lp-card lp-head">
          <h2 className="lp-name">{carName(car)}</h2>
          <p className="lp-spec">
            {[car.variant, car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission, car.colour].filter(Boolean).join(' · ')}
          </p>
          <p className="lp-price">{price > 0 ? `RM ${fmt(price)}` : 'Price on request'}</p>
        </div>

        {adjustOpen && (
          <div className="lp-card lp-adjust">
            <label>
              Rate (EIR % a year)
              <input type="number" inputMode="decimal" step="0.1" min="0" value={eir} onChange={(e) => setEir(e.target.value)} />
            </label>
            <label>
              Custom deposit (RM)
              <input type="number" inputMode="numeric" min="0" placeholder="e.g. 5000" value={customDown} onChange={(e) => setCustomDown(e.target.value)} />
            </label>
          </div>
        )}

        {financeable ? (
          <div className="lp-card lp-fin">
            <p className="lp-eb"><i />Monthly instalment</p>
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Deposit</th>
                  {TENURES.map((y) => <th key={y}>{y} yrs</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.custom ? <b>{r.label}</b> : <><b>{r.key}%</b>RM {fmt(r.down)}</>}
                    </td>
                    {TENURES.map((y) => {
                      const isDefault = !r.custom && r.key === DEFAULT_DOWN && y === DEFAULT_TENURE;
                      return (
                        <td key={y} className={isDefault ? 'lp-def' : undefined}>
                          {fmt(monthlyPayment(price - r.down, rate, y * 12))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-note">RM per month. Estimate at {rate}% EIR a year, reducing balance. Subject to bank approval.</p>
          </div>
        ) : price > HIGH_VALUE_THRESHOLD ? (
          <div className="lp-card lp-fin">
            <p className="lp-eb"><i />Monthly instalment</p>
            <p style={{ fontSize: 15, color: '#4b5563', margin: 0 }}>Financing on request for this car.</p>
          </div>
        ) : null}
      </div>

      {/* Big prev / next: a seller talking to camera needs a target they can hit blind. */}
      {listings.length > 1 && (
        <div className="lp-nav">
          <button className="lp-navbtn" onClick={() => go(-1)}><ChevronLeft size={20} /> #{((idx - 1 + listings.length) % listings.length) + 1}</button>
          <button className="lp-navbtn lp-next" onClick={() => go(1)}>#{((idx + 1) % listings.length) + 1} <ChevronRight size={20} /></button>
        </div>
      )}
    </div>,
    document.body,
  );
}
