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
    ...DOWN_ROWS.map((pct) => ({ key: pct, label: `${pct}% · RM ${fmt(price * pct / 100)}`, down: price * pct / 100 })),
  ];
  const financeable = price > 0 && price <= HIGH_VALUE_THRESHOLD;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#080C14', color: '#fff', fontFamily: 'var(--xd-font-body)', display: 'flex', flexDirection: 'column' }}
    >
      <style>{`
        .lp-body { flex: 1; min-height: 0; display: grid; grid-template-rows: minmax(0, 38%) minmax(0, 1fr); }
        .lp-info { overflow-y: auto; padding: 16px clamp(16px, 4vw, 32px) 20px; }
        @media (min-width: 900px) and (orientation: landscape) {
          .lp-body { grid-template-rows: none; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
          .lp-info { display: flex; flex-direction: column; justify-content: center; }
        }
        .lp-cell { padding: 10px 8px; text-align: right; font-variant-numeric: tabular-nums; }
        .lp-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; padding: 9px 10px; font-size: 15px; font-family: inherit; }
      `}</style>

      {/* Top bar: position + close. Deliberately no seller name / contact. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
          Car {idx + 1} of {listings.length}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setAdjustOpen((v) => !v)} aria-label="Adjust financing"
            style={{ ...iconBtn, background: adjustOpen ? 'rgba(255,255,255,0.12)' : iconBtn.background }}>
            <SlidersHorizontal size={17} />
          </button>
          <button onClick={onClose} aria-label="Exit live presentation" style={iconBtn}><X size={18} /></button>
        </div>
      </div>

      <div className="lp-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Photo: tap left/right half to step through this car's photos. */}
        <div style={{ position: 'relative', background: '#0a0e18', overflow: 'hidden' }}>
          {images[imgIdx] ? (
            <img src={images[imgIdx]} alt={carName(car)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No photo</div>
          )}
          {images.length > 1 && (
            <>
              <button aria-label="Previous photo" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }} />
              <button aria-label="Next photo" onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', background: 'none', border: 'none', cursor: 'pointer' }} />
              <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, pointerEvents: 'none' }}>
                {images.slice(0, 12).map((_, i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.35)' }} />
                ))}
              </div>
            </>
          )}
          <span style={{ position: 'absolute', top: 12, left: 12, fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, lineHeight: 1, letterSpacing: '1px', background: 'rgba(8,12,20,0.78)', borderRadius: 10, padding: '6px 12px 3px' }}>
            #{idx + 1}
          </span>
        </div>

        <div className="lp-info">
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px, 6vw, 48px)', letterSpacing: '1px', lineHeight: 1, margin: 0 }}>
            {carName(car)}
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
            {[car.variant, car.mileage ? `${fmt(car.mileage)} km` : null, car.transmission, car.colour].filter(Boolean).join(' · ')}
          </p>
          {price > 0 && (
            <p style={{ fontSize: 'clamp(28px, 5.5vw, 42px)', fontWeight: 800, color: '#60a5fa', margin: '12px 0 0', fontVariantNumeric: 'tabular-nums' }}>
              RM {fmt(price)}
            </p>
          )}

          {adjustOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={labelStyle}>
                Rate (EIR % p.a.)
                <input className="lp-input" type="number" inputMode="decimal" step="0.1" min="0" value={eir} onChange={(e) => setEir(e.target.value)} />
              </label>
              <label style={labelStyle}>
                Custom deposit (RM)
                <input className="lp-input" type="number" inputMode="numeric" min="0" placeholder="e.g. 5000" value={customDown} onChange={(e) => setCustomDown(e.target.value)} />
              </label>
            </div>
          )}

          {financeable ? (
            <div style={{ marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(14px, 2.6vw, 18px)' }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ textAlign: 'left', padding: '0 8px 8px 0', fontWeight: 600 }}>Deposit</th>
                    {TENURES.map((y) => <th key={y} className="lp-cell" style={{ paddingTop: 0, fontWeight: 600 }}>{y} yrs</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <td style={{ padding: '10px 8px 10px 0', fontSize: 13, color: r.custom ? '#fff' : 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>{r.label}</td>
                      {TENURES.map((y) => {
                        const isDefault = !r.custom && r.key === DEFAULT_DOWN && y === DEFAULT_TENURE;
                        return (
                          <td key={y} className="lp-cell" style={{ fontWeight: 700, color: isDefault ? '#fff' : 'rgba(255,255,255,0.85)', background: isDefault ? 'rgba(96,165,250,0.14)' : 'none', borderRadius: 6 }}>
                            {fmt(monthlyPayment(price - r.down, rate, y * 12))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '10px 0 0', lineHeight: 1.5 }}>
                RM per month. Estimate at {rate}% EIR p.a., reducing balance. Subject to bank approval.
              </p>
            </div>
          ) : price > HIGH_VALUE_THRESHOLD ? (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>Financing on request for this car.</p>
          ) : null}
        </div>
      </div>

      {/* Big prev/next — a seller talking to camera needs a target they can hit blind. */}
      {listings.length > 1 && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => go(-1)} style={navBtn}><ChevronLeft size={20} /> #{((idx - 1 + listings.length) % listings.length) + 1}</button>
          <button onClick={() => go(1)} style={navBtn}>#{((idx + 1) % listings.length) + 1} <ChevronRight size={20} /></button>
        </div>
      )}
    </div>,
    document.body,
  );
}

const iconBtn = {
  width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const navBtn = {
  flex: 1, height: 50, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 16, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
  fontFamily: 'inherit',
};
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.55)' };
