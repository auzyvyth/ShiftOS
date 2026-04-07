import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Shield,
  TrendingDown,
  Star,
  CheckCircle,
  Users,
  DollarSign,
  UserCheck,
  ShieldCheck,
  Calculator,
  Flame,
  Search,
  ChevronDown,
  ArrowRight,
  Zap,
  MapPin,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyWhatsAppButton from "@/components/StickyWhatsAppButton";
import CarCard from "@/components/CarCard";
import HeroCarousel from "@/components/HeroCarousel";
import { supabase } from "../supabaseClient";
import { useSiteProfile } from "../hooks/useSiteProfile";
import useTenant, { isSubdomain } from "../hooks/useTenant";
import { useCTAContext, buildWaUrl } from "../hooks/useCTAContext";

const CAR_FIELDS =
  "id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,images,status,created_at";
const BRANDS = [
  "Perodua",
  "Proton",
  "Honda",
  "Toyota",
  "Mazda",
  "BMW",
  "Mercedes",
  "Hyundai",
  "Nissan",
  "Mitsubishi",
];
const BODY_TYPES = ["Sedan", "SUV", "Hatchback", "MPV", "Pickup", "Coupe"];
const BUDGET_OPTIONS = [
  { value: "30000", label: "Under RM 30k" },
  { value: "50000", label: "Under RM 50k" },
  { value: "80000", label: "Under RM 80k" },
  { value: "120000", label: "Under RM 120k" },
  { value: "200000", label: "Under RM 200k" },
];

const isHotDeal = (c) => {
  const op = c.original_price,
    sp = c.selling_price;
  return op && op > 0 && sp > 0 && sp <= op * 0.97;
};

// ── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: open
            ? "rgba(255,255,255,0.09)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? "rgba(220,38,38,0.45)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: "10px",
          padding: "12px 14px",
          cursor: "pointer",
          transition: "all 0.2s",
          fontFamily: "'DM Sans',sans-serif",
          outline: "none",
        }}
      >
        <Icon
          size={14}
          style={{
            color: open ? "#f87171" : "#64748b",
            flexShrink: 0,
            transition: "color 0.2s",
          }}
        />
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <p
            style={{
              color: "#64748b",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              margin: "0 0 3px 0",
            }}
          >
            {label}
          </p>
          <p
            style={{
              color: value ? "white" : "#94a3b8",
              fontSize: "13px",
              fontWeight: value ? "600" : "400",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayLabel}
          </p>
        </div>
        <ChevronDown
          size={12}
          style={{
            color: "#475569",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "rgba(15,23,42,0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            animation: "dropIn 0.15s ease",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 16px",
              background: !value ? "rgba(220,38,38,0.08)" : "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              color: !value ? "#f87171" : "#94a3b8",
              fontSize: "13px",
              fontWeight: !value ? "600" : "400",
              cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {placeholder}
          </button>
          {options.map((opt, i) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px",
                  background: isSelected
                    ? "rgba(220,38,38,0.1)"
                    : "transparent",
                  border: "none",
                  borderBottom:
                    i === options.length - 1
                      ? "none"
                      : "1px solid rgba(255,255,255,0.04)",
                  color: isSelected ? "#f87171" : "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: isSelected ? "600" : "400",
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {opt.label}
                {isSelected && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#dc2626",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FadeIn ────────────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setV(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(30,41,59,0.6)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "200px",
          background:
            "linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div style={{ padding: "16px" }}>
        {[70, 50, 90, 100].map((w, i) => (
          <div
            key={i}
            style={{
              height: "11px",
              width: `${w}%`,
              background: "#334155",
              borderRadius: "6px",
              marginBottom: "10px",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Button styles ─────────────────────────────────────────────────────────────
const redGlassBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(220,38,38,0.16)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(220,38,38,0.42)",
  color: "white",
  fontWeight: "600",
  fontSize: "14px",
  padding: "13px 28px",
  borderRadius: "50px",
  textDecoration: "none",
  boxShadow:
    "0 4px 20px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.1)",
  transition: "all 0.25s ease",
  position: "relative",
  overflow: "hidden",
};
const waBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(37,211,102,0.08)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(37,211,102,0.25)",
  color: "#4ade80",
  fontWeight: "600",
  fontSize: "14px",
  padding: "13px 28px",
  borderRadius: "50px",
  textDecoration: "none",
  transition: "all 0.25s ease",
};
const glassCard = {
  background: "rgba(30,41,59,0.5)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
};

// ── HomePage ──────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation();
  const { siteName, waUrl } = useSiteProfile();
  const { tenant, loading: tenantLoading } = useTenant();
  const ctaCtx = useCTAContext();
  const [featured, setFeatured] = useState([]);
  const [hotDeals, setHotDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState(0);
  const [soldCount, setSoldCount] = useState(null);
  const [brand, setBrand] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    if (tenantLoading) return;
    let ch, soldCh;
    const load = async () => {
      let query = supabase
        .from("car_listings")
        .select('*, profiles(dealership, site_name, subdomain, whatsapp_number)', { count: "exact" })
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);

      if (tenant?.id) {
        query = query.eq("dealer_id", tenant.id);
      }

      const { data, error, count } = await query;
      if (!error && data) {
        setFeatured(data.slice(0, 6));
        setStock(count || data.length);
        setHotDeals(
          data
            .filter(isHotDeal)
            .sort(
              (a, b) =>
                (b.original_price - b.selling_price) / b.original_price -
                (a.original_price - a.selling_price) / a.original_price,
            )
            .slice(0, 6),
        );
      }
      setLoading(false);
    };
    const fetchSoldCount = async () => {
      let query = supabase
        .from("car_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "sold");

      if (tenant?.id) {
        query = query.eq("dealer_id", tenant.id);
      }

      const { count } = await query;
      setSoldCount(count || 0);
    };
    load();
    fetchSoldCount();
    ch = supabase
      .channel("home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "car_listings" },
        load,
      )
      .subscribe();
    soldCh = supabase
      .channel("home_sold")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "car_listings" },
        fetchSoldCount,
      )
      .subscribe();
    return () => {
      if (ch) supabase.removeChannel(ch);
      if (soldCh) supabase.removeChannel(soldCh);
    };
  }, [tenant, tenantLoading]);

  useEffect(() => {
    async function checkDealerRedirect() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('subdomain, role')
        .eq('id', user.id)
        .maybeSingle();
      const isOnMainDomain = !isSubdomain();
      if (isOnMainDomain && profile?.subdomain && profile?.role === 'dealer') {
        window.location.href = `https://${profile.subdomain}.xdrive.my`;
      }
    }
    checkDealerRedirect();
  }, []);

  const searchUrl = () => {
    const p = new URLSearchParams();
    if (brand) p.set("brand", brand);
    if (bodyType) p.set("body_type", bodyType);
    if (maxPrice) p.set("max_price", maxPrice);
    const q = p.toString();
    return q ? `/cars?${q}` : "/cars";
  };

  // ── Hardcoded storefront defaults ──────────────────────────────────────────
  const HARDCODED_DEFAULT_WHY = {
    title: t("home.whyChoose.title"),
    items: [
      { title: t("home.whyChoose.benefit1Title"), desc: t("home.whyChoose.benefit1Desc") },
      { title: t("home.whyChoose.benefit2Title"), desc: t("home.whyChoose.benefit2Desc") },
      { title: t("home.whyChoose.benefit3Title"), desc: t("home.whyChoose.benefit3Desc") },
      { title: t("home.whyChoose.benefit4Title"), desc: t("home.whyChoose.benefit4Desc") },
    ],
  };
  const HARDCODED_DEFAULT_HOW = {
    title: t("home.howItWorks.title"),
    steps: [
      { title: "Tell Us What You Need",    desc: "WhatsApp us your budget and must-haves." },
      { title: "We Find the Best Options", desc: "We shortlist verified cars that match." },
      { title: "Inspect & Test Drive",     desc: "Visit, inspect, and take it for a spin." },
      { title: "Drive Away Happy",         desc: "Best deal negotiated, paperwork handled." },
    ],
  };
  const HARDCODED_DEFAULT_TESTIMONIALS = [
    { name: "Ahmad Faris",    location: "Kuala Lumpur", text: "Saved RM 8,000 on my Honda Civic. Best deal I could never have gotten myself." },
    { name: "Siti Norzahira", location: "Selangor",     text: "Zero pressure, honest advice, best price in town. Will definitely come back." },
    { name: "Rajendran K.",   location: "Penang",       text: "Found my perfect car in 3 days and saved thousands. Highly recommended." },
  ];
  const HARDCODED_DEFAULT_CTA = {
    title: t("home.cta.title"),
    subtitle: t("home.cta.subtitle"),
    primary_label: t("home.cta.browseBtn"),
    secondary_label: t("home.cta.whatsappBtn"),
  };

  const whyData          = tenant?.storefront_why          || HARDCODED_DEFAULT_WHY;
  const howData          = tenant?.storefront_how          || HARDCODED_DEFAULT_HOW;
  const testimonialsData = tenant?.storefront_testimonials || HARDCODED_DEFAULT_TESTIMONIALS;
  const ctaData          = tenant?.storefront_cta          || HARDCODED_DEFAULT_CTA;

  // Icons are always hardcoded — they can't be stored in the DB
  const whyIcons = [TrendingDown, UserCheck, ShieldCheck, DollarSign];
  const howIcons = [MessageCircle, Search, Shield, CheckCircle];
  const howNums  = ["01", "02", "03", "04"];

  const benefits     = (whyData.items || []).map((item, i) => ({ icon: whyIcons[i], title: item.title, desc: item.desc }));
  const whyTitle     = whyData.title;
  const steps        = (howData.steps || []).map((step, i) => ({ n: howNums[i], icon: howIcons[i], t: step.title, d: step.desc }));
  const howTitle     = howData.title;
  const testimonials = testimonialsData.map((item) => ({ name: item.name, loc: item.location, text: item.text, r: 5 }));
  const ctaTitle          = ctaData.title;
  const ctaSubtitle       = ctaData.subtitle;
  const ctaPrimaryLabel   = ctaData.primary_label;
  const ctaSecondaryLabel = ctaData.secondary_label;

  if (isSubdomain() && tenant === null && !tenantLoading) {
    return (
      <div style={{ background: '#0d0d0d', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: '#6b7280', fontSize: 15 }}>This dealer page doesn't exist.</p>
        <a href="https://xdrive.my" style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>← Browse all cars</a>
      </div>
    );
  }

  const soldDisplay =
    soldCount !== null && soldCount > 0
      ? `${soldCount}+`
      : soldCount === 0
        ? "0"
        : "500+";
  const wrap = { maxWidth: "1280px", margin: "0 auto", padding: "0 16px" };

  // Section backgrounds — navy/slate alternating, feels lighter and trustworthy
  const secA = { background: "#0f172a" }; // deep navy
  const secB = { background: "#111827" }; // slightly warm dark
  const secLight = {
    background: "#0f172a",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html, body { overflow-x: hidden; width: 100%; }
        body { background: #0f172a !important; margin: 0 !important; }
        * { font-family: 'DM Sans', sans-serif; }

        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse-red{ 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)} 50%{box-shadow:0 0 0 10px rgba(220,38,38,0)} }
        @keyframes dropIn   { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

        .red-glass-btn:hover {
          background: rgba(220,38,38,0.28) !important;
          border-color: rgba(220,38,38,0.6) !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.15) !important;
        }
        .wa-btn-hp:hover {
          background: rgba(37,211,102,0.16) !important;
          border-color: rgba(37,211,102,0.4) !important;
        }
        .ghost-glass:hover {
          background: rgba(255,255,255,0.1) !important;
          border-color: rgba(255,255,255,0.2) !important;
        }
        .card-hover {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease !important;
        }
        .card-hover:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.4) !important;
          border-color: rgba(220,38,38,0.2) !important;
        }

        /* Section label dots */
        .sec-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .sec-label-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #dc2626;
          flex-shrink: 0;
        }
        .sec-label-text {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #f87171;
        }

        .sec-title {
          font-family: 'Syne', sans-serif;
          color: white;
          font-size: clamp(1.4rem, 5vw, 2.2rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .sec-divider {
          width: 36px;
          height: 2px;
          background: rgba(220,38,38,0.6);
          border-radius: 2px;
          margin-top: 12px;
        }

        /* Car grid */
        .car-grid-hp { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
        @media(max-width:640px) {
          .car-grid-hp { grid-template-columns:repeat(2,1fr) !important; gap:10px !important; }
        }

        /* Search grid */
        .search-grid-hp {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 8px;
          align-items: stretch;
        }
        .search-hide-mobile { display: contents; }

        /* Hero buttons */
        .hero-btns-hp { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px; }

        /* Stats strip */
        .stats-flex { display:flex; }

        /* Section padding */
        .sec-pad { padding: 64px 0; }

        /* Tablet */
        @media(max-width: 768px) {
          .search-grid-hp { grid-template-columns: 1fr 1fr !important; }
          .search-btn-hp  { grid-column: 1 / -1 !important; }
        }

        /* Mobile */
        @media(max-width: 480px) {
          .search-grid-hp     { grid-template-columns: 1fr !important; gap: 6px !important; }
          .search-hide-mobile { display: contents !important; }
          .search-btn-hp      { width: 100% !important; justify-content: center !important; }
          .hero-btns-hp       { flex-direction: column !important; }
          .hero-btns-hp a, .hero-btns-hp button { justify-content: center !important; width: 100% !important; }
          .stats-flex > div   { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; }
          .for-dealers-inner  { flex-direction: column !important; align-items: flex-start !important; }
          .sec-pad { padding: 44px 0 !important; }
        }
      `}</style>

      <Helmet>
        <title>{siteName} — Buy Trusted Used Cars in Malaysia</title>
        <meta
          name="description"
          content="Browse 200+ verified used cars from trusted Malaysian dealers. Transparent pricing, no hidden fees, free consultation."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>

      <Header />

      {/* ══════════ HERO ══════════ */}
      <HeroCarousel siteName={siteName} stock={stock} />

      {/* ══════════ HOT DEALS ══════════ */}
      {(hotDeals.length > 0 || loading) && (
        <section className="sec-pad" style={secA}>
          <div style={wrap}>
            <FadeIn>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  marginBottom: "32px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div className="sec-label">
                    <div className="sec-label-dot" />
                    <span
                      className="sec-label-text"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Flame size={10} /> Limited Time
                    </span>
                  </div>
                  <h2 className="sec-title">Hot Deals</h2>
                  <div className="sec-divider" />
                </div>
                <Link
                  to="/cars?hot_deals=true"
                  style={{
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: "600",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#475569")
                  }
                >
                  View All <ArrowRight size={13} />
                </Link>
              </div>
            </FadeIn>
            <div className="car-grid-hp">
              {loading
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : hotDeals.map((c) => <CarCard key={c.id} car={c} ctaContext={ctaCtx} />)}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ FEATURED ══════════ */}
      <section className="sec-pad" style={secB}>
        <div style={wrap}>
          <FadeIn>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                marginBottom: "32px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <div className="sec-label">
                  <div
                    className="sec-label-dot"
                    style={{ background: "#f59e0b" }}
                  />
                  <span
                    className="sec-label-text"
                    style={{
                      color: "#fbbf24",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Star size={10} /> Just Listed
                  </span>
                </div>
                <h2 className="sec-title">{t("home.hotDeals.title")}</h2>
                <div className="sec-divider" />
              </div>
              <Link
                to="/cars"
                style={{
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: "600",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
              >
                All Cars <ArrowRight size={13} />
              </Link>
            </div>
          </FadeIn>
          <div className="car-grid-hp" style={{ marginBottom: "32px" }}>
            {loading
              ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
              : featured.map((c) => <CarCard key={c.id} car={c} ctaContext={ctaCtx} />)}
          </div>
          <div style={{ textAlign: "center" }}>
            <Link
              to="/cars"
              className="ghost-glass"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                fontWeight: "600",
                fontSize: "14px",
                padding: "13px 28px",
                borderRadius: "50px",
                textDecoration: "none",
                transition: "all 0.25s ease",
              }}
            >
              {t("home.hotDeals.viewAllBtn")} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ STATS ══════════ */}
      <section style={secLight}>
        <div style={wrap}>
          <div className="stats-flex">
            {[
              { Icon: Users, v: soldDisplay, l: "Cars Sold" },
              { Icon: Star, v: "4.9★", l: "Customer Rating" },
              { Icon: Shield, v: "RM 0", l: "Consultation Fee" },
            ].map((s, i, arr) => (
              <FadeIn key={i} delay={i * 0.1} style={{ flex: 1 }}>
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 16px",
                    borderRight:
                      i < arr.length - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                  }}
                >
                  <s.Icon
                    size={16}
                    style={{
                      color: "#dc2626",
                      margin: "0 auto 10px",
                      display: "block",
                    }}
                  />
                  <p
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      color: "white",
                      fontSize: "clamp(1.5rem,5vw,2.2rem)",
                      fontWeight: "800",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      margin: "0 0 5px 0",
                    }}
                  >
                    {s.v}
                  </p>
                  <p
                    style={{
                      color: "#475569",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      margin: 0,
                    }}
                  >
                    {s.l}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WHY XDRIVE ══════════ */}
      <section className="sec-pad" style={secA}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "32px" }}>
              <div className="sec-label">
                <div className="sec-label-dot" />
                <span className="sec-label-text">Why {siteName}</span>
              </div>
              <h2 className="sec-title">{whyTitle}</h2>
              <div className="sec-divider" />
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
              gap: "14px",
            }}
          >
            {benefits.map((b, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div
                  className="card-hover"
                  style={{ ...glassCard, padding: "22px", height: "100%" }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(220,38,38,0.1)",
                      border: "1px solid rgba(220,38,38,0.18)",
                      marginBottom: "14px",
                    }}
                  >
                    <b.icon size={17} style={{ color: "#f87171" }} />
                  </div>
                  <h3
                    style={{
                      color: "white",
                      fontSize: "13px",
                      fontWeight: "700",
                      margin: "0 0 7px 0",
                      fontFamily: "'Syne',sans-serif",
                    }}
                  >
                    {b.title}
                  </h3>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      lineHeight: "1.65",
                      margin: 0,
                    }}
                  >
                    {b.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="sec-pad" style={secB}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "32px" }}>
              <div className="sec-label">
                <div className="sec-label-dot" />
                <span className="sec-label-text">Simple Process</span>
              </div>
              <h2 className="sec-title">{howTitle}</h2>
              <div className="sec-divider" />
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
              gap: "14px",
            }}
          >
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div
                  className="card-hover"
                  style={{
                    ...glassCard,
                    padding: "22px",
                    position: "relative",
                    overflow: "hidden",
                    height: "100%",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "12px",
                      fontFamily: "'Syne',sans-serif",
                      fontSize: "4rem",
                      lineHeight: 1,
                      color: "rgba(220,38,38,0.05)",
                      userSelect: "none",
                      pointerEvents: "none",
                      fontWeight: "800",
                    }}
                  >
                    {s.n}
                  </span>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(220,38,38,0.1)",
                      border: "1px solid rgba(220,38,38,0.18)",
                      marginBottom: "14px",
                    }}
                  >
                    <s.icon size={17} style={{ color: "#f87171" }} />
                  </div>
                  <h3
                    style={{
                      color: "white",
                      fontSize: "13px",
                      fontWeight: "700",
                      margin: "0 0 7px 0",
                      fontFamily: "'Syne',sans-serif",
                    }}
                  >
                    {s.t}
                  </h3>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      lineHeight: "1.65",
                      margin: 0,
                    }}
                  >
                    {s.d}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section className="sec-pad" style={secA}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "32px" }}>
              <div className="sec-label">
                <div
                  className="sec-label-dot"
                  style={{ background: "#22c55e" }}
                />
                <span className="sec-label-text" style={{ color: "#4ade80" }}>
                  Real Buyers
                </span>
              </div>
              <h2 className="sec-title">{t("home.testimonials.title")}</h2>
              <div className="sec-divider" />
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
              gap: "14px",
            }}
          >
            {testimonials.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div style={{ ...glassCard, padding: "22px", height: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "3px",
                      marginBottom: "12px",
                    }}
                  >
                    {[...Array(item.r)].map((_, j) => (
                      <Star
                        key={j}
                        size={12}
                        style={{ fill: "#f59e0b", color: "#f59e0b" }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      color: "#cbd5e1",
                      fontSize: "13px",
                      lineHeight: "1.75",
                      marginBottom: "18px",
                      fontStyle: "italic",
                    }}
                  >
                    "{item.text}"
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        background: "rgba(220,38,38,0.12)",
                        border: "1px solid rgba(220,38,38,0.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          color: "#f87171",
                          fontWeight: "800",
                          fontSize: "13px",
                        }}
                      >
                        {item.name[0]}
                      </span>
                    </div>
                    <div>
                      <p
                        style={{
                          color: "white",
                          fontWeight: "700",
                          fontSize: "13px",
                          margin: "0 0 2px 0",
                        }}
                      >
                        {item.name}
                      </p>
                      <p
                        style={{
                          color: "#475569",
                          fontSize: "11px",
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <MapPin size={10} />
                        {item.loc}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CALCULATOR ══════════ */}
      <section className="sec-pad" style={secB}>
        <div style={wrap}>
          <FadeIn>
            <div
              style={{
                borderRadius: "18px",
                overflow: "hidden",
                position: "relative",
                background: "rgba(30,41,59,0.6)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexWrap: "wrap",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  padding: "36px",
                  flex: "1",
                  minWidth: "240px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "rgba(220,38,38,0.1)",
                    border: "1px solid rgba(220,38,38,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "18px",
                  }}
                >
                  <Calculator size={20} style={{ color: "#f87171" }} />
                </div>
                <h2
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    color: "white",
                    fontSize: "clamp(1.2rem,4vw,1.8rem)",
                    fontWeight: "800",
                    letterSpacing: "-0.02em",
                    margin: "0 0 10px 0",
                    lineHeight: 1.2,
                  }}
                >
                  {t("home.budget.title")}
                </h2>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    lineHeight: "1.7",
                    margin: "0 0 24px 0",
                  }}
                >
                  {t("home.budget.subtitle")}
                </p>
                <Link
                  to="/calculator"
                  className="red-glass-btn"
                  style={redGlassBtn}
                >
                  <Calculator size={15} />
                  {t("home.budget.calcBtn")}
                </Link>
              </div>
              <div
                style={{
                  flex: "1",
                  minWidth: "200px",
                  minHeight: "180px",
                  position: "relative",
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60"
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.25,
                    minHeight: "180px",
                  }}
                  loading="lazy"
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to right,rgba(30,41,59,0.6) 0%,transparent 55%)",
                  }}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FOR DEALERS ══════════ */}
      <section
        className="sec-pad"
        style={{ ...secA, borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div style={wrap}>
          <FadeIn>
            <div
              className="for-dealers-inner"
              style={{
                ...glassCard,
                padding: "36px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "24px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(ellipse at 80% 50%,rgba(220,38,38,0.04) 0%,transparent 65%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: "200px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "14px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#dc2626",
                      display: "inline-block",
                      animation: "pulse-red 2.5s infinite",
                    }}
                  />
                  <span
                    style={{
                      color: "#f87171",
                      fontSize: "10px",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                    }}
                  >
                    For Car Dealers
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    color: "white",
                    fontSize: "clamp(1.2rem,4vw,1.8rem)",
                    fontWeight: "800",
                    letterSpacing: "-0.02em",
                    margin: "0 0 10px 0",
                    lineHeight: 1.2,
                  }}
                >
                  Run your dealership smarter with{" "}
                  <span style={{ color: "#f87171" }}>ShiftOS.</span>
                </h2>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    lineHeight: "1.7",
                    margin: 0,
                  }}
                >
                  Manage listings, track your team, generate TikTok content, and
                  grow sales — all from one dashboard built for Malaysian
                  dealers.
                </p>
              </div>
              <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
                <Link
                  to="/for-dealers"
                  className="red-glass-btn"
                  style={redGlassBtn}
                >
                  Learn About ShiftOS <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section
        id="contact"
        className="sec-pad"
        style={{ ...secB, position: "relative", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle,rgba(220,38,38,0.04) 0%,transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            ...wrap,
            maxWidth: "600px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <FadeIn>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(220,38,38,0.1)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(220,38,38,0.2)",
                  borderRadius: "40px",
                  padding: "5px 14px",
                  fontSize: "10px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#f87171",
                }}
              >
                Ready to Drive?
              </span>
            </div>
            <h2
              style={{
                fontFamily: "'Syne',sans-serif",
                color: "white",
                fontSize: "clamp(2rem,7vw,3.8rem)",
                fontWeight: "800",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                margin: "0 0 16px 0",
              }}
            >
              {ctaTitle}
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "clamp(13px,3.5vw,15px)",
                lineHeight: "1.75",
                margin: "0 0 36px 0",
              }}
            >
              {ctaSubtitle}
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link to="/cars" className="red-glass-btn" style={redGlassBtn}>
                {ctaPrimaryLabel} <ArrowRight size={15} />
              </Link>
              <a
                href={buildWaUrl(
                  ctaCtx.type !== 'loading' ? ctaCtx : { type: 'listing', profile: null, ref: null },
                  tenant?.whatsapp_number,
                  ctaCtx.type === 'salesman'
                    ? `Hi, I need help finding a car — via ${ctaCtx.ref}`
                    : `Hi ${siteName}, I need help finding a car`
                ) || (waUrl ? waUrl(`Hi ${siteName}, I need help finding a car`) : '#')}
                target="_blank"
                rel="noopener noreferrer"
                className="wa-btn-hp"
                style={waBtn}
              >
                <MessageCircle size={15} />
                {ctaSecondaryLabel}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default HomePage;
