import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { X, Share2, Check, ExternalLink, Flame, Trophy } from 'lucide-react';
import { supabase } from '../supabaseClient';
import HeartButton from '../components/HeartButton';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';

const SELECT_COLS = [
  'id','slug','year','brand','model','variant',
  'selling_price','original_price','mileage','transmission',
  'fuel_type','body_type','engine_cc','colour','condition',
  'state','city','is_recon','auction_grade','interior_grade',
  'import_country','chassis_status','car_documents','warranty_months',
  'loan_eligible','previous_owners','created_at','images','status',
].join(', ');

const calcMonthly = (p) =>
  p > 0 ? Math.round((p * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12)) : null;

const fmtRM = (n) =>
  n != null ? `RM ${Number(n).toLocaleString('en-MY')}` : '—';

const ageDays = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

function winnerIdx(values, direction = 'low') {
  const nums = values.map((v) => (v != null && !isNaN(Number(v)) ? Number(v) : null));
  if (nums.every((n) => n == null)) return -1;
  const valid = nums.filter((n) => n != null);
  const target = direction === 'low' ? Math.min(...valid) : Math.max(...valid);
  return nums.findIndex((n) => n === target);
}

function gradeNum(g) {
  if (!g) return null;
  const m = String(g).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function hotDealPct(car) {
  if (!car.original_price || car.original_price <= car.selling_price) return null;
  return Math.round((car.original_price - car.selling_price) / car.original_price * 100);
}

// ─── Table primitives ─────────────────────────────────────────────────────────

function Row({ label, values, highlight, renderCell }) {
  return (
    <tr className="cp-row">
      <td className="cp-label">
        {label}
      </td>
      {values.map((val, i) => {
        const isWin = highlight?.[i] === 'win';
        const isLose = highlight?.[i] === 'lose';
        return (
          <td
            key={i}
            className="cp-cell"
            data-label={label}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              color: isWin ? '#16a34a' : isLose ? '#dc2626' : '#374151',
              borderBottom: '1px solid #f1f5f9',
              verticalAlign: 'middle',
              fontWeight: isWin || isLose ? 600 : 400,
              background: isWin ? 'rgba(22,163,74,0.04)' : 'transparent',
              minWidth: 0,
            }}
          >
            {renderCell ? renderCell(val, i) : (val ?? '—')}
          </td>
        );
      })}
    </tr>
  );
}

function SectionHeader({ label, colSpan }) {
  return (
    <tr>
      <td
        colSpan={colSpan + 1}
        style={{
          padding: '12px 16px 8px',
          fontSize: 10,
          fontWeight: 700,
          color: '#dc2626',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: '#fafafa',
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {label}
      </td>
    </tr>
  );
}

// ─── Highlight helpers that return 'win' | 'lose' | null ─────────────────────

function priceHL(cars) {
  const idx = winnerIdx(cars.map((c) => c.selling_price), 'low');
  return cars.map((_, i) => i === idx ? 'win' : null);
}
function mileHL(cars) {
  const lo = winnerIdx(cars.map((c) => c.mileage), 'low');
  const hi = winnerIdx(cars.map((c) => c.mileage), 'high');
  return cars.map((_, i) => i === lo ? 'win' : i === hi ? 'lose' : null);
}
function highHL(vals, cars) {
  const idx = winnerIdx(vals, 'high');
  return cars.map((_, i) => i === idx ? 'win' : null);
}
function lowHL(vals, cars) {
  const idx = winnerIdx(vals, 'low');
  return cars.map((_, i) => i === idx ? 'win' : null);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const paramKeys = ['a', 'b', 'c'];
  const ids = paramKeys.map((k) => searchParams.get(k)).filter(Boolean);

  useEffect(() => {
    if (!ids.length) { setLoading(false); return; }
    supabase
      .from('car_listings')
      .select(SELECT_COLS)
      .in('id', ids)
      .then(({ data }) => {
        const ordered = ids.map((id) => (data || []).find((c) => c.id === id)).filter(Boolean);
        setCars(ordered);
        setLoading(false);
      });
  }, [ids.join(',')]);

  const removeCar = (id) => {
    const remaining = cars.filter((c) => c.id !== id);
    const newParams = new URLSearchParams();
    remaining.forEach((c, i) => newParams.set(paramKeys[i], c.id));
    setSearchParams(newParams);
    setCars(remaining);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const n = cars.length;
  const hasRecon = cars.some((c) => c.is_recon);

  // Verdict
  const verdictCar = (() => {
    if (n < 2) return null;
    const scores = cars.map(() => 0);
    const bump = (idx) => { if (idx >= 0 && idx < scores.length) scores[idx]++; };
    bump(winnerIdx(cars.map((c) => c.selling_price), 'low'));
    bump(winnerIdx(cars.map((c) => c.mileage), 'low'));
    bump(winnerIdx(cars.map((c) => c.year), 'high'));
    bump(winnerIdx(cars.map((c) => gradeNum(c.auction_grade)), 'high'));
    bump(winnerIdx(cars.map((c) => gradeNum(c.interior_grade)), 'high'));
    bump(winnerIdx(cars.map((c) => c.warranty_months || 0), 'high'));
    bump(winnerIdx(cars.map((c) => ageDays(c.created_at)), 'low'));
    const maxScore = Math.max(...scores);
    const idx = scores.indexOf(maxScore);
    return { car: cars[idx], score: maxScore };
  })();

  const verdictReason = (car) => {
    const i = cars.indexOf(car);
    const parts = [];
    if (winnerIdx(cars.map((c) => c.selling_price), 'low') === i) parts.push('lowest asking price');
    if (winnerIdx(cars.map((c) => c.mileage), 'low') === i) parts.push('lowest mileage');
    if (winnerIdx(cars.map((c) => c.year), 'high') === i) parts.push('newest year');
    return parts.length ? parts.join(', ') : 'most competitive overall value';
  };

  // ─── Loading / empty states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <MarketplaceHeader />
        <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 72 }}>
          <div style={{ width: 32, height: 32, border: '2px solid #e5e7eb', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .cp-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
        .cp-table { border-collapse: collapse; width: 100%; }
        .cp-row:hover td { background: #f9fafb !important; }
        .cp-label {
          position: sticky; left: 0; z-index: 2;
          background: white; padding: 10px 14px;
          font-size: 12px; color: #6b7280;
          white-space: nowrap; border-bottom: 1px solid #f1f5f9;
          width: 110px; min-width: 110px; font-weight: 500;
        }
        @media (max-width: 600px) {
          .cp-label { display: none !important; }
          .cp-cell::before {
            content: attr(data-label);
            display: block; font-size: 10px; color: #9ca3af;
            text-transform: uppercase; letter-spacing: 0.08em;
            font-weight: 600; margin-bottom: 2px;
          }
          .cp-table { table-layout: auto; }
          .cp-col-header { padding: 14px 10px 12px !important; }
        }
      `}</style>

      <MarketplaceHeader />

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "'DM Sans',sans-serif", paddingBottom: 64 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(16px,4vw,32px) clamp(12px,4vw,20px)', paddingTop: 'calc(72px + clamp(16px,4vw,32px))' }}>

          {/* ── Page header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 4px' }}>Side by Side</p>
              <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(28px,5vw,40px)', letterSpacing: 2, lineHeight: 1, color: '#111827', margin: 0 }}>
                Compare Cars
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link to="/showroom" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', fontWeight: 500 }}>← All Cars</Link>
              <button
                onClick={handleShare}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: copied ? 'rgba(22,163,74,0.08)' : 'white',
                  border: `1px solid ${copied ? 'rgba(22,163,74,0.3)' : '#DDE3EC'}`,
                  color: copied ? '#16a34a' : '#6b7280', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {copied ? <Check size={13} /> : <Share2 size={13} />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>

          {/* ── Comparison table ── */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #DDE3EC', overflow: 'hidden' }}>
            <div className="cp-wrap">
              <table className="cp-table" style={{ minWidth: 110 + n * 180 }}>
                <colgroup>
                  <col style={{ width: 110 }} />
                  {cars.map((c) => <col key={c.id} />)}
                </colgroup>

                {/* ── Car headers ── */}
                <thead>
                  <tr style={{ background: 'white', borderBottom: '1px solid #e5e7eb' }}>
                    <th className="cp-label" style={{ background: 'white', border: 'none', borderBottom: '1px solid #e5e7eb' }} />
                    {cars.map((car) => {
                      const img = car.images?.[0];
                      const pct = hotDealPct(car);
                      const monthly = calcMonthly(car.selling_price);
                      return (
                        <th key={car.id} className="cp-col-header" style={{ padding: '20px 16px 16px', verticalAlign: 'top', minWidth: 180, borderLeft: '1px solid #f1f5f9', textAlign: 'left', fontWeight: 400 }}>
                          {/* Photo */}
                          <div style={{ position: 'relative', marginBottom: 12 }}>
                            <div style={{ aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', background: '#f3f4f6' }}>
                              {img
                                ? <img src={img} alt={car.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🚗</div>
                              }
                            </div>
                            {/* Hot deal badge */}
                            {pct && (
                              <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: 3, background: '#dc2626', borderRadius: 5, padding: '2px 7px' }}>
                                <Flame size={9} color="white" />
                                <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>-{pct}%</span>
                              </div>
                            )}
                            {/* Remove + save controls */}
                            <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                              <HeartButton listingId={car.id} size={14} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 6, padding: '4px 6px', backdropFilter: 'blur(4px)' }} />
                              <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: 6, color: '#6b7280', cursor: 'pointer', padding: '4px 6px', display: 'flex', backdropFilter: 'blur(4px)' }}>
                                <X size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Brand */}
                          <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 2px', fontWeight: 700 }}>{car.brand}</p>
                          {/* Name */}
                          <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(16px,2.5vw,20px)', color: '#111827', letterSpacing: 1, lineHeight: 1.1, margin: '0 0 8px' }}>
                            {[car.year, car.model, car.variant].filter(Boolean).join(' ')}
                          </p>

                          {/* Price block */}
                          <div style={{ marginBottom: 4 }}>
                            {pct && (
                              <p style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through', margin: '0 0 1px' }}>
                                {fmtRM(car.original_price)}
                              </p>
                            )}
                            <p style={{ fontSize: 17, fontWeight: 700, color: pct ? '#dc2626' : '#111827', margin: 0 }}>{fmtRM(car.selling_price)}</p>
                          </div>
                          {monthly && (
                            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px' }}>
                              ~RM {monthly.toLocaleString()}/mo est.
                            </p>
                          )}

                          {car.slug && (
                            <Link to={`/showroom/${car.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#dc2626', textDecoration: 'none', fontWeight: 600 }}>
                              View listing <ExternalLink size={10} />
                            </Link>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* ── PRICING ── */}
                  <SectionHeader label="Pricing" colSpan={n} />
                  <Row
                    label="Asking Price"
                    values={cars.map((c) => fmtRM(c.selling_price))}
                    highlight={priceHL(cars)}
                  />
                  <Row
                    label="Monthly Est."
                    values={cars.map((c) => { const m = calcMonthly(c.selling_price); return m ? `RM ${m.toLocaleString()}` : '—'; })}
                  />

                  {/* ── BASICS ── */}
                  <SectionHeader label="Basics" colSpan={n} />
                  <Row label="Year" values={cars.map((c) => c.year || '—')} highlight={highHL(cars.map((c) => c.year), cars)} />
                  <Row
                    label="Mileage"
                    values={cars.map((c) => c.mileage ? `${Number(c.mileage).toLocaleString()} km` : '—')}
                    highlight={mileHL(cars)}
                  />
                  <Row label="Condition" values={cars.map((c) => c.condition || '—')} />
                  <Row
                    label="Prev. Owners"
                    values={cars.map((c) => c.previous_owners != null ? String(c.previous_owners) : '—')}
                    highlight={lowHL(cars.map((c) => c.previous_owners), cars)}
                  />
                  <Row label="Location" values={cars.map((c) => [c.city, c.state].filter(Boolean).join(', ') || '—')} />

                  {/* ── SPECS ── */}
                  <SectionHeader label="Specs" colSpan={n} />
                  <Row label="Engine CC" values={cars.map((c) => c.engine_cc ? `${Number(c.engine_cc).toLocaleString()} cc` : '—')} />
                  <Row label="Transmission" values={cars.map((c) => c.transmission || '—')} />
                  <Row label="Fuel Type" values={cars.map((c) => c.fuel_type || '—')} />
                  <Row label="Colour" values={cars.map((c) => c.colour || '—')} />
                  <Row label="Body Type" values={cars.map((c) => c.body_type || '—')} />

                  {/* ── RECON ── */}
                  {hasRecon && (
                    <>
                      <SectionHeader label="Recon / Import" colSpan={n} />
                      <Row label="Recon" values={cars.map((c) => c.is_recon ? 'Yes' : 'No')} />
                      <Row label="Country" values={cars.map((c) => c.import_country || '—')} />
                      <Row
                        label="Ext. Grade"
                        values={cars.map((c) => c.auction_grade || '—')}
                        highlight={highHL(cars.map((c) => gradeNum(c.auction_grade)), cars)}
                      />
                      <Row
                        label="Int. Grade"
                        values={cars.map((c) => c.interior_grade || '—')}
                        highlight={highHL(cars.map((c) => gradeNum(c.interior_grade)), cars)}
                      />
                      <Row
                        label="Chassis"
                        values={cars.map((c) => c.chassis_status || '—')}
                        renderCell={(val) => (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: val === 'clean' ? '#22c55e' : val === 'repaired' ? '#eab308' : val === 'written_off' ? '#dc2626' : '#d1d5db' }} />
                            {val || '—'}
                          </span>
                        )}
                      />
                    </>
                  )}

                  {/* ── TRUST ── */}
                  <SectionHeader label="Trust & Value" colSpan={n} />
                  <Row
                    label="Verified Docs"
                    values={cars.map((c) => Array.isArray(c.car_documents) && c.car_documents.length > 0 ? '✓' : '—')}
                    highlight={cars.map((c) => Array.isArray(c.car_documents) && c.car_documents.length > 0 ? 'win' : null)}
                  />
                  <Row
                    label="Warranty"
                    values={cars.map((c) => c.warranty_months > 0 ? `${c.warranty_months} mo` : 'None')}
                    highlight={highHL(cars.map((c) => c.warranty_months || 0), cars)}
                  />
                  <Row
                    label="Days Listed"
                    values={cars.map((c) => ageDays(c.created_at) != null ? `${ageDays(c.created_at)}d` : '—')}
                    highlight={lowHL(cars.map((c) => ageDays(c.created_at)), cars)}
                  />
                  <Row
                    label="Loan Eligible"
                    values={cars.map((c) => c.loan_eligible === false ? 'No' : 'Yes')}
                    highlight={cars.map((c) => c.loan_eligible !== false ? 'win' : null)}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Verdict ── */}
          {verdictCar && (
            <div style={{ marginTop: 16, background: 'white', border: '1px solid #DDE3EC', borderLeft: '3px solid #dc2626', borderRadius: 12, padding: 'clamp(16px,3vw,24px) clamp(16px,3vw,24px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Trophy size={14} color="#dc2626" />
                <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, margin: 0 }}>Our Verdict</p>
              </div>
              <p style={{ fontSize: 'clamp(13px,2vw,15px)', color: '#374151', lineHeight: 1.65, margin: '0 0 16px' }}>
                <strong style={{ color: '#111827' }}>
                  {[verdictCar.car.year, verdictCar.car.brand, verdictCar.car.model].filter(Boolean).join(' ')}
                </strong>
                {' '}offers the best overall value — {verdictReason(verdictCar.car)} compared to the alternatives.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cars.map((car) =>
                  car.slug && (
                    <Link
                      key={car.id}
                      to={`/showroom/${car.slug}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: car.id === verdictCar.car.id ? 'rgba(220,38,38,0.06)' : '#f3f4f6',
                        border: `1px solid ${car.id === verdictCar.car.id ? 'rgba(220,38,38,0.25)' : '#e5e7eb'}`,
                        color: car.id === verdictCar.car.id ? '#dc2626' : '#6b7280',
                        textDecoration: 'none',
                      }}
                    >
                      {car.id === verdictCar.car.id && <Trophy size={11} />}
                      {[car.year, car.brand, car.model].filter(Boolean).join(' ')} →
                    </Link>
                  )
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <MarketplaceFooter />
    </>
  );
}
