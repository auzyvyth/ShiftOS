import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Helmet } from "react-helmet";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
  Phone,
  Mail,
  Clock,
  Facebook,
  Instagram,
  Music2,
  Award,
  Car,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import GoogleOneTapSlot from "@/components/GoogleOneTapSlot";
import SciFiLoader from "../components/SciFiLoader";
import Footer from "@/components/Footer";
import StickyWhatsAppButton from "@/components/StickyWhatsAppButton";
import CarCard from "@/components/CarCard";
import HeroCarousel from "@/components/HeroCarousel";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import { supabase } from "../supabaseClient";
import { readCache, writeCache } from "../utils/localCache";
import { useSiteProfile } from "../hooks/useSiteProfile";
import ReviewsSection from "../components/reviews/ReviewsSection";
import useTenant, { isSubdomain, getSubdomain } from "../hooks/useTenant";

// Lazy — only the root domain (no dealer subdomain) ever needs this. Loaded
// here instead of navigated to, so the public marketplace lives at "/"
// (never "/marketplace" — that path used to leak the unscoped, multi-dealer
// marketplace on dealer subdomains too, since it had no tenant awareness).
const MarketplacePage = lazy(() => import("./MarketplacePage"));

// Dark-surface theme tokens for ReviewsSection on the dealer storefront.
const DARK_REVIEW_TH = {
  text: "#e8edf5", textSec: "rgba(255,255,255,0.62)", textMuted: "rgba(255,255,255,0.42)",
  border: "rgba(255,255,255,0.08)", borderSec: "rgba(255,255,255,0.05)",
  card: "rgba(255,255,255,0.03)", inputBg: "rgba(255,255,255,0.05)",
};
import { useCTAContext, buildWaUrl } from "../hooks/useCTAContext";
import { captureRef, getRef } from "../utils/refTracking";
import {
  getOrCreateSessionId,
  getSlugFromURL,
  trackEvent,
} from "../utils/analytics";
import { useMarketplaceTracking } from "../hooks/useMarketplaceTracking";
import { getEmbedUrl } from "../utils/videoEmbed";
import CustomSelect from "../components/ui/CustomSelect";

const CAR_FIELDS =
  "id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,images,status,created_at,market_avg_price,payment_type,sambung_monthly,sambung_deposit,sambung_months_left";

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
function FadeIn({ children, delay = 0, from = "up", className, style = {} }) {
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
  const hidden =
    from === "left"
      ? "translateX(-40px)"
      : from === "right"
        ? "translateX(40px)"
        : "translateY(20px)";
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? "translate(0,0)" : hidden,
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── CountUp — animates 0→end when scrolled into view ───────────────────────────
function CountUp({ end = 0, duration = 1500, style }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(end * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);
  return (
    <span ref={ref} style={style}>
      {val.toLocaleString()}
    </span>
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
  useMarketplaceTracking(!isSubdomain());
  const { t } = useTranslation();
  const { siteName, waUrl, profile } = useSiteProfile();
  const { tenant, loading: tenantLoading } = useTenant();
  const ctaCtx = useCTAContext();

  // PERF-2: resolve dealer_id from URL subdomain immediately — no auth wait.
  // Unblocks the listings + sold-count fetch before useTenant finishes its
  // auth-session setup + full profile RPC.
  const [fastDealerId, setFastDealerId] = useState(undefined);
  useEffect(() => {
    const sub = getSubdomain();
    if (!sub) { setFastDealerId(null); return; }
    supabase.rpc("get_dealer_id_by_subdomain", { p_subdomain: sub })
      .then(({ data }) => setFastDealerId(data || null));
  }, []);
  // Stale-while-revalidate for the storefront's own car grids — keyed by
  // subdomain (known synchronously, before fastDealerId's RPC resolves) so a
  // repeat visit paints instantly. The fetch below always still runs and
  // overwrites both state and cache the moment it lands.
  const HP_CACHE_TTL = 30 * 60 * 1000; // 30 min
  const hpGridCacheKey = (sub) => `hp_grid_v1_${sub}`;
  const initialHpSub = getSubdomain();
  const initialHpCache = initialHpSub ? readCache(hpGridCacheKey(initialHpSub), HP_CACHE_TTL) : null;

  const [featured, setFeatured] = useState(() => initialHpCache?.featured || []);
  const [hotDeals, setHotDeals] = useState(() => initialHpCache?.hotDeals || []);
  const [loading, setLoading] = useState(() => !initialHpCache);
  const [stock, setStock] = useState(() => initialHpCache?.stock || 0);
  const [soldCount, setSoldCount] = useState(() => initialHpCache?.soldCount ?? null);
  const [brand, setBrand] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [heroQ, setHeroQ] = useState("");
  const navigate = useNavigate();
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
    // PERF-2: gate on fastDealerId (resolves immediately from URL) not tenant
    if (fastDealerId === undefined) return;
    const dealerId = fastDealerId; // stable for this run
    const load = async () => {
      // PERF-3/4: on subdomain where tenant is available, skip the per-row
      // dealer join (all rows are the same dealer — already in tenant).
      // On main marketplace (no dealerId), keep the join for mixed-dealer cards.
      const useJoin = !dealerId || !tenant;
      let query = supabase
        .from("public_car_listings")
        .select(
          useJoin
            ? `${CAR_FIELDS}, dealer:profiles!dealer_id(dealership, site_name, subdomain, whatsapp_number, site_logo_url, brand_color)`
            : CAR_FIELDS,
          { count: "exact" },
        )
        .in("status", ["available", "reserved"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (dealerId) query = query.eq("dealer_id", dealerId);

      const { data, error, count } = await query;
      let result = null;
      if (!error && data) {
        // Attach tenant as dealer object when join was skipped
        const rows = (dealerId && tenant)
          ? data.map((c) => ({ ...c, dealer: tenant }))
          : data;
        const featuredRows = rows.slice(0, 6);
        const stockCount = count || data.length;
        const hotDealsRows = rows
          .filter(isHotDeal)
          .sort(
            (a, b) =>
              (b.original_price - b.selling_price) / b.original_price -
              (a.original_price - a.selling_price) / a.original_price,
          )
          .slice(0, 6);
        setFeatured(featuredRows);
        setStock(stockCount);
        setHotDeals(hotDealsRows);
        result = { featured: featuredRows, stock: stockCount, hotDeals: hotDealsRows };
        // The precacheImages() call that used to sit here wrote into an
        // 'hp-images-v1' Cache Storage bucket that nothing ever read back. Car
        // photos are cached by the service worker's runtime route now
        // (vite.config.js), which serves what the storefront actually renders.
      }
      setLoading(false);
      return result;
    };
    // PERF-5: sold count runs in parallel — no 800ms artificial delay
    const fetchSoldCount = async () => {
      let q = supabase
        .from("public_car_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "sold");
      if (dealerId) q = q.eq("dealer_id", dealerId);
      const { count } = await q;
      const soldCountVal = count || 0;
      setSoldCount(soldCountVal);
      return soldCountVal;
    };
    Promise.all([load(), fetchSoldCount()]).then(([loadResult, soldCountVal]) => {
      // Only the dealer-subdomain storefront caches its grid — the main
      // marketplace domain redirects away before this ever renders.
      const sub = getSubdomain();
      if (dealerId && sub && loadResult) {
        writeCache(hpGridCacheKey(sub), { ...loadResult, soldCount: soldCountVal });
      }
    });
  }, [fastDealerId, tenant]);

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

  // On a dealer subdomain, /showroom redirects back to "/" (it is the
  // marketplace-wide search). The tenant-scoped car search is /cars, so all
  // storefront "browse" links must target /cars when on a subdomain.
  const carsBase = isSubdomain() ? "/cars" : "/showroom";

  const searchUrl = () => {
    const p = new URLSearchParams();
    if (brand) p.set("brand", brand);
    if (bodyType) p.set("body_type", bodyType);
    if (maxPrice) p.set("max_price", maxPrice);
    const q = p.toString();
    return q ? `${carsBase}?${q}` : carsBase;
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
  // On a dealer storefront, never fabricate reviews — show real ones or nothing.
  // The main XDrive marketplace keeps its default set.
  const testimonialsData =
    tenant?.storefront_testimonials || (isSubdomain() ? [] : HARDCODED_DEFAULT_TESTIMONIALS);
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
  const testimonials = (Array.isArray(testimonialsData) ? testimonialsData : []).map((item) => ({
    name: item.name,
    loc: item.location,
    text: item.text,
    r: 5,
  }));
  const ctaTitle = ctaData.title;
  const ctaSubtitle = ctaData.subtitle;
  const ctaPrimaryLabel = ctaData.primary_label;
  const ctaSecondaryLabel = ctaData.secondary_label;

  // Main domain (xdrive.my) with no subdomain → show public marketplace,
  // rendered directly here so the URL stays "/" (not a separate "/marketplace"
  // path — see the lazy import above for why).
  if (!isSubdomain() && tenant === null) {
    return (
      <Suspense fallback={null}>
        <MarketplacePage />
      </Suspense>
    );
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

  if (tenant === undefined) return <SciFiLoader />;

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

        /* How it works — alternating rows, icon on the outer edge, no center line */
        .how-list { display:flex; flex-direction:column; gap:18px; overflow-x:clip; }
        .how-step { display:flex; }
        .how-step:nth-child(odd)  { justify-content:flex-start; }
        .how-step:nth-child(even) { justify-content:flex-end; }
        .how-card {
          display:flex; align-items:center; gap:20px; width:min(560px,100%);
          background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08);
          border-radius:16px; padding:20px 24px;
          transition:border-color .2s ease, background .2s ease;
        }
        .how-card:hover { border-color:rgba(196,162,101,0.40); background:rgba(255,255,255,0.045); }
        .how-step:nth-child(even) .how-card { flex-direction:row-reverse; text-align:right; }
        .how-ico {
          flex-shrink:0; width:54px; height:54px; border-radius:14px; display:grid; place-items:center;
          color:#C4A265; background:rgba(196,162,101,0.12); border:1px solid rgba(196,162,101,0.35);
          box-shadow:0 0 22px rgba(196,162,101,0.12);
        }
        .how-k { font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:#C4A265; margin:0 0 6px; }
        .how-t { font-size:18px; font-weight:600; letter-spacing:-.01em; color:#F0F0F0; margin:0 0 5px; }
        .how-d { font-size:15px; line-height:1.6; color:rgba(255,255,255,0.62); margin:0; }
        @media(max-width:720px){
          .how-step, .how-step:nth-child(odd), .how-step:nth-child(even) { justify-content:stretch; }
          .how-card, .how-step:nth-child(even) .how-card {
            width:100%; flex-direction:row; text-align:left; gap:16px; padding:18px;
          }
        }

        /* Why — readable 2-up cards */
        .why-grid2 { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        .why-card {
          height:100%; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08);
          border-radius:16px; padding:26px 26px 24px;
          transition:transform .2s ease, border-color .2s ease;
        }
        .why-card:hover { transform:translateY(-3px); border-color:rgba(220,38,38,0.35); }
        .why-ico {
          width:44px; height:44px; border-radius:11px; display:grid; place-items:center;
          color:#DC2626; background:rgba(220,38,38,0.10); border:1px solid rgba(220,38,38,0.28); margin-bottom:16px;
        }
        .why-t { font-size:17px; font-weight:600; color:#F0F0F0; margin:0 0 7px; }
        .why-d { font-size:15px; line-height:1.6; color:rgba(255,255,255,0.62); margin:0; }
        @media(max-width:640px){ .why-grid2 { grid-template-columns:1fr; } }

        /* Car grid */
        .car-grid-hp { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
        @media(max-width:640px) {
          .car-grid-hp { grid-template-columns:repeat(2,1fr) !important; gap:10px !important; }
          .stats-band-grid { grid-template-columns:repeat(2,1fr) !important; }
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

        /* Dealer trust + quick-contact strip */
        .dealer-strip { display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap; margin-top:-15px; }
        .dealer-strip-stats { display:flex; align-items:center; gap:0; flex-wrap:wrap; }
        .dealer-strip-nums { display:flex; align-items:center; }
        .dealer-strip-stat { padding:0 22px; border-right:1px solid rgba(255,255,255,0.08); }
        .dealer-strip-stat:first-child { padding-left:0; }
        .dealer-strip-stat:last-child { border-right:none; }
        .dealer-strip-loc { display:flex; align-items:center; gap:7px; padding-left:22px; border-left:1px solid rgba(255,255,255,0.08); }
        .dealer-strip-actions { display:flex; gap:10px; flex-wrap:wrap; }

        /* Inventory toolbar (search inside Our Cars) */
        .inv-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:22px; }
        .inv-toolbar .inv-search { flex:1; min-width:240px; }

        /* Contact section grid */
        .contact-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-top:36px; }
        .contact-socials { display:flex; gap:10px; justify-content:center; margin-top:28px; }

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
          .dealer-strip       { flex-direction: column !important; align-items: stretch !important; gap: 18px !important; margin-top: 0 !important; }
          .dealer-strip-stats { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; width: 100% !important; }
          .dealer-strip-loc   { order: -1 !important; padding-left: 0 !important; border-left: none !important; }
          .dealer-strip-nums  { width: 100% !important; }
          .dealer-strip-nums .dealer-strip-stat { flex: 1 !important; padding: 0 12px !important; }
          .dealer-strip-nums .dealer-strip-stat:first-child { padding-left: 0 !important; }
          .dealer-strip-actions a { flex: 1 !important; justify-content: center !important; }
          .inv-toolbar .inv-search { min-width: 0 !important; width: 100% !important; }
        }
      `}</style>

      <Helmet>
        <link
          rel="preconnect"
          href="https://lemdkdizdlcirhbzqlos.supabase.co"
        />
        <title>
          {profile
            ? `${profile.site_name || profile.dealership} — Used Cars in Malaysia`
            : "XDrive — Verified Used & Recon Cars in Malaysia"}
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
              : "Buy verified used, recon and new cars in Malaysia with transparent pricing and full vehicle history. Trusted local dealers and easy financing on XDrive."
          }
        />
        <meta
          property="og:title"
          content={
            profile
              ? `${profile.site_name || profile.dealership} — Used Cars`
              : "XDrive — Verified Used & Recon Cars in Malaysia"
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
              "@id": "https://xdrive.my/#organization",
              name: "XDrive",
              alternateName: "XDrive Malaysia",
              url: "https://xdrive.my",
              logo: "https://xdrive.my/xdrivelogo.png",
              description:
                "XDrive is a Malaysian marketplace for verified used, recon and new cars with transparent pricing and full vehicle history, and the maker of ShiftOS, a used-car dealer management system (DMS).",
              areaServed: "MY",
              sameAs: [
                "https://facebook.com/xdrive.my",
                "https://instagram.com/xdrive.my",
                "https://tiktok.com/@xdrive.my",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Service",
                availableLanguage: ["en", "ms"],
              },
            })}
          </script>
        )}
        {!profile && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://xdrive.my/#website",
              name: "XDrive",
              alternateName: "XDrive Malaysia",
              url: "https://xdrive.my",
              publisher: { "@id": "https://xdrive.my/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://xdrive.my/showroom?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            })}
          </script>
        )}
      </Helmet>

      <Header />
      <GoogleOneTapSlot />

      {/* ══════════ HERO (carousel) — compact so the search below stays above the fold ══════════ */}
      <HeroCarousel compact siteName={siteName} />

      {/* ══════════ DEALER TRUST + QUICK CONTACT STRIP ══════════ */}
      <section style={{ background: "#0C0C0E", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ ...wrap, padding: "18px 20px" }}>
          <div className="dealer-strip">
            <div className="dealer-strip-stats">
              <div className="dealer-strip-nums">
                {tenant?.stat_years > 0 && (
                  <div className="dealer-strip-stat">
                    <p style={{ color: "#F0F0F0", fontSize: 20, fontWeight: 700, lineHeight: 1, margin: "0 0 4px" }}>
                      {tenant.stat_years}+
                    </p>
                    <p style={{ color: "#52525A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, fontWeight: 600 }}>
                      Years in Business
                    </p>
                  </div>
                )}
                <div className="dealer-strip-stat">
                  <p style={{ color: "#F0F0F0", fontSize: 20, fontWeight: 700, lineHeight: 1, margin: "0 0 4px" }}>
                    {stock != null ? String(stock) : "—"}
                  </p>
                  <p style={{ color: "#52525A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, fontWeight: 600 }}>
                    Cars in Stock
                  </p>
                </div>
                <div className="dealer-strip-stat">
                  <p style={{ color: "#F0F0F0", fontSize: 20, fontWeight: 700, lineHeight: 1, margin: "0 0 4px" }}>
                    {soldDisplay}
                  </p>
                  <p style={{ color: "#52525A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, fontWeight: 600 }}>
                    Cars Sold
                  </p>
                </div>
              </div>
              {(tenant?.city || tenant?.state) && (
                <div className="dealer-strip-loc">
                  <MapPin size={14} style={{ color: "#C4A265", flexShrink: 0 }} />
                  <span style={{ color: "#C0C0C6", fontSize: 13, fontWeight: 600 }}>
                    {[tenant?.city, tenant?.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
            <div className="dealer-strip-actions">
              <Link to={carsBase} className="primary-btn" style={{ ...primaryBtn, padding: "11px 22px" }}>
                Browse Our Cars <ArrowRight size={14} />
              </Link>
              <a
                href={
                  buildWaUrl(
                    ctaCtx.type !== "loading"
                      ? ctaCtx
                      : { type: "listing", profile: null, ref: null },
                    tenant?.whatsapp_number,
                    `Hi ${siteName}, I'd like to enquire about a car`,
                  ) || "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="wa-btn-hp"
                style={{ ...waBtn, padding: "11px 22px" }}
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>

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
                    fontFamily: "system-ui,sans-serif",
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

      {/* ══════════ ABOUT (storefront only — dealer's editable about_text) ══════════ */}
      {isSubdomain() && tenant?.about_text && (
        <section className="sec-pad" style={secB}>
          <div style={wrap}>
            <FadeIn>
              <div style={{ marginBottom: "24px", textAlign: "center" }}>
                <p className="sec-eyebrow">About {siteName}</p>
                <h2 className="sec-title">Get to know us</h2>
              </div>
              <p
                style={{
                  color: "#9CA3AF",
                  fontSize: "15px",
                  lineHeight: "1.9",
                  maxWidth: "760px",
                  margin: "0 auto",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                }}
              >
                {tenant.about_text}
              </p>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ══════════ REVIEWS (storefront — real buyer reviews, seller-scoped) ══════════ */}
      {isSubdomain() && tenant?.id && (
        <section className="sec-pad" style={secB}>
          <div style={{ ...wrap, maxWidth: 760 }}>
            <ReviewsSection
              dealerId={tenant.id}
              sellerName={siteName}
              isXdrive={false}
              th={DARK_REVIEW_TH}
            />
          </div>
        </section>
      )}

      {/* ══════════ WHY ══════════ */}
      <section className="sec-pad" style={secA}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow">Why {siteName}</p>
              <h2 className="sec-title">{whyTitle}</h2>
            </div>
          </FadeIn>
          <div className="why-grid2">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <FadeIn key={i} delay={i * 0.06}>
                  <div className="why-card card-hover">
                    <div className="why-ico">
                      {Icon && <Icon size={20} strokeWidth={2} />}
                    </div>
                    <h3 className="why-t">{b.title}</h3>
                    <p className="why-d">{b.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ STATS BAND (animated count-up — dealer credibility) ══════════ */}
      {(() => {
        const statItems = [
          tenant?.stat_years > 0 && { icon: Award, value: tenant.stat_years, label: "Years in Business" },
          soldCount > 0 && { icon: CheckCircle, value: soldCount, label: "Cars Sold" },
          tenant?.stat_happy_customers > 0 && { icon: UserCheck, value: tenant.stat_happy_customers, label: "Happy Customers" },
          stock > 0 && { icon: Car, value: stock, label: "Cars in Stock" },
        ].filter(Boolean);
        if (statItems.length === 0) return null;
        return (
          <section style={{ ...secLight, position: "relative", overflow: "hidden" }} className="sec-pad">
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: "700px",
                height: "500px",
                background:
                  "radial-gradient(ellipse,rgba(220,38,38,0.05) 0%,transparent 65%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ ...wrap, position: "relative", zIndex: 1 }}>
              <FadeIn>
                <p
                  className="sec-eyebrow"
                  style={{ justifyContent: "center", marginBottom: "40px" }}
                >
                  By the Numbers
                </p>
              </FadeIn>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${statItems.length}, 1fr)`,
                  gap: "1px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
                className="stats-band-grid"
              >
                {statItems.map((s, i) => (
                  <FadeIn key={i} delay={i * 0.08}>
                    <div
                      style={{
                        background: "#0C0C0E",
                        padding: "36px 20px",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: "14px",
                      }}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(220,38,38,0.08)",
                          border: "1px solid rgba(220,38,38,0.2)",
                        }}
                      >
                        <s.icon size={19} style={{ color: "#DC2626" }} />
                      </div>
                      <CountUp
                        end={s.value}
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          color: "#F0F0F0",
                          fontSize: "clamp(1.9rem,5vw,3rem)",
                          fontWeight: 800,
                          letterSpacing: "-0.03em",
                          lineHeight: 1,
                        }}
                      />
                      <span
                        style={{
                          width: "24px",
                          height: "2px",
                          background: "#DC2626",
                          borderRadius: "2px",
                        }}
                      />
                      <p
                        style={{
                          color: "#8A8A94",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.14em",
                          margin: 0,
                          fontWeight: 600,
                        }}
                      >
                        {s.label}
                      </p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ══════════ HOT DEALS (dealer's own offers) ══════════ */}
      {(hotDeals.length > 0 || loading) && (
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
                  <p className="sec-eyebrow red">
                    <Flame size={10} style={{ marginRight: -4 }} /> Limited Time
                  </p>
                  <h2 className="sec-title">Hot Deals</h2>
                </div>
                <Link to={`${carsBase}?hot_deals=true`} className="view-all-link">
                  View All <ArrowRight size={12} />
                </Link>
              </div>
            </FadeIn>
            <div className="car-grid-hp">
              {loading
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : hotDeals.map((c, i) => (
                    <CarCard key={c.id} car={c} ctaContext={ctaCtx} priority={i === 0} />
                  ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ OUR CARS (inventory + search — dealer-scoped) ══════════ */}
      {(() => {
        const chip = (active) => ({
          flexShrink: 0, padding: "7px 15px", borderRadius: 50, textDecoration: "none",
          fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
          whiteSpace: "nowrap", transition: "all 0.15s",
          border: `1px solid ${active ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.14)"}`,
          background: active ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
          color: active ? "#f87171" : "rgba(255,255,255,0.78)",
        });
        return (
          <section className="sec-pad" style={secA}>
            <div style={wrap}>
              <FadeIn>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginBottom: "28px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <p className="sec-eyebrow">Our Inventory</p>
                    <h2 className="sec-title">Browse Our Cars</h2>
                  </div>
                  <Link to={carsBase} className="view-all-link">
                    All Cars <ArrowRight size={12} />
                  </Link>
                </div>
              </FadeIn>
              <div className="inv-toolbar">
                <div className="inv-search">
                  <SearchAutocomplete
                    dark
                    value={heroQ}
                    onChange={setHeroQ}
                    placeholder="Search our cars by make, model or variant…"
                    onSubmit={(val) => {
                      const s = (val || "").trim();
                      navigate(s ? `${carsBase}?q=${encodeURIComponent(s)}` : carsBase);
                    }}
                    inputStyle={{ padding: "13px 16px", fontSize: "15px" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "28px" }}>
                <Link to={carsBase} style={chip(true)}>All cars</Link>
                {BODY_TYPES.map((bt) => (
                  <Link key={bt} to={`${carsBase}?body_type=${encodeURIComponent(bt)}`} style={chip(false)}>{bt}</Link>
                ))}
              </div>
              <div className="car-grid-hp" style={{ marginBottom: "36px" }}>
                {loading
                  ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                  : featured.map((c, i) => (
                      <CarCard key={c.id} car={c} ctaContext={ctaCtx} priority={i === 0} />
                    ))}
              </div>
              <div style={{ textAlign: "center" }}>
                <Link
                  to={carsBase}
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
        );
      })()}

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="sec-pad" style={secB}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow">Simple Process</p>
              <h2 className="sec-title">{howTitle}</h2>
            </div>
          </FadeIn>
          <div className="how-list">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const right = i % 2 === 1;
              return (
                <FadeIn
                  key={i}
                  className="how-step"
                  from={right ? "right" : "left"}
                  delay={i * 0.05}
                >
                  <div className="how-card">
                    <div className="how-ico">
                      {Icon && <Icon size={24} strokeWidth={2} />}
                    </div>
                    <div>
                      <p className="how-k">Step {s.n}</p>
                      <h3 className="how-t">{s.t}</h3>
                      <p className="how-d">{s.d}</p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS — hidden when there are none (no fake fallback on storefronts) ══════════ */}
      {testimonials.length > 0 && (
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
      )}

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

      {/* ══════════ FOR DEALERS (marketplace only — never on a dealer's own storefront) ══════════ */}
      {!isSubdomain() && (
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
      )}

      {/* ══════════ CONTACT / VISIT US ══════════ */}
      {(() => {
        const waHref =
          buildWaUrl(
            ctaCtx.type !== "loading"
              ? ctaCtx
              : { type: "listing", profile: null, ref: null },
            tenant?.whatsapp_number,
            ctaCtx.type === "salesman"
              ? `Hi, I need help finding a car — via ${ctaCtx.ref}`
              : `Hi ${siteName}, I need help finding a car`,
          ) || "#";
        const logEnquiry = () => {
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
        };
        const contactItems = [
          tenant?.phone && {
            icon: Phone,
            label: "Call us",
            value: tenant.phone,
            href: `tel:${String(tenant.phone).replace(/[^\d+]/g, "")}`,
          },
          tenant?.email && {
            icon: Mail,
            label: "Email us",
            value: tenant.email,
            href: `mailto:${tenant.email}`,
          },
          (() => {
            const addr = [tenant?.location, tenant?.city, tenant?.state]
              .filter(Boolean)
              .join(", ");
            return (
              addr && {
                icon: MapPin,
                label: "Visit us",
                value: addr,
                href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
                external: true,
              }
            );
          })(),
          tenant?.business_hours && {
            icon: Clock,
            label: "Opening hours",
            value: tenant.business_hours,
            href: null,
          },
        ].filter(Boolean);
        const socials = [
          tenant?.social_facebook && { icon: Facebook, href: tenant.social_facebook },
          tenant?.social_instagram && { icon: Instagram, href: tenant.social_instagram },
          tenant?.social_tiktok && { icon: Music2, href: tenant.social_tiktok },
        ].filter(Boolean);
        const cardStyle = {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "24px 18px",
          background: "#111113",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "8px",
          textDecoration: "none",
        };
        return (
          <section
            id="contact"
            className="sec-pad"
            style={{ ...secA, position: "relative", overflow: "hidden" }}
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
                maxWidth: "760px",
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
                  Get in Touch
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
                    margin: "0 auto 36px",
                    maxWidth: "520px",
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
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-btn"
                    style={{
                      ...primaryBtn,
                      background: "#25D366",
                      borderColor: "#25D366",
                    }}
                    onClick={logEnquiry}
                  >
                    <MessageCircle size={14} />
                    {ctaSecondaryLabel}
                  </a>
                  <Link
                    to={carsBase}
                    className="ghost-outline"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#C0C0C6",
                      fontWeight: "600",
                      fontSize: "14px",
                      padding: "13px 28px",
                      borderRadius: "4px",
                      textDecoration: "none",
                      transition: "all 0.2s ease",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {ctaPrimaryLabel} <ArrowRight size={14} />
                  </Link>
                </div>

                {contactItems.length > 0 && (
                  <div className="contact-grid">
                    {contactItems.map((c, i) => {
                      const Inner = (
                        <>
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "3px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(196,162,101,0.08)",
                              border: "1px solid rgba(196,162,101,0.18)",
                            }}
                          >
                            <c.icon size={16} style={{ color: "#C4A265" }} />
                          </div>
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
                            {c.label}
                          </p>
                          <p
                            style={{
                              color: "#F0F0F0",
                              fontSize: "13px",
                              fontWeight: 600,
                              margin: 0,
                              wordBreak: "break-word",
                              whiteSpace: "pre-line",
                            }}
                          >
                            {c.value}
                          </p>
                        </>
                      );
                      return c.href ? (
                        <a
                          key={i}
                          href={c.href}
                          target={c.external ? "_blank" : undefined}
                          rel={c.external ? "noopener noreferrer" : undefined}
                          className="card-hover"
                          style={cardStyle}
                        >
                          {Inner}
                        </a>
                      ) : (
                        <div key={i} style={cardStyle}>
                          {Inner}
                        </div>
                      );
                    })}
                  </div>
                )}

                {socials.length > 0 && (
                  <div className="contact-socials">
                    {socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-hover"
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#111113",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                        aria-label="Social link"
                      >
                        <s.icon size={16} style={{ color: "#C0C0C6" }} />
                      </a>
                    ))}
                  </div>
                )}
              </FadeIn>
            </div>
          </section>
        );
      })()}

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default HomePage;
