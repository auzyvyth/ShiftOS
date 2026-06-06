import React, { useEffect, useState } from 'react';
import { useMarketplaceTracking } from '../hooks/useMarketplaceTracking';
import { useSearchParams, Link } from 'react-router-dom';
import { X, Share2, Check, ExternalLink, Flame, Trophy, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import HeartButton from '../components/HeartButton';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import { calcMonthly } from '../utils/financing';

const SELECT_COLS = [
  'id','slug','year','brand','model','variant',
  'selling_price','original_price','mileage','transmission',
  'fuel_type','body_type','engine_cc','colour','condition',
  'state','city','is_recon','auction_grade','interior_grade',
  'import_country','chassis_status','car_documents','warranty_months',
  'loan_eligible','previous_owners','created_at','images','status',
  'market_avg_price',
].join(', ');

const fmtRM = n => n != null ? `RM ${Number(n).toLocaleString('en-MY')}` : '—';
const ageDays = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;
const gradeNum = g => { if (!g) return null; const m = String(g).match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; };
const hotDealPct = car => (!car.original_price || car.original_price <= car.selling_price) ? null
  : Math.round((car.original_price - car.selling_price) / car.original_price * 100);

const COMP_FIELDS = 13;
function completeness(car) {
  return [
    !!car.mileage, !!car.engine_cc, !!car.transmission, !!car.fuel_type,
    !!car.colour, !!car.body_type, !!car.condition, car.previous_owners != null,
    (car.warranty_months || 0) > 0, !!car.state, !!car.variant,
    Array.isArray(car.images) && car.images.length >= 3,
    Array.isArray(car.car_documents) && car.car_documents.length > 0,
  ].filter(Boolean).length;
}

// Only highlight when 2+ cars have a real value for the field
function smartHL(vals, dir, n) {
  const nums = vals.map(v => (v != null && !isNaN(Number(v))) ? Number(v) : null);
  const valid = nums.filter(x => x != null);
  if (valid.length < 2) return Array(n).fill(null);
  const target = dir === 'low' ? Math.min(...valid) : Math.max(...valid);
  return nums.map(v => v === target ? 'win' : null);
}

// Weighted value score 0–100: mileage 35%, year 30%, price 25%, warranty 5%, grade 5%.
// Each metric normalised to 0–100 across the compared set; ties score 50.
function getValueScore(car, cars) {
  const norm = (val, all, invert) => {
    const vals = all.map(Number).filter(v => !isNaN(v));
    if (vals.length < 2 || val == null) return 50;
    const min = Math.min(...vals), max = Math.max(...vals);
    if (max === min) return 50;
    const pct = (Number(val) - min) / (max - min) * 100;
    return invert ? 100 - pct : pct;
  };
  return Math.round(
    norm(car.selling_price,       cars.map(c => c.selling_price),             true)  * 0.30 +
    norm(car.mileage,             cars.map(c => c.mileage),                   true)  * 0.35 +
    norm(car.year,                cars.map(c => c.year),                      false) * 0.25 +
    norm(car.warranty_months || 0,cars.map(c => c.warranty_months || 0),      false) * 0.05 +
    norm(gradeNum(car.auction_grade), cars.map(c => gradeNum(c.auction_grade)),false) * 0.05
  );
}

function getVerdict(cars) {
  if (cars.length < 2) return null;
  const scores = cars.map(c => getValueScore(c, cars));
  const max = Math.max(...scores);
  return { car: cars[scores.indexOf(max)], score: max, scores };
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Sec({ label }) {
  return (
    <div style={{
      padding: '9px 14px 7px', fontSize: 10, fontWeight: 700,
      color: '#dc2626', letterSpacing: '0.12em', textTransform: 'uppercase',
      background: '#fafafa', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
    }}>{label}</div>
  );
}

function Row({ label, values, highlight, renderCell }) {
  return (
    <div className="cp-row" style={{ display: 'grid', gridTemplateColumns: 'var(--cp-cols)', borderBottom: '1px solid #f1f5f9' }}>
      <div className="cp-lbl">{label}</div>
      {values.map((val, i) => {
        const win = highlight?.[i] === 'win';
        const empty = val == null || val === '—' || val === '' || val === 'None';
        return (
          <div
            key={i}
            className="cp-val"
            data-label={label}
            style={{
              padding: 'clamp(8px,1.5vw,10px) clamp(8px,1.5vw,12px)',
              fontSize: 'clamp(11px,1.6vw,13px)',
              color: win && !empty ? '#16a34a' : empty ? '#d1d5db' : '#374151',
              fontWeight: win && !empty ? 600 : 400,
              background: win && !empty ? 'rgba(22,163,74,0.04)' : 'transparent',
              borderLeft: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden',
            }}
          >
            {renderCell ? renderCell(val, i, win) : (val ?? '—')}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

const PARAM_KEYS = ['a', 'b', 'c', 'd'];

export default function ComparePage() {
  useMarketplaceTracking();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ids = PARAM_KEYS.map(k => searchParams.get(k)).filter(Boolean).slice(0, 4);

  useEffect(() => {
    if (!ids.length) { setLoading(false); return; }
    supabase.from('public_car_listings').select(SELECT_COLS).in('id', ids)
      .then(({ data }) => {
        setCars(ids.map(id => (data || []).find(c => c.id === id)).filter(Boolean));
        setLoading(false);
      });
  }, [ids.join(',')]);

  const removeCar = id => {
    const rem = cars.filter(c => c.id !== id);
    const p = new URLSearchParams();
    rem.forEach((c, i) => p.set(PARAM_KEYS[i], c.id));
    setSearchParams(p);
    setCars(rem);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const n = cars.length;
  const hasRecon = cars.some(c => c.is_recon);
  const verdict = getVerdict(cars);

  const verdictReasons = (() => {
    if (!verdict || cars.length < 2) return '';
    const winIdx  = cars.indexOf(verdict.car);
    const winner  = verdict.car;
    const runnerUp = cars
      .map((c, i) => ({ c, score: verdict.scores[i] }))
      .filter((_, i) => i !== winIdx)
      .sort((a, b) => b.score - a.score)[0]?.c;
    if (!runnerUp) return 'best overall value';
    const priceDiff = (runnerUp.selling_price || 0) - (winner.selling_price || 0);
    const kmDiff    = (runnerUp.mileage || 0)        - (winner.mileage || 0);
    const yrDiff    = (winner.year || 0)             - (runnerUp.year || 0);
    // Clean sweep: cheaper, less km, and same-or-newer
    if (priceDiff >= 0 && kmDiff >= 0 && yrDiff >= 0) {
      const parts = [];
      if (priceDiff > 500)  parts.push(`RM ${priceDiff.toLocaleString('en-MY')} cheaper`);
      if (kmDiff > 5000)    parts.push(`${Math.round(kmDiff / 1000)}k fewer km`);
      if (yrDiff > 0)       parts.push(`${yrDiff} yr newer`);
      return parts.length
        ? parts.join(' · ') + ` than the ${runnerUp.year} ${runnerUp.model}`
        : 'best overall value';
    }
    // Costs more but wins on condition/age
    if (priceDiff < 0) {
      const monthly = Math.round(Math.abs(priceDiff) * 0.9 * 1.245 / 84);
      const gains = [];
      if (kmDiff > 10000) gains.push(`${Math.round(kmDiff / 1000)}k fewer km`);
      if (yrDiff > 0)     gains.push(`${yrDiff} yr newer`);
      if (gains.length)
        return `${gains.join(' + ')} for only RM ${monthly}/mo more than the ${runnerUp.year} ${runnerUp.model}`;
    }
    // Mixed — surface specific wins
    const gains = [];
    if (smartHL(cars.map(c => c.mileage),            'low',  n)[winIdx] === 'win') gains.push('lowest mileage');
    if (smartHL(cars.map(c => c.year),               'high', n)[winIdx] === 'win') gains.push('newest year');
    if (smartHL(cars.map(c => c.warranty_months||0), 'high', n)[winIdx] === 'win') gains.push('best warranty');
    return gains.length ? gains.join(', ') : 'best balance of price, mileage, and age';
  })();

  const loanHL = (() => {
    const elig = cars.map(c => c.loan_eligible !== false);
    if (elig.every(Boolean)) return Array(n).fill(null);
    return elig.map(e => e ? 'win' : null);
  })();

  // ── Loading / empty ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <MarketplaceHeader />
        <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 72 }}>
          <div style={{ width: 28, height: 28, border: '2px solid #e5e7eb', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>
    );
  }

  if (!n) {
    return (
      <>
        <MarketplaceHeader />
        <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'DM Sans',sans-serif", paddingTop: 72 }}>
          <p style={{ fontSize: 16, color: '#6b7280' }}>No cars selected to compare.</p>
          <Link to="/showroom" style={{ color: '#dc2626', fontSize: 14, fontWeight: 600 }}>Browse cars →</Link>
        </div>
      </>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const slotCols = n < 4 ? n + 1 : n;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .cp-row:hover .cp-val { background: #f9fafb !important; }
        .cp-lbl {
          padding: clamp(8px,1.5vw,10px) clamp(8px,1.5vw,14px);
          font-size: 11px; color: #9ca3af; font-weight: 500;
          display: flex; align-items: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        @media (max-width: 520px) {
          .cp-lbl { display: none !important; }
          .cp-rows { --cp-cols: repeat(${n}, 1fr) !important; }
          /* Block layout so ::before stacks above value, not beside it */
          .cp-val {
            display: block !important;
            overflow: visible !important;
            border-left: none !important;
            padding: 7px 8px !important;
          }
          .cp-val::before {
            content: attr(data-label);
            display: block; font-size: 9px; color: #b0b7c3;
            text-transform: uppercase; letter-spacing: 0.08em;
            font-weight: 700; margin-bottom: 2px; white-space: nowrap;
          }
          /* Hide Add Car slot on mobile — 3+ cars already fills width */
          .cp-add-slot { display: none !important; }
          /* Strip grid: n columns only (no add slot column) */
          .cp-strip-grid { grid-template-columns: repeat(${n}, 1fr) !important; }
        }
      `}</style>

      <MarketplaceHeader />

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "'DM Sans',sans-serif", paddingTop: 72, paddingBottom: 64 }}>

        {/* ── Page title ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 3px' }}>Side by Side</p>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(26px,5vw,38px)', letterSpacing: 2, lineHeight: 1, color: '#111827', margin: 0 }}>
              Compare Cars
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/showroom" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', fontWeight: 500 }}>← All Cars</Link>
            <button
              onClick={handleShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: copied ? 'rgba(22,163,74,0.08)' : 'white',
                border: `1px solid ${copied ? 'rgba(22,163,74,0.3)' : '#DDE3EC'}`,
                color: copied ? '#16a34a' : '#6b7280', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {copied ? <Check size={12} /> : <Share2 size={12} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* ── Sticky car strip ── */}
        <div style={{
          position: 'sticky', top: 64, zIndex: 40,
          background: 'white', borderBottom: '2px solid #e5e7eb',
          boxShadow: scrolled ? '0 3px 14px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.3s',
        }}>

          {/* ── Expanded strip (at top) ── */}
          <div style={{
            maxWidth: 1100, margin: '0 auto', padding: '10px 16px',
            maxHeight: scrolled ? 0 : 600,
            opacity: scrolled ? 0 : 1,
            overflow: 'hidden',
            transition: 'max-height 0.35s ease, opacity 0.2s ease',
            pointerEvents: scrolled ? 'none' : 'auto',
          }}>
            <div className="cp-strip-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${slotCols}, 1fr)`, gap: 'clamp(6px,2vw,12px)' }}>
              {cars.map(car => {
                const img = car.images?.[0];
                const pct = hotDealPct(car);
                const monthly = calcMonthly(car.selling_price);
                const isVerdict = verdict?.car.id === car.id;
                return (
                  <div key={car.id} style={{ minWidth: 0 }}>
                    <div style={{
                      position: 'relative', aspectRatio: '16/9', borderRadius: 8,
                      overflow: 'hidden', background: '#f3f4f6', marginBottom: 6,
                      border: isVerdict ? '2px solid rgba(220,38,38,0.5)' : '1px solid #e5e7eb',
                    }}>
                      {img
                        ? <img src={img} alt={car.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚗</div>
                      }
                      {pct && (
                        <div style={{ position: 'absolute', top: 4, left: 4, display: 'flex', alignItems: 'center', gap: 2, background: '#dc2626', borderRadius: 4, padding: '2px 5px' }}>
                          <Flame size={8} color="white" />
                          <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>-{pct}%</span>
                        </div>
                      )}
                      {isVerdict && (
                        <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(220,38,38,0.92)', borderRadius: 4, padding: '2px 6px' }}>
                          <Trophy size={8} color="white" />
                          <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>Best Value</span>
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3 }}>
                        <HeartButton listingId={car.id} size={11} style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 5, padding: '3px 5px', backdropFilter: 'blur(4px)' }} />
                        <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 5, color: '#6b7280', cursor: 'pointer', padding: '3px 5px', display: 'flex', backdropFilter: 'blur(4px)' }}>
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{car.brand}</p>
                    <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(12px,2.2vw,17px)', color: '#111827', letterSpacing: 1, lineHeight: 1.1, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {car.year} {car.model}
                    </p>
                    {pct && <p style={{ fontSize: 9, color: '#9ca3af', textDecoration: 'line-through', margin: '0 0 1px' }}>{fmtRM(car.original_price)}</p>}
                    <p style={{ fontSize: 'clamp(11px,1.8vw,13px)', fontWeight: 700, color: pct ? '#dc2626' : '#111827', margin: 0 }}>{fmtRM(car.selling_price)}</p>
                    {monthly && <p style={{ fontSize: 9, color: '#9ca3af', margin: '1px 0 3px' }}>~RM {monthly.toLocaleString()}/mo</p>}
                    {car.slug && (
                      <Link to={`/showroom/${car.slug}`} style={{ fontSize: 9, color: '#dc2626', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        View <ExternalLink size={8} />
                      </Link>
                    )}
                  </div>
                );
              })}
              {n < 4 && (
                <Link
                  className="cp-add-slot"
                  to="/showroom"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    aspectRatio: '1/1', maxHeight: 110, border: '1.5px dashed #d1d5db',
                    borderRadius: 10, color: '#9ca3af', textDecoration: 'none', gap: 5,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
                >
                  <Plus size={18} />
                  <span style={{ fontSize: 10, fontWeight: 600 }}>Add Car</span>
                </Link>
              )}
            </div>
          </div>

          {/* ── Collapsed mini bar (on scroll) ── */}
          <div style={{
            maxWidth: 1100, margin: '0 auto',
            maxHeight: scrolled ? 80 : 0,
            opacity: scrolled ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.35s ease, opacity 0.2s ease 0.1s',
            pointerEvents: scrolled ? 'auto' : 'none',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 8, padding: '7px 16px' }}>
              {cars.map(car => {
                const img = car.images?.[0];
                const isVerdict = verdict?.car.id === car.id;
                return (
                  <div key={car.id} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div style={{
                      width: 48, height: 34, borderRadius: 5, overflow: 'hidden', flexShrink: 0,
                      background: '#f3f4f6',
                      border: isVerdict ? '2px solid rgba(220,38,38,0.45)' : '1px solid #e5e7eb',
                    }}>
                      {img
                        ? <img src={img} alt={car.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🚗</div>
                      }
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 'clamp(9px,1.4vw,11px)', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                        {car.year} {car.model}
                      </p>
                      <p style={{ margin: 0, fontSize: 'clamp(9px,1.3vw,11px)', color: isVerdict ? '#dc2626' : '#6b7280', fontWeight: 600 }}>
                        {fmtRM(car.selling_price)}
                      </p>
                    </div>
                    {isVerdict && <Trophy size={11} color="#dc2626" style={{ flexShrink: 0 }} />}
                    <button onClick={() => removeCar(car.id)} style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Comparison rows ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 16px 0' }}>
          <div
            className="cp-rows"
            style={{ '--cp-cols': `75px repeat(${n}, 1fr)`, background: 'white', borderRadius: 12, border: '1px solid #DDE3EC', overflow: 'hidden' }}
          >

            <Sec label="Pricing" />
            <Row label="Asking Price" values={cars.map(c => fmtRM(c.selling_price))} highlight={smartHL(cars.map(c => c.selling_price), 'low', n)} />
            <Row label="Monthly Est." values={cars.map(c => { const m = calcMonthly(c.selling_price); return m ? `RM ${m.toLocaleString()}` : '—'; })} />
            {cars.some(c => c.market_avg_price) && (
              <Row
                label="Market Signal"
                values={cars.map(c => {
                  if (!c.market_avg_price || !c.selling_price) return '—';
                  return c.selling_price <= c.market_avg_price * 0.93 ? 'below'
                       : c.selling_price >= c.market_avg_price * 1.07 ? 'above' : 'fair';
                })}
                renderCell={val => {
                  if (val === '—') return <span style={{ color: '#d1d5db' }}>—</span>;
                  const cfg = {
                    below: { bg: 'rgba(22,163,74,0.1)',  color: '#15803d', label: '▼ Below Market' },
                    fair:  { bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8', label: '● Fair Price'   },
                    above: { bg: 'rgba(217,119,6,0.1)',  color: '#b45309', label: '▲ Above Market' },
                  }[val];
                  return (
                    <span style={{ display:'inline-flex', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:cfg.bg, color:cfg.color }}>
                      {cfg.label}
                    </span>
                  );
                }}
              />
            )}

            <Sec label="Basics" />
            <Row label="Year" values={cars.map(c => c.year || '—')} highlight={smartHL(cars.map(c => c.year), 'high', n)} />
            <Row
              label="Mileage"
              values={cars.map(c => c.mileage ? `${Number(c.mileage).toLocaleString()} km` : '—')}
              highlight={smartHL(cars.map(c => c.mileage), 'low', n)}
            />
            <Row label="Condition" values={cars.map(c => c.condition || '—')} />
            <Row
              label="Prev. Owners"
              values={cars.map(c => c.previous_owners != null ? String(c.previous_owners) : '—')}
              highlight={smartHL(cars.map(c => c.previous_owners), 'low', n)}
            />
            <Row label="Location" values={cars.map(c => [c.city, c.state].filter(Boolean).join(', ') || '—')} />

            <Sec label="Specs" />
            <Row label="Engine CC" values={cars.map(c => c.engine_cc ? `${Number(c.engine_cc).toLocaleString()} cc` : '—')} />
            <Row label="Transmission" values={cars.map(c => c.transmission || '—')} />
            <Row label="Fuel Type" values={cars.map(c => c.fuel_type || '—')} />
            <Row label="Colour" values={cars.map(c => c.colour || '—')} />
            <Row label="Body Type" values={cars.map(c => c.body_type || '—')} />

            {hasRecon && (
              <>
                <Sec label="Recon / Import" />
                <Row label="Recon" values={cars.map(c => c.is_recon ? 'Yes' : 'No')} />
                <Row label="Country" values={cars.map(c => c.import_country || '—')} />
                <Row label="Ext. Grade" values={cars.map(c => c.auction_grade || '—')} highlight={smartHL(cars.map(c => gradeNum(c.auction_grade)), 'high', n)} />
                <Row label="Int. Grade" values={cars.map(c => c.interior_grade || '—')} highlight={smartHL(cars.map(c => gradeNum(c.interior_grade)), 'high', n)} />
                <Row
                  label="Chassis"
                  values={cars.map(c => c.chassis_status || '—')}
                  renderCell={val => (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: val === 'clean' ? '#22c55e' : val === 'repaired' ? '#eab308' : val === 'written_off' ? '#dc2626' : '#d1d5db' }} />
                      {val || '—'}
                    </span>
                  )}
                />
              </>
            )}

            <Sec label="Trust & Value" />
            <Row
              label="Value Score"
              values={cars.map(c => String(getValueScore(c, cars)))}
              highlight={smartHL(cars.map(c => getValueScore(c, cars)), 'high', n)}
              renderCell={(val, i, win) => {
                const score = getValueScore(cars[i], cars);
                return (
                  <div style={{ width: '100%', minWidth: 0 }}>
                    <span style={{ fontSize: 'clamp(10px,1.6vw,12px)', fontWeight: win ? 700 : 400, color: win ? '#dc2626' : '#374151' }}>{score}</span>
                    <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${score}%`, background: win ? '#dc2626' : '#d1d5db', borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              }}
            />
            <Row
              label="Documents"
              values={cars.map(c => { const cnt = Array.isArray(c.car_documents) ? c.car_documents.length : 0; return cnt > 0 ? `${cnt} doc${cnt !== 1 ? 's' : ''}` : 'None'; })}
              highlight={smartHL(cars.map(c => Array.isArray(c.car_documents) ? c.car_documents.length : 0), 'high', n)}
            />
            <Row
              label="Warranty"
              values={cars.map(c => c.warranty_months > 0 ? `${c.warranty_months} mo` : 'None')}
              highlight={smartHL(cars.map(c => c.warranty_months || 0), 'high', n)}
            />
            <Row label="Loan Eligible" values={cars.map(c => c.loan_eligible === false ? 'No' : 'Yes')} highlight={loanHL} />
            <Row
              label="Days Listed"
              values={cars.map(c => ageDays(c.created_at) != null ? `${ageDays(c.created_at)}d` : '—')}
              highlight={smartHL(cars.map(c => ageDays(c.created_at)), 'low', n)}
            />
            <Row
              label="Listing Score"
              values={cars.map(c => `${Math.round(completeness(c) / COMP_FIELDS * 100)}%`)}
              highlight={smartHL(cars.map(c => completeness(c)), 'high', n)}
              renderCell={(val, i, win) => {
                const pct = completeness(cars[i]) / COMP_FIELDS * 100;
                return (
                  <div style={{ width: '100%', minWidth: 0 }}>
                    <span style={{ fontSize: 'clamp(10px,1.6vw,12px)', fontWeight: win ? 600 : 400 }}>{Math.round(pct)}%</span>
                    <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: win ? '#16a34a' : '#d1d5db', borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              }}
            />

          </div>

          {/* ── Verdict ── */}
          {verdict && (
            <div style={{ marginTop: 14, background: 'white', border: '1px solid #DDE3EC', borderLeft: '3px solid #dc2626', borderRadius: 12, padding: 'clamp(14px,3vw,22px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Trophy size={13} color="#dc2626" />
                <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, margin: 0 }}>Our Verdict</p>
              </div>
              <p style={{ fontSize: 'clamp(13px,2vw,15px)', color: '#374151', lineHeight: 1.65, margin: '0 0 14px' }}>
                <strong style={{ color: '#111827' }}>{[verdict.car.year, verdict.car.brand, verdict.car.model].filter(Boolean).join(' ')}</strong>
                {' '}offers the best overall value — {verdictReasons} compared to the alternatives.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cars.map(car => car.slug && (
                  <Link
                    key={car.id}
                    to={`/showroom/${car.slug}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: car.id === verdict.car.id ? 'rgba(220,38,38,0.06)' : '#f3f4f6',
                      border: `1px solid ${car.id === verdict.car.id ? 'rgba(220,38,38,0.25)' : '#e5e7eb'}`,
                      color: car.id === verdict.car.id ? '#dc2626' : '#6b7280',
                      textDecoration: 'none',
                    }}
                  >
                    {car.id === verdict.car.id && <Trophy size={10} />}
                    {[car.year, car.brand, car.model].filter(Boolean).join(' ')} →
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <MarketplaceFooter />
    </>
  );
}
