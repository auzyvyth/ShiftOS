import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { X, RotateCcw, SlidersHorizontal, Flame, Car, ChevronDown, Search } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import MarketplaceHeader from '../components/MarketplaceHeader';
import Header from '../components/Header';
import MarketplaceFooter from '../components/MarketplaceFooter';
import BrandStrip from '../components/marketplace/BrandStrip';
import StickyWhatsAppButton from '../components/StickyWhatsAppButton';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { useMarketplaceTracking } from '../hooks/useMarketplaceTracking';
import useTenant, { isSubdomain } from '../hooks/useTenant';
import { PRICE_STEPS } from '../components/PriceDrumPicker';
import { CAR_DATA } from '../components/CarForm';
import SearchAutocomplete from '../components/SearchAutocomplete';
import PriceAlertButton from '../components/PriceAlertButton';
import ShowroomCard, { ShowroomCardSkeleton } from '../components/ShowroomCard';
import Pagination from '../components/ui/Pagination';
import { storefront as SF } from '../theme/tokens';

/* ── Constants ──────────────────────────────────────────────────── */
const PER_PAGE = 15;

const BRANDS = [
  'Perodua','Proton','Honda','Toyota','Nissan','Mazda','Mitsubishi','Suzuki',
  'Subaru','Daihatsu','Hyundai','Kia','BMW','Mercedes-Benz','Mercedes',
  'Volkswagen','Audi','Porsche','Lexus','Volvo','Tesla','Ford','MG','BYD',
  'MINI','Chery','Haval','Geely','Jaguar','Land Rover','Ferrari','Lamborghini','Bentley',
];
const BRAND_OPTS  = ['Perodua','Proton','Honda','Toyota','Mazda','BMW','Mercedes-Benz','Hyundai','Nissan','Mitsubishi','Kia','Volvo','Lexus','Subaru','Volkswagen','Audi','Suzuki','Daihatsu'];
const BODY_TYPES  = ['Sedan','SUV','MPV','Hatchback','Coupe','Pickup'];
const TRANSMISSIONS = ['Auto','Manual'];
const FINANCING_TYPES = [
  { value:'loan',          label:'Loan'          },
  { value:'cash',          label:'Cash Only'     },
  { value:'sambung_bayar', label:'Sambung Bayar' },
];
const MY_STATES = ['Kuala Lumpur','Selangor','Johor','Penang','Perak','Kedah','Pahang','Negeri Sembilan','Melaka','Sabah','Sarawak','Terengganu','Kelantan','Perlis'];
const SORT_OPTIONS = [
  { label:'Newest First',       value:'newest'      },
  { label:'Price: Low to High', value:'price_asc'   },
  { label:'Price: High to Low', value:'price_desc'  },
  { label:'Year: Newest',       value:'year_desc'   },
  { label:'Year: Oldest',       value:'year_asc'    },
  { label:'Lowest Mileage',     value:'mileage_asc' },
];
const MILEAGE_OPTS = [
  { label:'Under 20,000 km',  value:'20000'  },
  { label:'Under 50,000 km',  value:'50000'  },
  { label:'Under 80,000 km',  value:'80000'  },
  { label:'Under 150,000 km', value:'150000' },
];
const CONDITION_OPTS = [
  { value:'used',  label:'Used'           },
  { value:'new',   label:'New'            },
  { value:'recon', label:'Recon / Import' },
];
const FUEL_TYPES  = ['Petrol','Diesel','Electric','Hybrid','Mild Hybrid'];
const COLOURS     = ['White','Black','Silver','Grey','Red','Blue','Brown','Green','Orange','Yellow','Gold','Maroon'];
const SELLER_TYPES = [{ value:'dealer', label:'Dealer' },{ value:'agent', label:'Agent' }];
const CUR_YEAR    = new Date().getFullYear();
const YEARS       = Array.from({ length: CUR_YEAR - 1989 }, (_, i) => CUR_YEAR - i);

const CAR_FIELDS  = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at,market_avg_price';
const DEALER_JOIN = 'dealer:profiles!dealer_id(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color,role)';

/* ── Sanitisers ─────────────────────────────────────────────────── */
const san = {
  brand:     v => BRANDS.includes(v) ? v : null,
  bodyType:  v => BODY_TYPES.includes(v) ? v : null,
  tx:        v => TRANSMISSIONS.includes(v) ? v : null,
  financing: v => FINANCING_TYPES.map(f=>f.value).includes(v) ? v : null,
  state:     v => MY_STATES.includes(v) ? v : null,
  price:     v => { const n=parseInt(v,10); return PRICE_STEPS.some(s=>s.value===String(n)) ? n : null; },
  page:      v => { const n=parseInt(v,10); return Number.isFinite(n)&&n>=1 ? n : 1; },
  year:      v => { const n=parseInt(v,10); return Number.isFinite(n)&&n>=1990&&n<=CUR_YEAR ? n : null; },
  q:         v => (!v||typeof v!=='string') ? '' : v.replace(/[%_\\]/g,'').slice(0,60).trim(),
  condition: v => CONDITION_OPTS.map(c=>c.value).includes(v) ? v : null,
  mileage:   v => { const n=parseInt(v,10); return [20000,50000,80000,150000].includes(n) ? n : null; },
  fuelType:  v => FUEL_TYPES.includes(v) ? v : null,
  colour:    v => COLOURS.includes(v) ? v : null,
  seller:    v => ['dealer','agent'].includes(v) ? v : null,
  str:       v => (!v||typeof v!=='string') ? '' : v.replace(/[%_\\]/g,'').slice(0,80).trim(),
};

/* ── Price range popover (click → floating min/max picker) ──────── */
function PricePopover({ minPrice, maxPrice, onApply }) {
  const [open, setOpen] = useState(false);
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
                transition: 'all 0.1s',
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
    '--fp-input': SF.surface2, '--fp-border': SF.border,
    '--fp-text': SF.text, '--fp-muted': SF.textMuted, '--fp-line': SF.line,
  } : {
    '--fp-input': '#fff', '--fp-border': '#e5e7eb',
    '--fp-text': '#111827', '--fp-muted': '#9ca3af', '--fp-line': '#f3f4f6',
  };
  const pill = active => ({
    padding:'6px 13px', borderRadius:'50px',
    border:`1px solid ${active ? '#dc2626' : 'var(--fp-border)'}`,
    background: active ? 'rgba(220,38,38,0.06)' : 'var(--fp-input)',
    color: active ? '#dc2626' : 'var(--fp-text)',
    fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'all 0.12s',
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
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background: d.hot_deals?'rgba(251,146,60,0.06)':'var(--fp-input)', border:`1px solid ${d.hot_deals?'rgba(251,146,60,0.35)':'var(--fp-border)'}`, borderRadius:'10px', padding:'10px 14px', cursor:'pointer', color:d.hot_deals?'#d97706':'var(--fp-text)', fontSize:'13px', fontWeight:'700', transition:'all 0.12s' }}
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
  const { tenant, loading: tenantLoading } = useTenant();
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

  // Subdomain storefront = dark theme (matches the rest of the dealer page);
  // marketplace = light. Drives the page surfaces below.
  const dark = !isMarketplace;
  const T = dark
    ? { pageBg:'#08090f', barBg:'rgba(13,17,23,0.97)', barBorder:'rgba(255,255,255,0.08)',
        ctrlBg:'rgba(255,255,255,0.06)', ctrlBorder:'rgba(255,255,255,0.12)',
        text:'#f3f4f6', textMuted:'#9ca3af', chipBg:'rgba(255,255,255,0.04)',
        chipBorder:'rgba(255,255,255,0.12)', chipText:'#d1d5db', overlay:'rgba(8,9,15,0.55)' }
    : { pageBg:'#F7F6F2', barBg:'rgba(247,246,242,0.96)', barBorder:'rgba(0,0,0,0.07)',
        ctrlBg:'#fff', ctrlBorder:'#e5e7eb',
        text:'#111827', textMuted:'#6b7280', chipBg:'#fff',
        chipBorder:'#e5e7eb', chipText:'#374151', overlay:'rgba(247,246,242,0.55)' };

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
  const [cars, setCars]                 = useState([]);
  const [totalCount, setTotal]          = useState(0);
  const [loading, setLoading]           = useState(true);
  const [fetching, setFetching]         = useState(false);
  const [error, setError]               = useState(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const initialLoad = useRef(true);

  // Sidebar / grid-cols are driven by JS so the correct layout is set on the
  // very first render — no FOUC from CSS class overrides loading after paint.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth > 1024
  );
  const [isTwoCols, setIsTwoCols] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth > 640
  );
  useEffect(() => {
    const update = () => {
      setIsWide(window.innerWidth > 1024);
      setIsTwoCols(window.innerWidth > 640);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => setSearchInput(q), [q]);

  /* Debounce search input → URL param */
  useEffect(() => {
    const t = setTimeout(() => {
      const sq = san.q(searchInput);
      if (sq === q) return;
      const next = new URLSearchParams(searchParams);
      sq ? next.set('q', sq) : next.delete('q');
      next.delete('page');
      setSearchParams(next, { replace:true });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

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
  const fetchCars = useCallback(async () => {
    if (!isMarketplace && tenantLoading) return;
    if (initialLoad.current) { setLoading(true); } else { setFetching(true); }
    setError(null);
    try {
      const from = (page-1)*PER_PAGE, to = from+PER_PAGE-1;
      let query = supabase
        .from('public_car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, { count:'exact' })
        .in('status', ['available', 'reserved']);

      if (!isMarketplace && tenant?.id) query = query.eq('dealer_id', tenant.id);

      if (q) {
        q.trim().split(/\s+/).filter(Boolean).slice(0,6).forEach(t => {
          const s = t.replace(/[%_\\]/g,'');
          if (s) query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,variant.ilike.%${s}%`);
        });
      }
      if (brand)        query = query.eq('brand', brand);
      if (model)        query = query.ilike('model', model);        // case-insensitive
      if (variant)      query = query.ilike('variant', `%${variant}%`);
      if (bodyType)     query = query.eq('body_type', bodyType);
      if (state)        query = query.eq('state', state);
      if (minPrice)     query = query.gte('selling_price', minPrice);
      if (maxPrice)     query = query.lte('selling_price', maxPrice);
      if (financing)    query = query.eq('financing_type', financing);
      if (yearFrom)     query = query.gte('year', yearFrom);
      if (yearTo)       query = query.lte('year', yearTo);
      if (mileageMax)   query = query.lte('mileage', mileageMax);
      if (hotDeals)     query = query.not('original_price','is',null).gt('original_price',0);
      if (condition)    query = query.eq('condition', condition);
      if (transmission) query = query.in('transmission', transmission==='Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT']);
      if (fuelType)     query = query.eq('fuel_type', fuelType);
      if (colour)       query = query.ilike('colour', `%${colour}%`);
      if (isMarketplace && sellerType) query = query.filter('profiles!dealer_id.role','eq', sellerType==='agent'?'salesman':'dealer');

      if (sort==='price_asc')    query = query.order('selling_price', { ascending:true });
      else if (sort==='price_desc')  query = query.order('selling_price', { ascending:false });
      else if (sort==='year_desc')   query = query.order('year', { ascending:false });
      else if (sort==='year_asc')    query = query.order('year', { ascending:true });
      else if (sort==='mileage_asc') query = query.order('mileage', { ascending:true, nullsFirst:false });
      else                           query = query.order('created_at', { ascending:false });

      query = query.range(from, to);
      const { data, error:err, count } = await query;
      if (err) throw err;
      setCars(data||[]); setTotal(count||0);
    } catch { setError('Failed to load listings. Please try again.'); }
    finally { setLoading(false); setFetching(false); initialLoad.current = false; }
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
    sellerType && { key:'seller_type', label:sellerType==='agent'?'Agent':'Dealer' },
  ].filter(Boolean);

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
    return (
      <>
        <Header />
        <div style={{ background:'#F7F6F2', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
          <Car size={36} color="#d1d5db" style={{ marginBottom:16 }}/>
          <p style={{ color:'#6b7280', fontSize:15, margin:'0 0 12px' }}>This dealer page doesn't exist.</p>
          <a href="https://xdrive.my" style={{ color:'#dc2626', fontSize:13, fontWeight:'600' }}>Browse all cars on XDrive</a>
        </div>
        <MarketplaceFooter />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{(() => {
          if (hotDeals) return 'Hot Deal Cars in Malaysia — Best Prices | XDrive';
          const parts = [];
          if (condition==='recon') parts.push('Recon');
          if (brand) parts.push(brand);
          if (model) parts.push(model);
          if (bodyType) parts.push(bodyType+'s');
          const carType = parts.length ? parts.join(' ')+' ' : '';
          const loc = state ? ` in ${state}, Malaysia` : ' in Malaysia';
          return `Used ${carType}Cars for Sale${loc} | XDrive`;
        })()}</title>
        <meta name="description" content={`Browse verified cars for sale${state?' in '+state:' in Malaysia'}. Filter by brand, price, body type and more on XDrive.`}/>
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
        <link rel="canonical" href={`https://xdrive.my${basePath}`}/>
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
        .cl-filter-btn-topbar { display:flex !important }
        @media(max-width:1024px) {
          .cl-fab { display:flex !important }
          .cl-sidebar-desktop { display:none !important }
          .cl-layout { flex-direction:column !important }
        }
        @media(max-width:640px) {
          .cl-grid { grid-template-columns:1fr !important; gap:10px !important }
          .cl-topbar { flex-wrap:wrap !important }
          .cl-topbar-search { width:100% !important; flex:unset !important }
        }
        @media(min-width:641px) and (max-width:900px) {
          .cl-grid { grid-template-columns:repeat(2,1fr) !important }
        }
        .sc-root { transition:transform 0.18s ease,box-shadow 0.18s ease; }
        .sc-root:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09) !important; }
      `}</style>

      {isMarketplace ? <MarketplaceHeader /> : <Header />}

      {/* Drawer backdrop — above header (z-100) */}
      {drawerOpen && (
        <div onClick={()=>setDrawerOpen(false)} style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)' }}/>
      )}

      {/* Filter drawer — slides from RIGHT, above header */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, zIndex:1110,
        width:'300px', maxWidth:'92vw',
        background: dark ? SF.surface : '#fff', borderLeft:`1px solid ${dark ? SF.border : '#e5e7eb'}`,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
        display:'flex', flexDirection:'column',
        fontFamily:"'Outfit',sans-serif",
        boxShadow: drawerOpen ? '-12px 0 40px rgba(0,0,0,0.12)' : 'none',
      }}>
        {/* Drawer header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:`1px solid ${dark ? SF.line : '#f3f4f6'}` }}>
          <h2 style={{ margin:0, fontSize:'15px', fontWeight:'800', color: dark ? SF.text : '#111827', display:'flex', alignItems:'center', gap:'8px', fontFamily:"'Outfit',sans-serif" }}>
            <SlidersHorizontal size={15} style={{ color:'#dc2626' }}/> Filters
            {activeChips.length > 0 && (
              <span style={{ background:'#dc2626', color:'#fff', fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'20px' }}>{activeChips.length}</span>
            )}
          </h2>
          <button onClick={()=>setDrawerOpen(false)} style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border:'none', cursor:'pointer', color: dark ? SF.textSec : '#6b7280', borderRadius:'8px', padding:'6px', display:'flex', alignItems:'center' }}>
            <X size={16}/>
          </button>
        </div>
        {/* Drawer body */}
        <div className="cl-sidebar-scroll" style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
          <FiltersPanel {...filtersProps}/>
        </div>
        {/* Drawer footer */}
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${dark ? SF.line : '#f3f4f6'}`, display:'flex', gap:'10px' }}>
          <button onClick={resetAll} style={{ flex:1, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border:`1px solid ${dark ? SF.border : '#e5e7eb'}`, color: dark ? SF.textSec : '#6b7280', fontSize:'13px', fontWeight:'600', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
            Reset
          </button>
          <button onClick={applyDraft} style={{ flex:2, background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'#fff', fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
            <Search size={14}/> Search
          </button>
        </div>
      </div>

      <main style={{ background:T.pageBg, minHeight:'100vh', fontFamily:"'Outfit',sans-serif", paddingTop: dark ? '84px' : 0 }}>

        {/* ── Top bar ── On the subdomain the header is a floating fixed pill that
             hides on scroll, so the bar is in-flow (scrolls away, never follows /
             overlaps the header). On the marketplace it stays sticky below the
             64px sticky header. */}
        <div style={{ background:T.barBg, backdropFilter:'blur(12px)', borderBottom:`1px solid ${T.barBorder}`, padding:'10px 0', position: dark ? 'static' : 'sticky', top: dark ? 'auto' : '64px', zIndex:20 }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 20px' }}>
            <div className="cl-topbar" style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {/* Search */}
              <SearchAutocomplete
                value={searchInput}
                onChange={setSearchInput}
                dark={dark}
                placeholder="Search brand, model, variant…"
                wrapClassName="cl-topbar-search"
                wrapStyle={{ flex:1, minWidth:'160px' }}
                navigateTo={basePath}
                onSubmit={val=>{
                  const sq = san.q(val);
                  navigate(sq ? `${basePath}?q=${encodeURIComponent(sq)}` : basePath);
                }}
              />
              {/* Sort */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <select
                  value={sort}
                  onChange={e=>setParam('sort',e.target.value)}
                  style={{ background:T.ctrlBg, border:`1px solid ${T.ctrlBorder}`, borderRadius:'9px', padding:'8px 32px 8px 12px', color:T.text, fontSize:'13px', fontWeight:'600', cursor:'pointer', appearance:'none', fontFamily:"'Outfit',sans-serif", outline:'none' }}
                >
                  {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={12} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}/>
              </div>
              {/* Filters button — always right-most */}
              <button
                onClick={()=>setDrawerOpen(true)}
                style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0, background:activeChips.length>0?'rgba(220,38,38,0.07)':T.ctrlBg, border:`1px solid ${activeChips.length>0?'rgba(220,38,38,0.3)':T.ctrlBorder}`, borderRadius:'9px', padding:'8px 14px', color:activeChips.length>0?'#dc2626':T.textMuted, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'all 0.12s' }}
              >
                <SlidersHorizontal size={13}/> Filters {activeChips.length>0&&`(${activeChips.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Quick-filter chip strip ── */}
        <div style={{ background:T.pageBg, borderBottom:`1px solid ${T.barBorder}`, padding:'8px 0' }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 20px' }}>
            <div className="cl-chips-scroll" style={{ display:'flex', gap:'7px', overflowX:'auto', paddingBottom:'2px', scrollbarWidth:'none' }}>
              <button
                style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'5px', padding:'5px 13px', borderRadius:'50px', border:`1px solid ${hotDeals?'rgba(251,146,60,0.35)':T.chipBorder}`, background:hotDeals?'rgba(251,146,60,0.07)':T.chipBg, color:hotDeals?'#d97706':T.chipText, fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'all 0.12s', whiteSpace:'nowrap' }}
                onClick={()=>setParam('hot_deals',hotDeals?'':'true')}
              >
                <Flame size={11}/> Hot Deals
              </button>
              {BODY_TYPES.map(bt=>(
                <button key={bt}
                  style={{ flexShrink:0, padding:'5px 13px', borderRadius:'50px', border:`1px solid ${bodyType===bt?'rgba(220,38,38,0.3)':T.chipBorder}`, background:bodyType===bt?'rgba(220,38,38,0.06)':T.chipBg, color:bodyType===bt?'#dc2626':T.chipText, fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'all 0.12s', whiteSpace:'nowrap' }}
                  onClick={()=>setParam('body_type',bodyType===bt?'':bt)}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Brand strip — marketplace only ── */}
        {isMarketplace && (
          <BrandStrip
            activeBrand={brand || ''}
            hrefFor={(v) => (v ? `${basePath}?brand=${encodeURIComponent(v)}` : basePath)}
          />
        )}

        {/* ── Main content ── */}
        <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'20px 20px 80px' }}>

          {/* Results row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px', marginBottom:'16px' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center' }}>
              <span style={{ color:T.textMuted, fontSize:'13px' }}>
                <span style={{ color:T.text, fontWeight:'700' }}>{loading ? '…' : totalCount.toLocaleString()}</span> cars found
              </span>
              {activeChips.map(chip=>(
                <span key={chip.key} style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.2)', color:'#dc2626', fontSize:'12px', fontWeight:'600', padding:'4px 10px', borderRadius:'20px', fontFamily:"'Outfit',sans-serif" }}>
                  {chip.label}
                  <button onClick={()=>removeChip(chip.key)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:0, display:'flex', alignItems:'center', marginLeft:1 }}><X size={10}/></button>
                </span>
              ))}
              {hasFilters && (
                <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'12px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', fontFamily:"'Outfit',sans-serif" }}>
                  <RotateCcw size={11}/> Clear all
                </button>
              )}
            </div>
            {isMarketplace && (
              <PriceAlertButton
                hasFilters={!!hasFilters}
                filters={{ brand:brand||null, model:model||null, variant:variant||null, bodyType:bodyType||null, state:state||null, condition:condition||null, maxPrice:maxPrice||null, minYear:yearFrom||null, maxYear:yearTo||null }}
              />
            )}
          </div>

          {/* ── Layout: grid LEFT + sidebar RIGHT ── */}
          <div className="cl-layout" style={{ display:'flex', gap:'24px', alignItems: isWide ? 'flex-start' : 'stretch', flexDirection: isWide ? 'row' : 'column' }}>

            {/* Car grid */}
            <div style={{ flex:1, minWidth:0 }}>
              {error && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <p style={{ color:'#dc2626', fontSize:'15px', marginBottom:'16px' }}>{error}</p>
                  <button onClick={fetchCars} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'12px 24px', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Try Again</button>
                </div>
              )}
              {!error && (
                <div style={{ position:'relative' }}>
                  {fetching && (
                    <div style={{ position:'absolute', inset:0, zIndex:5, background:T.overlay, borderRadius:'12px', backdropFilter:'blur(2px)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'8px' }}>
                      <span style={{ background:'rgba(220,38,38,0.9)', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'4px 10px', borderRadius:'20px', fontFamily:"'Outfit',sans-serif" }}>Updating…</span>
                    </div>
                  )}
                  <div className="cl-grid" style={{ display:'grid', gridTemplateColumns: isTwoCols ? 'repeat(2,1fr)' : '1fr', gap: isTwoCols ? '14px' : '10px', opacity:fetching?0.5:1, transition:'opacity 0.18s' }}>
                    {loading
                      ? Array.from({ length: PER_PAGE }).map((_,i) => <ShowroomCardSkeleton key={i} dark={dark}/>)
                      : cars.length === 0
                        ? (
                          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'80px 20px' }}>
                            <Car size={48} color="#d1d5db" style={{ marginBottom:'16px' }}/>
                            <p style={{ color:T.text, fontSize:'18px', fontWeight:'700', margin:'0 0 8px', fontFamily:"'Outfit',sans-serif" }}>No cars match your filters</p>
                            <p style={{ color:T.textMuted, fontSize:'14px', margin:'0 0 24px' }}>Try adjusting your search or clear some filters.</p>
                            <button onClick={resetAll} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'#fff', fontSize:'13px', fontWeight:'700', padding:'11px 24px', borderRadius:'50px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                              <RotateCcw size={13}/> Clear all filters
                            </button>
                          </div>
                        )
                        : cars.map((car,i) => {
                            const inCompare = isInCompare(car.id);
                            const compareFull = compareIds.length >= 4 && !inCompare;
                            return (
                              <ShowroomCard
                                key={car.id} car={car} ctaContext={ctaCtx} dark={dark}
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
              {!loading && !error && totalPages > 1 && (
                <div style={{ padding:'40px 0 20px' }}>
                  <Pagination page={page} totalPages={totalPages} onPage={setPage}/>
                  <p style={{ textAlign:'center', color:'#6b7280', fontSize:'13px', marginTop:'12px', fontFamily:"'Outfit',sans-serif" }}>
                    Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,totalCount)} of {totalCount.toLocaleString()} cars
                  </p>
                </div>
              )}
            </div>

            {/* ── Filter sidebar — RIGHT side (desktop only) ── */}
            {isWide && <aside
              className="cl-sidebar-desktop cl-sidebar-scroll"
              style={{ width:'260px', flexShrink:0, background: dark ? '#0d1117' : '#fff', border:`1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, borderRadius:'16px', padding:'16px 18px', position:'sticky', top:'130px', maxHeight:'calc(100vh - 150px)', overflowY:'auto' }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', paddingBottom:'12px', borderBottom:`1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}>
                <h2 style={{ color:T.text, fontSize:'13px', fontWeight:'800', margin:0, display:'flex', alignItems:'center', gap:'6px', fontFamily:"'Outfit',sans-serif" }}>
                  <SlidersHorizontal size={13} style={{ color:'#dc2626' }}/> Filters
                  {activeChips.length > 0 && (
                    <span style={{ background:'#dc2626', color:'#fff', fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'20px' }}>{activeChips.length}</span>
                  )}
                </h2>
                {hasFilters && (
                  <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', fontFamily:"'Outfit',sans-serif" }}>
                    <RotateCcw size={10}/> Reset
                  </button>
                )}
              </div>
              <FiltersPanel {...filtersProps}/>
              <div style={{ position:'sticky', bottom:0, background: dark ? '#0d1117' : '#fff', paddingTop:'12px', marginTop:'4px', borderTop:`1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}>
                <button onClick={applyDraft} disabled={!draftDirty}
                  style={{ width:'100%', background: draftDirty ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'), border:'none', color: draftDirty ? '#fff' : (dark ? 'rgba(255,255,255,0.4)' : '#9ca3af'), fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'12px', cursor: draftDirty ? 'pointer' : 'default', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'7px' }}>
                  <Search size={14}/> Search
                </button>
              </div>
            </aside>}

          </div>
        </div>
      </main>

      {/* Mobile FAB — bottom-right; raised above the WhatsApp button on dealer subdomains */}
      <MarketplaceFooter />
      {!isMarketplace && <StickyWhatsAppButton />}
    </>
  );
}
