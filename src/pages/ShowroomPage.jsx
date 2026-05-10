import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import {
  X, ChevronLeft, ChevronRight, RotateCcw, Car,
  SlidersHorizontal, Search, Flame, ArrowLeftRight,
} from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import MarketplaceHeader from '../components/MarketplaceHeader';
import Footer from '@/components/Footer';
import CarCard from '@/components/CarCard';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { isSubdomain } from '../hooks/useTenant';

/* ── Constants ───────────────────────────────────────────────────────────── */
const PER_PAGE = 15;

const BRANDS = ['Perodua','Proton','Honda','Toyota','Mazda','BMW','Mercedes-Benz','Hyundai','Nissan','Mitsubishi','Kia','Volvo'];
const BODY_TYPES = ['Sedan','SUV','MPV','Hatchback','Coupe','Pickup'];
const TRANSMISSIONS = ['Auto','Manual'];
const FINANCING_TYPES = [
  { value: 'loan',          label: 'Loan' },
  { value: 'cash',          label: 'Cash Only' },
  { value: 'sambung_bayar', label: 'Sambung Bayar' },
];
const MY_STATES = ['Kuala Lumpur','Selangor','Johor','Penang','Perak','Kedah','Pahang','Negeri Sembilan','Melaka','Sabah','Sarawak','Terengganu','Kelantan','Perlis'];
const PRICE_OPTIONS = [
  { label: 'Under RM 30,000',  value: '30000'  },
  { label: 'Under RM 50,000',  value: '50000'  },
  { label: 'Under RM 80,000',  value: '80000'  },
  { label: 'Under RM 120,000', value: '120000' },
  { label: 'Under RM 200,000', value: '200000' },
];
const SORT_OPTIONS = [
  { label: 'Newest First',       value: 'newest'     },
  { label: 'Price: Low to High', value: 'price_asc'  },
  { label: 'Price: High to Low', value: 'price_desc' },
];
const MILEAGE_OPTIONS = [
  { label: 'Under 20,000 km',  value: '20000'  },
  { label: 'Under 50,000 km',  value: '50000'  },
  { label: 'Under 80,000 km',  value: '80000'  },
  { label: 'Under 150,000 km', value: '150000' },
];
const CONDITION_OPTIONS = [
  { value: 'used',  label: 'Used'          },
  { value: 'new',   label: 'New'           },
  { value: 'recon', label: 'Recon / Import'},
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

const CAR_FIELDS   = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at';
const DEALER_JOIN  = 'dealer:profiles!car_listings_dealer_id_fkey(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color)';

/* ── Sanitisers ──────────────────────────────────────────────────────────── */
const sanitize = {
  brand:      v => BRANDS.includes(v) ? v : null,
  bodyType:   v => BODY_TYPES.includes(v) ? v : null,
  tx:         v => TRANSMISSIONS.includes(v) ? v : null,
  financing:  v => FINANCING_TYPES.map(f => f.value).includes(v) ? v : null,
  state:      v => MY_STATES.includes(v) ? v : null,
  price:      v => { const n = parseInt(v,10); return [30000,50000,80000,120000,200000].includes(n) ? n : null; },
  page:       v => { const n = parseInt(v,10); return Number.isFinite(n) && n >= 1 ? n : 1; },
  year:       v => { const n = parseInt(v,10); return Number.isFinite(n) && n >= 1990 && n <= CURRENT_YEAR ? n : null; },
  q:          v => (!v || typeof v !== 'string') ? '' : v.replace(/[%_\\]/g,'').slice(0,60).trim(),
  condition:  v => CONDITION_OPTIONS.map(c => c.value).includes(v) ? v : null,
  mileage:    v => { const n = parseInt(v,10); return [20000,50000,80000,150000].includes(n) ? n : null; },
};

/* ── Pagination ──────────────────────────────────────────────────────────── */
const Pagination = ({ page, totalPages, onPage }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else if (page <= 4)  { pages.push(1,2,3,4,5,'…',totalPages); }
  else if (page >= totalPages - 3) { pages.push(1,'…',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages); }
  else { pages.push(1,'…',page-1,page,page+1,'…',totalPages); }

  const btn = { minWidth:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9ca3af', fontSize:'14px', fontWeight:'600', cursor:'pointer', transition:'all 0.15s', fontFamily:"'DM Sans',sans-serif", padding:'0 8px' };
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', flexWrap:'wrap' }}>
      <button onClick={() => onPage(page-1)} disabled={page===1} style={{ ...btn, opacity: page===1?0.35:1, cursor: page===1?'not-allowed':'pointer', gap:'4px', padding:'0 12px', fontSize:'13px' }}><ChevronLeft size={15}/> Prev</button>
      {pages.map((p,i) => p==='…'
        ? <span key={`e${i}`} style={{ color:'#4b5563', padding:'0 4px' }}>…</span>
        : <button key={p} onClick={() => onPage(p)} style={{ ...btn, background: p===page?'#dc2626':'transparent', borderColor: p===page?'#dc2626':'rgba(255,255,255,0.1)', color: p===page?'#fff':'#9ca3af' }}>{p}</button>
      )}
      <button onClick={() => onPage(page+1)} disabled={page===totalPages} style={{ ...btn, opacity: page===totalPages?0.35:1, cursor: page===totalPages?'not-allowed':'pointer', gap:'4px', padding:'0 12px', fontSize:'13px' }}>Next <ChevronRight size={15}/></button>
    </div>
  );
};

/* ── Skeleton ────────────────────────────────────────────────────────────── */
const Skeleton = () => (
  <div style={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
    <div style={{ height:'190px', background:'linear-gradient(90deg,#111827 25%,#1a2332 50%,#111827 75%)', backgroundSize:'200% 100%', animation:'sr-shimmer 1.5s infinite' }}/>
    <div style={{ padding:'16px' }}>
      {[80,55,95,70].map((w,i) => <div key={i} style={{ height:'11px', width:`${w}%`, background:'#1a2332', borderRadius:'5px', marginBottom:'9px', animation:'sr-shimmer 1.5s infinite', animationDelay:`${i*0.1}s` }}/>)}
    </div>
  </div>
);

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function ShowroomPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const ctaCtx = useCTAContext();
  const { addToCompare, removeFromCompare, isInCompare, compareIds } = useCompare();

  const brand       = sanitize.brand(searchParams.get('brand') || '');
  const bodyType    = sanitize.bodyType(searchParams.get('body_type') || '');
  const transmission= sanitize.tx(searchParams.get('transmission') || '');
  const state       = sanitize.state(searchParams.get('state') || '');
  const maxPrice    = sanitize.price(searchParams.get('max_price') || '');
  const financing   = sanitize.financing(searchParams.get('financing') || '');
  const yearFrom    = sanitize.year(searchParams.get('year_from') || '');
  const yearTo      = sanitize.year(searchParams.get('year_to') || '');
  const q           = sanitize.q(searchParams.get('q') || '');
  const condition   = sanitize.condition(searchParams.get('condition') || '');
  const mileageMax  = sanitize.mileage(searchParams.get('mileage_max') || '');
  const hotDeals    = searchParams.get('hot_deals') === 'true';
  const sort        = ['newest','price_asc','price_desc'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
  const page        = sanitize.page(searchParams.get('page') || '1');

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);

  const [cars, setCars]               = useState([]);
  const [totalCount, setTotal]        = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    const key = 'sv_fired_main';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackEvent(supabase, 'store_visit', { dealer_id: null, metadata: { source: 'organic' } });
  }, []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next, { replace: true });
  };
  const setPage = p => { const next = new URLSearchParams(searchParams); next.set('page', String(p)); setSearchParams(next, { replace: true }); };
  const resetAll = () => { setSearchInput(''); setSearchParams({}, { replace: true }); };

  const hasFilters = brand || bodyType || transmission || state || maxPrice || financing || yearFrom || yearTo || q || condition || mileageMax || hotDeals;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  const fetchCars = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const from = (page-1)*PER_PAGE, to = from+PER_PAGE-1;
      let query = supabase.from('car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, { count:'exact' })
        .eq('status','available');
      if (q)          query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%,variant.ilike.%${q}%`);
      if (brand)      query = query.eq('brand', brand);
      if (bodyType)   query = query.eq('body_type', bodyType);
      if (state)      query = query.eq('state', state);
      if (maxPrice)   query = query.lte('selling_price', maxPrice);
      if (financing)  query = query.eq('financing_type', financing);
      if (yearFrom)   query = query.gte('year', yearFrom);
      if (yearTo)     query = query.lte('year', yearTo);
      if (mileageMax) query = query.lte('mileage', mileageMax);
      if (hotDeals)   query = query.not('original_price','is',null).gt('original_price',0);
      if (condition)  query = query.eq('condition', condition);
      if (transmission) query = query.in('transmission', transmission==='Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT']);
      if (sort==='price_asc')  query = query.order('selling_price', { ascending:true });
      else if (sort==='price_desc') query = query.order('selling_price', { ascending:false });
      else query = query.order('created_at', { ascending:false });
      query = query.range(from, to);
      const { data, error:err, count } = await query;
      if (err) throw err;
      setCars(data || []); setTotal(count || 0);
    } catch { setError('Failed to load listings. Please try again.'); }
    finally { setLoading(false); }
  }, [page, brand, bodyType, state, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, sort]);

  useEffect(() => { fetchCars(); window.scrollTo({ top:0, behavior:'smooth' }); }, [fetchCars]);

  const activeChips = [
    q           && { key:'q',           label:`"${q}"` },
    brand       && { key:'brand',       label:brand },
    bodyType    && { key:'body_type',   label:bodyType },
    transmission&& { key:'transmission',label:transmission },
    state       && { key:'state',       label:state },
    maxPrice    && { key:'max_price',   label: PRICE_OPTIONS.find(p=>p.value===String(maxPrice))?.label||'' },
    financing   && { key:'financing',   label: FINANCING_TYPES.find(f=>f.value===financing)?.label||'' },
    yearFrom    && { key:'year_from',   label:`From ${yearFrom}` },
    yearTo      && { key:'year_to',     label:`To ${yearTo}` },
    condition   && { key:'condition',   label: CONDITION_OPTIONS.find(c=>c.value===condition)?.label||condition },
    mileageMax  && { key:'mileage_max', label: MILEAGE_OPTIONS.find(m=>m.value===String(mileageMax))?.label||'' },
    hotDeals    && { key:'hot_deals',   label:'🔥 Hot Deals' },
  ].filter(Boolean);

  /* shared filter panel */
  const pill = active => ({
    padding:'8px 14px', borderRadius:'50px',
    border:`1px solid ${active?'#dc2626':'rgba(255,255,255,0.1)'}`,
    background: active?'rgba(220,38,38,0.15)':'transparent',
    color: active?'#f87171':'#9ca3af',
    fontSize:'13px', fontWeight:'600', cursor:'pointer',
    transition:'all 0.15s', fontFamily:"'DM Sans',sans-serif",
  });
  const sel = {
    width:'100%', background:'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px',
    padding:'10px 14px', color:'#fff', fontSize:'14px',
    appearance:'none', cursor:'pointer', outline:'none',
    fontFamily:"'DM Sans',sans-serif",
  };
  const FG = ({ title, children }) => (
    <div style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ fontSize:'10px', fontWeight:'700', color:'#6b7280', letterSpacing:'0.12em', textTransform:'uppercase', margin:'0 0 10px', fontFamily:"'DM Sans',sans-serif" }}>{title}</p>
      {children}
    </div>
  );
  const Filters = () => (
    <div>
      <FG title="Hot Deals">
        <button style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background: hotDeals?'rgba(251,146,60,0.1)':'rgba(255,255,255,0.03)', border: hotDeals?'1px solid rgba(251,146,60,0.3)':'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'10px 14px', cursor:'pointer', color: hotDeals?'#fb923c':'#9ca3af', fontSize:'13px', fontWeight:'700', fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s' }} onClick={() => setParam('hot_deals', hotDeals?'':'true')}>
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}><Flame size={13}/> Hot Deals Only</span>
          {hotDeals && <span>✓</span>}
        </button>
      </FG>
      <FG title="Brand">
        <select style={sel} value={brand||''} onChange={e=>setParam('brand',e.target.value)}>
          <option value="">All Brands</option>
          {BRANDS.map(b=><option key={b} value={b} style={{ background:'#0d1117' }}>{b}</option>)}
        </select>
      </FG>
      <FG title="Budget">
        <select style={sel} value={maxPrice||''} onChange={e=>setParam('max_price',e.target.value)}>
          <option value="">Any Budget</option>
          {PRICE_OPTIONS.map(o=><option key={o.value} value={o.value} style={{ background:'#0d1117' }}>{o.label}</option>)}
        </select>
      </FG>
      <FG title="Location">
        <select style={sel} value={state||''} onChange={e=>setParam('state',e.target.value)}>
          <option value="">All States</option>
          {MY_STATES.map(s=><option key={s} value={s} style={{ background:'#0d1117' }}>{s}</option>)}
        </select>
      </FG>
      <FG title="Year">
        <div style={{ display:'flex', gap:'8px' }}>
          <select style={{ ...sel, flex:1 }} value={yearFrom||''} onChange={e=>setParam('year_from',e.target.value)}>
            <option value="">From</option>
            {YEARS.map(y=><option key={y} value={y} style={{ background:'#0d1117' }}>{y}</option>)}
          </select>
          <select style={{ ...sel, flex:1 }} value={yearTo||''} onChange={e=>setParam('year_to',e.target.value)}>
            <option value="">To</option>
            {YEARS.map(y=><option key={y} value={y} style={{ background:'#0d1117' }}>{y}</option>)}
          </select>
        </div>
      </FG>
      <FG title="Body Type">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {BODY_TYPES.map(bt=><button key={bt} style={pill(bodyType===bt)} onClick={()=>setParam('body_type',bodyType===bt?'':bt)}>{bt}</button>)}
        </div>
      </FG>
      <FG title="Transmission">
        <div style={{ display:'flex', gap:'6px' }}>
          {TRANSMISSIONS.map(tx=><button key={tx} style={pill(transmission===tx)} onClick={()=>setParam('transmission',transmission===tx?'':tx)}>{tx}</button>)}
        </div>
      </FG>
      <FG title="Condition">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {CONDITION_OPTIONS.map(co=><button key={co.value} style={pill(condition===co.value)} onClick={()=>setParam('condition',condition===co.value?'':co.value)}>{co.label}</button>)}
        </div>
      </FG>
      <FG title="Max Mileage">
        <select style={sel} value={mileageMax||''} onChange={e=>setParam('mileage_max',e.target.value)}>
          <option value="">Any Mileage</option>
          {MILEAGE_OPTIONS.map(o=><option key={o.value} value={o.value} style={{ background:'#0d1117' }}>{o.label}</option>)}
        </select>
      </FG>
      <FG title="Payment">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {FINANCING_TYPES.map(ft=><button key={ft.value} style={pill(financing===ft.value)} onClick={()=>setParam('financing',financing===ft.value?'':ft.value)}>{ft.label}</button>)}
        </div>
      </FG>
    </div>
  );

  const BRAND_LOGOS = [
    { label:'All',         to:'/showroom',                          initials:'ALL', color:'#DC2626' },
    { label:'Perodua',     to:'/showroom?brand=Perodua',      logo:'https://upload.wikimedia.org/wikipedia/commons/3/31/Perodua_Logo_%282008_-_Present%29.svg' },
    { label:'Proton',      to:'/showroom?brand=Proton',       logo:'https://upload.wikimedia.org/wikipedia/commons/9/99/Proton_AG_Logo_02.svg',           invert:true },
    { label:'Toyota',      to:'/showroom?brand=Toyota',       logo:'https://upload.wikimedia.org/wikipedia/commons/7/78/Toyota_Logo.svg',                 invert:true },
    { label:'Honda',       to:'/showroom?brand=Honda',        logo:'https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg' },
    { label:'Nissan',      to:'/showroom?brand=Nissan',       logo:'https://upload.wikimedia.org/wikipedia/commons/2/23/Nissan_2020_logo.svg',            invert:true },
    { label:'Mazda',       to:'/showroom?brand=Mazda',        logo:'https://upload.wikimedia.org/wikipedia/commons/4/46/Mazda_logo_2024.svg',             invert:true },
    { label:'Mitsubishi',  to:'/showroom?brand=Mitsubishi',   logo:'https://upload.wikimedia.org/wikipedia/commons/5/5a/Mitsubishi_logo.svg' },
    { label:'BMW',         to:'/showroom?brand=BMW',          logo:'https://upload.wikimedia.org/wikipedia/commons/f/f4/BMW_logo_%28gray%29.svg' },
    { label:'Mercedes',    to:'/showroom?brand=Mercedes-Benz',logo:'https://upload.wikimedia.org/wikipedia/commons/9/9e/Mercedes-Benz_%282025%29.svg',    invert:true },
    { label:'Hyundai',     to:'/showroom?brand=Hyundai',      logo:'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg',  invert:true },
  ];

  if (isSubdomain()) return <Navigate to="/" replace />;

  return (
    <>
      <Helmet>
        <title>{brand ? `${brand} Cars for Sale in Malaysia – XDrive Showroom` : 'Showroom – Browse Used Cars in Malaysia | XDrive'}</title>
        <meta name="description" content="Browse thousands of verified used cars from trusted dealers across Malaysia. Filter by brand, price, location, body type and more." />
        <link rel="canonical" href="https://xdrive.my/showroom" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        @keyframes sr-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .sr-sidebar::-webkit-scrollbar { width:3px }
        .sr-sidebar::-webkit-scrollbar-thumb { background:#374151; border-radius:2px }
        .sr-brand-scroll::-webkit-scrollbar { display:none }
        .sr-mobile-filter-btn { display:none !important }
        @media(max-width:1024px){
          .sr-desktop-filter-btn { display:none !important }
          .sr-mobile-filter-btn { display:flex !important }
          .sr-layout { flex-direction:column !important }
        }
        @media(max-width:640px){
          .sr-grid { grid-template-columns:repeat(2,1fr) !important; gap:10px !important }
          .sr-topbar { flex-wrap:wrap !important }
        }
      `}</style>

      <MarketplaceHeader />

      {/* Mobile drawer backdrop */}
      {drawerOpen && <div onClick={()=>setDrawerOpen(false)} style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}/>}

      {/* Mobile drawer */}
      <div style={{ position:'fixed', top:0, right:0, bottom:0, zIndex:50, width:'300px', maxWidth:'90vw', background:'#0d1117', borderLeft:'1px solid rgba(255,255,255,0.07)', transform: drawerOpen?'translateX(0)':'translateX(100%)', transition:'transform 0.3s cubic-bezier(0.22,1,0.36,1)', display:'flex', flexDirection:'column', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <h2 style={{ color:'white', fontWeight:'800', fontSize:'15px', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
            <SlidersHorizontal size={15} style={{ color:'#dc2626' }}/> Filters
            {activeChips.length>0 && <span style={{ background:'#dc2626', color:'white', fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'20px' }}>{activeChips.length}</span>}
          </h2>
          <button onClick={()=>setDrawerOpen(false)} style={{ background:'rgba(255,255,255,0.05)', border:'none', cursor:'pointer', color:'#9ca3af', borderRadius:'8px', padding:'6px', display:'flex' }}><X size={16}/></button>
        </div>
        <div className="sr-sidebar" style={{ flex:1, overflowY:'auto', padding:'8px 20px' }}><Filters/></div>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'10px' }}>
          <button onClick={resetAll} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#9ca3af', fontSize:'13px', fontWeight:'600', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Reset</button>
          <button onClick={()=>setDrawerOpen(false)} style={{ flex:2, background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'white', fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Show {totalCount} cars</button>
        </div>
      </div>

      <div style={{ background:'#080C14', minHeight:'100vh', fontFamily:"'DM Sans',sans-serif" }}>

        {/* ── Top bar ── */}
        <div style={{ background:'rgba(8,12,20,0.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'16px 0', position:'sticky', top:'72px', zIndex:20 }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 24px' }}>
            <div className="sr-topbar" style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              {/* Search */}
              <form onSubmit={e=>{ e.preventDefault(); const sq=sanitize.q(searchInput); navigate(sq?`/showroom?q=${encodeURIComponent(sq)}`:'/showroom'); }} style={{ position:'relative', flex:1, minWidth:'180px' }}>
                <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#4b5563', pointerEvents:'none' }}/>
                <input
                  type="search"
                  placeholder="Search brand, model, year…"
                  value={searchInput}
                  onChange={e=>setSearchInput(e.target.value)}
                  style={{ width:'100%', paddingLeft:'36px', paddingRight:'12px', paddingTop:'10px', paddingBottom:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'10px', color:'white', fontSize:'13px', fontFamily:"'DM Sans',sans-serif", outline:'none', boxSizing:'border-box' }}
                />
              </form>
              {/* Sort */}
              <select value={sort} onChange={e=>setParam('sort',e.target.value)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'10px', padding:'10px 14px', color:'white', fontSize:'13px', fontWeight:'600', cursor:'pointer', appearance:'none', fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                {SORT_OPTIONS.map(o=><option key={o.value} value={o.value} style={{ background:'#0d1117' }}>{o.label}</option>)}
              </select>
              {/* Filters toggle — desktop */}
              <button className="sr-desktop-filter-btn" onClick={()=>setSidebarOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:'6px', background: sidebarOpen?'rgba(220,38,38,0.15)':'rgba(255,255,255,0.05)', border: sidebarOpen?'1px solid rgba(220,38,38,0.3)':'1px solid rgba(255,255,255,0.09)', borderRadius:'10px', padding:'10px 14px', color: sidebarOpen?'#f87171':'#9ca3af', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                <SlidersHorizontal size={14}/> Filters {activeChips.length>0&&`(${activeChips.length})`}
              </button>
              {/* Mobile filter */}
              <button className="sr-fab sr-mobile-filter-btn" onClick={()=>setDrawerOpen(true)} style={{ display:'none', alignItems:'center', gap:'6px', background: activeChips.length>0?'rgba(220,38,38,0.15)':'rgba(255,255,255,0.05)', border: activeChips.length>0?'1px solid rgba(220,38,38,0.3)':'1px solid rgba(255,255,255,0.09)', borderRadius:'10px', padding:'10px 14px', color: activeChips.length>0?'#f87171':'#9ca3af', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                <SlidersHorizontal size={14}/> Filters {activeChips.length>0&&`(${activeChips.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Brand strip ── */}
        <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'24px 0' }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 24px' }}>
            <div className="sr-brand-scroll" style={{ display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'4px', scrollbarWidth:'none' }}>
              {BRAND_LOGOS.map(({ label, to, logo, initials, color, invert }) => {
                const active = brand === label || (label==='All' && !brand);
                return (
                  <Link key={label} to={to} style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', textDecoration:'none' }}>
                    <div style={{ width:'76px', height:'60px', borderRadius:'12px', padding:'10px', background: active?'rgba(220,38,38,0.12)':'rgba(255,255,255,0.04)', border:`1px solid ${active?'rgba(220,38,38,0.4)':'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                      {logo
                        ? <img src={logo} alt={label} style={{ width:'100%', height:'100%', objectFit:'contain', filter: invert?'brightness(0) invert(1)':'none' }} onError={e=>{ e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}/>
                        : null}
                      <span style={{ display: logo?'none':'flex', alignItems:'center', justifyContent:'center', width:'36px', height:'36px', borderRadius:'7px', background: color||'rgba(255,255,255,0.1)', color:'#fff', fontSize:'10px', fontWeight:'700', fontFamily:"'DM Sans',sans-serif" }}>{initials}</span>
                    </div>
                    <span style={{ fontSize:'10px', color: active?'#f87171':'#6b7280', fontFamily:"'DM Sans',sans-serif", fontWeight: active?'700':'500', textAlign:'center', maxWidth:'76px', lineHeight:1.2 }}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'24px 24px 80px' }}>

          {/* Active chips + results count */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'20px' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center' }}>
              <span style={{ color:'#6b7280', fontSize:'13px' }}>
                <span style={{ color:'white', fontWeight:'700' }}>{loading?'…':totalCount.toLocaleString()}</span> cars found
              </span>
              {activeChips.map(chip => (
                <span key={chip.key} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.25)', color:'#f87171', fontSize:'12px', fontWeight:'600', padding:'4px 10px', borderRadius:'20px' }}>
                  {chip.label}
                  <button onClick={()=>chip.key==='hot_deals'?setParam('hot_deals',''):setParam(chip.key,'')} style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', padding:0, display:'flex' }}><X size={10}/></button>
                </span>
              ))}
              {hasFilters && <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'12px', fontWeight:'600', fontFamily:"'DM Sans',sans-serif" }}><RotateCcw size={11} style={{ marginRight:3 }}/>Clear all</button>}
            </div>
          </div>

          <div className="sr-layout" style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>

            {/* Car grid */}
            <div style={{ flex:1, minWidth:0 }}>
              {error && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <p style={{ color:'#f87171', fontSize:'16px', marginBottom:'16px' }}>{error}</p>
                  <button onClick={fetchCars} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'12px 24px', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Try Again</button>
                </div>
              )}
              {!error && (
                <div className="sr-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'18px' }}>
                  {loading
                    ? Array.from({ length:PER_PAGE }).map((_,i)=><Skeleton key={i}/>)
                    : cars.length===0
                      ? (
                        <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'80px 20px' }}>
                          <Car size={52} color="#374151" style={{ marginBottom:'16px' }}/>
                          <p style={{ color:'#6b7280', fontSize:'18px', fontWeight:'600', marginBottom:'8px' }}>No cars match your filters</p>
                          <p style={{ color:'#4b5563', fontSize:'14px', marginBottom:'24px' }}>Try adjusting your search or browse all available cars.</p>
                          <button onClick={resetAll} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'12px 28px', borderRadius:'50px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Browse All Cars</button>
                        </div>
                      )
                      : cars.map(car=>{
                          const inCompare=isInCompare(car.id), compareFull=compareIds.length>=4&&!inCompare;
                          return (
                            <div key={car.id} style={{ position:'relative' }}>
                              <CarCard car={car} ctaContext={ctaCtx}/>
                              <button
                                onClick={e=>{ e.stopPropagation(); if(compareFull){toast.error('Compare full — remove a car first (max 4)',{duration:2500});return;} inCompare?removeFromCompare(car.id):addToCompare(car.id); }}
                                style={{ position:'absolute', top:'10px', right:'10px', zIndex:10, display:'flex', alignItems:'center', gap:'4px', background: inCompare?'rgba(220,38,38,0.85)':'rgba(0,0,0,0.72)', border:`1px solid ${inCompare?'#dc2626':'rgba(255,255,255,0.2)'}`, borderRadius:'8px', padding:'5px 9px', color:'#fff', fontSize:'11px', fontWeight:'700', cursor:'pointer', backdropFilter:'blur(6px)', fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s' }}
                              >
                                <ArrowLeftRight size={10}/>{inCompare?'Added':'Compare'}
                              </button>
                            </div>
                          );
                        })
                  }
                </div>
              )}
              {!loading && !error && totalPages>1 && (
                <div style={{ padding:'40px 0 20px' }}>
                  <Pagination page={page} totalPages={totalPages} onPage={setPage}/>
                  <p style={{ textAlign:'center', color:'#4b5563', fontSize:'13px', marginTop:'12px' }}>
                    Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,totalCount)} of {totalCount.toLocaleString()} cars
                  </p>
                </div>
              )}
            </div>

            {/* Right filter sidebar — shows on click */}
            {sidebarOpen && (
              <aside className="sr-sidebar" style={{ width:'250px', flexShrink:0, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', padding:'18px', position:'sticky', top:'145px', maxHeight:'calc(100vh - 170px)', overflowY:'auto' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', paddingBottom:'12px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                  <h2 style={{ color:'white', fontSize:'13px', fontWeight:'800', margin:0, display:'flex', alignItems:'center', gap:'6px', fontFamily:"'DM Sans',sans-serif" }}>
                    <SlidersHorizontal size={13} style={{ color:'#dc2626' }}/>
                    Filters
                    {activeChips.length>0 && <span style={{ background:'#dc2626', color:'white', fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'20px' }}>{activeChips.length}</span>}
                  </h2>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    {hasFilters && <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', fontFamily:"'DM Sans',sans-serif" }}><RotateCcw size={10}/> Reset</button>}
                    <button onClick={()=>setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center' }}><X size={14}/></button>
                  </div>
                </div>
                <Filters/>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="sr-fab" style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:30 }}>
        <button onClick={()=>setDrawerOpen(true)} style={{ display:'flex', alignItems:'center', gap:'8px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'white', fontSize:'13px', fontWeight:'700', padding:'13px 24px', borderRadius:'50px', cursor:'pointer', boxShadow:'0 8px 24px rgba(220,38,38,0.4)', fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap' }}>
          <SlidersHorizontal size={14}/>
          Filters {activeChips.length>0&&`(${activeChips.length})`}
        </button>
      </div>

      <Footer/>
    </>
  );
}
