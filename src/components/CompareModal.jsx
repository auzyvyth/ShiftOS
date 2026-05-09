import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { X, ExternalLink, MessageCircle, Check, Share2, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useCompare } from '../hooks/useCompare';
import { useCompareModal } from '../hooks/useCompareModal';
import HeartButton from './HeartButton';

/* ── Constants ────────────────────────────────────────────────────────────── */
const SELECT_COLS = [
  'id','slug','year','brand','model','variant',
  'selling_price','original_price','mileage','transmission',
  'fuel_type','body_type','engine_cc','colour','condition',
  'state','city','is_recon','auction_grade','interior_grade',
  'import_country','chassis_status','car_documents','warranty_months',
  'loan_eligible','financing_type','previous_owners','created_at',
  'images','status','dealer_id','included_services',
].join(',');

const DOC_TYPES = [
  { key: 'puspakom',       label: 'Puspakom',        pts: 2 },
  { key: 'service_history',label: 'Service History', pts: 2 },
  { key: 'ownership',      label: 'Ownership/VOC',   pts: 1 },
  { key: 'insurance',      label: 'Insurance',       pts: 1 },
  { key: 'warranty',       label: 'Warranty Cert',   pts: 1 },
  { key: 'loan_clearance', label: 'Loan Clearance',  pts: 0 },
  { key: 'import_ap',      label: 'Import AP',       pts: 0 },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const calcMonthly = (p) => p > 0 ? Math.round((p * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12)) : null;
const fmtRM      = (n) => n != null ? `RM ${Number(n).toLocaleString('en-MY')}` : '—';
const ageDays    = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

function transparencyScore(car) {
  let s = 0;
  const docs = Array.isArray(car.car_documents) ? car.car_documents : [];
  const hasDoc = (key) => docs.some(d => d.key === key);
  if (hasDoc('puspakom'))        s += 2;
  if (hasDoc('service_history')) s += 2;
  if (hasDoc('ownership'))       s += 1;
  if (hasDoc('insurance'))       s += 1;
  if (hasDoc('warranty'))        s += 1;
  if ((car.warranty_months || 0) > 0)        s += 1;
  if ((car.included_services || []).length)   s += 1;
  if (car.previous_owners != null)            s += 1;
  return Math.min(s, 10);
}

const scoreColor = (s) => s >= 7 ? '#4ade80' : s >= 4 ? '#fbbf24' : '#f87171';
const scoreLabel = (s) => s >= 7 ? 'High' : s >= 4 ? 'Medium' : 'Low';

function winnerIdx(values, dir = 'low') {
  const nums = values.map(v => v != null && !isNaN(Number(v)) ? Number(v) : null);
  if (nums.every(n => n == null)) return -1;
  const valid = nums.filter(n => n != null);
  const target = dir === 'low' ? Math.min(...valid) : Math.max(...valid);
  return nums.findIndex(n => n === target);
}

function gradeNum(g) {
  if (!g) return null;
  const m = String(g).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/* ── Cell styles ─────────────────────────────────────────────────────────── */
const LABEL_CELL = {
  position: 'sticky', left: 0, zIndex: 2,
  background: '#080C14',
  padding: '9px 14px',
  fontSize: 12, color: '#6b7280',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  width: 130, minWidth: 130,
};
const DATA_CELL = {
  padding: '9px 16px',
  fontSize: 13,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
  minWidth: 190,
};
const SECTION_CELL = {
  padding: '12px 14px 7px',
  fontSize: 10, fontWeight: 700,
  color: '#dc2626',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  background: 'rgba(220,38,38,0.04)',
  borderBottom: '1px solid rgba(220,38,38,0.12)',
  position: 'sticky', left: 0,
};

/* ── Sub-components ──────────────────────────────────────────────────────── */
function Row({ label, values, highlight, renderCell }) {
  return (
    <tr>
      <td style={LABEL_CELL}>{label}</td>
      {values.map((val, i) => (
        <td key={i} style={{ ...DATA_CELL, color: highlight?.[i] || '#d1d5db', fontWeight: highlight?.[i] ? 600 : 400 }}>
          {renderCell ? renderCell(val, i) : (val ?? '—')}
        </td>
      ))}
    </tr>
  );
}

function SectionHeader({ label, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan + 1} style={SECTION_CELL}>{label}</td>
    </tr>
  );
}

function ScoreBar({ score }) {
  const color = scoreColor(score);
  return (
    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${color}25`, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Transparency</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}/10 · {scoreLabel(score)}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${score * 10}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function DocBadge({ label, has }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 12, margin: '2px',
      fontSize: 10, fontWeight: 600,
      background: has ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${has ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
      color: has ? '#4ade80' : '#4b5563',
    }}>
      {has ? '✓' : '✗'} {label}
    </span>
  );
}

function SvcBadge({ name }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px', borderRadius: 12, margin: '2px',
      fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
      background: 'rgba(96,165,250,0.1)',
      border: '1px solid rgba(96,165,250,0.2)',
      color: '#60a5fa',
    }}>
      {name}
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function CompareModal() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const { open, closeModal } = useCompareModal();
  const navigate = useNavigate();

  const [cars, setCars]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [whatsappMap, setWhatsappMap] = useState({});
  const [copied, setCopied]       = useState(false);

  /* Scroll lock */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, closeModal]);

  /* Fetch full car data */
  useEffect(() => {
    if (!open || !compareIds.length) { setCars([]); return; }
    setLoading(true);
    supabase
      .from('car_listings')
      .select(SELECT_COLS)
      .in('id', compareIds)
      .in('status', ['available', 'reserved'])
      .then(({ data }) => {
        const ordered = compareIds.map(id => (data || []).find(c => c.id === id)).filter(Boolean);
        setCars(ordered);
        setLoading(false);
      });
  }, [open, compareIds.join(',')]);

  /* Fetch WhatsApp numbers */
  useEffect(() => {
    const ids = [...new Set(cars.map(c => c.dealer_id).filter(Boolean))];
    if (!ids.length) return;
    supabase.from('profiles').select('id,whatsapp_number').in('id', ids)
      .then(({ data }) => {
        if (!data) return;
        setWhatsappMap(Object.fromEntries(data.map(p => [p.id, p.whatsapp_number])));
      });
  }, [cars]);

  const removeCar = useCallback((id) => {
    removeFromCompare(id);
    setCars(prev => prev.filter(c => c.id !== id));
  }, [removeFromCompare]);

  const handleShare = async () => {
    const params = new URLSearchParams();
    cars.forEach((c, i) => { if (c.slug) params.set(['a', 'b', 'c', 'd'][i], c.slug); });
    const url   = `${window.location.origin}/compare?${params}`;
    const title = `Compare ${n} Cars on XDrive`;
    const text  = cars.map(c => [c.year, c.brand, c.model].filter(Boolean).join(' ')).join(' vs ');

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user cancelled — do nothing
      }
    }
    // Desktop fallback: copy to clipboard
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waLink = (car) => {
    const num = whatsappMap[car.dealer_id];
    if (!num) return null;
    const digits = String(num).replace(/\D/g, '').replace(/^0/, '60');
    const name = [car.year, car.brand, car.model].filter(Boolean).join(' ');
    return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi, I'm interested in the ${name} listed on XDrive.`)}`;
  };

  if (!open) return null;

  const n = cars.length;
  const scores = cars.map(transparencyScore);

  /* Highlight maps */
  const maxScore = Math.max(...scores, 0);

  function highHL(vals) {
    const idx = winnerIdx(vals, 'high');
    return cars.map((_, i) => i === idx ? '#4ade80' : null);
  }
  function lowHL(vals) {
    const idx = winnerIdx(vals, 'low');
    return cars.map((_, i) => i === idx ? '#4ade80' : null);
  }

  const ageDaysMap = Object.fromEntries(cars.map(c => [c.id, ageDays(c.created_at)]));
  const hasRecon   = cars.some(c => c.is_recon);

  const priceHL = () => {
    const idx = winnerIdx(cars.map(c => c.selling_price), 'low');
    return cars.map((_, i) => i === idx ? '#4ade80' : null);
  };
  const mileHL = () => {
    const lo = winnerIdx(cars.map(c => c.mileage), 'low');
    const hi = winnerIdx(cars.map(c => c.mileage), 'high');
    return cars.map((_, i) => i === lo ? '#4ade80' : i === hi ? '#f87171' : null);
  };

  const hl = {
    price:    priceHL(),
    mile:     mileHL(),
    year:     highHL(cars.map(c => c.year)),
    owners:   lowHL(cars.map(c => c.previous_owners)),
    aGrade:   highHL(cars.map(c => gradeNum(c.auction_grade))),
    iGrade:   highHL(cars.map(c => gradeNum(c.interior_grade))),
    warranty: highHL(cars.map(c => c.warranty_months || 0)),
    ageDays:  lowHL(cars.map(c => ageDaysMap[c.id])),
    loan:     cars.map(c => c.loan_eligible !== false ? '#4ade80' : null),
    score:    scores.map(s => s === maxScore && maxScore > 0 ? '#4ade80' : null),
    services: highHL(cars.map(c => (c.included_services || []).length)),
  };

  const fmtFinancing = (c) =>
    c.financing_type === 'cash' ? 'Cash Only' :
    c.financing_type === 'sambung_bayar' ? 'Sambung Bayar' : 'Loan';

  return createPortal(
    <>
      <style>{`
        @keyframes cm-in   { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cm-fade { from { opacity:0; } to { opacity:1; } }
        @keyframes cm-spin { to { transform: rotate(360deg); } }
        .cm-overlay { animation: cm-fade 0.18s ease; }
        .cm-panel   { animation: cm-in   0.22s cubic-bezier(0.16,1,0.3,1); }
        .cm-table   { border-collapse: collapse; width: 100%; }
        .cm-scroll  { overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
        .cm-close:hover { background: rgba(255,255,255,0.1) !important; }
        @media(max-width:640px) { .cm-dt { display:none!important } }
        @media(min-width:641px) { .cm-mb { display:none!important } }
      `}</style>

      {/* Backdrop */}
      <div className="cm-overlay" onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} />

      {/* Panel */}
      <div className="cm-panel" onClick={e => e.stopPropagation()} style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        background: '#080C14',
        overflowY: 'auto',
        fontFamily: "'DM Sans', sans-serif",
        color: '#fff',
      }}>
        {/* ── Top bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(8,12,20,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 2, lineHeight: 1, margin: 0 }}>
              COMPARE {n > 0 && <span style={{ color: '#dc2626' }}>{n}</span>} CARS
            </h2>
            {n > 0 && (
              <button onClick={clearCompare} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                Clear all
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {n < 4 && (
              <button
                onClick={() => { closeModal(); navigate('/marketplace'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: '#f87171', fontSize: 12, fontWeight: 600,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <Plus size={13} /> Add Car
              </button>
            )}
            {n >= 2 && (
              <button onClick={handleShare} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: copied ? '#4ade80' : '#9ca3af',
                fontSize: 12, fontFamily: "'DM Sans',sans-serif",
              }}>
                {copied ? <Check size={13} /> : <Share2 size={13} />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}
            <button className="cm-close" onClick={closeModal} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
              transition: 'background 0.15s',
            }}>
              <X size={14} /> Close
            </button>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', gap: 14 }}>
            <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'cm-spin 0.8s linear infinite' }} />
            <span style={{ color: '#6b7280', fontSize: 14 }}>Loading…</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && n === 0 && (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: '#6b7280' }}>
            <p style={{ fontSize: 16, marginBottom: 12 }}>No cars selected to compare.</p>
            <button onClick={closeModal} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
              Close and browse cars →
            </button>
          </div>
        )}

        {!loading && n > 0 && (
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 80px' }}>

            {/* ════════════════════════════════════════════
                MOBILE: stacked cards
            ════════════════════════════════════════════ */}
            <div className="cm-mb" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {cars.map((car, i) => {
                const img  = car.images?.[0];
                const name = [car.year, car.brand, car.model].filter(Boolean).join(' ');
                const monthly = calcMonthly(car.selling_price);
                const wa = waLink(car);
                const score = scores[i];
                const docs = Array.isArray(car.car_documents) ? car.car_documents : [];
                const svcs = Array.isArray(car.included_services) ? car.included_services : [];

                return (
                  <div key={car.id} style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ position: 'relative', height: '160px', background: '#0d1117', flexShrink: 0 }}>
                      {img
                        ? <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🚗</div>
                      }
                      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                        <HeartButton listingId={car.id} size={14} style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '4px 6px' }} />
                        <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', padding: '4px 6px', display: 'flex' }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: 16 }}>
                      <ScoreBar score={score} />

                      <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 2 }}>{car.brand}</p>
                      <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: '#fff', letterSpacing: 1, lineHeight: 1, marginBottom: 6 }}>
                        {[car.year, car.model, car.variant].filter(Boolean).join(' ')}
                      </p>
                      {(() => {
                        const hasDisc = car.original_price > 0 && car.original_price > car.selling_price;
                        const pct     = hasDisc ? Math.round((car.original_price - car.selling_price) / car.original_price * 100) : 0;
                        const mOrig   = hasDisc ? calcMonthly(car.original_price) : null;
                        return (
                          <>
                            {hasDisc && (
                              <p style={{ fontSize: 12, color: '#6b7280', textDecoration: 'line-through', marginBottom: 1 }}>
                                {fmtRM(car.original_price)}
                              </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>{fmtRM(car.selling_price)}</p>
                              {hasDisc && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', padding: '1px 7px', borderRadius: 20 }}>
                                  -{pct}%
                                </span>
                              )}
                            </div>
                            {monthly && (
                              <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 8 }}>
                                {mOrig && <span style={{ textDecoration: 'line-through', marginRight: 5 }}>~RM {mOrig.toLocaleString()}/mo</span>}
                                ~RM {monthly.toLocaleString()}/mo est.
                              </p>
                            )}
                          </>
                        );
                      })()}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        {car.slug && (
                          <Link to={`/cars/${car.slug}`} onClick={closeModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>
                            View listing <ExternalLink size={10} />
                          </Link>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#4ade80', fontSize: 11, textDecoration: 'none' }}>
                            <MessageCircle size={11} /> WhatsApp
                          </a>
                        )}
                      </div>

                      {/* Documents */}
                      <p style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Documents</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 14 }}>
                        {DOC_TYPES.map(dt => (
                          <DocBadge key={dt.key} label={dt.label} has={docs.some(d => d.key === dt.key)} />
                        ))}
                      </div>

                      {/* Included services */}
                      {svcs.length > 0 && (
                        <>
                          <p style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                            Included Services ({svcs.length})
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 14 }}>
                            {svcs.map((svc, j) => <SvcBadge key={j} name={svc.name || svc.category} />)}
                          </div>
                        </>
                      )}

                      {/* Key specs */}
                      {[
                        ['Mileage',      car.mileage ? `${Number(car.mileage).toLocaleString()} km` : '—'],
                        ['Transmission', car.transmission || '—'],
                        ['Fuel',         car.fuel_type || '—'],
                        ['Condition',    car.condition || '—'],
                        ['Prev. Owners', car.previous_owners != null ? String(car.previous_owners) : '—'],
                        ['Warranty',     car.warranty_months > 0 ? `${car.warranty_months} months` : 'None'],
                        ['Financing',    fmtFinancing(car)],
                        ['Location',     [car.city, car.state].filter(Boolean).join(', ') || '—'],
                      ].map(([lbl, val]) => (
                        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                          <span style={{ color: '#6b7280' }}>{lbl}</span>
                          <span style={{ color: '#d1d5db', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ════════════════════════════════════════════
                DESKTOP: table
            ════════════════════════════════════════════ */}
            <div className="cm-dt" style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'clip' }}>
              <div className="cm-scroll">
                <table className="cm-table" style={{ minWidth: 130 + n * 210 }}>
                  <colgroup>
                    <col style={{ width: 130 }} />
                    {cars.map(c => <col key={c.id} style={{ minWidth: 210 }} />)}
                  </colgroup>

                  {/* ── Column headers ── */}
                  <thead>
                    <tr style={{ background: '#080C14' }}>
                      <th style={{ ...LABEL_CELL, position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid rgba(255,255,255,0.07)' }} />
                      {cars.map((car, i) => {
                        const img  = car.images?.[0];
                        const name = [car.year, car.brand, car.model].filter(Boolean).join(' ');
                        const monthly = calcMonthly(car.selling_price);
                        const wa  = waLink(car);
                        const score = scores[i];
                        const docs = Array.isArray(car.car_documents) ? car.car_documents : [];
                        const svcs = Array.isArray(car.included_services) ? car.included_services : [];

                        return (
                          <th key={car.id} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#080C14', padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top', minWidth: 210, textAlign: 'left' }}>
                            {/* Photo */}
                            <div style={{ position: 'relative', marginBottom: 10 }}>
                              <div style={{ height: '160px', borderRadius: 8, overflow: 'hidden', background: '#0d1117' }}>
                                {img
                                  ? <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚗</div>
                                }
                              </div>
                              <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                                <HeartButton listingId={car.id} size={14} style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '4px 6px' }} />
                                <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', padding: '4px 6px', display: 'flex' }}>
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            <ScoreBar score={score} />

                            <p style={{ fontSize: 9, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2, fontWeight: 600 }}>{car.brand}</p>
                            <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 19, color: '#fff', letterSpacing: 1, lineHeight: 1, marginBottom: 5 }}>
                              {[car.year, car.model, car.variant].filter(Boolean).join(' ')}
                            </p>
                            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{fmtRM(car.selling_price)}</p>
                            {monthly && <p style={{ fontSize: 10, color: '#4b5563' }}>~RM {monthly.toLocaleString()}/mo est.</p>}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                              {car.slug && (
                                <Link to={`/cars/${car.slug}`} onClick={closeModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>
                                  View listing <ExternalLink size={10} />
                                </Link>
                              )}
                              {wa && (
                                <a href={wa} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#4ade80', fontSize: 11, textDecoration: 'none', width: 'fit-content' }}>
                                  <MessageCircle size={11} /> WhatsApp
                                </a>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody style={{ background: '#080C14' }}>
                    {/* PRICING */}
                    <SectionHeader label="Pricing" colSpan={n} />
                    <tr>
                      <td style={LABEL_CELL}>Asking Price</td>
                      {cars.map((car, i) => {
                        const hasDisc = car.original_price > 0 && car.original_price > car.selling_price;
                        const pct     = hasDisc ? Math.round((car.original_price - car.selling_price) / car.original_price * 100) : 0;
                        return (
                          <td key={i} style={{ ...DATA_CELL, fontWeight: 600, color: hl.price[i] || '#d1d5db' }}>
                            {hasDisc && (
                              <div style={{ fontSize: 11, color: '#4b5563', textDecoration: 'line-through', marginBottom: 2 }}>
                                {fmtRM(car.original_price)}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{fmtRM(car.selling_price)}</span>
                              {hasDisc && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', padding: '1px 7px', borderRadius: 20 }}>
                                  -{pct}%
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td style={LABEL_CELL}>Monthly Est.</td>
                      {cars.map((car, i) => {
                        const m     = calcMonthly(car.selling_price);
                        const mOrig = car.original_price > 0 && car.original_price > car.selling_price ? calcMonthly(car.original_price) : null;
                        return (
                          <td key={i} style={{ ...DATA_CELL, color: '#d1d5db' }}>
                            {mOrig && (
                              <div style={{ fontSize: 11, color: '#4b5563', textDecoration: 'line-through', marginBottom: 2 }}>
                                RM {mOrig.toLocaleString()}/mo
                              </div>
                            )}
                            <div>{m ? `RM ${m.toLocaleString()}/mo` : '—'}</div>
                          </td>
                        );
                      })}
                    </tr>
                    <Row label="Financing"     values={cars.map(fmtFinancing)} />

                    {/* BASICS */}
                    <SectionHeader label="Basics" colSpan={n} />
                    <Row label="Year"         values={cars.map(c => c.year || '—')} highlight={hl.year} />
                    <Row label="Mileage"      values={cars.map(c => c.mileage ? `${Number(c.mileage).toLocaleString()} km` : '—')} highlight={hl.mile} />
                    <Row label="Condition"    values={cars.map(c => c.condition || '—')} />
                    <Row label="Prev. Owners" values={cars.map(c => c.previous_owners != null ? String(c.previous_owners) : '—')} highlight={hl.owners} />
                    <Row label="Location"     values={cars.map(c => [c.city, c.state].filter(Boolean).join(', ') || '—')} />

                    {/* SPECS */}
                    <SectionHeader label="Specs" colSpan={n} />
                    <Row label="Engine CC"    values={cars.map(c => c.engine_cc ? `${Number(c.engine_cc).toLocaleString()} cc` : '—')} />
                    <Row label="Transmission" values={cars.map(c => c.transmission || '—')} />
                    <Row label="Fuel Type"    values={cars.map(c => c.fuel_type || '—')} />
                    <Row label="Colour"       values={cars.map(c => c.colour || '—')} />
                    <Row label="Body Type"    values={cars.map(c => c.body_type || '—')} />

                    {/* INCLUDED SERVICES */}
                    <SectionHeader label="Included Services" colSpan={n} />
                    <Row
                      label="# Items"
                      values={cars.map(c => {
                        const s = (c.included_services || []).length;
                        return s > 0 ? `${s} item${s !== 1 ? 's' : ''}` : 'None';
                      })}
                      highlight={hl.services}
                    />
                    <tr>
                      <td style={LABEL_CELL}>What's Included</td>
                      {cars.map((car, i) => {
                        const svcs = Array.isArray(car.included_services) ? car.included_services : [];
                        return (
                          <td key={i} style={{ ...DATA_CELL, verticalAlign: 'top' }}>
                            {svcs.length === 0
                              ? <span style={{ color: '#4b5563', fontSize: 12 }}>None listed</span>
                              : <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                  {svcs.map((svc, j) => <SvcBadge key={j} name={svc.name || svc.category} />)}
                                </div>
                            }
                          </td>
                        );
                      })}
                    </tr>

                    {/* DOCUMENTS */}
                    <SectionHeader label="Documents & Verification" colSpan={n} />
                    {DOC_TYPES.map(dt => (
                      <Row
                        key={dt.key}
                        label={`${dt.label}${dt.pts > 0 ? ` (+${dt.pts}pt)` : ''}`}
                        values={cars.map(c => {
                          const docs = Array.isArray(c.car_documents) ? c.car_documents : [];
                          return docs.some(d => d.key === dt.key) ? 'yes' : 'no';
                        })}
                        highlight={cars.map(c => {
                          const docs = Array.isArray(c.car_documents) ? c.car_documents : [];
                          return docs.some(d => d.key === dt.key) ? '#4ade80' : null;
                        })}
                        renderCell={(val) => (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <span style={{
                              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                              background: val === 'yes' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${val === 'yes' ? '#4ade80' : 'rgba(255,255,255,0.1)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                            }}>
                              {val === 'yes' ? '✓' : '✗'}
                            </span>
                            <span style={{ color: val === 'yes' ? '#4ade80' : '#4b5563' }}>
                              {val === 'yes' ? 'Provided' : 'Not provided'}
                            </span>
                          </span>
                        )}
                      />
                    ))}

                    {/* RECON */}
                    {hasRecon && (
                      <>
                        <SectionHeader label="Recon / Import" colSpan={n} />
                        <Row label="Recon"          values={cars.map(c => c.is_recon ? 'Yes' : 'No')} />
                        <Row label="Import Country" values={cars.map(c => c.import_country || '—')} />
                        <Row label="Exterior Grade" values={cars.map(c => c.auction_grade  || '—')} highlight={hl.aGrade} />
                        <Row label="Interior Grade" values={cars.map(c => c.interior_grade || '—')} highlight={hl.iGrade} />
                        <Row label="Chassis" values={cars.map(c => c.chassis_status || '—')}
                          renderCell={(val) => (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: val === 'clean' ? '#22c55e' : val === 'repaired' ? '#eab308' : val === 'written_off' ? '#dc2626' : '#334155' }} />
                              {val || '—'}
                            </span>
                          )}
                        />
                      </>
                    )}

                    {/* TRUST */}
                    <SectionHeader label="Trust & Value" colSpan={n} />
                    <Row label="Transparency" values={scores.map(s => `${s}/10 · ${scoreLabel(s)}`)} highlight={hl.score} />
                    <Row label="Warranty"     values={cars.map(c => c.warranty_months > 0 ? `${c.warranty_months} months` : 'None')} highlight={hl.warranty} />
                    <Row label="Loan Eligible" values={cars.map(c => c.loan_eligible === false ? 'No' : 'Yes')} highlight={hl.loan} />
                    <Row label="Days Listed"  values={cars.map(c => ageDaysMap[c.id] != null ? `${ageDaysMap[c.id]}d` : '—')} highlight={hl.ageDays} />
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Nudge: fewer than 2 cars ── */}
            {n < 2 && (
              <div style={{ marginTop: 24, background: '#0a1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 14, color: '#9ca3af' }}>
                  {n === 0 ? 'No cars selected.' : 'Add at least one more car to start comparing.'}
                </p>
                <button
                  onClick={() => { closeModal(); navigate('/marketplace'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                >
                  <Plus size={13} /> Browse Cars
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </>,
    document.body
  );
}
