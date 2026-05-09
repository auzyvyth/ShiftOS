import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { X, ChevronLeft, ChevronRight, RotateCcw, Car, Users, Flame, SlidersHorizontal, Menu, Phone, Search, ArrowLeftRight } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import Footer from '@/components/Footer';
import CarCard from '@/components/CarCard';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';

/* ── Constants ─────────────────────────────────────────────────────────────── */
const PER_PAGE = 12;

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
  { label: 'Under RM 30,000', value: '30000' },
  { label: 'Under RM 50,000', value: '50000' },
  { label: 'Under RM 80,000', value: '80000' },
  { label: 'Under RM 120,000', value: '120000' },
  { label: 'Under RM 200,000', value: '200000' },
];
const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

const MILEAGE_OPTIONS = [
  { label: 'Under 20,000 km',  value: '20000' },
  { label: 'Under 50,000 km',  value: '50000' },
  { label: 'Under 80,000 km',  value: '80000' },
  { label: 'Under 150,000 km', value: '150000' },
];
const CONDITION_OPTIONS = [
  { value: 'used',  label: 'Used' },
  { value: 'new',   label: 'New' },
  { value: 'recon', label: 'Recon / Import' },
];

const CAR_FIELDS = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at';
const DEALER_JOIN = 'dealer:profiles!car_listings_dealer_id_fkey(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color)';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function dedupe(arr) {
  const seen = new Set();
  return arr.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function sanitizeBrand(val) {
  return BRANDS.includes(val) ? val : null;
}
function sanitizeBodyType(val) {
  return BODY_TYPES.includes(val) ? val : null;
}
function sanitizeTransmission(val) {
  return TRANSMISSIONS.includes(val) ? val : null;
}
function sanitizeFinancing(val) {
  return FINANCING_TYPES.map(f => f.value).includes(val) ? val : null;
}
function sanitizeState(val) {
  return MY_STATES.includes(val) ? val : null;
}
function sanitizePrice(val) {
  const n = parseInt(val, 10);
  const allowed = [30000, 50000, 80000, 120000, 200000];
  return allowed.includes(n) ? n : null;
}
function sanitizePage(val) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
function sanitizeYear(val) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 1990 && n <= CURRENT_YEAR ? n : null;
}
function sanitizeQ(val) {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/[%_\\]/g, '').slice(0, 60).trim();
}
function sanitizeCondition(val) {
  return CONDITION_OPTIONS.map(c => c.value).includes(val) ? val : null;
}
function sanitizeMileageMax(val) {
  const n = parseInt(val, 10);
  return [20000, 50000, 80000, 150000].includes(n) ? n : null;
}

/* ── Marketplace Header ─────────────────────────────────────────────────────── */
const MarketplaceHeader = () => {
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [conditionOpen, setCondOpen]  = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  return (
    <>
      <style>{`
        .mh-root { position:sticky; top:0; z-index:100; transition:background 0.25s,box-shadow 0.25s; }
        .mh-root.scrolled { background:rgba(12,12,14,0.9)!important; backdrop-filter:blur(16px) saturate(1.4); box-shadow:0 1px 0 rgba(255,255,255,0.06); }
        .mh-nav-link { color:#9ca3af; font-size:14px; font-weight:500; text-decoration:none; padding:6px 2px; position:relative; transition:color 0.15s; font-family:'Outfit',sans-serif; white-space:nowrap; }
        .mh-nav-link::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:#dc2626; transform:scaleX(0); transition:transform 0.2s; transform-origin:left; border-radius:2px; }
        .mh-nav-link:hover { color:#fff; }
        .mh-nav-link:hover::after { transform:scaleX(1); }
        /* Hot Deals — flame accent */
        .mh-hot-link { color:#fb923c!important; }
        .mh-hot-link::after { background:#fb923c!important; }
        .mh-hot-link:hover { color:#fdba74!important; }
        /* Condition dropdown */
        .mh-dropdown { position:relative; }
        .mh-dropdown-trigger { color:#9ca3af; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:5px; font-family:'Outfit',sans-serif; white-space:nowrap; background:none; border:none; padding:6px 2px; position:relative; transition:color 0.15s; }
        .mh-dropdown-trigger::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:#dc2626; transform:scaleX(0); transition:transform 0.2s; transform-origin:left; border-radius:2px; }
        .mh-dropdown:hover .mh-dropdown-trigger, .mh-dropdown-trigger:focus { color:#fff; }
        .mh-dropdown:hover .mh-dropdown-trigger::after { transform:scaleX(1); }
        .mh-dropdown-chevron { transition:transform 0.2s; display:inline-block; }
        .mh-dropdown:hover .mh-dropdown-chevron { transform:rotate(180deg); }
        .mh-dropdown-menu { position:absolute; top:calc(100% + 10px); left:50%; transform:translateX(-50%); min-width:170px; background:rgba(10,14,24,0.98); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:6px; display:none; flex-direction:column; gap:2px; backdrop-filter:blur(20px); box-shadow:0 12px 40px rgba(0,0,0,0.7); z-index:200; }
        .mh-dropdown:hover .mh-dropdown-menu { display:flex; }
        .mh-dropdown-item { color:#9ca3af; font-size:13px; font-weight:500; text-decoration:none; padding:9px 12px; border-radius:8px; font-family:'Outfit',sans-serif; transition:background 0.12s,color 0.12s; white-space:nowrap; }
        .mh-dropdown-item:hover { background:rgba(255,255,255,0.07); color:#fff; }
        /* CTA */
        .mh-cta { display:flex; align-items:center; gap:7px; background:#dc2626; color:#fff; font-size:14px; font-weight:700; padding:9px 18px; border-radius:9px; text-decoration:none; font-family:'Outfit',sans-serif; transition:background 0.15s,transform 0.15s; white-space:nowrap; }
        .mh-cta:hover { background:#b91c1c; transform:translateY(-1px); }
        /* Hamburger */
        .mh-hamburger { display:none; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; padding:8px; cursor:pointer; align-items:center; justify-content:center; transition:background 0.15s; }
        .mh-hamburger:hover { background:rgba(255,255,255,0.1); }
        /* Mobile drawer */
        .mh-mobile-nav { display:none; flex-direction:column; gap:2px; padding:12px 20px 16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(12,12,14,0.97); backdrop-filter:blur(16px); }
        .mh-mobile-link { color:#9ca3af; font-size:15px; font-weight:500; text-decoration:none; padding:11px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-family:'Outfit',sans-serif; transition:color 0.15s; display:block; }
        .mh-mobile-link:hover { color:#fff; }
        .mh-mobile-sub { padding:6px 0 6px 16px; display:flex; flex-direction:column; gap:0; border-bottom:1px solid rgba(255,255,255,0.05); }
        .mh-mobile-sub-item { color:#6b7280; font-size:13px; font-weight:500; text-decoration:none; padding:8px 0; font-family:'Outfit',sans-serif; transition:color 0.12s; }
        .mh-mobile-sub-item:hover { color:#fff; }
        .mh-mobile-cta { margin-top:10px; display:flex; align-items:center; justify-content:center; gap:7px; background:#dc2626; color:#fff; font-size:15px; font-weight:700; padding:13px; border-radius:10px; text-decoration:none; font-family:'Outfit',sans-serif; }
        @media (max-width:720px) {
          .mh-desktop-nav { display:none!important; }
          .mh-hamburger { display:flex!important; }
          .mh-mobile-nav.open { display:flex!important; }
        }
      `}</style>

      <header className={`mh-root${scrolled ? ' scrolled' : ''}`} style={{ background:'transparent', borderBottom:'1px solid transparent' }} ref={menuRef}>
        <div style={{ maxWidth:'1360px', margin:'0 auto', padding:'0 20px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'24px' }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'2px', flexShrink:0 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'0.04em', lineHeight:1 }}>
              <span style={{ color:'#dc2626' }}>X</span><span style={{ color:'#ffffff' }}>DRIVE</span>
            </span>
            <span style={{ fontSize:'9px', fontWeight:'700', color:'#6b7280', letterSpacing:'0.1em', marginLeft:'4px', marginTop:'2px', fontFamily:"'Outfit',sans-serif" }}>.MY</span>
          </Link>

          {/* Desktop nav */}
          <nav className="mh-desktop-nav" style={{ display:'flex', alignItems:'center', gap:'28px', flex:1, justifyContent:'center' }}>
            <a href="/marketplace" className="mh-nav-link">Browse Cars</a>
            <a href="/marketplace?hot_deals=true" className="mh-nav-link mh-hot-link" style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <Flame size={13} /> Hot Deals
            </a>
            {/* Condition dropdown */}
            <div className="mh-dropdown">
              <button className="mh-dropdown-trigger" aria-haspopup="true">
                Condition <span className="mh-dropdown-chevron">▾</span>
              </button>
              <div className="mh-dropdown-menu" role="menu">
                <a href="/marketplace?condition=used"  className="mh-dropdown-item">🚗 Used Cars</a>
                <a href="/marketplace?condition=new"   className="mh-dropdown-item">✨ New Cars</a>
                <a href="/marketplace?condition=recon" className="mh-dropdown-item">🔁 Recon / Import</a>
              </div>
            </div>
          </nav>

          {/* Right */}
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
            <a href="tel:+60174155191" className="mh-desktop-nav" style={{ display:'flex', alignItems:'center', gap:'6px', color:'#6b7280', fontSize:'13px', fontWeight:'500', textDecoration:'none', fontFamily:"'Outfit',sans-serif" }}>
              <Phone size={13} /> +60 17-415 5191
            </a>
            <a href="/login" className="mh-cta">List Your Car</a>
            <button className="mh-hamburger" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div className={`mh-mobile-nav${menuOpen ? ' open' : ''}`}>
          <a href="/marketplace" className="mh-mobile-link" onClick={() => setMenuOpen(false)}>Browse Cars</a>
          <a href="/marketplace?hot_deals=true" className="mh-mobile-link" style={{ color:'#fb923c' }} onClick={() => setMenuOpen(false)}>🔥 Hot Deals</a>
          <button
            className="mh-mobile-link"
            style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'11px 0', color:'#9ca3af', fontSize:'15px', fontWeight:'500', fontFamily:"'Outfit',sans-serif" }}
            onClick={() => setCondOpen(o => !o)}
          >
            Condition <span style={{ fontSize:12 }}>{conditionOpen ? '▲' : '▼'}</span>
          </button>
          {conditionOpen && (
            <div className="mh-mobile-sub">
              {[['used','🚗 Used Cars'],['new','✨ New Cars'],['recon','🔁 Recon / Import']].map(([v,l]) => (
                <a key={v} href={`/marketplace?condition=${v}`} className="mh-mobile-sub-item" onClick={() => setMenuOpen(false)}>{l}</a>
              ))}
            </div>
          )}
          <a href="tel:+60174155191" className="mh-mobile-link" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Phone size={14} /> +60 17-415 5191
          </a>
          <a href="/login" className="mh-mobile-cta" onClick={() => setMenuOpen(false)}>List Your Car</a>
        </div>
      </header>
    </>
  );
};

/* ── Skeleton Card ──────────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div style={{
    background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    overflow: 'hidden',
  }}>
    <div style={{
      height: '200px',
      background: 'linear-gradient(90deg,#111827 25%,#1a2332 50%,#111827 75%)',
      backgroundSize: '200% 100%',
      animation: 'mp-shimmer 1.5s infinite',
    }} />
    <div style={{ padding: '16px' }}>
      {[80,55,95,70].map((w, i) => (
        <div key={i} style={{
          height: '12px',
          width: `${w}%`,
          background: '#1a2332',
          borderRadius: '6px',
          marginBottom: '10px',
          animation: 'mp-shimmer 1.5s infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  </div>
);

/* ── Stat Item ──────────────────────────────────────────────────────────────── */
const StatItem = ({ icon: Icon, value, label, color }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '20px 28px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    flex: '1',
    minWidth: '160px',
  }}>
    <div style={{
      width: '44px',
      height: '44px',
      borderRadius: '12px',
      background: color || 'rgba(220,38,38,0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={20} color={color ? '#fff' : '#dc2626'} />
    </div>
    <div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
    </div>
  </div>
);

/* ── Pagination ─────────────────────────────────────────────────────────────── */
const Pagination = ({ page, totalPages, onPage }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (page <= 4) {
    pages.push(1,2,3,4,5,'…',totalPages);
  } else if (page >= totalPages - 3) {
    pages.push(1,'…',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
  } else {
    pages.push(1,'…',page-1,page,page+1,'…',totalPages);
  }

  const btnBase = {
    minWidth: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: "'Outfit', sans-serif",
    padding: '0 10px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        style={{
          ...btnBase,
          opacity: page === 1 ? 0.35 : 1,
          cursor: page === 1 ? 'not-allowed' : 'pointer',
          gap: '6px',
          padding: '0 16px',
          fontSize: '14px',
        }}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} /> Previous
      </button>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} style={{ color: '#4b5563', padding: '0 4px', fontSize: '15px' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            style={{
              ...btnBase,
              background: p === page ? '#dc2626' : 'transparent',
              borderColor: p === page ? '#dc2626' : 'rgba(255,255,255,0.1)',
              color: p === page ? '#fff' : '#9ca3af',
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        style={{
          ...btnBase,
          opacity: page === totalPages ? 0.35 : 1,
          cursor: page === totalPages ? 'not-allowed' : 'pointer',
          gap: '6px',
          padding: '0 16px',
          fontSize: '14px',
        }}
        aria-label="Next page"
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
};

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ctaCtx = useCTAContext();
  const { addToCompare, removeFromCompare, isInCompare, compareIds } = useCompare();

  /* Filters from URL */
  const brand        = sanitizeBrand(searchParams.get('brand') || '');
  const bodyType     = sanitizeBodyType(searchParams.get('body_type') || '');
  const transmission = sanitizeTransmission(searchParams.get('transmission') || '');
  const state        = sanitizeState(searchParams.get('state') || '');
  const maxPrice     = sanitizePrice(searchParams.get('max_price') || '');
  const financing    = sanitizeFinancing(searchParams.get('financing') || '');
  const yearFrom     = sanitizeYear(searchParams.get('year_from') || '');
  const yearTo       = sanitizeYear(searchParams.get('year_to') || '');
  const q            = sanitizeQ(searchParams.get('q') || '');
  const condition    = sanitizeCondition(searchParams.get('condition') || '');
  const mileageMax   = sanitizeMileageMax(searchParams.get('mileage_max') || '');
  const hotDeals     = searchParams.get('hot_deals') === 'true';
  const sort         = ['newest','price_asc','price_desc'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
  const page         = sanitizePage(searchParams.get('page') || '1');

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => { setSearchInput(q); }, [q]);

  /* Data state */
  const [cars, setCars]           = useState([]);
  const [totalCount, setTotal]    = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Stats (fetched once) */
  const [stats, setStats] = useState({ listings: null, dealers: null, hotDeals: null });

  /* ── Analytics: fire store_visit once per session ── */
  useEffect(() => {
    const key = 'sv_fired_main';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackEvent(supabase, 'store_visit', { dealer_id: null, metadata: { source: 'organic' } });
  }, []);

  /* ── Fetch marketplace stats ── */
  useEffect(() => {
    async function fetchStats() {
      const [listingsRes, dealersRes, hotRes] = await Promise.all([
        supabase.from('car_listings').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('car_listings').select('dealer_id', { count: 'exact', head: false }).eq('status', 'available').limit(2000),
        supabase.from('car_listings').select('*', { count: 'exact', head: true })
          .eq('status', 'available')
          .not('original_price', 'is', null)
          .gt('original_price', 0),
      ]);
      const uniqueDealers = new Set((dealersRes.data || []).map(r => r.dealer_id)).size;
      setStats({
        listings: listingsRes.count ?? 0,
        dealers: uniqueDealers,
        hotDeals: hotRes.count ?? 0,
      });
    }
    fetchStats();
  }, []);

  /* ── Fetch cars (server-side, paginated) ── */
  const fetchCars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = (page - 1) * PER_PAGE;
      const to   = from + PER_PAGE - 1;

      let query = supabase
        .from('car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, { count: 'exact' })
        .eq('status', 'available');

      if (q)            query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%,variant.ilike.%${q}%`);
      if (brand)        query = query.eq('brand', brand);
      if (bodyType)     query = query.eq('body_type', bodyType);
      if (state)        query = query.eq('state', state);
      if (maxPrice)     query = query.lte('selling_price', maxPrice);
      if (financing)    query = query.eq('financing_type', financing);
      if (yearFrom)     query = query.gte('year', yearFrom);
      if (yearTo)       query = query.lte('year', yearTo);
      if (mileageMax)   query = query.lte('mileage', mileageMax);
      if (hotDeals)     query = query.not('original_price', 'is', null).gt('original_price', 0);
      if (condition === 'recon') query = query.eq('is_recon', true);
      else if (condition === 'new')  query = query.eq('condition', 'new');
      else if (condition === 'used') query = query.eq('is_recon', false);
      if (transmission) {
        const txVal = transmission === 'Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT'];
        query = query.in('transmission', txVal);
      }

      if (sort === 'price_asc')  query = query.order('selling_price', { ascending: true });
      else if (sort === 'price_desc') query = query.order('selling_price', { ascending: false });
      else                        query = query.order('created_at',    { ascending: false });

      query = query.range(from, to);

      const { data, error: err, count } = await query;
      if (err) throw err;

      setCars(dedupe(data || []));
      setTotal(count || 0);
    } catch (e) {
      setError('Failed to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, brand, bodyType, state, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, sort]);

  useEffect(() => {
    fetchCars();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchCars]);

  /* ── Filter helpers ── */
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // reset to page 1 on filter change
    setSearchParams(next, { replace: true });
  };

  const setPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next, { replace: true });
  };

  const resetAll = () => { setSearchInput(''); setSearchParams({}, { replace: true }); };

  const hasFilters = brand || bodyType || transmission || state || maxPrice || financing || yearFrom || yearTo || q || condition || mileageMax || hotDeals;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  /* ── Active filter chips ── */
  const activeChips = [
    q            && { key: 'q',            label: `"${q}"` },
    brand        && { key: 'brand',        label: brand },
    bodyType     && { key: 'body_type',    label: bodyType },
    transmission && { key: 'transmission', label: transmission },
    state        && { key: 'state',        label: state },
    maxPrice     && { key: 'max_price',    label: PRICE_OPTIONS.find(p => p.value === String(maxPrice))?.label || '' },
    financing    && { key: 'financing',    label: FINANCING_TYPES.find(f => f.value === financing)?.label || '' },
    yearFrom     && { key: 'year_from',    label: `From ${yearFrom}` },
    yearTo       && { key: 'year_to',      label: `To ${yearTo}` },
    condition    && { key: 'condition',    label: CONDITION_OPTIONS.find(c => c.value === condition)?.label || condition },
    mileageMax   && { key: 'mileage_max', label: MILEAGE_OPTIONS.find(m => m.value === String(mileageMax))?.label || '' },
    hotDeals     && { key: 'hot_deals',   label: '🔥 Hot Deals' },
  ].filter(Boolean);

  /* ── Styles ── */
  const S = {
    page: {
      minHeight: '100vh',
      background: '#0C0C0E',
      fontFamily: "'Outfit', sans-serif",
    },
    hero: {
      background: 'linear-gradient(160deg, #0c0c0e 0%, #110810 40%, #0c0c0e 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      padding: '72px 20px 48px',
      position: 'relative',
      overflow: 'hidden',
    },
    heroInner: {
      maxWidth: '860px',
      margin: '0 auto',
      textAlign: 'center',
      position: 'relative',
      zIndex: 1,
    },
    eyebrow: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(220,38,38,0.1)',
      border: '1px solid rgba(220,38,38,0.25)',
      color: '#f87171',
      fontSize: '13px',
      fontWeight: '600',
      padding: '6px 14px',
      borderRadius: '20px',
      marginBottom: '20px',
      letterSpacing: '0.04em',
    },
    headline: {
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: 'clamp(48px, 8vw, 80px)',
      color: '#ffffff',
      lineHeight: '0.95',
      letterSpacing: '0.02em',
      margin: '0 0 18px',
    },
    headlineAccent: {
      color: '#dc2626',
    },
    subtitle: {
      fontSize: '17px',
      color: '#9ca3af',
      maxWidth: '560px',
      margin: '0 auto 40px',
      lineHeight: '1.6',
    },
    statsRow: {
      display: 'flex',
      gap: '12px',
      maxWidth: '680px',
      margin: '0 auto',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    wrap: {
      maxWidth: '1360px',
      margin: '0 auto',
      padding: '0 20px',
    },
    brandRow: {
      padding: '24px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    brandScroll: {
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      paddingBottom: '4px',
      scrollbarWidth: 'none',
    },
    brandPill: (active) => ({
      flexShrink: 0,
      padding: '10px 18px',
      borderRadius: '50px',
      border: `1px solid ${active ? '#dc2626' : 'rgba(255,255,255,0.1)'}`,
      background: active ? '#dc2626' : 'transparent',
      color: active ? '#fff' : '#9ca3af',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
      fontFamily: "'Outfit', sans-serif",
    }),
    filtersSection: {
      padding: '20px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    filterToggleBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: '#fff',
      fontSize: '15px',
      fontWeight: '600',
      padding: '11px 20px',
      borderRadius: '10px',
      cursor: 'pointer',
      fontFamily: "'Outfit', sans-serif",
    },
    filterGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginTop: '16px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '600',
      color: '#9ca3af',
      marginBottom: '8px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    },
    select: {
      width: '100%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '12px 16px',
      color: '#fff',
      fontSize: '15px',
      appearance: 'none',
      cursor: 'pointer',
      outline: 'none',
      fontFamily: "'Outfit', sans-serif",
    },
    pillGroup: {
      display: 'flex',
      gap: '6px',
      flexWrap: 'wrap',
    },
    pill: (active) => ({
      padding: '10px 16px',
      borderRadius: '50px',
      border: `1px solid ${active ? '#dc2626' : 'rgba(255,255,255,0.1)'}`,
      background: active ? 'rgba(220,38,38,0.15)' : 'transparent',
      color: active ? '#f87171' : '#9ca3af',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.15s',
      fontFamily: "'Outfit', sans-serif",
    }),
    chipsRow: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: '14px 0 0',
    },
    chip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(220,38,38,0.1)',
      border: '1px solid rgba(220,38,38,0.25)',
      color: '#f87171',
      fontSize: '13px',
      fontWeight: '600',
      padding: '6px 12px',
      borderRadius: '20px',
    },
    chipX: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#f87171',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
    },
    resultsHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '24px 0 20px',
    },
    resultsCount: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#fff',
    },
    carsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '20px',
      paddingBottom: '40px',
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      gridColumn: '1 / -1',
    },
    paginationWrap: {
      padding: '12px 0 60px',
    },
    resetBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'transparent',
      border: '1px solid rgba(255,255,255,0.1)',
      color: '#9ca3af',
      fontSize: '14px',
      fontWeight: '600',
      padding: '10px 16px',
      borderRadius: '10px',
      cursor: 'pointer',
      fontFamily: "'Outfit', sans-serif",
    },
  };

  return (
    <>
      <Helmet>
        <title>XDrive — Malaysia's Used Car Marketplace</title>
        <meta name="description" content="Browse thousands of verified used cars from trusted dealers across Malaysia. Find the best deals on Perodua, Proton, Honda, Toyota and more." />
        <link rel="canonical" href={`https://xdrive.my/marketplace${hotDeals ? '?hot_deals=true' : condition ? `?condition=${condition}` : ''}`} />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://xdrive.my/marketplace" />
        <meta property="og:locale"      content="en_MY" />
        <meta property="og:site_name"   content="XDrive" />
        <meta property="og:title"       content="XDrive — Malaysia's Used Car Marketplace" />
        <meta property="og:description" content="Browse thousands of verified used cars from trusted dealers across Malaysia." />
        <meta property="og:image"       content="https://xdrive.my/og-marketplace.jpg" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="XDrive — Malaysia's Used Car Marketplace" />
        <meta name="twitter:description" content="Browse thousands of verified used cars from trusted dealers across Malaysia." />
        <meta name="twitter:image"       content="https://xdrive.my/og-marketplace.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "XDrive Marketplace",
          "description": "Browse thousands of verified used cars from trusted dealers across Malaysia.",
          "url": "https://xdrive.my/marketplace",
          "publisher": { "@type": "Organization", "name": "XDrive", "url": "https://xdrive.my" },
        })}</script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        @keyframes mp-shimmer {
          0%   { background-position: -200% 0 }
          100% { background-position:  200% 0 }
        }
        .mp-brand-scroll::-webkit-scrollbar { display: none }
        .mp-brand-pill:hover { opacity: 0.85; transform: translateY(-1px) }
        .mp-reset-btn:hover  { color: #fff !important; border-color: rgba(255,255,255,0.25) !important }
        .mp-chip-x:hover     { opacity: 0.7 }
        .mp-select:focus     { border-color: rgba(220,38,38,0.5) !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12) }
        .mp-filter-toggle:hover { background: rgba(255,255,255,0.07) !important }
        .mp-next-prev:hover:not(:disabled) { background: rgba(255,255,255,0.06) !important; color: #fff !important }
        .mp-page-btn:hover { background: rgba(255,255,255,0.05) !important }
        .mp-hero-glow {
          position: absolute;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%);
          top: -200px; left: 50%; transform: translateX(-50%);
          pointer-events: none;
        }
      `}</style>

      <MarketplaceHeader />

      <div style={S.page}>
        {/* ── Hero ── */}
        <section style={S.hero}>
          <div className="mp-hero-glow" />
          <div style={S.heroInner}>
            <div style={S.eyebrow}>
              <Flame size={13} /> Malaysia's #1 Used Car Marketplace
            </div>
            <h1 style={S.headline}>
              Find Your<br />
              <span style={S.headlineAccent}>Perfect Car</span>
            </h1>
            <p style={S.subtitle}>
              Browse thousands of verified used cars from trusted dealers across Malaysia.
            </p>

            {/* ── Search bar ── */}
            <form
              onSubmit={e => { e.preventDefault(); setParam('q', searchInput); }}
              style={{ position: 'relative', maxWidth: '540px', margin: '0 auto 36px' }}
            >
              <Search size={18} style={{
                position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)',
                color: '#6b7280', pointerEvents: 'none',
              }} />
              <input
                type="search"
                placeholder="Search brand, model, or variant…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  padding: '16px 54px 16px 50px',
                  color: '#fff',
                  fontSize: '16px',
                  fontFamily: "'Outfit', sans-serif",
                  outline: 'none',
                  boxSizing: 'border-box',
                  backdropFilter: 'blur(8px)',
                }}
                onKeyDown={e => e.key === 'Enter' && setParam('q', sanitizeQ(searchInput))}
              />
              <button
                type="submit"
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '10px 18px',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Search
              </button>
            </form>

            <div style={S.statsRow}>
              <StatItem
                icon={Car}
                value={stats.listings !== null ? `${stats.listings.toLocaleString()}+` : '—'}
                label="Cars Listed"
              />
              <StatItem
                icon={Users}
                value={stats.dealers !== null ? `${stats.dealers}` : '—'}
                label="Trusted Dealers"
              />
              <StatItem
                icon={Flame}
                value={stats.hotDeals !== null ? `${stats.hotDeals}+` : '—'}
                label="Hot Deals"
                color="rgba(251,146,60,0.15)"
              />
            </div>
          </div>
        </section>

        <div style={S.wrap}>
          {/* ── Brand Quick-Filter Pills ── */}
          <div style={S.brandRow}>
            <div className="mp-brand-scroll" style={S.brandScroll}>
              {BRANDS.map(b => (
                <button
                  key={b}
                  className="mp-brand-pill"
                  style={S.brandPill(brand === b)}
                  onClick={() => setParam('brand', brand === b ? '' : b)}
                  aria-pressed={brand === b}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* ── Filters ── */}
          <div style={S.filtersSection}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="mp-filter-toggle"
                style={S.filterToggleBtn}
                onClick={() => setFiltersOpen(o => !o)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={16} />
                {filtersOpen ? 'Hide Filters' : 'Show Filters'}
              </button>

              {hasFilters && (
                <button className="mp-reset-btn" style={S.resetBtn} onClick={resetAll}>
                  <RotateCcw size={14} /> Reset All Filters
                </button>
              )}
            </div>

            {filtersOpen && (
              <div style={S.filterGrid}>
                {/* Brand */}
                <div>
                  <label style={S.label} htmlFor="filter-brand">Brand</label>
                  <select
                    id="filter-brand"
                    className="mp-select"
                    style={S.select}
                    value={brand || ''}
                    onChange={e => setParam('brand', e.target.value)}
                  >
                    <option value="">All Brands</option>
                    {BRANDS.map(b => <option key={b} value={b} style={{ background: '#0d1117' }}>{b}</option>)}
                  </select>
                </div>

                {/* Max Price */}
                <div>
                  <label style={S.label} htmlFor="filter-price">Budget</label>
                  <select
                    id="filter-price"
                    className="mp-select"
                    style={S.select}
                    value={maxPrice || ''}
                    onChange={e => setParam('max_price', e.target.value)}
                  >
                    <option value="">Any Budget</option>
                    {PRICE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0d1117' }}>{o.label}</option>)}
                  </select>
                </div>

                {/* State */}
                <div>
                  <label style={S.label} htmlFor="filter-state">Location</label>
                  <select
                    id="filter-state"
                    className="mp-select"
                    style={S.select}
                    value={state || ''}
                    onChange={e => setParam('state', e.target.value)}
                  >
                    <option value="">All States</option>
                    {MY_STATES.map(s => <option key={s} value={s} style={{ background: '#0d1117' }}>{s}</option>)}
                  </select>
                </div>

                {/* Year Range */}
                <div>
                  <span style={S.label}>Year</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="mp-select"
                      style={{ ...S.select, flex: 1 }}
                      value={yearFrom || ''}
                      onChange={e => setParam('year_from', e.target.value)}
                    >
                      <option value="">From</option>
                      {YEARS.map(y => <option key={y} value={y} style={{ background: '#0d1117' }}>{y}</option>)}
                    </select>
                    <select
                      className="mp-select"
                      style={{ ...S.select, flex: 1 }}
                      value={yearTo || ''}
                      onChange={e => setParam('year_to', e.target.value)}
                    >
                      <option value="">To</option>
                      {YEARS.map(y => <option key={y} value={y} style={{ background: '#0d1117' }}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Body Type */}
                <div>
                  <span style={S.label}>Body Type</span>
                  <div style={S.pillGroup}>
                    {BODY_TYPES.map(bt => (
                      <button
                        key={bt}
                        style={S.pill(bodyType === bt)}
                        onClick={() => setParam('body_type', bodyType === bt ? '' : bt)}
                        aria-pressed={bodyType === bt}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transmission */}
                <div>
                  <span style={S.label}>Transmission</span>
                  <div style={S.pillGroup}>
                    {TRANSMISSIONS.map(tx => (
                      <button
                        key={tx}
                        style={S.pill(transmission === tx)}
                        onClick={() => setParam('transmission', transmission === tx ? '' : tx)}
                        aria-pressed={transmission === tx}
                      >
                        {tx}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <span style={S.label}>Condition</span>
                  <div style={S.pillGroup}>
                    {CONDITION_OPTIONS.map(co => (
                      <button
                        key={co.value}
                        style={S.pill(condition === co.value)}
                        onClick={() => setParam('condition', condition === co.value ? '' : co.value)}
                        aria-pressed={condition === co.value}
                      >
                        {co.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mileage */}
                <div>
                  <label style={S.label} htmlFor="filter-mileage">Max Mileage</label>
                  <select
                    id="filter-mileage"
                    className="mp-select"
                    style={S.select}
                    value={mileageMax || ''}
                    onChange={e => setParam('mileage_max', e.target.value)}
                  >
                    <option value="">Any Mileage</option>
                    {MILEAGE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0d1117' }}>{o.label}</option>)}
                  </select>
                </div>

                {/* Payment Type */}
                <div>
                  <span style={S.label}>Payment Type</span>
                  <div style={S.pillGroup}>
                    {FINANCING_TYPES.map(ft => (
                      <button
                        key={ft.value}
                        style={S.pill(financing === ft.value)}
                        onClick={() => setParam('financing', financing === ft.value ? '' : ft.value)}
                        aria-pressed={financing === ft.value}
                      >
                        {ft.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hot Deals toggle */}
                <div>
                  <span style={S.label}>Deals</span>
                  <button
                    style={{
                      ...S.pill(hotDeals),
                      display: 'flex', alignItems: 'center', gap: '6px',
                      ...(hotDeals ? { background: 'rgba(251,146,60,0.15)', borderColor: '#fb923c', color: '#fb923c' } : {}),
                    }}
                    onClick={() => setParam('hot_deals', hotDeals ? '' : 'true')}
                    aria-pressed={hotDeals}
                  >
                    <Flame size={13} /> Hot Deals Only
                  </button>
                </div>
              </div>
            )}

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div style={S.chipsRow}>
                <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '4px' }}>Active:</span>
                {activeChips.map(chip => (
                  <span key={chip.key} style={S.chip}>
                    {chip.label}
                    <button
                      className="mp-chip-x"
                      style={S.chipX}
                      onClick={() => chip.key === 'hot_deals' ? setParam('hot_deals', '') : setParam(chip.key, '')}
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Results Header ── */}
          <div style={S.resultsHeader}>
            <div style={S.resultsCount}>
              {loading
                ? 'Loading...'
                : `${totalCount.toLocaleString()} car${totalCount !== 1 ? 's' : ''} found`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="sort-select" style={{ fontSize: '14px', color: '#6b7280', whiteSpace: 'nowrap' }}>Sort by</label>
              <select
                id="sort-select"
                className="mp-select"
                style={{ ...S.select, width: 'auto', fontSize: '14px', padding: '9px 14px' }}
                value={sort}
                onChange={e => setParam('sort', e.target.value)}
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0d1117' }}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: '#f87171', fontSize: '17px', marginBottom: '20px' }}>{error}</p>
              <button
                onClick={fetchCars}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none',
                  padding: '14px 28px', borderRadius: '10px',
                  fontSize: '16px', fontWeight: '700', cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── Cars Grid ── */}
          {!error && (
            <div style={S.carsGrid}>
              {loading
                ? Array.from({ length: PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)
                : cars.length === 0
                  ? (
                    <div style={S.emptyState}>
                      <Car size={56} color="#374151" style={{ marginBottom: '20px' }} />
                      <p style={{ color: '#6b7280', fontSize: '19px', fontWeight: '600', marginBottom: '12px' }}>
                        No cars match your filters
                      </p>
                      <p style={{ color: '#4b5563', fontSize: '16px', marginBottom: '28px' }}>
                        Try adjusting your search or browse all available cars.
                      </p>
                      <button
                        onClick={resetAll}
                        style={{
                          background: '#dc2626', color: '#fff', border: 'none',
                          padding: '14px 32px', borderRadius: '10px',
                          fontSize: '16px', fontWeight: '700', cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        Browse All Cars
                      </button>
                    </div>
                  )
                  : cars.map(car => {
                    const inCompare = isInCompare(car.id);
                    const compareFull = compareIds.length >= 4 && !inCompare;
                    return (
                      <div key={car.id} style={{ position: 'relative' }}>
                        <CarCard car={car} ctaContext={ctaCtx} />
                        <button
                          onClick={() => inCompare ? removeFromCompare(car.id) : addToCompare(car.id)}
                          disabled={compareFull}
                          title={compareFull ? 'Compare full (max 4)' : inCompare ? 'Remove from compare' : 'Add to compare'}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: inCompare ? 'rgba(220,38,38,0.85)' : 'rgba(0,0,0,0.65)',
                            border: `1px solid ${inCompare ? '#dc2626' : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: '8px',
                            padding: '6px 10px',
                            color: inCompare ? '#fff' : 'rgba(255,255,255,0.7)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: compareFull ? 'not-allowed' : 'pointer',
                            opacity: compareFull ? 0.4 : 1,
                            backdropFilter: 'blur(8px)',
                            fontFamily: "'Outfit', sans-serif",
                            letterSpacing: '0.02em',
                            transition: 'all 0.15s',
                          }}
                        >
                          <ArrowLeftRight size={11} />
                          {inCompare ? 'Added' : 'Compare'}
                        </button>
                      </div>
                    );
                  })
              }
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && !error && totalPages > 1 && (
            <div style={S.paginationWrap}>
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '14px', marginTop: '16px' }}>
                Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, totalCount)} of {totalCount.toLocaleString()} cars
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
