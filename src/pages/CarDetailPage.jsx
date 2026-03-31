import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { trackEvent, getRef } from '../lib/analytics';
import {
  MapPin, Gauge, Settings, Calendar, CheckCircle, MessageCircle,
  Phone, Clock, ChevronRight, Fuel, Tag, Palette, FileText,
  TrendingDown, ArrowLeft, Share2, Heart, X, ZoomIn,
  ShieldCheck, Star, Calculator, ChevronLeft, ChevronDown, Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import CarCard from '@/components/CarCard';
import FinancingCalculator from '@/components/FinancingCalculator';
import GradeBadge from '@/components/GradeBadge';
import DamageMap from '@/components/DamageMap';
import { supabase } from '../supabaseClient';
import { useSiteProfile } from '../hooks/useSiteProfile';

/* ── helpers ─────────────────────────────────────────────── */
const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  return Math.round((price * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12));
};

const calcRoadTax = (cc, bodyType = 'Sedan') => {
  if (!cc || cc <= 0) return null;
  const ns = bodyType && ['SUV', 'MPV', 'Pickup'].includes(bodyType);
  const c = Number(cc);
  if (c <= 1000) return 20;
  if (c <= 1200) return 55;
  if (c <= 1400) return 70;
  if (c <= 1600) return 90;
  if (c <= 1800) return Math.round(200 + (c - 1600) * (ns ? 0.40 : 0.50));
  if (c <= 2000) return Math.round(280 + (c - 1800) * (ns ? 0.40 : 0.50));
  if (c <= 2500) return Math.round(380 + (c - 2000) * 1.00);
  if (c <= 3000) return Math.round(880 + (c - 2500) * (ns ? 2.50 : 4.50));
  return Math.round((ns ? 2130 : 3130) + (c - 3000) * (ns ? 2.50 : 4.50));
};

const preloadImages = (urls = []) => {
  urls.forEach(url => { if (url) { const i = new Image(); i.src = url; } });
};

const STATUS = {
  active:   { label: 'Available', color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  reserved: { label: 'Reserved',  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
  sold:     { label: 'Sold',      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

/* ── Lightbox ────────────────────────────────────────────── */
const Lightbox = ({ images, startIdx, onClose }) => {
  const [idx, setIdx] = useState(startIdx);
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}
      onClick={onClose}
    >
      <button onClick={e => { e.stopPropagation(); prev(); }}
        style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10 }}>
        <ChevronLeft size={20} />
      </button>

      <img
        src={images[idx]} alt={`Photo ${idx + 1}`}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px' }}
      />

      <button onClick={e => { e.stopPropagation(); next(); }}
        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10 }}>
        <ChevronRight size={20} />
      </button>

      <button onClick={onClose}
        style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
        <X size={18} />
      </button>

      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
        {idx + 1} / {images.length}
      </div>

      {/* Thumbnail strip */}
      <div style={{ position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', maxWidth: '80vw', overflowX: 'auto', padding: '4px' }}>
        {images.map((img, i) => (
          <img key={i} src={img} alt="" onClick={e => { e.stopPropagation(); setIdx(i); }}
            style={{ width: '52px', height: '36px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: i === idx ? '2px solid #dc2626' : '2px solid transparent', opacity: i === idx ? 1 : 0.5, transition: 'all 0.15s', flexShrink: 0 }}
          />
        ))}
      </div>
    </motion.div>
  );
};

/* ── Photo Gallery ───────────────────────────────────────── */
const PhotoGallery = ({ images, carName }) => {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const shown = images.slice(0, 5);
  const remaining = images.length - 5;

  if (images.length === 0) return (
    <div style={{ height: 'clamp(240px,33vh,300px)', background: '#0d1117', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ margin: '0 auto 8px', display: 'block' }}>
          <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
          <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
        </svg>
        <p style={{ fontSize: '13px' }}>No photos available</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Main grid */}
      <div className="photo-grid-main" style={{ display: 'grid', gridTemplateColumns: images.length > 1 ? '1fr 1fr' : '1fr', gridTemplateRows: 'clamp(150px,20vh,200px) clamp(95px,13vh,130px)', gap: '6px', borderRadius: '16px', overflow: 'hidden' }}>
        {/* Hero image */}
        <div style={{ gridRow: '1 / 3', position: 'relative', cursor: 'pointer', overflow: 'hidden' }}
          onClick={() => setLightboxIdx(0)}>
          <img src={shown[0]} alt={carName} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent 50%)', pointerEvents: 'none' }}/>
          <div style={{ position: 'absolute', bottom: '10px', left: '12px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: 'white', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ZoomIn size={10}/> View all {images.length} photos
          </div>
        </div>

        {/* Thumbnails */}
        {shown.slice(1).map((img, i) => (
          <div key={i} style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden' }}
            onClick={() => setLightboxIdx(i + 1)}>
            <img src={img} alt={`${carName} ${i + 2}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />
            {i === 3 && remaining > 0 && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontWeight: '800', fontSize: '18px' }}>+{remaining}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox images={images} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

/* ── Spec tile ───────────────────────────────────────────── */
const SpecTile = ({ icon: Icon, label, value }) => {
  if (!value || value === '—') return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <Icon size={14} style={{ color: '#dc2626' }} />
      <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '2px 0 0' }}>{label}</p>
      <p style={{ color: 'white', fontSize: '13px', fontWeight: '700', margin: 0, lineHeight: 1.3 }}>{value}</p>
    </div>
  );
};

/* ── Section wrapper ─────────────────────────────────────── */
const Section = ({ title, icon: Icon, children }) => (
  <div style={{ background: 'linear-gradient(145deg,#0d1117,#111827)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {Icon && <Icon size={14} style={{ color: '#dc2626' }} />}
      <h3 style={{ color: 'white', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{title}</h3>
    </div>
    <div style={{ padding: '20px' }}>
      {children}
    </div>
  </div>
);

/* ── Main component ──────────────────────────────────────── */
const CarDetailPage = () => {
  const { id }  = useParams();
  const { t }   = useTranslation();
  const { siteName } = useSiteProfile();
  const [car,          setCar]          = useState(null);
  const [similarCars,  setSimilarCars]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [calcOpen,     setCalcOpen]     = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [shareToast,   setShareToast]   = useState(false);
  const [bookingOpen,  setBookingOpen]  = useState(false);
  const [bookingForm,  setBookingForm]  = useState({ name: '', phone: '', date: '', time: '10:00 AM', notes: '' });
  const [bookingStatus, setBookingStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const stickyRef = useRef(null);

  useEffect(() => {
    const fetchCar = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('car_listings').select('*').eq('id', id).single();
      if (error) { setLoading(false); return; }
      setCar(data);
      if (data?.images?.length) preloadImages(data.images);
      if (getRef()) trackEvent('car_view', { carId: data.id, carName: `${data.brand} ${data.model}`, dealerId: data.dealer_id });
      const { data: sim } = await supabase.from('car_listings').select('*').eq('brand', data.brand).neq('id', id).eq('status','active').limit(3);
      setSimilarCars(sim || []);
      setLoading(false);

      const ch = supabase.channel('vdp_realtime')
        .on('postgres_changes', { event:'*', schema:'public', table:'car_listings' }, payload => {
          if (payload.new?.id === data.id) {
            setCar(c => ({ ...c, ...payload.new }));
            if (payload.new?.images?.length) preloadImages(payload.new.images);
          }
        }).subscribe();
      return () => supabase.removeChannel(ch);
    };
    fetchCar();
  }, [id]);

  useEffect(() => {
    const onFocus = async () => {
      const { data } = await supabase.from('car_listings').select('*').eq('id', id).single();
      if (data) {
        setCar(data);
        if (data.images?.length) preloadImages(data.images);
        const { data: sim } = await supabase.from('car_listings').select('*').eq('brand', data.brand).neq('id', id).eq('status','active').limit(3);
        setSimilarCars(sim || []);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [id]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: carName, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingStatus('loading');
    try {
      const [timePart, period] = bookingForm.time.split(' ');
      let [hrs, mins] = timePart.split(':').map(Number);
      if (period === 'PM' && hrs !== 12) hrs += 12;
      if (period === 'AM' && hrs === 12) hrs = 0;
      const dt = new Date(bookingForm.date);
      dt.setHours(hrs, mins, 0, 0);
      const { error } = await supabase.from('appointments').insert({
        dealer_id:        car.dealer_id,
        salesman_id:      car.assigned_to || null,
        car_listing_id:   car.id,
        buyer_name:       bookingForm.name.trim(),
        buyer_phone:      bookingForm.phone.trim(),
        appointment_date: dt.toISOString(),
        notes:            bookingForm.notes.trim() || null,
        status:           'confirmed',
      });
      if (error) throw error;
      setBookingStatus('success');
    } catch {
      setBookingStatus('error');
    }
  };

  const bookingInputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '13px',
    fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box',
    colorScheme: 'dark',
  };

  /* ── loading ── */
  if (loading) return (
    <>
      <Header />
      <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(220,38,38,0.3)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading listing…</p>
        </div>
      </div>
      <Footer />
    </>
  );

  if (!car) return (
    <>
      <Header />
      <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'white', fontWeight: '800', fontSize: '20px', marginBottom: '12px' }}>Listing not found</p>
          <Link to="/cars" style={{ color: '#dc2626', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>← Back to listings</Link>
        </div>
      </div>
      <Footer />
    </>
  );

  /* ── derived data ── */
  const make          = car.brand || '';
  const price         = car.selling_price || 0;
  const prevPrice     = car.original_price || car.previous_price || null;
  const engineCc      = car.engine_cc || null;
  const location      = car.state || '';
  const year          = car.year || '';
  const images        = car.images || [];
  const carName       = `${make} ${car.model}${car.variant ? ' ' + car.variant : ''} ${year}`.trim();
  const monthly       = calcMonthly(price);
  const roadTax       = calcRoadTax(engineCc, car.body_type);
  const status        = car.status || 'active';
  const statusCfg     = STATUS[status] || STATUS.active;

  const hasDiscount  = prevPrice && prevPrice > price;
  const discountPct  = hasDiscount ? Math.round(((prevPrice - price) / prevPrice) * 100) : null;
  const discountAmt  = hasDiscount ? prevPrice - price : null;

  const waMsg  = `Hi, I'm interested in the ${carName} listed at RM ${price.toLocaleString()}. Is it still available?`;
  const waLink = `https://wa.me/60174155191?text=${encodeURIComponent(waMsg)}`;
  const fireClickEvent = (eventType) => {
    const ref = new URLSearchParams(window.location.search).get('ref') || getRef();
    if (!ref) return;
    supabase.from('analytics_events').insert({
      salesman_slug: ref,
      event_type:    eventType,
      car_id:        car?.id || null,
      car_name:      carName || null,
      session_id:    sessionStorage.getItem('shiftos_session') || crypto.randomUUID(),
      dealer_id:     car?.dealer_id || null,
    });
  };
  const waClick   = () => fireClickEvent('whatsapp_click');
  const callClick = () => { fireClickEvent('call_click'); window.location.href = 'tel:+60174155191'; };

  const specs = [
    { icon: Calendar,    label: 'Year',         value: year ? String(year) : null },
    { icon: Gauge,       label: 'Mileage',       value: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null },
    { icon: Settings,    label: 'Transmission',  value: car.transmission || null },
    { icon: Fuel,        label: 'Fuel',          value: car.fuel_type || null },
    { icon: Tag,         label: 'Body Type',     value: car.body_type || null },
    { icon: Palette,     label: 'Colour',        value: car.colour || null },
    { icon: Gauge,       label: 'Engine',        value: engineCc ? `${Number(engineCc).toLocaleString()} cc` : null },
    { icon: MapPin,      label: 'Location',      value: location || 'Malaysia' },
    { icon: CheckCircle, label: 'Condition',     value: car.condition ? car.condition.charAt(0).toUpperCase() + car.condition.slice(1) : null },
  ].filter(s => s.value);

  const isSold = status === 'sold';

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    width: '100%', padding: '14px', borderRadius: '12px',
    fontSize: '14px', fontWeight: '700', cursor: isSold ? 'default' : 'pointer',
    border: 'none', fontFamily: "'DM Sans',sans-serif",
    transition: 'all 0.2s ease', textDecoration: 'none',
    opacity: isSold ? 0.5 : 1, pointerEvents: isSold ? 'none' : 'auto',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #080C14 !important; margin: 0 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .vdp-wa:hover { background: rgba(37,211,102,0.9) !important; }
        .vdp-call:hover { background: rgba(220,38,38,0.85) !important; }
        .vdp-calc:hover { border-color: rgba(220,38,38,0.5) !important; color: #f87171 !important; }
        .photo-grid img { transition: transform 0.3s ease; }
        .share-toast { animation: fadeUp 0.2s ease; }
        @media(min-width:1025px){
          .vdp-sidebar-mobile { display: none !important; }
        }
        @media(max-width:1024px){
          .vdp-layout { flex-direction: column !important; }
          .vdp-sidebar { display: none !important; }
        }
        @media(max-width:640px){
          .specs-grid { grid-template-columns: repeat(2,1fr) !important; }
          .photo-grid-main { grid-template-columns: 1fr !important; grid-template-rows: 220px !important; }
          .photo-grid-main > div:not(:first-child) { display: none !important; }
        }
      `}</style>

      <Helmet>
        <title>{carName} – RM {price.toLocaleString('en-MY')} | {siteName}</title>
        <meta name="description" content={`${carName} for sale at RM ${price.toLocaleString('en-MY')}. ${car.mileage ? Number(car.mileage).toLocaleString() + ' km. ' : ''}${location ? 'Located in ' + location + '.' : ''}`} />
      </Helmet>

      <Header />

      <div style={{ background: '#080C14', minHeight: '100vh', paddingTop: '72px', fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px 60px' }}>

          {/* ── Breadcrumb + actions ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563', fontSize: '12px' }}>
              <Link to="/" style={{ color: '#4b5563', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'white'}
                onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}>Home</Link>
              <ChevronRight size={12}/>
              <Link to="/cars" style={{ color: '#4b5563', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'white'}
                onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}>Browse Cars</Link>
              <ChevronRight size={12}/>
              <span style={{ color: '#9ca3af', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{carName}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSaved(!saved)}
                style={{ background: saved ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)', border: saved ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 14px', color: saved ? '#f87171' : '#9ca3af', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s', fontFamily: "'DM Sans',sans-serif" }}>
                <Heart size={13} style={{ fill: saved ? '#f87171' : 'none' }}/> {saved ? 'Saved' : 'Save'}
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={handleShare}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 14px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'DM Sans',sans-serif" }}>
                  <Share2 size={13}/> Share
                </button>
                {shareToast && (
                  <div className="share-toast" style={{ position: 'absolute', top: '44px', right: 0, background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 10 }}>
                    Link copied!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Main layout ── */}
          <div className="vdp-layout" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

            {/* ════ LEFT COLUMN ════ */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

                      {/* Photo gallery */}
              <PhotoGallery images={images} carName={carName} />

              {/* Title + price (mobile) */}
              <div style={{ background: 'linear-gradient(145deg,#0d1117,#111827)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>{make}</p>
                    <h1 style={{ color: 'white', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: '800', margin: '0 0 12px', lineHeight: 1.2 }}>
                      {car.model}{car.variant ? ` ${car.variant}` : ''} <span style={{ color: '#9ca3af', fontWeight: '600' }}>{year}</span>
                    </h1>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {/* Status badge */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusCfg.color, display: 'inline-block' }}/>
                        {statusCfg.label}
                      </span>
                      {location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#9ca3af', fontSize: '12px' }}>
                          <MapPin size={11}/>{location}
                        </span>
                      )}
                      {hasDiscount && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>
                          <TrendingDown size={10}/> −{discountPct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price block */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px 20px', minWidth: '200px', textAlign: 'right' }}>
                    <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Asking Price</p>
                    {hasDiscount && (
                      <p style={{ color: '#6b7280', fontSize: '13px', textDecoration: 'line-through', margin: '0 0 2px' }}>RM {prevPrice.toLocaleString('en-MY')}</p>
                    )}
                    <p style={{ color: hasDiscount ? '#f87171' : 'white', fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: '800', margin: '0 0 4px', lineHeight: 1, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.02em' }}>
                      RM {price > 0 ? price.toLocaleString('en-MY') : '—'}
                    </p>
                    {hasDiscount && <p style={{ color: '#34d399', fontSize: '11px', fontWeight: '700', margin: '0 0 6px' }}>Save RM {discountAmt.toLocaleString('en-MY')}</p>}
                    {monthly && <p style={{ color: '#9ca3af', fontSize: '12px', margin: '0 0 2px' }}>≈ RM {monthly.toLocaleString('en-MY')}<span style={{ color: '#6b7280' }}>/mo</span></p>}
                    {roadTax != null && <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>Est. road tax: RM {roadTax.toLocaleString()}/yr</p>}
                  </div>
                </div>
              </div>

              {/* Mobile CTAs */}
              <div className="vdp-sidebar-mobile" style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={waClick} className="vdp-wa"
                  style={{ ...btnBase, background: '#25D366', color: 'white' }}>
                  <MessageCircle size={16}/> WhatsApp Us
                </a>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={callClick} className="vdp-call"
                    style={{ ...btnBase, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', padding: '12px' }}>
                    <Phone size={15}/> Call Now
                  </button>
                  <button onClick={() => setCalcOpen(true)} className="vdp-calc"
                    style={{ ...btnBase, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', padding: '12px' }}>
                    <Calculator size={15}/> Calculator
                  </button>
                </div>
                <div style={{ marginTop: '10px' }}>
                  {!bookingOpen && bookingStatus !== 'success' && (
                    <button
                      onClick={() => { setBookingOpen(true); setBookingStatus('idle'); }}
                      disabled={isSold}
                      style={{
                        ...btnBase,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#e5e7eb',
                      }}
                      onMouseEnter={e => { if (!isSold) e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                    >
                      📅 Book a Viewing
                    </button>
                  )}
                  {bookingStatus === 'success' && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '12px', padding: '16px', color: '#4ade80', fontSize: '14px', textAlign: 'center' }}>
                      ✅ Viewing booked! We'll confirm with you shortly on WhatsApp.
                    </div>
                  )}
                  {bookingStatus === 'error' && (
                    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '12px', padding: '16px', color: '#f87171', fontSize: '14px', textAlign: 'center' }}>
                      Something went wrong. Please WhatsApp us directly.
                    </div>
                  )}
                  {bookingOpen && bookingStatus === 'idle' && (
                    <form
                      onSubmit={handleBooking}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}
                    >
                      <p style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Book a Viewing</p>
                      <input
                        required
                        type="text"
                        placeholder="Your name"
                        value={bookingForm.name}
                        onChange={e => setBookingForm(f => ({ ...f, name: e.target.value }))}
                        style={bookingInputStyle}
                      />
                      <input
                        required
                        type="tel"
                        placeholder="01X-XXXXXXX"
                        value={bookingForm.phone}
                        onChange={e => setBookingForm(f => ({ ...f, phone: e.target.value }))}
                        style={bookingInputStyle}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input
                          required
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={bookingForm.date}
                          onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
                          style={bookingInputStyle}
                        />
                        <select
                          value={bookingForm.time}
                          onChange={e => setBookingForm(f => ({ ...f, time: e.target.value }))}
                          style={bookingInputStyle}
                        >
                          {['9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        placeholder="Anything you'd like us to know?"
                        rows={3}
                        value={bookingForm.notes}
                        onChange={e => setBookingForm(f => ({ ...f, notes: e.target.value }))}
                        style={{ ...bookingInputStyle, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="submit"
                          style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#dc2626', color: 'white', fontWeight: '700', fontSize: '13px', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                        >
                          Confirm Booking
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookingOpen(false)}
                          style={{ padding: '11px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Horizontal spec strip */}
              <Section title="At a Glance" icon={Tag}>
                <div className="specs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                  {specs.map(s => <SpecTile key={s.label} {...s}/>)}
                </div>
              </Section>

              {/* Puspakom badge if exists */}
              {car.puspakom_url && car.puspakom_status === 'passed' && (
                <div style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.08),rgba(52,211,153,0.03))', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldCheck size={20} style={{ color: '#34d399' }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#34d399', fontWeight: '700', fontSize: '13px', margin: '0 0 2px' }}>Puspakom Inspected ✓</p>
                    <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>This vehicle has passed a Puspakom inspection.{' '}
                      <a href={car.puspakom_url} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', fontWeight: '600' }}>View report →</a>
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              {(car.captions || car.description) && (
                <Section title="About this car" icon={FileText}>
                  <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.8', margin: 0, whiteSpace: 'pre-line' }}>
                    {car.captions || car.description}
                  </p>
                </Section>
              )}

              {/* Features */}
              {(car.features || car.options) && (
                <Section title="Features & Equipment" icon={Star}>
                  <div style={{ columns: '2', columnGap: '16px' }}>
                    {(car.features || car.options || '').split('\n').filter(Boolean).map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', breakInside: 'avoid' }}>
                        <CheckCircle size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }}/>
                        <span style={{ color: '#d1d5db', fontSize: '13px', lineHeight: '1.5' }}>{f.trim()}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Recon / Import section */}
              {car.is_recon && (
                <Section title="Recon & Import Details" icon={Globe}>
                  {/* Grade + chassis row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '12px', marginBottom: '16px' }}>
                    {/* Grade */}
                    {(car.auction_grade || car.interior_grade) && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
                        <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Auction Grade</p>
                        <GradeBadge auctionGrade={car.auction_grade} interiorGrade={car.interior_grade} size="lg"/>
                      </div>
                    )}
                    {car.import_country && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
                        <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Import Country</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '700', margin: 0 }}>{car.import_country}</p>
                      </div>
                    )}
                    {car.auction_house && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
                        <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Auction House</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '700', margin: 0 }}>{car.auction_house}</p>
                      </div>
                    )}
                    {car.local_reg_date && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
                        <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Local Reg Date</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '700', margin: 0 }}>{new Date(car.local_reg_date).toLocaleDateString('en-MY', { year:'numeric', month:'short', day:'numeric' })}</p>
                      </div>
                    )}
                    {car.chassis_status && (
                      <div style={{ background: car.chassis_status === 'clean' ? 'rgba(34,197,94,0.06)' : car.chassis_status === 'repaired' ? 'rgba(249,115,22,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${car.chassis_status === 'clean' ? 'rgba(34,197,94,0.2)' : car.chassis_status === 'repaired' ? 'rgba(249,115,22,0.2)' : 'rgba(220,38,38,0.2)'}`, borderRadius: '12px', padding: '14px 16px' }}>
                        <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Chassis Status</p>
                        <p style={{ color: car.chassis_status === 'clean' ? '#4ade80' : car.chassis_status === 'repaired' ? '#fb923c' : '#f87171', fontSize: '14px', fontWeight: '700', margin: 0, textTransform: 'capitalize' }}>
                          {car.chassis_status.replace('_', ' ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Damage map */}
                  {Array.isArray(car.damage_map) && (
                    <div>
                      <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                        Damage Map {car.damage_map.length === 0 ? '— None recorded' : `— ${car.damage_map.length} marker${car.damage_map.length !== 1 ? 's' : ''}`}
                      </p>
                      <DamageMap value={car.damage_map} readOnly={true} />
                    </div>
                  )}
                </Section>
              )}

              {/* Why buy with dealer */}
              <Section title={`Why Buy with ${siteName}`} icon={ShieldCheck}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { icon: ShieldCheck, t: 'Verified Listing',       d: 'Every car is manually verified by our team.' },
                    { icon: Calculator,  t: 'Transparent Pricing',    d: 'No hidden fees. Price you see is final.' },
                    { icon: MessageCircle, t: 'Fast Response',        d: 'Usually replies within 1 hour on WhatsApp.' },
                    { icon: Star,        t: 'Trusted Dealers',        d: 'All dealers are rated and reviewed.' },
                  ].map((b, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                      <b.icon size={14} style={{ color: '#dc2626', marginBottom: '6px' }}/>
                      <p style={{ color: 'white', fontWeight: '700', fontSize: '12px', margin: '0 0 4px' }}>{b.t}</p>
                      <p style={{ color: '#6b7280', fontSize: '11px', margin: 0, lineHeight: 1.5 }}>{b.d}</p>
                    </div>
                  ))}
                </div>
              </Section>

            </div>

            {/* ════ RIGHT SIDEBAR ════ */}
            <div className="vdp-sidebar" style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '96px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Price card */}
              <div style={{ background: 'linear-gradient(145deg,#0d1117,#111827)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px' }}>
                <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Asking Price</p>
                {hasDiscount && (
                  <p style={{ color: '#6b7280', fontSize: '13px', textDecoration: 'line-through', margin: '0 0 2px' }}>
                    RM {prevPrice.toLocaleString('en-MY')}
                  </p>
                )}
                <p style={{ color: hasDiscount ? '#f87171' : 'white', fontSize: '2rem', fontWeight: '800', margin: '0 0 2px', lineHeight: 1, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.02em' }}>
                  RM {price > 0 ? price.toLocaleString('en-MY') : '—'}
                </p>
                {hasDiscount && <p style={{ color: '#34d399', fontSize: '11px', fontWeight: '700', margin: '0 0 8px' }}>Save RM {discountAmt.toLocaleString('en-MY')}</p>}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {monthly && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>Est. monthly</span>
                      <span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>RM {monthly.toLocaleString('en-MY')}/mo</span>
                    </div>
                  )}
                  {roadTax != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>Est. road tax</span>
                      <span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>RM {roadTax.toLocaleString()}/yr</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div style={{ marginTop: '12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color, fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusCfg.color, display: 'inline-block' }}/>
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* CTAs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={waClick} className="vdp-wa"
                  style={{ ...btnBase, background: '#25D366', color: 'white', boxShadow: '0 4px 16px rgba(37,211,102,0.25)' }}>
                  <MessageCircle size={16}/> WhatsApp Us
                </a>
                <button onClick={callClick} className="vdp-call"
                  style={{ ...btnBase, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171' }}>
                  <Phone size={16}/> Call Now
                </button>
                <button onClick={() => setCalcOpen(true)} className="vdp-calc"
                  style={{ ...btnBase, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                  <Calculator size={15}/> Financing Calculator
                </button>
                <div style={{ marginTop: '10px' }}>
                  {!bookingOpen && bookingStatus !== 'success' && (
                    <button
                      onClick={() => { setBookingOpen(true); setBookingStatus('idle'); }}
                      disabled={isSold}
                      style={{
                        ...btnBase,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#e5e7eb',
                      }}
                      onMouseEnter={e => { if (!isSold) e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                    >
                      📅 Book a Viewing
                    </button>
                  )}
                  {bookingStatus === 'success' && (
                    <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '12px', padding: '16px', color: '#4ade80', fontSize: '14px', textAlign: 'center' }}>
                      ✅ Viewing booked! We'll confirm with you shortly on WhatsApp.
                    </div>
                  )}
                  {bookingStatus === 'error' && (
                    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '12px', padding: '16px', color: '#f87171', fontSize: '14px', textAlign: 'center' }}>
                      Something went wrong. Please WhatsApp us directly.
                    </div>
                  )}
                  {bookingOpen && bookingStatus === 'idle' && (
                    <form
                      onSubmit={handleBooking}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}
                    >
                      <p style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Book a Viewing</p>
                      <input
                        required
                        type="text"
                        placeholder="Your name"
                        value={bookingForm.name}
                        onChange={e => setBookingForm(f => ({ ...f, name: e.target.value }))}
                        style={bookingInputStyle}
                      />
                      <input
                        required
                        type="tel"
                        placeholder="01X-XXXXXXX"
                        value={bookingForm.phone}
                        onChange={e => setBookingForm(f => ({ ...f, phone: e.target.value }))}
                        style={bookingInputStyle}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input
                          required
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={bookingForm.date}
                          onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
                          style={bookingInputStyle}
                        />
                        <select
                          value={bookingForm.time}
                          onChange={e => setBookingForm(f => ({ ...f, time: e.target.value }))}
                          style={bookingInputStyle}
                        >
                          {['9:00 AM','10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        placeholder="Anything you'd like us to know?"
                        rows={3}
                        value={bookingForm.notes}
                        onChange={e => setBookingForm(f => ({ ...f, notes: e.target.value }))}
                        style={{ ...bookingInputStyle, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="submit"
                          style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#dc2626', color: 'white', fontWeight: '700', fontSize: '13px', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                        >
                          Confirm Booking
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookingOpen(false)}
                          style={{ padding: '11px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Response time */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#6b7280', fontSize: '11px' }}>
                <Clock size={11}/> Usually replies within 1 hour
              </div>

              {/* Quick specs */}
              {specs.slice(0, 4).length > 0 && (
                <div style={{ background: 'linear-gradient(145deg,#0d1117,#111827)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 16px' }}>
                  <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px' }}>Quick Specs</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {specs.slice(0, 5).map(s => (
                      <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>{s.label}</span>
                        <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Similar cars ── */}
          {similarCars.length > 0 && (
            <div style={{ marginTop: '60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <p style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>You may also like</p>
                  <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>More {make}s</h2>
                </div>
                <Link to="/cars" style={{ color: '#dc2626', fontSize: '13px', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  View all <ChevronRight size={14}/>
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: '18px' }}>
                {similarCars.map(c => <CarCard key={c.id} car={c}/>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky CTA bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'rgba(8,12,20,0.97)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 16px', display: 'flex', gap: '10px',
        fontFamily: "'DM Sans',sans-serif",
      }} className="mobile-sticky-bar">
        <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={waClick}
          style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#25D366', color: 'white', fontWeight: '700', fontSize: '14px', padding: '13px', borderRadius: '12px', textDecoration: 'none' }}>
          <MessageCircle size={16}/> WhatsApp
        </a>
        <button onClick={() => setCalcOpen(true)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontWeight: '600', fontSize: '13px', padding: '13px', borderRadius: '12px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
          <Calculator size={14}/> Calc
        </button>
      </div>

      <style>{`
        .mobile-sticky-bar { display: none !important; }
        .vdp-sidebar-mobile { display: none !important; }
        @media(max-width:1024px){
          .mobile-sticky-bar { display: flex !important; }
          .vdp-sidebar-mobile { display: flex !important; }
        }
      `}</style>

      {/* Calculator modal */}
      <AnimatePresence>
        {calcOpen && (
          <motion.div key="calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'DM Sans',sans-serif" }}
            onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ width: '100%', maxWidth: '860px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: 'white', fontWeight: '700', fontSize: '14px', margin: '0 0 2px' }}>Financing & Cost Calculator</p>
                  <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>{carName}</p>
                </div>
                <button onClick={() => setCalcOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                  <X size={16}/>
                </button>
              </div>
              <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <FinancingCalculator
                  initialPrice={price}
                  engineCc={engineCc}
                  bodyType={car.body_type}
                  carName={carName}
                  carYear={year ? String(year) : ''}
                  carColor={car.colour || ''}
                  flat
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default CarDetailPage;