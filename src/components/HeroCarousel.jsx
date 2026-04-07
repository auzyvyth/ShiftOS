import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Fuel,
  Gauge,
  Sparkles,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import useTenant, { isSubdomain } from "../hooks/useTenant";

const HC_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  /* System font fallbacks if Google Fonts unavailable (offline/slow) */
  .hc-wrap, .hc-wrap * {
    font-family: 'DM Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .hc-syne {
    font-family: 'Syne', ui-sans-serif, system-ui, -apple-system, sans-serif;
  }

  .hc-wrap {
    position: relative;
    background: #0f172a;
    overflow: hidden;
    min-height: 100vh;
  }

  /* ── Background: ALL slide images stacked, only active one visible ── */
  .hc-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }

  .hc-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 30%;
    opacity: 0;
    transition: opacity 0.7s ease;
    /* Force browser to keep image in memory */
    will-change: opacity;
  }

  .hc-bg-img.active {
    opacity: 1;
    transform: scale(1);
    animation: hcZoom 8s ease-out forwards;
  }

  @keyframes hcZoom {
    from { transform: scale(1); }
    to   { transform: scale(1.04); }
  }

  .hc-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(15, 23, 42, 0.88) 0%,
      rgba(15, 23, 42, 0.52) 35%,
      rgba(15, 23, 42, 0.94) 100%
    );
    z-index: 1;
  }

  .hc-overlay-side {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      rgba(15, 23, 42, 0.92) 0%,
      rgba(15, 23, 42, 0.45) 50%,
      transparent 78%
    );
    z-index: 1;
  }

  /* ── DESKTOP content ── */
  .hc-content {
    position: absolute;
    bottom: 200px;
    left: 0;
    right: 0;
    z-index: 3;
    padding-top: 72px;
  }

  .hc-content-wrap {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 48px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 60px;
  }

  .hc-text {
    flex: 1;
    max-width: 48%;
  }

  /* Right image card */
  .hc-glass-card {
    flex: 1;
    max-width: 44%;
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1);
    align-self: flex-end;
    max-height: 360px;
  }

  /* Card images: all stacked, active one shown */
  .hc-card-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity 0.6s ease;
  }

  .hc-card-img.active { opacity: 1; }

  /* Spacer to maintain card height */
  .hc-card-spacer {
    width: 100%;
    min-height: 290px;
    max-height: 360px;
    display: block;
    visibility: hidden;
  }

  .hc-glass-card::before {
    content: '';
    position: absolute;
    top: 0; left: 16px; right: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
    z-index: 2;
    pointer-events: none;
  }

  /* Mobile-only below-image block — hidden on desktop */
  .hc-below-image { display: none; }

  /* ── Eyebrow ── */
  .hc-eyebrow { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .hc-eyebrow-dot {
    width:6px; height:6px; border-radius:50%;
    background:#3b82f6; flex-shrink:0;
    box-shadow:0 0 8px rgba(59,130,246,0.55);
  }
  .hc-eyebrow-label {
    font-size:10px; font-weight:600;
    letter-spacing:0.22em; text-transform:uppercase;
    color:rgba(147,197,253,0.85);
  }

  /* ── Car name ── */
  .hc-car-name {
    font-size:clamp(1.8rem,4vw,3.2rem);
    font-weight:800; letter-spacing:-0.02em; line-height:1.08;
    color:white; margin:0 0 18px;
    text-shadow:0 2px 24px rgba(0,0,0,0.4);
  }
  .hc-year-accent { color:#93c5fd; }

  /* ── Meta pills ── */
  .hc-meta { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
  .hc-meta-item {
    display:flex; align-items:center; gap:6px;
    background:rgba(255,255,255,0.07);
    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    padding:5px 12px; border-radius:40px;
    border:1px solid rgba(255,255,255,0.1);
    font-size:11px; font-weight:500; color:rgba(255,255,255,0.8);
  }
  .hc-meta-item svg { width:11px; height:11px; color:#60a5fa; }

  /* ── Price ── */
  .hc-price-section { margin:0 0 24px; }
  .hc-price-label {
    font-size:9px; font-weight:600;
    text-transform:uppercase; letter-spacing:0.18em;
    color:rgba(255,255,255,0.35); margin-bottom:4px;
  }
  .hc-price-value {
    font-size:clamp(1.1rem,2.5vw,1.6rem);
    font-weight:700; color:white; letter-spacing:-0.01em;
  }

  /* ── CTAs ── */
  .hc-ctas { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }

  .hc-enquire {
    display:inline-flex; align-items:center; gap:8px;
    background:rgba(220,38,38,0.18);
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
    border:1px solid rgba(220,38,38,0.45);
    color:white; font-weight:600; font-size:13px;
    padding:11px 24px; border-radius:40px; text-decoration:none;
    transition:all 0.25s ease;
    box-shadow:0 6px 20px rgba(220,38,38,0.15), inset 0 1px 0 rgba(255,255,255,0.1);
  }
  .hc-enquire:hover {
    background:rgba(220,38,38,0.3); border-color:rgba(220,38,38,0.65);
    transform:translateY(-2px); gap:12px;
  }

  .hc-view {
    display:inline-flex; align-items:center; gap:6px;
    background:rgba(255,255,255,0.07);
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
    border:1px solid rgba(255,255,255,0.14);
    color:rgba(255,255,255,0.85); font-weight:500; font-size:13px;
    padding:11px 22px; border-radius:40px; text-decoration:none;
    transition:all 0.25s ease;
  }
  .hc-view:hover {
    background:rgba(255,255,255,0.13); border-color:rgba(255,255,255,0.24);
    color:white; transform:translateY(-2px); gap:10px;
  }

  /* ── Counter ── */
  .hc-counter {
    position:absolute; bottom:120px; left:48px; z-index:4;
    font-size:10px; font-weight:600;
    letter-spacing:0.12em; color:rgba(255,255,255,0.35);
    background:rgba(255,255,255,0.05); backdrop-filter:blur(10px);
    padding:5px 13px; border-radius:40px;
    border:1px solid rgba(255,255,255,0.08);
  }

  /* ── Dots ── */
  .hc-dots {
    position:absolute; bottom:120px; left:50%; transform:translateX(-50%);
    display:flex; gap:8px; z-index:4;
  }
  .hc-dot {
    width:7px; height:7px; border-radius:4px; border:none; padding:0;
    cursor:pointer; background:rgba(255,255,255,0.22);
    transition:all 0.35s cubic-bezier(0.2,0.9,0.4,1);
  }
  .hc-dot.active { width:26px; background:white; box-shadow:0 0 8px rgba(255,255,255,0.4); }
  .hc-dot:hover  { background:rgba(255,255,255,0.5); }

  /* ── Nav arrows ── */
  .hc-nav {
    position:absolute; top:50%; transform:translateY(-50%);
    width:38px; height:38px; border-radius:50%;
    background:rgba(255,255,255,0.07); backdrop-filter:blur(14px);
    border:1px solid rgba(255,255,255,0.14);
    color:white; cursor:pointer; display:flex;
    align-items:center; justify-content:center; z-index:5;
    transition:all 0.25s ease; opacity:0; visibility:hidden;
  }
  .hc-wrap:hover .hc-nav { opacity:1; visibility:visible; }
  .hc-nav:hover { background:rgba(255,255,255,0.14); transform:translateY(-50%) scale(1.08); }
  .hc-prev { left:20px; }
  .hc-next { right:20px; }

  /* ── Trust badge ── */
  .hc-trust-badge {
    position:absolute; bottom:14px; left:14px; right:14px;
    display:flex; align-items:center; gap:8px;
    background:rgba(15,23,42,0.78); backdrop-filter:blur(16px);
    border:1px solid rgba(255,255,255,0.1); border-radius:10px;
    padding:8px 12px; z-index:2;
  }
  .hc-trust-dot {
    width:6px; height:6px; border-radius:50%; background:#22c55e;
    flex-shrink:0; box-shadow:0 0 6px rgba(34,197,94,0.6);
  }
  .hc-trust-text { font-size:10px; font-weight:600; color:rgba(255,255,255,0.7); letter-spacing:0.04em; }

  /* ── Progress bar ── */
  .hc-progress {
    position:absolute; bottom:0; left:0; height:2px;
    background:rgba(220,38,38,0.65); z-index:5; transition:width 0.1s linear;
  }

  /* ── Content animation ── */
  .hc-anim { animation:slideUp 0.65s cubic-bezier(0.2,0.9,0.4,1) forwards; }

  @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin    { to{transform:rotate(360deg)} }

  .hc-spacer { height:0; width:100%; position:relative; z-index:2; }

  /* ════════════════
     TABLET
  ════════════════ */
  @media (max-width:1024px) {
    .hc-content { bottom:180px; }
    .hc-content-wrap { padding:0 32px; gap:36px; }
    .hc-text { max-width:50%; }
    .hc-glass-card { max-width:46%; max-height:320px; }
    .hc-card-spacer { min-height:260px; max-height:320px; }
    .hc-counter { left:32px; bottom:100px; }
    .hc-dots    { bottom:100px; }
    .hc-spacer  { height:0; }
  }

  /* ════════════════════════════════════════
     MOBILE ≤768px
     Order: title → image → meta → price → CTAs
  ════════════════════════════════════════ */
  @media (max-width:768px) {
    .hc-wrap { min-height: 92svh; }

    .hc-overlay {
      background:linear-gradient(
        to bottom,
        rgba(15,23,42,0.93) 0%,
        rgba(15,23,42,0.65) 25%,
        rgba(15,23,42,0.98) 100%
      );
    }
    .hc-overlay-side { display:none; }

    .hc-content {
      position:absolute; inset:0; bottom:auto;
      display:flex; align-items:center; justify-content:center;
    }

    .hc-content-wrap {
      padding:100px 20px 120px;
      flex-direction:column; align-items:center; gap:0; width:100%;
    }

    /* 1. Title block */
    .hc-text {
      max-width:100%; width:100%;
      text-align:center; order:1; margin-bottom:16px;
    }

    /* Hide meta/price/ctas from text block on mobile */
    .hc-text .hc-meta,
    .hc-text .hc-price-section,
    .hc-text .hc-ctas { display:none; }

    /* 2. Image card */
    .hc-glass-card {
      max-width:100%; width:100%;
      max-height:230px; border-radius:16px;
      order:2; margin:0 0 16px; align-self:center;
    }
    .hc-card-spacer { min-height:195px; max-height:230px; }

    /* 3. Below-image: meta + price + CTAs */
    .hc-below-image {
      display:flex !important;
      flex-direction:column; align-items:center;
      width:100%; order:3; gap:0;
    }
    .hc-below-image .hc-meta    { justify-content:center; margin-bottom:14px; }
    .hc-below-image .hc-price-section { text-align:center; margin-bottom:18px; }
    .hc-below-image .hc-ctas   { justify-content:center; }

    .hc-eyebrow    { justify-content:center; }
    .hc-car-name   { font-size:clamp(1.35rem,5.5vw,1.9rem); text-align:center; margin-bottom:0; }
    .hc-nav        { display:none; }
    .hc-counter    { left:16px; bottom:16px; font-size:9px; padding:3px 10px; }
    .hc-dots       { bottom:16px; }
    .hc-spacer     { height:0; }
  }

  @media (max-width:640px) {
    .hc-content-wrap { padding:88px 16px 110px; }
    .hc-glass-card   { max-height:200px; }
    .hc-card-spacer  { min-height:170px; max-height:200px; }
    .hc-car-name     { font-size:clamp(1.2rem,5vw,1.65rem); }
    .hc-meta-item    { font-size:10px; padding:4px 10px; }
    .hc-enquire, .hc-view { padding:10px 20px; font-size:12px; }
    .hc-spacer       { height:0; }
  }

  @media (max-width:480px) {
    .hc-content-wrap { padding:80px 14px 105px; }
    .hc-glass-card   { max-height:185px; border-radius:14px; }
    .hc-card-spacer  { min-height:155px; max-height:185px; }
    .hc-eyebrow-label { font-size:9px; letter-spacing:0.18em; }
    .hc-car-name     { font-size:clamp(1.05rem,4.5vw,1.4rem); }
    .hc-meta-item    { font-size:9px; padding:3px 8px; }
    .hc-meta-item svg { width:9px; height:9px; }
    .hc-price-value  { font-size:clamp(0.9rem,3vw,1.1rem); }
    .hc-enquire, .hc-view { padding:9px 16px; font-size:11px; }
    .hc-counter      { left:14px; bottom:13px; font-size:8px; padding:2px 8px; }
    .hc-dots         { bottom:13px; gap:6px; }
    .hc-dot          { width:5px; height:5px; }
    .hc-dot.active   { width:18px; }
    .hc-trust-badge  { padding:6px 10px; }
    .hc-trust-text   { font-size:9px; }
    .hc-spacer       { height:0; }
  }

  @media (max-width:375px) {
    .hc-content-wrap { padding:76px 12px 100px; }
    .hc-glass-card   { max-height:165px; }
    .hc-card-spacer  { min-height:140px; max-height:165px; }
    .hc-car-name     { font-size:1rem; }
    .hc-enquire, .hc-view { padding:8px 14px; font-size:10px; }
  }
`;

const INTERVAL_MS = 4000;
const TOUCH_PAUSE = 10000;

// Format price as RM 265,000
function formatPrice(val) {
  if (!val) return null;
  const str = String(val).replace(/[^0-9.]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) return val; // already formatted string like "RM 265,000"
  return `RM ${num.toLocaleString("en-MY")}`;
}

export default function HeroCarousel({ siteName, waNumber }) {
  const { tenant } = useTenant();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [imgLoaded, setImgLoaded] = useState({}); // track which images loaded

  const hoverPaused = useRef(false);
  const manualPaused = useRef(false);
  const manualTimer = useRef(null);
  const touchStartX = useRef(null);
  const progressStart = useRef(null);

  useEffect(() => {
    if (tenant === undefined) return; // still loading
    const fetchSlides = async () => {
      try {
        const SUPERADMIN_ID = '1e7bf24e-5b71-4c64-8d03-b60db5e59316';
        const { data, error } = await supabase
          .from("hero_carousel_slides")
          .select("*")
          .eq("active", true)
          .eq("dealer_id", tenant?.id ?? SUPERADMIN_ID)
          .order("sort_order", { ascending: true });
        setSlides(!error && data ? data : []);
      } catch {
        setSlides([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSlides();
  }, [tenant]);

  // Preload ALL slide images on mount so they're cached
  useEffect(() => {
    if (!slides.length) return;
    slides.forEach((s, i) => {
      if (!s.image_url) return;
      const img = new Image();
      img.src = s.image_url;
      img.onload = () => setImgLoaded((prev) => ({ ...prev, [i]: true }));
    });
  }, [slides]);

  const triggerManualPause = useCallback(() => {
    manualPaused.current = true;
    clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => {
      manualPaused.current = false;
    }, TOUCH_PAUSE);
  }, []);

  const isPaused = () => hoverPaused.current || manualPaused.current;

  const advance = useCallback((n) => {
    setIdx(n);
    setAnimKey((k) => k + 1);
    setProgress(0);
    progressStart.current = Date.now();
  }, []);

  // Auto-slide every 4s
  useEffect(() => {
    if (slides.length <= 1) return;
    progressStart.current = Date.now();
    const tick = setInterval(() => {
      if (!isPaused()) {
        const elapsed = Date.now() - progressStart.current;
        const pct = Math.min((elapsed / INTERVAL_MS) * 100, 100);
        setProgress(pct);
        if (pct >= 100) {
          setIdx((i) => {
            const n = (i + 1) % slides.length;
            setAnimKey((k) => k + 1);
            setProgress(0);
            progressStart.current = Date.now();
            return n;
          });
        }
      }
    }, 50);
    return () => clearInterval(tick);
  }, [slides.length]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      triggerManualPause();
      setIdx((i) => {
        const n =
          diff > 0
            ? (i + 1) % slides.length
            : (i - 1 + slides.length) % slides.length;
        setAnimKey((k) => k + 1);
        setProgress(0);
        progressStart.current = Date.now();
        return n;
      });
    }
    touchStartX.current = null;
  };

  const handleDot = (i) => {
    triggerManualPause();
    advance(i);
  };
  const handlePrev = () => {
    triggerManualPause();
    setIdx((i) => {
      const n = (i - 1 + slides.length) % slides.length;
      advance(n);
      return n;
    });
  };
  const handleNext = () => {
    triggerManualPause();
    setIdx((i) => {
      const n = (i + 1) % slides.length;
      advance(n);
      return n;
    });
  };

  const getMetaIcon = (type) => {
    const m = {
      transmission: <Gauge />,
      fuel: <Fuel />,
      mileage: <Gauge />,
      engine: <Fuel />,
    };
    return m[type?.toLowerCase()] || <Shield />;
  };

  if (loading)
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <style>{HC_CSS}</style>
        <div
          style={{
            width: "34px",
            height: "34px",
            border: "2px solid rgba(255,255,255,0.07)",
            borderTop: "2px solid rgba(220,38,38,0.6)",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      </div>
    );

  if (!slides.length)
    return (
      <section
        style={{
          minHeight: "70vh",
          background: "linear-gradient(160deg,#0f172a 0%,#1e293b 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "60px 20px",
        }}
      >
        <style>{HC_CSS}</style>
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(220,38,38,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "22px",
          }}
        >
          <Sparkles
            style={{ color: "#f87171", width: "22px", height: "22px" }}
          />
        </div>
        <h1
          className="hc-syne"
          style={{
            fontSize: "clamp(1.8rem,5vw,3rem)",
            fontWeight: "800",
            color: "white",
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Find Your Perfect <span style={{ color: "#93c5fd" }}>Drive</span>
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "clamp(0.875rem,3vw,1rem)",
            maxWidth: "460px",
            lineHeight: 1.7,
            margin: "0 0 28px",
          }}
        >
          Browse verified vehicles with transparent pricing and no hidden fees.
        </p>
        <Link
          to="/cars"
          style={{
            background: "rgba(220,38,38,0.15)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(220,38,38,0.4)",
            color: "white",
            fontWeight: "600",
            fontSize: "14px",
            padding: "12px 26px",
            borderRadius: "40px",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Browse Our Cars <ArrowRight size={14} />
        </Link>
      </section>
    );

  const s = slides[idx];
  const badge = s.badge && s.badge !== "None" ? s.badge : null;
  const stats = Array.isArray(s.stats) ? s.stats.filter((x) => x.value) : [];
  const priceRaw = stats.find(
    (x) => (x.key || x.type)?.toLowerCase() === "price",
  )?.value;
  const priceVal = formatPrice(priceRaw);
  const metaStats = stats
    .filter((x) => (x.key || x.type)?.toLowerCase() !== "price")
    .slice(0, 3);
  const phone = (s.whatsapp_number || waNumber || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `Hi, I'm interested in the ${s.year || ""} ${s.car_name || "car"}. Can you share more details?`,
  );
  const waHref = phone ? `https://wa.me/${phone}?text=${waMsg}` : null;

  const metaItems = [
    s.transmission && { icon: <Gauge />, label: s.transmission },
    s.fuel_type && { icon: <Fuel />, label: s.fuel_type },
    ...metaStats.map((st) => ({
      icon: getMetaIcon(st.type),
      label: `${st.value}${st.unit ? " " + st.unit : ""}`,
    })),
  ].filter(Boolean);

  // Reusable meta+price+ctas block
  const MetaBlock = ({ extraClass = "" }) => (
    <div className={extraClass}>
      {metaItems.length > 0 && (
        <div className="hc-meta">
          {metaItems.map((item, i) => (
            <div key={i} className="hc-meta-item">
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
      {priceVal && (
        <div className="hc-price-section">
          <div className="hc-price-label">Starting from</div>
          <div className="hc-price-value hc-syne">{priceVal}</div>
        </div>
      )}
      <div className="hc-ctas">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hc-enquire"
          >
            Enquire Now <ArrowRight size={12} />
          </a>
        )}
        {s.car_listing_id && (
          <Link
            to={`/cars/${s.car_listings?.slug || s.car_listing_id}`}
            className="hc-view"
          >
            View Details
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      <section
        className="hc-wrap"
        onMouseEnter={() => {
          hoverPaused.current = true;
        }}
        onMouseLeave={() => {
          hoverPaused.current = false;
          progressStart.current = Date.now();
          setProgress(0);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <style>{HC_CSS}</style>

        {/* Progress bar */}
        <div className="hc-progress" style={{ width: `${progress}%` }} />

        {/* ── Background: ALL images in DOM, only active one visible ── */}
        <div className="hc-bg">
          {slides.map((slide, i) =>
            slide.image_url ? (
              <img
                key={`bg-${i}`}
                src={slide.image_url}
                alt=""
                className={`hc-bg-img${i === idx ? " active" : ""}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchpriority={i === 0 ? "high" : "auto"}
              />
            ) : null,
          )}
          <div className="hc-overlay" />
          <div className="hc-overlay-side" />
        </div>

        {/* Slide counter */}
        {slides.length > 1 && (
          <div className="hc-counter">
            <span style={{ color: "white", fontWeight: 700 }}>
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span> / {String(slides.length).padStart(2, "0")}</span>
          </div>
        )}

        {/* Content */}
        <div className="hc-content">
          <div className="hc-content-wrap">
            {/* 1. Title */}
            <div className="hc-text">
              <div key={`c-${animKey}`} className="hc-anim">
                <div className="hc-eyebrow">
                  <div className="hc-eyebrow-dot" />
                  <span className="hc-eyebrow-label">
                    {badge || "Verified Listing"}
                  </span>
                </div>
                <h1 className="hc-car-name hc-syne">
                  {s.year && <span className="hc-year-accent">{s.year} </span>}
                  {s.car_name}
                </h1>
                {/* Desktop: meta/price/ctas inline */}
                <MetaBlock />
              </div>
            </div>

            {/* 2. Right image glass card — ALL images stacked ── */}
            <div className="hc-glass-card">
              {/* spacer maintains card height */}
              <img
                className="hc-card-spacer"
                src={slides[0]?.image_url}
                alt=""
                style={{ visibility: "hidden", display: "block" }}
              />
              {slides.map((slide, i) =>
                slide.image_url ? (
                  <img
                    key={`card-${i}`}
                    src={slide.image_url}
                    alt={i === idx ? `${slide.car_name} preview` : ""}
                    className={`hc-card-img${i === idx ? " active" : ""}`}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                ) : null,
              )}
              <div className="hc-trust-badge">
                <div className="hc-trust-dot" />
                <span className="hc-trust-text">Verified · No Hidden Fees</span>
                <CheckCircle
                  size={11}
                  style={{
                    color: "#22c55e",
                    marginLeft: "auto",
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>

            {/* 3. Mobile only: meta + price + CTAs below image */}
            <MetaBlock extraClass="hc-below-image" />
          </div>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="hc-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => handleDot(i)}
                className={`hc-dot${i === idx ? " active" : ""}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Nav arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous"
              className="hc-nav hc-prev"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next"
              className="hc-nav hc-next"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </section>

      <div className="hc-spacer" />
    </>
  );
}
