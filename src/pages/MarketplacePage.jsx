import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet';
import { X, ChevronLeft, ChevronRight, RotateCcw, Car, Users, Flame, SlidersHorizontal, Search, ArrowLeftRight } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import Footer from '@/components/Footer';
import CarCard from '@/components/CarCard';
import MarketplaceHeader from '../components/MarketplaceHeader';
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
const DEALER_JOIN = 'dealer:profiles!car_listings_dealer_id_fkey(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color,role)';

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

/* MarketplaceHeader imported from ../components/MarketplaceHeader */

/* ── Skeleton Card ──────────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div style={{
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    <div style={{
      height: '200px',
      background: 'linear-gradient(90deg,#e8e6e0 25%,#f0eeea 50%,#e8e6e0 75%)',
      backgroundSize: '200% 100%',
      animation: 'mp-shimmer 1.5s infinite',
    }} />
    <div style={{ padding: '16px' }}>
      {[80,55,95,70].map((w, i) => (
        <div key={i} style={{
          height: '12px',
          width: `${w}%`,
          background: '#e8e6e0',
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
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '14px',
    flex: '1',
    minWidth: '160px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
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
      <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827', lineHeight: 1.1 }}>{value}</div>
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
    border: '1px solid rgba(0,0,0,0.1)',
    background: 'transparent',
    color: '#6b7280',
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
  const navigate = useNavigate();
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

  const [heroQ,      setHeroQ]      = useState('');
  const [heroBudget, setHeroBudget] = useState('');

  /* Data state */
  const [cars, setCars]           = useState([]);
  const [totalCount, setTotal]    = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = filtersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [filtersOpen]);

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
      if (hotDeals)   query = query.not('original_price', 'is', null).gt('original_price', 0);
      if (condition)  query = query.eq('condition', condition);
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
      background: '#F7F6F2',
      fontFamily: "'Outfit', sans-serif",
    },
    hero: {
      background: 'linear-gradient(160deg, #F2F0EC 0%, #EDE9E3 40%, #F2F0EC 100%)',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
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
      color: '#111827',
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
      borderBottom: '1px solid rgba(0,0,0,0.06)',
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
      border: `1px solid ${active ? '#dc2626' : 'rgba(0,0,0,0.1)'}`,
      background: active ? '#dc2626' : 'transparent',
      color: active ? '#fff' : '#6b7280',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
      fontFamily: "'Outfit', sans-serif",
    }),
    filtersSection: {
      padding: '20px 0',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    },
    filterToggleBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.1)',
      color: '#111827',
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
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '10px',
      padding: '12px 16px',
      color: '#111827',
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
      border: `1px solid ${active ? '#dc2626' : 'rgba(0,0,0,0.1)'}`,
      background: active ? 'rgba(220,38,38,0.08)' : '#ffffff',
      color: active ? '#dc2626' : '#6b7280',
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
      color: '#111827',
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
      border: '1px solid rgba(0,0,0,0.1)',
      color: '#6b7280',
      fontSize: '14px',
      fontWeight: '600',
      padding: '10px 16px',
      borderRadius: '10px',
      cursor: 'pointer',
      fontFamily: "'Outfit', sans-serif",
    },
  };

  const FilterGroup = ({ title, children }) => (
    <div style={{ marginBottom:'16px', paddingBottom:'16px', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
      <p style={{ fontSize:'11px', fontWeight:'700', color:'#6b7280', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 10px', fontFamily:"'Outfit',sans-serif" }}>{title}</p>
      {children}
    </div>
  );

  const renderFilters = () => (
    <div style={{ fontFamily:"'Outfit',sans-serif" }}>
      <FilterGroup title="Hot Deals">
        <button
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background: hotDeals ? 'rgba(251,146,60,0.1)' : '#ffffff', border: hotDeals ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(0,0,0,0.08)', borderRadius:'10px', padding:'10px 14px', cursor:'pointer', color: hotDeals ? '#fb923c' : '#6b7280', fontSize:'13px', fontWeight:'700', fontFamily:"'Outfit',sans-serif", transition:'all 0.15s ease' }}
          onClick={() => setParam('hot_deals', hotDeals ? '' : 'true')}
          aria-pressed={hotDeals}
        >
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}><Flame size={13}/> Hot Deals Only</span>
          {hotDeals && <span style={{ fontSize:12 }}>✓</span>}
        </button>
      </FilterGroup>

      <FilterGroup title="Brand">
        <select className="mp-select" style={S.select} value={brand || ''} onChange={e => setParam('brand', e.target.value)}>
          <option value="">All Brands</option>
          {BRANDS.map(b => <option key={b} value={b} style={{ background:'#fff' }}>{b}</option>)}
        </select>
      </FilterGroup>

      <FilterGroup title="Budget">
        <select className="mp-select" style={S.select} value={maxPrice || ''} onChange={e => setParam('max_price', e.target.value)}>
          <option value="">Any Budget</option>
          {PRICE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background:'#fff' }}>{o.label}</option>)}
        </select>
      </FilterGroup>

      <FilterGroup title="Location">
        <select className="mp-select" style={S.select} value={state || ''} onChange={e => setParam('state', e.target.value)}>
          <option value="">All States</option>
          {MY_STATES.map(s => <option key={s} value={s} style={{ background:'#fff' }}>{s}</option>)}
        </select>
      </FilterGroup>

      <FilterGroup title="Year">
        <div style={{ display:'flex', gap:'8px' }}>
          <select className="mp-select" style={{ ...S.select, flex:1 }} value={yearFrom || ''} onChange={e => setParam('year_from', e.target.value)}>
            <option value="">From</option>
            {YEARS.map(y => <option key={y} value={y} style={{ background:'#fff' }}>{y}</option>)}
          </select>
          <select className="mp-select" style={{ ...S.select, flex:1 }} value={yearTo || ''} onChange={e => setParam('year_to', e.target.value)}>
            <option value="">To</option>
            {YEARS.map(y => <option key={y} value={y} style={{ background:'#fff' }}>{y}</option>)}
          </select>
        </div>
      </FilterGroup>

      <FilterGroup title="Body Type">
        <div style={S.pillGroup}>
          {BODY_TYPES.map(bt => (
            <button key={bt} style={S.pill(bodyType === bt)} onClick={() => setParam('body_type', bodyType === bt ? '' : bt)} aria-pressed={bodyType === bt}>{bt}</button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Transmission">
        <div style={S.pillGroup}>
          {TRANSMISSIONS.map(tx => (
            <button key={tx} style={S.pill(transmission === tx)} onClick={() => setParam('transmission', transmission === tx ? '' : tx)} aria-pressed={transmission === tx}>{tx}</button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Condition">
        <div style={S.pillGroup}>
          {CONDITION_OPTIONS.map(co => (
            <button key={co.value} style={S.pill(condition === co.value)} onClick={() => setParam('condition', condition === co.value ? '' : co.value)} aria-pressed={condition === co.value}>{co.label}</button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Max Mileage">
        <select className="mp-select" style={S.select} value={mileageMax || ''} onChange={e => setParam('mileage_max', e.target.value)}>
          <option value="">Any Mileage</option>
          {MILEAGE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background:'#fff' }}>{o.label}</option>)}
        </select>
      </FilterGroup>

      <FilterGroup title="Payment Type">
        <div style={S.pillGroup}>
          {FINANCING_TYPES.map(ft => (
            <button key={ft.value} style={S.pill(financing === ft.value)} onClick={() => setParam('financing', financing === ft.value ? '' : ft.value)} aria-pressed={financing === ft.value}>{ft.label}</button>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

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
        .mp-reset-btn:hover  { color: #111827 !important; border-color: rgba(0,0,0,0.25) !important }
        .mp-chip-x:hover     { opacity: 0.7 }
        .mp-select:focus     { border-color: rgba(220,38,38,0.5) !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12) }
        .mp-filter-toggle:hover { background: rgba(0,0,0,0.05) !important }
        .mp-next-prev:hover:not(:disabled) { background: rgba(0,0,0,0.05) !important; color: #111827 !important }
        .mp-page-btn:hover { background: rgba(0,0,0,0.05) !important }
        .mp-hero-glow {
          position: absolute;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(220,38,38,0.06) 0%, transparent 70%);
          top: -200px; left: 50%; transform: translateX(-50%);
          pointer-events: none;
        }
        .mp-sidebar::-webkit-scrollbar { width: 3px; }
        .mp-sidebar::-webkit-scrollbar-thumb { background: #d1d0cc; border-radius: 2px; }
        .mp-filter-fab { display: none; }
        @media(max-width:1024px){
          .mp-desktop-sidebar { display: none !important; }
          .mp-filter-fab { display: flex !important; }
          .mp-cars-layout { flex-direction: column !important; }
        }
        @keyframes mp-fade-up   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mp-slide-right{ from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
        @keyframes mp-pulse-ring { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} }
        .mp-pulse-dot { width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;animation:mp-pulse-ring 2s ease-in-out infinite; }
        .mp-anim-fade { animation:mp-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .mp-anim-d1   { animation-delay:0.1s; }
        .mp-anim-d2   { animation-delay:0.22s; }
        .mp-anim-d3   { animation-delay:0.34s; }
        .mp-card-slide { animation:mp-slide-right 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        /* Featured cards */
        .mp-feat-card { transition:transform 0.25s ease,border-color 0.25s ease,box-shadow 0.25s ease; }
        .mp-feat-card:hover { transform:translateY(-5px); border-color:rgba(220,38,38,0.4) !important; box-shadow:0 16px 40px rgba(0,0,0,0.14); }
        .mp-feat-img  { transition:transform 0.45s ease; width:100%; height:100%; object-fit:cover; display:block; }
        .mp-feat-card:hover .mp-feat-img { transform:scale(1.06); }
        /* Hero search */
        .mp-hero-search { transition:border-color 0.2s,box-shadow 0.2s; }
        .mp-hero-search:focus-within { border-color:rgba(255,255,255,0.25) !important; box-shadow:0 0 0 3px rgba(255,255,255,0.06); }
        .mp-hero-search-btn:hover { background:rgba(230,230,230,1) !important; }
        .mp-hero-chip:hover { color:rgba(255,255,255,0.9) !important; border-color:rgba(255,255,255,0.2) !important; }
        /* Listings search bar */
        .mp-search-outer { transition:border-color 0.2s,box-shadow 0.2s; }
        .mp-search-outer:focus-within { border-color:rgba(220,38,38,0.45) !important; box-shadow:0 4px 24px rgba(0,0,0,0.1), 0 0 0 3px rgba(220,38,38,0.1); }
        .mp-search-btn:hover { background:#b91c1c !important; }
        /* Responsive */
        @media(max-width:768px){
          .mp-featured-strip { grid-template-columns:1fr 1fr !important; }
          .mp-search-outer   { flex-direction:column !important; border-radius:16px !important; }
          .mp-search-field   { border-right:none !important; border-bottom:1px solid rgba(0,0,0,0.08) !important; padding:12px 18px !important; }
          .mp-search-btn     { padding:14px !important; justify-content:center; border-radius:0 0 14px 14px !important; }
          .mp-hero-search    { flex-direction:column !important; border-radius:14px !important; }
          .mp-hero-input-wrap { border-right:none !important; border-bottom:1px solid rgba(255,255,255,0.08) !important; }
          .mp-hero-budget-wrap { border-right:none !important; border-bottom:1px solid rgba(255,255,255,0.08) !important; }
          .mp-hero-search-btn { padding:15px !important; justify-content:center !important; }
          .mp-hero-illus  { display:none !important; }
          .mp-trust-grid  { grid-template-columns:1fr 1fr !important; gap:28px 0 !important; }
          .mp-trust-item  { border-right:none !important; padding:0 !important; }
        }
        @media(min-width:769px) and (max-width:1024px){
          .mp-hero-float  { display:none !important; }
          .mp-hero-illus  { transform:scale(0.85); transform-origin:right center; }
        }
        @media(max-width:480px){
          .mp-featured-strip { grid-template-columns:1fr !important; }
          .mp-hero-stats     { overflow-x:auto !important; flex-wrap:nowrap !important; justify-content:flex-start !important; }
          .mp-hero-stat-item { padding:0 20px !important; }
        }
      `}</style>

      <MarketplaceHeader />

      {/* Mobile drawer backdrop */}
      {filtersOpen && (
        <div onClick={() => setFiltersOpen(false)} style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }} />
      )}

      {/* Mobile filter drawer */}
      <div style={{ position:'fixed', top:0, right:0, bottom:0, zIndex:50, width:'300px', maxWidth:'90vw', background:'#ffffff', borderLeft:'1px solid rgba(0,0,0,0.08)', transform: filtersOpen ? 'translateX(0)' : 'translateX(100%)', transition:'transform 0.3s cubic-bezier(0.22,1,0.36,1)', display:'flex', flexDirection:'column', fontFamily:"'Outfit',sans-serif" }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
          <h2 style={{ color:'#111827', fontWeight:'800', fontSize:'15px', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
            <SlidersHorizontal size={15} style={{ color:'#dc2626' }}/> Filters
            {activeChips.length > 0 && <span style={{ background:'#dc2626', color:'white', fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'20px' }}>{activeChips.length}</span>}
          </h2>
          <button onClick={() => setFiltersOpen(false)} style={{ background:'rgba(0,0,0,0.05)', border:'none', cursor:'pointer', color:'#6b7280', borderRadius:'8px', padding:'6px', display:'flex', alignItems:'center' }}><X size={16}/></button>
        </div>
        <div className="mp-sidebar" style={{ flex:1, overflowY:'auto', padding:'8px 20px' }}>
          {renderFilters()}
        </div>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(0,0,0,0.08)', display:'flex', gap:'10px' }}>
          <button onClick={resetAll} style={{ flex:1, background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.1)', color:'#6b7280', fontSize:'13px', fontWeight:'600', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Reset all</button>
          <button onClick={() => setFiltersOpen(false)} style={{ flex:2, background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'white', fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Show {totalCount} cars</button>
        </div>
      </div>

      <div style={S.page}>
        {/* ── Hero ── */}
        <section style={{ background:'#08090f', position:'relative', overflow:'hidden' }}>

          {/* BG grid */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize:'80px 80px', pointerEvents:'none', zIndex:0 }}/>
          {/* Red glow */}
          <div style={{ position:'absolute', top:'-200px', left:'50%', transform:'translateX(-50%)', width:'900px', height:'700px', background:'radial-gradient(ellipse at 50% 30%,rgba(220,38,38,0.12) 0%,transparent 60%)', pointerEvents:'none', zIndex:0 }}/>

          {/* ── Centred copy ── */}
          <div style={{ maxWidth:'860px', margin:'0 auto', padding:'100px 24px 64px', textAlign:'center', position:'relative', zIndex:1 }}>

            {/* Trust pill */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(220,38,38,0.1)', border:'0.5px solid rgba(220,38,38,0.28)', color:'#f87171', fontSize:'12px', fontWeight:'600', padding:'7px 16px', borderRadius:'100px', marginBottom:'28px', fontFamily:"'Outfit',sans-serif" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(220,38,38,0.2)" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M9 12l2 2 4-4" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Malaysia's first fully-verified used car marketplace
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", margin:'0 0 20px', lineHeight:'0.95', letterSpacing:'-0.03em', fontSize:'clamp(52px,7vw,96px)' }}>
              <span style={{ display:'block', color:'#ffffff' }}>Buy used cars.</span>
              <span style={{ display:'block', color:'rgba(255,255,255,0.35)' }}>Without the bullshit.</span>
            </h1>

            {/* Subheadline */}
            <p style={{ fontSize:'15px', color:'rgba(255,255,255,0.5)', maxWidth:'440px', margin:'0 auto 40px', lineHeight:'1.75', fontFamily:"'Outfit',sans-serif", fontWeight:'400' }}>
              Every listing on xdrive.my is from a verified dealer — complete with documents, real photos, and a track record. No phantom listings. No Mudah-style scams.
            </p>

            {/* ── Search bar ── */}
            <form
              onSubmit={e => { e.preventDefault(); const p = new URLSearchParams(); if (heroQ) p.set('q', heroQ); if (heroBudget) p.set('budget', heroBudget); navigate(`/showroom${p.toString() ? `?${p}` : ''}`); }}
              style={{ maxWidth:'680px', margin:'0 auto 24px' }}
            >
              <div className="mp-hero-search" style={{ display:'flex', alignItems:'stretch', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'14px', overflow:'hidden' }}>
                <div className="mp-hero-input-wrap" style={{ flex:1, display:'flex', alignItems:'center', borderRight:'1px solid rgba(255,255,255,0.07)', minWidth:0 }}>
                  <input
                    type="text"
                    value={heroQ}
                    onChange={e=>setHeroQ(e.target.value)}
                    placeholder="Search by make, model, or registration..."
                    style={{ width:'100%', border:'none', outline:'none', padding:'17px 20px', fontSize:'14px', color:'#fff', background:'transparent', fontFamily:"'Outfit',sans-serif" }}
                  />
                </div>
                <div className="mp-hero-budget-wrap" style={{ position:'relative', display:'flex', alignItems:'center', borderRight:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                  <select
                    value={heroBudget}
                    onChange={e=>setHeroBudget(e.target.value)}
                    style={{ border:'none', outline:'none', padding:'17px 32px 17px 18px', fontSize:'14px', color:heroBudget?'#fff':'rgba(255,255,255,0.42)', background:'transparent', fontFamily:"'Outfit',sans-serif", cursor:'pointer', appearance:'none', whiteSpace:'nowrap' }}
                  >
                    <option value="" style={{ background:'#0d1117' }}>Any budget</option>
                    <option value="under100k" style={{ background:'#0d1117' }}>Under RM 100k</option>
                    <option value="100k-300k" style={{ background:'#0d1117' }}>RM 100k–300k</option>
                    <option value="above300k" style={{ background:'#0d1117' }}>RM 300k+</option>
                  </select>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:10, pointerEvents:'none', flexShrink:0 }}><path d="M6 9l6 6 6-6"/></svg>
                </div>
                <button
                  type="submit"
                  className="mp-hero-search-btn"
                  style={{ background:'#ffffff', color:'#0d0d10', border:'none', padding:'0 28px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'8px', flexShrink:0, whiteSpace:'nowrap', borderRadius:'0 10px 10px 0' }}
                >
                  <Search size={15}/> Search
                </button>
              </div>
            </form>

            {/* ── Quick chips ── */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.32)', fontWeight:'500', fontFamily:"'Outfit',sans-serif", flexShrink:0 }}>Popular:</span>
              {['Honda Civic FL5','Toyota Alphard','BMW M5','Porsche 911','Mercedes GLC','Toyota Vellfire'].map(chip => (
                <button
                  key={chip}
                  className="mp-hero-chip"
                  onClick={() => navigate(`/showroom?q=${encodeURIComponent(chip)}`)}
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'100px', padding:'6px 14px', fontSize:'13px', fontWeight:'500', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* ── Car illustration area ── */}
          <div className="mp-hero-illus" style={{ maxWidth:'1360px', margin:'0 auto', padding:'0 24px 72px', position:'relative', zIndex:1 }}>
            <div style={{ position:'relative', maxWidth:'580px', marginLeft:'auto' }}>

              {/* Placeholder — TODO: replace with actual car render */}
              <div style={{ height:'320px', background:'rgba(255,255,255,0.02)', border:'1.5px dashed rgba(255,255,255,0.07)', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.18)', fontFamily:"'Outfit',sans-serif" }}>TODO: replace with actual car render</span>
              </div>

              {/* Gradient fade — left edge */}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, #08090f 0%, transparent 35%)', pointerEvents:'none', borderRadius:'16px' }}/>
              {/* Gradient fade — bottom edge */}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, #08090f 0%, transparent 45%)', pointerEvents:'none', borderRadius:'16px' }}/>

              {/* Float card 1 — "every listing includes" — top-right */}
              <div className="mp-hero-float" style={{ position:'absolute', top:-16, right:0, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.10)', borderRadius:'12px', padding:'14px 16px', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', minWidth:'196px' }}>
                <p style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.09em', margin:'0 0 10px', fontFamily:"'Outfit',sans-serif" }}>every listing includes</p>
                {[
                  { label:'Full ownership docs',   dot:'#22c55e' },
                  { label:'Service history',        dot:'#3b82f6' },
                  { label:'Verified dealer badge',  dot:'#f59e0b' },
                ].map(({ label, dot }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'7px' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:dot, flexShrink:0 }}/>
                    <span style={{ fontSize:'13px', fontWeight:'600', color:'rgba(255,255,255,0.75)', fontFamily:"'Outfit',sans-serif" }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Float card 2 — "just listed" — bottom-right */}
              <Link to="/listing/sample" style={{ textDecoration:'none' }}>
                <div className="mp-hero-float" style={{ position:'absolute', bottom:24, right:0, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.10)', borderRadius:'12px', padding:'13px 15px', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', minWidth:'172px' }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'rgba(220,38,38,0.15)', border:'0.5px solid rgba(220,38,38,0.3)', borderRadius:'6px', padding:'3px 8px', marginBottom:'9px' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#dc2626' }}/>
                    <span style={{ fontSize:'9px', fontWeight:'700', color:'#f87171', letterSpacing:'0.06em', textTransform:'uppercase' }}>Just listed</span>
                  </div>
                  <p style={{ margin:'0 0 5px', fontSize:'14px', fontWeight:'700', color:'rgba(255,255,255,0.9)', fontFamily:"'Outfit',sans-serif" }}>2021 Honda Civic 1.5T</p>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'8px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.42)', fontFamily:"'Outfit',sans-serif" }}>Kuala Lumpur</span>
                  </div>
                  <p style={{ margin:0, fontSize:'15px', fontWeight:'700', color:'#dc2626', fontFamily:"'Outfit',sans-serif" }}>RM 128,000</p>
                </div>
              </Link>
            </div>
          </div>

          {/* ── Trust strip ── */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding:'28px 24px' }}>
            <div className="mp-trust-grid" style={{ maxWidth:'1360px', margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
              {[
                { number:'2,400+', label:'verified cars listed today' },        // TODO: replace with live Supabase count
                { number:'180+',   label:'certified dealers across Malaysia' }, // TODO: replace with live Supabase count
                { number:'100%',   label:'listings require full documentation' },// TODO: replace with live Supabase count
                { number:'Zero',   label:'phantom listings or fake prices' },   // TODO: replace with live Supabase count
              ].map((s,i) => (
                <div key={s.number} className="mp-trust-item" style={{ padding:'0 32px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                  <div style={{ fontSize:'24px', fontWeight:'500', color:'#ffffff', lineHeight:1, marginBottom:'5px', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.02em' }}>{s.number}</div>
                  <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'Outfit',sans-serif" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Brand strip ── */}
        <section style={{ background: '#F7F6F2', padding: '28px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingTop: '10px', paddingBottom: '10px', scrollbarWidth: 'none', msOverflowStyle: 'none', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'All',          to: '/showroom',                            initials: 'ALL', color: '#DC2626' },
                { label: 'Perodua',      to: '/showroom?brand=Perodua',      logo: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Perodua_Logo_%282008_-_Present%29.svg' },
                { label: 'Proton',       to: '/showroom?brand=Proton',       logo: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Proton_AG_Logo_02.svg',           invert: true },
                { label: 'Toyota',       to: '/showroom?brand=Toyota',       logo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Toyota_Logo.svg',                 invert: true },
                { label: 'Honda',        to: '/showroom?brand=Honda',        logo: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg' },
                { label: 'Nissan',       to: '/showroom?brand=Nissan',       logo: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Nissan_2020_logo.svg',            invert: true },
                { label: 'Mazda',        to: '/showroom?brand=Mazda',        logo: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Mazda_logo_2024.svg',             invert: true },
                { label: 'Mitsubishi',   to: '/showroom?brand=Mitsubishi',   logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Mitsubishi_logo.svg' },
                { label: 'BMW',          to: '/showroom?brand=BMW',          logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/BMW_logo_%28gray%29.svg' },
                { label: 'Mercedes',     to: '/showroom?brand=Mercedes-Benz',logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Mercedes-Benz_%282025%29.svg',    invert: true },
                { label: 'Hyundai',      to: '/showroom?brand=Hyundai',      logo: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg',  invert: true },
              ].map(({ label, to, logo, initials, color, invert }) => {
                const isActive = brand && label !== 'All' && searchParams.get('brand') === label;
                return (
                  <a
                    key={label}
                    href={to}
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                  >
                    <div style={{
                      width: '84px', height: '68px', borderRadius: '14px', padding: '12px',
                      background: isActive ? 'rgba(220,38,38,0.08)' : '#ffffff',
                      border: `1px solid ${isActive ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(220,38,38,0.08)' : '#ffffff'; e.currentTarget.style.borderColor = isActive ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      {logo ? (
                        <img src={logo} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'none' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                      ) : null}
                      <span style={{ display: logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '8px', background: color || 'rgba(0,0,0,0.08)', color: '#fff', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', fontFamily: "'Outfit',sans-serif" }}>{initials}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: isActive ? '#dc2626' : '#6b7280', fontFamily: "'Outfit',sans-serif", fontWeight: isActive ? '700' : '500', textAlign: 'center', maxWidth: '84px', lineHeight: 1.2 }}>{label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <div style={S.wrap}>
          {/* Two-column layout */}
          <div className="mp-cars-layout" style={{ display:'flex', gap:'28px', alignItems:'flex-start', paddingTop:'24px' }}>

            {/* Left: results */}
            <div id="mp-results" style={{ flex:1, minWidth:0 }}>
              {/* Active chips */}
              {activeChips.length > 0 && (
                <div style={{ ...S.chipsRow, paddingTop:0, marginBottom:'16px' }}>
                  <span style={{ fontSize:'13px', color:'#6b7280', marginRight:'4px' }}>Active:</span>
                  {activeChips.map(chip => (
                    <span key={chip.key} style={S.chip}>
                      {chip.label}
                      <button className="mp-chip-x" style={S.chipX} onClick={() => chip.key === 'hot_deals' ? setParam('hot_deals', '') : setParam(chip.key, '')} aria-label={`Remove ${chip.label} filter`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <button className="mp-reset-btn" style={{ ...S.resetBtn, padding:'4px 10px', fontSize:'12px' }} onClick={resetAll}><RotateCcw size={11}/> Clear all</button>
                </div>
              )}

              {/* Results header */}
              <div style={S.resultsHeader}>
                <div style={S.resultsCount}>
                  {loading ? 'Loading…' : `${totalCount.toLocaleString()} car${totalCount !== 1 ? 's' : ''} found`}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <label htmlFor="sort-select" style={{ fontSize:'14px', color:'#6b7280', whiteSpace:'nowrap' }}>Sort by</label>
                  <select id="sort-select" className="mp-select" style={{ ...S.select, width:'auto', fontSize:'14px', padding:'9px 14px' }} value={sort} onChange={e => setParam('sort', e.target.value)}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background:'#fff' }}>{o.label}</option>)}
                  </select>
                  <button
                    className="mp-desktop-sidebar-toggle"
                    onClick={() => setSidebarOpen(o => !o)}
                    style={{ display:'flex', alignItems:'center', gap:'6px', background: sidebarOpen ? 'rgba(220,38,38,0.08)' : '#ffffff', border: sidebarOpen ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(0,0,0,0.1)', borderRadius:'10px', padding:'9px 14px', color: sidebarOpen ? '#dc2626' : '#6b7280', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}
                  >
                    <SlidersHorizontal size={14}/>
                    Filters {activeChips.length > 0 && `(${activeChips.length})`}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <p style={{ color:'#f87171', fontSize:'17px', marginBottom:'20px' }}>{error}</p>
                  <button onClick={fetchCars} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'14px 28px', borderRadius:'10px', fontSize:'16px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Try Again</button>
                </div>
              )}

              {/* Cars grid */}
              {!error && (
                <div style={S.carsGrid}>
                  {loading
                    ? Array.from({ length: PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)
                    : cars.length === 0
                      ? (
                        <div style={S.emptyState}>
                          <Car size={56} color="#374151" style={{ marginBottom:'20px' }} />
                          <p style={{ color:'#6b7280', fontSize:'19px', fontWeight:'600', marginBottom:'12px' }}>No cars match your filters</p>
                          <p style={{ color:'#4b5563', fontSize:'16px', marginBottom:'28px' }}>Try adjusting your search or browse all available cars.</p>
                          <button onClick={resetAll} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'14px 32px', borderRadius:'10px', fontSize:'16px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Browse All Cars</button>
                        </div>
                      )
                      : cars.map(car => {
                          const inCompare = isInCompare(car.id);
                          const compareFull = compareIds.length >= 4 && !inCompare;
                          const sellerRole = car.dealer?.role;
                          const isAgent = sellerRole === 'salesman';
                          const sellerLabel = isAgent ? 'Agent' : 'Dealer';
                          const sellerColor = isAgent
                            ? { bg:'rgba(251,146,60,0.15)', border:'rgba(251,146,60,0.35)', color:'#fb923c' }
                            : { bg:'rgba(59,130,246,0.15)', border:'rgba(59,130,246,0.35)', color:'#60a5fa' };
                          return (
                            <div key={car.id} style={{ position:'relative' }}>
                              <CarCard car={car} ctaContext={ctaCtx} />
                              {/* Seller badge — bottom-left of image */}
                              <div style={{ position:'absolute', top:'10px', left:'10px', zIndex:10, display:'flex', alignItems:'center', gap:'4px', background: sellerColor.bg, border:`1px solid ${sellerColor.border}`, borderRadius:'6px', padding:'3px 8px', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', pointerEvents:'none' }}>
                                <Users size={9} color={sellerColor.color}/>
                                <span style={{ fontSize:'10px', fontWeight:'700', color: sellerColor.color, fontFamily:"'Outfit',sans-serif", letterSpacing:'0.03em' }}>{sellerLabel}</span>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); if (compareFull) { toast.error('Compare is full — remove a car first (max 4)', { duration:2500 }); return; } inCompare ? removeFromCompare(car.id) : addToCompare(car.id); }}
                                title={compareFull ? 'Compare full (max 4)' : inCompare ? 'Remove from compare' : 'Add to compare'}
                                style={{ position:'absolute', top:'10px', right:'10px', zIndex:10, display:'flex', alignItems:'center', gap:'5px', background: inCompare ? 'rgba(220,38,38,0.85)' : 'rgba(0,0,0,0.72)', border:`1px solid ${inCompare ? '#dc2626' : 'rgba(255,255,255,0.2)'}`, borderRadius:'8px', padding:'6px 10px', color:'#fff', fontSize:'11px', fontWeight:'700', cursor:'pointer', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', fontFamily:"'Outfit',sans-serif", letterSpacing:'0.02em', transition:'all 0.15s' }}
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

              {/* Pagination */}
              {!loading && !error && totalPages > 1 && (
                <div style={S.paginationWrap}>
                  <Pagination page={page} totalPages={totalPages} onPage={setPage} />
                  <p style={{ textAlign:'center', color:'#4b5563', fontSize:'14px', marginTop:'16px' }}>
                    Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,totalCount)} of {totalCount.toLocaleString()} cars
                  </p>
                </div>
              )}
            </div>

            {/* Right: filter sidebar — desktop toggle */}
            {sidebarOpen && (
              <aside className="mp-sidebar" style={{ width:'260px', flexShrink:0, background:'#ffffff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'16px', padding:'20px', position:'sticky', top:'80px', maxHeight:'calc(100vh - 100px)', overflowY:'auto', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
                  <h2 style={{ color:'#111827', fontSize:'13px', fontWeight:'800', margin:0, display:'flex', alignItems:'center', gap:'6px', fontFamily:"'Outfit',sans-serif" }}>
                    <SlidersHorizontal size={13} style={{ color:'#dc2626' }}/>
                    Filters
                    {activeChips.length > 0 && <span style={{ background:'#dc2626', color:'white', fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'20px' }}>{activeChips.length}</span>}
                  </h2>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    {hasFilters && <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', fontFamily:"'Outfit',sans-serif" }}><RotateCcw size={10}/> Reset</button>}
                    <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center' }}><X size={14}/></button>
                  </div>
                </div>
                {renderFilters()}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter FAB */}
      <div className="mp-filter-fab" style={{ position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)', zIndex:30 }}>
        <button
          onClick={() => setFiltersOpen(true)}
          style={{ display:'flex', alignItems:'center', gap:'8px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'white', fontSize:'13px', fontWeight:'700', padding:'13px 24px', borderRadius:'50px', cursor:'pointer', boxShadow:'0 8px 24px rgba(220,38,38,0.4)', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}
        >
          <SlidersHorizontal size={14}/>
          Filters {activeChips.length > 0 && `(${activeChips.length})`}
        </button>
      </div>

      <Footer />
    </>
  );
}
