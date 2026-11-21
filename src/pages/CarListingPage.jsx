import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, lazy, Suspense } from 'react';
import { useModalHistory } from '../hooks/useModalHistory';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { X, RotateCcw, SlidersHorizontal, Flame, Car, ChevronDown, Search, Sparkles, ArrowDownWideNarrow } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase, publicClient } from '../supabaseClient';
import { MY_STATES } from '../utils/locations';
import { usePriceMode } from '../utils/priceMode';
import { trackEvent } from '../utils/analytics';
import { cleanSearchText, activeFilterKeys, searchKey } from '../utils/searchTracking';
import { chassisSearch } from '../utils/chassisCodes';
import { useMarketplaceTracking } from '../hooks/useMarketplaceTracking';
import useTenant, { isSubdomain, getSubdomain, getStorefrontUrl } from '../hooks/useTenant';
import { PRICE_STEPS } from '../components/PriceDrumPicker';
import {
  BRAND_OPTIONS as BRAND_OPTS, BODY_TYPES, TRANSMISSIONS, FINANCING_TYPES,
  MILEAGE_OPTIONS as MILEAGE_OPTS, CONDITION_OPTIONS as CONDITION_OPTS,
  FUEL_TYPES, COLOURS, YEARS,
  sanitizeBrand, sanitizeBodyType, sanitizeTransmission, sanitizeFinancing,
  sanitizeState, sanitizeYear, sanitizeQ, sanitizeCondition, sanitizeMileageMax,
  sanitizeFuelType, sanitizeColour, sanitizeSellerType, sanitizeStr,
  LIVE_CARS_CACHE_KEY, readLiveCarsFallback, withTimeout,
} from '../config/marketplaceConfig';
import { readCache, writeCache } from '../utils/localCache';
import StaleListingsNotice from '../components/StaleListingsNotice';
import { CAR_DATA } from '../data/carData';
import { modelFilter } from '../utils/modelKey';
import SearchAutocomplete from '../components/SearchAutocomplete';
import PriceAlertButton from '../components/PriceAlertButton';
import ShowroomCard, { ShowroomCardSkeleton } from '../components/ShowroomCard';
import NewBrandRow from '../components/marketplace/NewBrandRow';
import Pagination from '../components/ui/Pagination';
import { storefront as SF } from '../theme/tokens';
import { StorefrontError } from '../components/ErrorScreen';
import { themeOf, themeCss } from '../utils/storefrontTheme';
import { accentTheme, hexToRgb } from '../utils/liveAccent';
import { chosenPageColor, PAGE_COLOR_DEFAULT } from '../utils/pageAccent';
import { sv } from '../components/storefront/sections/shared';

// Dealer-storefront chrome only (/cars on <sub>.xdrive.my). Lazy so the
// marketplace /showroom does not download them, nor the framer-motion they
// pull in (~42 KB gz). Both are position:fixed, so loading late moves nothing.
const Header = lazy(() => import('../components/Header'));
const StickyWhatsAppButton = lazy(() => import('../components/StickyWhatsAppButton'));

/* ── Constants ──────────────────────────────────────────────────── */
const PER_PAGE = 15;
// Same freshness window as the marketplace grid's saved copy.
const SEED_TTL = 30 * 60 * 1000;

/* Brands, body types, transmissions, financing, mileage bands, conditions,
   fuel types, colours, the year range and every sanitiser are IMPORTED from
   src/config/marketplaceConfig.js — the same whitelists MarketplacePage uses.
   This file used to carry its own byte-identical copy of all nine lists, so
   adding a brand in one place silently made that brand unfilterable on
   /showroom. Only the things that genuinely differ from the marketplace grid
   stay local: this page's own sort options, CAR_FIELDS (it selects
   market_avg_price) and the seller pills. */
// MET-1: one search_run per distinct filtered search per visit (what was asked,
// and how many cars it found: 0 = a search with no match), and one
// listing_impressions per distinct list (how many cars were put on screen), so a
// click rate has a bottom line. Page 2+ is the same search, not a new one.
const seenBrowse = new Set();
function trackBrowse({ surface, dealerId, filters, sort, page, count, shown }) {
  if (page > 1) return;
  const key = searchKey(surface, filters, sort);
  if (seenBrowse.has(key)) return;
  seenBrowse.add(key);
  const keys = activeFilterKeys(filters);
  const dealer = dealerId || null;
  if (keys.length) {
    trackEvent(supabase, 'search_run', { dealer_id: dealer, metadata: { surface, q: cleanSearchText(filters.q), filters: keys, results: count, sort } });
  }
  trackEvent(supabase, 'listing_impressions', { dealer_id: dealer, metadata: { surface, shown, results: count, filtered: keys.length > 0 } });
}

const SORT_OPTIONS = [
  { label:'Newest First',       short:'Newest',   value:'newest'      },
  { label:'Price: Low to High', short:'Price ↑',  value:'price_asc'   },
  { label:'Price: High to Low', short:'Price ↓',  value:'price_desc'  },
  { label:'Year: Newest',       short:'Year ↓',   value:'year_desc'   },
  { label:'Year: Oldest',       short:'Year ↑',   value:'year_asc'    },
  { label:'Lowest Mileage',     short:'Mileage',  value:'mileage_asc' },
];
const SELLER_TYPES = [{ value:'dealer', label:'Dealer' },{ value:'agent', label:'Agent' },{ value:'private', label:'Private Seller' }];

const CAR_FIELDS  = 'id,slug,listing_title,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at,market_avg_price,seller_role,seller_type,dealer_is_verified,seller_sold_count,is_model_card';
const DEALER_JOIN = 'dealer:profiles!dealer_id(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color,role)';

/* ── Sanitisers ─────────────────────────────────────────────────────
   Thin aliases onto the shared ones so the ~40 `san.x(...)` call sites below
   stay as they are. `price` and `page` are the only real locals: price depends
   on PRICE_STEPS (which lives in PriceDrumPicker, not the config), and only
   this grid is paginated. */
const san = {
  brand:     sanitizeBrand,
  bodyType:  sanitizeBodyType,
  tx:        sanitizeTransmission,
  financing: sanitizeFinancing,
  state:     sanitizeState,
  price:     v => { const n=parseInt(v,10); return PRICE_STEPS.some(s=>s.value===String(n)) ? n : null; },
  page:      v => { const n=parseInt(v,10); return Number.isFinite(n)&&n>=1 ? n : 1; },
  year:      sanitizeYear,
  q:         sanitizeQ,
  condition: sanitizeCondition,
  mileage:   sanitizeMileageMax,
  fuelType:  sanitizeFuelType,
  colour:    sanitizeColour,
  seller:    sanitizeSellerType,
  str:       sanitizeStr,
};

/* ── Price range popover (click → floating min/max picker) ──────── */
function PricePopover({ minPrice, maxPrice, onApply }) {
  const [open, setOpen] = useState(false);
  useModalHistory(open, () => setOpen(false));
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 240 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const minLabel = PRICE_STEPS.find(s => s.value === String(minPrice || ''))?.label || 'Any';
  const maxLabel = PRICE_STEPS.find(s => s.value === String(maxPrice || ''))?.label || 'Any';
  const hasVal   = minPrice || maxPrice;
  const summary  = hasVal ? `${minLabel} – ${maxLabel}` : 'Any price';

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const PW = 300, GAP = 8;
    // Prefer opening to the LEFT of the filter bar; fall back below if no room.
    let left = r.left - PW - GAP;
    if (left < 12) left = Math.max(12, r.right - PW); // tuck under, right-aligned
    let top = r.top;
    const PH = 320;
    if (top + PH > window.innerHeight - 12) top = Math.max(12, window.innerHeight - PH - 12);
    setPos({ top, left, width: PW });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const col = (selectedVal, isMin) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>{isMin ? 'Min' : 'Max'}</p>
      <div className="cl-sidebar-scroll" style={{ maxHeight: '230px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '4px' }}>
        {PRICE_STEPS.map(s => {
          const active = String(selectedVal || '') === s.value;
          // guard: min can't exceed max and vice-versa
          const disabled = isMin
            ? (maxPrice && s.value && Number(s.value) > Number(maxPrice))
            : (minPrice && s.value && Number(s.value) < Number(minPrice));
          return (
            <button key={s.value || 'any'}
              disabled={disabled}
              onClick={() => onApply(isMin ? s.value : String(minPrice || ''), isMin ? String(maxPrice || '') : s.value)}
              style={{
                textAlign: 'left', padding: '7px 10px', borderRadius: '7px', cursor: disabled ? 'not-allowed' : 'pointer',
                border: 'none', fontSize: '13px', fontWeight: active ? 700 : 500,
                background: active ? 'rgba(220,38,38,0.08)' : 'transparent',
                color: disabled ? '#d1d5db' : active ? '#dc2626' : '#374151',
                transition: 'background-color 100ms var(--xd-ease-out), border-color 100ms var(--xd-ease-out), color 100ms var(--xd-ease-out), box-shadow 100ms var(--xd-ease-out), transform 100ms var(--xd-ease-out), opacity 100ms var(--xd-ease-out)',
              }}
            >{s.label}</button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', border: `1px solid ${open ? '#dc2626' : '#e5e7eb'}`, borderRadius: '8px',
        padding: '9px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: hasVal ? 600 : 400,
        color: hasVal ? '#111827' : '#9ca3af', fontFamily: "'Outfit',sans-serif", transition: 'border-color 0.12s',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && createPortal(
        <div ref={popRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1200,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)', padding: '14px', fontFamily: "'Outfit',sans-serif",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#111827', margin: 0 }}>Price Range</p>
            <button onClick={() => { onApply('', ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <RotateCcw size={10} /> Clear
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {col(minPrice, true)}
            <div style={{ width: '1px', background: '#f3f4f6' }} />
            {col(maxPrice, false)}
          </div>
          <button onClick={() => setOpen(false)} style={{
            width: '100%', marginTop: '12px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
            border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, borderRadius: '9px',
            padding: '10px', cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
          }}>Done</button>
        </div>,
        document.body
      )}
    </>
  );
}

/* ── Filter section wrapper ─────────────────────────────────────── */
function FG({ title, children }) {
  // colors inherit from --fp-* vars set on the FiltersPanel root (theme-aware)
  return (
    <div style={{ marginBottom:'16px', paddingBottom:'16px', borderBottom:'1px solid var(--fp-line, #f3f4f6)' }}>
      <p style={{ fontSize:'10px', fontWeight:'700', color:'var(--fp-muted, #9ca3af)', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 10px' }}>{title}</p>
      {children}
    </div>
  );
}

/* ── Filter panel (sidebar + drawer content) ────────────────────── */
function FiltersPanel({ isMarketplace, draft, setDraftParam }) {
  const d = draft;
  const dark = !isMarketplace;
  // Theme vars — inherited by FG and nested controls so the whole drawer themes
  // from one place (dark on the dealer subdomain, light on the marketplace).
  const fpVars = dark ? {
    '--fp-input': sv('bg', SF.surface2), '--fp-border': sv('border', SF.border),
    '--fp-text': sv('text', SF.text), '--fp-muted': sv('muted', SF.textMuted), '--fp-line': sv('border', SF.line),
    '--fp-ink': sv('text', '#ffffff'), '--fp-ink-text': sv('bg', '#0f1115'),
  } : {
    '--fp-input': '#fff', '--fp-border': '#e5e7eb',
    '--fp-text': '#111827', '--fp-muted': '#9ca3af', '--fp-line': '#f3f4f6',
    '--fp-ink': '#0f1115', '--fp-ink-text': '#ffffff',
  };
  const pill = active => ({
    padding:'6px 11px', borderRadius:'6px',
    border:`1px solid ${active ? 'var(--fp-ink)' : 'var(--fp-border)'}`,
    background: active ? 'var(--fp-ink)' : 'var(--fp-input)',
    color: active ? 'var(--fp-ink-text)' : 'var(--fp-text)',
    fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'background-color 120ms var(--xd-ease-out), border-color 120ms var(--xd-ease-out), color 120ms var(--xd-ease-out), box-shadow 120ms var(--xd-ease-out), transform 120ms var(--xd-ease-out), opacity 120ms var(--xd-ease-out)',
    lineHeight:'1.4',
  });
  const sel = {
    width:'100%', background:'var(--fp-input)', border:'1px solid var(--fp-border)', borderRadius:'8px',
    padding:'9px 30px 9px 12px', color:'var(--fp-text)', fontSize:'13px',
    appearance:'none', cursor:'pointer', outline:'none', boxSizing:'border-box',
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center',
  };

  const modelOptions = CAR_DATA[d.brand] || [];

  return (
    <div style={fpVars}>
      <FG title="Hot Deals">
        <button
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background: d.hot_deals?'rgba(251,146,60,0.06)':'var(--fp-input)', border:`1px solid ${d.hot_deals?'rgba(251,146,60,0.35)':'var(--fp-border)'}`, borderRadius:'10px', padding:'10px 14px', cursor:'pointer', color:d.hot_deals?'#d97706':'var(--fp-text)', fontSize:'13px', fontWeight:'700', transition:'background-color 120ms var(--xd-ease-out), border-color 120ms var(--xd-ease-out), color 120ms var(--xd-ease-out), box-shadow 120ms var(--xd-ease-out), transform 120ms var(--xd-ease-out), opacity 120ms var(--xd-ease-out)' }}
          onClick={()=>setDraftParam('hot_deals', d.hot_deals?'':'true')}
        >
          <span style={{ display:'flex', alignItems:'center', gap:'7px' }}><Flame size={13}/> Hot Deals Only</span>
          {d.hot_deals && <span style={{ fontSize:'12px', color:'#d97706' }}>✓</span>}
        </button>
      </FG>

      <FG title="Brand">
        <select style={sel} value={d.brand||''} onChange={e=>setDraftParam('brand', e.target.value)}>
          <option value="">All Brands</option>
          {BRAND_OPTS.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
      </FG>

      {d.brand && modelOptions.length > 0 && (
        <FG title="Model">
          <select style={sel} value={d.model||''} onChange={e=>setDraftParam('model',e.target.value)}>
            <option value="">All {d.brand} Models</option>
            {modelOptions.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </FG>
      )}

      {d.model && (
        <FG title="Variant">
          <input type="text" placeholder="e.g. 1.5 G" value={d.variant||''} onChange={e=>setDraftParam('variant', e.target.value)} style={{ ...sel, padding:'9px 12px', backgroundImage:'none' }}/>
        </FG>
      )}

      <FG title="Price Range">
        <PricePopover minPrice={d.min_price} maxPrice={d.max_price} onApply={(min,max)=>{ setDraftParam('min_price', min); setDraftParam('max_price', max); }}/>
      </FG>

      <FG title="Year">
        <div style={{ display:'flex', gap:'8px' }}>
          <select style={{ ...sel, flex:1 }} value={d.year_from||''} onChange={e=>setDraftParam('year_from',e.target.value)}>
            <option value="">From</option>
            {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select style={{ ...sel, flex:1 }} value={d.year_to||''} onChange={e=>setDraftParam('year_to',e.target.value)}>
            <option value="">To</option>
            {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </FG>

      <FG title="Body Type">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {BODY_TYPES.map(bt=><button key={bt} style={pill(d.body_type===bt)} onClick={()=>setDraftParam('body_type',d.body_type===bt?'':bt)}>{bt}</button>)}
        </div>
      </FG>

      <FG title="Transmission">
        <div style={{ display:'flex', gap:'6px' }}>
          {TRANSMISSIONS.map(tx=><button key={tx} style={pill(d.transmission===tx)} onClick={()=>setDraftParam('transmission',d.transmission===tx?'':tx)}>{tx}</button>)}
        </div>
      </FG>

      <FG title="Condition">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {CONDITION_OPTS.map(co=><button key={co.value} style={pill(d.condition===co.value)} onClick={()=>setDraftParam('condition',d.condition===co.value?'':co.value)}>{co.label}</button>)}
        </div>
      </FG>

      <FG title="Fuel Type">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {FUEL_TYPES.map(ft=><button key={ft} style={pill(d.fuel_type===ft)} onClick={()=>setDraftParam('fuel_type',d.fuel_type===ft?'':ft)}>{ft}</button>)}
        </div>
      </FG>

      <FG title="Max Mileage">
        <select style={sel} value={d.mileage_max||''} onChange={e=>setDraftParam('mileage_max',e.target.value)}>
          <option value="">Any Mileage</option>
          {MILEAGE_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FG>

      <FG title="Location">
        <select style={sel} value={d.state||''} onChange={e=>setDraftParam('state',e.target.value)}>
          <option value="">All States</option>
          {MY_STATES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </FG>

      <FG title="Payment">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {FINANCING_TYPES.map(ft=><button key={ft.value} style={pill(d.financing===ft.value)} onClick={()=>setDraftParam('financing',d.financing===ft.value?'':ft.value)}>{ft.label}</button>)}
        </div>
      </FG>

      <FG title="Colour">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {COLOURS.map(c=><button key={c} style={pill(d.colour===c)} onClick={()=>setDraftParam('colour',d.colour===c?'':c)}>{c}</button>)}
        </div>
      </FG>

      {isMarketplace && (
        <FG title="Seller">
          <div style={{ display:'flex', gap:'6px' }}>
            {SELLER_TYPES.map(st=><button key={st.value} style={pill(d.seller_type===st.value)} onClick={()=>setDraftParam('seller_type',d.seller_type===st.value?'':st.value)}>{st.label}</button>)}
          </div>
        </FG>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function CarListingPage() {
  useMarketplaceTracking();
  const isMarketplace = !isSubdomain();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Keep marketplace routes off a dealer subdomain: /showroom is the all-dealer
  // search, so on a subdomain redirect it to the tenant-scoped /cars (preserving
  // any query). Defensive — the component already scopes by isSubdomain().
  useEffect(() => {
    if (!isMarketplace && window.location.pathname.startsWith('/showroom')) {
      navigate('/cars' + window.location.search, { replace: true });
    }
  }, [isMarketplace, navigate]);
  const { addToCompare, removeFromCompare, isInCompare, compareIds } = useCompare();
  const ctaCtx = useCTAContext();
  const basePath = isMarketplace ? '/showroom' : '/cars';
  // Bug fix (2026-08-20): this used to hardcode `https://drevo.my${basePath}`
  // even on a dealer subdomain, so every dealer storefront's /cars page told
  // Google "the real version of me is the root marketplace" — a different
  // page with different inventory. Point subdomain pages at their own host.
  const canonicalUrl = isMarketplace
    ? `https://drevo.my${basePath}`
    : getStorefrontUrl(getSubdomain(), basePath);

  // Subdomain storefront = dark theme (matches the rest of the dealer page);
  // marketplace = light. Drives the page surfaces below.
  // On a dealer site every colour is `var(--sf-x, <old dark value>)` (sv, shared.js): it follows
  // the dealer's Dark/Light theme + accent (storefrontTheme.js) and is the old look with no theme.
  const dark = !isMarketplace;
  const brandAccent = accentTheme(chosenPageColor(tenant) || PAGE_COLOR_DEFAULT).accent;
  const brandRgb = (hexToRgb(brandAccent) || [220, 38, 38]).join(',');
  const themeStyle = dark ? themeCss(themeOf(tenant?.storefront_layout), brandAccent) : '';
  const T = dark
    ? { pageBg:sv('bg','#08090f'), overlay:'rgba(8,9,15,0.55)',
        text:sv('text','#f3f4f6'), textMuted:sv('muted','#9ca3af'),
        // The top block: one glossy surface with the accent's faint glow at the left (the
        // marketplace header's recipe), card colour down to the page colour.
        topBg:`radial-gradient(ellipse 420px 160px at 0% 0%, rgba(var(--sf-accent-rgb, ${brandRgb}),0.14), transparent 70%), linear-gradient(180deg, ${sv('card','#12141b')} 0%, ${sv('bg','#0b0d13')} 100%)`,
        topLine:sv('border','rgba(255,255,255,0.07)'),
        field:sv('bg','rgba(255,255,255,0.06)'),
        ctl:sv('card','rgba(255,255,255,0.05)'), ctlLine:sv('border','rgba(255,255,255,0.10)'),
        ink:sv('text','#f3f4f6'), inkText:sv('bg','#0b0d13') }
    : { pageBg:'#F7F6F2', overlay:'rgba(247,246,242,0.55)',
        text:'#111827', textMuted:'#6b7280',
        topBg:'radial-gradient(ellipse 420px 160px at 0% 0%, rgba(220,38,38,0.08), rgba(220,38,38,0) 70%), linear-gradient(180deg, #ffffff 0%, #f3f4f7 100%)',
        topLine:'rgba(15,23,42,0.08)',
        field:'#F4F3EF',
        ctl:'#fff', ctlLine:'rgba(15,23,42,0.09)',
        ink:'#0f1115', inkText:'#ffffff' };
  // The ONE glossy red (marketplace: --xd-crimson, the home page's search button) or, on a
  // dealer site, the dealer's accent with the same gloss. Only the main action wears it.
  const accentFill = dark
    ? { background:`linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%), var(--sf-theme-accent, ${brandAccent})`,
        color:'var(--sf-on-accent, #fff)', boxShadow:`0 4px 12px -4px rgba(var(--sf-accent-rgb, ${brandRgb}),0.55)` }
    : null; // marketplace uses the xd-crimson-fill class
  const accentClass = dark ? undefined : 'xd-crimson-fill';

  // Monthly | Price switch for the cards (device-remembered, src/utils/priceMode.js).
  const [priceMode, setPriceMode] = usePriceMode();

  /* ── Parse URL params ── */
  const brand       = san.brand(searchParams.get('brand')||'');
  const bodyType    = san.bodyType(searchParams.get('body_type')||'');
  const transmission = san.tx(searchParams.get('transmission')||'');
  const state       = san.state(searchParams.get('state')||'');
  const minPrice    = san.price(searchParams.get('min_price')||'');
  const maxPrice    = san.price(searchParams.get('max_price')||'');
  const financing   = san.financing(searchParams.get('financing')||'');
  const yearFrom    = san.year(searchParams.get('year_from')||'');
  const yearTo      = san.year(searchParams.get('year_to')||'');
  const q           = san.q(searchParams.get('q')||'');
  const condition   = san.condition(searchParams.get('condition')||'');
  const mileageMax  = san.mileage(searchParams.get('mileage_max')||'');
  const hotDeals    = searchParams.get('hot_deals') === 'true';
  const fuelType    = san.fuelType(searchParams.get('fuel_type')||'');
  const colour      = san.colour(searchParams.get('colour')||'');
  const sellerType  = san.seller(searchParams.get('seller_type')||'');
  const model       = san.str(searchParams.get('model')||'');
  const variant     = san.str(searchParams.get('variant')||'');
  const sort        = ['newest','price_asc','price_desc','year_desc','year_asc','mileage_asc'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
  const page        = san.page(searchParams.get('page')||'1');

  const [searchInput, setSearchInput]   = useState(q);
  // Unfiltered marketplace page 1 paints the fresh saved list on its first
  // render (the server puts one in the page, src/utils/serverSeed.js) instead
  // of skeletons. The fetch below still runs and replaces it.
  const [seed] = useState(() => {
    const unfiltered = isMarketplace && page === 1 && sort === 'newest' && !q
      && !brand && !model && !variant && !bodyType && !state && !minPrice && !maxPrice
      && !financing && !yearFrom && !yearTo && !mileageMax && !hotDeals && !condition
      && !transmission && !fuelType && !colour && !sellerType;
    const hit = unfiltered ? readCache(LIVE_CARS_CACHE_KEY, SEED_TTL) : null;
    return hit?.cars?.length ? hit : null;
  });
  const [cars, setCars]                 = useState(() => seed?.cars.slice(0, PER_PAGE) || []);
  const [totalCount, setTotal]          = useState(() => seed?.totalCount || 0);
  const [loading, setLoading]           = useState(() => !seed);
  const [fetching, setFetching]         = useState(false);
  const [error, setError]               = useState(null);
  // Showing the device's saved copy because the live fetch failed (marketplace,
  // unfiltered page 1 only) -- drives StaleListingsNotice.
  const [showingSaved, setShowingSaved] = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  useModalHistory(drawerOpen, () => setDrawerOpen(false));
  const initialLoad = useRef(true);
  // Stays set until the first answer lands: the fetch re-runs once while the
  // tenant check settles, and that re-run must not bring the skeletons back.
  const refreshQuietly = useRef(!!seed);

  // Sidebar / grid-cols are driven by JS so the correct layout is set on the
  // very first render — no FOUC from CSS class overrides loading after paint.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth > 1024
  );
  useEffect(() => {
    const update = () => {
      setIsWide(window.innerWidth > 1024);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => setSearchInput(q), [q]);

  // Search commits ONLY on submit (Enter / search-button), never per keystroke —
  // a debounced live search fired a DB query on every pause in typing, burning
  // database usage. commitSearch preserves the other active filters instead of
  // navigating to a bare ?q= (which used to wipe them).
  const commitSearch = (val) => {
    const sq = san.q(val);
    const next = new URLSearchParams(searchParams);
    sq ? next.set('q', sq) : next.delete('q');
    next.delete('page');
    setSearchParams(next, { replace:true });
  };

  // Phone search: an icon that opens the field (owner, 2026-11-21). Cancel puts the words back.
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => { setSearchOpen(false); setSearchInput(q); };
  const submitSearch = (val) => { commitSearch(val); setSearchOpen(false); };

  // Quick-pick chips: white pills on a hairline, selected = ink (never a tint).
  const chipBase = { flexShrink:0, display:'inline-flex', alignItems:'center', gap:'5px', height:'38px', padding:'0 14px', borderRadius:'999px', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit', transition:'background-color 120ms var(--xd-ease-out), color 120ms var(--xd-ease-out), box-shadow 120ms var(--xd-ease-out)' };
  const chip = (on) => ({ ...chipBase, border:'none', background: on ? T.ink : T.ctl, color: on ? T.inkText : T.text, boxShadow: on ? 'none' : `0 0 0 1px ${T.ctlLine}` });

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const setParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    val ? next.set(key, val) : next.delete(key);
    next.delete('page');
    setSearchParams(next, { replace:true });
  };
  const setPage  = p => { const next = new URLSearchParams(searchParams); next.set('page', String(p)); setSearchParams(next, { replace:true }); };

  // ── Draft filters ── The filter panel edits a local draft; nothing refetches
  // until the user hits Search. Committed filters live in the URL (drive the
  // fetch, chips, share links). This stops every colour/brand tap from loading.
  const PANEL_KEYS = ['hot_deals','brand','model','variant','min_price','max_price','year_from','year_to','body_type','transmission','condition','fuel_type','mileage_max','state','financing','colour','seller_type'];
  const draftFromParams = () => { const o = {}; PANEL_KEYS.forEach(k => { const v = searchParams.get(k); if (v) o[k] = v; }); return o; };
  const [draft, setDraft] = useState(draftFromParams);
  const committedSig = PANEL_KEYS.map(k => searchParams.get(k) || '').join('|');
  // Resync the draft whenever committed (URL) filters change — apply, chip
  // removal, reset, or back/forward navigation.
  useEffect(() => { setDraft(draftFromParams()); }, [committedSig]); // eslint-disable-line
  const setDraftParam = (key, val) => setDraft(p => {
    const n = { ...p };
    if (val) n[key] = val; else delete n[key];
    if (key === 'brand') { delete n.model; delete n.variant; }
    if (key === 'model') { delete n.variant; }
    return n;
  });
  const draftDirty = committedSig !== PANEL_KEYS.map(k => draft[k] || '').join('|');
  const applyDraft = () => {
    const next = new URLSearchParams(searchParams);
    PANEL_KEYS.forEach(k => next.delete(k));
    Object.entries(draft).forEach(([k, v]) => { if (v) next.set(k, v); });
    next.delete('page');
    setSearchParams(next, { replace: true });
    setDrawerOpen(false);
  };

  const resetAll = () => { setSearchInput(''); setDraft({}); setSearchParams({}, { replace:true }); };

  /* ── Fetch ── */
  const reqSeq = useRef(0);
  const fetchCars = useCallback(async () => {
    if (!isMarketplace && tenantLoading) return;
    const myReq = ++reqSeq.current;
    // Same sanitised values the query below filters on, so "unfiltered" here
    // means exactly the rows the query returns.
    const isDefaultShowroom = isMarketplace && page === 1 && sort === 'newest' && !q
      && !brand && !model && !variant && !bodyType && !state && !minPrice && !maxPrice
      && !financing && !yearFrom && !yearTo && !mileageMax && !hotDeals && !condition
      && !transmission && !fuelType && !colour && !sellerType;
    // Seeded cars are refreshed quietly: no skeleton, no dimmed grid over
    // cars that are already right.
    if (refreshQuietly.current) { /* keep the seeded grid up */ }
    else if (initialLoad.current) { setLoading(true); } else { setFetching(true); }
    setError(null);
    try {
      const from = (page-1)*PER_PAGE, to = from+PER_PAGE-1;
      // publicClient: a public read must never wait on the login lock. On
      // `supabase` a stuck lock left this grid on skeletons with the request
      // never sent (2026-10-12, signed-in seller searching "Ferrari").
      let query = publicClient
        .from('public_car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, { count:'exact' })
        .in('status', ['available', 'reserved']);

      if (!isMarketplace && tenant?.id) query = query.eq('dealer_id', tenant.id);
      // New-car model cards stay out of the grid, stock photos or the advisor's
      // own (owner, 2026-10-23): one per advisor per model, so the grid filled with
      // copies. They show on the advisor's mini page and /new-cars/:brand/:model.
      if (isMarketplace) query = query.eq('is_model_card', false);

      if (q) {
        q.trim().split(/\s+/).filter(Boolean).slice(0,6).forEach(t => {
          // Strip LIKE wildcards (% _ \) AND PostgREST filter delimiters ( , ( ) )
          // so a search token can't corrupt the .or() filter tree below.
          const s = t.replace(/[%_\\(),]/g,'');
          if (!s) return;
          // Search name + free-text spec fields so feature queries ("bucket
          // seats", "sunroof") match, plus chassis-code expansion ("g82" → M4).
          const parts = [
            `brand.ilike.%${s}%`, `model.ilike.%${s}%`, `variant.ilike.%${s}%`,
            `options.ilike.%${s}%`, `features.ilike.%${s}%`, `specs.ilike.%${s}%`,
          ];
          const cc = chassisSearch(s);
          if (cc) {
            const ors = cc.models.flatMap(m => [`model.ilike.%${m}%`, `variant.ilike.%${m}%`]);
            parts.push(`and(brand.ilike.%${cc.brand}%,or(${ors.join(',')}))`);
          }
          query = query.or(parts.join(','));
        });
      }
      if (brand)        query = query.eq('brand', brand);
      if (model) {
        // car_listings.model is free text, so one car is stored under several
        // spellings — 12 rows "ALPHARD 2.5L" and 5 rows "Alphard" live right
        // now. An exact .ilike matched one group and hid the other, so a buyer
        // filtering for an Alphard saw 5 of the 17 on the site. Resolve to the
        // canonical model and match its spellings, excluding longer siblings
        // ("Move" must not pull in "Move Canbus"). Falls back to the old exact
        // match when the value does not resolve, so an unknown model still
        // filters rather than returning everything.
        const mf = modelFilter(brand, model);
        if (mf) {
          query = query.or(mf.like.map((pat) => `model.ilike.${pat}`).join(','));
          for (const pat of mf.notLike) query = query.not('model', 'ilike', pat);
        } else {
          query = query.ilike('model', model);
        }
      }
      if (variant)      query = query.ilike('variant', `%${variant}%`);
      if (bodyType)     query = query.eq('body_type', bodyType);
      if (state)        query = query.eq('state', state);
      if (minPrice)     query = query.gte('selling_price', minPrice);
      if (maxPrice)     query = query.lte('selling_price', maxPrice);
      if (financing)    query = query.eq('financing_type', financing);
      if (yearFrom)     query = query.gte('year', yearFrom);
      if (yearTo)       query = query.lte('year', yearTo);
      if (mileageMax)   query = query.lte('mileage', mileageMax);
      // One definition, shared with the marketplace grid, the hero row and
      // get_marketplace_stats — see migration 20260831h.
      if (hotDeals)     query = query.eq('is_hot_deal', true);
      if (condition)    query = query.eq('condition', condition);
      if (transmission) query = query.in('transmission', transmission==='Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT']);
      if (fuelType)     query = query.eq('fuel_type', fuelType);
      if (colour)       query = query.ilike('colour', `%${colour}%`);
      // seller_role is a real column on public_car_listings. This used to filter
      // the EMBEDDED profile (`profiles!dealer_id.role`), which could not work:
      // the embed is aliased `dealer:` in DEALER_JOIN, anon cannot read profiles
      // at all (so the embed is null for every logged-out buyer), and a
      // non-inner embedded filter does not restrict top-level rows anyway — so
      // picking Dealer or Agent either errored or quietly returned everything.
      // Mirror ShowroomCard's badge rule exactly: role !== 'salesman' is
      // "Dealer"; role === 'salesman' splits on seller_type into "Private
      // Seller" vs "Agent" (broker, or seller_type not set yet — treat null
      // as agent so pre-existing standalone sellers keep matching "Agent").
      if (isMarketplace && sellerType === 'agent') {
        query = query.eq('seller_role', 'salesman').or('seller_type.neq.private,seller_type.is.null');
      } else if (isMarketplace && sellerType === 'private') {
        query = query.eq('seller_role', 'salesman').eq('seller_type', 'private');
      } else if (isMarketplace && sellerType === 'dealer') {
        query = query.neq('seller_role', 'salesman');
      }

      if (sort==='price_asc')    query = query.order('selling_price', { ascending:true });
      else if (sort==='price_desc')  query = query.order('selling_price', { ascending:false });
      else if (sort==='year_desc')   query = query.order('year', { ascending:false });
      else if (sort==='year_asc')    query = query.order('year', { ascending:true });
      else if (sort==='mileage_asc') query = query.order('mileage', { ascending:true, nullsFirst:false });
      else                           query = query.order('created_at', { ascending:false });

      query = query.range(from, to);
      // Hard timeout: on a flaky mobile / in-app-webview connection, or a
      // stalled database, a request can neither resolve nor reject, leaving the
      // spinner up forever. withTimeout settles it into data or the fallback.
      const { data, error:err, count } = await withTimeout(query);
      if (err) throw err;
      if (myReq !== reqSeq.current) return; // a newer fetch superseded this one
      setCars(data||[]); setTotal(count||0); setShowingSaved(false);
      trackBrowse({
        surface: isMarketplace ? 'marketplace' : 'storefront',
        dealerId: !isMarketplace ? tenant?.id : null,
        filters: { brand, model, variant, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType },
        sort, page, count: count || 0, shown: (data || []).length,
      });
      // Keep the device's copy of the live grid fresh from here too, so a buyer
      // who only ever lands on /showroom still has something during an outage.
      if (isDefaultShowroom) writeCache(LIVE_CARS_CACHE_KEY, { cars: data || [], totalCount: count || 0 });
    } catch {
      if (myReq !== reqSeq.current) return;
      // Unfiltered marketplace page 1 only: unfiltered cars under an active
      // filter (or on a dealer's own storefront) would be wrong, not just stale.
      const saved = isDefaultShowroom ? readLiveCarsFallback() : null;
      if (saved) {
        setCars(saved.cars); setTotal(saved.cars.length); setShowingSaved(true);
      } else {
        setError('Failed to load listings. Please try again.');
      }
    }
    finally { if (myReq === reqSeq.current) { setLoading(false); setFetching(false); initialLoad.current = false; refreshQuietly.current = false; } }
  }, [page, brand, model, variant, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType, sort, isMarketplace, tenant?.id, tenantLoading]); // eslint-disable-line

  useEffect(() => { fetchCars(); }, [fetchCars]);
  useEffect(() => { window.scrollTo({ top:0, behavior:'smooth' }); }, [page]);

  /* Store visit tracking */
  useEffect(() => {
    if (!isMarketplace) return;
    const key = 'sv_fired_main';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key,'1');
    trackEvent(supabase,'store_visit',{ dealer_id:null, metadata:{ source:'organic' } });
  }, []); // eslint-disable-line

  const hasFilters = brand||bodyType||transmission||state||minPrice||maxPrice||financing||yearFrom||yearTo||q||condition||mileageMax||hotDeals||fuelType||colour||sellerType||model||variant;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  /* Active chip list */
  const activeChips = [
    q          && { key:'q',           label:`"${q}"` },
    brand      && { key:'brand',       label:brand },
    model      && { key:'model',       label:model },
    variant    && { key:'variant',     label:`Variant: ${variant}` },
    bodyType   && { key:'body_type',   label:bodyType },
    transmission && { key:'transmission', label:transmission },
    state      && { key:'state',       label:state },
    (minPrice||maxPrice) && { key:'price_range', label:`${minPrice?PRICE_STEPS.find(s=>s.value===String(minPrice))?.label:'Any'} – ${maxPrice?PRICE_STEPS.find(s=>s.value===String(maxPrice))?.label:'Any'}` },
    financing  && { key:'financing',   label:FINANCING_TYPES.find(f=>f.value===financing)?.label||'' },
    yearFrom   && { key:'year_from',   label:`From ${yearFrom}` },
    yearTo     && { key:'year_to',     label:`To ${yearTo}` },
    condition  && { key:'condition',   label:CONDITION_OPTS.find(c=>c.value===condition)?.label||condition },
    mileageMax && { key:'mileage_max', label:MILEAGE_OPTS.find(m=>m.value===String(mileageMax))?.label||'' },
    hotDeals   && { key:'hot_deals',   label:'Hot Deals' },
    fuelType   && { key:'fuel_type',   label:fuelType },
    colour     && { key:'colour',      label:colour },
    sellerType && { key:'seller_type', label: SELLER_TYPES.find(st => st.value === sellerType)?.label || sellerType },
  ].filter(Boolean);

  // The search words show in the open field, so they are not a chip too.
  const filterChips = activeChips.filter(c => c.key !== 'q');

  const removeChip = key => {
    if (key==='price_range') { const n=new URLSearchParams(searchParams); n.delete('min_price'); n.delete('max_price'); n.delete('page'); setSearchParams(n,{replace:true}); }
    else if (key==='hot_deals') setParam('hot_deals','');
    else if (key==='brand') { const n=new URLSearchParams(searchParams); n.delete('brand'); n.delete('model'); n.delete('variant'); n.delete('page'); setSearchParams(n,{replace:true}); }
    else if (key==='model') { const n=new URLSearchParams(searchParams); n.delete('model'); n.delete('variant'); n.delete('page'); setSearchParams(n,{replace:true}); }
    else setParam(key,'');
  };

  const filtersProps = { isMarketplace, draft, setDraftParam };

  /* ── Early states ── */
  if (!isMarketplace && !tenantLoading && !tenant) {
    // tenantError = lookup failed (network/database), not a miss.
    return <StorefrontError failed={tenantError} />;
  }

  return (
    <>
      <Helmet>
        <title>{(() => {
          if (hotDeals) return 'Hot Deal Cars in Malaysia — Best Prices | Drevo';
          const parts = [];
          if (condition==='recon') parts.push('Recon');
          if (brand) parts.push(brand);
          if (model) parts.push(model);
          if (bodyType) parts.push(bodyType+'s');
          const carType = parts.length ? parts.join(' ')+' ' : '';
          const loc = state ? ` in ${state}, Malaysia` : ' in Malaysia';
          return `Used ${carType}Cars for Sale${loc} | Drevo`;
        })()}</title>
        <meta name="description" content={`Browse cars for sale${state?' in '+state:' in Malaysia'}. Filter by brand, price, body type and more on Drevo.`}/>
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
        <link rel="canonical" href={canonicalUrl}/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      </Helmet>

      <style>{`
        @keyframes cl-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .cl-sidebar-scroll::-webkit-scrollbar { width:3px }
        .cl-sidebar-scroll::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:2px }
        .cl-brand-scroll::-webkit-scrollbar { display:none }
        .cl-chips-scroll::-webkit-scrollbar { display:none }
        .cl-fab { display:none !important }
        .cl-phone-only { display:none !important }
        @media(max-width:767px) {
          .cl-phone-only { display:flex !important }
          .cl-desk-only { display:none !important }
          .cl-controls-hide { display:none !important }
          .cl-seg { margin-left:auto }
        }
        .cl-filter-btn-topbar { display:flex !important }
        @media(max-width:1024px) {
          .cl-fab { display:flex !important }
          .cl-sidebar-desktop { display:none !important }
          .cl-layout { flex-direction:column !important }
        }
        @media(max-width:640px) {
          .cl-topbar { flex-wrap:wrap !important }
          .cl-topbar-search { width:100% !important; flex:unset !important }
          /* Controls (sort + filters + save-search) drop to their own full-width
             row under the search and never wrap again — keeps the alert bell at
             the screen's right edge so its dropdown opens inward, not off-screen. */
          .cl-topbar-controls { width:100% !important; }
        }
      `}</style>

      {themeStyle && <style>{themeStyle}</style>}
      {isMarketplace ? <MarketplaceHeader /> : <Suspense fallback={null}><Header /></Suspense>}

      {/* Drawer backdrop — above header (z-100) */}
      {drawerOpen && (
        <div onClick={()=>setDrawerOpen(false)} style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)' }}/>
      )}

      {/* Filter drawer — slides from RIGHT, above header */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, zIndex:1110,
        width:'300px', maxWidth:'92vw',
        background: dark ? sv('card', SF.surface) : '#fff', borderLeft:`1px solid ${dark ? sv('border', SF.border) : '#e5e7eb'}`,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
        display:'flex', flexDirection:'column',
        fontFamily:"'Outfit',sans-serif",
        boxShadow: drawerOpen ? '-12px 0 40px rgba(0,0,0,0.12)' : 'none',
      }}>
        {/* Drawer header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:`1px solid ${dark ? sv('border', SF.line) : '#f3f4f6'}` }}>
          <h2 style={{ margin:0, fontSize:'15px', fontWeight:'800', color: dark ? sv('text', SF.text) : '#111827', display:'flex', alignItems:'center', gap:'8px', fontFamily:"'Outfit',sans-serif" }}>
            <SlidersHorizontal size={15} style={{ color:T.textMuted }}/> Filters
            {activeChips.length > 0 && (
              <span style={{ background: dark ? `var(--sf-theme-accent, ${brandAccent})` : '#de1c3e', color:'#fff', fontSize:'10px', fontWeight:'800', padding:'2px 6px', borderRadius:'4px' }}>{activeChips.length}</span>
            )}
          </h2>
          <button onClick={()=>setDrawerOpen(false)} style={{ background: dark ? sv('bg', 'rgba(255,255,255,0.06)') : 'rgba(0,0,0,0.04)', border:'none', cursor:'pointer', color: dark ? sv('muted', SF.textSec) : '#6b7280', borderRadius:'8px', padding:'6px', display:'flex', alignItems:'center' }}>
            <X size={16}/>
          </button>
        </div>
        {/* Drawer body */}
        <div className="cl-sidebar-scroll" style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
          <FiltersPanel {...filtersProps}/>
        </div>
        {/* Drawer footer */}
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${dark ? sv('border', SF.line) : '#f3f4f6'}`, display:'flex', gap:'10px' }}>
          <button onClick={resetAll} style={{ flex:1, background: dark ? sv('bg', 'rgba(255,255,255,0.06)') : 'rgba(0,0,0,0.04)', border:`1px solid ${dark ? sv('border', SF.border) : '#e5e7eb'}`, color: dark ? sv('muted', SF.textSec) : '#6b7280', fontSize:'13px', fontWeight:'600', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
            Reset
          </button>
          <button onClick={applyDraft} style={{ flex:2, ...(accentFill || { background:'var(--xd-crimson)', color:'#fff', boxShadow:'var(--xd-crimson-shadow)' }), border:'none', fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
            <Search size={14}/> Search
          </button>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} style={{ background:T.pageBg, minHeight:'100vh', fontFamily:"'Outfit',sans-serif", paddingTop: dark ? '64px' : 0 }}>

        {/* ── Top block (owner, 2026-11-21: "blocky and messy") ── ONE glossy surface: search,
             sort, Monthly | Price. On a phone the search is an ICON that opens the field
             (`searchOpen`); a search in force keeps the field open with its words, so the buyer
             sees why the list is short. Desktop keeps the field open. On the subdomain the
             header is a floating fixed pill, so this block is in-flow; on the marketplace it
             sticks below the header at the height the header really occupies (--mh-h). */}
        <div className="cl-top" style={{ background:T.topBg, borderBottom:`1px solid ${T.topLine}`, position: dark ? 'static' : 'sticky', top: dark ? 'auto' : 'var(--mh-h, 64px)', transition:'top .28s ease', zIndex:20 }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 16px' }}>
            {/* Phone: the open field (tapped icon, or a search in force) */}
            {(searchOpen || q) && (
              <div className="cl-phone-only" style={{ display:'flex', alignItems:'center', gap:'10px', paddingTop:'10px' }}>
                <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:'6px', background: searchOpen ? T.ctl : T.field, borderRadius:'14px', boxShadow: searchOpen ? `0 0 0 2px ${T.ink}` : `0 0 0 1px ${T.ctlLine}` }}>
                  <SearchAutocomplete
                    value={searchInput}
                    onChange={setSearchInput}
                    dark={dark}
                    autoFocus={searchOpen}
                    placeholder={dark ? 'Search our cars' : 'Search brand, model, variant'}
                    wrapStyle={{ flex:1, minWidth:0 }}
                    formStyle={{ background:'transparent', border:'none', height:'44px' }}
                    inputStyle={{ fontSize:'16px', padding:'10px 8px 10px 4px' }}
                    navigateTo={basePath}
                    onSubmit={submitSearch}
                  />
                  {!searchOpen && q && (
                    <button type="button" onClick={()=>{ setSearchInput(''); commitSearch(''); }} aria-label="Clear search"
                      style={{ flexShrink:0, width:'28px', height:'28px', marginRight:'8px', borderRadius:'999px', border:'none', background:T.ctlLine, color:T.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                      <X size={14}/>
                    </button>
                  )}
                </div>
                {searchOpen && (
                  <button type="button" onClick={closeSearch}
                    style={{ flexShrink:0, background:'none', border:'none', padding:'10px 2px', color:T.text, fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                    Cancel
                  </button>
                )}
              </div>
            )}

            <div className={`cl-controls${searchOpen ? ' cl-controls-hide' : ''}`} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 0 12px' }}>
              {/* Desktop: the field, always open */}
              <SearchAutocomplete
                value={searchInput}
                onChange={setSearchInput}
                dark={dark}
                placeholder={dark ? 'Search our cars' : 'Search brand, model, variant'}
                wrapClassName="cl-desk-only"
                wrapStyle={{ flex:'1 1 auto', maxWidth:'520px', marginRight:'auto' }}
                formStyle={{ background:T.field, border:'none', borderRadius:'14px', height:'46px', boxShadow:`inset 0 0 0 1px ${T.ctlLine}` }}
                inputStyle={{ fontSize:'14.5px' }}
                navigateTo={basePath}
                onSubmit={commitSearch}
              />
              {/* Phone: the icon */}
              {!q && (
                <button type="button" className="cl-phone-only" onClick={()=>setSearchOpen(true)} aria-label="Search"
                  style={{ flexShrink:0, width:'40px', height:'40px', borderRadius:'12px', border:'none', background:T.field, color:T.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                  <Search size={18}/>
                </button>
              )}
              {/* Sort: a tight label + icon with a transparent native select laid over it */}
              <div style={{ position:'relative', flexShrink:0, display:'inline-flex', alignItems:'center', gap:'6px', height:'40px', padding:'0 6px', cursor:'pointer' }}>
                <ArrowDownWideNarrow size={16} style={{ color:T.textMuted, flexShrink:0 }}/>
                <span style={{ fontSize:'13.5px', fontWeight:'700', color:T.text, whiteSpace:'nowrap' }}>{(SORT_OPTIONS.find(o=>o.value===sort)||SORT_OPTIONS[0]).short}</span>
                <select
                  value={sort}
                  onChange={e=>setParam('sort',e.target.value)}
                  aria-label="Sort"
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer', border:'none', appearance:'none', fontFamily:"'Outfit',sans-serif" }}
                >
                  {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div role="group" aria-label="Show cards by" className="cl-seg" style={{ display:'inline-flex', flexShrink:0, padding:'3px', borderRadius:'999px', background:T.field }}>
                {[['monthly','Monthly'],['price','Price']].map(([v,label])=>(
                  <button key={v} type="button" aria-pressed={priceMode===v} onClick={()=>setPriceMode(v)}
                    style={{ padding:'0 12px', height:'34px', borderRadius:'999px', border:'none', background:priceMode===v?T.ink:'transparent', color:priceMode===v?T.inkText:T.textMuted, fontSize:'12.5px', fontWeight:'700', cursor:'pointer', transition:'background-color 120ms var(--xd-ease-out), color 120ms var(--xd-ease-out)', fontFamily:'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
              {isMarketplace && (
                <PriceAlertButton
                  hasFilters={!!hasFilters}
                  filters={{ keyword:q||null, brand:brand||null, model:model||null, variant:variant||null, bodyType:bodyType||null, state:state||null, condition:condition||null, maxPrice:maxPrice||null, minYear:yearFrom||null, maxYear:yearTo||null }}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Chips: Filters (the one glossy accent) first, then the quick picks ── */}
        <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'12px 16px 0' }}>
          <div className="cl-chips-scroll" style={{ display:'flex', alignItems:'center', gap:'6px', overflowX:'auto', padding:'2px 2px 4px', scrollbarWidth:'none' }}>
            <button type="button" onClick={()=>setDrawerOpen(true)} className={accentClass}
              style={{ ...chipBase, ...(accentFill || {}), border:'none', fontWeight:'700', gap:'6px', paddingLeft:'12px' }}>
              <SlidersHorizontal size={14}/> Filters
              {filterChips.length > 0 && (
                <span style={{ minWidth:'18px', height:'18px', padding:'0 5px', borderRadius:'999px', background:'rgba(255,255,255,0.95)', color: dark ? `var(--sf-theme-accent, ${brandAccent})` : '#c0102f', fontSize:'11px', fontWeight:'800', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{filterChips.length}</span>
              )}
            </button>
            <span aria-hidden style={{ width:'1px', alignSelf:'stretch', margin:'6px 2px', background:T.ctlLine, flexShrink:0 }}/>
            <button type="button" aria-pressed={hotDeals} onClick={()=>setParam('hot_deals',hotDeals?'':'true')} style={chip(hotDeals)}>
              <Flame size={13} color={hotDeals ? 'currentColor' : '#ea580c'}/> Hot deals
            </button>
            {BODY_TYPES.map(bt=>(
              <button key={bt} type="button" aria-pressed={bodyType===bt} onClick={()=>setParam('body_type',bodyType===bt?'':bt)} style={chip(bodyType===bt)}>
                {bt}
              </button>
            ))}
          </div>
          {isMarketplace && <NewBrandRow />}
        </div>

        {/* ── Main content ── */}
        <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'16px 16px 80px' }}>

          {/* AI summary teaser — shows whenever a text search is active. Not built yet; this
              just sets the expectation instead of staying silent. Grey, no tint. */}
          {q && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', background:T.ctl, boxShadow:`0 0 0 1px ${T.ctlLine}`, borderRadius:'12px', padding:'10px 14px', marginBottom:'14px' }}>
              <Sparkles size={14} style={{ color:T.textMuted, flexShrink:0 }} />
              <span style={{ fontSize:'12.5px', fontWeight:'600', color:T.text }}>
                AI summary of "{q}" results — coming soon
              </span>
            </div>
          )}

          {/* The page's one heading, for screen readers + search engines (visually hidden: the results row is the visible title). */}
          <h1 style={{ position:'absolute', width:1, height:1, margin:-1, padding:0, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap', border:0 }}>
            {hotDeals ? 'Hot deal cars in Malaysia' : `Used cars for sale${brand ? ' - ' + brand : ''}${model ? ' ' + model : ''}${state ? ' in ' + state : ' in Malaysia'}`}
          </h1>

          {/* Results: the count, then the filters in force (each with an x) */}
          <p style={{ margin:'0 0 10px', fontSize:'17px', fontWeight:'800', color:T.text, letterSpacing:'-0.01em' }}>
            {loading ? '…' : totalCount.toLocaleString()} <span style={{ fontSize:'14px', fontWeight:'600', color:T.textMuted }}>{totalCount === 1 ? 'car' : 'cars'} for sale</span>
          </p>
          {filterChips.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center', marginBottom:'14px' }}>
              {filterChips.map(chip=>(
                <span key={chip.key} style={{ display:'inline-flex', alignItems:'center', gap:'2px', background:T.ctl, boxShadow:`0 0 0 1px ${T.ctlLine}`, color:T.text, fontSize:'12px', fontWeight:'600', padding:'0 4px 0 11px', height:'30px', borderRadius:'999px' }}>
                  {chip.label}
                  <button onClick={()=>removeChip(chip.key)} aria-label={`Remove ${chip.label} filter`} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:'8px 6px', display:'flex', alignItems:'center' }}><X size={12}/></button>
                </span>
              ))}
              <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:'12px', fontWeight:'700', minHeight:'30px', padding:'0 6px', fontFamily:'inherit' }}>
                Clear all
              </button>
            </div>
          )}

          {/* ── Layout: grid LEFT + sidebar RIGHT ── */}
          <div className="cl-layout" style={{ display:'flex', gap:'24px', alignItems: isWide ? 'flex-start' : 'stretch', flexDirection: isWide ? 'row' : 'column' }}>

            {/* Car grid */}
            <div style={{ flex:1, minWidth:0 }}>
              {showingSaved && !error && <StaleListingsNotice onRetry={fetchCars} />}
              {error && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <p style={{ color:'#dc2626', fontSize:'15px', marginBottom:'16px' }}>{error}</p>
                  <button onClick={fetchCars} style={{ ...(accentFill || { background:'var(--xd-crimson)', boxShadow:'var(--xd-crimson-shadow)' }), color:'#fff', border:'none', padding:'12px 24px', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Try Again</button>
                </div>
              )}
              {!error && (
                <div style={{ position:'relative' }}>
                  {fetching && (
                    <div style={{ position:'absolute', inset:0, zIndex:5, background:T.overlay, borderRadius:'12px', backdropFilter:'blur(2px)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'8px' }}>
                      <span style={{ background:T.ink, color:T.inkText, fontSize:'11px', fontWeight:'700', padding:'4px 8px', borderRadius:'4px', fontFamily:"'Outfit',sans-serif" }}>Updating…</span>
                    </div>
                  )}
                  <div className="cl-grid sc-grid" style={{ opacity:fetching?0.5:1, transition:'opacity 0.18s' }}>
                    {loading
                      ? Array.from({ length: PER_PAGE }).map((_,i) => <ShowroomCardSkeleton key={i} dark={dark}/>)
                      : cars.length === 0
                        ? (
                          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'80px 20px' }}>
                            <Car size={48} color="#d1d5db" style={{ marginBottom:'16px' }}/>
                            <p style={{ color:T.text, fontSize:'18px', fontWeight:'700', margin:'0 0 8px', fontFamily:"'Outfit',sans-serif" }}>No cars match your filters</p>
                            <p style={{ color:T.textMuted, fontSize:'14px', margin:'0 0 24px' }}>Try adjusting your search or clear some filters.</p>
                            <button onClick={resetAll} style={{ display:'inline-flex', alignItems:'center', gap:'6px', ...(accentFill || { background:'var(--xd-crimson)', boxShadow:'var(--xd-crimson-shadow)' }), border:'none', color:'#fff', fontSize:'13px', fontWeight:'700', padding:'11px 24px', borderRadius:'10px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                              <RotateCcw size={13}/> Clear all filters
                            </button>
                          </div>
                        )
                        : cars.map((car,i) => {
                            const inCompare = isInCompare(car.id);
                            const compareFull = compareIds.length >= 4 && !inCompare;
                            return (
                              <ShowroomCard
                                key={car.id} car={car} ctaContext={ctaCtx} dark={dark} priceMode={priceMode}
                                inCompare={inCompare} compareFull={compareFull}
                                onCompare={()=>{ inCompare ? removeFromCompare(car.id) : addToCompare(car.id); }}
                                priority={i===0}
                              />
                            );
                          })
                    }
                  </div>
                </div>
              )}
              {!loading && !error && !showingSaved && totalPages > 1 && (
                <div style={{ padding:'40px 0 20px' }}>
                  <Pagination page={page} totalPages={totalPages} onPage={setPage}/>
                  <p style={{ textAlign:'center', color:T.textMuted, fontSize:'13px', marginTop:'12px', fontFamily:"'Outfit',sans-serif" }}>
                    Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,totalCount)} of {totalCount.toLocaleString()} cars
                  </p>
                </div>
              )}
            </div>

            {/* ── Filter sidebar — RIGHT side (desktop only) ── */}
            {isWide && <aside
              className="cl-sidebar-desktop cl-sidebar-scroll"
              style={{ width:'260px', flexShrink:0, background: dark ? sv('card', '#0d1117') : '#fff', border:`1px solid ${dark ? sv('border', 'rgba(255,255,255,0.08)') : '#e5e7eb'}`, borderRadius:'16px', padding:'16px 18px', position:'sticky', top:'calc(var(--mh-h, 64px) + 88px)', transition:'top .28s ease', maxHeight:'calc(100vh - var(--mh-h, 64px) - 108px)', overflowY:'auto' }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', paddingBottom:'12px', borderBottom:`1px solid ${dark ? sv('border', 'rgba(255,255,255,0.08)') : '#f3f4f6'}` }}>
                <h2 style={{ color:T.text, fontSize:'13px', fontWeight:'800', margin:0, display:'flex', alignItems:'center', gap:'6px', fontFamily:"'Outfit',sans-serif" }}>
                  <SlidersHorizontal size={13} style={{ color:T.textMuted }}/> Filters
                  {activeChips.length > 0 && (
                    <span style={{ background: dark ? `var(--sf-theme-accent, ${brandAccent})` : '#de1c3e', color:'#fff', fontSize:'9px', fontWeight:'800', padding:'1px 5px', borderRadius:'4px' }}>{activeChips.length}</span>
                  )}
                </h2>
                {hasFilters && (
                  <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', fontFamily:"'Outfit',sans-serif" }}>
                    <RotateCcw size={10}/> Reset
                  </button>
                )}
              </div>
              <FiltersPanel {...filtersProps}/>
              <div style={{ position:'sticky', bottom:0, background: dark ? sv('card', '#0d1117') : '#fff', paddingTop:'12px', marginTop:'4px', borderTop:`1px solid ${dark ? sv('border', 'rgba(255,255,255,0.08)') : '#f3f4f6'}` }}>
                <button onClick={applyDraft} disabled={!draftDirty}
                  style={{ width:'100%', background: draftDirty ? (dark ? accentFill.background : 'var(--xd-crimson)') : (dark ? sv('bg', 'rgba(255,255,255,0.06)') : '#f3f4f6'), border:'none', color: draftDirty ? '#fff' : (dark ? sv('muted', 'rgba(255,255,255,0.4)') : '#9ca3af'), fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'12px', cursor: draftDirty ? 'pointer' : 'default', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
                  <Search size={14}/> Search
                </button>
              </div>
            </aside>}

          </div>
        </div>
      </main>

      <MarketplaceFooter />
      {!isMarketplace && <Suspense fallback={null}><StickyWhatsAppButton /></Suspense>}
    </>
  );
}
