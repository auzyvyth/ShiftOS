import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useMarketplaceTracking } from '../hooks/useMarketplaceTracking';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { X, Share2, Check, ExternalLink, Flame, Trophy, Plus, SlidersHorizontal, Layers, ArrowLeftRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { COMPARE_MODE_KEY } from '../hooks/useCompare';
import HeartButton from '../components/HeartButton';
import MarketplaceHeader from '../components/MarketplaceHeader';
import Header from '../components/Header';
import { isSubdomain } from '../hooks/useTenant';
import MarketplaceFooter from '../components/MarketplaceFooter';
import { calcMonthly } from '../utils/financing';
import { calcRoadTaxEst, calcInsuranceAnnual, estAnnualFuel, estRunningCost } from '../utils/ownership';
import { storefront as SF } from '../theme/tokens';

const SELECT_COLS = [
  'id','slug','year','brand','model','variant',
  'selling_price','original_price','mileage','transmission',
  'fuel_type','body_type','engine_cc','colour','condition',
  'state','city','is_recon','auction_grade','interior_grade',
  'import_country','chassis_status','document_types','warranty_months',
  'loan_eligible','previous_owners','created_at','images','status',
  'market_avg_price','fuel_consumption',
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
    Array.isArray(car.document_types) && car.document_types.length > 0,
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

// Per-car "what it wins at" chips — only awarded when this car is the sole
// outright winner of a metric across the compared set (no ties).
function carStrengths(car, cars) {
  if (cars.length < 2) return [];
  const soleWinner = (sel, dir) => {
    const vals = cars.map(sel).map(v => (v != null && !isNaN(Number(v))) ? Number(v) : null);
    const valid = vals.filter(v => v != null);
    if (valid.length < 2) return false;
    const target = dir === 'low' ? Math.min(...valid) : Math.max(...valid);
    const winners = vals.filter(v => v === target).length;
    const mine = vals[cars.indexOf(car)];
    return winners === 1 && mine === target;
  };
  const out = [];
  if (soleWinner(c => c.selling_price, 'low'))               out.push('Cheapest');
  if (soleWinner(c => c.mileage, 'low'))                     out.push('Lowest km');
  if (soleWinner(c => c.year, 'high'))                       out.push('Newest');
  if ((car.warranty_months || 0) > 0 && soleWinner(c => c.warranty_months || 0, 'high')) out.push('Best warranty');
  if (soleWinner(c => calcRoadTaxEst(c.engine_cc), 'low'))   out.push('Lowest tax');
  if (soleWinner(c => estRunningCost(c), 'low'))             out.push('Cheapest to run');
  return out.slice(0, 3);
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Sec({ label, note }) {
  return (
    <div style={{
      padding: '9px 14px 7px', display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--cp-sechead,#fafafa)', borderTop: '1px solid var(--cp-border,#e5e7eb)', borderBottom: '1px solid var(--cp-border,#e5e7eb)',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      {note && <span style={{ fontSize: 9, color: 'var(--cp-muted,#9ca3af)', fontWeight: 500 }}>{note}</span>}
    </div>
  );
}

function Row({ label, values, highlight, renderCell }) {
  return (
    <div className="cp-row" style={{ display: 'grid', gridTemplateColumns: 'var(--cp-cols)', borderBottom: '1px solid var(--cp-line,#f1f5f9)' }}>
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
              color: win && !empty ? 'var(--cp-win,#16a34a)' : empty ? 'var(--cp-muted,#d1d5db)' : 'var(--cp-text,#374151)',
              fontWeight: win && !empty ? 600 : 400,
              background: win && !empty ? 'var(--cp-winbg,rgba(22,163,74,0.04))' : 'transparent',
              borderLeft: '1px solid var(--cp-line,#f1f5f9)',
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
  // On a dealer subdomain, keep the dealer's identity (dark theme + dealer header)
  // and route "back"/detail links to the dealer's own pages, not the marketplace.
  const sub = isSubdomain();
  const HeaderC = sub ? Header : MarketplaceHeader;
  const carsHref = sub ? '/cars' : '/showroom';
  const detailBase = sub ? '/cars/' : '/showroom/';
  // Subdomain = dark storefront theme (from tokens); marketplace = light. Driven
  // by CSS vars (cpVars) set on the page wrapper so the table/cards/rows theme
  // from one place instead of hardcoded hexes.
  const pageBg = sub ? SF.pageBg : '#F7F6F2';
  const cpVars = sub ? {
    '--cp-surface': SF.surface, '--cp-border': SF.border, '--cp-line': SF.line,
    '--cp-text': SF.text, '--cp-muted': SF.textMuted, '--cp-sechead': 'rgba(255,255,255,0.03)',
    '--cp-imgbg': '#0e0e14', '--cp-win': SF.win, '--cp-winbg': 'rgba(74,222,128,0.08)',
    '--cp-hover': 'rgba(255,255,255,0.03)',
  } : {
    '--cp-surface': '#fff', '--cp-border': '#DDE3EC', '--cp-line': '#f1f5f9',
    '--cp-text': '#111827', '--cp-muted': '#6b7280', '--cp-sechead': '#fafafa',
    '--cp-imgbg': '#f3f4f6', '--cp-win': '#16a34a', '--cp-winbg': 'rgba(22,163,74,0.04)',
    '--cp-hover': '#f9fafb',
  };
  // Tinted pills (strength chips, market signal, verdict) carry dark text on a
  // faint tint — which is unreadable on the dark storefront. Brighten both the
  // tint and the text on subdomains so the dark-on-dark doesn't vanish.
  const chipWin = sub
    ? { bg: 'rgba(74,222,128,0.16)', color: '#4ade80' }
    : { bg: 'rgba(22,163,74,0.1)',   color: '#15803d' };
  const marketCfg = sub ? {
    below: { bg: 'rgba(74,222,128,0.16)', color: '#4ade80', label: '▼ Below Market' },
    fair:  { bg: 'rgba(96,165,250,0.16)', color: '#60a5fa', label: '● Fair Price'   },
    above: { bg: 'rgba(251,191,36,0.16)', color: '#fbbf24', label: '▲ Above Market' },
  } : {
    below: { bg: 'rgba(22,163,74,0.1)',  color: '#15803d', label: '▼ Below Market' },
    fair:  { bg: 'rgba(37,99,235,0.08)', color: '#1d4ed8', label: '● Fair Price'   },
    above: { bg: 'rgba(217,119,6,0.1)',  color: '#b45309', label: '▲ Above Market' },
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Enter guided compare mode: jump to the showroom; CompareBar will bounce the
  // visitor back here automatically once they've picked the max number of cars.
  const goAddCars = () => {
    sessionStorage.setItem(COMPARE_MODE_KEY, '1');
    navigate(carsHref);
  };
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);

  // Hysteresis: collapse the strip only once scrolled well past where it sticks
  // (~82px), and re-expand only near the top. A single threshold at the sticky
  // boundary made collapsing shift the layout back across it → expand → collapse
  // in an infinite flicker.
  //
  // The dead zone alone does NOT break that loop, and this page shipped
  // flickering because of it. Collapsing the strip removes ~200-500px of
  // height from the flow, and Chrome's SCROLL ANCHORING then rewinds
  // window.scrollY by that much to keep the content under the cursor still.
  // That drop is far larger than the 110px dead zone, so it lands back below
  // the re-expand threshold, the strip reopens, anchoring pushes scrollY
  // forward again, and it oscillates on the spot for as long as you leave it
  // there. Measured in Chromium: 32 state flips from a single scroll to y=240.
  // The cure is `overflowAnchor: 'none'` on the page wrapper below (32 flips
  // -> 1), because the trigger has to stop reacting to a scroll position that
  // the collapse itself is moving. Do not remove it thinking it is cosmetic;
  // widening the dead zone here cannot substitute for it.
  useEffect(() => {
    let ticking = false;
    const evaluate = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled(prev => (prev ? y > 110 : y > 220));
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; window.requestAnimationFrame(evaluate); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    evaluate();
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

  // Deterministic tab title (react-helmet can be flaky on client-side nav).
  useEffect(() => {
    if (loading) return;
    document.title = n === 0
      ? 'Compare Cars Side by Side | XDrive'
      : `${cars.map(c => [c.year, c.brand, c.model].filter(Boolean).join(' ')).join(' vs ')} — Car Comparison | XDrive`;
  }, [loading, n, cars]);

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
        <HeaderC />
        <div style={{ minHeight: '100vh', background: pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 72 }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--cp-border,#e5e7eb)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>
    );
  }

  if (!n) {
    return (
      <>
        <Helmet>
          <title>Car Comparison Tool — Compare Cars Side by Side | XDrive</title>
          <meta name="description" content="Free car comparison tool. Compare up to 4 used cars side by side — price, monthly instalment, mileage, year, running costs, specs and an overall value score. Find the best deal on XDrive." />
          <link rel="canonical" href="https://xdrive.my/compare" />
        </Helmet>
        <HeaderC />
        <div style={{ minHeight: '100vh', background: pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, fontFamily: "system-ui,sans-serif", padding: '72px 20px 48px', textAlign: 'center', ...cpVars }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeftRight size={28} color="#dc2626" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 6px' }}>Car Comparison Tool</p>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(30px,6vw,46px)', letterSpacing: 2, lineHeight: 1, color: sub ? SF.text : '#111827', margin: '0 0 12px' }}>
              Compare Cars Side by Side
            </h1>
            <p style={{ fontSize: 15, color: 'var(--cp-muted,#6b7280)', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              Pick up to 4 cars and weigh them up on price, mileage, year, running costs and our value score — all on one screen.
            </p>
          </div>
          <button
            onClick={goAddCars}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 50, padding: '13px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "system-ui,sans-serif", boxShadow: '0 8px 28px rgba(220,38,38,0.35)' }}
          >
            <Plus size={16} /> Add Cars to Compare
          </button>
        </div>
        {!sub && <MarketplaceFooter />}
      </>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const slotCols = n < 4 ? n + 1 : n;

  return (
    <>
      <Helmet>
        <title>{cars.map(c => [c.year, c.brand, c.model].filter(Boolean).join(' ')).join(' vs ')} — Car Comparison | XDrive</title>
        <meta name="description" content={`Compare ${cars.map(c => [c.brand, c.model].filter(Boolean).join(' ')).join(' vs ')} side by side — price, mileage, year, running costs and value score on XDrive's car comparison tool.`} />
        {!sub && <link rel="canonical" href="https://xdrive.my/compare" />}
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .cp-row:hover .cp-val { background: var(--cp-hover, #f9fafb) !important; }
        .cp-lbl {
          padding: clamp(8px,1.5vw,10px) clamp(8px,1.5vw,14px);
          font-size: 11px; color: var(--cp-muted, #9ca3af); font-weight: 500;
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

      <HeaderC />

      {/* overflowAnchor:'none' is what stops the strip flickering between its
          expanded and collapsed forms, and it is not cosmetic -- see the
          `scrolled` effect above for the mechanism. Scoped to this wrapper
          rather than <html> so the rest of the app keeps scroll anchoring. */}
      <div style={{ minHeight: '100vh', background: pageBg, fontFamily: "system-ui,sans-serif", paddingTop: 72, paddingBottom: 64, overflowAnchor: 'none', ...cpVars }}>

        {/* ── Page title ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 3px' }}>Side by Side</p>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(26px,5vw,38px)', letterSpacing: 2, lineHeight: 1, color: sub ? SF.text : '#111827', margin: 0 }}>
              Compare Cars
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to={carsHref} style={{ fontSize: 12, color: 'var(--cp-muted,#9ca3af)', textDecoration: 'none', fontWeight: 500 }}>← All Cars</Link>
            <button
              onClick={handleShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: copied ? 'rgba(22,163,74,0.08)' : 'var(--cp-surface,#fff)',
                border: `1px solid ${copied ? 'rgba(22,163,74,0.3)' : 'var(--cp-border,#DDE3EC)'}`,
                color: copied ? 'var(--cp-win,#16a34a)' : 'var(--cp-muted,#6b7280)', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {copied ? <Check size={12} /> : <Share2 size={12} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* ── Sticky car strip ── */}
        {/* Both headers slide away on scroll-down, so the strip has to rise into
            the space each one leaves or it hangs there with the page scrolling
            past above it.
            - subdomain: Header is a floating pill, tracked by local `scrolled`.
            - marketplace: MarketplaceHeader publishes its live height as
              --mh-h (its measured height, 0 while hidden). This used to be a
              hardcoded 64, which was 6px short of the real 70px desktop bar and
              did not move at all when the header hid.
            The two headers animate on DIFFERENT curves, so the strip has to
            borrow whichever one is above it — a single shared curve leaves the
            strip leading or trailing the chrome it is supposed to sit under. */}
        <div style={{
          position: 'sticky', top: sub ? (scrolled ? 0 : 80) : 'var(--mh-h, 64px)', zIndex: 40,
          background: 'var(--cp-surface,#fff)', borderBottom: '2px solid var(--cp-border,#e5e7eb)',
          boxShadow: scrolled ? '0 3px 14px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.05)',
          transition: sub
            ? 'box-shadow 0.3s, top 0.38s cubic-bezier(0.16, 1, 0.3, 1)'  // matches Header
            : 'box-shadow 0.3s, top 0.28s ease',                           // matches MarketplaceHeader
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
                      overflow: 'hidden', background: 'var(--cp-imgbg,#f3f4f6)', marginBottom: 6,
                      border: isVerdict ? '2px solid rgba(220,38,38,0.5)' : '1px solid var(--cp-border,#e5e7eb)',
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
                      {/* Dark translucent pills so the heart + remove icons stay
                          legible over any photo (white-on-white was invisible). */}
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3 }}>
                        <HeartButton listingId={car.id} size={11} idleColor="rgba(255,255,255,0.92)" style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '3px 5px', backdropFilter: 'blur(4px)' }} />
                        <button onClick={() => removeCar(car.id)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 5, color: 'rgba(255,255,255,0.9)', cursor: 'pointer', padding: '3px 5px', display: 'flex', backdropFilter: 'blur(4px)' }}>
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{car.brand}</p>
                    <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(12px,2.2vw,17px)', color: 'var(--cp-text,#111827)', letterSpacing: 1, lineHeight: 1.1, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {car.year} {car.model}
                    </p>
                    {pct && <p style={{ fontSize: 9, color: 'var(--cp-muted,#9ca3af)', textDecoration: 'line-through', margin: '0 0 1px' }}>{fmtRM(car.original_price)}</p>}
                    <p style={{ fontSize: 'clamp(11px,1.8vw,13px)', fontWeight: 700, color: pct ? '#dc2626' : 'var(--cp-text,#111827)', margin: 0 }}>{fmtRM(car.selling_price)}</p>
                    {monthly && <p style={{ fontSize: 9, color: 'var(--cp-muted,#9ca3af)', margin: '1px 0 3px' }}>~RM {monthly.toLocaleString()}/mo</p>}
                    {(() => {
                      const chips = carStrengths(car, cars);
                      if (!chips.length) return null;
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '0 0 4px' }}>
                          {chips.map(t => (
                            <span key={t} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.02em', padding: '2px 5px', borderRadius: 4, background: chipWin.bg, color: chipWin.color, whiteSpace: 'nowrap' }}>{t}</span>
                          ))}
                        </div>
                      );
                    })()}
                    {car.slug && (
                      <Link to={`${detailBase}${car.slug}`} style={{ fontSize: 9, color: '#dc2626', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        View <ExternalLink size={8} />
                      </Link>
                    )}
                  </div>
                );
              })}
              {n < 4 && (
                <Link
                  className="cp-add-slot"
                  to={carsHref}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    aspectRatio: '1/1', maxHeight: 110, border: '1.5px dashed #d1d5db',
                    borderRadius: 10, color: 'var(--cp-muted,#9ca3af)', textDecoration: 'none', gap: 5,
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
                      background: 'var(--cp-imgbg,#f3f4f6)',
                      border: isVerdict ? '2px solid rgba(220,38,38,0.45)' : '1px solid var(--cp-border,#e5e7eb)',
                    }}>
                      {img
                        ? <img src={img} alt={car.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🚗</div>
                      }
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 'clamp(9px,1.4vw,11px)', fontWeight: 700, color: 'var(--cp-text,#111827)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                        {car.year} {car.model}
                      </p>
                      <p style={{ margin: 0, fontSize: 'clamp(9px,1.3vw,11px)', color: isVerdict ? '#dc2626' : 'var(--cp-muted,#6b7280)', fontWeight: 600 }}>
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
          {n >= 2 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setDiffOnly(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: diffOnly ? '#dc2626' : 'var(--cp-surface,#fff)',
                  border: `1px solid ${diffOnly ? '#dc2626' : 'var(--cp-border,#DDE3EC)'}`,
                  color: diffOnly ? '#fff' : 'var(--cp-muted,#6b7280)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {diffOnly ? <Layers size={13} /> : <SlidersHorizontal size={13} />}
                {diffOnly ? 'Showing differences' : 'Differences only'}
              </button>
            </div>
          )}
          <div
            className="cp-rows"
            style={{ '--cp-cols': `75px repeat(${n}, 1fr)`, background: 'var(--cp-surface,#fff)', borderRadius: 12, border: '1px solid var(--cp-border,#DDE3EC)', overflow: 'hidden' }}
          >
            {(() => {
              // ── Config-driven comparison table ──────────────────────────────
              // get:   comparable scalar (for highlight + diff detection)
              // fmt:   display string (defaults to the scalar)
              // dir:   'low'|'high' → highlight the winner
              // hlGet: numeric source for highlight when it differs from get
              // hl:    precomputed highlight array (overrides dir)
              // cell:  custom renderCell(val,i,win)
              // show:  row-level gate independent of the diff toggle
              const ROWS = [
                { sec: 'Pricing', label: 'Asking Price', get: c => c.selling_price, fmt: v => fmtRM(v), dir: 'low' },
                { sec: 'Pricing', label: 'Monthly Est.', get: c => calcMonthly(c.selling_price), fmt: m => m ? `RM ${m.toLocaleString()}` : '—' },
                {
                  sec: 'Pricing', label: 'Market Signal',
                  show: () => cars.some(c => c.market_avg_price),
                  get: c => (!c.market_avg_price || !c.selling_price) ? null
                    : c.selling_price <= c.market_avg_price * 0.93 ? 'below'
                    : c.selling_price >= c.market_avg_price * 1.07 ? 'above' : 'fair',
                  fmt: v => v || '—',
                  cell: val => {
                    if (!val || val === '—') return <span style={{ color: 'var(--cp-muted,#d1d5db)' }}>—</span>;
                    const cfg = marketCfg[val];
                    return <span style={{ display:'inline-flex', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>;
                  },
                },

                { sec: 'Cost to Own', secNote: 'estimates only', label: 'Road Tax / yr', get: c => calcRoadTaxEst(c.engine_cc), fmt: v => v ? fmtRM(v) : '—', dir: 'low' },
                { sec: 'Cost to Own', label: 'Insurance / yr', get: c => calcInsuranceAnnual(c.selling_price), fmt: v => v ? `~${fmtRM(v)}` : '—', dir: 'low' },
                { sec: 'Cost to Own', label: 'Fuel / yr', get: c => estAnnualFuel(c)?.rm ?? null, fmt: (v, c) => { const f = estAnnualFuel(c); return f ? `${f.estimated ? '~' : ''}${fmtRM(f.rm)}` : '—'; }, dir: 'low' },
                {
                  sec: 'Cost to Own', label: 'Running / yr', get: c => estRunningCost(c), fmt: v => v ? `~${fmtRM(v)}` : '—', dir: 'low',
                  cell: (val, i, win) => {
                    const rc = estRunningCost(cars[i]);
                    return <span style={{ fontWeight: win ? 700 : 600, color: win ? 'var(--cp-win,#16a34a)' : 'var(--cp-text,#374151)' }}>{rc ? `~${fmtRM(rc)}` : '—'}</span>;
                  },
                },

                { sec: 'Basics', label: 'Year', get: c => c.year, fmt: v => v || '—', dir: 'high' },
                { sec: 'Basics', label: 'Mileage', get: c => c.mileage, fmt: v => v ? `${Number(v).toLocaleString()} km` : '—', dir: 'low' },
                { sec: 'Basics', label: 'Condition', get: c => c.condition, fmt: v => v || '—' },
                { sec: 'Basics', label: 'Prev. Owners', get: c => c.previous_owners, fmt: v => v != null ? String(v) : '—', dir: 'low' },
                { sec: 'Basics', label: 'Location', get: c => [c.city, c.state].filter(Boolean).join(', '), fmt: v => v || '—' },

                { sec: 'Specs', label: 'Engine CC', get: c => c.engine_cc, fmt: v => v ? `${Number(v).toLocaleString()} cc` : '—' },
                { sec: 'Specs', label: 'Transmission', get: c => c.transmission, fmt: v => v || '—' },
                { sec: 'Specs', label: 'Fuel Type', get: c => c.fuel_type, fmt: v => v || '—' },
                { sec: 'Specs', label: 'Colour', get: c => c.colour, fmt: v => v || '—' },
                { sec: 'Specs', label: 'Body Type', get: c => c.body_type, fmt: v => v || '—' },

                { sec: 'Recon / Import', show: () => hasRecon, label: 'Recon', get: c => c.is_recon ? 'Yes' : 'No' },
                { sec: 'Recon / Import', show: () => hasRecon, label: 'Country', get: c => c.import_country, fmt: v => v || '—' },
                { sec: 'Recon / Import', show: () => hasRecon, label: 'Ext. Grade', get: c => c.auction_grade, fmt: v => v || '—', dir: 'high', hlGet: c => gradeNum(c.auction_grade) },
                { sec: 'Recon / Import', show: () => hasRecon, label: 'Int. Grade', get: c => c.interior_grade, fmt: v => v || '—', dir: 'high', hlGet: c => gradeNum(c.interior_grade) },
                {
                  sec: 'Recon / Import', show: () => hasRecon, label: 'Chassis', get: c => c.chassis_status, fmt: v => v || '—',
                  cell: val => (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: val === 'clean' ? '#22c55e' : val === 'repaired' ? '#eab308' : val === 'written_off' ? '#dc2626' : '#d1d5db' }} />
                      {val || '—'}
                    </span>
                  ),
                },

                {
                  sec: 'Trust & Value', label: 'Value Score', get: c => getValueScore(c, cars), dir: 'high',
                  cell: (val, i, win) => {
                    const score = getValueScore(cars[i], cars);
                    return (
                      <div style={{ width: '100%', minWidth: 0 }}>
                        <span style={{ fontSize: 'clamp(10px,1.6vw,12px)', fontWeight: win ? 700 : 400, color: win ? '#dc2626' : 'var(--cp-text,#374151)' }}>{score}</span>
                        <div style={{ height: 3, background: 'var(--cp-line,#f1f5f9)', borderRadius: 2, marginTop: 3 }}>
                          <div style={{ height: '100%', width: `${score}%`, background: win ? '#dc2626' : '#d1d5db', borderRadius: 2, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    );
                  },
                },
                { sec: 'Trust & Value', label: 'Documents', get: c => Array.isArray(c.document_types) ? c.document_types.length : 0, fmt: cnt => cnt > 0 ? `${cnt} doc${cnt !== 1 ? 's' : ''}` : 'None', dir: 'high' },
                { sec: 'Trust & Value', label: 'Warranty', get: c => c.warranty_months || 0, fmt: v => v > 0 ? `${v} mo` : 'None', dir: 'high' },
                { sec: 'Trust & Value', label: 'Loan Eligible', get: c => c.loan_eligible === false ? 'No' : 'Yes', hl: loanHL },
                { sec: 'Trust & Value', label: 'Days Listed', get: c => ageDays(c.created_at), fmt: v => v != null ? `${v}d` : '—', dir: 'low' },
                {
                  sec: 'Trust & Value', label: 'Listing Score', get: c => completeness(c), dir: 'high',
                  cell: (val, i, win) => {
                    const pct = completeness(cars[i]) / COMP_FIELDS * 100;
                    return (
                      <div style={{ width: '100%', minWidth: 0 }}>
                        <span style={{ fontSize: 'clamp(10px,1.6vw,12px)', fontWeight: win ? 600 : 400 }}>{Math.round(pct)}%</span>
                        <div style={{ height: 3, background: 'var(--cp-line,#f1f5f9)', borderRadius: 2, marginTop: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: win ? '#16a34a' : '#d1d5db', borderRadius: 2, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    );
                  },
                },
              ];

              const dispOf = (d, c) => d.fmt ? d.fmt(d.get(c), c) : (d.get(c) == null ? '—' : String(d.get(c)));
              const out = [];
              let lastSec = null;
              for (const d of ROWS) {
                if (d.show && !d.show()) continue;
                const disp = cars.map(c => dispOf(d, c));
                // Diff-only: drop rows where every car shows the same display value
                if (diffOnly && new Set(disp).size <= 1) continue;
                const highlight = d.hl ? d.hl : (d.dir ? smartHL(cars.map(d.hlGet || d.get), d.dir, n) : null);
                if (d.sec !== lastSec) { out.push(<Sec key={`sec-${d.sec}`} label={d.sec} note={d.secNote} />); lastSec = d.sec; }
                const values = d.cell ? cars.map(d.get) : disp;
                out.push(<Row key={`${d.sec}-${d.label}`} label={d.label} values={values} highlight={highlight} renderCell={d.cell} />);
              }
              if (out.length === 0) {
                out.push(<div key="nodiff" style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: 'var(--cp-muted,#9ca3af)' }}>These cars match on every field shown.</div>);
              }
              return out;
            })()}

          </div>

          {/* ── Verdict ── */}
          {verdict && (
            <div style={{ marginTop: 14, background: 'var(--cp-surface,#fff)', border: '1px solid var(--cp-border,#DDE3EC)', borderLeft: '3px solid #dc2626', borderRadius: 12, padding: 'clamp(14px,3vw,22px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Trophy size={13} color="#dc2626" />
                <p style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, margin: 0 }}>Our Verdict</p>
              </div>
              <p style={{ fontSize: 'clamp(13px,2vw,15px)', color: 'var(--cp-text,#374151)', lineHeight: 1.65, margin: '0 0 14px' }}>
                <strong style={{ color: 'var(--cp-text,#111827)' }}>{[verdict.car.year, verdict.car.brand, verdict.car.model].filter(Boolean).join(' ')}</strong>
                {' '}offers the best overall value — {verdictReasons} compared to the alternatives.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cars.map(car => car.slug && (
                  <Link
                    key={car.id}
                    to={`${detailBase}${car.slug}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: car.id === verdict.car.id ? 'rgba(220,38,38,0.06)' : (sub ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                      border: `1px solid ${car.id === verdict.car.id ? 'rgba(220,38,38,0.25)' : 'var(--cp-border,#e5e7eb)'}`,
                      color: car.id === verdict.car.id ? '#dc2626' : 'var(--cp-muted,#6b7280)',
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

      {!sub && <MarketplaceFooter />}
    </>
  );
}
