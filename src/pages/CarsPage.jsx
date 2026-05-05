import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { setRef, trackEvent } from '../lib/analytics';
import { trackEvent as trackAnalyticsEvent, getSlugFromURL } from '../utils/analytics';
import { captureRef, getRef } from '../utils/refTracking';
import {
  RotateCcw, ChevronDown, Search, SlidersHorizontal, X,
  ChevronUp, Flame, Car, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import CarCard from '@/components/CarCard';
import { supabase } from '../supabaseClient';
import { useSiteProfile } from '../hooks/useSiteProfile';
import useTenant, { isSubdomain } from '../hooks/useTenant';
import { useCTAContext } from '../hooks/useCTAContext';

/* ─────────────────────────────────────────
   PRICE BRACKETS
───────────────────────────────────────── */
const PRICE_BRACKETS = [
  { label: 'Under RM 50k',   min: 0,       max: 50000   },
  { label: 'RM 50k–100k',    min: 50000,   max: 100000  },
  { label: 'RM 100k–200k',   min: 100000,  max: 200000  },
  { label: 'RM 200k–500k',   min: 200000,  max: 500000  },
  { label: 'Above RM 500k',  min: 500000,  max: Infinity },
];

const BODY_TYPES    = ['Sedan','SUV','MPV','Hatchback','Coupe','Pickup'];
const TRANSMISSIONS = ['Automatic','Manual'];
const FUEL_TYPES    = ['Petrol','Diesel','Hybrid','Electric'];

/* ─────────────────────────────────────────
   TINY REUSABLE BITS
───────────────────────────────────────── */
const ActiveTag = ({ label, onRemove }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', gap:'4px',
    background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.25)',
    color:'#f87171', fontSize:'11px', fontWeight:'600',
    padding:'4px 10px', borderRadius:'20px',
  }}>
    {label}
    <button onClick={onRemove} style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', padding:0, display:'flex', alignItems:'center' }}>
      <X size={10}/>
    </button>
  </span>
);

/* Collapsible filter section */
const FilterSection = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom: open ? '16px' : '0', marginBottom:'4px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'none', border:'none', cursor:'pointer',
          padding:'14px 0 10px', color:'white', fontSize:'12px', fontWeight:'700',
          textTransform:'uppercase', letterSpacing:'0.1em',
          fontFamily:"'DM Sans',sans-serif",
        }}
      >
        {title}
        {open ? <ChevronUp size={13} style={{ color:'#6b7280' }}/> : <ChevronDown size={13} style={{ color:'#6b7280' }}/>}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
};

/* Chip button for multi-select filters */
const Chip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display:'inline-flex', alignItems:'center', gap:'4px',
      background: active ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
      border: active ? '1px solid rgba(220,38,38,0.4)' : '1px solid rgba(255,255,255,0.08)',
      color: active ? '#f87171' : '#9ca3af',
      fontSize:'12px', fontWeight: active ? '700' : '500',
      padding:'6px 12px', borderRadius:'8px', cursor:'pointer',
      transition:'all 0.15s ease',
      fontFamily:"'DM Sans',sans-serif",
    }}
  >
    {active && <Check size={10}/>}
    {label}
  </button>
);

/* Native select styled dark */
const DarkSelect = ({ value, onChange, options, placeholder }) => (
  <div style={{ position:'relative' }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width:'100%', background:'rgba(255,255,255,0.04)',
        border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px',
        padding:'9px 32px 9px 12px', color: value ? 'white' : '#6b7280',
        fontSize:'12px', fontWeight:'500',
        appearance:'none', WebkitAppearance:'none',
        cursor:'pointer', outline:'none',
        fontFamily:"'DM Sans',sans-serif",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o} style={{ background:'#0d1117', color:'white' }}>{o}</option>)}
    </select>
    <ChevronDown size={12} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#6b7280', pointerEvents:'none' }}/>
  </div>
);

/* ─────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────── */
const SkeletonCard = () => (
  <div style={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
    <div style={{ height:'190px', background:'linear-gradient(90deg,#111827 25%,#1f2937 50%,#111827 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }}/>
    <div style={{ padding:'16px' }}>
      {[75,55,90,100].map((w,i) => (
        <div key={i} style={{ height:'11px', width:`${w}%`, background:'#1f2937', borderRadius:'6px', marginBottom:'9px', animation:'shimmer 1.5s infinite' }}/>
      ))}
    </div>
  </div>
);

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
const CarsPage = () => {
  const { t } = useTranslation();
  const { siteName } = useSiteProfile();
  const { tenant, loading: tenantLoading } = useTenant();
  const ctaCtx = useCTAContext();
  const location = useLocation();
  const drawerRef    = useRef(null);
  const searchRef    = useRef(null);
  const headerBarRef = useRef(null);
  const lastScrollY  = useRef(0);
  const [searchBarVisible, setSearchBarVisible] = useState(true);

  const [allCars,      setAllCars]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(null);
  const [displayCount, setDisplayCount] = useState(12);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  /* filters */
  const [searchQuery,           setSearchQuery]           = useState('');
  const [selectedPriceBracket,  setSelectedPriceBracket]  = useState(null);
  const [selectedBrands,        setSelectedBrands]        = useState([]);
  const [selectedYear,          setSelectedYear]          = useState('');
  const [selectedBodyTypes,     setSelectedBodyTypes]     = useState([]);
  const [selectedTransmission,  setSelectedTransmission]  = useState([]);
  const [selectedFuelTypes,     setSelectedFuelTypes]     = useState([]);
  const [selectedLocation,      setSelectedLocation]      = useState('');
  const [hotDealsOnly,          setHotDealsOnly]          = useState(false);
  const [sortBy,                setSortBy]                = useState('newest');

  /* ── ref tracking + URL search param ── */
  useEffect(() => {
    captureRef();
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) { setRef(ref); trackEvent('link_visit'); }
    const q = params.get('q');
    if (q) setSearchQuery(q);
  }, [location.search]);

  /* ── page_view ── */
  useEffect(() => {
    if (!tenant?.id) return;
    const slug = getRef();
    if (slug) {
      supabase.from('analytics_events').insert({
        event_type: 'page_view',
        salesman_slug: slug,
        dealer_id: tenant.id,
        metadata: { page: window.location.pathname },
      }).then(() => {});
    }
  }, [tenant?.id]);

  /* ── store_visit — once per session on dealer subdomains ── */
  useEffect(() => {
    if (tenantLoading) return;
    if (!tenant?.id) return; // only record for dealer subdomains, not main marketplace
    const sessionKey = `sv_fired_${tenant.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    trackAnalyticsEvent(supabase, 'store_visit', {
      dealer_id: tenant.id,
      metadata: { source: getSlugFromURL() ? 'salesman_link' : 'organic', page: '/cars' },
    });
  }, [tenantLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── hide/show search bar on scroll ── */
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (currentY < 80) {
        setSearchBarVisible(true);
      } else if (delta > 4) {
        setSearchBarVisible(false);
      } else if (delta < -4) {
        setSearchBarVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── data ── */
  const load = async () => {
    if (tenantLoading) return;
    setLoading(true);
    let query = supabase
      .from('car_listings')
      .select('*, dealer:profiles!car_listings_dealer_id_fkey(dealership, site_name, subdomain, whatsapp_number, site_logo_url, brand_color)')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    if (tenant?.id) {
      query = query.eq('dealer_id', tenant.id);
    }
    // no dealer_id filter on root domain — show all dealers

    const { data, error } = await query;
    if (error) { setFetchError(error.message); setAllCars([]); }
    else        { setAllCars(data || []); }
    setLoading(false);
  };

  useEffect(() => {
    if (tenantLoading) return;
    load();
    const ch = supabase.channel('cars_page')
      .on('postgres_changes', { event:'*', schema:'public', table:'car_listings' }, payload => {
        setAllCars(cur => {
          if (payload.eventType === 'INSERT') return [payload.new, ...cur];
          if (payload.eventType === 'UPDATE') return cur.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c);
          if (payload.eventType === 'DELETE') return cur.filter(c => c.id !== payload.old.id);
          return cur;
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [tenant, tenantLoading]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /* close drawer on outside click */
  useEffect(() => {
    const h = e => { if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false); };
    if (drawerOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [drawerOpen]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  /* ── derived lists ── */
  const brands    = [...new Set(allCars.map(c => c.brand || c.make).filter(Boolean))].sort();
  const years     = [...new Set(allCars.map(c => c.year).filter(Boolean))].sort((a,b) => b-a);
  const locations = [...new Set(allCars.map(c => c.state || c.location).filter(Boolean))].sort();

  const toggle = setter => val =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const resetFilters = () => {
    setSelectedPriceBracket(null); setSelectedBrands([]);
    setSelectedYear(''); setSelectedBodyTypes([]);
    setSelectedTransmission([]); setSelectedFuelTypes([]);
    setSelectedLocation(''); setSearchQuery(''); setHotDealsOnly(false);
  };

  const activeFilterCount = [
    !!selectedPriceBracket, selectedBrands.length>0, !!selectedYear,
    selectedBodyTypes.length>0, selectedTransmission.length>0,
    selectedFuelTypes.length>0, !!selectedLocation, hotDealsOnly,
  ].filter(Boolean).length;

  const activeTags = [
    ...(hotDealsOnly ? [{ label:'🔥 Hot Deals', remove:()=>setHotDealsOnly(false) }] : []),
    ...(selectedPriceBracket ? [{ label:selectedPriceBracket.label, remove:()=>setSelectedPriceBracket(null) }] : []),
    ...selectedBrands.map(b => ({ label:b, remove:()=>toggle(setSelectedBrands)(b) })),
    ...selectedBodyTypes.map(bt => ({ label:bt, remove:()=>toggle(setSelectedBodyTypes)(bt) })),
    ...selectedTransmission.map(tr => ({ label:tr, remove:()=>toggle(setSelectedTransmission)(tr) })),
    ...selectedFuelTypes.map(ft => ({ label:ft, remove:()=>toggle(setSelectedFuelTypes)(ft) })),
    ...(selectedYear ? [{ label:selectedYear, remove:()=>setSelectedYear('') }] : []),
    ...(selectedLocation ? [{ label:selectedLocation, remove:()=>setSelectedLocation('') }] : []),
  ];

  /* ── filter + sort ── */
  const filteredCars = allCars.filter(car => {
    const price = car.selling_price || car.price || 0;
    const brand = car.brand || car.make;
    const loc   = car.state || car.location;
    const year  = car.year;
    const q     = searchQuery.toLowerCase();

    if (hotDealsOnly) {
      const op = car.original_price;
      if (!op || op <= 0 || price <= 0 || price > op * 0.97) return false;
    }
    if (selectedPriceBracket && (price < selectedPriceBracket.min || price > selectedPriceBracket.max)) return false;
    if (selectedBrands.length > 0 && !selectedBrands.includes(brand)) return false;
    if (selectedYear && String(year) !== String(selectedYear)) return false;
    if (selectedBodyTypes.length > 0 && !selectedBodyTypes.includes(car.body_type)) return false;
    if (selectedTransmission.length > 0) {
      const norm = ['Auto','Automatic','AT'].includes(car.transmission) ? 'Automatic' : 'Manual';
      if (!selectedTransmission.includes(norm)) return false;
    }
    if (selectedFuelTypes.length > 0 && !selectedFuelTypes.includes(car.fuel_type)) return false;
    if (selectedLocation && loc !== selectedLocation) return false;
    if (q && !`${brand} ${car.model} ${year}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const sortedCars = [...filteredCars].sort((a,b) => {
    const pA = a.selling_price||a.price||0, pB = b.selling_price||b.price||0;
    if (sortBy === 'price-low')  return pA - pB;
    if (sortBy === 'price-high') return pB - pA;
    if (sortBy === 'newest')     return new Date(b.created_at||0) - new Date(a.created_at||0);
    return 0;
  });

  const displayed = sortedCars.slice(0, displayCount);

  /* ── filter panel (shared sidebar + drawer) ── */
  const FilterPanel = () => (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>

      {/* Hot Deals toggle */}
      <div style={{ marginBottom:'4px', borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:'16px' }}>
        <button
          onClick={() => setHotDealsOnly(!hotDealsOnly)}
          style={{
            width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
            background: hotDealsOnly ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)',
            border: hotDealsOnly ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(255,255,255,0.07)',
            borderRadius:'10px', padding:'10px 14px', cursor:'pointer',
            color: hotDealsOnly ? '#f87171' : '#9ca3af',
            fontSize:'13px', fontWeight:'700',
            fontFamily:"'DM Sans',sans-serif",
            transition:'all 0.15s ease',
          }}
        >
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}><Flame size={13}/> Hot Deals Only</span>
          {hotDealsOnly && <Check size={13}/>}
        </button>
      </div>

      {/* Price */}
      <FilterSection title="Price Range">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
          {PRICE_BRACKETS.map(b => (
            <Chip key={b.label} label={b.label} active={selectedPriceBracket?.label===b.label} onClick={() => setSelectedPriceBracket(selectedPriceBracket?.label===b.label ? null : b)} />
          ))}
        </div>
      </FilterSection>

      {/* Brand */}
      <FilterSection title="Brand">
        <div style={{ maxHeight:'160px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px', paddingRight:'4px' }}>
          {brands.length === 0
            ? <p style={{ color:'#4b5563', fontSize:'12px', fontStyle:'italic' }}>No brands loaded</p>
            : brands.map(b => (
              <label key={b} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', padding:'4px 2px' }}>
                <div
                  onClick={() => toggle(setSelectedBrands)(b)}
                  style={{
                    width:'16px', height:'16px', borderRadius:'4px', flexShrink:0,
                    background: selectedBrands.includes(b) ? '#dc2626' : 'transparent',
                    border: selectedBrands.includes(b) ? '1px solid #dc2626' : '1px solid rgba(255,255,255,0.15)',
                    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                    transition:'all 0.15s ease',
                  }}
                >
                  {selectedBrands.includes(b) && <Check size={10} style={{ color:'white' }}/>}
                </div>
                <span style={{ color: selectedBrands.includes(b) ? 'white' : '#9ca3af', fontSize:'13px', userSelect:'none' }}
                  onClick={() => toggle(setSelectedBrands)(b)}>{b}</span>
              </label>
            ))}
        </div>
      </FilterSection>

      {/* Year */}
      <FilterSection title="Year" defaultOpen={false}>
        <DarkSelect value={selectedYear} onChange={setSelectedYear} options={years} placeholder="All Years"/>
      </FilterSection>

      {/* Body Type */}
      <FilterSection title="Body Type">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {BODY_TYPES.map(bt => (
            <Chip key={bt} label={bt} active={selectedBodyTypes.includes(bt)} onClick={() => toggle(setSelectedBodyTypes)(bt)}/>
          ))}
        </div>
      </FilterSection>

      {/* Transmission */}
      <FilterSection title="Transmission" defaultOpen={false}>
        <div style={{ display:'flex', gap:'6px' }}>
          {TRANSMISSIONS.map(tr => (
            <Chip key={tr} label={tr} active={selectedTransmission.includes(tr)} onClick={() => toggle(setSelectedTransmission)(tr)}/>
          ))}
        </div>
      </FilterSection>

      {/* Fuel */}
      <FilterSection title="Fuel Type" defaultOpen={false}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {FUEL_TYPES.map(ft => (
            <Chip key={ft} label={ft} active={selectedFuelTypes.includes(ft)} onClick={() => toggle(setSelectedFuelTypes)(ft)}/>
          ))}
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection title="Location" defaultOpen={false}>
        <DarkSelect value={selectedLocation} onChange={setSelectedLocation} options={locations} placeholder="All Locations"/>
      </FilterSection>

    </div>
  );

  /* ─────────── loading state ─────────── */
  if (isSubdomain() && tenant === null && !tenantLoading) {
    return (
      <div style={{ background: '#0d0d0d', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: '#6b7280', fontSize: 15 }}>This dealer page doesn't exist.</p>
        <a href="https://xdrive.my" style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>← Browse all cars</a>
      </div>
    );
  }

  if (loading && allCars.length === 0) return (
    <>
      <Header />
      <div style={{ minHeight:'100vh', background:'#080C14', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:'36px', height:'36px', border:'3px solid rgba(220,38,38,0.3)', borderTopColor:'#dc2626', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
          <p style={{ color:'#6b7280', fontSize:'14px' }}>Loading listings…</p>
        </div>
      </div>
      <Footer />
    </>
  );

  if (fetchError) return (
    <>
      <Header />
      <div style={{ minHeight:'100vh', background:'#080C14', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ background:'#0d1117', border:'1px solid rgba(220,38,38,0.2)', borderRadius:'16px', padding:'32px', maxWidth:'400px', textAlign:'center' }}>
          <X size={28} style={{ color:'#dc2626', margin:'0 auto 12px' }}/>
          <p style={{ color:'white', fontWeight:'700', marginBottom:'8px' }}>Failed to load listings</p>
          <p style={{ color:'#6b7280', fontSize:'12px', fontFamily:'monospace' }}>{fetchError}</p>
        </div>
      </div>
      <Footer />
    </>
  );

  /* ─────────── main render ─────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #080C14 !important; margin: 0 !important; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

        .cars-search:focus { border-color: rgba(220,38,38,0.5) !important; outline: none !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.1) !important; }
        .sort-select:focus { outline: none !important; }
        .load-more:hover { border-color: rgba(220,38,38,0.4) !important; color: #f87171 !important; }
        .reset-btn:hover { color: #f87171 !important; }
        .filter-toggle:hover { background: rgba(220,38,38,0.08) !important; }

        /* sidebar scrollbar */
        .filter-sidebar::-webkit-scrollbar { width: 3px; }
        .filter-sidebar::-webkit-scrollbar-track { background: transparent; }
        .filter-sidebar::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }

        /* brand list scrollbar */
        div[style*="overflowY"]::-webkit-scrollbar { width: 3px; }
        div[style*="overflowY"]::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }

        @media(max-width:1024px){
          .cars-layout { flex-direction: column !important; }
          .cars-sidebar { display: none !important; }
        }
        @media(max-width:640px){
          .cars-toolbar { flex-wrap: wrap !important; }
          .cars-grid { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
          .cars-page-body { padding-top: 60px !important; }
          .cars-header-bar { top: 60px !important; padding: 6px 12px !important; }
          .cars-main-layout { padding: 70px 12px 60px !important; }
          .cars-search { font-size: 12px !important; padding-top: 7px !important; padding-bottom: 7px !important; }
        }
        @media(min-width:641px) and (max-width:900px){
          .cars-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      <Helmet>
        <title>
          {searchQuery
            ? `${searchQuery} Cars for Sale in Malaysia – ${siteName}`
            : selectedBrands.length === 1
            ? `${selectedBrands[0]} Cars for Sale in Malaysia – ${siteName}`
            : `Browse Used Cars – ${siteName}`}
        </title>
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="description" content={
          searchQuery
            ? `${searchQuery} cars for sale in Malaysia — ${filteredCars.length} listings. Find your next ${searchQuery} on XDrive.`
            : selectedBrands.length === 1
            ? `${selectedBrands[0]} cars for sale in Malaysia — ${filteredCars.length} listings. Find your next ${selectedBrands[0]} on XDrive.`
            : `Find your perfect used car from verified Malaysian dealers. Filter by brand, price, body type and more.`
        } />
        <link rel="canonical" href={`https://xdrive.my/cars${location.search}`} />
        {filteredCars.length > 0 && (
          <script type="application/ld+json">{JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": filteredCars.slice(0, 10).map((car, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "url": `https://xdrive.my/cars/${car.slug}`,
              "name": `${car.year} ${car.brand} ${car.model}${car.variant ? ` ${car.variant}` : ''}`,
            })),
          })}</script>
        )}
      </Helmet>

      <Header />

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}
        />
      )}

      {/* ── Mobile filter drawer ── */}
      <div
        ref={drawerRef}
        style={{
          position:'fixed', top:0, right:0, bottom:0, zIndex:50,
          width:'320px', maxWidth:'90vw',
          background:'#0d1117',
          borderLeft:'1px solid rgba(255,255,255,0.07)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
          display:'flex', flexDirection:'column',
          fontFamily:"'DM Sans',sans-serif",
        }}
      >
        {/* Drawer header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <h2 style={{ color:'white', fontWeight:'800', fontSize:'15px', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
            <SlidersHorizontal size={15} style={{ color:'#dc2626' }}/>
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background:'#dc2626', color:'white', fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'20px' }}>{activeFilterCount}</span>
            )}
          </h2>
          <button onClick={() => setDrawerOpen(false)} style={{ background:'rgba(255,255,255,0.05)', border:'none', cursor:'pointer', color:'#9ca3af', borderRadius:'8px', padding:'6px', display:'flex', alignItems:'center' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Drawer filters */}
        <div className="filter-sidebar" style={{ flex:1, overflowY:'auto', padding:'8px 20px' }}>
          <FilterPanel/>
        </div>

        {/* Drawer footer */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'10px' }}>
          <button onClick={resetFilters} style={{
            flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
            color:'#9ca3af', fontSize:'13px', fontWeight:'600', borderRadius:'10px', padding:'11px',
            cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
          }}>
            Reset all
          </button>
          <button onClick={() => setDrawerOpen(false)} style={{
            flex:2, background:'linear-gradient(135deg,#dc2626,#b91c1c)',
            border:'none', color:'white', fontSize:'13px', fontWeight:'700',
            borderRadius:'10px', padding:'11px', cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif",
            boxShadow:'0 4px 16px rgba(220,38,38,0.3)',
          }}>
            Show {filteredCars.length} cars
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════
          PAGE BODY
      ══════════════════════════════════════ */}
      <div className="cars-page-body" style={{ background:'#080C14', minHeight:'100vh', paddingTop:'72px', fontFamily:"'DM Sans',sans-serif" }}>

        {/* ── Page header bar ── */}
        <div ref={headerBarRef} className="cars-header-bar" style={{ background:'rgba(13,17,23,0.8)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'fixed', top:'72px', left:0, right:0, zIndex:20, transform: searchBarVisible ? 'translateY(0)' : 'translateY(-100%)', transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'8px 24px' }}>

            {/* Toolbar */}
            <div className="cars-toolbar" style={{ display:'flex', gap:'10px', alignItems:'center' }}>

              {/* Search */}
              <div style={{ position:'relative', flex:1, minWidth:'180px' }}>
                <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#4b5563', pointerEvents:'none' }}/>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search brand, model, year…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="cars-search"
                  style={{
                    width:'100%', paddingLeft:'36px', paddingRight:'12px', paddingTop:'10px', paddingBottom:'10px',
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:'10px', color:'white', fontSize:'13px',
                    fontFamily:"'DM Sans',sans-serif", transition:'all 0.2s',
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#6b7280', display:'flex', alignItems:'center' }}>
                    <X size={13}/>
                  </button>
                )}
              </div>

              {/* Sort */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="sort-select"
                  style={{
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:'10px', padding:'10px 32px 10px 12px', color:'white',
                    fontSize:'13px', fontWeight:'600', cursor:'pointer',
                    appearance:'none', WebkitAppearance:'none',
                    fontFamily:"'DM Sans',sans-serif",
                  }}
                >
                  <option value="newest"    style={{ background:'#0d1117' }}>Newest First</option>
                  <option value="price-low" style={{ background:'#0d1117' }}>Price: Low–High</option>
                  <option value="price-high"style={{ background:'#0d1117' }}>Price: High–Low</option>
                </select>
                <ChevronDown size={12} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#6b7280', pointerEvents:'none' }}/>
              </div>

              {/* Refresh */}
              <button onClick={load} style={{
                display:'flex', alignItems:'center', gap:'6px',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:'10px', padding:'10px 14px', color:'#9ca3af',
                fontSize:'13px', fontWeight:'600', cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif", flexShrink:0,
              }}>
                <RotateCcw size={13}/>
                <span style={{ display:'none' }} className="refresh-label">Refresh</span>
              </button>

              {/* Mobile filter button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="filter-toggle"
                style={{
                  display:'flex', alignItems:'center', gap:'6px',
                  background: activeFilterCount > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
                  border: activeFilterCount > 0 ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius:'10px', padding:'10px 14px',
                  color: activeFilterCount > 0 ? '#f87171' : '#9ca3af',
                  fontSize:'13px', fontWeight:'600', cursor:'pointer',
                  fontFamily:"'DM Sans',sans-serif", flexShrink:0,
                  position:'relative',
                }}
              >
                <SlidersHorizontal size={14}/>
                Filters
                {activeFilterCount > 0 && (
                  <span style={{ position:'absolute', top:'-6px', right:'-6px', background:'#dc2626', color:'white', fontSize:'9px', fontWeight:'800', width:'16px', height:'16px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active filter tags */}
            {activeTags.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center', marginTop:'10px' }}>
                <span style={{ color:'#4b5563', fontSize:'11px', fontWeight:'600' }}>Active:</span>
                {activeTags.map((tag,i) => <ActiveTag key={i} label={tag.label} onRemove={tag.remove}/>)}
                <button onClick={resetFilters} className="reset-btn" style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'11px', fontWeight:'600', transition:'color 0.15s', fontFamily:"'DM Sans',sans-serif" }}>
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Main layout ── */}
        <div className="cars-main-layout" style={{ maxWidth:'1380px', margin:'0 auto', padding:'28px 24px 60px', paddingTop:'85px' }}>

          <h1 style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap' }}>
            {searchQuery
              ? `${searchQuery} Cars for Sale in Malaysia`
              : selectedBrands.length === 1
              ? `${selectedBrands[0]} Cars for Sale in Malaysia`
              : 'Used Cars for Sale in Malaysia'}
          </h1>

          {/* Results count + hot deals quick filter */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
            <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>
              <span style={{ color:'white', fontWeight:'700' }}>{filteredCars.length}</span> cars found
              {loading && <span style={{ marginLeft:'8px', color:'#4b5563' }}>(refreshing…)</span>}
            </p>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              <Chip label="🔥 Hot Deals" active={hotDealsOnly} onClick={() => setHotDealsOnly(!hotDealsOnly)}/>
              {selectedBodyTypes.length === 0 && BODY_TYPES.slice(0,4).map(bt => (
                <Chip key={bt} label={bt} active={false} onClick={() => toggle(setSelectedBodyTypes)(bt)}/>
              ))}
            </div>
          </div>

          <div className="cars-layout" style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>

            {/* ── Desktop sidebar ── */}
            <aside
              className="cars-sidebar filter-sidebar"
              style={{
                width:'240px', flexShrink:0,
                background:'linear-gradient(145deg,#0d1117,#111827)',
                border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:'16px', padding:'16px 18px',
                position:'sticky', top:'145px',
                maxHeight:'calc(100vh - 180px)', overflowY:'auto',
              }}
            >
              {/* Sidebar header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                <h2 style={{ color:'white', fontSize:'13px', fontWeight:'800', margin:0, display:'flex', alignItems:'center', gap:'6px' }}>
                  <SlidersHorizontal size={13} style={{ color:'#dc2626' }}/>
                  Filters
                  {activeFilterCount > 0 && (
                    <span style={{ background:'#dc2626', color:'white', fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'20px' }}>{activeFilterCount}</span>
                  )}
                </h2>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="reset-btn" style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', transition:'color 0.15s', fontFamily:"'DM Sans',sans-serif" }}>
                    <RotateCcw size={10}/> Reset
                  </button>
                )}
              </div>
              <FilterPanel/>
            </aside>

            {/* ── Car grid ── */}
            <div style={{ flex:1, minWidth:0 }}>
              {displayed.length > 0 ? (
                <>
                  <div
                    className="cars-grid"
                    style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'18px' }}
                  >
                    {displayed.map(car => <CarCard key={car.id} car={car} ctaContext={ctaCtx}/>)}
                    {loading && [...Array(3)].map((_,i) => <SkeletonCard key={`sk-${i}`}/>)}
                  </div>

                  {displayCount < sortedCars.length && (
                    <div style={{ marginTop:'44px', textAlign:'center' }}>
                      <button
                        onClick={() => setDisplayCount(prev => prev + 12)}
                        className="load-more"
                        style={{
                          display:'inline-flex', alignItems:'center', gap:'8px',
                          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)',
                          color:'#9ca3af', fontSize:'13px', fontWeight:'600',
                          padding:'13px 32px', borderRadius:'50px', cursor:'pointer',
                          transition:'all 0.2s', fontFamily:"'DM Sans',sans-serif",
                        }}
                      >
                        Load more <ChevronDown size={14}/>
                      </button>
                      <p style={{ color:'#4b5563', fontSize:'11px', marginTop:'8px' }}>
                        Showing {displayed.length} of {sortedCars.length}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* Empty state */
                <div style={{ background:'linear-gradient(145deg,#0d1117,#111827)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'20px', padding:'64px 32px', textAlign:'center' }}>
                  <div style={{ width:'56px', height:'56px', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                    <Car size={24} style={{ color:'#dc2626' }}/>
                  </div>
                  <p style={{ color:'white', fontWeight:'700', fontSize:'16px', margin:'0 0 8px' }}>No cars found</p>
                  <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 24px', maxWidth:'300px', marginLeft:'auto', marginRight:'auto' }}>
                    Try adjusting your filters or search term to see more results.
                  </p>
                  <button
                    onClick={resetFilters}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:'6px',
                      background:'linear-gradient(135deg,#dc2626,#b91c1c)',
                      border:'none', color:'white', fontSize:'13px', fontWeight:'700',
                      padding:'11px 24px', borderRadius:'50px', cursor:'pointer',
                      fontFamily:"'DM Sans',sans-serif",
                      boxShadow:'0 4px 16px rgba(220,38,38,0.3)',
                    }}
                  >
                    <RotateCcw size={13}/> Reset all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter button — fixed bottom */}
      <div style={{
        position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)',
        zIndex:30, display:'flex',
      }} className="mobile-filter-fab">
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            display:'flex', alignItems:'center', gap:'8px',
            background:'linear-gradient(135deg,#dc2626,#b91c1c)',
            border:'none', color:'white', fontSize:'13px', fontWeight:'700',
            padding:'13px 24px', borderRadius:'50px', cursor:'pointer',
            boxShadow:'0 8px 24px rgba(220,38,38,0.4)',
            fontFamily:"'DM Sans',sans-serif",
            whiteSpace:'nowrap',
          }}
        >
          <SlidersHorizontal size={14}/>
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>

      <style>{`
        .filter-toggle { display: none !important; }
        .mobile-filter-fab { display: none !important; }
        @media(max-width:1024px){
          .mobile-filter-fab { display: flex !important; }
          .filter-toggle { display: flex !important; }
        }
      `}</style>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default CarsPage;