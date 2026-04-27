import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Gauge, Zap, Settings, Droplets, Palette, ChevronLeft, ChevronRight, ArrowLeft, ZoomIn, ZoomOut, X, Calculator, Shield, Eye, BadgeCheck, ShieldCheck, FileText, Wrench, Star, Package, PlayCircle, Phone, ExternalLink } from 'lucide-react';
import { getCategoryCfg } from '../utils/serviceCategories';
import { getEmbedUrl } from '../utils/videoEmbed';
import { supabase } from '../supabaseClient';
import FinancingCalculator from '../components/FinancingCalculator';
import CarCard from '../components/CarCard';
import { useCTAContext, buildWaUrl } from '../hooks/useCTAContext';
import { captureRef, getRef } from '../utils/refTracking';
import { trackEvent } from '../utils/analytics';

/* ─── helpers ─── */
const fmt      = (n) => Number(n).toLocaleString('en-MY');
const fmtPrice = (n) => `RM ${fmt(n)}`;

/* 90% loan, 3.5% flat p.a., 7-year tenure */
const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  return Math.round((price * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12));
};

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(/,|\n/).map(s => s.trim()).filter(Boolean);
}

const CDP_DOC_TYPES = {
  puspakom:        { label: 'Puspakom Inspection',   color: '#22c55e' },
  service_history: { label: 'Service History',        color: '#60a5fa' },
  insurance:       { label: 'Insurance Certificate',  color: '#a78bfa' },
  ownership:       { label: 'Ownership / VOC',        color: '#fbbf24' },
  warranty:        { label: 'Warranty Certificate',   color: '#34d399' },
  import_ap:       { label: 'Import / AP Permit',     color: '#fb923c' },
  loan_clearance:  { label: 'Loan Clearance Letter',  color: '#94a3b8' },
  other:           { label: 'Document',               color: '#6b7280' },
};

const inputStyle = (focused) => ({
  width: '100%', background: 'rgba(255,255,255,0.03)',
  border: `1px solid ${focused ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.08)'}`,
  borderRadius: '8px', padding: '10px 14px', color: 'white',
  fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
  outline: 'none', marginBottom: '8px', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
});

/* ─── skeleton ─── */
function Skeleton() {
  return (
    <div style={{ background: '#0d0d0d', minHeight: '100vh' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .sk { background: linear-gradient(90deg, #111111 25%, #1a1a1a 50%, #111111 75%);
              background-size: 600px 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
      `}</style>
      {/* header bar skeleton */}
      <div style={{ height: 52, background: 'rgba(8,12,20,0.92)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px', display: 'flex', gap: 32, height: 'calc(100vh - 52px)', boxSizing: 'border-box' }}>
        <div style={{ flex: 1.3, display: 'flex', gap: 8 }}>
          <div className="sk" style={{ flex: 1 }} />
          <div style={{ width: 68, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="sk" style={{ height: 50 }} />)}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <div className="sk" style={{ height: 14, width: '35%' }} />
          <div className="sk" style={{ height: 44, width: '80%' }} />
          <div className="sk" style={{ height: 12, width: '55%' }} />
          <div className="sk" style={{ height: 1, width: '100%', marginTop: 8 }} />
          <div className="sk" style={{ height: 48, width: '60%' }} />
          <div className="sk" style={{ height: 160, borderRadius: 12, marginTop: 16 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── structured data ─── */
function useCarSchema(listing) {
  useEffect(() => {
    if (!listing) return;
    const name = [listing.year, listing.brand, listing.model, listing.variant].filter(Boolean).join(' ');
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Car',
      name,
      brand: { '@type': 'Brand', name: listing.brand },
      model: listing.model,
      vehicleModelDate: String(listing.year ?? ''),
      vehicleConfiguration: listing.variant ?? undefined,
      bodyType: listing.body_type ?? undefined,
      vehicleTransmission: listing.transmission ?? undefined,
      fuelType: listing.fuel_type ?? undefined,
      color: listing.colour ?? undefined,
      mileageFromOdometer: listing.mileage
        ? { '@type': 'QuantitativeValue', value: listing.mileage, unitCode: 'KMT' }
        : undefined,
      image: listing.images ?? undefined,
      url: `https://xdrive.my/cars/${listing.slug}`,
      offers: {
        '@type': 'Offer',
        price: listing.selling_price,
        priceCurrency: 'MYR',
        availability: listing.status === 'available'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
        itemCondition: listing.is_recon
          ? 'https://schema.org/RefurbishedCondition'
          : 'https://schema.org/UsedCondition',
      },
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'car-schema';
    el.textContent = JSON.stringify(JSON.parse(JSON.stringify(schema)));
    document.head.appendChild(el);
    return () => { document.getElementById('car-schema')?.remove(); };
  }, [listing?.id]);
}

/* ─── main ─── */
export default function CarDetailPage() {
  const { slug }  = useParams();
  const navigate  = useNavigate();

  const [car, setCar]             = useState(null);
  const [dealer, setDealer]       = useState(null);
  const ctaCtx = useCTAContext();
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [similarCars, setSimilarCars] = useState([]);
  const [salesmanProfile, setSalesmanProfile] = useState(null);

  /* gallery */
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [slideDir,   setSlideDir]   = useState('next');
  const [slideKey,   setSlideKey]   = useState(0);
  const [imgLoaded,  setImgLoaded]  = useState(false);

  /* reset shimmer whenever slide changes */
  useEffect(() => { setImgLoaded(false); }, [slideKey]);

  /* sticky title */
  const [showTitle, setShowTitle] = useState(false);
  const heroRef   = useRef(null);
  const autoRef   = useRef(null);   // stores interval id

  /* booking */
  const [form, setForm]           = useState({ name: '', phone: '+60', date: '', time: '09:00', notes: '' });
  const [focusedField, setFocused] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked]         = useState(false);
  const bookingRef = useRef(null);

  /* enquiry modal */
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '' });
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);

  /* calculator */
  const [calcOpen, setCalcOpen] = useState(false);

  /* detail tabs: 'specs' | 'features' | 'options' */
  const [detailTab, setDetailTab] = useState('specs');

  /* lightbox */
  const [lbOpen, setLbOpen]   = useState(false);
  const [lbZoom, setLbZoom]   = useState(1);
  const [lbPan,  setLbPan]    = useState({ x: 0, y: 0 });
  const lbDrag       = useRef({ active: false, ox: 0, oy: 0 });
  const lbOpenRef    = useRef(false);   // readable inside interval without stale closure
  const lbTouch      = useRef({ startX: 0, startY: 0 });  // lightbox touch swipe
  const pauseRef     = useRef(false);   // true while autoplay is paused after manual nav
  const resumeTimer  = useRef(null);    // timer id to resume autoplay
  const galleryTouch = useRef({ startX: 0, startY: 0 });  // main gallery touch swipe

  function closeLb() { setLbOpen(false); setLbZoom(1); setLbPan({ x: 0, y: 0 }); }

  useEffect(() => {
    lbOpenRef.current = lbOpen;
    if (!lbOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeLb(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lbOpen]);

  function lbWheel(e) {
    e.preventDefault();
    setLbZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.0012)));
  }
  function lbMouseDown(e) {
    e.preventDefault();
    lbDrag.current = { active: true, ox: e.clientX - lbPan.x, oy: e.clientY - lbPan.y };
  }
  function lbMouseMove(e) {
    if (!lbDrag.current.active) return;
    setLbPan({ x: e.clientX - lbDrag.current.ox, y: e.clientY - lbDrag.current.oy });
  }
  function lbMouseUp() { lbDrag.current.active = false; }

  function lbTouchStart(e) {
    lbTouch.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  }
  function lbTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - lbTouch.current.startX;
    const dy = Math.abs(e.changedTouches[0].clientY - lbTouch.current.startY);
    if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return; // not a clear horizontal swipe
    const dir = dx < 0 ? 'next' : 'prev';
    setSlideDir(dir);
    setSlideKey(k => k + 1);
    setLbZoom(1); setLbPan({ x: 0, y: 0 });
    setActiveIdx(prev => {
      const len = car?.images?.length || 1;
      return dir === 'next' ? (prev + 1) % len : (prev - 1 + len) % len;
    });
  }

  /* ── capture ref on mount ── */
  useEffect(() => {
    captureRef();
  }, []);

  /* ── fetch ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      // Try by slug first; fall back to id for carousel links that use the listing UUID
      let { data: carData, error } = await supabase
        .from('car_listings').select('*').eq('slug', slug).maybeSingle();
      if (!carData && !error) {
        const res = await supabase
          .from('car_listings').select('*').eq('id', slug).maybeSingle();
        carData = res.data;
        error = res.error;
      }
      if (error || !carData) { setNotFound(true); setLoading(false); return; }
      // Cross-reference included_services with dealer_products.is_active
      // (works for authenticated dealers; anonymous users get [] from RLS → show all)
      let visibleServices = carData.included_services || [];
      if (carData.dealer_id && visibleServices.length > 0) {
        const { data: activeProducts } = await supabase
          .from('dealer_products')
          .select('id, is_active')
          .eq('dealer_id', carData.dealer_id);
        if (activeProducts && activeProducts.length > 0) {
          const activeIds = new Set(activeProducts.filter(p => p.is_active !== false).map(p => p.id));
          visibleServices = visibleServices.filter(s => !s.id || activeIds.has(s.id));
        }
        // If activeProducts === [] (RLS/anon block) we fall through and show all
      }
      setCar({ ...carData, included_services: visibleServices });

      if (carData.dealer_id) {
        const { data: d } = await supabase
          .from('public_dealer_profiles')
          .select('dealership,site_name,whatsapp_number,avatar_url,site_logo_url,slug')
          .eq('id', carData.dealer_id).maybeSingle();
        setDealer(d);

        const { data: salesmanData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, job_title, whatsapp_number, slug, plan')
          .eq('id', carData.dealer_id)
          .eq('role', 'salesman')
          .maybeSingle();
        setSalesmanProfile(salesmanData);
      }
      const refSlug = getRef();
      if (refSlug && carData.dealer_id) {
        supabase.from('analytics_events').insert({
          event_type: 'page_view',
          salesman_slug: refSlug,
          dealer_id: carData.dealer_id,
          metadata: { page: window.location.pathname },
        }).then(() => {});
      }

      // fetch similar listings — same brand first, fallback to any dealer listing
      if (carData.dealer_id) {
        const simFields = 'id, slug, year, brand, model, variant, selling_price, original_price, mileage, transmission, state, fuel_type, status, created_at, images, is_recon, auction_grade, interior_grade, import_country, car_documents';
        const { data: simBrand } = await supabase
          .from('car_listings')
          .select(simFields)
          .eq('dealer_id', carData.dealer_id)
          .eq('brand', carData.brand)
          .neq('status', 'sold')
          .neq('id', carData.id)
          .order('created_at', { ascending: false })
          .limit(6);
        if ((simBrand || []).length >= 3) {
          setSimilarCars(simBrand);
        } else {
          const { data: simAny } = await supabase
            .from('car_listings')
            .select(simFields)
            .eq('dealer_id', carData.dealer_id)
            .neq('status', 'sold')
            .neq('id', carData.id)
            .order('created_at', { ascending: false })
            .limit(6);
          const a = simBrand || [], b = simAny || [];
          setSimilarCars(b.length > a.length ? b : a);
        }
      }

      setLoading(false);
    }
    load();
  }, [slug]);

  useCarSchema(car);

  /* ── car_view analytics — fires once per car after data loads ── */
  useEffect(() => {
    if (!car) return;
    trackEvent(supabase, 'car_view', {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      page_path: window.location.pathname,
      metadata: { price: car.selling_price, colour: car.colour },
    });
  }, [car?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── auto-slide ── */
  useEffect(() => {
    if (!car) return;
    const imgs = car?.images?.length ? car.images : [];
    if (imgs.length <= 1) return;
    autoRef.current = setInterval(() => {
      if (lbOpenRef.current || pauseRef.current) return;  // paused while lightbox open or after manual nav
      setSlideDir('next');
      setSlideKey(k => k + 1);
      setActiveIdx(i => (i + 1) % imgs.length);
    }, 2000);
    return () => clearInterval(autoRef.current);
  }, [car]);

  /* ── intersection observer for sticky title ── */
  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => setShowTitle(!e.isIntersecting), { threshold: 0 }
    );
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, [car]);

  /* ── manual nav — pauses autoplay for 4s then resumes ── */
  function go(idx, dir) {
    pauseRef.current = true;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { pauseRef.current = false; }, 4000);
    setSlideDir(dir);
    setSlideKey(k => k + 1);
    setActiveIdx(idx);
    setLbZoom(1); setLbPan({ x: 0, y: 0 });
  }

  /* ── main gallery swipe ── */
  function galleryTouchStart(e) {
    galleryTouch.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  }
  function galleryTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - galleryTouch.current.startX;
    const dy = Math.abs(e.changedTouches[0].clientY - galleryTouch.current.startY);
    if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return;
    const dir = dx < 0 ? 'next' : 'prev';
    const len = car?.images?.length || 1;
    const targetIdx = dir === 'next' ? (activeIdx + 1) % len : (activeIdx - 1 + len) % len;
    go(targetIdx, dir);
  }

  /* ── WhatsApp ── */
  function handleWhatsApp() {
    setShowEnquiryModal(true);
  }

  /* ── Call ── */
  function handleCall() {
    const phone = contactPhone?.replace(/\D/g, '');
    if (!phone) return;
    trackEvent(supabase, 'call_click', {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      metadata: { source: 'car_detail' },
    });
    window.location.href = `tel:+${phone}`;
  }

  async function handleEnquirySubmit() {
    setEnquirySubmitting(true);
    trackEvent(supabase, 'whatsapp_click', {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      metadata: { source: 'storefront', price: car.selling_price },
    });
    const { data: listing } = await supabase
      .from('car_listings')
      .select('dealer_id, assigned_to')
      .eq('id', car.id)
      .single();
    if (listing) {
      const { error: enqErr } = await supabase.from('whatsapp_enquiries').insert({
        dealer_id: listing.dealer_id,
        salesman_id: listing.assigned_to,
        listing_id: car.id,
        buyer_name: enquiryForm.name,
        buyer_phone: enquiryForm.phone,
        buyer_message: `Enquiry about ${car.brand} ${car.model} ${car.variant || ''}`.trim(),
        ref_slug: getRef() || null,
        source: 'storefront',
        status: 'new',
      });
      if (enqErr) console.error('[handleEnquirySubmit] insert error:', enqErr.message, enqErr);
    }
    const message = `Hi, I'm ${enquiryForm.name}. I'm interested in the ${car.brand} ${car.model}${car.variant ? ' ' + car.variant : ''} listed at RM ${car.selling_price?.toLocaleString()}. My number is ${enquiryForm.phone}.`;
    window.open(buildWaUrl(ctaCtx, contactPhone, message), '_blank');
    setShowEnquiryModal(false);
    setEnquirySubmitting(false);
    setEnquiryForm({ name: '', phone: '' });
  }

  /* ── booking ── */
  async function handleBook(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    // Resolve salesman_id: prefer ref slug → profile id, fall back to assigned_to
    let salesmanId = car.assigned_to || null;
    const refSlug = getRef();
    if (refSlug) {
      const { data: sm } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', refSlug)
        .maybeSingle();
      if (sm?.id) salesmanId = sm.id;
    }

    const [h, m] = form.time.split(':');
    const dt = new Date(`${form.date}T${h.padStart(2,'0')}:${m}:00`);
    const { error: bookErr } = await supabase.from('appointments').insert({
      dealer_id: car.dealer_id,
      salesman_id: salesmanId,
      car_listing_id: car.id,
      buyer_name: form.name,
      buyer_phone: form.phone,
      appointment_date: dt.toISOString(),
      notes: form.notes || null,
      status: 'confirmed',
    });
    setSubmitting(false);
    if (bookErr) {
      console.error('[handleBook] insert error:', bookErr.message, bookErr);
      alert('Booking failed. Please try again.');
      return;
    }
    setBooked(true);
  }

  /* ── early returns ── */
  if (loading)  return <Skeleton />;
  if (notFound) return (
    <div style={{ background:'#060c14', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <p style={{ fontSize:15, color:'#475569', marginBottom:20 }}>This listing is no longer available.</p>
      <Link to="/cars" style={{ color:'#dc2626', fontSize:13, textDecoration:'none' }}>← Browse all cars</Link>
    </div>
  );

  const images     = car.images?.length ? car.images : ['/placeholder-car.jpg'];
  const contactPhone = dealer?.whatsapp_number || salesmanProfile?.whatsapp_number || null;
  const isRecon    = car.is_recon;
  const isHot      = car.original_price && car.original_price > 0 && car.selling_price > 0 && car.selling_price <= car.original_price * 0.97;
  const saving     = isHot ? car.original_price - car.selling_price : 0;
  const hasDocuments = Array.isArray(car.car_documents) && car.car_documents.length > 0;
  const carTitle   = `${car.year} ${car.brand} ${car.model}${car.variant ? ' ' + car.variant : ''}`;
  const dealerName = dealer?.site_name || dealer?.dealership || dealer?.full_name || 'Dealer';
  const listedDays = daysAgo(car.created_at);
  const allTags    = [...new Set([...parseTags(car.features), ...parseTags(car.options)])];
  const today      = new Date().toISOString().split('T')[0];

  const imgCount = images.length;
  const prevIdx  = (activeIdx - 1 + imgCount) % imgCount;
  const nextIdx  = (activeIdx + 1) % imgCount;

  const siteName = dealer?.site_name || dealer?.dealership || 'XDrive';

  return (
    <>
      <Helmet>
        <title>{car ? `${car.year} ${car.brand} ${car.model} for sale in Malaysia | ${siteName}` : `Car Listing | ${siteName}`}</title>
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="description" content={car ? `${car.year} ${car.brand} ${car.model}${car.variant ? ` ${car.variant}` : ''} for sale in Malaysia. RM ${Number(car.selling_price).toLocaleString('en-MY')}, ${car.mileage ? `${Number(car.mileage).toLocaleString('en-MY')}km, ` : ''}${car.transmission || ''}. Verified dealer on XDrive.` : ''} />
        {car && <link rel="canonical" href={`https://xdrive.my/cars/${car.slug}`} />}
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060c14; overflow-x: hidden; }

        @keyframes cdp-from-right { from { transform: translateX(48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes cdp-from-left  { from { transform: translateX(-48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .cdp-slide-next { animation: cdp-from-right 0.42s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        .cdp-slide-prev { animation: cdp-from-left  0.42s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

        @keyframes cdp-shimmer-sweep { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .cdp-img-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, #0a1220 25%, #111e30 50%, #0a1220 75%);
          background-size: 400px 100%;
          animation: cdp-shimmer-sweep 1.4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .sk { background: linear-gradient(90deg, #111111 25%, #1a1a1a 50%, #111111 75%); background-size: 600px 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }

        @keyframes cdp-fadeUp    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cdp-fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdp-slideRight { from { width: 0; } to { width: var(--w); } }
        @keyframes cdp-scanLine  { 0% { top: 0; opacity: .6; } 100% { top: 100%; opacity: 0; } }
        @keyframes cdp-pulse     { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
        @keyframes cdp-shimmerIn { from { opacity: 0; transform: scaleX(0); } to { opacity: 1; transform: scaleX(1); } }

        .cdp-root {
          background: #060c14;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          color: #e2e8f0;
        }

        /* ── header ── */
        .cdp-header {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 56px;
          background: rgba(6,12,20,0.93);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cdp-back-btn {
          display: flex; align-items: center; gap: 7px;
          background: none; border: none; color: #64748b;
          font-size: 13px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; padding: 0;
          transition: color 0.2s; letter-spacing: 0.02em;
        }
        .cdp-back-btn:hover { color: #e2e8f0; }
        .cdp-header-title {
          font-size: 13px; font-weight: 500; color: white;
          opacity: 0; transition: opacity 0.3s; pointer-events: none;
          max-width: 40%; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cdp-header-title.visible { opacity: 1; }
        .cdp-enquire-btn {
          background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.28);
          color: #f87171; border-radius: 6px; padding: 6px 18px;
          font-size: 11px; cursor: pointer; letter-spacing: 0.08em;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
          text-transform: uppercase; font-weight: 600;
        }
        .cdp-enquire-btn:hover { background: rgba(220,38,38,0.18); border-color: rgba(220,38,38,0.5); color: white; }

        /* ── fold ── */
        .cdp-fold {
          display: flex;
          height: calc(100vh - 56px);
          overflow: hidden;
        }

        /* ── gallery ── */
        .cdp-gallery-col {
          flex: 1.65; display: flex; gap: 0; min-width: 0; overflow: hidden;
        }
        .cdp-main-wrap {
          flex: 1; position: relative;
          overflow: clip;
          height: 100%; min-width: 0;
          background: #080f18;
        }
        .cdp-main-img {
          width: 100%; height: 100%;
          object-fit: contain; display: block;
          cursor: zoom-in; will-change: transform;
        }
        .cdp-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(6,12,20,0.6); border: 1px solid rgba(255,255,255,0.1); color: white;
          width: 38px; height: 38px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; z-index: 4;
        }
        .cdp-arrow:hover { background: rgba(220,38,38,0.3); border-color: rgba(220,38,38,0.5); }
        .cdp-arrow-l { left: 14px; }
        .cdp-arrow-r { right: 14px; }

        .cdp-dots {
          position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
          max-width: 54px; overflow: hidden; z-index: 4; padding: 4px 0;
        }
        .cdp-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,0.35); padding: 0; border: none;
          cursor: pointer;
          transition: transform 0.35s ease, opacity 0.35s ease, background 0.2s;
        }
        .cdp-dot.active { background: white; }

        /* ── thumbs ── */
        .cdp-thumbs-v {
          width: 76px; display: flex; flex-direction: column;
          gap: 4px; overflow-y: auto; scrollbar-width: none;
          padding: 8px 6px;
          background: #060c14;
          border-left: 1px solid rgba(255,255,255,0.05);
        }
        .cdp-thumbs-v::-webkit-scrollbar { display: none; }
        .cdp-thumb-v {
          width: 64px; height: 46px; object-fit: cover;
          border-radius: 4px; cursor: pointer; flex-shrink: 0;
          opacity: 0.38; transition: opacity 0.2s, border-color 0.2s;
          border: 1px solid transparent;
        }
        .cdp-thumb-v.active { opacity: 1; border-color: #dc2626; }
        .cdp-thumb-v:hover:not(.active) { opacity: 0.68; }

        /* ── info col ── */
        .cdp-info-col {
          flex: 1; min-width: 300px; max-width: 460px;
          display: flex; flex-direction: column; justify-content: center;
          overflow-y: auto; scrollbar-width: none;
          padding: 32px 36px;
          background: #070e1a;
          border-left: 1px solid rgba(255,255,255,0.05);
        }
        .cdp-info-col::-webkit-scrollbar { display: none; }

        /* ── specs strip ── */
        .cdp-specs {
          background: #0a1220;
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; overflow-x: auto;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .cdp-specs::-webkit-scrollbar { display: none; }
        .cdp-spec {
          flex: 1; min-width: 120px; text-align: center;
          padding: 26px 16px;
          border-right: 1px solid rgba(255,255,255,0.04);
          transition: background .25s; cursor: default;
        }
        .cdp-spec:last-child { border-right: none; }
        .cdp-spec:hover { background: rgba(220,38,38,0.04); }

        /* ── content wrapper ── */
        .cdp-content { max-width: 1200px; margin: 0 auto; padding: 0 28px; }

        /* ── details section ── */
        .cdp-details {
          max-width: 1200px; margin: 0 auto;
          padding: 56px 28px 80px;
          display: flex; gap: 64px; align-items: flex-start;
        }
        .cdp-details-left  { flex: 1.5; min-width: 0; }
        .cdp-details-right { flex: 1; min-width: 260px; }

        /* ── rows ── */
        .cdp-row {
          padding: 12px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          display: flex; justify-content: space-between;
          align-items: center; gap: 12px;
          border-radius: 6px; transition: background .2s;
        }
        .cdp-row:hover { background: rgba(255,255,255,0.025); }

        /* ── similar ── */
        .cdp-similar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .cdp-similar-scroll { display: none; }

        /* ── mobile bar ── */
        .cdp-mobile-bar { display: none; }

        /* ── CTA button hover ── */
        .cdp-wa-btn:hover { transform: scale(1.02); box-shadow: 0 6px 24px rgba(34,197,94,0.3) !important; }

        /* ── lightbox ── */
        .cdp-lb-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.96);
          display: flex; align-items: center; justify-content: center;
          user-select: none;
        }
        .cdp-lb-img {
          max-width: 90vw; max-height: 88vh;
          object-fit: contain; display: block;
          transition: transform 0.08s linear; pointer-events: none;
        }
        .cdp-lb-close {
          position: absolute; top: 16px; right: 16px;
          background: rgba(255,255,255,0.08); border: none; color: white;
          width: 38px; height: 38px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.2s; z-index: 2;
        }
        .cdp-lb-close:hover { background: rgba(255,255,255,0.18); }
        .cdp-lb-zoom-bar {
          position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 12px;
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 40px; padding: 8px 16px;
        }
        .cdp-lb-zoom-btn {
          background: none; border: none; color: rgba(255,255,255,0.8);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 2px; transition: color 0.15s;
        }
        .cdp-lb-zoom-btn:hover { color: white; }
        .cdp-lb-zoom-label {
          font-size: 12px; color: rgba(255,255,255,0.6);
          font-family: 'DM Sans', sans-serif; min-width: 40px; text-align: center;
        }
        .cdp-lb-counter {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          font-size: 12px; color: rgba(255,255,255,0.5); font-family: 'DM Sans', sans-serif;
        }
        .cdp-lb-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(255,255,255,0.08); border: none; color: white;
          width: 44px; height: 44px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.2s; z-index: 2;
        }
        .cdp-lb-arrow:hover { background: rgba(255,255,255,0.18); }
        .cdp-lb-arrow-l { left: 20px; }
        .cdp-lb-arrow-r { right: 20px; }

        /* ── mobile ── */
        @media (max-width: 768px) {
          .cdp-root { padding-bottom: 70px; }
          .cdp-fold { flex-direction: column; height: auto; overflow: visible; }
          .cdp-gallery-col { height: clamp(240px, 56vw, 400px); flex: none; width: 100%; }
          .cdp-thumbs-v { display: none; }
          .cdp-info-col {
            min-width: 0; max-width: 100%; flex: none; width: 100%;
            padding: 28px 20px; justify-content: flex-start;
            border-left: none; border-top: 1px solid rgba(255,255,255,0.05);
            overflow-y: visible; overflow: visible;
          }
          .cdp-details { flex-direction: column; gap: 40px; padding: 40px 20px 60px; }
          .cdp-details-right { min-width: 0; width: 100%; max-width: 480px; }
          .cdp-content { padding: 0 20px; }
          .cdp-similar-grid { display: none; }
          .cdp-similar-scroll {
            display: flex; overflow-x: auto; gap: 16px;
            scroll-snap-type: x mandatory; scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .cdp-similar-scroll::-webkit-scrollbar { display: none; }
          .cdp-mobile-bar {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;
            background: rgba(6,12,20,0.97); backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255,255,255,0.07);
            padding: 12px 16px; gap: 10px;
          }
          .cdp-mobile-bar-wa {
            flex: 1; border-radius: 10px; font-size: 13px; font-weight: 700;
            font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
            background: #22c55e; color: white; padding: 13px 0;
          }
          .cdp-mobile-bar-book {
            flex: 1; border-radius: 10px; font-size: 13px; font-weight: 600;
            font-family: 'DM Sans', sans-serif; cursor: pointer;
            background: transparent; color: white; padding: 13px 0;
            border: 1px solid rgba(255,255,255,0.15);
          }
        }
        @media (max-width: 480px) {
          .cdp-arrow { display: none; }
        }
      `}</style>

      <div className="cdp-root">

        {/* ── header ── */}
        <header className="cdp-header">
          <button className="cdp-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className={`cdp-header-title${showTitle ? ' visible' : ''}`}>{carTitle}</span>
          <button className="cdp-enquire-btn" onClick={handleWhatsApp}>Enquire</button>
        </header>

        {/* ── hero fold ── */}
        <div className="cdp-fold" ref={heroRef}>

          {/* gallery */}
          <div className="cdp-gallery-col">
            <div className="cdp-main-wrap" onTouchStart={galleryTouchStart} onTouchEnd={galleryTouchEnd}>
              {!imgLoaded && <div className="cdp-img-shimmer" />}
              <img
                key={slideKey}
                className={`cdp-main-img cdp-slide-${slideDir}`}
                src={images[activeIdx]}
                alt={carTitle}
                fetchPriority={activeIdx === 0 ? 'high' : 'auto'}
                loading={activeIdx === 0 ? 'eager' : 'lazy'}
                style={{ opacity: 0, transform: 'scale(1.04)', transition: 'opacity 1.2s ease, transform 6s ease' }}
                onClick={() => setLbOpen(true)}
                onLoad={e => { setImgLoaded(true); e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1)'; }}
                onError={e => { e.target.src = '/placeholder-car.jpg'; setImgLoaded(true); }}
              />

              {imgCount > 1 && (
                <>
                  <button className="cdp-arrow cdp-arrow-l" onClick={() => go(prevIdx, 'prev')} aria-label="Previous">
                    <ChevronLeft size={18} />
                  </button>
                  <button className="cdp-arrow cdp-arrow-r" onClick={() => go(nextIdx, 'next')} aria-label="Next">
                    <ChevronRight size={18} />
                  </button>
                  {(() => {
                    const DOT_SLOT = 12;
                    const rawOffset  = -(activeIdx - 2) * DOT_SLOT;
                    const minOffset  = imgCount > 5 ? -(imgCount - 5) * DOT_SLOT : 0;
                    const trackShift = Math.min(0, Math.max(minOffset, rawOffset));
                    return (
                      <div className="cdp-dots">
                        <div style={{ display:'flex', gap:6, transform:`translateX(${trackShift}px)`, transition:'transform 0.35s ease' }}>
                          {images.map((_, i) => {
                            const dist = Math.abs(i - activeIdx);
                            return (
                              <button key={i} className={`cdp-dot${i === activeIdx ? ' active' : ''}`}
                                onClick={() => go(i, i > activeIdx ? 'next' : 'prev')} aria-label={`Image ${i + 1}`}
                                style={{
                                  opacity:   dist === 0 ? 1 : dist === 1 ? 0.65 : dist === 2 ? 0.35 : 0,
                                  transform: dist === 0 ? 'scaleX(2.8)' : dist === 1 ? 'scale(0.9)' : dist === 2 ? 'scale(0.7)' : 'scale(0)',
                                  pointerEvents: dist > 2 ? 'none' : 'auto',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* scan line */}
              <div style={{ position:'absolute', left:0, right:0, height:2, background:'linear-gradient(to right,transparent,rgba(220,38,38,.55),transparent)', animation:'cdp-scanLine 2s ease-out 0.3s 1 forwards', top:0, pointerEvents:'none', zIndex:5 }} />
              {/* left accent bar */}
              <div style={{ position:'absolute', top:0, left:0, bottom:0, width:3, background:'linear-gradient(to bottom,transparent,#dc2626,transparent)', opacity:0, animation:'cdp-fadeIn .6s ease 1s forwards', zIndex:5 }} />
              {/* bottom vignette */}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'42%', background:'linear-gradient(to top,rgba(7,14,26,0.75),transparent)', pointerEvents:'none', zIndex:3 }} />
            </div>

            {/* vertical thumbnails */}
            {imgCount > 1 && (
              <div className="cdp-thumbs-v">
                {images.map((src, i) => (
                  <img key={i} src={src} className={`cdp-thumb-v${i === activeIdx ? ' active' : ''}`}
                    alt={`View ${i + 1}`} loading="lazy" style={{ aspectRatio: '4/3' }}
                    onClick={() => go(i, i > activeIdx ? 'next' : 'prev')}
                    onError={e => { e.target.src = '/placeholder-car.jpg'; }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── info panel ── */}
          <div className="cdp-info-col">

            {/* badges */}
            {(isRecon || isHot || hasDocuments) && (
              <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap', animation:'cdp-fadeUp .5s ease .3s both' }}>
                {isRecon && (
                  <span style={{ background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.25)', color:'#c084fc', fontSize:'10px', padding:'3px 10px', borderRadius:'4px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>
                    Recon
                  </span>
                )}
                {isHot && (
                  <span style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.28)', color:'#f87171', fontSize:'10px', padding:'3px 10px', borderRadius:'4px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>
                    Hot Deal
                  </span>
                )}
                {hasDocuments && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.28)', color:'#4ade80', fontSize:'10px', padding:'3px 10px', borderRadius:'4px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>
                    <BadgeCheck size={11} /> Verified Docs
                  </span>
                )}
              </div>
            )}

            {/* brand label */}
            <p style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.22em', color:'#dc2626', marginBottom:5, fontWeight:700, animation:'cdp-fadeUp .6s ease .45s both' }}>
              {car.brand}
            </p>

            {/* model — Bebas Neue */}
            <h1 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(2.2rem, 3.8vw, 3.4rem)', color:'white', lineHeight:1, marginBottom:7, letterSpacing:'0.03em', animation:'cdp-fadeUp .6s ease .5s both' }}>
              {car.model}{car.variant ? ` ${car.variant}` : ''}
            </h1>

            {/* meta */}
            <p style={{ fontSize:'12px', color:'#475569', marginBottom:22, letterSpacing:'0.04em' }}>
              {[car.year, car.body_type, car.transmission].filter(Boolean).join('  ·  ')}
            </p>

            {/* divider */}
            <div style={{ height:1, background:'linear-gradient(to right,rgba(255,255,255,0.07),transparent)', marginBottom:22 }} />

            {/* price block */}
            <div style={{ marginBottom:20, animation:'cdp-fadeUp .6s ease .6s both' }}>
              <p style={{ fontSize:'9px', textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', marginBottom:5, fontWeight:700 }}>
                Selling Price
              </p>
              <div style={{ display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap' }}>
                <p style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(2rem, 3.8vw, 3rem)', color:'white', lineHeight:1, margin:0, letterSpacing:'0.02em' }}>
                  {fmtPrice(car.selling_price)}
                </p>
                {calcMonthly(car.selling_price) && (
                  <span style={{ fontSize:'12px', color:'#334155', whiteSpace:'nowrap' }}>
                    ~<span style={{ color:'#64748b', fontWeight:500 }}>RM {fmt(calcMonthly(car.selling_price))}</span>/mo
                  </span>
                )}
              </div>
              {isHot && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:7 }}>
                  <span style={{ fontSize:'13px', color:'#1e293b', textDecoration:'line-through' }}>
                    {fmtPrice(car.original_price)}
                  </span>
                  <span style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', color:'#f87171', fontSize:'11px', padding:'2px 10px', borderRadius:'20px', fontWeight:600, letterSpacing:'0.04em' }}>
                    SAVE {fmtPrice(saving)}
                  </span>
                </div>
              )}
            </div>

            {/* CTA card */}
            <div style={{ background:'#0b1422', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'20px', animation:'cdp-fadeUp .6s ease .8s both' }}>
              <p style={{ fontSize:'9px', color:'#334155', textTransform:'uppercase', letterSpacing:'0.18em', marginBottom:14, fontWeight:700 }}>
                Get in touch
              </p>

              <button className="cdp-wa-btn" onClick={handleWhatsApp}
                style={{ width:'100%', background:'#22c55e', color:'white', border:'none', borderRadius:'9px', padding:'13px', fontWeight:700, fontSize:'14px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", letterSpacing:'0.02em', boxShadow:'0 4px 20px rgba(34,197,94,0.2)', transition:'transform .15s, box-shadow .2s' }}>
                WhatsApp Dealer
              </button>

              <div style={{ display:'flex', gap:7, marginTop:7 }}>
                {contactPhone && (
                  <button onClick={handleCall}
                    style={{ flex:1, background:'none', border:'1px solid rgba(255,255,255,0.09)', color:'#94a3b8', borderRadius:'9px', padding:'11px', fontWeight:500, fontSize:'13px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .2s' }}>
                    <Phone size={13} /> Call
                  </button>
                )}
                <button onClick={() => {
                    trackEvent(supabase, 'booking_click', {
                      car_id: car.id,
                      car_name: `${car.brand} ${car.model} ${car.year}`,
                      dealer_id: car.dealer_id,
                      metadata: { source: 'car_detail' },
                    });
                    bookingRef.current?.scrollIntoView({ behavior:'smooth', block:'start' });
                  }}
                  style={{ flex:contactPhone ? 1 : undefined, width:contactPhone ? undefined : '100%', background:'none', border:'1px solid rgba(255,255,255,0.09)', color:'#94a3b8', borderRadius:'9px', padding:'11px', fontWeight:500, fontSize:'13px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all .2s' }}>
                  Book Visit
                </button>
              </div>

              <button onClick={() => setCalcOpen(true)}
                style={{ width:'100%', background:'none', border:'1px solid rgba(255,255,255,0.05)', color:'#334155', borderRadius:'9px', padding:'10px', fontWeight:500, fontSize:'12px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginTop:6, display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .2s', letterSpacing:'0.05em' }}>
                <Calculator size={13} /> Financing Calculator
              </button>

              <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'16px 0 14px' }} />

              {/* dealer row */}
              {(() => {
                const isAgent = !!salesmanProfile;
                const displayName = isAgent ? (salesmanProfile.full_name || 'Agent') : dealerName;
                const avatarSrc = isAgent ? salesmanProfile.avatar_url : (dealer?.site_logo_url || dealer?.avatar_url);
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt={displayName} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                      : <div style={{ width:32, height:32, borderRadius:'50%', background: isAgent ? '#1d4ed8' : '#111e2e', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', border:'1px solid rgba(255,255,255,0.08)' }}>
                          {displayName[0]?.toUpperCase()}
                        </div>
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'13px', color:'white', fontWeight:600, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</p>
                      <p style={{ fontSize:'11px', color: isAgent ? '#60a5fa' : '#334155' }}>
                        {isAgent ? 'Independent Agent' : (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'cdp-pulse 2s ease infinite' }} />
                            Verified Dealer
                          </span>
                        )}
                      </p>
                    </div>
                    {listedDays !== null && (
                      <p style={{ fontSize:'10px', color:'#1e293b', whiteSpace:'nowrap', flexShrink:0 }}>{listedDays}d ago</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── specs strip ── */}
        <div className="cdp-specs" style={{ animation:'cdp-fadeUp .5s ease .9s both' }}>
          {[
            { Icon: Gauge,    label: 'Mileage',      value: car.mileage     ? `${fmt(car.mileage)} km`   : '—' },
            { Icon: Zap,      label: 'Engine',       value: car.engine_cc   ? `${fmt(car.engine_cc)} cc` : '—' },
            { Icon: Settings, label: 'Transmission', value: car.transmission || '—' },
            { Icon: Droplets, label: 'Fuel',         value: car.fuel_type   || '—' },
            { Icon: Palette,  label: 'Colour',       value: car.colour      || '—' },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="cdp-spec">
              <Icon size={16} style={{ color:'#dc2626', marginBottom:8, opacity:0.75 }} />
              <p style={{ fontSize:'9px', textTransform:'uppercase', letterSpacing:'0.16em', color:'#334155', marginBottom:4, fontWeight:700 }}>{label}</p>
              <p style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'17px', letterSpacing:'0.04em', color:'#cbd5e1' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── video walkthrough ── */}
        {car.video_url && getEmbedUrl(car.video_url) && (
          <div className="cdp-content" style={{ padding:'32px 28px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:16, display:'flex', alignItems:'center', gap:7 }}>
              <PlayCircle size={13} style={{ color:'#dc2626' }} /> Watch Walkthrough
            </p>
            <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.07)' }}>
              <iframe
                src={getEmbedUrl(car.video_url)}
                style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }}
                allowFullScreen
                title={`${car.year} ${car.brand} ${car.model} walkthrough`}
              />
            </div>
          </div>
        )}

        {/* ── what's included ── */}
        {Array.isArray(car.included_services) && car.included_services.length > 0 && (
          <div className="cdp-content" style={{ padding:'32px 28px', borderTop:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:16 }}>What's Included</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {car.included_services.map((svc, i) => {
                const cfg = getCategoryCfg(svc.category);
                const CatIcon = cfg.icon;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, background:`${cfg.color}10`, border:`1px solid ${cfg.color}28`, borderRadius:8, padding:'6px 13px' }}>
                    <CatIcon size={13} style={{ color:cfg.color, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:cfg.color, fontWeight:600 }}>{svc.name}</span>
                  </div>
                );
              })}
            </div>
            {car.included_services_cost > 0 && (
              <p style={{ fontSize:11, color:'#334155', marginTop:12 }}>
                Estimated add-on value: <span style={{ color:'#60a5fa', fontWeight:700 }}>RM {Number(car.included_services_cost).toLocaleString()}</span>
              </p>
            )}
          </div>
        )}

        {/* ── car documents ── */}
        {hasDocuments && (
          <div className="cdp-content" style={{ padding:'32px 28px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <BadgeCheck size={13} style={{ color:'#4ade80' }} />
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700 }}>Verified Documents</p>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {car.car_documents.map((doc, i) => {
                const cfg = CDP_DOC_TYPES[doc.type] || CDP_DOC_TYPES.other;
                return (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${cfg.color}0d`, border:`1px solid ${cfg.color}30`, borderRadius:10, padding:'9px 14px', textDecoration:'none', transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = `${cfg.color}1a`}
                    onMouseLeave={e => e.currentTarget.style.background = `${cfg.color}0d`}
                  >
                    <BadgeCheck size={13} style={{ color:cfg.color, flexShrink:0 }} />
                    <div>
                      <p style={{ fontSize:12, fontWeight:600, color:cfg.color, margin:0 }}>{cfg.label}</p>
                      <p style={{ fontSize:10, color:'#334155', margin:'1px 0 0', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</p>
                    </div>
                    <ExternalLink size={11} style={{ color:cfg.color, opacity:0.6, flexShrink:0, marginLeft:2 }} />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ── details section ── */}
        <section className="cdp-details">

          {/* left — tabbed */}
          <div className="cdp-details-left">
            <p style={{ fontSize:'14px', color:'#64748b', lineHeight:1.9, marginBottom:36 }}>
              {car.specs || `${car.year} ${car.brand} ${car.model}, ${fmt(car.mileage)} km, ${car.transmission}, ${car.fuel_type}, ${car.colour}.`}
            </p>

            {(() => {
              const tabs = [
                { key: 'specs',    label: 'Specs' },
                ...(parseTags(car.features).length > 0 ? [{ key: 'features', label: 'Features' }] : []),
                ...(parseTags(car.options).length  > 0 ? [{ key: 'options',  label: 'Options'  }] : []),
              ];
              return (
                <>
                  <div style={{ display:'flex', gap:0, marginBottom:28, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    {tabs.map(t => (
                      <button key={t.key} onClick={() => setDetailTab(t.key)}
                        style={{
                          background:'none', border:'none',
                          borderBottom:`2px solid ${detailTab === t.key ? '#dc2626' : 'transparent'}`,
                          color: detailTab === t.key ? 'white' : '#334155',
                          padding:'10px 20px 12px', marginBottom:-1,
                          fontSize:'13px', fontWeight: detailTab === t.key ? 600 : 400,
                          cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
                          transition:'all .2s', letterSpacing:'0.04em',
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {detailTab === 'specs' && (
                    <div>
                      {[
                        { key: 'Registration Date', val: car.registration_date || car.local_reg_date || '—' },
                        { key: 'VIN / Chassis',     val: car.vin_number || '—' },
                        { key: 'Condition',         val: car.condition || '—' },
                        {
                          key: 'Chassis Status',
                          val: (
                            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background: car.chassis_status === 'clean' ? '#22c55e' : car.chassis_status === 'repaired' ? '#eab308' : car.chassis_status === 'written_off' ? '#dc2626' : '#334155' }} />
                              {car.chassis_status || '—'}
                            </span>
                          ),
                        },
                        { key: 'Location', val: [car.city, car.state].filter(Boolean).join(', ') || '—' },
                        ...(isRecon ? [
                          { key: 'Import Country', val: car.import_country || '—' },
                          { key: 'Auction House',  val: car.auction_house  || '—' },
                          { key: 'Exterior Grade', val: car.auction_grade  || '—' },
                          { key: 'Interior Grade', val: car.interior_grade || '—' },
                        ] : []),
                      ].map(({ key, val }) => (
                        <div key={key} className="cdp-row">
                          <span style={{ fontSize:'13px', color:'#475569' }}>{key}</span>
                          <span style={{ fontSize:'13px', color:'#e2e8f0', textAlign:'right' }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailTab === 'features' && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                      {parseTags(car.features).map((tag, i) => (
                        <span key={i} style={{ padding:'5px 12px', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', fontSize:'12px', color:'#64748b', background:'rgba(255,255,255,0.02)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {detailTab === 'options' && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                      {parseTags(car.options).map((tag, i) => (
                        <span key={i} style={{ padding:'5px 12px', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', fontSize:'12px', color:'#64748b', background:'rgba(255,255,255,0.02)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* right — booking form */}
          <div className="cdp-details-right" ref={bookingRef} id="booking-form">
            <div style={{ background:'#0b1422', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'24px' }}>
              <p style={{ fontSize:'9px', textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', marginBottom:20, fontWeight:700 }}>
                Book a Viewing
              </p>

              {booked ? (
                <div style={{ padding:'24px 0', textAlign:'center' }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:20, color:'#4ade80' }}>✓</div>
                  <p style={{ fontSize:'15px', color:'white', marginBottom:6, fontWeight:600 }}>Viewing Booked</p>
                  <p style={{ fontSize:'13px', color:'#475569' }}>We'll reach out on WhatsApp shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleBook}>
                  <input type="text" placeholder="Your name" required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                    style={inputStyle(focusedField === 'name')} />
                  <input type="tel" placeholder="Phone number" required value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                    style={inputStyle(focusedField === 'phone')} />
                  <input type="date" required min={today} value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    onFocus={() => setFocused('date')} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(focusedField === 'date'), colorScheme: 'dark' }} />
                  <select value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    onFocus={() => setFocused('time')} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(focusedField === 'time'), cursor: 'pointer' }}>
                    {['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => (
                      <option key={t} value={t} style={{ background: '#0d1117' }}>
                        {parseInt(t) < 12 ? `${parseInt(t)}:00 AM` : parseInt(t) === 12 ? '12:00 PM' : `${parseInt(t)-12}:00 PM`}
                      </option>
                    ))}
                  </select>
                  <textarea placeholder="Notes (optional)" rows={3} value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    onFocus={() => setFocused('notes')} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(focusedField === 'notes'), resize: 'vertical', minHeight: 72 }} />
                  <button type="submit" disabled={submitting}
                    style={{ width:'100%', background:'#dc2626', color:'white', border:'none', borderRadius:'9px', padding:'13px', fontWeight:700, fontSize:'14px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily:"'DM Sans',sans-serif", opacity: submitting ? 0.6 : 1, letterSpacing:'0.02em', transition:'opacity .2s' }}>
                    {submitting ? 'Booking…' : 'Confirm Viewing'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── calculator modal ── */}
        {calcOpen && (
          <div onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
            style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'DM Sans',sans-serif" }}>
            <div style={{ width:'100%', maxWidth:860, background:'#0b1422', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:'white', fontWeight:700, fontSize:14, margin:'0 0 2px', letterSpacing:'0.02em' }}>Financing &amp; Cost Calculator</p>
                  <p style={{ color:'#475569', fontSize:12, margin:0 }}>{carTitle}</p>
                </div>
                <button onClick={() => setCalcOpen(false)}
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'50%', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#64748b', transition:'all .2s' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ maxHeight:'80vh', overflowY:'auto' }}>
                <FinancingCalculator
                  initialPrice={car.selling_price}
                  engineCc={car.engine_cc}
                  bodyType={car.body_type}
                  carName={carTitle}
                  carYear={car.year ? String(car.year) : ''}
                  carColor={car.colour || ''}
                  flat
                />
              </div>
            </div>
          </div>
        )}

        {/* ── lightbox ── */}
        {lbOpen && (
          <div className="cdp-lb-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) closeLb(); }}
            onMouseMove={lbMouseMove} onMouseUp={lbMouseUp} onMouseLeave={lbMouseUp}>
            <button className="cdp-lb-close" onClick={closeLb} aria-label="Close"><X size={18} /></button>
            {imgCount > 1 && <span className="cdp-lb-counter">{activeIdx + 1} / {imgCount}</span>}
            {imgCount > 1 && (
              <>
                <button className="cdp-lb-arrow cdp-lb-arrow-l" onClick={() => go(prevIdx, 'prev')} aria-label="Previous"><ChevronLeft size={22} /></button>
                <button className="cdp-lb-arrow cdp-lb-arrow-r" onClick={() => go(nextIdx, 'next')} aria-label="Next"><ChevronRight size={22} /></button>
              </>
            )}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', cursor: lbZoom > 1 ? (lbDrag.current.active ? 'grabbing' : 'grab') : 'default', overflow:'hidden' }}
              onMouseDown={lbMouseDown} onWheel={lbWheel} onTouchStart={lbTouchStart} onTouchEnd={lbTouchEnd}>
              <img className="cdp-lb-img" src={images[activeIdx]} alt={carTitle} draggable={false}
                style={{ transform:`translate(${lbPan.x}px,${lbPan.y}px) scale(${lbZoom})`, transformOrigin:'center center', transition: lbDrag.current.active ? 'none' : 'transform 0.08s ease' }}
                onError={e => { e.target.src = '/placeholder-car.jpg'; }}
              />
            </div>
            <div className="cdp-lb-zoom-bar">
              <button className="cdp-lb-zoom-btn" onClick={() => { setLbZoom(z => Math.max(0.5, z - 0.25)); setLbPan({ x:0, y:0 }); }} aria-label="Zoom out"><ZoomOut size={16} /></button>
              <span className="cdp-lb-zoom-label">{Math.round(lbZoom * 100)}%</span>
              <button className="cdp-lb-zoom-btn" onClick={() => setLbZoom(z => Math.min(5, z + 0.25))} aria-label="Zoom in"><ZoomIn size={16} /></button>
              <div style={{ width:1, height:14, background:'rgba(255,255,255,0.15)', margin:'0 2px' }} />
              <button className="cdp-lb-zoom-btn" onClick={() => { setLbZoom(1); setLbPan({ x:0, y:0 }); }}
                style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", color:'rgba(255,255,255,0.5)', letterSpacing:'0.05em' }}>Reset</button>
            </div>
          </div>
        )}

        {/* ── salesman card ── */}
        {salesmanProfile && (() => {
          const waPhone = (salesmanProfile.whatsapp_number || '').replace(/\D/g, '');
          const waHref = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}` : null;
          const firstName = (salesmanProfile.full_name || 'Agent').split(' ')[0];
          return (
            <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 28px 52px' }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#1e293b', fontWeight:700, marginBottom:12 }}>Listed by</p>
              <div style={{ background:'#0b1422', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'20px', maxWidth:380 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                  {salesmanProfile.avatar_url
                    ? <img src={salesmanProfile.avatar_url} alt={salesmanProfile.full_name} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:52, height:52, borderRadius:'50%', background:'#1d4ed8', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff' }}>
                        {(salesmanProfile.full_name || 'S')[0].toUpperCase()}
                      </div>
                  }
                  <div>
                    <p style={{ fontSize:15, fontWeight:700, color:'white', margin:0 }}>{salesmanProfile.full_name || 'Agent'}</p>
                    {salesmanProfile.job_title && <p style={{ fontSize:12, color:'#475569', margin:'3px 0 0' }}>{salesmanProfile.job_title}</p>}
                    <p style={{ fontSize:11, color:'#1e293b', margin:'2px 0 0', letterSpacing:'0.05em' }}>Independent Agent · XDrive</p>
                  </div>
                </div>
                {waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer"
                    style={{ display:'block', width:'100%', background:'#22c55e', color:'white', borderRadius:9, padding:'12px 0', fontWeight:700, fontSize:13, fontFamily:"'DM Sans',sans-serif", textAlign:'center', textDecoration:'none', boxSizing:'border-box', letterSpacing:'0.02em' }}>
                    Chat with {firstName}
                  </a>
                )}
                {salesmanProfile.plan === 'salesman_full' && salesmanProfile.slug && (
                  <Link to={`/s/${salesmanProfile.slug}`} style={{ display:'block', textAlign:'center', marginTop:10, fontSize:12, color:'#60a5fa', textDecoration:'none' }}>
                    View all listings →
                  </Link>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── similar listings ── */}
        {similarCars.length > 0 && (
          <section style={{ borderTop:'1px solid rgba(255,255,255,0.05)', maxWidth:1200, margin:'0 auto', padding:'56px 28px 80px', fontFamily:"'DM Sans', sans-serif" }}>
            <p style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.2em', color:'#1e293b', margin:'0 0 6px', fontWeight:700 }}>
              You might also like
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:32 }}>
              <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'2.4rem', letterSpacing:'0.06em', color:'white', margin:0, animation:'cdp-fadeUp .6s ease .2s both', flexShrink:0 }}>
                More {car.brand}
              </h2>
              <div style={{ flex:1, height:1, background:'linear-gradient(to right,rgba(220,38,38,0.25),transparent)' }} />
            </div>
            <div className="cdp-similar-grid">
              {similarCars.map(s => <CarCard key={s.id} car={s} ctaContext={ctaCtx} />)}
            </div>
            <div className="cdp-similar-scroll">
              {similarCars.map(s => (
                <div key={s.id} style={{ flexShrink:0, width:'72vw', scrollSnapAlign:'start' }}>
                  <CarCard car={s} ctaContext={ctaCtx} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── mobile sticky bar ── */}
      <div className="cdp-mobile-bar">
        <button className="cdp-mobile-bar-wa" onClick={handleWhatsApp}>WhatsApp</button>
        {contactPhone && (
          <button className="cdp-mobile-bar-book" onClick={handleCall}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Phone size={14} /> Call
          </button>
        )}
      </div>

      {/* ── enquiry modal ── */}
      {showEnquiryModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-1">Contact Dealer</h3>
            <p className="text-gray-400 text-sm mb-4">Enter your details to continue to WhatsApp</p>
            <input
              placeholder="Your name"
              value={enquiryForm.name}
              onChange={e => setEnquiryForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm mb-3 outline-none focus:border-red-600"
            />
            <input
              placeholder="Phone number (e.g. 0123456789)"
              value={enquiryForm.phone}
              onChange={e => setEnquiryForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm mb-4 outline-none focus:border-red-600"
            />
            <button
              onClick={handleEnquirySubmit}
              disabled={!enquiryForm.name || !enquiryForm.phone || enquirySubmitting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm"
            >
              {enquirySubmitting ? 'Opening WhatsApp...' : 'Continue to WhatsApp'}
            </button>
            <button onClick={() => setShowEnquiryModal(false)} className="w-full mt-2 text-gray-500 text-sm py-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
