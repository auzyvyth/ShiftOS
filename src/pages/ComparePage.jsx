import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { X, Share2, Check, ExternalLink, Plus, MessageCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import HeartButton from '../components/HeartButton';
import { useCompare } from '../hooks/useCompare';

const SELECT_COLS = [
  'id','slug','year','brand','model','variant',
  'selling_price','original_price','mileage','transmission',
  'fuel_type','body_type','engine_cc','colour','condition',
  'state','city','is_recon','auction_grade','interior_grade',
  'import_country','chassis_status','car_documents','warranty_months',
  'loan_eligible','previous_owners','created_at','images','status','dealer_id',
].join(', ');

const calcMonthly = (p) =>
  p > 0 ? Math.round((p * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12)) : null;

const fmtRM = (n) =>
  n != null ? `RM ${Number(n).toLocaleString('en-MY')}` : '—';

const ageDays = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

// ─── Cell highlight helpers ───────────────────────────────────────────────────

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

// ─── Row component ────────────────────────────────────────────────────────────

function Row({ label, values, highlight, renderCell }) {
  return (
    <tr>
      <td
        className="cp-label-col"
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 2,
          background: '#0a1220',
          padding: '10px 14px',
          fontSize: 12,
          color: '#6b7280',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          width: 120,
          minWidth: 120,
        }}
      >
        {label}
      </td>
      {values.map((val, i) => {
        const color = highlight?.[i];
        return (
          <td
            key={i}
            className="cp-cell"
            data-label={label}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              color: color || '#d1d5db',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              verticalAlign: 'middle',
              minWidth: 160,
              fontWeight: color ? 600 : 400,
            }}
          >
            {renderCell ? renderCell(val, i) : (val ?? '—')}
          </td>
        );
      })}
    </tr>
  );
}

function MobileSpecRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: color || '#d1d5db', fontWeight: color ? 600 : 400, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

function MobileSectionDiv({ label }) {
  return (
    <div style={{ padding: '12px 0 6px', fontSize: 10, fontWeight: 700, color: '#dc2626', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid rgba(220,38,38,0.12)', marginTop: 4 }}>
      {label}
    </div>
  );
}

function SectionHeader({ label, colSpan }) {
  return (
    <tr>
      <td
        colSpan={colSpan + 1}
        className="cp-section-td"
        style={{
          padding: '14px 14px 8px',
          fontSize: 10,
          fontWeight: 700,
          color: '#dc2626',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          background: 'rgba(220,38,38,0.04)',
          borderBottom: '1px solid rgba(220,38,38,0.12)',
          position: 'sticky',
          left: 0,
        }}
      >
        {label}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { removeFromCompare } = useCompare();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [aiVerdict, setAiVerdict] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [whatsappMap, setWhatsappMap] = useState({});

  const paramKeys = ['a', 'b', 'c', 'd'];
  const slugs = paramKeys.map((k) => searchParams.get(k)).filter(Boolean);

  useEffect(() => {
    if (!slugs.length) { setLoading(false); return; }
    supabase
      .from('car_listings')
      .select(SELECT_COLS)
      .in('slug', slugs)
      .then(({ data }) => {
        // preserve URL param order
        const ordered = slugs.map((slug) => (data || []).find((c) => c.slug === slug)).filter(Boolean);
        setCars(ordered);
        setLoading(false);
      });
  }, [slugs.join(',')]);

  useEffect(() => {
    const dealerIds = [...new Set(cars.map((c) => c.dealer_id).filter(Boolean))];
    if (!dealerIds.length) return;
    supabase
      .from('profiles')
      .select('id, whatsapp_number')
      .in('id', dealerIds)
      .then(({ data }) => {
        if (!data) return;
        setWhatsappMap(Object.fromEntries(data.map((p) => [p.id, p.whatsapp_number])));
      });
  }, [cars]);

  const removeCar = (id) => {
    removeFromCompare(id);
    const remaining = cars.filter((c) => c.id !== id);
    const newParams = new URLSearchParams();
    remaining.forEach((c, i) => newParams.set(paramKeys[i], c.slug));
    setSearchParams(newParams);
    setCars(remaining);
  };

  useEffect(() => {
    if (cars.length < 2) { setAiVerdict(null); setAiLoading(false); return; }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return;

    const controller = new AbortController();
    setAiLoading(true);
    setAiVerdict(null);

    const carList = cars.map((c) =>
      [
        [c.year, c.brand, c.model].filter(Boolean).join(' '),
        `RM ${Number(c.selling_price || 0).toLocaleString()}`,
        c.mileage ? `${Number(c.mileage).toLocaleString()} km` : null,
        c.condition || null,
        c.previous_owners != null ? `${c.previous_owners} prev owner(s)` : null,
        c.warranty_months ? `${c.warranty_months} mo warranty` : 'no warranty',
        c.auction_grade ? `grade ${c.auction_grade}` : null,
      ].filter(Boolean).join(', ')
    ).join('\n');

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 160,
        messages: [{
          role: 'user',
          content: `You are a Malaysian used car advisor. Given these cars:\n\n${carList}\n\nGive a 2-sentence verdict on which offers the best value and why. Be specific. Mention the winning car by name.`,
        }],
      }),
    })
      .then((r) => r.json())
      .then((data) => { const t = data?.content?.[0]?.text; if (t) setAiVerdict(t); })
      .catch(() => {})
      .finally(() => setAiLoading(false));

    return () => controller.abort();
  }, [cars]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const n = cars.length;

  // ─── Verdict ────────────────────────────────────────────────────────────────

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
    const winners = scores.reduce((acc, s, i) => (s === maxScore ? [...acc, i] : acc), []);
    if (winners.length > 1) return { car: null, score: maxScore };
    return { car: cars[winners[0]], score: maxScore };
  })();

  const verdictReason = (car) => {
    const parts = [];
    const priceWinner = winnerIdx(cars.map((c) => c.selling_price), 'low') === cars.indexOf(car);
    const mileWinner = winnerIdx(cars.map((c) => c.mileage), 'low') === cars.indexOf(car);
    const yearWinner = winnerIdx(cars.map((c) => c.year), 'high') === cars.indexOf(car);
    if (priceWinner) parts.push('lowest asking price');
    if (mileWinner) parts.push('lowest mileage');
    if (yearWinner) parts.push('newest year');
    return parts.length ? parts.join(', ') : 'most competitive overall value';
  };

  // ─── Highlight maps ─────────────────────────────────────────────────────────

  function priceHL() {
    const idx = winnerIdx(cars.map((c) => c.selling_price), 'low');
    return cars.map((_, i) => (i === idx ? '#4ade80' : null));
  }
  function mileHL() {
    const lo = winnerIdx(cars.map((c) => c.mileage), 'low');
    const hi = winnerIdx(cars.map((c) => c.mileage), 'high');
    return cars.map((_, i) => (i === lo ? '#4ade80' : i === hi ? '#f87171' : null));
  }
  function highHL(vals) {
    const idx = winnerIdx(vals, 'high');
    return cars.map((_, i) => (i === idx ? '#4ade80' : null));
  }
  function lowHL(vals) {
    const idx = winnerIdx(vals, 'low');
    return cars.map((_, i) => (i === idx ? '#4ade80' : null));
  }

  const ageDaysMap = Object.fromEntries(cars.map((c) => [c.id, ageDays(c.created_at)]));

  const waLink = (car) => {
    const num = whatsappMap[car.dealer_id];
    if (!num) return null;
    const digits = String(num).replace(/\D/g, '').replace(/^0/, '60');
    const name = [car.year, car.brand, car.model].filter(Boolean).join(' ');
    return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi, I'm interested in the ${name} listed on XDrive.`)}`;
  };

  const hasRecon = cars.some((c) => c.is_recon);

  const hl = {
    price:        priceHL(),
    mile:         mileHL(),
    year:         highHL(cars.map((c) => c.year)),
    owners:       lowHL(cars.map((c) => c.previous_owners)),
    auctionGrade: highHL(cars.map((c) => gradeNum(c.auction_grade))),
    interiorGrade:highHL(cars.map((c) => gradeNum(c.interior_grade))),
    warranty:     highHL(cars.map((c) => c.warranty_months || 0)),
    ageDaysHL:    lowHL(cars.map((c) => ageDaysMap[c.id])),
    docs:         cars.map((c) => Array.isArray(c.car_documents) && c.car_documents.length > 0 ? '#4ade80' : null),
    loan:         cars.map((c) => c.loan_eligible !== false ? '#4ade80' : null),
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!n) {
    return (
      <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'DM Sans',sans-serif", color: '#fff' }}>
        <p style={{ fontSize: 18, color: '#4b5563' }}>No cars selected to compare.</p>
        <Link to="/cars" style={{ color: '#dc2626', fontSize: 14 }}>Browse cars →</Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080C14; }
        .cp-table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .cp-table th, .cp-table td { vertical-align: top; }
        .cp-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
        @keyframes cp-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .cp-shimmer { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%); background-size:1200px 100%; animation:cp-shimmer 1.6s infinite linear; border-radius:4px; }
        @media (max-width: 640px) { .cp-desktop-only { display: none !important; } }
        @media (min-width: 641px) { .cp-mobile-only { display: none !important; } }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#080C14', fontFamily: "'DM Sans',sans-serif", color: '#fff', paddingBottom: 80 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, letterSpacing: 2, lineHeight: 1, color: '#fff', marginBottom: 6 }}>COMPARE</h1>
              <p style={{ fontSize: 13, color: '#4b5563' }}>{n} car{n !== 1 ? 's' : ''} compared</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/cars" style={{ fontSize: 12, color: '#4b5563', textDecoration: 'none' }}>← Back to cars</Link>
              {n < 4 && (
                <Link
                  to={`/cars?${paramKeys.slice(0, n).map((k, i) => `${k}=${cars[i].slug}`).join('&')}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}
                >
                  <Plus size={14} />
                  Add Car
                </Link>
              )}
              <button
                onClick={handleShare}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, color: copied ? '#4ade80' : '#9ca3af', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {copied ? <Check size={14} /> : <Share2 size={14} />}
                {copied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>

          {/* ── Mobile card stack ── */}
          <div className="cp-mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cars.map((car, i) => {
              const img = car.images?.[0];
              const name = [car.year, car.brand, car.model].filter(Boolean).join(' ');
              const monthly = calcMonthly(car.selling_price);
              const wa = waLink(car);
              return (
                <div key={car.id} style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ aspectRatio: '16/9', background: 'rgba(255,255,255,0.04)' }}>
                      {img
                        ? <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🚗</div>
                      }
                    </div>
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                      <HeartButton listingId={car.id} size={15} style={{ background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '4px 6px' }} />
                      <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', padding: '4px 6px', display: 'flex' }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 2 }}>{car.brand}</p>
                    <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: '#fff', letterSpacing: 1, lineHeight: 1, marginBottom: 6 }}>{[car.year, car.model, car.variant].filter(Boolean).join(' ')}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{fmtRM(car.selling_price)}</p>
                    {monthly && <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 4 }}>~RM {monthly.toLocaleString()}/mo est.</p>}
                    {car.slug && (
                      <Link to={`/cars/${car.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>
                        View listing <ExternalLink size={10} />
                      </Link>
                    )}
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, marginBottom: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#4ade80', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        <MessageCircle size={11} /> Enquire on WhatsApp
                      </a>
                    )}

                    <MobileSectionDiv label="Pricing" />
                    <MobileSpecRow label="Asking Price"  value={fmtRM(car.selling_price)}  color={hl.price[i]} />
                    <MobileSpecRow label="Monthly Est."  value={monthly ? `RM ${monthly.toLocaleString()}` : '—'} />
                    <MobileSpecRow label="Original Price" value={fmtRM(car.original_price)} />

                    <MobileSectionDiv label="Basics" />
                    <MobileSpecRow label="Year"          value={car.year || '—'}            color={hl.year[i]} />
                    <MobileSpecRow label="Mileage"       value={car.mileage ? `${Number(car.mileage).toLocaleString()} km` : '—'} color={hl.mile[i]} />
                    <MobileSpecRow label="Condition"     value={car.condition || '—'} />
                    <MobileSpecRow label="Prev. Owners"  value={car.previous_owners != null ? String(car.previous_owners) : '—'} color={hl.owners[i]} />
                    <MobileSpecRow label="Location"      value={[car.city, car.state].filter(Boolean).join(', ') || '—'} />

                    <MobileSectionDiv label="Specs" />
                    <MobileSpecRow label="Engine CC"     value={car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : '—'} />
                    <MobileSpecRow label="Transmission"  value={car.transmission || '—'} />
                    <MobileSpecRow label="Fuel Type"     value={car.fuel_type || '—'} />
                    <MobileSpecRow label="Colour"        value={car.colour || '—'} />
                    <MobileSpecRow label="Body Type"     value={car.body_type || '—'} />

                    {hasRecon && (
                      <>
                        <MobileSectionDiv label="Recon / Import" />
                        <MobileSpecRow label="Recon"          value={car.is_recon ? 'Yes' : 'No'} />
                        <MobileSpecRow label="Import Country" value={car.import_country || '—'} />
                        <MobileSpecRow label="Exterior Grade" value={car.auction_grade || '—'}   color={hl.auctionGrade[i]} />
                        <MobileSpecRow label="Interior Grade" value={car.interior_grade || '—'}  color={hl.interiorGrade[i]} />
                        <MobileSpecRow label="Chassis"        value={car.chassis_status || '—'} />
                      </>
                    )}

                    <MobileSectionDiv label="Trust & Value" />
                    <MobileSpecRow label="Verified Docs" value={Array.isArray(car.car_documents) && car.car_documents.length > 0 ? '✓' : '—'} color={hl.docs[i]} />
                    <MobileSpecRow label="Warranty"      value={car.warranty_months > 0 ? `${car.warranty_months} mo` : 'None'} color={hl.warranty[i]} />
                    <MobileSpecRow label="Days Listed"   value={ageDaysMap[car.id] != null ? `${ageDaysMap[car.id]}d` : '—'} color={hl.ageDaysHL[i]} />
                    <MobileSpecRow label="Loan Eligible" value={car.loan_eligible === false ? 'No' : 'Yes'} color={hl.loan[i]} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Comparison table ── */}
          <div className="cp-desktop-only" style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'clip' }}>
          <div className="cp-wrap">
            <table className="cp-table" style={{ minWidth: 120 + n * 160 }}>
              <colgroup>
                <col style={{ width: 120 }} />
                {cars.map((c) => <col key={c.id} style={{ width: `${Math.floor((100 - 10) / n)}%` }} />)}
              </colgroup>

              {/* ── Car column headers ── */}
              <thead>
                <tr style={{ background: '#0a1220' }}>
                  <th className="cp-label-col" style={{ position: 'sticky', left: 0, top: 0, zIndex: 20, background: '#0a1220', borderBottom: '1px solid rgba(255,255,255,0.07)', width: 120, minWidth: 120 }} />
                  {cars.map((car) => {
                    const img = car.images?.[0];
                    const name = [car.year, car.brand, car.model].filter(Boolean).join(' ');
                    const monthly = calcMonthly(car.selling_price);
                    const wa = waLink(car);
                    return (
                      <th key={car.id} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a1220', padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top', minWidth: 160 }}>
                        {/* Photo */}
                        <div style={{ position: 'relative', marginBottom: 12 }}>
                          <div style={{ aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                            {img
                              ? <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚗</div>
                            }
                          </div>
                          {/* Controls overlay */}
                          <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                            <HeartButton listingId={car.id} size={15} style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '4px 6px' }} />
                            <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', padding: '4px 6px', display: 'flex' }}>
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                        {/* Info */}
                        <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3, fontWeight: 600 }}>{car.brand}</p>
                        <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: '#fff', letterSpacing: 1, lineHeight: 1, marginBottom: 6 }}>{[car.year, car.model, car.variant].filter(Boolean).join(' ')}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{fmtRM(car.selling_price)}</p>
                        {monthly && <p style={{ fontSize: 11, color: '#4b5563' }}>~RM {monthly.toLocaleString()}/mo est.</p>}
                        {car.slug && (
                          <Link to={`/cars/${car.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>
                            View listing <ExternalLink size={10} />
                          </Link>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#4ade80', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            <MessageCircle size={11} /> Enquire on WhatsApp
                          </a>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody style={{ background: '#0a1220' }}>
                {/* ── PRICING ── */}
                <SectionHeader label="Pricing" colSpan={n} />
                <Row label="Asking Price" values={cars.map((c) => fmtRM(c.selling_price))} highlight={hl.price} />
                <Row label="Monthly Est." values={cars.map((c) => { const m = calcMonthly(c.selling_price); return m ? `RM ${m.toLocaleString()}` : '—'; })} />
                <Row label="Original Price" values={cars.map((c) => fmtRM(c.original_price))} />

                {/* ── BASICS ── */}
                <SectionHeader label="Basics" colSpan={n} />
                <Row label="Year" values={cars.map((c) => c.year || '—')} highlight={hl.year} />
                <Row label="Mileage"
                  values={cars.map((c) => c.mileage ? `${Number(c.mileage).toLocaleString()} km` : '—')}
                  highlight={hl.mile}
                />
                <Row label="Condition" values={cars.map((c) => c.condition || '—')} />
                <Row label="Prev. Owners"
                  values={cars.map((c) => c.previous_owners != null ? String(c.previous_owners) : '—')}
                  highlight={hl.owners}
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
                    <Row label="Import Country" values={cars.map((c) => c.import_country || '—')} />
                    <Row label="Exterior Grade"
                      values={cars.map((c) => c.auction_grade || '—')}
                      highlight={hl.auctionGrade}
                    />
                    <Row label="Interior Grade"
                      values={cars.map((c) => c.interior_grade || '—')}
                      highlight={hl.interiorGrade}
                    />
                    <Row label="Chassis"
                      values={cars.map((c) => c.chassis_status || '—')}
                      renderCell={(val) => (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: val === 'clean' ? '#22c55e' : val === 'repaired' ? '#eab308' : val === 'written_off' ? '#dc2626' : '#334155' }} />
                          {val || '—'}
                        </span>
                      )}
                    />
                  </>
                )}

                {/* ── TRUST ── */}
                <SectionHeader label="Trust & Value" colSpan={n} />
                <Row label="Verified Docs"
                  values={cars.map((c) => Array.isArray(c.car_documents) && c.car_documents.length > 0 ? '✓' : '—')}
                  highlight={hl.docs}
                />
                <Row label="Warranty"
                  values={cars.map((c) => c.warranty_months > 0 ? `${c.warranty_months} mo` : 'None')}
                  highlight={hl.warranty}
                />
                <Row label="Days Listed"
                  values={cars.map((c) => ageDaysMap[c.id] != null ? `${ageDaysMap[c.id]}d` : '—')}
                  highlight={hl.ageDaysHL}
                />
                <Row label="Loan Eligible"
                  values={cars.map((c) => c.loan_eligible === false ? 'No' : 'Yes')}
                  highlight={hl.loan}
                />
              </tbody>
            </table>
          </div>
          </div>{/* end cp-desktop-only */}

          {/* ── One-car nudge ── */}
          {n === 1 && (
            <div style={{ marginTop: 24, background: '#0a1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>Add another car to start comparing</p>
              <Link
                to={`/cars?a=${cars[0].slug}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              >
                Browse cars →
              </Link>
            </div>
          )}

          {/* ── Verdict ── */}
          {verdictCar && (
            <div style={{ marginTop: 24, background: '#0a1220', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #dc2626', borderRadius: 10, padding: '20px 24px' }}>
              <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>
                Our Verdict{aiVerdict && !aiLoading && <span style={{ marginLeft: 8, fontSize: 9, color: '#6b7280', fontWeight: 500, letterSpacing: '0.06em' }}>AI</span>}
              </p>
              {aiLoading ? (
                <div style={{ marginBottom: 16 }}>
                  <div className="cp-shimmer" style={{ height: 18, width: '85%', marginBottom: 8 }} />
                  <div className="cp-shimmer" style={{ height: 18, width: '60%' }} />
                </div>
              ) : aiVerdict ? (
                <p style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.65, marginBottom: 16 }}>{aiVerdict}</p>
              ) : verdictCar.car === null ? (
                <p style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.65, marginBottom: 16 }}>
                  It's a tie! These cars are evenly matched across our scoring criteria.
                </p>
              ) : (
                <p style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.65, marginBottom: 16 }}>
                  <strong style={{ color: '#fff' }}>{[verdictCar.car.year, verdictCar.car.brand, verdictCar.car.model].filter(Boolean).join(' ')}</strong>
                  {' '}offers the best overall value — {verdictReason(verdictCar.car)} compared to the alternatives.
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {cars.map((car) => (
                  car.slug && (
                    <Link key={car.id} to={`/cars/${car.slug}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: verdictCar.car && car.id === verdictCar.car.id ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${verdictCar.car && car.id === verdictCar.car.id ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        color: verdictCar.car && car.id === verdictCar.car.id ? '#f87171' : '#9ca3af',
                        textDecoration: 'none',
                      }}
                    >
                      {[car.year, car.brand, car.model].filter(Boolean).join(' ')} →
                    </Link>
                  )
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
