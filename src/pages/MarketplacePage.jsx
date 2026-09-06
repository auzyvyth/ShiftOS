import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet';
import { RotateCcw, Car, Users, SlidersHorizontal, Search, ArrowLeftRight, ArrowRight, X, ShieldCheck, FileCheck2, Ban, ChevronDown, Check } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import MarketplaceFooter from '../components/MarketplaceFooter';
import ShowroomCard, { ShowroomCardSkeleton } from '@/components/ShowroomCard';
import MarketplaceHeader from '../components/MarketplaceHeader';
import GoogleOneTapSlot from '../components/GoogleOneTapSlot';
import { useCTAContext } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { chassisSearch } from '../utils/chassisCodes';
import { readCache, writeCache, precacheImages } from '../utils/localCache';
import { PRICE_STEPS } from '../components/PriceDrumPicker';
import SearchAutocomplete from '../components/SearchAutocomplete';
import BodyTypeCarousel from '../components/marketplace/BodyTypeCarousel';
import HeroCarRow from '../components/marketplace/HeroCarRow';
import AdvancedSearchModal from '../components/marketplace/AdvancedSearchModal';
import SkeletonCard from '../components/ui/SkeletonCard';
import useMarketplaceStats from '../hooks/useMarketplaceStats';
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

/* Trimmed field list for the hero rows (photo + price only, above-the-fold
   critical path) — the full CAR_FIELDS (29 cols) is for detail-heavy grids,
   not warranted here. */
const HERO_ROW_FIELDS = 'id,slug,listing_title,brand,model,variant,year,selling_price,original_price,images,created_at';

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
  const [heroTab, setHeroTab] = useState('find');

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

  /* Stats (fetched once, shared with the header and footer through a module
     cache, so the three of them run ONE get_marketplace_stats between them). */
  const { stats } = useMarketplaceStats();

  /* ── Analytics: fire store_visit once per session ── */
  useEffect(() => {
    const key = 'sv_fired_main';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackEvent(supabase, 'store_visit', { dealer_id: null, metadata: { source: 'organic' } });
  }, []);

  /* ── Hero rows: "All Cars"/"Hot Deals" + "MPV" — fetched eagerly on mount
     (unlike bodyTypeCars below, this is above the fold and must be visible
     on first paint, not lazy-loaded on scroll). ── */
  const [row1Pool, setRow1Pool] = useState([]);
  const [row1Mode, setRow1Mode] = useState('all'); // 'all' | 'hot'
  const [row2Pool, setRow2Pool] = useState([]);

  useEffect(() => {
    supabase.from('public_car_listings')
      .select(HERO_ROW_FIELDS)
      .in('status', ['available', 'reserved'])
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setRow1Pool(data || []));

    supabase.from('public_car_listings')
      .select(HERO_ROW_FIELDS)
      .in('status', ['available', 'reserved'])
      .eq('body_type', 'MPV')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setRow2Pool(data || []));
  }, []);

  /* Row 1 upgrades to "Hot Deals" the moment any exist. Still gated on the
     actual fetched rows (not just stats.hotDeals > 0) so the title can never
     flip to "Hot Deals" over an empty row. The >= 3% discount rule now lives
     in the is_hot_deal column (migration 20260831h) instead of being
     re-implemented here — the client only sorts. */
  useEffect(() => {
    if (!(stats.hotDeals > 0)) return;
    supabase.from('public_car_listings')
      .select(HERO_ROW_FIELDS)
      .in('status', ['available', 'reserved'])
      .eq('is_hot_deal', true)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const discountPct = (c) => (c.original_price - c.selling_price) / c.original_price;
        const hot = (data || [])
          .sort((a, b) => discountPct(b) - discountPct(a))
          .slice(0, 12);
        if (hot.length > 0) {
          setRow1Pool(hot);
          setRow1Mode('hot');
        }
      });
  }, [stats.hotDeals]);

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
          // Strip LIKE wildcards (% _ \) AND PostgREST filter delimiters ( , ( ) )
          // so a search token can't corrupt the .or() filter tree below.
          const s = t.replace(/[%_\\(),]/g, '');
          if (!s) return;
          // Match the token across name AND the free-text spec fields, so buyers
          // can search by feature ("bucket seats", "sunroof", "carbon pack") not
          // just brand/model/variant — the columns already hold this data.
          const parts = [
            `brand.ilike.%${s}%`, `model.ilike.%${s}%`, `variant.ilike.%${s}%`,
            `options.ilike.%${s}%`, `features.ilike.%${s}%`, `specs.ilike.%${s}%`,
          ];
          // If the token is a known chassis code (e.g. "g82"), also match the
          // brand+model it denotes — we don't store the code, so this expands the
          // query to the actual cars. and(...) keeps it precise (BMW AND an M4).
          const cc = chassisSearch(s);
          if (cc) {
            const ors = cc.models.flatMap(m => [`model.ilike.%${m}%`, `variant.ilike.%${m}%`]);
            parts.push(`and(brand.ilike.%${cc.brand}%,or(${ors.join(',')}))`);
          }
          query = query.or(parts.join(','));
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
      // is_hot_deal is a column on public_car_listings (migration 20260831h) --
      // the ONE definition, shared with the hero row below and with
      // get_marketplace_stats. It used to be `original_price > 0` here, which
      // called every car with a recorded list price a deal.
      if (hotDeals)     query = query.eq('is_hot_deal', true);
      if (condition)    query = query.eq('condition', condition);
      if (transmission) {
        const txVal = transmission === 'Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT'];
        query = query.in('transmission', txVal);
      }
      if (fuelType)   query = query.eq('fuel_type', fuelType);
      if (colour)     query = query.ilike('colour', `%${colour}%`);
      if (model)      query = query.eq('model', model);
      if (variant)    query = query.ilike('variant', `%${variant}%`);
      // seller_role comes from public_car_listings (the listing owner's profile
      // role). Mirror ShowroomCard's badge rule exactly — role 'salesman' reads
      // as "Agent", everything else as "Dealer" — so the filter and the badge
      // can never disagree about what a card is.
      if (sellerType === 'agent')  query = query.eq('seller_role', 'salesman');
      else if (sellerType === 'dealer') query = query.neq('seller_role', 'salesman');

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
        <meta property="og:image"       content="https://xdrive.my/og-default.jpg" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image"       content="https://xdrive.my/og-default.jpg" />
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
        {/* No font <link> here — index.html already preconnects and loads
            Bebas Neue + Outfit (300-900) asynchronously. A second stylesheet
            link in Helmet re-requests the same fonts and blocks render while
            it resolves. */}
      </Helmet>

      <style>{`
        /* ── Animations ── */
        @keyframes mp-shimmer     { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes mp-fade-up     { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mp-slide-right { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
        @keyframes mp-pulse-ring  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} }

        /* ── Utility ── */
        /* .mp-brand-grid / .mp-brand-pill / .mp-brand-scroll lived here for a
           brand strip that no longer renders; nothing carried those classes.
           Removed with the footer's dead /showroom#brands link. */
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

        /* ── Hero search bar — mobile-first: stacked column so the input gets
              full width for its placeholder instead of being squeezed next to
              the "Find Cars" button and clipping. Row layout returns at the
              ≥900px hero breakpoint below. ── */
        .mp-hero-search { flex-direction:column; }
        .mp-hero-search > button { width:100%; justify-content:center; padding:14px 22px; }

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

        /* Hero car rows (replaces the old "Browse by Budget" grid) */
        /* Three sets sit side by side in one transformed group so advancing
           slides rather than swaps. The current layer is in flow so it drives
           the stage height; its neighbours are absolute at ±100%. */
        .mp-carrow-stage { position: relative; overflow: hidden; touch-action: pan-y; }
        .mp-carrow-group { position: relative; transition-property: transform; transition-timing-function: cubic-bezier(.22,.61,.36,1); will-change: transform; }
        .mp-carrow-layer { width: 100%; }
        .mp-carrow-curr  { position: relative; }
        .mp-carrow-prev  { position: absolute; top: 0; left: -100%; }
        .mp-carrow-next  { position: absolute; top: 0; left: 100%; }
        .mp-carrow-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }
        .mp-carrow-item { display: block; text-decoration: none; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); transition: transform .2s ease, border-color .2s ease; }
        .mp-carrow-item:hover { transform: translateY(-3px); border-color: rgba(220,38,38,.45); }
        .mp-carrow-img { height: 52px; background-size: cover; background-position: center; background-color: rgba(255,255,255,0.04); }
        .mp-carrow-price { display: block; padding: 6px 8px 8px; font-size: 11px; font-weight: 700; color: #fff; font-family: 'Outfit',sans-serif; }
        .mp-carrow-progress { position: absolute; opacity: 0; width: 0; animation-name: mp-carrow-fill; animation-timing-function: linear; animation-fill-mode: forwards; }
        @keyframes mp-carrow-fill { from { width: 0; } to { width: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .mp-carrow-group { transition-duration: 0ms !important; }
        }

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
          .mp-carrow-grid   { gap: 10px; }
          .mp-carrow-img    { height: 80px; }
          .mp-filter-fab    { display: flex; }
          .mp-cars-layout   { flex-direction: row; }
          .mp-hero-search   { flex-direction: row; }
          /* Row layout starts here but the hero column is still narrow at the
             low end (900-1024px) - a wide fixed padding squeezes the input
             down to a few characters. Moderate width here, fuller width once
             there's more room at the 1024px breakpoint below. */
          .mp-hero-search > button { width: auto; padding: 14px 44px; }
        }

        /* ── Large desktop ≥1024px ── */
        @media(min-width:1024px) {
          .mp-hero-search > button { padding: 14px 64px; }
          .mp-filter-fab      { display: none; }
          .mp-desktop-sidebar { display: flex !important; }
        }

        @media(max-width:640px) {
          .mp-featured-strip { grid-template-columns:1fr !important; }
        }

        /* ── Agent band — the only seller-facing block on the buyer page.
              Sits below the results so it never competes with the search. ── */
        .mp-agent-band {
          background:#EDEAE3;
          border-top:1px solid rgba(0,0,0,0.06);
          padding:48px 0;
        }
        .mp-agent-wrap {
          max-width:1360px; margin:0 auto;
          padding:0 clamp(20px, 4vw, 48px);
          display:flex; align-items:center; justify-content:space-between;
          gap:32px; flex-wrap:wrap;
        }
        .mp-agent-copy   { flex:1 1 420px; min-width:0; }
        .mp-agent-eyebrow{
          font-family:'Outfit',sans-serif; font-size:11px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.14em; color:#dc2626; margin:0 0 8px;
        }
        .mp-agent-h {
          font-family:'Bebas Neue',sans-serif; font-weight:700; font-size:clamp(22px,3vw,44px);
          line-height:1.0; letter-spacing:0.02em; color:#111827; margin:0 0 10px;
        }
        .mp-agent-sub {
          font-family:'Outfit',sans-serif; font-size:15px; font-weight:400;
          line-height:1.5; color:#4b5563; margin:0; max-width:56ch;
        }
        .mp-agent-actions{ flex:0 0 auto; display:flex; flex-direction:column; gap:10px; }
        .mp-agent-cta {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          background:#dc2626; color:#fff; text-decoration:none;
          font-family:'Outfit',sans-serif; font-size:14px; font-weight:700;
          padding:13px 32px; border-radius:50px; white-space:nowrap;
          transition:background 0.15s ease;
        }
        .mp-agent-cta:hover { background:#b91c1c; }
        .mp-agent-trust {
          display:flex; gap:16px; flex-wrap:wrap; justify-content:center;
          font-family:'Outfit',sans-serif; font-size:12px; color:#6b7280; margin:0;
        }
        .mp-agent-trust span { display:inline-flex; align-items:center; gap:5px; }
        @media(max-width:720px) {
          .mp-agent-band    { padding:40px 0; }
          .mp-agent-wrap    { flex-direction:column; align-items:flex-start; justify-content:flex-start; gap:20px; }
          /* flex:1 1 420px on .mp-agent-copy sets a 420px *width* basis for the
             desktop row layout — once the wrap flips to column, flex-basis
             follows the main axis and that 420px becomes a forced *height*,
             leaving a huge empty gap below the copy before the CTA button. */
          .mp-agent-copy    { flex:1 1 auto; }
          .mp-agent-actions { width:100%; }
          .mp-agent-cta     { width:100%; }
          .mp-agent-trust   { justify-content:flex-start; }
        }
      `}</style>

      <MarketplaceHeader />
      <GoogleOneTapSlot />

      <AdvancedSearchModal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        heroQ={heroQ}
        heroBudget={heroBudget}
        currentParams={searchParams}
        onApply={(p) => navigate(`/showroom${p.toString() ? '?' + p : ''}`)}
      />

      <main id="main-content" tabIndex={-1} style={S.page}>
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

              {/* Tabs — "Browse Hot Deals" is hidden while there are no hot
                  deals to browse. It set hot_deals=true and scrolled to the
                  grid, so with an empty shelf every tap landed the visitor on
                  "No cars match your filters" — an advertised dead end on the
                  first screen. Tabs carry explicit ids rather than map indexes
                  so hiding one can't shift another's active state. */}
              <div className="mp-hero-tabs">
                {[
                  { id:'find', label:'Find a Car', action:() => setHeroTab('find') },
                  stats.hotDeals > 0 && { id:'hot', label:'Browse Hot Deals', action:() => { setHeroTab('hot'); setParam('hot_deals','true'); document.getElementById('mp-results')?.scrollIntoView({ behavior:'smooth', block:'start' }); } },
                  { id:'calc', label:'Finance Calculator', action:() => { setHeroTab('calc'); navigate('/calculator'); } },
                ].filter(Boolean).map(({ id, label, action }) => (
                  <button
                    key={id}
                    onClick={() => action()}
                    style={{
                      padding:'8px 16px', borderRadius:'9px', fontSize:'12px', fontWeight:'600',
                      fontFamily:"'Outfit',sans-serif", cursor:'pointer', border:'none',
                      background: heroTab === id ? '#dc2626' : 'transparent',
                      color: heroTab === id ? '#fff' : 'rgba(255,255,255,0.5)',
                      transition:'all 0.2s', whiteSpace:'nowrap',
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Search bar — no wrapping <form> (SearchAutocomplete has its own;
                  nested forms broke navigation). Each entry point navigates via runHeroSearch. */}
              <div>
                <div ref={heroSearchBarRef} className="mp-hero-search" style={{ display:'flex', alignItems:'stretch', gap:'5px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'14px', padding:'5px', marginBottom:'10px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <SearchAutocomplete
                      dark
                      value={heroQ}
                      onChange={setHeroQ}
                      placeholder="Make, model or variant…"
                      navigateTo="/showroom"
                      onSubmit={val => runHeroSearch(val)}
                      inputStyle={{ padding:'11px 14px', fontSize:'14px' }}
                      anchorRef={heroSearchBarRef}
                    />
                  </div>
                  <button type="button" onClick={() => runHeroSearch(heroQ)}
                    style={{ flexShrink:0, background:'#dc2626', color:'#fff', border:'none', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', borderRadius:'10px' }}
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

            {/* RIGHT: live inventory rows — proof of real, moving stock reads as
                more trustworthy than a static price-shortcut grid (the budget
                <select> in the search bar above already covers that filter). */}
            <div className="mp-hero-right">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCarRow
                  eyebrow="Shop Smarter"
                  title={row1Mode === 'hot' ? 'HOT DEALS' : 'ALL CARS'}
                  cars={row1Pool}
                  viewAllHref={row1Mode === 'hot' ? '/showroom?hot_deals=true' : '/showroom'}
                />
                <HeroCarRow
                  eyebrow="Popular in Malaysia"
                  title="MPV"
                  cars={row2Pool}
                  viewAllHref="/showroom?body_type=MPV"
                />
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

      {/* ── Agent band ──────────────────────────────────────────────────────
          The marketplace had no route to Salesman Lite anywhere in its body —
          every loud CTA pointed at the RM299 dealer plan, so the free product
          we actually market was invisible on our highest-traffic page. Placed
          below the results deliberately: the buyer's job is done by the time
          they reach it, so it recruits sellers without taxing the search. */}
      <section className="mp-agent-band">
        <div className="mp-agent-wrap">
          <div className="mp-agent-copy">
            <p className="mp-agent-eyebrow">For car agents</p>
            <h2 className="mp-agent-h">Sell cars for a living? List yours here, free.</h2>
            <p className="mp-agent-sub">
              Get your own XDrive page — every car you have, one link you can send a buyer,
              with a WhatsApp button on each listing. No fees, no credit card.
            </p>
          </div>
          <div className="mp-agent-actions">
            {/* Deliberately un-instrumented: analytics_events.event_type has a
                CHECK that would silently reject a new 'agent_band_cta' value,
                and tagging the link ?src= would overwrite the visitor's real
                acquisition channel (refTracking.js:17 — an explicit src wins).
                Measuring this band needs its own CHECK migration. */}
            <Link to="/for-salesmen" className="mp-agent-cta">
              Get your free page <ArrowRight size={15} />
            </Link>
            <p className="mp-agent-trust">
              <span><Check size={13} /> Free forever</span>
              <span><Check size={13} /> No credit card</span>
            </p>
          </div>
        </div>
      </section>

      <MarketplaceFooter />
    </>
  );
}
