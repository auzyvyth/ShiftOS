import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet';
import { RotateCcw, Car, Users, SlidersHorizontal, Search, ArrowLeftRight, ArrowRight, X, ShieldCheck, FileCheck2, Ban, ChevronDown } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import MarketplaceFooter from '../components/MarketplaceFooter';
import ShowroomCard, { ShowroomCardSkeleton } from '@/components/ShowroomCard';
import MarketplaceHeader from '../components/MarketplaceHeader';
import GoogleOneTap from '../components/GoogleOneTap';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { readCache, writeCache, precacheImages } from '../utils/localCache';
import { PRICE_STEPS } from '../components/PriceDrumPicker';
import SearchAutocomplete from '../components/SearchAutocomplete';
import BodyTypeCarousel from '../components/marketplace/BodyTypeCarousel';
import AdvancedSearchModal from '../components/marketplace/AdvancedSearchModal';
import SkeletonCard from '../components/ui/SkeletonCard';
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
  const [heroTab, setHeroTab] = useState(0);

  // Single nav path for every hero-search entry point (Enter, search icon,
  // Find Cars button) — carries the typed query plus budget/state selects.
  const runHeroSearch = (val) => {
    const p = new URLSearchParams();
    const s = (val || '').trim();
    if (s)          p.set('q', s);
    if (heroBudget) p.set('max_price', heroBudget);
    if (heroState)  p.set('state', heroState);
    navigate(`/showroom${p.toString() ? `?${p}` : ''}`);
  };

  /* Stale-while-revalidate cache — only for the true default view (no filters,
     page 1, newest first): the most repeat-visited state, and small enough to
     be one cache key rather than one per filter combination. A background
     fetch always still runs and overwrites this the moment it lands — the
     cache only affects what paints before that first response arrives. */
  const CACHE_TTL = 30 * 60 * 1000; // 30 min
  const DEFAULT_GRID_CACHE_KEY = 'mp_default_grid_v1';
  const isDefaultView = !brand && !bodyType && !transmission && !state && !minPrice && !maxPrice &&
    !financing && !yearFrom && !yearTo && !q && !condition && !mileageMax && !hotDeals &&
    !fuelType && !colour && !sellerType && !model && !variant && sort === 'newest';
  const initialCache = isDefaultView ? readCache(DEFAULT_GRID_CACHE_KEY, CACHE_TTL) : null;
  // Consumed by the first fetchCars() call only — skips forcing the loading
  // skeleton over cars we already painted instantly from cache.
  const hadCacheOnMount = useRef(!!initialCache);

  /* Data state */
  const [cars, setCars]           = useState(() => initialCache?.cars || []);
  const [totalCount, setTotal]    = useState(() => initialCache?.totalCount || 0);
  const [loading, setLoading]     = useState(() => !initialCache);
  const [error, setError]         = useState(null);
  const [loadPage, setLoadPage]   = useState(1);

  /* Body-type carousels — lazy loaded when section enters viewport */
  const [bodyTypeCars, setBodyTypeCars] = useState({ Hatchback: [], Sedan: [], SUV: [], MPV: [] });
  const [bodyTypeLoading, setBodyTypeLoading] = useState(false);
  const carouselSectionRef = useRef(null);
  const carouselFetched = useRef(false);
  const heroSearchBarRef = useRef(null);

  /* Stats (fetched once) */
  const [stats, setStats] = useState({ listings: null, dealers: null, hotDeals: null });

  /* ── Analytics: fire store_visit once per session ── */
  useEffect(() => {
    const key = 'sv_fired_main';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackEvent(supabase, 'store_visit', { dealer_id: null, metadata: { source: 'organic' } });
  }, []);

  /* ── Fetch marketplace stats — single RPC instead of 3 queries (one of
     which downloaded up to 2000 rows just to count distinct dealers) ── */
  useEffect(() => {
    async function fetchStats() {
      const { data } = await supabase.rpc('get_marketplace_stats').maybeSingle();
      setStats({
        listings: data?.listings ?? 0,
        dealers: data?.dealers ?? 0,
        hotDeals: data?.hot_deals ?? 0,
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
            .from('public_car_listings')
            .select(CAR_FIELDS)
            .in('status', ['available', 'reserved'])
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
      }).catch(() => {
        setBodyTypeLoading(false);
      });
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Fetch cars (server-side, load-more) ── */
  const fetchCars = useCallback(async () => {
    // Consume the cache-hit flag once — the very first fetch after an instant
    // cached paint shouldn't flash the skeleton over cars already on screen.
    const usingCachedFallback = hadCacheOnMount.current;
    hadCacheOnMount.current = false;
    if (!usingCachedFallback) setLoading(true);
    setError(null);
    try {
      const from = (loadPage - 1) * PER_PAGE;
      const to   = from + PER_PAGE - 1;

      // Only run the exact COUNT on page 1. Every "load more" re-ran an exact
      // COUNT over the aggregate-heavy view, roughly doubling its cost per page;
      // the total result-set size doesn't change between pages, so page 1's
      // count stays valid for the whole scroll.
      let query = supabase
        .from('public_car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, loadPage === 1 ? { count: 'exact' } : undefined)
        .in('status', ['available', 'reserved']);

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
      if (model)      query = query.eq('model', model);
      if (variant)    query = query.ilike('variant', `%${variant}%`);

      if (sort === 'price_asc')  query = query.order('selling_price', { ascending: true });
      else if (sort === 'price_desc') query = query.order('selling_price', { ascending: false });
      else                        query = query.order('created_at',    { ascending: false });

      query = query.range(from, to);

      const { data, error: err, count } = await query;
      if (err) throw err;

      const rows = data || [];

      if (loadPage === 1) {
        const deduped = dedupe(rows);
        setCars(deduped);
        if (isDefaultView) {
          writeCache(DEFAULT_GRID_CACHE_KEY, { cars: deduped, totalCount: count || 0 });
          precacheImages(
            deduped.slice(0, 8).flatMap(c => Array.isArray(c.images) ? c.images.slice(0, 1) : []).filter(Boolean),
            'mp-images-v1',
          );
        }
      } else {
        setCars(prev => dedupe([...prev, ...rows]));
      }
      // count is only requested on page 1 (see above); don't clobber the total
      // with the null that later pages return, which would break the load-more
      // gate (cars.length >= totalCount).
      if (loadPage === 1) setTotal(count || 0);
    } catch (e) {
      console.error('[fetchCars]', e?.message || e?.code || e);
      // Already showing cached cars from a previous visit — keep them on
      // screen rather than covering them with an error banner.
      if (!usingCachedFallback) setError('Failed to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loadPage, brand, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType, model, variant, sort, isDefaultView]);

  /* Reset to page 1 whenever filter params change from outside (URL navigation) */
  useEffect(() => {
    setLoadPage(1);
  }, [brand, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType, model, variant, sort]); // eslint-disable-line

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  /* Load-more is manual (see the grid footer). Auto-load on scroll was removed:
     it grew the grid as you scrolled and pushed the footer down, so the footer
     kept running away from the user. One explicit "Load more", then "See all". */

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
    hotDeals     && { key: 'hot_deals',   label: 'Hot Deals' },
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
      padding: '0 clamp(20px, 4vw, 48px)',
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
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
      paddingBottom: '48px',
    },
    emptyState: {
      textAlign: 'center',
      padding: '80px 20px',
      gridColumn: '1 / -1',
      maxWidth: '100%',
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

  const pageTitle = (() => {
    if (hotDeals) return "Hot Deal Cars in Malaysia — Best Prices | XDrive";
    const parts = [];
    if (condition === 'recon') parts.push('Recon');
    else if (condition === 'local') parts.push('Local');
    if (brand) parts.push(brand);
    if (bodyType) parts.push(bodyType + 's');
    const carType = parts.length ? parts.join(' ') + ' ' : '';
    const loc = state ? ` in ${state}, Malaysia` : ' in Malaysia';
    return `Used ${carType}Cars for Sale${loc} | XDrive`;
  })();

  const pageDesc = (() => {
    const cnt = stats.listings ? `${stats.listings.toLocaleString()}+ ` : '';
    if (hotDeals) return `Find the best hot deal cars in Malaysia. Browse ${cnt}discounted used cars from verified dealers. Save thousands on Perodua, Proton, Honda, Toyota and more.`;
    const parts = [];
    if (condition === 'recon') parts.push('recon');
    else if (condition === 'local') parts.push('local');
    if (brand) parts.push(brand);
    if (bodyType) parts.push(bodyType.toLowerCase());
    const carType = parts.length ? parts.join(' ') + ' ' : '';
    const loc = state ? `${state}, Malaysia` : 'Malaysia';
    return `Browse ${cnt}${carType}cars for sale in ${loc}. Verified dealers, best prices on Perodua, Proton, Honda, Toyota and more.`;
  })();

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href="https://xdrive.my" />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://xdrive.my" />
        <meta property="og:locale"      content="en_MY" />
        <meta property="og:site_name"   content="XDrive" />
        <meta property="og:title"       content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image"       content="https://xdrive.my/og-marketplace.jpg" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image"       content="https://xdrive.my/og-marketplace.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "XDrive",
          "url": "https://xdrive.my",
          "description": "Malaysia's car marketplace. Buy and sell new, used, and recon cars from verified dealers.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://xdrive.my?q={search_term_string}"
            },
            "query-input": "required name=search_term_string"
          }
        })}</script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        /* ── Animations ── */
        @keyframes mp-shimmer     { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes mp-fade-up     { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mp-slide-right { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
        @keyframes mp-pulse-ring  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} }

        /* ── Utility ── */
        .mp-brand-scroll::-webkit-scrollbar { display:none }
        .mp-brand-pill:hover  { opacity:.85; transform:translateY(-1px) }

        /* Brand grid */
        .mp-brand-grid {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
          padding: 8px 0;
        }
        @media (max-width: 640px) {
          .mp-brand-grid { gap: 8px; }
        }
        .mp-reset-btn:hover   { color:#111827 !important; border-color:rgba(0,0,0,.25) !important }
        .mp-chip-x:hover      { opacity:.7 }
        .mp-select:focus      { border-color:rgba(220,38,38,.5) !important; box-shadow:0 0 0 3px rgba(220,38,38,.12) }
        .mp-filter-toggle:hover { background:rgba(0,0,0,.05) !important }
        .mp-next-prev:hover:not(:disabled) { background:rgba(0,0,0,.05) !important; color:#111827 !important }
        .mp-page-btn:hover    { background:rgba(0,0,0,.05) !important }
        .mp-pulse-dot         { width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;animation:mp-pulse-ring 2s ease-in-out infinite }
        .mp-anim-fade         { animation:mp-fade-up .6s cubic-bezier(.22,1,.36,1) both }
        .mp-anim-d1           { animation-delay:.1s }
        .mp-anim-d2           { animation-delay:.22s }
        .mp-anim-d3           { animation-delay:.34s }
        .mp-card-slide        { animation:mp-slide-right .5s cubic-bezier(.22,1,.36,1) both }
        .mp-sidebar::-webkit-scrollbar { width:3px }
        .mp-sidebar::-webkit-scrollbar-thumb { background:#d1d0cc;border-radius:2px }
        .mp-adv-modal::-webkit-scrollbar { width:4px }
        .mp-adv-modal::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15);border-radius:2px }

        /* Cars grid — showroom-style horizontal cards, two columns on desktop and
           a single column on phones (matches /showroom). */
        .mp-cars-grid > * { min-width: 0; }
        @media (max-width: 900px) { .mp-cars-grid { grid-template-columns: 1fr !important; } }

        /* ── Featured cards ── */
        .mp-feat-card { transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease }
        .mp-feat-card:hover { transform:translateY(-5px);border-color:rgba(220,38,38,.4) !important;box-shadow:0 16px 40px rgba(0,0,0,.14) }
        .mp-feat-img  { transition:transform .45s ease;width:100%;height:100%;object-fit:cover;display:block }
        .mp-feat-card:hover .mp-feat-img { transform:scale(1.06) }

        /* ── Listings search ── */
        .mp-search-outer { transition:border-color .2s,box-shadow .2s }
        .mp-search-outer:focus-within { border-color:rgba(220,38,38,.45) !important;box-shadow:0 4px 24px rgba(0,0,0,.1),0 0 0 3px rgba(220,38,38,.1) }
        .mp-search-btn:hover { background:#b91c1c !important }

        /* ════════════════════════════════════════
           HERO — MOBILE FIRST
           ════════════════════════════════════════ */
        .mp-hero-section {
          display: flex;
          flex-direction: column;
          background: #08090f;
          position: relative;
          overflow-x: hidden;
        }
        .mp-hero-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
          padding: 28px 16px 20px;
          position: relative;
          z-index: 1;
        }
        .mp-hero-left  { width: 100%; }
        .mp-hero-right { display: block; width: 100%; margin-top: 24px; }

        /* Tabs — scrollable on mobile */
        .mp-hero-tabs {
          display: flex;
          gap: 4px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 20px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          width: 100%;
        }
        .mp-hero-tabs::-webkit-scrollbar { display: none }

        /* Trust strip */
        .mp-trust-strip { padding: 16px 0; border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0; position: relative; z-index: 1; }
        .mp-trust-grid  { max-width: 1360px; margin: 0 auto; padding: 0 16px; display: grid; grid-template-columns: 1fr 1fr; row-gap: 14px; }
        /* Mobile: balanced 2x2 with content centered in each cell and a single
           divider down the middle (left-column cells only). */
        .mp-trust-item  { padding: 6px 10px; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .mp-trust-item:nth-child(odd) { border-right: 1px solid rgba(255,255,255,.08); }

        /* Budget cards */
        .mp-budget-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }
        .mp-budget-item { display: block; width: auto; text-decoration: none; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); transition: transform .2s ease, border-color .2s ease; }
        .mp-budget-item:hover { transform: translateY(-3px); border-color: rgba(220,38,38,.45) !important; }
        .mp-budget-icon { height: 52px; display: flex; align-items: center; justify-content: center; }

        /* Results layout — column on mobile */
        .mp-filter-fab      { display: none; }
        .mp-desktop-sidebar { display: none; }
        .mp-cars-layout     { flex-direction: column; }
        .mp-featured-strip  { grid-template-columns: 1fr 1fr; }

        /* ── Tablet ≥600px ── */
        @media(min-width:600px) {
          .mp-hero-main { padding: 36px 24px 24px; }
        }

        /* ── Desktop ≥900px ── */
        @media(min-width:900px) {
          .mp-hero-section  { height: calc(100vh - 64px); min-height: 0; overflow: hidden; }
          .mp-hero-main     { flex-direction: row; align-items: center; gap: clamp(32px,4vw,72px); max-width: 1360px; margin: 0 auto; padding: 0 clamp(20px,4vw,48px); }
          .mp-hero-left     { flex: 1; min-width: 0; width: auto; }
          .mp-hero-right    { flex: 1; min-width: 0; margin-top: 0; }
          .mp-hero-tabs     { width: fit-content; overflow-x: visible; }
          .mp-trust-strip   { padding: 20px 0; }
          .mp-trust-grid    { grid-template-columns: repeat(4,1fr); padding: 0 clamp(20px,4vw,48px); row-gap: 0; }
          .mp-trust-item    { padding: 0 28px; }
          /* Desktop: dividers between all four (last cell has none). */
          .mp-trust-item:nth-child(even):not(:last-child) { border-right: 1px solid rgba(255,255,255,.08); }
          .mp-budget-grid   { gap: 10px; }
          .mp-budget-icon   { height: 80px; }
          .mp-filter-fab    { display: flex; }
          .mp-cars-layout   { flex-direction: row; }
        }

        /* ── Large desktop ≥1024px ── */
        @media(min-width:1024px) {
          .mp-filter-fab      { display: none; }
          .mp-desktop-sidebar { display: flex !important; }
        }

        /* ── Listings search bar collapse on small screens ── */
        @media(max-width:640px) {
          .mp-search-outer { flex-direction:column !important;border-radius:16px !important; }
          .mp-search-field { border-right:none !important;border-bottom:1px solid rgba(0,0,0,.08) !important;padding:12px 18px !important; }
          .mp-search-btn   { padding:14px !important;justify-content:center;border-radius:0 0 14px 14px !important; }
          .mp-featured-strip { grid-template-columns:1fr !important; }
        }
      `}</style>

      <MarketplaceHeader />
      <GoogleOneTap />

      <AdvancedSearchModal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        heroQ={heroQ}
        heroBudget={heroBudget}
        onApply={(p) => navigate(`/showroom${p.toString() ? '?' + p : ''}`)}
      />

      <main style={S.page}>
        {/* ── Hero ── */}
        <section className="mp-hero-section" style={{ background:'#08090f', position:'relative', isolation:'isolate' }}>

          {/* BG grid — z-index:-1 keeps it behind all content within this stacking context */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize:'80px 80px', pointerEvents:'none', zIndex:-1 }}/>
          {/* Red glow */}
          <div style={{ position:'absolute', top:'-200px', left:'50%', transform:'translateX(-50%)', width:'900px', height:'700px', background:'radial-gradient(ellipse at 50% 30%,rgba(220,38,38,0.12) 0%,transparent 60%)', pointerEvents:'none', zIndex:-1 }}/>

          {/* Two-column hero content */}
          <div className="mp-hero-main">

            {/* LEFT: headline + subtitle + tabs + search */}
            <div className="mp-hero-left">
              <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", margin:'0 0 14px', lineHeight:'0.92', letterSpacing:'-0.01em', fontSize:'clamp(38px,10vw,96px)', color:'#ffffff' }}>
                FIND YOUR NEXT<br/><span style={{ color:'#dc2626' }}>CAR IN MALAYSIA</span>
              </h1>

              <p style={{ fontSize:'clamp(13px,3.5vw,15px)', color:'rgba(255,255,255,0.6)', margin:'0 0 24px', lineHeight:'1.7', fontFamily:"'Outfit',sans-serif", maxWidth:'420px' }}>
                New &middot; Used &middot; Recon &mdash; Verified Dealers, Full Docs, Zero Phantom Listings.
              </p>

              {/* Tabs */}
              <div className="mp-hero-tabs">
                {[
                  { label:'Find a Car', action:() => setHeroTab(0) },
                  { label:'Browse Hot Deals', action:() => { setHeroTab(1); setParam('hot_deals','true'); document.getElementById('mp-results')?.scrollIntoView({ behavior:'smooth', block:'start' }); } },
                  { label:'Finance Calculator', action:() => { setHeroTab(2); navigate('/calculator'); } },
                ].map(({ label, action }, i) => (
                  <button
                    key={label}
                    onClick={() => action()}
                    style={{
                      padding:'8px 16px', borderRadius:'9px', fontSize:'12px', fontWeight:'600',
                      fontFamily:"'Outfit',sans-serif", cursor:'pointer', border:'none',
                      background: heroTab === i ? '#dc2626' : 'transparent',
                      color: heroTab === i ? '#fff' : 'rgba(255,255,255,0.5)',
                      transition:'all 0.2s', whiteSpace:'nowrap',
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Search bar — no wrapping <form> (SearchAutocomplete has its own;
                  nested forms broke navigation). Each entry point navigates via runHeroSearch. */}
              <div>
                <div ref={heroSearchBarRef} style={{ display:'flex', alignItems:'stretch', gap:'5px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'14px', padding:'5px', marginBottom:'10px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <SearchAutocomplete
                      dark
                      value={heroQ}
                      onChange={setHeroQ}
                      placeholder="Search make, model or variant…"
                      navigateTo="/showroom"
                      onSubmit={val => runHeroSearch(val)}
                      inputStyle={{ padding:'11px 14px', fontSize:'14px' }}
                      anchorRef={heroSearchBarRef}
                    />
                  </div>
                  <button type="button" onClick={() => runHeroSearch(heroQ)}
                    style={{ flexShrink:0, background:'#dc2626', color:'#fff', border:'none', padding:'0 22px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', gap:'6px', borderRadius:'10px' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#b91c1c'}
                    onMouseLeave={e=>e.currentTarget.style.background='#dc2626'}
                  ><Search size={14}/> Find Cars</button>
                </div>

                <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <div style={{ position:'relative', display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', overflow:'hidden' }}>
                    <select value={heroBudget} onChange={e=>setHeroBudget(e.target.value)} aria-label="Budget"
                      style={{ border:'none', outline:'none', padding:'8px 26px 8px 12px', fontSize:'12px', color:heroBudget?'#fff':'rgba(255,255,255,0.36)', background:'transparent', fontFamily:"'Outfit',sans-serif", cursor:'pointer', appearance:'none' }}>
                      <option value="" style={{ background:'#0d1117' }}>Any budget</option>
                      {PRICE_STEPS.filter(s=>s.value).map(o => <option key={o.value} value={o.value} style={{ background:'#0d1117' }}>{o.label}</option>)}
                    </select>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:9, pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
                  </div>
                  <div style={{ position:'relative', display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', overflow:'hidden' }}>
                    <select value={heroState} onChange={e=>setHeroState(e.target.value)} aria-label="State"
                      style={{ border:'none', outline:'none', padding:'8px 26px 8px 12px', fontSize:'12px', color:heroState?'#fff':'rgba(255,255,255,0.36)', background:'transparent', fontFamily:"'Outfit',sans-serif", cursor:'pointer', appearance:'none' }}>
                      <option value="" style={{ background:'#0d1117' }}>Any state</option>
                      {MY_STATES.map(s => <option key={s} value={s} style={{ background:'#0d1117' }}>{s}</option>)}
                    </select>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:9, pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
                  </div>
                  <button type="button" onClick={() => setAdvancedOpen(true)}
                    style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'8px 12px', color:'rgba(255,255,255,0.4)', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
                    <SlidersHorizontal size={11}/> More filters
                  </button>
                </div>

                <p style={{ display:'flex', alignItems:'center', gap:'6px', margin:'14px 0 0', fontSize:'11px', color:'rgba(255,255,255,0.4)', fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>
                  <ShieldCheck size={13} color="#dc2626" style={{ flexShrink:0 }} />
                  Every listing verified. Every dealer certified. Zero phantom listings.
                </p>
              </div>
            </div>

            {/* RIGHT: Browse by Budget */}
            <div className="mp-hero-right">
              <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.16em', color:'rgba(220,38,38,0.8)', fontFamily:"'Outfit',sans-serif" }}>Shop Smarter</p>
              <h2 style={{ margin:'0 0 16px', fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(26px,3vw,44px)', color:'#ffffff', letterSpacing:'0.02em', lineHeight:1 }}>BROWSE BY BUDGET</h2>
              <div className="mp-budget-grid">
                {[
                  { big:'RM 30K',  sub:'& under', value:'30000',  color:'#9ca3af', bg:'rgba(148,163,184,0.08)' },
                  { big:'RM 50K',  sub:'& under', value:'50000',  color:'#cbd5e1', bg:'rgba(203,213,225,0.08)' },
                  { big:'RM 80K',  sub:'& under', value:'80000',  color:'#e2e8f0', bg:'rgba(226,232,240,0.08)' },
                  { big:'RM 120K', sub:'& under', value:'120000', color:'#fca5a5', bg:'rgba(220,38,38,0.10)'   },
                  { big:'RM 200K', sub:'& under', value:'200000', color:'#f87171', bg:'rgba(220,38,38,0.16)'   },
                  { big:'ALL',     sub:'Any price', value:'',     color:'#ffffff', bg:'rgba(255,255,255,0.08)' },
                ].map(({ big, sub, value, color, bg }) => (
                  <Link key={big} to={value ? `/showroom?max_price=${value}` : '/showroom'} className="mp-budget-item">
                    <div className="mp-budget-icon" style={{ background: bg }}>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(18px,2.4vw,26px)', lineHeight:1, letterSpacing:'0.02em', color }}>{big}</span>
                    </div>
                    <div style={{ padding:'6px 8px 8px' }}>
                      <span style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,0.5)', fontFamily:"'Outfit',sans-serif", textTransform:'uppercase', letterSpacing:'0.06em' }}>{sub}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* ── Trust strip — bottom of hero. This is the page's entire differentiator
                (verified/safe marketplace), so it gets real visual weight here instead
                of living as small type — real stats where we have them (listings,
                dealers), the two hard guarantees otherwise. No per-card "Verified"
                badge — there's no per-listing verification flag in the data yet, and
                stamping every card identically would be a badge with no information
                behind it. ── */}
          <div className="mp-trust-strip">
            <div className="mp-trust-grid">
              {[
                { icon: Car,         number: stats.listings != null ? stats.listings.toLocaleString() + '+' : '—', label:'Cars listed' },
                { icon: ShieldCheck, number: stats.dealers  != null ? stats.dealers + '+'                  : '—', label:'Verified dealers' },
                { icon: FileCheck2,  number:'100%', label:'Docs required' },
                { icon: Ban,         number:'0', label:'Phantom listings' },
              ].map(({ icon: Icon, number, label }) => (
                <div key={label} className="mp-trust-item">
                  <div style={{ width:34, height:34, borderRadius:9, background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Icon size={16} color="#f87171" />
                  </div>
                  <div>
                    <div style={{ fontSize:'clamp(17px,3.4vw,24px)', fontWeight:'500', color:'#ffffff', lineHeight:1, marginBottom:'2px', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.02em' }}>{number}</div>
                    <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:"'Outfit',sans-serif" }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Seam accent — the hero is intentionally dark (brand statement) and the body
            intentionally light (browsing surface, per DESIGN.md); the hard cut between
            them read as two stapled-together templates rather than one product. A
            single brand-red line ties them together without touching either palette. */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #dc2626, transparent)' }} />

        {/* ── Quick-filter strip ── */}
        <section style={{ background: '#F7F6F2', padding: '20px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)' }}>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: '2px' }}>
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
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' }}>{groupLabel}</span>
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
        <section ref={carouselSectionRef} style={{ background: '#EDEAE3', padding: '48px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <style>{`
            .btc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px 28px; }
            .btc-scroll::-webkit-scrollbar { display: none; }
            @media (max-width: 768px) {
              .btc-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
              .btc-inner { padding: 0 8px !important; }
            }
          `}</style>
          <div className="btc-inner" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)' }}>
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
          <div className="mp-cars-layout" style={{ display:'flex', gap:'28px', alignItems:'flex-start', paddingTop:'40px' }}>

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
                  <label htmlFor="sort-select" style={{ fontSize:'14px', color:'#374151', whiteSpace:'nowrap' }}>Sort by</label>
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
                <div className="mp-cars-grid" style={S.carsGrid}>
                  {loading && loadPage === 1
                    ? Array.from({ length: PER_PAGE }).map((_, i) => <ShowroomCardSkeleton key={i} />)
                    : cars.length === 0
                      ? (
                        <div style={S.emptyState}>
                          <Car size={56} color="#374151" style={{ marginBottom:'20px' }} />
                          <p style={{ color:'#6b7280', fontSize:'19px', fontWeight:'600', marginBottom:'12px' }}>No cars match your filters</p>
                          <p style={{ color:'#4b5563', fontSize:'16px', marginBottom:'28px' }}>Try adjusting your search or browse all available cars.</p>
                          <button onClick={resetAll} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'14px 32px', borderRadius:'10px', fontSize:'16px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Browse All Cars</button>
                        </div>
                      )
                      : cars.map((car, i) => {
                          const inCompare = isInCompare(car.id);
                          const compareFull = compareIds.length >= 4 && !inCompare;
                          // ShowroomCard renders its own seller (Agent/Dealer) badge and
                          // compare control, so no wrapping overlays are needed here.
                          return (
                            <ShowroomCard
                              key={car.id}
                              car={car}
                              ctaContext={ctaCtx}
                              inCompare={inCompare}
                              compareFull={compareFull}
                              onCompare={() => { inCompare ? removeFromCompare(car.id) : addToCompare(car.id); }}
                              priority={i === 0}
                            />
                          );
                        })
                  }
                </div>
              )}

              {/* Loading indicator while a manual "Load more" is in flight */}
              {loading && loadPage > 1 && (
                <div style={{ textAlign:'center', padding:'24px 0', fontFamily:"'Outfit',sans-serif", fontSize:'13px', color:'#9ca3af' }}>
                  Loading more…
                </div>
              )}

              {/* Two-stage manual control (no auto-load): "Load more" once, then
                  "See all" -> Showroom. Keeps the footer reachable and stops the
                  grid from creeping down as you scroll. */}
              {!loading && !error && cars.length > 0 && cars.length < totalCount && (
                <div style={{ textAlign:'center', padding:'32px 0 60px' }}>
                  {loadPage < 2 ? (
                    <button
                      onClick={() => setLoadPage(p => p + 1)}
                      style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'#fff', border:'1.5px solid #dc2626', color:'#dc2626', fontSize:'14px', fontWeight:'700', padding:'12px 30px', borderRadius:'50px', cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'all 0.15s' }}
                      onMouseEnter={e=>{ e.currentTarget.style.background='#fef2f2'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; }}
                    >
                      Load more cars <ChevronDown size={16}/>
                    </button>
                  ) : (
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
                      See all {totalCount.toLocaleString()} cars <ArrowRight size={14}/>
                    </button>
                  )}
                  <p style={{ marginTop:'10px', color:'#9ca3af', fontSize:'12px', fontFamily:"'Outfit',sans-serif" }}>Showing {cars.length} of {totalCount.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <MarketplaceFooter />
    </>
  );
}
