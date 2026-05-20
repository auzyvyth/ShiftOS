import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link, Navigate } from "react-router-dom";
import {
  MessageCircle,
  Shield,
  TrendingDown,
  Star,
  CheckCircle,
  DollarSign,
  UserCheck,
  ShieldCheck,
  Calculator,
  Flame,
  Search,
  ChevronDown,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SciFiLoader from "../components/SciFiLoader";
import Footer from "@/components/Footer";
import StickyWhatsAppButton from "@/components/StickyWhatsAppButton";
import CarCard from "@/components/CarCard";
import HeroCarousel from "@/components/HeroCarousel";
import { supabase } from "../supabaseClient";
import { useSiteProfile } from "../hooks/useSiteProfile";
import useTenant, { isSubdomain } from "../hooks/useTenant";
import { useCTAContext, buildWaUrl } from "../hooks/useCTAContext";
import { captureRef, getRef } from "../utils/refTracking";
import {
  getOrCreateSessionId,
  getSlugFromURL,
  trackEvent,
} from "../utils/analytics";
import { getEmbedUrl } from "../utils/videoEmbed";
import CustomSelect from "../components/ui/CustomSelect";

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
        transform: v ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
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
        background: "#111113",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "200px",
          background:
            "linear-gradient(90deg,#141416 25%,#1C1C1E 50%,#141416 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div style={{ padding: "18px" }}>
        {[70, 50, 90, 100].map((w, i) => (
          <div
            key={i}
            style={{
              height: "10px",
              width: `${w}%`,
              background: "#1C1C1E",
              borderRadius: "4px",
              marginBottom: "10px",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────
const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "#DC2626",
  border: "1px solid #DC2626",
  color: "white",
  fontWeight: "600",
  fontSize: "14px",
  padding: "13px 28px",
  borderRadius: "4px",
  textDecoration: "none",
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: "0.02em",
  transition: "all 0.2s ease",
  position: "relative",
  overflow: "hidden",
};
const waBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "transparent",
  border: "1px solid rgba(37,211,102,0.3)",
  color: "#4ade80",
  fontWeight: "600",
  fontSize: "14px",
  padding: "13px 28px",
  borderRadius: "4px",
  textDecoration: "none",
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: "0.02em",
  transition: "all 0.25s ease",
};
const glassCard = {
  background: "#111113",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "6px",
};

// ── HomePage ──────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation();
  const { siteName, waUrl, profile } = useSiteProfile();
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
  const [superadminPhone, setSuperadminPhone] = useState(null);

  // On main domain (no tenant), fetch superadmin WhatsApp so the CTA button works
  useEffect(() => {
    if (tenantLoading || !tenant?.id) return;
    supabase
      .from("public_dealer_profiles")
      .select("whatsapp_number")
      .eq("id", tenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.whatsapp_number) setSuperadminPhone(data.whatsapp_number);
      });
  }, [tenant, tenantLoading]);

  // Capture ref slug from URL into sessionStorage on mount
  useEffect(() => {
    captureRef();
  }, []);

  // Fire store_visit once per session — runs after tenant resolves (null on main site, profile on subdomain)
  useEffect(() => {
    if (tenantLoading) return; // wait for useTenant to finish — fires once when loading → false
    const sessionKey = `sv_fired_${tenant?.id ?? "main"}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    trackEvent(supabase, "store_visit", {
      dealer_id: tenant?.id || null,
      metadata: { source: getSlugFromURL() ? "salesman_link" : "organic" },
    });
  }, [tenantLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire page_view for salesman ref links (requires tenant + slug)
  useEffect(() => {
    if (!tenant?.id) return;
    const slug = getRef();
    if (slug) {
      supabase
        .from("analytics_events")
        .insert({
          event_type: "page_view",
          salesman_slug: slug,
          dealer_id: tenant.id,
          metadata: { page: window.location.pathname },
        })
        .then(() => {});
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (tenant === undefined) return;
    let ch, soldCh;
    const load = async () => {
      let query = supabase
        .from("car_listings")
        .select(
          `${CAR_FIELDS}, dealer:profiles!car_listings_dealer_id_fkey(dealership, site_name, subdomain, whatsapp_number, site_logo_url, brand_color)`,
          { count: "exact" },
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(30);

      if (tenant?.id) {
        query = query.eq("dealer_id", tenant.id);
      }
      // no dealer_id filter on root domain — show all dealers

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
      // no dealer_id filter on root domain — count all dealers
      const { count } = await query;
      setSoldCount(count || 0);
    };
    load();
    // sold count is below-fold — defer until after first paint
    setTimeout(fetchSoldCount, 800);
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
  }, [tenant]);

  useEffect(() => {
    async function checkDealerRedirect() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("subdomain, role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "dealer" && profile?.subdomain && !isSubdomain()) {
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

  const HARDCODED_DEFAULT_WHY = {
    title: t("home.whyChoose.title"),
    items: [
      {
        title: t("home.whyChoose.benefit1Title"),
        desc: t("home.whyChoose.benefit1Desc"),
      },
      {
        title: t("home.whyChoose.benefit2Title"),
        desc: t("home.whyChoose.benefit2Desc"),
      },
      {
        title: t("home.whyChoose.benefit3Title"),
        desc: t("home.whyChoose.benefit3Desc"),
      },
      {
        title: t("home.whyChoose.benefit4Title"),
        desc: t("home.whyChoose.benefit4Desc"),
      },
    ],
  };
  const HARDCODED_DEFAULT_HOW = {
    title: t("home.howItWorks.title"),
    steps: [
      {
        title: "Tell Us What You Need",
        desc: "WhatsApp us your budget and must-haves.",
      },
      {
        title: "We Find the Best Options",
        desc: "We shortlist verified cars that match.",
      },
      {
        title: "Inspect & Test Drive",
        desc: "Visit, inspect, and take it for a spin.",
      },
      {
        title: "Drive Away Happy",
        desc: "Best deal negotiated, paperwork handled.",
      },
    ],
  };
  const HARDCODED_DEFAULT_TESTIMONIALS = [
    {
      name: "Ahmad Faris",
      location: "Kuala Lumpur",
      text: "Saved RM 8,000 on my Honda Civic. Best deal I could never have gotten myself.",
    },
    {
      name: "Siti Norzahira",
      location: "Selangor",
      text: "Zero pressure, honest advice, best price in town. Will definitely come back.",
    },
    {
      name: "Rajendran K.",
      location: "Penang",
      text: "Found my perfect car in 3 days and saved thousands. Highly recommended.",
    },
  ];
  const HARDCODED_DEFAULT_CTA = {
    title: t("home.cta.title"),
    subtitle: t("home.cta.subtitle"),
    primary_label: t("home.cta.browseBtn"),
    secondary_label: t("home.cta.whatsappBtn"),
  };

  const whyData = tenant?.storefront_why || HARDCODED_DEFAULT_WHY;
  const howData = tenant?.storefront_how || HARDCODED_DEFAULT_HOW;
  const testimonialsData =
    tenant?.storefront_testimonials || HARDCODED_DEFAULT_TESTIMONIALS;
  const ctaData = tenant?.storefront_cta || HARDCODED_DEFAULT_CTA;

  const whyIcons = [TrendingDown, UserCheck, ShieldCheck, DollarSign];
  const howIcons = [MessageCircle, Search, Shield, CheckCircle];
  const howNums = ["01", "02", "03", "04"];

  const benefits = (whyData.items || []).map((item, i) => ({
    icon: whyIcons[i],
    title: item.title,
    desc: item.desc,
  }));
  const whyTitle = whyData.title;
  const steps = (howData.steps || []).map((step, i) => ({
    n: howNums[i],
    icon: howIcons[i],
    t: step.title,
    d: step.desc,
  }));
  const howTitle = howData.title;
  const testimonials = testimonialsData.map((item) => ({
    name: item.name,
    loc: item.location,
    text: item.text,
    r: 5,
  }));
  const ctaTitle = ctaData.title;
  const ctaSubtitle = ctaData.subtitle;
  const ctaPrimaryLabel = ctaData.primary_label;
  const ctaSecondaryLabel = ctaData.secondary_label;

  // Main domain (xdrive.my) with no subdomain → show public marketplace
  if (!isSubdomain() && tenant === null) {
    return <Navigate to="/marketplace" replace />;
  }

  if (isSubdomain() && tenant === null && tenant !== undefined) {
    return (
      <div
        style={{
          background: "#0C0C0E",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <p style={{ color: "#52525A", fontSize: 15 }}>
          This dealer page doesn't exist.
        </p>
        <a
          href="https://xdrive.my"
          style={{ color: "#DC2626", fontSize: 13, marginTop: 12 }}
        >
          ← Browse all cars
        </a>
      </div>
    );
  }

  const soldDisplay =
    soldCount !== null && soldCount > 0
      ? `${soldCount}+`
      : soldCount === 0
        ? "0"
        : "500+";

  const wrap = { maxWidth: "1280px", margin: "0 auto", padding: "0 20px" };
  const secA = { background: "#0C0C0E" };
  const secB = { background: "#0F0F11" };
  const secLight = {
    background: "#0F0F11",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  };

  if (loading || tenantLoading) return <SciFiLoader />;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { overflow-x: hidden; width: 100%; }
        body { background: #0C0C0E !important; margin: 0 !important; }
        * { font-family: 'Outfit', sans-serif; }

        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse-red{ 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.35)} 50%{box-shadow:0 0 0 8px rgba(220,38,38,0)} }
        @keyframes dropIn   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

        .primary-btn:hover {
          background: #B91C1C !important;
          border-color: #B91C1C !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(220,38,38,0.3) !important;
        }
        .wa-btn-hp:hover {
          background: rgba(37,211,102,0.08) !important;
          border-color: rgba(37,211,102,0.5) !important;
        }
        .ghost-outline:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.18) !important;
        }
        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
        }
        .card-hover:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 32px rgba(0,0,0,0.5) !important;
          border-color: rgba(196,162,101,0.15) !important;
        }
        .view-all-link {
          color: #3A3A42;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        .view-all-link:hover { color: #C4A265; }

        /* Section label */
        .sec-eyebrow {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #C4A265;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sec-eyebrow::before {
          content: '';
          display: inline-block;
          width: 20px;
          height: 1px;
          background: #C4A265;
          opacity: 0.6;
          flex-shrink: 0;
        }
        .sec-eyebrow.red {
          color: #DC2626;
        }
        .sec-eyebrow.red::before {
          background: #DC2626;
        }
        .sec-eyebrow.green {
          color: #4ade80;
        }
        .sec-eyebrow.green::before {
          background: #4ade80;
        }

        .sec-title {
          font-family: 'Outfit', sans-serif;
          color: #F0F0F0;
          font-size: clamp(1.5rem, 4vw, 2.4rem);
          font-weight: 700;
          letter-spacing: -0.025em;
          margin: 0;
          line-height: 1.1;
        }

        /* Car grid */
        .car-grid-hp { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
        @media(max-width:640px) {
          .car-grid-hp { grid-template-columns:repeat(2,1fr) !important; gap:8px !important; }
        }

        /* Search grid */
        .search-grid-hp {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 8px;
          align-items: stretch;
        }

        /* Hero buttons */
        .hero-btns-hp { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px; }

        /* Stats strip */
        .stats-flex { display:flex; }

        /* Section padding */
        .sec-pad { padding: 72px 0; }

        /* Tablet */
        @media(max-width: 768px) {
          .search-grid-hp { grid-template-columns: 1fr 1fr !important; }
          .search-btn-hp  { grid-column: 1 / -1 !important; }
        }

        /* Mobile */
        @media(max-width: 480px) {
          .search-grid-hp     { grid-template-columns: 1fr !important; gap: 6px !important; }
          .search-btn-hp      { width: 100% !important; justify-content: center !important; }
          .hero-btns-hp       { flex-direction: column !important; }
          .hero-btns-hp a, .hero-btns-hp button { justify-content: center !important; width: 100% !important; }
          .stats-flex > div   { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; }
          .for-dealers-inner  { flex-direction: column !important; align-items: flex-start !important; }
          .sec-pad { padding: 48px 0 !important; }
        }
      `}</style>

      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
        />
        <link
          rel="preconnect"
          href="https://lemdkdizdlcirhbzqlos.supabase.co"
        />
        <title>
          {profile
            ? `${profile.site_name || profile.dealership} — Used Cars in Malaysia`
            : "XDrive — Buy & Sell Used Cars in Malaysia"}
        </title>
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <meta
          name="description"
          content={
            profile
              ? `Browse verified used cars from ${profile.site_name || profile.dealership}. Find your perfect car today.`
              : "Buy & sell verified used cars in Malaysia. Best prices, easy financing, trusted dealers on XDrive."
          }
        />
        <meta
          property="og:title"
          content={
            profile
              ? `${profile.site_name || profile.dealership} — Used Cars`
              : "XDrive — Used Cars in Malaysia"
          }
        />
        <meta
          property="og:image"
          content={profile?.site_logo_url || "https://xdrive.my/og-default.jpg"}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href="https://xdrive.my" />
        {!profile && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "XDrive",
              url: "https://xdrive.my",
              logo: "https://xdrive.my/xdrivelogo.png",
              description: "Buy and sell verified used cars in Malaysia",
              areaServed: "MY",
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Service",
                availableLanguage: ["en", "ms"],
              },
            })}
          </script>
        )}
      </Helmet>

      <Header />

      {/* ══════════ HERO ══════════ */}
      <HeroCarousel siteName={siteName} stock={stock} />

      {/* ══════════ HERO VIDEO ══════════ */}
      {tenant?.hero_video_enabled &&
        tenant?.hero_video_url &&
        getEmbedUrl(tenant.hero_video_url) && (
          <section
            className="sec-pad"
            style={{ background: "#080C14", paddingTop: 40, paddingBottom: 40 }}
          >
            <div
              style={{
                maxWidth: 900,
                margin: "0 auto",
                padding: "0 16px",
                textAlign: "center",
              }}
            >
              {tenant.hero_video_title && (
                <h2
                  style={{
                    fontSize: "clamp(20px,4vw,28px)",
                    fontWeight: 700,
                    color: "#f3f4f6",
                    marginBottom: 20,
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  {tenant.hero_video_title}
                </h2>
              )}
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
              >
                <iframe
                  src={getEmbedUrl(tenant.hero_video_url)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                  allowFullScreen
                  title="Dealer video"
                />
              </div>
            </div>
          </section>
        )}

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
                  marginBottom: "40px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <p className="sec-eyebrow red">
                    <Flame size={10} style={{ marginRight: -4 }} /> Limited Time
                  </p>
                  <h2 className="sec-title">Hot Deals</h2>
                </div>
                <Link to="/cars?hot_deals=true" className="view-all-link">
                  View All <ArrowRight size={12} />
                </Link>
              </div>
            </FadeIn>
            <div className="car-grid-hp">
              {loading
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : hotDeals.map((c) => (
                    <CarCard key={c.id} car={c} ctaContext={ctaCtx} />
                  ))}
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
                marginBottom: "40px",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <p className="sec-eyebrow">Just Listed</p>
                <h2 className="sec-title">{t("home.hotDeals.title")}</h2>
              </div>
              <Link to="/cars" className="view-all-link">
                All Cars <ArrowRight size={12} />
              </Link>
            </div>
          </FadeIn>
          <div className="car-grid-hp" style={{ marginBottom: "36px" }}>
            {loading
              ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
              : featured.map((c) => (
                  <CarCard key={c.id} car={c} ctaContext={ctaCtx} />
                ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <Link
              to="/cars"
              className="ghost-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#C0C0C6",
                fontWeight: "600",
                fontSize: "13px",
                padding: "12px 28px",
                borderRadius: "4px",
                textDecoration: "none",
                transition: "all 0.2s ease",
                letterSpacing: "0.02em",
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
              { v: soldDisplay, l: "Cars Sold" },
              { v: "4.9★", l: "Customer Rating" },
              { v: "RM 0", l: "Consultation Fee" },
            ].map((s, i, arr) => (
              <FadeIn key={i} delay={i * 0.08} style={{ flex: 1 }}>
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    borderRight:
                      i < arr.length - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      color: "#F0F0F0",
                      fontSize: "clamp(1.8rem,5vw,2.6rem)",
                      fontWeight: "700",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                      margin: "0 0 6px 0",
                    }}
                  >
                    {s.v}
                  </p>
                  <p
                    style={{
                      color: "#3A3A42",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      margin: 0,
                      fontWeight: 600,
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

      {/* ══════════ WHY ══════════ */}
      <section className="sec-pad" style={secA}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow">Why {siteName}</p>
              <h2 className="sec-title">{whyTitle}</h2>
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: "1px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            {benefits.map((b, i) => (
              <FadeIn key={i} delay={i * 0.07}>
                <div
                  className="card-hover"
                  style={{
                    background: "#0C0C0E",
                    padding: "32px 28px",
                    height: "100%",
                    borderRight: "none",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "3px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.15)",
                      marginBottom: "18px",
                    }}
                  >
                    <b.icon size={16} style={{ color: "#DC2626" }} />
                  </div>
                  <h3
                    style={{
                      color: "#F0F0F0",
                      fontSize: "14px",
                      fontWeight: "600",
                      margin: "0 0 8px 0",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {b.title}
                  </h3>
                  <p
                    style={{
                      color: "#52525A",
                      fontSize: "13px",
                      lineHeight: "1.7",
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
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow">Simple Process</p>
              <h2 className="sec-title">{howTitle}</h2>
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: "16px",
            }}
          >
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.09}>
                <div
                  className="card-hover"
                  style={{
                    ...glassCard,
                    padding: "28px",
                    position: "relative",
                    overflow: "hidden",
                    height: "100%",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "16px",
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "3.5rem",
                      lineHeight: 1,
                      color: "rgba(196,162,101,0.07)",
                      userSelect: "none",
                      pointerEvents: "none",
                      fontWeight: "800",
                    }}
                  >
                    {s.n}
                  </span>
                  <p
                    style={{
                      color: "#C4A265",
                      fontSize: "11px",
                      fontWeight: "700",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      margin: "0 0 14px 0",
                    }}
                  >
                    {s.n}
                  </p>
                  <h3
                    style={{
                      color: "#F0F0F0",
                      fontSize: "14px",
                      fontWeight: "600",
                      margin: "0 0 8px 0",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.t}
                  </h3>
                  <p
                    style={{
                      color: "#52525A",
                      fontSize: "13px",
                      lineHeight: "1.7",
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
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow green">Real Buyers</p>
              <h2 className="sec-title">{t("home.testimonials.title")}</h2>
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
              gap: "16px",
            }}
          >
            {testimonials.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div
                  style={{
                    ...glassCard,
                    padding: "28px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "2px",
                      marginBottom: "16px",
                    }}
                  >
                    {[...Array(item.r)].map((_, j) => (
                      <Star
                        key={j}
                        size={11}
                        style={{ fill: "#C4A265", color: "#C4A265" }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      color: "#9090A0",
                      fontSize: "13px",
                      lineHeight: "1.8",
                      marginBottom: "20px",
                      fontStyle: "italic",
                      flex: 1,
                    }}
                  >
                    "{item.text}"
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      paddingTop: "16px",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "rgba(196,162,101,0.08)",
                        border: "1px solid rgba(196,162,101,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          color: "#C4A265",
                          fontWeight: "700",
                          fontSize: "13px",
                        }}
                      >
                        {item.name[0]}
                      </span>
                    </div>
                    <div>
                      <p
                        style={{
                          color: "#F0F0F0",
                          fontWeight: "600",
                          fontSize: "13px",
                          margin: "0 0 2px 0",
                        }}
                      >
                        {item.name}
                      </p>
                      <p
                        style={{
                          color: "#3A3A42",
                          fontSize: "11px",
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <MapPin size={9} /> {item.loc}
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
                borderRadius: "6px",
                overflow: "hidden",
                position: "relative",
                background: "#111113",
                border: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  padding: "40px",
                  flex: "1",
                  minWidth: "240px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "3px",
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "20px",
                  }}
                >
                  <Calculator size={18} style={{ color: "#DC2626" }} />
                </div>
                <h2
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    color: "#F0F0F0",
                    fontSize: "clamp(1.2rem,4vw,1.8rem)",
                    fontWeight: "700",
                    letterSpacing: "-0.025em",
                    margin: "0 0 10px 0",
                    lineHeight: 1.15,
                  }}
                >
                  {t("home.budget.title")}
                </h2>
                <p
                  style={{
                    color: "#52525A",
                    fontSize: "13px",
                    lineHeight: "1.7",
                    margin: "0 0 24px 0",
                  }}
                >
                  {t("home.budget.subtitle")}
                </p>
                <Link
                  to="/calculator"
                  className="primary-btn"
                  style={primaryBtn}
                >
                  <Calculator size={14} />
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
                    opacity: 0.15,
                    minHeight: "180px",
                  }}
                  loading="lazy"
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to right,#111113 0%,transparent 55%)",
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
                padding: "40px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "28px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(ellipse at 85% 50%,rgba(196,162,101,0.03) 0%,transparent 60%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: "220px",
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
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "#DC2626",
                      display: "inline-block",
                      animation: "pulse-red 2.5s infinite",
                    }}
                  />
                  <span
                    style={{
                      color: "#DC2626",
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
                    fontFamily: "'Outfit', sans-serif",
                    color: "#F0F0F0",
                    fontSize: "clamp(1.2rem,4vw,1.8rem)",
                    fontWeight: "700",
                    letterSpacing: "-0.025em",
                    margin: "0 0 10px 0",
                    lineHeight: 1.15,
                  }}
                >
                  Run your dealership smarter with{" "}
                  <span style={{ color: "#DC2626" }}>ShiftOS.</span>
                </h2>
                <p
                  style={{
                    color: "#52525A",
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
                <Link to="/shiftos" className="primary-btn" style={primaryBtn}>
                  Learn About ShiftOS <ArrowRight size={14} />
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
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle,rgba(196,162,101,0.025) 0%,transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            ...wrap,
            maxWidth: "580px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <FadeIn>
            <p
              className="sec-eyebrow"
              style={{ justifyContent: "center", marginBottom: "16px" }}
            >
              Ready to Drive?
            </p>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: "#F0F0F0",
                fontSize: "clamp(2rem,7vw,3.6rem)",
                fontWeight: "800",
                letterSpacing: "-0.035em",
                lineHeight: 1.05,
                margin: "0 0 16px 0",
              }}
            >
              {ctaTitle}
            </h2>
            <p
              style={{
                color: "#52525A",
                fontSize: "clamp(13px,3.5vw,15px)",
                lineHeight: "1.8",
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
              <Link to="/cars" className="primary-btn" style={primaryBtn}>
                {ctaPrimaryLabel} <ArrowRight size={14} />
              </Link>
              <a
                href={
                  buildWaUrl(
                    ctaCtx.type !== "loading"
                      ? ctaCtx
                      : { type: "listing", profile: null, ref: null },
                    tenant?.whatsapp_number || superadminPhone,
                    ctaCtx.type === "salesman"
                      ? `Hi, I need help finding a car — via ${ctaCtx.ref}`
                      : `Hi ${siteName}, I need help finding a car`,
                  ) || "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="wa-btn-hp"
                style={waBtn}
                onClick={() => {
                  supabase
                    .from("whatsapp_enquiries")
                    .insert({
                      dealer_id: tenant?.id || null,
                      listing_id: null,
                      buyer_name: null,
                      buyer_phone: null,
                      buyer_message: `General enquiry from homepage CTA`,
                      source: "homepage_cta",
                      status: "new",
                    })
                    .then(() => {});
                }}
              >
                <MessageCircle size={14} />
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
