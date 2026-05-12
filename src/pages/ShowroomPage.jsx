import React, { useState, useEffect, useCallback, useRef } from 'react'; // useRef kept for initialLoad
import { useSearchParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import {
  X, ChevronLeft, ChevronRight, RotateCcw, Car,
  SlidersHorizontal, Flame, ArrowLeftRight,
  Gauge, Settings2, MessageCircle, Fuel, Calendar, Users,
} from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import MarketplaceHeader from '../components/MarketplaceHeader';
import Footer from '@/components/Footer';
import GradeBadge from '../components/GradeBadge';
import { useCTAContext, buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { isSubdomain } from '../hooks/useTenant';
import { getRef } from '../utils/refTracking';
import { PriceDrumPicker, PRICE_STEPS } from '../components/PriceDrumPicker';
import { CAR_DATA } from '../components/CarForm';
import SearchAutocomplete from '../components/SearchAutocomplete';
import PriceAlertButton from '../components/PriceAlertButton';

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
const FUEL_TYPES   = ['Petrol','Diesel','Electric','Hybrid','Mild Hybrid'];
const COLOURS      = ['White','Black','Silver','Grey','Red','Blue','Brown','Green','Orange','Yellow','Gold','Maroon'];
const SELLER_TYPES = [{ value:'dealer', label:'Dealer' },{ value:'agent', label:'Agent' }];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

const CAR_FIELDS   = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at';
const DEALER_JOIN  = 'dealer:profiles!car_listings_dealer_id_fkey(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color,role)';

/* ── Sanitisers ──────────────────────────────────────────────────────────── */
const sanitize = {
  brand:      v => BRANDS.includes(v) ? v : null,
  bodyType:   v => BODY_TYPES.includes(v) ? v : null,
  tx:         v => TRANSMISSIONS.includes(v) ? v : null,
  financing:  v => FINANCING_TYPES.map(f => f.value).includes(v) ? v : null,
  state:      v => MY_STATES.includes(v) ? v : null,
  price:      v => { const n = parseInt(v,10); return PRICE_STEPS.some(s => s.value === String(n)) ? n : null; },
  page:       v => { const n = parseInt(v,10); return Number.isFinite(n) && n >= 1 ? n : 1; },
  year:       v => { const n = parseInt(v,10); return Number.isFinite(n) && n >= 1990 && n <= CURRENT_YEAR ? n : null; },
  q:          v => (!v || typeof v !== 'string') ? '' : v.replace(/[%_\\]/g,'').slice(0,60).trim(),
  condition:  v => CONDITION_OPTIONS.map(c => c.value).includes(v) ? v : null,
  mileage:    v => { const n = parseInt(v,10); return [20000,50000,80000,150000].includes(n) ? n : null; },
  fuelType:   v => FUEL_TYPES.includes(v) ? v : null,
  colour:     v => COLOURS.includes(v) ? v : null,
  sellerType: v => ['dealer','agent'].includes(v) ? v : null,
  str:        v => (!v || typeof v !== 'string') ? '' : v.replace(/[%_\\]/g,'').slice(0,80).trim(),
};

/* ── Pagination ──────────────────────────────────────────────────────────── */
const Pagination = ({ page, totalPages, onPage }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else if (page <= 4)  { pages.push(1,2,3,4,5,'…',totalPages); }
  else if (page >= totalPages - 3) { pages.push(1,'…',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages); }
  else { pages.push(1,'…',page-1,page,page+1,'…',totalPages); }

  const btn = { minWidth:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.1)', background:'#ffffff', color:'#374151', fontSize:'14px', fontWeight:'600', cursor:'pointer', transition:'all 0.15s', fontFamily:"'Outfit',sans-serif", padding:'0 8px' };
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', flexWrap:'wrap' }}>
      <button onClick={() => onPage(page-1)} disabled={page===1} style={{ ...btn, opacity: page===1?0.35:1, cursor: page===1?'not-allowed':'pointer', gap:'4px', padding:'0 12px', fontSize:'13px' }}><ChevronLeft size={15}/> Prev</button>
      {pages.map((p,i) => p==='…'
        ? <span key={`e${i}`} style={{ color:'#9ca3af', padding:'0 4px' }}>…</span>
        : <button key={p} onClick={() => onPage(p)} style={{ ...btn, background: p===page?'#dc2626':'#ffffff', borderColor: p===page?'#dc2626':'rgba(0,0,0,0.1)', color: p===page?'#fff':'#374151' }}>{p}</button>
      )}
      <button onClick={() => onPage(page+1)} disabled={page===totalPages} style={{ ...btn, opacity: page===totalPages?0.35:1, cursor: page===totalPages?'not-allowed':'pointer', gap:'4px', padding:'0 12px', fontSize:'13px' }}>Next <ChevronRight size={15}/></button>
    </div>
  );
};

/* ── Skeleton ────────────────────────────────────────────────────────────── */
const Skeleton = () => (
  <div style={{ background:'#ffffff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:'12px', overflow:'hidden', display:'flex', height:'190px' }}>
    <div style={{ width:'38%', maxWidth:'220px', flexShrink:0, background:'linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)', backgroundSize:'200% 100%', animation:'sr-shimmer 1.5s infinite' }}/>
    <div style={{ flex:1, padding:'14px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
      <div style={{ height:'12px', width:'75%', background:'#e5e7eb', borderRadius:'5px', animation:'sr-shimmer 1.5s infinite' }}/>
      <div style={{ height:'10px', width:'45%', background:'#e5e7eb', borderRadius:'5px', animation:'sr-shimmer 1.5s infinite' }}/>
      <div style={{ height:'22px', width:'60%', background:'#e5e7eb', borderRadius:'5px', animation:'sr-shimmer 1.5s infinite', marginTop:'4px' }}/>
      <div style={{ height:'10px', width:'80%', background:'#e5e7eb', borderRadius:'5px', animation:'sr-shimmer 1.5s infinite' }}/>
      <div style={{ marginTop:'auto', height:'34px', width:'100%', background:'#e5e7eb', borderRadius:'8px', animation:'sr-shimmer 1.5s infinite' }}/>
    </div>
  </div>
);

const XDRIVE_WA = '60174155191';
const calcMonthlyAmt = p => (!p||p<=0) ? null : Math.round((p*0.9*(1+3.5/100*7))/(7*12));

/* ── Horizontal card (Showroom-only) ─────────────────────────────────────── */
const ShowroomCard = ({ car, ctaContext, inCompare = false, compareFull = false, onCompare }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const brand        = car.brand || 'Unknown';
  const model        = car.model || '';
  const variant      = car.variant || '';
  const year         = car.year || '';
  const price        = car.selling_price || 0;
  const origPrice    = car.original_price || null;
  const mileage      = car.mileage || null;
  const transmission = car.transmission || null;
  const location     = car.state || null;
  const isSold       = (car.status || '') === 'sold';
  const hasDiscount  = origPrice && origPrice > 0 && price > 0 && origPrice > price;
  const discountPct  = hasDiscount ? Math.round(((origPrice-price)/origPrice)*100) : null;
  const isHot        = hasDiscount && discountPct >= 3;
  const photoCount   = Array.isArray(car.images) ? car.images.length : 0;

  const image = !imgError && (Array.isArray(car.images) && car.images[0] || null);
  const normalTx = ['Auto','Automatic','AT'].includes(transmission) ? 'Auto' : ['Manual','MT'].includes(transmission) ? 'Manual' : transmission || null;
  const waText = `Hi, I'm interested in the ${year} ${brand} ${model}${variant?' '+variant:''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(ctxResolved || { type:'listing', profile:null, ref:null }, XDRIVE_WA, waText);
  const monthly = calcMonthlyAmt(price);

  /* compact inline spec string: 30,000 km  •  Auto  •  Petrol  •  KL */
  const specParts = [
    mileage ? Number(mileage).toLocaleString('en-MY')+' km' : null,
    normalTx,
    car.fuel_type || null,
    location,
  ].filter(Boolean);

  const condStyle = car.condition === 'recon'
    ? { background:'rgba(139,92,246,0.1)', color:'#7c3aed', border:'1px solid rgba(139,92,246,0.22)' }
    : car.condition === 'new'
    ? { background:'rgba(5,150,105,0.09)', color:'#059669', border:'1px solid rgba(5,150,105,0.22)' }
    : { background:'rgba(0,0,0,0.05)', color:'#374151', border:'1px solid rgba(0,0,0,0.1)' };

  return (
    <div
      className={`sc-root${isHot?' hot':''}`}
      onClick={() => {
        if (isSold || !(car.slug || car.id)) return;
        trackEvent(supabase, 'card_click', { car_id:car.id, car_name:`${year} ${brand} ${model}`, dealer_id:car.dealer_id||null, metadata:{source:'showroom_card'} });
        navigate('/showroom/' + (car.slug || car.id));
      }}
      style={{ display:'flex', flexDirection:'row', background:'#ffffff', border: isHot?'1px solid rgba(220,38,38,0.3)':'1px solid rgba(0,0,0,0.08)', borderRadius:'12px', overflow:'hidden', cursor: isSold?'default':'pointer', fontFamily:"'Outfit',sans-serif", height:'190px', minWidth:0 }}
    >
      {/* ── Image column ── */}
      <div className="sc-img-col" style={{ width:'38%', maxWidth:'210px', flexShrink:0, position:'relative', background:'#f3f4f6', overflow:'hidden' }}>
        {image ? (
          <>
            {!imgLoaded && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)', backgroundSize:'200% 100%', animation:'sr-shimmer 1.5s infinite' }}/>}
            <img src={image} alt={`${year} ${brand} ${model}`} onError={()=>setImgError(true)} onLoad={()=>setImgLoaded(true)} style={{ width:'100%', height:'100%', objectFit:'contain', objectPosition:'center', opacity:imgLoaded?1:0, transition:'opacity 0.3s', filter:isSold?'grayscale(60%)':'none' }}/>
          </>
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Car size={28} color="#9ca3af"/>
          </div>
        )}

        {/* Price overlay — bottom of image */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'24px 10px 7px', background:'linear-gradient(to top,rgba(0,0,0,0.82) 55%,transparent)', pointerEvents:'none' }}>
          {hasDiscount && <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.5)', textDecoration:'line-through', lineHeight:1, marginBottom:'1px' }}>RM {origPrice.toLocaleString('en-MY')}</div>}
          <div style={{ fontSize:'14px', fontWeight:'800', color: isHot?'#fca5a5':'#ffffff', lineHeight:1, letterSpacing:'-0.02em' }}>
            {price ? 'RM '+price.toLocaleString('en-MY') : 'P.O.R'}
          </div>
        </div>

        {/* Top badges row */}
        <div style={{ position:'absolute', top:6, left:6, right:6, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4 }}>
          {/* Seller badge */}
          {(() => {
            const role = car.dealer?.role;
            const isAgent = role === 'salesman';
            return (
              <div style={{ display:'flex', alignItems:'center', gap:3, background: isAgent?'rgba(251,146,60,0.18)':'rgba(59,130,246,0.18)', border:`1px solid ${isAgent?'rgba(251,146,60,0.4)':'rgba(59,130,246,0.4)'}`, borderRadius:'6px', padding:'2px 7px', backdropFilter:'blur(6px)' }}>
                <Users size={8} color={isAgent?'#fb923c':'#60a5fa'}/>
                <span style={{ fontSize:'9px', fontWeight:'700', color: isAgent?'#fb923c':'#60a5fa' }}>{isAgent?'Agent':'Dealer'}</span>
              </div>
            );
          })()}
          {/* Photo count + hot badge */}
          <div style={{ display:'flex', gap:4, alignItems:'center', marginLeft:'auto' }}>
            {photoCount > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:3, background:'rgba(0,0,0,0.6)', borderRadius:'6px', padding:'2px 6px', backdropFilter:'blur(4px)' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span style={{ fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.75)' }}>{photoCount}</span>
              </div>
            )}
            {isHot && discountPct && (
              <div style={{ background:'#dc2626', color:'white', fontSize:'9px', fontWeight:'800', padding:'2px 7px', borderRadius:'20px' }}>-{discountPct}%</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content column ── */}
      <div className="sc-content-col" style={{ flex:1, padding:'11px 14px 11px', display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Row 1: condition pill + year badge */}
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:'6px' }}>
          {car.condition && (
            <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'20px', flexShrink:0, ...condStyle }}>
              {{ used:'Used', recon:'Recon', new:'New' }[car.condition] || car.condition}
            </span>
          )}
          {year && (
            <span style={{ fontSize:'10px', fontWeight:'600', color:'#374151', padding:'2px 7px', borderRadius:'20px', background:'rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.09)', flexShrink:0 }}>{year}</span>
          )}
          {isHot && (
            <span style={{ fontSize:'10px', fontWeight:'700', color:'#fb923c', marginLeft:'auto', flexShrink:0 }}>
              Save RM {(origPrice-price).toLocaleString('en-MY')}
            </span>
          )}
        </div>

        {/* Row 2: car name */}
        <h3 style={{ color:'#111827', fontSize:'14px', fontWeight:'700', margin:'0 0 4px', lineHeight:'1.25', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {[brand, model, variant].filter(Boolean).join(' ')}
        </h3>

        {/* Row 3: inline specs — 2 lines allowed */}
        <p className="sc-spec-line" style={{ fontSize:'11px', color:'#6b7280', margin:'0 0 6px', lineHeight:'1.5', whiteSpace:'normal', wordBreak:'break-word', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {specParts.join('  •  ')}
        </p>

        {/* Row 4: compare + grade */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', margin:'6px 0 4px', flexWrap:'wrap' }}>
          <button
            onClick={e=>{ e.stopPropagation(); if(compareFull){ toast.error('Compare full — remove a car first (max 4)',{duration:2500}); return; } onCompare && onCompare(); }}
            style={{ display:'flex', alignItems:'center', gap:'4px', background: inCompare?'#dc2626':'rgba(0,0,0,0.05)', border:`1px solid ${inCompare?'#dc2626':'rgba(0,0,0,0.12)'}`, borderRadius:'7px', padding:'4px 9px', color: inCompare?'#fff':'#374151', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'all 0.15s', flexShrink:0 }}
          >
            <ArrowLeftRight size={10}/>{inCompare?'Added':'Compare'}
          </button>
          {(car.auction_grade || car.interior_grade) && (
            <GradeBadge auctionGrade={car.auction_grade||null} interiorGrade={car.interior_grade||null} size="sm"/>
          )}
        </div>

        {/* Row 5: monthly estimate */}
        {monthly && (
          <p style={{ fontSize:'10px', color:'#4b5563', margin:'0 0 6px', lineHeight:1 }}>
            est. <span style={{ color:'#6b7280', fontWeight:'600' }}>RM {monthly.toLocaleString('en-MY')}/mo</span>
          </p>
        )}

        {/* Row 5: WA button — full width */}
        <a
          href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          onClick={e => {
            e.stopPropagation();
            supabase.from('whatsapp_enquiries').insert({ dealer_id:car.dealer_id||null, listing_id:car.id||null, buyer_name:null, buyer_phone:null, buyer_message:waText, source:'showroom_card', status:'new', ref_slug:getRef()||null }).then(()=>{});
            trackEvent(supabase, 'whatsapp_click', { car_id:car.id, car_name:`${year} ${brand} ${model}`, dealer_id:car.dealer_id||null, metadata:{source:'showroom_card'} });
          }}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', width:'100%', padding:'7px 0', background: isSold?'rgba(0,0,0,0.03)':'rgba(37,211,102,0.08)', border: isSold?'1px solid rgba(0,0,0,0.07)':'1px solid rgba(37,211,102,0.25)', color: isSold?'#9ca3af':'#16a34a', borderRadius:'8px', textDecoration:'none', fontSize:'12px', fontWeight:'700', fontFamily:"'Outfit',sans-serif", transition:'all 0.15s', pointerEvents: isSold?'none':'auto', boxSizing:'border-box', flexShrink:0 }}
        >
          <MessageCircle size={13}/> WhatsApp
        </a>
      </div>
    </div>
  );
};

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
  const minPrice    = sanitize.price(searchParams.get('min_price') || '');
  const maxPrice    = sanitize.price(searchParams.get('max_price') || '');
  const financing   = sanitize.financing(searchParams.get('financing') || '');
  const yearFrom    = sanitize.year(searchParams.get('year_from') || '');
  const yearTo      = sanitize.year(searchParams.get('year_to') || '');
  const q           = sanitize.q(searchParams.get('q') || '');
  const condition   = sanitize.condition(searchParams.get('condition') || '');
  const mileageMax  = sanitize.mileage(searchParams.get('mileage_max') || '');
  const hotDeals    = searchParams.get('hot_deals') === 'true';
  const fuelType    = sanitize.fuelType(searchParams.get('fuel_type') || '');
  const colour      = sanitize.colour(searchParams.get('colour') || '');
  const sellerType  = sanitize.sellerType(searchParams.get('seller_type') || '');
  const model       = sanitize.str(searchParams.get('model') || '');
  const variant     = sanitize.str(searchParams.get('variant') || '');
  const sort        = ['newest','price_asc','price_desc'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
  const page        = sanitize.page(searchParams.get('page') || '1');

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);
  const [variantInput, setVariantInput] = useState(variant);
  useEffect(() => setVariantInput(variant), [variant]);

  const [cars, setCars]               = useState([]);
  const [totalCount, setTotal]        = useState(0);
  const [loading, setLoading]         = useState(true);
  const [fetching, setFetching]       = useState(false);
  const [error, setError]             = useState(null);
  const initialLoad = useRef(true);
  const [drawerOpen, setDrawerOpen]   = useState(false);

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

  const hasFilters = brand || bodyType || transmission || state || minPrice || maxPrice || financing || yearFrom || yearTo || q || condition || mileageMax || hotDeals || fuelType || colour || sellerType || model || variant;
  const totalPages = Math.ceil(totalCount / PER_PAGE);

  const fetchCars = useCallback(async () => {
    if (initialLoad.current) { setLoading(true); } else { setFetching(true); }
    setError(null);
    try {
      const from = (page-1)*PER_PAGE, to = from+PER_PAGE-1;
      let query = supabase.from('car_listings')
        .select(`${CAR_FIELDS}, ${DEALER_JOIN}`, { count:'exact' })
        .eq('status','available');
      if (q) {
        const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
        tokens.forEach(t => {
          const s = t.replace(/[%_\\]/g, '');
          if (s) query = query.or(`brand.ilike.%${s}%,model.ilike.%${s}%,variant.ilike.%${s}%`);
        });
      }
      if (brand)      query = query.eq('brand', brand);
      if (bodyType)   query = query.eq('body_type', bodyType);
      if (state)      query = query.eq('state', state);
      if (minPrice)   query = query.gte('selling_price', minPrice);
      if (maxPrice)   query = query.lte('selling_price', maxPrice);
      if (financing)  query = query.eq('financing_type', financing);
      if (yearFrom)   query = query.gte('year', yearFrom);
      if (yearTo)     query = query.lte('year', yearTo);
      if (mileageMax) query = query.lte('mileage', mileageMax);
      if (hotDeals)   query = query.not('original_price','is',null).gt('original_price',0);
      if (condition)  query = query.eq('condition', condition);
      if (transmission) query = query.in('transmission', transmission==='Auto' ? ['Auto','Automatic','AT'] : ['Manual','MT']);
      if (fuelType)   query = query.eq('fuel_type', fuelType);
      if (colour)     query = query.ilike('colour', `%${colour}%`);
      if (sellerType) query = query.filter('profiles!car_listings_dealer_id_fkey.role', 'eq', sellerType === 'agent' ? 'salesman' : 'dealer');
      if (model)      query = query.eq('model', model);
      if (variant)    query = query.ilike('variant', `%${variant}%`);
      if (sort==='price_asc')  query = query.order('selling_price', { ascending:true });
      else if (sort==='price_desc') query = query.order('selling_price', { ascending:false });
      else query = query.order('created_at', { ascending:false });
      query = query.range(from, to);
      const { data, error:err, count } = await query;
      if (err) throw err;
      setCars(data || []); setTotal(count || 0);
    } catch { setError('Failed to load listings. Please try again.'); }
    finally { setLoading(false); setFetching(false); initialLoad.current = false; }
  }, [page, brand, bodyType, state, minPrice, maxPrice, transmission, financing, yearFrom, yearTo, q, condition, mileageMax, hotDeals, fuelType, colour, sellerType, model, variant, sort]);

  useEffect(() => { fetchCars(); }, [fetchCars]);
  useEffect(() => { window.scrollTo({ top:0, behavior:'smooth' }); }, [page]);

  const activeChips = [
    q           && { key:'q',           label:`"${q}"` },
    brand       && { key:'brand',       label:brand },
    bodyType    && { key:'body_type',   label:bodyType },
    transmission&& { key:'transmission',label:transmission },
    state       && { key:'state',       label:state },
    (minPrice || maxPrice) && { key:'price_range', label: `${minPrice ? PRICE_STEPS.find(s=>s.value===String(minPrice))?.label : 'Any'} – ${maxPrice ? PRICE_STEPS.find(s=>s.value===String(maxPrice))?.label : 'Any'}` },
    financing   && { key:'financing',   label: FINANCING_TYPES.find(f=>f.value===financing)?.label||'' },
    yearFrom    && { key:'year_from',   label:`From ${yearFrom}` },
    yearTo      && { key:'year_to',     label:`To ${yearTo}` },
    condition   && { key:'condition',   label: CONDITION_OPTIONS.find(c=>c.value===condition)?.label||condition },
    mileageMax  && { key:'mileage_max', label: MILEAGE_OPTIONS.find(m=>m.value===String(mileageMax))?.label||'' },
    hotDeals    && { key:'hot_deals',   label:'🔥 Hot Deals' },
    fuelType    && { key:'fuel_type',   label:fuelType },
    colour      && { key:'colour',      label:colour },
    sellerType  && { key:'seller_type', label:sellerType === 'agent' ? 'Agent' : 'Dealer' },
    model       && { key:'model',       label:model },
    variant     && { key:'variant',     label:`Variant: ${variant}` },
  ].filter(Boolean);

  /* shared filter panel */
  const pill = active => ({
    padding:'8px 14px', borderRadius:'50px',
    border:`1px solid ${active?'#dc2626':'rgba(0,0,0,0.1)'}`,
    background: active?'rgba(220,38,38,0.08)':'#ffffff',
    color: active?'#dc2626':'#374151',
    fontSize:'13px', fontWeight:'600', cursor:'pointer',
    transition:'all 0.15s', fontFamily:"'Outfit',sans-serif",
  });
  const sel = {
    width:'100%', background:'#ffffff',
    border:'1px solid rgba(0,0,0,0.1)', borderRadius:'10px',
    padding:'10px 14px', color:'#111827', fontSize:'14px',
    appearance:'none', cursor:'pointer', outline:'none',
    fontFamily:"'Outfit',sans-serif",
  };
  const FG = ({ title, children }) => (
    <div style={{ marginBottom:'14px', paddingBottom:'14px', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
      <p style={{ fontSize:'10px', fontWeight:'700', color:'#6b7280', letterSpacing:'0.12em', textTransform:'uppercase', margin:'0 0 10px', fontFamily:"'Outfit',sans-serif" }}>{title}</p>
      {children}
    </div>
  );
  const Filters = () => (
    <div>
      <FG title="Hot Deals">
        <button style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background: hotDeals?'rgba(251,146,60,0.08)':'#ffffff', border: hotDeals?'1px solid rgba(251,146,60,0.3)':'1px solid rgba(0,0,0,0.1)', borderRadius:'10px', padding:'10px 14px', cursor:'pointer', color: hotDeals?'#d97706':'#374151', fontSize:'13px', fontWeight:'700', fontFamily:"'Outfit',sans-serif", transition:'all 0.15s' }} onClick={() => setParam('hot_deals', hotDeals?'':'true')}>
          <span style={{ display:'flex', alignItems:'center', gap:'6px' }}><Flame size={13}/> Hot Deals Only</span>
          {hotDeals && <span>✓</span>}
        </button>
      </FG>
      <FG title="Brand">
        <select style={sel} value={brand||''} onChange={e=>{
          const n=new URLSearchParams(searchParams);
          e.target.value?n.set('brand',e.target.value):n.delete('brand');
          n.delete('model'); n.delete('page');
          setSearchParams(n,{replace:true});
        }}>
          <option value="">All Brands</option>
          {BRANDS.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
      </FG>
      <FG title="Model">
        <select style={{ ...sel, opacity: brand?1:0.45 }} value={model||''} onChange={e=>setParam('model',e.target.value)} disabled={!brand}>
          <option value="">{brand ? 'All Models' : 'Select brand first'}</option>
          {(CAR_DATA[brand]||[]).map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </FG>
      {model && (
        <FG title="Variant">
          <form onSubmit={e=>{e.preventDefault();setParam('variant',variantInput.trim());}}>
            <input
              type="text"
              placeholder="e.g. 1.5 G"
              value={variantInput}
              onChange={e=>setVariantInput(e.target.value)}
              onBlur={()=>setParam('variant',variantInput.trim())}
              style={{ ...sel, padding:'10px 14px', width:'100%', boxSizing:'border-box' }}
            />
          </form>
        </FG>
      )}
      <FG title="Price Range">
        <PriceDrumPicker
          dark={false}
          minValue={String(minPrice || '')}
          maxValue={String(maxPrice || '')}
          onApply={(min, max) => { const n=new URLSearchParams(searchParams); min?n.set('min_price',min):n.delete('min_price'); max?n.set('max_price',max):n.delete('max_price'); n.delete('page'); setSearchParams(n,{replace:true}); }}
        />
      </FG>
      <FG title="Location">
        <select style={sel} value={state||''} onChange={e=>setParam('state',e.target.value)}>
          <option value="">All States</option>
          {MY_STATES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </FG>
      <FG title="Year">
        <div style={{ display:'flex', gap:'8px' }}>
          <select style={{ ...sel, flex:1 }} value={yearFrom||''} onChange={e=>setParam('year_from',e.target.value)}>
            <option value="">From</option>
            {YEARS.map(y=><option key={y} value={y} >{y}</option>)}
          </select>
          <select style={{ ...sel, flex:1 }} value={yearTo||''} onChange={e=>setParam('year_to',e.target.value)}>
            <option value="">To</option>
            {YEARS.map(y=><option key={y} value={y} >{y}</option>)}
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
          {MILEAGE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FG>
      <FG title="Payment">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {FINANCING_TYPES.map(ft=><button key={ft.value} style={pill(financing===ft.value)} onClick={()=>setParam('financing',financing===ft.value?'':ft.value)}>{ft.label}</button>)}
        </div>
      </FG>
      <FG title="Fuel Type">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {FUEL_TYPES.map(ft=><button key={ft} style={pill(fuelType===ft)} onClick={()=>setParam('fuel_type',fuelType===ft?'':ft)}>{ft}</button>)}
        </div>
      </FG>
      <FG title="Colour">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {COLOURS.map(c=><button key={c} style={pill(colour===c)} onClick={()=>setParam('colour',colour===c?'':c)}>{c}</button>)}
        </div>
      </FG>
      <FG title="Seller">
        <div style={{ display:'flex', gap:'6px' }}>
          {SELLER_TYPES.map(st=><button key={st.value} style={pill(sellerType===st.value)} onClick={()=>setParam('seller_type',sellerType===st.value?'':st.value)}>{st.label}</button>)}
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
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>

      <style>{`
        @keyframes sr-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .sr-sidebar::-webkit-scrollbar { width:3px }
        .sr-sidebar::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:2px }
        .sr-brand-scroll::-webkit-scrollbar { display:none }
        .sr-mobile-filter-btn { display:none !important }
        .sc-root { transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease; }
        .sc-root:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.1); border-color:rgba(0,0,0,0.15) !important; }
        .sc-root.hot:hover { box-shadow:0 8px 24px rgba(220,38,38,0.14); border-color:rgba(220,38,38,0.4) !important; }
        @media(max-width:1024px){
          .sr-mobile-filter-btn { display:flex !important }
          .sr-layout { flex-direction:column !important }
          .sr-sidebar-desktop { display:none !important }
        }
        @media(max-width:640px){
          .sr-grid { grid-template-columns:1fr !important; gap:10px !important }
          .sr-topbar { flex-wrap:wrap !important }
          .sc-root { height:auto !important; min-height:150px; }
          .sc-img-col { width:36% !important; max-width:none !important; min-height:150px; }
          .sc-content-col { padding:9px 11px 9px !important; }
        }
      `}</style>

      <MarketplaceHeader />

      {/* Mobile drawer backdrop */}
      {drawerOpen && <div onClick={()=>setDrawerOpen(false)} style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}/>}

      {/* Mobile drawer */}
      <div style={{ position:'fixed', top:0, right:0, bottom:0, zIndex:50, width:'300px', maxWidth:'90vw', background:'#ffffff', borderLeft:'1px solid rgba(0,0,0,0.08)', transform: drawerOpen?'translateX(0)':'translateX(100%)', transition:'transform 0.3s cubic-bezier(0.22,1,0.36,1)', display:'flex', flexDirection:'column', fontFamily:"'Outfit',sans-serif" }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
          <h2 style={{ color:'#111827', fontWeight:'800', fontSize:'15px', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
            <SlidersHorizontal size={15} style={{ color:'#dc2626' }}/> Filters
            {activeChips.length>0 && <span style={{ background:'#dc2626', color:'white', fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'20px' }}>{activeChips.length}</span>}
          </h2>
          <button onClick={()=>setDrawerOpen(false)} style={{ background:'rgba(0,0,0,0.05)', border:'none', cursor:'pointer', color:'#6b7280', borderRadius:'8px', padding:'6px', display:'flex' }}><X size={16}/></button>
        </div>
        <div className="sr-sidebar" style={{ flex:1, overflowY:'auto', padding:'8px 20px' }}><Filters/></div>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(0,0,0,0.08)', display:'flex', gap:'10px' }}>
          <button onClick={resetAll} style={{ flex:1, background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.1)', color:'#6b7280', fontSize:'13px', fontWeight:'600', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Reset</button>
          <button onClick={()=>setDrawerOpen(false)} style={{ flex:2, background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'white', fontSize:'13px', fontWeight:'700', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Show {totalCount} cars</button>
        </div>
      </div>

      <div style={{ background:'#F7F6F2', minHeight:'100vh', fontFamily:"'Outfit',sans-serif" }}>

        {/* ── Top bar ── */}
        <div style={{ background:'rgba(247,246,242,0.96)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(0,0,0,0.07)', padding:'10px 0', position:'sticky', top:'64px', zIndex:20 }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 24px' }}>
            <div className="sr-topbar" style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              {/* Search */}
              <SearchAutocomplete
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search brand, model, variant…"
                wrapStyle={{ flex: 1, minWidth: '180px' }}
                navigateTo="/showroom"
                onSubmit={val => {
                  const sq = sanitize.q(val);
                  navigate(sq ? `/showroom?q=${encodeURIComponent(sq)}` : '/showroom');
                }}
              />
              {/* Sort */}
              <select value={sort} onChange={e=>setParam('sort',e.target.value)} style={{ background:'#ffffff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:'9px', padding:'7px 12px', color:'#111827', fontSize:'13px', fontWeight:'600', cursor:'pointer', appearance:'none', fontFamily:"'Outfit',sans-serif", flexShrink:0 }}>
                {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {/* Mobile filter */}
              <button className="sr-fab sr-mobile-filter-btn" onClick={()=>setDrawerOpen(true)} style={{ display:'none', alignItems:'center', gap:'6px', background: activeChips.length>0?'rgba(220,38,38,0.08)':'#ffffff', border: activeChips.length>0?'1px solid rgba(220,38,38,0.3)':'1px solid rgba(0,0,0,0.1)', borderRadius:'9px', padding:'7px 12px', color: activeChips.length>0?'#dc2626':'#6b7280', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:"'Outfit',sans-serif", flexShrink:0 }}>
                <SlidersHorizontal size={13}/> Filters {activeChips.length>0&&`(${activeChips.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Brand strip ── */}
        <div style={{ borderBottom:'1px solid rgba(0,0,0,0.06)', padding:'24px 0', background:'#F7F6F2' }}>
          <div style={{ maxWidth:'1380px', margin:'0 auto', padding:'0 24px' }}>
            <div className="sr-brand-scroll" style={{ display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'4px', scrollbarWidth:'none' }}>
              {BRAND_LOGOS.map(({ label, to, logo, initials, color }) => {
                const active = brand === label || (label==='All' && !brand);
                return (
                  <Link key={label} to={to} style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', textDecoration:'none' }}>
                    <div style={{ width:'76px', height:'60px', borderRadius:'12px', padding:'10px', background: active?'rgba(220,38,38,0.08)':'#ffffff', border:`1px solid ${active?'rgba(220,38,38,0.35)':'rgba(0,0,0,0.09)'}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                      {logo
                        ? <img src={logo} alt={label} style={{ width:'100%', height:'100%', objectFit:'contain', filter:'none' }} onError={e=>{ e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}/>
                        : null}
                      <span style={{ display: logo?'none':'flex', alignItems:'center', justifyContent:'center', width:'36px', height:'36px', borderRadius:'7px', background: color||'rgba(0,0,0,0.08)', color:'#fff', fontSize:'10px', fontWeight:'700', fontFamily:"'Outfit',sans-serif" }}>{initials}</span>
                    </div>
                    <span style={{ fontSize:'10px', color: active?'#dc2626':'#6b7280', fontFamily:"'Outfit',sans-serif", fontWeight: active?'700':'500', textAlign:'center', maxWidth:'76px', lineHeight:1.2 }}>{label}</span>
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
                <span style={{ color:'#111827', fontWeight:'700' }}>{loading?'…':totalCount.toLocaleString()}</span> cars found
              </span>
              {activeChips.map(chip => (
                <span key={chip.key} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.25)', color:'#f87171', fontSize:'12px', fontWeight:'600', padding:'4px 10px', borderRadius:'20px' }}>
                  {chip.label}
                  <button onClick={()=>{ if(chip.key==='price_range'){const n=new URLSearchParams(searchParams);n.delete('min_price');n.delete('max_price');n.delete('page');setSearchParams(n,{replace:true});}else if(chip.key==='hot_deals'){setParam('hot_deals','');}else if(chip.key==='brand'){const n=new URLSearchParams(searchParams);n.delete('brand');n.delete('model');n.delete('page');setSearchParams(n,{replace:true});}else{setParam(chip.key,'');} }} style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', padding:0, display:'flex' }}><X size={10}/></button>
                </span>
              ))}
              {hasFilters && <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'12px', fontWeight:'600', fontFamily:"'Outfit',sans-serif" }}><RotateCcw size={11} style={{ marginRight:3 }}/>Clear all</button>}
            </div>
            <PriceAlertButton
              hasFilters={hasFilters}
              filters={{
                brand:     brand     || null,
                model:     model     || null,
                variant:   variant   || null,
                bodyType:  bodyType  || null,
                state:     state     || null,
                condition: condition || null,
                maxPrice:  maxPrice  || null,
                minYear:   yearFrom  || null,
                maxYear:   yearTo    || null,
              }}
            />
          </div>

          <div className="sr-layout" style={{ display:'flex', gap:'24px', alignItems:'flex-start' }}>

            {/* Left filter sidebar — always visible on desktop */}
            <aside className="sr-sidebar sr-sidebar-desktop" style={{ width:'230px', flexShrink:0, background:'#ffffff', border:'1px solid rgba(0,0,0,0.09)', borderRadius:'16px', padding:'16px', position:'sticky', top:'130px', maxHeight:'calc(100vh - 150px)', overflowY:'auto' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', paddingBottom:'12px', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
                <h2 style={{ color:'#111827', fontSize:'13px', fontWeight:'800', margin:0, display:'flex', alignItems:'center', gap:'6px', fontFamily:"'Outfit',sans-serif" }}>
                  <SlidersHorizontal size={13} style={{ color:'#dc2626' }}/>
                  Filters
                  {activeChips.length>0 && <span style={{ background:'#dc2626', color:'white', fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'20px' }}>{activeChips.length}</span>}
                </h2>
                {hasFilters && <button onClick={resetAll} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px', fontFamily:"'Outfit',sans-serif" }}><RotateCcw size={10}/> Reset</button>}
              </div>
              <Filters/>
            </aside>

            {/* Car grid */}
            <div style={{ flex:1, minWidth:0 }}>
              {error && (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <p style={{ color:'#f87171', fontSize:'16px', marginBottom:'16px' }}>{error}</p>
                  <button onClick={fetchCars} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'12px 24px', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Try Again</button>
                </div>
              )}
              {!error && (
                <div style={{ position:'relative' }}>
                  {fetching && <div style={{ position:'absolute', inset:0, zIndex:5, background:'rgba(247,246,242,0.6)', borderRadius:'12px', backdropFilter:'blur(2px)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'8px' }}><span style={{ background:'rgba(220,38,38,0.9)', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'4px 10px', borderRadius:'20px', fontFamily:"'Outfit',sans-serif" }}>Updating…</span></div>}
                <div className="sr-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'14px', opacity: fetching?0.45:1, transition:'opacity 0.2s' }}>
                  {loading
                    ? Array.from({ length:PER_PAGE }).map((_,i)=><Skeleton key={i}/>)
                    : cars.length===0
                      ? (
                        <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'80px 20px' }}>
                          <Car size={52} color="#9ca3af" style={{ marginBottom:'16px' }}/>
                          <p style={{ color:'#374151', fontSize:'18px', fontWeight:'600', marginBottom:'8px' }}>No cars match your filters</p>
                          <p style={{ color:'#6b7280', fontSize:'14px', marginBottom:'24px' }}>Try adjusting your search or browse all available cars.</p>
                          <button onClick={resetAll} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'12px 28px', borderRadius:'50px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>Browse All Cars</button>
                        </div>
                      )
                      : cars.map(car=>{
                          const inCompare=isInCompare(car.id), compareFull=compareIds.length>=4&&!inCompare;
                          return (
                            <ShowroomCard
                              key={car.id}
                              car={car}
                              ctaContext={ctaCtx}
                              inCompare={inCompare}
                              compareFull={compareFull}
                              onCompare={()=>{ inCompare?removeFromCompare(car.id):addToCompare(car.id); }}
                            />
                          );
                        })
                  }
                </div>
                </div>
              )}
              {!loading && !error && totalPages>1 && (
                <div style={{ padding:'40px 0 20px' }}>
                  <Pagination page={page} totalPages={totalPages} onPage={setPage}/>
                  <p style={{ textAlign:'center', color:'#6b7280', fontSize:'13px', marginTop:'12px' }}>
                    Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,totalCount)} of {totalCount.toLocaleString()} cars
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="sr-fab" style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:30 }}>
        <button onClick={()=>setDrawerOpen(true)} style={{ display:'flex', alignItems:'center', gap:'8px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', border:'none', color:'white', fontSize:'13px', fontWeight:'700', padding:'13px 24px', borderRadius:'50px', cursor:'pointer', boxShadow:'0 8px 24px rgba(220,38,38,0.4)', fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' }}>
          <SlidersHorizontal size={14}/>
          Filters {activeChips.length>0&&`(${activeChips.length})`}
        </button>
      </div>

      <Footer/>
    </>
  );
}
