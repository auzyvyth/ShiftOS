import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet';
import { RotateCcw, Car, Users, SlidersHorizontal, Search, ArrowLeftRight, ArrowRight, X } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import Footer from '@/components/Footer';
import CarCard from '@/components/CarCard';
import MarketplaceHeader from '../components/MarketplaceHeader';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { PRICE_STEPS } from '../components/PriceDrumPicker';
import SearchAutocomplete from '../components/SearchAutocomplete';
import BodyTypeCarousel from '../components/marketplace/BodyTypeCarousel';
import AdvancedSearchModal from '../components/marketplace/AdvancedSearchModal';
import {
  BRANDS, BODY_TYPES, TRANSMISSIONS, FINANCING_TYPES, MY_STATES, SORT_OPTIONS,
  YEARS, MILEAGE_OPTIONS, CONDITION_OPTIONS, FUEL_TYPES, COLOURS,
  CAR_FIELDS, DEALER_JOIN,
  dedupe, sanitizeBrand, sanitizeBodyType, sanitizeTransmission, sanitizeFinancing,
  sanitizeState, sanitizeYear, sanitizeQ, sanitizeCondition, sanitizeMileageMax,
  sanitizeFuelType, sanitizeColour, sanitizeSellerType, sanitizeStr,
} from '../config/marketplaceConfig';

/* ── Constants ─────────────────────────────────────────────────────────────── */
const PER_PAGE = 12;

/* sanitizePrice depends on PRICE_STEPS from PriceDrumPicker so lives here */
function sanitizePrice(val) {
  const n = parseInt(val, 10);
  const allowed = PRICE_STEPS.filter(s => s.value).map(s => parseInt(s.value, 10));
  return allowed.includes(n) ? n : null;
}

/* ── Skeleton Card ──────────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div style={{
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    <div style={{ height: '200px', background: 'linear-gradient(90deg,#e8e6e0 25%,#f0eeea 50%,#e8e6e0 75%)', backgroundSize: '200% 100%', animation: 'mp-shimmer 1.5s infinite' }} />
    <div style={{ padding: '16px' }}>
      {[80,55,95,70].map((w, i) => (
        <div key={i} style={{ height: '12px', width: `${w}%`, background: '#e8e6e0', borderRadius: '6px', marginBottom: '10px', animation: 'mp-shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  </div>
);

/* ── Stat Item ──────────────────────────────────────────────────────────────── */
const StatItem = ({ icon: Icon, value, label, color }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'20px 28px', background:'#ffffff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'14px', flex:'1', minWidth:'160px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
    <div style={{ width:'44px', height:'44px', borderRadius:'12px', background: color || 'rgba(220,38,38,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Icon size={20} color={color ? '#fff' : '#dc2626'} />
    </div>
    <div>
      <div style={{ fontSize:'22px', fontWeight:'700', color:'#111827', lineHeight:1.1 }}>{value}</div>
      <div style={{ fontSize:'13px', color:'#6b7280', marginTop:'2px' }}>{label}</div>
    </div>
  </div>
);

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
  const minPrice     = sanitizePrice(searchParams.get('min_price') || '');
  const maxPrice     = sanitizePrice(searchParams.get('max_price') || '');
  const financing    = sanitizeFinancing(searchParams.get('financing') || '');
  const yearFrom     = sanitizeYear(searchParams.get('year_from') || '');
  const yearTo       = sanitizeYear(searchParams.get('year_to') || '');
  const q            = sanitizeQ(searchParams.get('q') || '');
  const condition    = sanitizeCondition(searchParams.get('condition') || '');
  const mileageMax   = sanitizeMileageMax(searchParams.get('mileage_max') || '');
  const hotDeals     = searchParams.get('hot_deals') === 'true';
  const fuelType     = sanitizeFuelType(searchParams.get('fuel_type') || '');
  const colour       = sanitizeColour(searchParams.get('colour') || '');
  const sellerType   = sanitizeSellerType(searchParams.get('seller_type') || '');
  const model        = sanitizeStr(searchParams.get('model') || '');
  const variant      = sanitizeStr(searchParams.get('variant') || '');
  const sort         = ['newest','price_asc','price_desc'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => { setSearchInput(q); }, [q]);

  const [heroQ,        setHeroQ]        = useState('');
  const [heroBudget,   setHeroBudget]   = useState('');
  const [heroState,    setHeroState]    = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  /* Data state */
  const [cars, setCars]           = useState([]);
  const [totalCount, setTotal]    = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [loadPage, setLoadPage]   = useState(1);

  /* Body-type carousels — lazy loaded when section enters viewport */
  const [bodyTypeCars, setBodyTypeCars] = useState({ Hatchback: [], Sedan: [], SUV: [], MPV: [] });
  const [bodyTypeLoading, setBodyTypeLoading] = useState(false);
  const carouselSectionRef = useRef(null);
  const carouselFetched = useRef(false);

  /* Sentinel for auto-load */
  const sentinelRef = useRef(null);
  const MAX_AUTO_PAGES = 3;

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

  /* ── Fetch body type carousels — only when section enters viewport ── */
  useEffect(() => {
    const el = carouselSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || carouselFetched.current) return;
      carouselFetched.current = true;
      setBodyTypeLoading(true);
      const types = ['Hatchback', 'Sedan', 'SUV', 'MPV'];
      Promise.all(
        types.map(type =>
          supabase
            .from('car_listings')
            .select(CAR_FIELDS)
            .eq('status', 'available')
            .eq('body_type', type)
            .order('created_at', { ascending: false })
            .limit(10)
            .then(({ data }) => [type, data || []])
        )
      ).then(results => {
        const map = {};
        results.forEach(([type, data]) => { map[type] = data; });
        setBodyTypeCars(map);
        setBodyTypeLoading(false);
      });
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Fetch cars (server-side, load-more) ── */
  const fetchCars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = (loadPage - 1) * PER_PAGE;
      const to   = from + PER_PAGE - 1;

      let query = supabase
        .from('car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, { count: 'exact' })
        .eq('status', 'available');

      if (q) {
        const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
        tokens.forEach(t => {
          const s = t.replace(/[%_\\]/g, '');
          if (s) query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,variant.ilike.%${s}%`);
        });
      }
      if (brand)        query = query.eq('brand', brand);
      if (bodyType)     query = query.eq('body_type', bodyType);
      if (state)        query = query.eq('state', state);
      if (minPrice)     query = query.gte('selling_price', minPrice);
      if (maxPrice)     query = query.lte('selling_price', maxPrice);
      if (financing)    query = query.eq('financing_type', financing);
      if (yearFrom)     query = query.gte('year', yearFrom);
      if (yearTo)       query = query.lte('year', yearTo);
      if (mileageMax)   query = query.lte('mileage', mileageMax);
      if (hotDeals)     query = query.not('original_price', 'is', null).gt('original_price', 0);
      if (condition)    query = query.eq('condition', condition);
      if (transmission) {
        const txVal = transmission === 'Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT'];
        query = query.in('transmission', txVal);
      }
      if (fuelType)   query = query.eq('fuel_type', fuelType);
      if (colour)     query = query.ilike('colour', `%${colour}%`);
      if (sellerType) query = query.filter('profiles!car_listings_dealer_id_fkey.role', 'eq', sellerType === 'agent' ? 'salesman' : 'dealer');
      if (model)      query = query.eq('model', model);
      if (variant)    query = query.ilike('variant', `%${variant}%`);

      if (sort === 'price_asc')  query = query.order('selling_price', { ascending: true });
      else if (sort === 'price_desc') query = query.order('selling_price', { ascending: false });
      else                        query = query.order('created_at',    { ascending: false });

      query = query.range(from, to);

      const { data, error: err, count } = await query;
      if (err) throw err;

      if (loadPage === 1) {
        setCars(dedupe(data || []));
      } else {
        setCars(prev => dedupe([...prev, ...(data || [])]));
      }
      setTotal(count || 0);
    } catch (e) {
      setError('Failed to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loadPage, brand, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType, model, variant, sort]);

  /* Reset to page 1 whenever filter params change from outside (URL navigation) */
  useEffect(() => {
    setLoadPage(1);
  }, [brand, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType, model, variant, sort]); // eslint-disable-line

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  /* ── Sentinel: auto-load next page when bottom of grid enters viewport ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (loading || cars.length >= totalCount || loadPage >= MAX_AUTO_PAGES) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLoadPage(p => p + 1);
    }, { rootMargin: '120px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, cars.length, totalCount, loadPage]);

  /* ── Filter helpers ── */
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setLoadPage(1);
  };

  const resetAll = () => { setSearchInput(''); setSearchParams({}, { replace: true }); setLoadPage(1); };

  const hasFilters = brand || bodyType || transmission || state || minPrice || maxPrice || financing || yearFrom || yearTo || q || condition || mileageMax || hotDeals || fuelType || colour || sellerType || model || variant;
  /* ── Active filter chips ── */
  const activeChips = [
    q            && { key: 'q',            label: `"${q}"` },
    brand        && { key: 'brand',        label: brand },
    bodyType     && { key: 'body_type',    label: bodyType },
    transmission && { key: 'transmission', label: transmission },
    state        && { key: 'state',        label: state },
    (minPrice || maxPrice) && { key: 'price_range', label: `${minPrice ? PRICE_STEPS.find(s=>s.value===String(minPrice))?.label : 'Any'} – ${maxPrice ? PRICE_STEPS.find(s=>s.value===String(maxPrice))?.label : 'Any'}` },
    financing    && { key: 'financing',    label: FINANCING_TYPES.find(f => f.value === financing)?.label || '' },
    yearFrom     && { key: 'year_from',    label: `From ${yearFrom}` },
    yearTo       && { key: 'year_to',      label: `To ${yearTo}` },
    condition    && { key: 'condition',    label: CONDITION_OPTIONS.find(c => c.value === condition)?.label || condition },
    mileageMax   && { key: 'mileage_max', label: MILEAGE_OPTIONS.find(m => m.value === String(mileageMax))?.label || '' },
    hotDeals     && { key: 'hot_deals',   label: '🔥 Hot Deals' },
    fuelType     && { key: 'fuel_type',   label: fuelType },
    colour       && { key: 'colour',      label: colour },
    sellerType   && { key: 'seller_type', label: sellerType === 'agent' ? 'Agent' : 'Dealer' },
    model        && { key: 'model',       label: model },
    variant      && { key: 'variant',     label: `Variant: ${variant}` },
  ].filter(Boolean);

  /* ── Styles ── */
  const S = {
    page: {
      minHeight: '100vh',
      background: '#F7F6F2',
      fontFamily: "'Outfit', sans-serif",
      overflowX: 'hidden',
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

  return (
    <>
      <Helmet>
        <title>XDrive — Malaysia's Car Marketplace</title>
        <meta name="description" content="Browse thousands of new, used, and recon cars from verified dealers across Malaysia. Find the best deals on Perodua, Proton, Honda, Toyota and more." />
        <link rel="canonical" href={`https://xdrive.my/marketplace${hotDeals ? '?hot_deals=true' : condition ? `?condition=${condition}` : ''}`} />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://xdrive.my/marketplace" />
        <meta property="og:locale"      content="en_MY" />
        <meta property="og:site_name"   content="XDrive" />
        <meta property="og:title"       content="XDrive — Malaysia's Car Marketplace" />
        <meta property="og:description" content="Browse thousands of new, used, and recon cars from verified dealers across Malaysia." />
        <meta property="og:image"       content="https://xdrive.my/og-marketplace.jpg" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="XDrive — Malaysia's Car Marketplace" />
        <meta name="twitter:description" content="Browse thousands of new, used, and recon cars from verified dealers across Malaysia." />
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
        /* Hero section — full viewport height */
        .mp-hero-section { height: calc(100vh - 64px); display: flex; flex-direction: column; overflow: hidden; }
        /* Listings search bar */
        .mp-search-outer { transition:border-color 0.2s,box-shadow 0.2s; }
        .mp-search-outer:focus-within { border-color:rgba(220,38,38,0.45) !important; box-shadow:0 4px 24px rgba(0,0,0,0.1), 0 0 0 3px rgba(220,38,38,0.1); }
        .mp-search-btn:hover { background:#b91c1c !important; }
        /* Adv modal scrollbar */
        .mp-adv-modal::-webkit-scrollbar { width: 4px; }
        .mp-adv-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        /* Responsive */
        @media(max-width:900px){
          .mp-hero-section  { height: auto !important; overflow-y: visible !important; overflow-x: hidden !important; }
          .mp-hero-two-col  { flex-direction: column !important; padding: 20px 16px 16px !important; gap: 14px !important; align-items: stretch !important; }
          .mp-hero-illus    { display: none !important; }
          .mp-hero-desc     { display: none !important; }
          .mp-hero-search   { width: 100% !important; flex-shrink: 1 !important; }
          .mp-trust-grid    { grid-template-columns: 1fr 1fr !important; gap: 10px 0 !important; }
          .mp-trust-item    { border-right: none !important; padding: 8px 12px !important; }
          .mp-trust-strip   { padding: 12px 16px !important; }
        }
        @media(max-width:768px){
          .mp-featured-strip { grid-template-columns:1fr 1fr !important; }
          .mp-search-outer   { flex-direction:column !important; border-radius:16px !important; }
          .mp-search-field   { border-right:none !important; border-bottom:1px solid rgba(0,0,0,0.08) !important; padding:12px 18px !important; }
          .mp-search-btn     { padding:14px !important; justify-content:center; border-radius:0 0 14px 14px !important; }
        }
        @media(max-width:480px){
          .mp-featured-strip { grid-template-columns:1fr !important; }
        }
      `}</style>

      <MarketplaceHeader />

      <AdvancedSearchModal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        heroQ={heroQ}
        heroBudget={heroBudget}
        onApply={(p) => navigate(`/showroom${p.toString() ? '?' + p : ''}`)}
      />

      <div style={S.page}>
        {/* ── Hero ── */}
        <section className="mp-hero-section" style={{ background:'#08090f', position:'relative' }}>

          {/* BG grid */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize:'80px 80px', pointerEvents:'none', zIndex:0 }}/>
          {/* Red glow */}
          <div style={{ position:'absolute', top:'-200px', left:'50%', transform:'translateX(-50%)', width:'900px', height:'700px', background:'radial-gradient(ellipse at 50% 30%,rgba(220,38,38,0.12) 0%,transparent 60%)', pointerEvents:'none', zIndex:0 }}/>

          {/* ── Two-column hero ── fills remaining height via flex:1 */}
          <div className="mp-hero-two-col" style={{ flex:1, minHeight:0, maxWidth:'1360px', width:'100%', margin:'0 auto', padding:'0 clamp(24px,5vw,60px)', display:'flex', alignItems:'center', gap:'clamp(32px,5vw,72px)', position:'relative', zIndex:1 }}>

            {/* LEFT: copy + trust card */}
            <div style={{ flex:'1 1 0', minWidth:0 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'7px', background:'rgba(220,38,38,0.1)', border:'0.5px solid rgba(220,38,38,0.28)', color:'#f87171', fontSize:'11px', fontWeight:'600', padding:'5px 13px', borderRadius:'100px', marginBottom:'14px', fontFamily:"'Outfit',sans-serif" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(220,38,38,0.2)" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Malaysia's first fully-verified car marketplace
              </div>

              <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", margin:'0 0 10px', lineHeight:'0.95', letterSpacing:'-0.02em', fontSize:'clamp(36px,4.5vw,76px)', textAlign:'left' }}>
                <span style={{ display:'block', color:'#ffffff' }}>New. Used. Recon.</span>
                <span style={{ display:'block', color:'#dc2626' }}>Find it here.</span>
              </h1>

              <p className="mp-hero-desc" style={{ fontSize:'13px', color:'rgba(255,255,255,0.45)', maxWidth:'380px', margin:'0 0 18px', lineHeight:'1.7', fontFamily:"'Outfit',sans-serif", fontWeight:'400' }}>
                Every type of car, every budget — from verified dealers across Malaysia. Full docs, real photos, zero phantom listings.
              </p>

              {/* Trust card — hidden on mobile via .mp-hero-illus */}
              <div className="mp-hero-illus" style={{ width:'auto' }}>
                <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'14px', padding:'16px 18px', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'9px', marginBottom:'14px' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'rgba(220,38,38,0.15)', border:'0.5px solid rgba(220,38,38,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(220,38,38,0.2)" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                      <p style={{ margin:0, fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:"'Outfit',sans-serif" }}>Every listing includes</p>
                      <p style={{ margin:0, fontSize:'12px', fontWeight:'600', color:'rgba(255,255,255,0.75)', fontFamily:"'Outfit',sans-serif" }}>Full transparency, guaranteed</p>
                    </div>
                  </div>
                  {[
                    { label:'Full ownership docs', desc:'Grant, roadtax & insurance verified', iconBg:'rgba(34,197,94,0.15)', iconBorder:'rgba(34,197,94,0.25)', icon:<path d="M9 12h6M9 16h6M5 8h14M5 4h14v16H5V4z" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/> },
                    { label:'Service history', desc:'Complete maintenance records included', iconBg:'rgba(59,130,246,0.15)', iconBorder:'rgba(59,130,246,0.25)', icon:<><path d="M12 8v4l3 3" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="#60a5fa" strokeWidth="1.5"/></> },
                    { label:'Verified dealer badge', desc:'All dealers certified and background-checked', iconBg:'rgba(245,158,11,0.15)', iconBorder:'rgba(245,158,11,0.25)', icon:<><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(245,158,11,0.15)" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></> },
                  ].map(({ label, desc, iconBg, iconBorder, icon }) => (
                    <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'10px' }}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:iconBg, border:`0.5px solid ${iconBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">{icon}</svg>
                      </div>
                      <div>
                        <p style={{ margin:'0 0 1px', fontSize:'12px', fontWeight:'700', color:'rgba(255,255,255,0.88)', fontFamily:"'Outfit',sans-serif" }}>{label}</p>
                        <p style={{ margin:0, fontSize:'10px', color:'rgba(255,255,255,0.35)', fontFamily:"'Outfit',sans-serif", lineHeight:'1.4' }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Search card */}
            <div className="mp-hero-search" style={{ flexShrink:0, width:'clamp(300px,30vw,400px)' }}>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'16px', padding:'20px', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
                <p style={{ margin:'0 0 12px', fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:"'Outfit',sans-serif" }}>Find your next car</p>

                <form onSubmit={e => {
                  e.preventDefault();
                  const p = new URLSearchParams();
                  if (heroQ)      p.set('q', heroQ);
                  if (heroBudget) p.set('max_price', heroBudget);
                  if (heroState)  p.set('state', heroState);
                  navigate(`/showroom${p.toString() ? `?${p}` : ''}`);
                }}>
                  <div style={{ marginBottom:'8px' }}>
                    <SearchAutocomplete
                      dark
                      value={heroQ}
                      onChange={setHeroQ}
                      placeholder="Make, model, or variant…"
                      navigateTo="/showroom"
                      onSubmit={val => setHeroQ(val)}
                      inputStyle={{ padding: '12px 12px', fontSize: '13px' }}
                    />
                  </div>

                  {/* Budget + State row */}
                  <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                    <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', overflow:'hidden' }}>
                      <select value={heroBudget} onChange={e=>setHeroBudget(e.target.value)}
                        style={{ flex:1, border:'none', outline:'none', padding:'11px 26px 11px 12px', fontSize:'12px', color:heroBudget?'#fff':'rgba(255,255,255,0.36)', background:'transparent', fontFamily:"'Outfit',sans-serif", cursor:'pointer', appearance:'none' }}>
                        <option value="" style={{ background:'#0d1117' }}>Any budget</option>
                        {PRICE_STEPS.filter(s=>s.value).map(o => <option key={o.value} value={o.value} style={{ background:'#0d1117' }}>{o.label}</option>)}
                      </select>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:9, pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', overflow:'hidden' }}>
                      <select value={heroState} onChange={e=>setHeroState(e.target.value)}
                        style={{ flex:1, border:'none', outline:'none', padding:'11px 26px 11px 12px', fontSize:'12px', color:heroState?'#fff':'rgba(255,255,255,0.36)', background:'transparent', fontFamily:"'Outfit',sans-serif", cursor:'pointer', appearance:'none' }}>
                        <option value="" style={{ background:'#0d1117' }}>Any state</option>
                        {MY_STATES.map(s => <option key={s} value={s} style={{ background:'#0d1117' }}>{s}</option>)}
                      </select>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:9, pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                  </div>

                  {/* Find Cars button — full width */}
                  <button type="submit"
                    style={{ width:'100%', background:'#dc2626', color:'#fff', border:'none', padding:'11px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', borderRadius:'10px', marginBottom:'8px' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#b91c1c'}
                    onMouseLeave={e=>e.currentTarget.style.background='#dc2626'}
                  ><Search size={13}/> Find Cars</button>

                  {/* Hot deals shortcut */}
                  <button type="button"
                    onClick={() => { setParam('hot_deals','true'); document.getElementById('mp-results')?.scrollIntoView({ behavior:'smooth', block:'start' }); }}
                    style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'none', color:'rgba(255,255,255,0.45)', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:"'Outfit',sans-serif", padding:'0 0 4px', width:'100%' }}>
                    🔥 Browse hot deals →
                  </button>

                  {/* Advanced search trigger → opens modal */}
                  <button type="button" onClick={() => setAdvancedOpen(true)}
                    style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'none', color:'rgba(255,255,255,0.28)', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:"'Outfit',sans-serif", padding:0 }}>
                    <SlidersHorizontal size={11}/>
                    Advanced search
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* ── Trust strip — fixed at bottom of hero ── */}
          <div className="mp-trust-strip" style={{ flexShrink:0, borderTop:'1px solid rgba(255,255,255,0.07)', padding:'14px 24px', position:'relative', zIndex:1 }}>
            <div className="mp-trust-grid" style={{ maxWidth:'1360px', margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
              {[
                { number: stats.listings != null ? stats.listings.toLocaleString() + '+' : '—', label:'Cars listed' },
                { number: stats.dealers  != null ? stats.dealers + '+'                  : '—', label:'Verified dealers' },
                { number:'100%', label:'Docs required' },
                { number:'0', label:'Phantom listings' },
              ].map((s,i) => (
                <div key={s.label} className="mp-trust-item" style={{ padding:'0 28px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                  <div style={{ fontSize:'20px', fontWeight:'500', color:'#ffffff', lineHeight:1, marginBottom:'3px', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.02em' }}>{s.number}</div>
                  <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'Outfit',sans-serif" }}>{s.label}</div>
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
                { label: 'All',        brandVal: '',              initials: 'ALL', color: '#DC2626' },
                { label: 'Perodua',    brandVal: 'Perodua',    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Perodua_Logo_%282008_-_Present%29.svg' },
                { label: 'Proton',     brandVal: 'Proton',     logo: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Proton_AG_Logo_02.svg' },
                { label: 'Toyota',     brandVal: 'Toyota',     logo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Toyota_Logo.svg' },
                { label: 'Honda',      brandVal: 'Honda',      logo: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg' },
                { label: 'Nissan',     brandVal: 'Nissan',     logo: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Nissan_2020_logo.svg' },
                { label: 'Mazda',      brandVal: 'Mazda',      logo: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Mazda_logo_2024.svg' },
                { label: 'Mitsubishi', brandVal: 'Mitsubishi', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Mitsubishi_logo.svg' },
                { label: 'BMW',        brandVal: 'BMW',        logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/BMW_logo_%28gray%29.svg' },
                { label: 'Mercedes',   brandVal: 'Mercedes-Benz', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Mercedes-Benz_%282025%29.svg' },
                { label: 'Hyundai',    brandVal: 'Hyundai',    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg' },
              ].map(({ label, brandVal, logo, initials, color }) => {
                const isActive = brandVal ? searchParams.get('brand') === brandVal : !searchParams.get('brand');
                return (
                  <button
                    key={label}
                    onClick={() => {
                      setParam('brand', brandVal);
                      document.getElementById('mp-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
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
                        <img src={logo} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                      ) : null}
                      <span style={{ display: logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '8px', background: color || 'rgba(0,0,0,0.08)', color: '#fff', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', fontFamily: "'Outfit',sans-serif" }}>{initials}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: isActive ? '#dc2626' : '#6b7280', fontFamily: "'Outfit',sans-serif", fontWeight: isActive ? '700' : '500', textAlign: 'center', maxWidth: '84px', lineHeight: 1.2 }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Quick-filter strip ── */}
        <section style={{ background: '#F7F6F2', padding: '0 20px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1360px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', flexWrap: 'wrap' }}>
              {[
                { groupLabel: 'Condition', pills: [
                  { label: 'Used',          paramKey: 'condition', paramVal: 'used' },
                  { label: 'Recon / Import',paramKey: 'condition', paramVal: 'recon' },
                  { label: 'New',           paramKey: 'condition', paramVal: 'new' },
                ]},
                { groupLabel: 'Body Type', pills: [
                  { label: 'Sedan',     paramKey: 'body_type', paramVal: 'Sedan' },
                  { label: 'SUV',       paramKey: 'body_type', paramVal: 'SUV' },
                  { label: 'Hatchback', paramKey: 'body_type', paramVal: 'Hatchback' },
                  { label: 'MPV',       paramKey: 'body_type', paramVal: 'MPV' },
                ]},
                { groupLabel: 'Gearbox', pills: [
                  { label: 'Auto',   paramKey: 'transmission', paramVal: 'Auto' },
                  { label: 'Manual', paramKey: 'transmission', paramVal: 'Manual' },
                ]},
              ].map(({ groupLabel, pills }) => (
                <div key={groupLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>{groupLabel}</span>
                  {pills.map(({ label, paramKey, paramVal }) => {
                    const isActive = searchParams.get(paramKey) === paramVal;
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          setParam(paramKey, isActive ? '' : paramVal);
                          document.getElementById('mp-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                          fontFamily: "'Outfit',sans-serif", cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                          background: isActive ? 'rgba(220,38,38,0.1)' : 'rgba(0,0,0,0.05)',
                          color: isActive ? '#dc2626' : '#374151',
                          outline: isActive ? '1.5px solid rgba(220,38,38,0.4)' : '1.5px solid transparent',
                        }}
                      >{label}</button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Body Type Carousels — lazy loaded ── */}
        <section ref={carouselSectionRef} style={{ background: '#EDEAE3', padding: '32px 0 40px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <style>{`
            .btc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px 28px; }
            .btc-scroll::-webkit-scrollbar { display: none; }
            @media (max-width: 768px) {
              .btc-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
            }
          `}</style>
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 36px' }}>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#DC2626', fontFamily: "'Outfit',sans-serif" }}>Browse by Category</p>
              <h2 style={{ margin: 0, fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700, color: '#111827', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.02em' }}>Shop by Body Type</h2>
            </div>
            <div className="btc-grid">
              <BodyTypeCarousel title="Compact Cars"  eyebrow="City & Daily Drive"       bodyType="Hatchback" cars={bodyTypeCars.Hatchback} loading={bodyTypeLoading} ctaContext={ctaCtx} />
              <BodyTypeCarousel title="Sedans"         eyebrow="Executive & Family"       bodyType="Sedan"     cars={bodyTypeCars.Sedan}    loading={bodyTypeLoading} ctaContext={ctaCtx} />
              {/* Thin divider between rows */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.09)', margin: '4px 0' }} />
              <BodyTypeCarousel title="SUVs"           eyebrow="Spacious & Versatile"     bodyType="SUV"       cars={bodyTypeCars.SUV}      loading={bodyTypeLoading} ctaContext={ctaCtx} />
              <BodyTypeCarousel title="MPVs"           eyebrow="Family People Carriers"   bodyType="MPV"       cars={bodyTypeCars.MPV}      loading={bodyTypeLoading} ctaContext={ctaCtx} />
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
                      <button className="mp-chip-x" style={S.chipX} onClick={() => {
                        if (chip.key === 'hot_deals') setParam('hot_deals', '');
                        else if (chip.key === 'price_range') { setParam('min_price', ''); setParam('max_price', ''); }
                        else setParam(chip.key, '');
                      }} aria-label={`Remove ${chip.label} filter`}>
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

              {/* Sentinel — invisible trigger for auto-load */}
              {!loading && !error && cars.length < totalCount && loadPage < MAX_AUTO_PAGES && (
                <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
              )}

              {/* Loading indicator for auto-load */}
              {loading && loadPage > 1 && (
                <div style={{ textAlign:'center', padding:'24px 0', fontFamily:"'Outfit',sans-serif", fontSize:'13px', color:'#9ca3af' }}>
                  Loading more…
                </div>
              )}

              {/* Browse all → Showroom (shown when auto-load cap reached or no more) */}
              {!loading && !error && cars.length < totalCount && loadPage >= MAX_AUTO_PAGES && (
                <div style={{ textAlign:'center', padding:'32px 0 60px' }}>
                  <button
                    onClick={() => {
                      const p = new URLSearchParams();
                      if (brand)        p.set('brand', brand);
                      if (model)        p.set('model', model);
                      if (variant)      p.set('variant', variant);
                      if (bodyType)     p.set('body_type', bodyType);
                      if (state)        p.set('state', state);
                      if (minPrice)     p.set('min_price', minPrice);
                      if (maxPrice)     p.set('max_price', maxPrice);
                      if (transmission) p.set('transmission', transmission);
                      if (condition)    p.set('condition', condition);
                      if (fuelType)     p.set('fuel_type', fuelType);
                      if (colour)       p.set('colour', colour);
                      if (sellerType)   p.set('seller_type', sellerType);
                      if (q)            p.set('q', q);
                      navigate(`/showroom?${p.toString()}`);
                    }}
                    style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'#dc2626', border:'none', color:'#fff', fontSize:'14px', fontWeight:'700', padding:'13px 32px', borderRadius:'50px', cursor:'pointer', fontFamily:"'Outfit',sans-serif", boxShadow:'0 4px 16px rgba(220,38,38,0.3)', transition:'all 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#b91c1c'}
                    onMouseLeave={e=>e.currentTarget.style.background='#dc2626'}
                  >
                    Browse all {totalCount.toLocaleString()} cars <ArrowRight size={14}/>
                  </button>
                  <p style={{ marginTop:'10px', color:'#9ca3af', fontSize:'12px', fontFamily:"'Outfit',sans-serif" }}>Showing {cars.length} of {totalCount.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
