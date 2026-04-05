import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Gauge, Zap, Settings, Droplets, Palette, ChevronLeft, ChevronRight, ArrowLeft, ZoomIn, ZoomOut, X, Calculator } from 'lucide-react';
import { supabase } from '../supabaseClient';
import FinancingCalculator from '../components/FinancingCalculator';

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

function getOrCreateSession() {
  const key = 'xd_session';
  let id = sessionStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
  return id;
}

function trackEvent(car, eventType) {
  const ref = new URLSearchParams(window.location.search).get('ref');
  supabase.from('analytics_events').insert({
    salesman_slug: ref || '',
    event_type:    eventType,
    car_id:        car.id,
    car_name:      `${car.year} ${car.brand} ${car.model}`,
    session_id:    getOrCreateSession(),
    dealer_id:     car.dealer_id,
  }).then(({ error }) => {
    if (error) console.warn('Analytics insert failed:', error.message);
  });
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(/,|\n/).map(s => s.trim()).filter(Boolean);
}

const inputStyle = (focused) => ({
  width: '100%', background: 'rgba(255,255,255,0.03)',
  border: `1px solid ${focused ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.1)'}`,
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

/* ─── main ─── */
export default function CarDetailPage() {
  const { slug }  = useParams();
  const navigate  = useNavigate();

  const [car, setCar]         = useState(null);
  const [dealer, setDealer]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
  const [form, setForm]           = useState({ name: '', phone: '', date: '', time: '09:00', notes: '' });
  const [focusedField, setFocused] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked]         = useState(false);
  const bookingRef = useRef(null);

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

  /* ── fetch ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: carData, error } = await supabase
        .from('car_listings').select('*').eq('slug', slug).maybeSingle();
      if (error || !carData) { setNotFound(true); setLoading(false); return; }
      setCar(carData);
      if (carData.dealer_id) {
        const { data: d } = await supabase
          .from('profiles')
          .select('full_name,dealership,site_name,whatsapp_number,avatar_url,site_logo_url,slug')
          .eq('id', carData.dealer_id).maybeSingle();
        setDealer(d);
      }
      trackEvent(carData, 'car_view');
      setLoading(false);
    }
    load();
  }, [slug]);

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
  async function handleWhatsApp() {
    const phone = dealer?.whatsapp_number?.replace(/\D/g, '');
    const text  = `Hi, I'm interested in the ${car.year} ${car.brand} ${car.model}${car.variant ? ' ' + car.variant : ''}. Is it still available?`;
    trackEvent(car, 'whatsapp_click');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  /* ── booking ── */
  async function handleBook(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    // Resolve salesman_id: prefer ?ref= slug → profile id, fall back to assigned_to
    let salesmanId = car.assigned_to || null;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      const { data: sm } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', ref)
        .maybeSingle();
      if (sm?.id) salesmanId = sm.id;
    }

    const [h, m] = form.time.split(':');
    const dt = new Date(`${form.date}T${h.padStart(2,'0')}:${m}:00`);
    await supabase.from('appointments').insert({
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
    setBooked(true);
  }

  /* ── early returns ── */
  if (loading)  return <Skeleton />;
  if (notFound) return (
    <div style={{ background:'#0d0d0d', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <p style={{ fontSize:15, color:'#6b7280', marginBottom:20 }}>This listing is no longer available.</p>
      <Link to="/cars" style={{ color:'#dc2626', fontSize:13, textDecoration:'none' }}>← Browse all cars</Link>
    </div>
  );

  const images     = car.images?.length ? car.images : ['/placeholder-car.jpg'];
  const isRecon    = car.is_recon;
  const isHot      = car.original_price && car.original_price > 0 && car.selling_price > 0 && car.selling_price <= car.original_price * 0.97;
  const saving     = isHot ? car.original_price - car.selling_price : 0;
  const carTitle   = `${car.year} ${car.brand} ${car.model}${car.variant ? ' ' + car.variant : ''}`;
  const dealerName = dealer?.site_name || dealer?.dealership || dealer?.full_name || 'Dealer';
  const listedDays = daysAgo(car.created_at);
  const allTags    = [...new Set([...parseTags(car.features), ...parseTags(car.options)])];
  const today      = new Date().toISOString().split('T')[0];

  const imgCount = images.length;
  const prevIdx  = (activeIdx - 1 + imgCount) % imgCount;
  const nextIdx  = (activeIdx + 1) % imgCount;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; overflow-x: hidden; }

        /* slide animations — run on absolutely-positioned img so they never affect page layout */
        @keyframes cdp-from-right {
          from { transform: translateX(48px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes cdp-from-left {
          from { transform: translateX(-48px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        .cdp-slide-next { animation: cdp-from-right 0.42s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        .cdp-slide-prev { animation: cdp-from-left  0.42s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

        /* image-loading shimmer */
        @keyframes cdp-shimmer-sweep {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .cdp-img-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, #111111 25%, #1a1a1a 50%, #111111 75%);
          background-size: 400px 100%;
          animation: cdp-shimmer-sweep 1.4s ease-in-out infinite;
          pointer-events: none;
        }

        /* shimmer */
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .sk {
          background: linear-gradient(90deg, #111111 25%, #1a1a1a 50%, #111111 75%);
          background-size: 600px 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        .cdp-root {
          background: #0d0d0d;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          color: #f5f5f5;
        }

        /* sticky header */
        .cdp-header {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px; height: 52px;
          background: rgba(13,13,13,0.94);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .cdp-back-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; color: #a0a0a0;
          font-size: 13px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; padding: 0;
          transition: color 0.2s;
        }
        .cdp-back-btn:hover { color: #f5f5f5; }
        .cdp-header-title {
          font-size: 13px; font-weight: 500; color: white;
          opacity: 0; transition: opacity 0.3s; pointer-events: none;
          max-width: 40%; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cdp-header-title.visible { opacity: 1; }
        .cdp-enquire-btn {
          background: none; border: 1px solid rgba(220,38,38,0.5);
          color: #dc2626; border-radius: 6px; padding: 6px 16px;
          font-size: 13px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: background 0.2s;
        }
        .cdp-enquire-btn:hover { background: rgba(220,38,38,0.08); }

        /* above-fold hero */
        .cdp-fold {
          max-width: 1200px; margin: 0 auto;
          padding: 16px 24px;
          display: flex; gap: 32px; align-items: stretch;
          height: calc(100vh - 52px);
        }

        /* gallery column */
        .cdp-gallery-col {
          flex: 1.7; display: flex; gap: 8px; min-width: 0;
          overflow: hidden;
        }

        /* main image area
           overflow:clip (not hidden) is the only value that hard-clips animated
           children without creating a scroll container, preventing translateX
           from expanding the page's scrollable area */
        .cdp-main-wrap {
          flex: 1; position: relative;
          overflow: clip;
          border-radius: 6px; background: #111111;
        }
        .cdp-main-img {
          width: 100%; height: 100%;
          object-fit: contain; display: block;
          cursor: zoom-in;
          will-change: transform;
        }
        .cdp-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(0,0,0,0.45); border: none; color: white;
          width: 36px; height: 36px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.2s; z-index: 2;
        }
        .cdp-arrow:hover { background: rgba(0,0,0,0.7); }
        .cdp-arrow-l { left: 10px; }
        .cdp-arrow-r { right: 10px; }

        /* dot counter — dynamic sliding window, max 5 visible */
        .cdp-dots {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
          max-width: 54px; overflow: hidden; z-index: 2; padding: 4px 0;
        }
        .cdp-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,0.45); padding: 0; border: none;
          cursor: pointer;
          transition: transform 0.35s ease, opacity 0.35s ease, background 0.2s;
        }
        .cdp-dot.active { background: white; }

        /* vertical thumb strip */
        .cdp-thumbs-v {
          width: 68px; display: flex; flex-direction: column;
          gap: 6px; overflow-y: auto; scrollbar-width: none;
        }
        .cdp-thumbs-v::-webkit-scrollbar { display: none; }
        .cdp-thumb-v {
          width: 68px; height: 50px; object-fit: cover;
          border-radius: 4px; cursor: pointer; flex-shrink: 0;
          opacity: 0.45; transition: opacity 0.2s;
          border: 1px solid transparent;
        }
        .cdp-thumb-v.active {
          opacity: 1;
          border-color: #dc2626;
        }

        /* info column */
        .cdp-info-col {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; justify-content: center;
          gap: 0; overflow-y: auto; scrollbar-width: none;
          padding-left: 0;
        }
        .cdp-info-col::-webkit-scrollbar { display: none; }

        /* specs strip */
        .cdp-specs {
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; overflow-x: auto;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .cdp-specs::-webkit-scrollbar { display: none; }
        .cdp-spec {
          flex: 1; min-width: 110px; text-align: center;
          padding: 20px 12px;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .cdp-spec:last-child { border-right: none; }

        /* details section */
        .cdp-details {
          max-width: 1200px; margin: 0 auto;
          padding: 52px 24px 80px;
          display: flex; gap: 56px; align-items: flex-start;
        }
        .cdp-details-left  { flex: 1.5; min-width: 0; }
        .cdp-details-right { flex: 1; min-width: 260px; }

        .cdp-row {
          padding: 11px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          display: flex; justify-content: space-between;
          align-items: center; gap: 12px;
        }

        /* mobile */
        @media (max-width: 768px) {
          .cdp-fold {
            flex-direction: column;
            height: auto;
            padding: 12px 16px 24px;
            gap: 20px;
          }
          .cdp-gallery-col { height: clamp(240px, 55vw, 380px); min-height: 240px; }
          .cdp-thumbs-v { display: none; }
          .cdp-info-col { justify-content: flex-start; }
          .cdp-details { flex-direction: column; gap: 36px; padding: 36px 16px 60px; }
          .cdp-details-right { min-width: 0; width: 100%; max-width: 480px; margin-left: auto; margin-right: auto; }
        }
        @media (max-width: 480px) {
          .cdp-arrow { display: none; }
        }

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
          transition: transform 0.08s linear;
          pointer-events: none;
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
          font-size: 12px; color: rgba(255,255,255,0.5);
          font-family: 'DM Sans', sans-serif;
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
      `}</style>

      <div className="cdp-root">

        {/* ── sticky header ── */}
        <header className="cdp-header">
          <button className="cdp-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className={`cdp-header-title${showTitle ? ' visible' : ''}`}>
            {carTitle}
          </span>
          <button className="cdp-enquire-btn" onClick={handleWhatsApp}>
            Enquire
          </button>
        </header>

        {/* ── above-fold: gallery + info ── */}
        <div className="cdp-fold" ref={heroRef}>

          {/* gallery */}
          <div className="cdp-gallery-col">

            {/* main image */}
            <div className="cdp-main-wrap"
              onTouchStart={galleryTouchStart}
              onTouchEnd={galleryTouchEnd}
            >
              {/* shimmer holds space and shows while image is loading */}
              {!imgLoaded && <div className="cdp-img-shimmer" />}
              <img
                key={slideKey}
                className={`cdp-main-img cdp-slide-${slideDir}`}
                src={images[activeIdx]}
                alt={carTitle}
                onClick={() => setLbOpen(true)}
                onLoad={() => setImgLoaded(true)}
                onError={e => { e.target.src = '/placeholder-car.jpg'; setImgLoaded(true); }}
              />

              {imgCount > 1 && (
                <>
                  <button className="cdp-arrow cdp-arrow-l"
                    onClick={() => go(prevIdx, 'prev')} aria-label="Previous">
                    <ChevronLeft size={18} />
                  </button>
                  <button className="cdp-arrow cdp-arrow-r"
                    onClick={() => go(nextIdx, 'next')} aria-label="Next">
                    <ChevronRight size={18} />
                  </button>

                  {/* dot indicators — dynamic 5-dot sliding window */}
                  {(() => {
                    const DOT_SLOT = 12; // 6px dot + 6px gap
                    const rawOffset  = -(activeIdx - 2) * DOT_SLOT;
                    const minOffset  = imgCount > 5 ? -(imgCount - 5) * DOT_SLOT : 0;
                    const trackShift = Math.min(0, Math.max(minOffset, rawOffset));
                    return (
                      <div className="cdp-dots">
                        <div style={{ display:'flex', gap:6, transform:`translateX(${trackShift}px)`, transition:'transform 0.35s ease' }}>
                          {images.map((_, i) => {
                            const dist = Math.abs(i - activeIdx);
                            return (
                              <button
                                key={i}
                                className={`cdp-dot${i === activeIdx ? ' active' : ''}`}
                                onClick={() => go(i, i > activeIdx ? 'next' : 'prev')}
                                aria-label={`Image ${i + 1}`}
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
            </div>

            {/* vertical thumbnail strip */}
            {imgCount > 1 && (
              <div className="cdp-thumbs-v">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    className={`cdp-thumb-v${i === activeIdx ? ' active' : ''}`}
                    alt={`View ${i + 1}`}
                    onClick={() => go(i, i > activeIdx ? 'next' : 'prev')}
                    onError={e => { e.target.src = '/placeholder-car.jpg'; }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* info */}
          <div className="cdp-info-col">

            {/* badges */}
            {(isRecon || isHot) && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {isRecon && (
                  <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', fontSize: '10px', padding: '3px 9px', borderRadius: '3px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Recon
                  </span>
                )}
                {isHot && (
                  <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', fontSize: '10px', padding: '3px 9px', borderRadius: '3px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Hot Deal
                  </span>
                )}
              </div>
            )}

            {/* brand */}
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#a0a0a0', marginBottom: 5 }}>
              {car.brand}
            </p>

            {/* model + variant */}
            <h1 style={{ fontSize: 'clamp(1.6rem, 3.2vw, 2.6rem)', fontWeight: 300, color: 'white', lineHeight: 1.1, marginBottom: 10 }}>
              {car.model}{car.variant ? ` ${car.variant}` : ''}
            </h1>

            {/* meta */}
            <p style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: 20 }}>
              {[car.year, car.body_type, car.transmission].filter(Boolean).join(' · ')}
            </p>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }} />

            {/* price */}
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a0a0a0', marginBottom: 3 }}>
              Selling price
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', color: 'white', lineHeight: 1, margin: 0 }}>
                {fmtPrice(car.selling_price)}
              </p>
              {calcMonthly(car.selling_price) && (
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 400, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                  / mo: <span style={{ color: '#9ca3af', fontWeight: 500 }}>RM {fmt(calcMonthly(car.selling_price))}</span>
                </span>
              )}
            </div>

            {isHot && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '13px', color: '#4b5563', textDecoration: 'line-through' }}>
                  {fmtPrice(car.original_price)}
                </span>
                <span style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                  SAVE {fmtPrice(saving)}
                </span>
              </div>
            )}

            {/* CTA card */}
            <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', marginTop: 20, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Interested in this car?
              </p>

              <button
                onClick={handleWhatsApp}
                style={{ width: '100%', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", boxShadow: '0 4px 16px rgba(37,211,102,0.2)' }}
              >
                WhatsApp Dealer
              </button>

              <button
                onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.13)', color: 'white', borderRadius: '8px', padding: '12px', fontWeight: 500, fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 4 }}
              >
                Book a Viewing
              </button>

              <button
                onClick={() => setCalcOpen(true)}
                style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', borderRadius: '8px', padding: '11px', fontWeight: 500, fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                <Calculator size={14} /> Financing Calculator
              </button>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0 12px' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {(dealer?.site_logo_url || dealer?.avatar_url)
                  ? <img src={dealer.site_logo_url || dealer.avatar_url} alt={dealerName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                }
                <div>
                  <p style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{dealerName}</p>
                  <p style={{ fontSize: '11px', color: '#6b7280' }}>Verified Dealer</p>
                </div>
              </div>

              {listedDays !== null && (
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: 10 }}>
                  Listed {listedDays} day{listedDays !== 1 ? 's' : ''} ago
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── specs strip ── */}
        <div className="cdp-specs">
          {[
            { Icon: Gauge,    label: 'Mileage',      value: car.mileage     ? `${fmt(car.mileage)} km`   : '—' },
            { Icon: Zap,      label: 'Engine',       value: car.engine_cc   ? `${fmt(car.engine_cc)} cc` : '—' },
            { Icon: Settings, label: 'Transmission', value: car.transmission || '—' },
            { Icon: Droplets, label: 'Fuel',         value: car.fuel_type   || '—' },
            { Icon: Palette,  label: 'Colour',       value: car.colour      || '—' },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="cdp-spec">
              <Icon size={15} style={{ color: '#a0a0a0', marginBottom: 6 }} />
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a0a0a0', marginBottom: 3 }}>{label}</p>
              <p style={{ fontSize: '15px', fontWeight: 500, color: 'white' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── details section ── */}
        <section className="cdp-details">

          {/* left — tabbed panel */}
          <div className="cdp-details-left">

            {/* about text — always visible */}
            <p style={{ fontSize: '15px', color: '#f5f5f5', lineHeight: 1.8, marginBottom: 32 }}>
              {car.specs || `${car.year} ${car.brand} ${car.model}, ${fmt(car.mileage)} km, ${car.transmission}, ${car.fuel_type}, ${car.colour}.`}
            </p>

            {/* tab buttons */}
            {(() => {
              const tabs = [
                { key: 'specs',    label: 'Specs' },
                ...(parseTags(car.features).length > 0 ? [{ key: 'features', label: 'Features' }] : []),
                ...(parseTags(car.options).length  > 0 ? [{ key: 'options',  label: 'Options'  }] : []),
              ];
              return (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                    {tabs.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setDetailTab(t.key)}
                        style={{
                          background: detailTab === t.key ? 'rgba(255,255,255,0.08)' : 'none',
                          border: `1px solid ${detailTab === t.key ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
                          color: detailTab === t.key ? 'white' : '#6b7280',
                          borderRadius: '6px', padding: '6px 16px',
                          fontSize: '12px', fontWeight: detailTab === t.key ? 500 : 400,
                          cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                          transition: 'all 0.15s', letterSpacing: '0.04em',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Specs tab */}
                  {detailTab === 'specs' && (
                    <div>
                      {[
                        { key: 'Registration Date', val: car.registration_date || car.local_reg_date || '—' },
                        { key: 'VIN / Chassis',     val: car.vin_number || '—' },
                        { key: 'Condition',         val: car.condition || '—' },
                        {
                          key: 'Chassis Status',
                          val: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: car.chassis_status === 'clean' ? '#22c55e' : car.chassis_status === 'repaired' ? '#eab308' : car.chassis_status === 'written_off' ? '#dc2626' : '#6b7280' }} />
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
                          <span style={{ fontSize: '13px', color: '#6b7280' }}>{key}</span>
                          <span style={{ fontSize: '13px', color: 'white', textAlign: 'right' }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Features tab */}
                  {detailTab === 'features' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {parseTags(car.features).map((tag, i) => (
                        <span key={i} style={{ display: 'inline-block', padding: '4px 11px', margin: '3px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', color: '#9ca3af' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Options tab */}
                  {detailTab === 'options' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {parseTags(car.options).map((tag, i) => (
                        <span key={i} style={{ display: 'inline-block', padding: '4px 11px', margin: '3px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', color: '#9ca3af' }}>
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
            <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 18 }}>
              Book a Viewing
            </p>

            {booked ? (
              <div style={{ padding: '28px 0' }}>
                <p style={{ fontSize: '15px', color: 'white', marginBottom: 8 }}>✓ &nbsp;Viewing booked</p>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>We'll be in touch shortly on WhatsApp.</p>
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
                  style={{ width: '100%', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '13px', fontWeight: 600, fontSize: '14px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Booking…' : 'Confirm Viewing'}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ── calculator modal ── */}
        {calcOpen && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'DM Sans',sans-serif" }}
          >
            <div style={{ width: '100%', maxWidth: 860, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>Financing &amp; Cost Calculator</p>
                  <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{carTitle}</p>
                </div>
                <button onClick={() => setCalcOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
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
          <div
            className="cdp-lb-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) closeLb(); }}
            onMouseMove={lbMouseMove}
            onMouseUp={lbMouseUp}
            onMouseLeave={lbMouseUp}
          >
            {/* close */}
            <button className="cdp-lb-close" onClick={closeLb} aria-label="Close">
              <X size={18} />
            </button>

            {/* counter */}
            {imgCount > 1 && (
              <span className="cdp-lb-counter">{activeIdx + 1} / {imgCount}</span>
            )}

            {/* prev / next */}
            {imgCount > 1 && (
              <>
                <button className="cdp-lb-arrow cdp-lb-arrow-l"
                  onClick={() => go(prevIdx, 'prev')} aria-label="Previous">
                  <ChevronLeft size={22} />
                </button>
                <button className="cdp-lb-arrow cdp-lb-arrow-r"
                  onClick={() => go(nextIdx, 'next')} aria-label="Next">
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* image drag + wheel zoom area */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%',
                cursor: lbZoom > 1 ? (lbDrag.current.active ? 'grabbing' : 'grab') : 'default',
                overflow: 'hidden',
              }}
              onMouseDown={lbMouseDown}
              onWheel={lbWheel}
              onTouchStart={lbTouchStart}
              onTouchEnd={lbTouchEnd}
            >
              <img
                className="cdp-lb-img"
                src={images[activeIdx]}
                alt={carTitle}
                draggable={false}
                style={{
                  transform: `translate(${lbPan.x}px, ${lbPan.y}px) scale(${lbZoom})`,
                  transformOrigin: 'center center',
                  transition: lbDrag.current.active ? 'none' : 'transform 0.08s ease',
                }}
                onError={e => { e.target.src = '/placeholder-car.jpg'; }}
              />
            </div>

            {/* zoom controls */}
            <div className="cdp-lb-zoom-bar">
              <button className="cdp-lb-zoom-btn"
                onClick={() => { setLbZoom(z => Math.max(0.5, z - 0.25)); setLbPan({ x: 0, y: 0 }); }}
                aria-label="Zoom out">
                <ZoomOut size={16} />
              </button>
              <span className="cdp-lb-zoom-label">{Math.round(lbZoom * 100)}%</span>
              <button className="cdp-lb-zoom-btn"
                onClick={() => setLbZoom(z => Math.min(5, z + 0.25))}
                aria-label="Zoom in">
                <ZoomIn size={16} />
              </button>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
              <button className="cdp-lb-zoom-btn"
                onClick={() => { setLbZoom(1); setLbPan({ x: 0, y: 0 }); }}
                style={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
