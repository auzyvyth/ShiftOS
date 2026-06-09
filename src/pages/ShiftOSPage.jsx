import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Wallet, Users, Bot, Globe, MessageCircle, ArrowRight, Check,
  ClipboardCheck, Landmark, BellRing, LineChart, ShieldCheck,
  Receipt, UserCheck, Calculator, Briefcase, ChevronRight, Car,
} from "lucide-react";
import { PLAN_CONFIG } from "../utils/planConfig";

// ─── Styles ─────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

  .sos *{box-sizing:border-box;margin:0;padding:0;}
  .sos{
    font-family:'DM Sans',sans-serif;
    background:#06080F;
    min-height:100vh;
    color:#fff;
    overflow-x:hidden;
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
  }

  /* ── Background ── */
  .sos-bg{
    position:fixed;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(ellipse 1100px 700px at 10% -10%, rgba(220,38,38,0.18) 0%, transparent 65%),
      radial-gradient(ellipse 900px 600px at 90% 5%,  rgba(37,99,235,0.11)  0%, transparent 60%),
      radial-gradient(ellipse 600px 400px at 50% 90%, rgba(220,38,38,0.06)  0%, transparent 55%),
      #06080F;
  }
  .sos-grid{
    position:fixed;inset:-1px;z-index:0;pointer-events:none;
    background-image:
      linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
    background-size:52px 52px;
    -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 100%);
    mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 100%);
    animation:sos-grid-drift 32s linear infinite;
  }
  @keyframes sos-grid-drift{from{background-position:0 0;}to{background-position:52px 52px;}}
  @media(prefers-reduced-motion:reduce){.sos-grid{animation:none;}}

  .sos-content{position:relative;z-index:1;}
  .sos-wrap{max-width:1160px;margin:0 auto;padding:0 24px;}

  /* ── Nav ── */
  .sos-nav{
    position:sticky;top:0;z-index:100;
    background:rgba(6,8,15,0.75);
    backdrop-filter:blur(24px) saturate(1.6);
    -webkit-backdrop-filter:blur(24px) saturate(1.6);
    border-bottom:1px solid rgba(255,255,255,0.07);
  }

  /* ── Typography ── */
  .sos-h{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em;line-height:1.02;}
  .sos-red{
    background:linear-gradient(135deg,#fb7185,#dc2626 60%);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .sos-gold{
    background:linear-gradient(135deg,#fbbf24,#d97706);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }

  /* ── Buttons ── */
  .sos-btn-primary{
    background:linear-gradient(135deg,#e02020,#b91c1c);
    color:#fff;border:none;border-radius:11px;
    padding:13px 26px;font-family:inherit;font-weight:700;font-size:14px;
    cursor:pointer;display:inline-flex;align-items:center;gap:9px;text-decoration:none;
    box-shadow:0 4px 24px rgba(220,38,38,0.38),inset 0 1px 0 rgba(255,255,255,0.14);
    transition:transform .15s,box-shadow .15s;letter-spacing:.01em;
  }
  .sos-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(220,38,38,0.52),inset 0 1px 0 rgba(255,255,255,0.14);}
  .sos-btn-outline{
    background:rgba(255,255,255,0.04);color:#e2e8f0;
    border:1px solid rgba(255,255,255,0.16);border-radius:11px;
    padding:13px 26px;font-family:inherit;font-weight:600;font-size:14px;
    cursor:pointer;display:inline-flex;align-items:center;gap:9px;text-decoration:none;
    transition:background .2s,border-color .2s,transform .15s;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);
  }
  .sos-btn-outline:hover{background:rgba(255,255,255,0.09);border-color:rgba(255,255,255,0.28);transform:translateY(-1px);}

  /* ── Glass card ── */
  .sos-glass{
    background:linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:20px;
    backdrop-filter:blur(12px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 8px 40px rgba(0,0,0,0.38);
    position:relative;isolation:isolate;
  }
  .sos-glass::before{
    content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    background:linear-gradient(160deg,rgba(255,255,255,0.055) 0%,transparent 45%);
  }

  /* ── Icon box ── */
  .sos-icon{
    width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,rgba(220,38,38,0.18),rgba(220,38,38,0.06));
    border:1px solid rgba(220,38,38,0.28);flex-shrink:0;
  }

  /* ── Eyebrow tag ── */
  .sos-eyebrow{
    display:inline-flex;align-items:center;gap:8px;padding:5px 16px;border-radius:99px;
    font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
    background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.25);color:#fca5a5;
  }

  /* ── Pain / Solution split ── */
  .sos-ps{display:grid;grid-template-columns:1fr 1.4fr;overflow:hidden;}
  .sos-ps-l{
    padding:32px 30px;
    background:rgba(239,68,68,0.04);
    border-right:1px solid rgba(255,255,255,0.08);
  }
  .sos-ps-r{padding:32px 30px;}

  /* ── Features grid ── */
  .sos-feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .sos-feat{
    transition:border-color .25s,background .25s,transform .2s;
    cursor:default;
  }
  .sos-feat:hover{
    border-color:rgba(220,38,38,0.38)!important;
    background:linear-gradient(160deg,rgba(255,255,255,0.09) 0%,rgba(255,255,255,0.04) 100%)!important;
    transform:translateY(-3px);
  }

  /* ── Scroll reveal ── */
  .sos-reveal{opacity:0;transform:translateY(22px);transition:opacity .65s ease,transform .65s ease;}
  .sos-reveal.in{opacity:1;transform:none;}
  @media(prefers-reduced-motion:reduce){.sos-reveal{opacity:1;transform:none;}}

  /* ── Segment control ── */
  .sos-seg{
    display:inline-flex;padding:5px;border-radius:14px;gap:4px;
    background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
  }
  .sos-seg button{
    border:none;background:transparent;color:#6b7280;font-family:inherit;font-weight:700;
    font-size:13px;padding:10px 24px;border-radius:10px;cursor:pointer;transition:all .22s;
    letter-spacing:.01em;
  }
  .sos-seg button.on{background:#dc2626;color:#fff;box-shadow:0 2px 14px rgba(220,38,38,0.45);}

  /* ── Pricing carousel (mobile) ── */
  .sos-price-track{
    display:grid;
    gap:18px;
  }
  @media(max-width:860px){
    .sos-price-track{
      display:flex;
      gap:16px;
      overflow-x:scroll;
      scroll-snap-type:x mandatory;
      scroll-behavior:smooth;
      -webkit-overflow-scrolling:touch;
      scrollbar-width:none;
      padding:4px 24px 20px;
      margin:0 -24px;
    }
    .sos-price-track::-webkit-scrollbar{display:none;}
    .sos-price-card-wrap{
      flex:0 0 82vw;
      max-width:340px;
      scroll-snap-align:center;
    }
    .sos-price-dots{display:flex!important;}
  }
  .sos-price-dots{display:none;justify-content:center;gap:7px;margin-top:18px;}
  .sos-dot{
    width:7px;height:7px;border-radius:50%;
    background:rgba(255,255,255,0.2);border:none;cursor:pointer;padding:0;
    transition:background .2s,transform .2s;
  }
  .sos-dot.on{background:#dc2626;transform:scale(1.3);}

  /* ── Pricing card ── */
  .sos-pc{
    padding:32px;display:flex;flex-direction:column;border-radius:20px;
    transition:transform .22s,box-shadow .22s;position:relative;overflow:hidden;
  }
  .sos-pc::before{
    content:'';position:absolute;inset:0;border-radius:inherit;
    background:linear-gradient(160deg,rgba(255,255,255,0.07) 0%,transparent 50%);
    pointer-events:none;
  }
  .sos-pc:hover{transform:translateY(-4px);}

  /* ── Stats strip ── */
  .sos-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);}

  /* ── Team roles grid ── */
  .sos-roles{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;}

  @media(max-width:860px){
    .sos-nav-links{display:none!important;}
    .sos-hero-h1{font-size:44px!important;line-height:1.04!important;}
    .sos-hero-sub{font-size:16px!important;}
    .sos-ps{grid-template-columns:1fr;}
    .sos-ps-l{border-right:none;border-bottom:1px solid rgba(255,255,255,0.08);}
    .sos-feat-grid{grid-template-columns:1fr;}
    .sos-stats-grid{grid-template-columns:1fr 1fr;}
    .sos-roles{grid-template-columns:1fr 1fr;}
    .sos-cta-btns{flex-direction:column;align-items:stretch!important;}
    .sos-cta-btns a,.sos-cta-btns button{justify-content:center!important;}
    .sos-footer-inner{flex-direction:column!important;gap:28px!important;}
  }
`;

// ─── Data ────────────────────────────────────────────────────────────────────
// Copy lives in i18n (shiftos.*) so the page is fully EN/BM. These arrays hold
// only the icon + the translation-key id for each item.
const PAIN_SOLUTIONS = [
  { Icon: Wallet,         key: "p1" },
  { Icon: ClipboardCheck, key: "p2" },
  { Icon: Users,          key: "p3" },
  { Icon: Landmark,       key: "p4" },
  { Icon: Globe,          key: "p5" },
  { Icon: BellRing,       key: "p6" },
];

const FEATURES = [
  { Icon: Car,            key: "inventory" },
  { Icon: LineChart,      key: "crm" },
  { Icon: Landmark,       key: "fi" },
  { Icon: ClipboardCheck, key: "postsale" },
  { Icon: Receipt,        key: "documents" },
  { Icon: Bot,            key: "ai" },
  { Icon: Wallet,         key: "ownerpnl" },
  { Icon: Globe,          key: "storefront" },
  { Icon: ShieldCheck,    key: "security" },
];

const TEAM_ROLES = [
  { Icon: UserCheck,   key: "salesman" },
  { Icon: Briefcase,   key: "fi" },
  { Icon: Calculator,  key: "accountant" },
  { Icon: LineChart,   key: "manager" },
  { Icon: ShieldCheck, key: "admin" },
];

const PLAN_META = {
  salesman_lite: { to: "/salesman-onboarding/lite",    variant: "outline" },
  salesman_full: { to: "/salesman-onboarding/premium", variant: "primary" },
  dealer_starter:{ to: "/dealer-onboarding/starter",   variant: "outline" },
  dealer_growth: { to: "/dealer-onboarding/growth",    variant: "primary", popular: true },
  dealer_pro:    { to: "/dealer-onboarding/pro",       variant: "gold" },
};

// salesman_full (Premium) hidden for now — solo focus is Lite. Re-add to show the card again.
const SALESMAN_PLANS = ["salesman_lite"];
const DEALER_PLANS   = ["dealer_starter", "dealer_growth", "dealer_pro"];
const WA = "https://wa.me/60174155191?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { threshold: 0.1 });
    if (delay) { const t = setTimeout(() => io.observe(el), delay); return () => { clearTimeout(t); io.disconnect(); }; }
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className="sos-reveal" style={style}>{children}</div>;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = 34 }) {
  const fs = Math.round(size * 0.52);
  return (
    <Link to="/shiftos" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#e02020,#991b1b)", borderRadius: 7, transform: "rotate(6deg)", boxShadow: "0 3px 12px rgba(220,38,38,0.5)" }} />
        <span style={{ position: "relative", fontFamily: "'Bebas Neue',sans-serif", fontSize: fs, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", letterSpacing: 0 }}>S</span>
      </div>
      <div>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 21, letterSpacing: "0.04em", background: "linear-gradient(135deg,#fb7185,#dc2626 60%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ShiftOS</span>
        <span style={{ display: "block", fontSize: 10, color: "#4b5563", letterSpacing: "0.1em", lineHeight: 1, marginTop: -1 }}>by XDrive</span>
      </div>
    </Link>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────
function PriceCard({ planKey }) {
  const { t } = useTranslation();
  const cfg  = PLAN_CONFIG[planKey];
  const meta = PLAN_META[planKey];
  const feats = t(`shiftos.pricing.plans.${planKey}.features`, { returnObjects: true });
  const featList = Array.isArray(feats) ? feats : [];
  const cta = t(`shiftos.pricing.plans.${planKey}.cta`);
  const isPopular = meta.popular;
  const isGold    = meta.variant === "gold";

  const borderCol = isPopular ? "rgba(220,38,38,0.55)"
                  : isGold    ? "rgba(212,168,75,0.4)"
                  : "rgba(255,255,255,0.1)";
  const bgGrad = isPopular
    ? "linear-gradient(160deg,rgba(220,38,38,0.14) 0%,rgba(255,255,255,0.04) 100%)"
    : isGold
      ? "linear-gradient(160deg,rgba(212,168,75,0.12) 0%,rgba(255,255,255,0.04) 100%)"
      : "linear-gradient(160deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.03) 100%)";
  const shadow = isPopular ? "inset 0 1px 0 rgba(255,255,255,0.12),0 12px 48px rgba(220,38,38,0.24)"
               : isGold    ? "inset 0 1px 0 rgba(255,255,255,0.12),0 12px 48px rgba(212,168,75,0.14)"
               : "inset 0 1px 0 rgba(255,255,255,0.08),0 8px 32px rgba(0,0,0,0.32)";
  const priceCol = isGold ? "#f59e0b" : "#fff";
  const checkCol = isPopular ? "#f87171" : isGold ? "#f59e0b" : "#4b5563";

  return (
    <div className="sos-pc" style={{ background: bgGrad, border: `1px solid ${borderCol}`, boxShadow: shadow }}>
      {isPopular && (
        <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", background: "#dc2626", borderRadius: "0 0 10px 10px", padding: "3px 16px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fff", whiteSpace: "nowrap" }}>
          {t("shiftos.pricing.mostPopular")}
        </div>
      )}
      <div style={{ marginBottom: 6, marginTop: isPopular ? 18 : 0 }}>
        <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{cfg.label}</p>
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 58, lineHeight: 1, color: priceCol, letterSpacing: 0 }}>
          {cfg.price === 0 ? "RM0" : `RM${cfg.price}`}
        </span>
        <span style={{ fontSize: 16, color: "#6b7280", marginLeft: 2 }}>{t("shiftos.pricing.perMonth")}</span>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>
        {cfg.listingCap ?? t("shiftos.pricing.unlimited")} {t("shiftos.pricing.listings")} · {cfg.seatCap ? `${cfg.seatCap} ${cfg.seatCap === 1 ? t("shiftos.pricing.seat") : t("shiftos.pricing.seats")}` : t("shiftos.pricing.unlimitedTeam")}
      </p>
      <ul style={{ listStyle: "none", flex: 1, marginBottom: 28 }}>
        {featList.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#cbd5e1", marginBottom: 12, lineHeight: 1.5 }}>
            <Check size={15} color={checkCol} style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
      {meta.variant === "primary" && (
        <Link to={meta.to} className="sos-btn-primary" style={{ justifyContent: "center", fontSize: 14 }}>{cta}</Link>
      )}
      {meta.variant === "outline" && (
        <Link to={meta.to} className="sos-btn-outline" style={{ justifyContent: "center", fontSize: 14 }}>{cta}</Link>
      )}
      {meta.variant === "gold" && (
        <Link to={meta.to} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 26px", borderRadius: 11, background: "linear-gradient(135deg,#d97706,#92400e)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 20px rgba(180,120,40,0.38),inset 0 1px 0 rgba(255,255,255,0.14)", transition: "transform .15s,box-shadow .15s" }}>{cta}</Link>
      )}
    </div>
  );
}

// ─── Pricing carousel with dot indicators ────────────────────────────────────
function PricingSection({ track }) {
  const plans = track === "dealer" ? DEALER_PLANS : SALESMAN_PLANS;
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const cards = el.children;
    if (!cards.length) return;
    const cx = el.scrollLeft + el.offsetWidth / 2;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - cx);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    setActive(best);
  }, []);

  const scrollTo = useCallback((i) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.children[i];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetWidth / 2 + card.offsetWidth / 2, behavior: "smooth" });
  }, []);

  return (
    <>
      <div className="sos-price-track" ref={trackRef} onScroll={onScroll}>
        {plans.map((k) => (
          <div key={k} className="sos-price-card-wrap">
            <PriceCard planKey={k} />
          </div>
        ))}
      </div>
      <div className="sos-price-dots">
        {plans.map((_, i) => (
          <button key={i} className={`sos-dot${active === i ? " on" : ""}`} onClick={() => scrollTo(i)} aria-label={`Plan ${i + 1}`} />
        ))}
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ShiftOSPage() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");
  const toggleLang = () => i18n.changeLanguage(isEn ? "ms" : "en");
  const featRef    = useRef(null);
  const pricingRef = useRef(null);
  // Allow deep-linking the salesman track from the marketplace "For Salesmen"
  // entry point (/shiftos?for=salesman) so salesmen land on their own tab
  // instead of the dealer default.
  const [track, setTrack] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("for") === "salesman" || window.location.hash === "#salesmen"
      ? "salesman"
      : "dealer";
  });
  const location = useLocation();

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    document.title = "ShiftOS — The Dealer Management System for Malaysian Car Dealers";
    return () => { document.head.removeChild(s); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("for") === "salesman" || location.hash === "#salesmen") {
      setTrack("salesman");
      setTimeout(() => pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else if (location.hash === "#pricing") {
      setTimeout(() => pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else if (location.hash === "#features") {
      setTimeout(() => featRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [location.hash, location.search]);

  const scrollTo = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="sos">
      <div className="sos-bg" />
      <div className="sos-grid" />
      <div className="sos-content">

        {/* ── Nav ── */}
        <nav className="sos-nav">
          <div className="sos-wrap" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo />
            <div className="sos-nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
              {[{ label: t("shiftos.nav.features"), ref: featRef }, { label: t("shiftos.nav.pricing"), ref: pricingRef }].map(({ label, ref }) => (
                <button key={label} onClick={() => scrollTo(ref)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".01em", transition: "color .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{label}</button>
              ))}
              <a href="https://xdrive.my" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{t("shiftos.nav.marketplace")}</a>
              <Link to="/login" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{t("shiftos.nav.login")}</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, padding: 3 }}>
                <button onClick={toggleLang} aria-label="Switch to English" aria-pressed={isEn} style={{ padding: "3px 10px", borderRadius: 50, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: ".06em", fontFamily: "inherit", background: isEn ? "rgba(220,38,38,0.14)" : "transparent", color: isEn ? "#f87171" : "rgba(255,255,255,0.35)" }}>EN</button>
                <button onClick={toggleLang} aria-label="Tukar ke Bahasa Malaysia" aria-pressed={!isEn} style={{ padding: "3px 10px", borderRadius: 50, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: ".06em", fontFamily: "inherit", background: !isEn ? "rgba(220,38,38,0.14)" : "transparent", color: !isEn ? "#f87171" : "rgba(255,255,255,0.35)" }}>BM</button>
              </div>
              <button onClick={() => scrollTo(pricingRef)} className="sos-btn-primary" style={{ fontSize: 13, padding: "9px 18px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {t("shiftos.nav.startFree")} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="sos-wrap" style={{ padding: "100px 24px 80px", textAlign: "center" }}>
          <Reveal>
            <div className="sos-eyebrow" style={{ marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
              {t("shiftos.hero.eyebrow")}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="sos-h sos-hero-h1" style={{ fontSize: 80, color: "#fff", margin: "0 auto 24px", maxWidth: 980, lineHeight: 1.02 }}>
              {t("shiftos.hero.title1")}<br />{t("shiftos.hero.title2lead")} <span className="sos-red">{t("shiftos.hero.title2accent")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="sos-hero-sub" style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8", maxWidth: 620, margin: "0 auto 42px", lineHeight: 1.65 }}>
              {t("shiftos.hero.subtitle")}
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="sos-cta-btns" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
              <button onClick={() => scrollTo(pricingRef)} className="sos-btn-primary" style={{ fontSize: 15, padding: "14px 30px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {t("shiftos.hero.startFree")} <ArrowRight size={16} />
              </button>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ fontSize: 15, padding: "14px 30px" }}>
                <MessageCircle size={16} /> {t("shiftos.hero.talkToUs")}
              </a>
            </div>
            <p style={{ fontSize: 12, color: "#374151", letterSpacing: ".04em" }}>
              {t("shiftos.hero.trust")}
            </p>
          </Reveal>
        </section>

        {/* ── Stats strip ── */}
        <section className="sos-wrap" style={{ paddingBottom: 88 }}>
          <Reveal>
            <div className="sos-glass sos-stats-grid" style={{ overflow: "hidden" }}>
              {[
                { num: "1",       label: t("shiftos.stats.s1") },
                { num: "100%",    label: t("shiftos.stats.s2") },
                { num: "RM0",     label: t("shiftos.stats.s3") },
                { num: "< 30m",   label: t("shiftos.stats.s4") },
              ].map(({ num, label }, i, arr) => (
                <div key={label} style={{ padding: "34px 20px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <p className="sos-h sos-red" style={{ fontSize: 42, marginBottom: 8 }}>{num}</p>
                  <p style={{ fontSize: 12, color: "#6b7280", letterSpacing: ".05em", lineHeight: 1.4, textTransform: "uppercase" }}>{label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Pain → Solution ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>{t("shiftos.pain.eyebrow")}</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>{t("shiftos.pain.title")}</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 540, margin: "0 auto", lineHeight: 1.65 }}>
                {t("shiftos.pain.subtitle")}
              </p>
            </div>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {PAIN_SOLUTIONS.map(({ Icon, key }, i) => (
              <Reveal key={key} delay={i * 40}>
                <div className="sos-glass sos-ps">
                  <div className="sos-ps-l">
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: ".12em" }}>{t("shiftos.pain.label")}</span>
                    <p style={{ marginTop: 14, fontSize: 15, color: "#cbd5e1", lineHeight: 1.7, fontStyle: "italic" }}>“{t(`shiftos.pain.items.${key}.quote`)}”</p>
                  </div>
                  <div className="sos-ps-r">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div className="sos-icon"><Icon size={20} color="#ef4444" /></div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", textTransform: "uppercase", letterSpacing: ".1em" }}>{t(`shiftos.pain.items.${key}.tag`)}</span>
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginBottom: 10, lineHeight: 1.38 }}>{t(`shiftos.pain.items.${key}.title`)}</p>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{t(`shiftos.pain.items.${key}.desc`)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" ref={featRef} className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>{t("shiftos.features.eyebrow")}</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>{t("shiftos.features.title")}</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 540, margin: "0 auto", lineHeight: 1.65 }}>
                {t("shiftos.features.subtitle")}
              </p>
            </div>
          </Reveal>
          <div className="sos-feat-grid">
            {FEATURES.map(({ Icon, key }, i) => (
              <Reveal key={key} delay={i * 30}>
                <div className="sos-glass sos-feat" style={{ padding: 26, height: "100%" }}>
                  <div className="sos-icon" style={{ marginBottom: 18 }}><Icon size={20} color="#ef4444" /></div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 9 }}>{t(`shiftos.features.items.${key}.title`)}</p>
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65 }}>{t(`shiftos.features.items.${key}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Team roles ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div className="sos-glass" style={{ padding: "52px 40px", textAlign: "center" }}>
              <h2 className="sos-h" style={{ fontSize: 46, color: "#fff", marginBottom: 12 }}>{t("shiftos.team.title")}</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.65 }}>
                {t("shiftos.team.subtitle")}
              </p>
              <div className="sos-roles">
                {TEAM_ROLES.map(({ Icon, key }) => (
                  <div key={key} style={{ padding: "22px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                      <Icon size={18} color="#ef4444" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{t(`shiftos.team.roles.${key}.role`)}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>{t(`shiftos.team.roles.${key}.desc`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" ref={pricingRef} className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>{t("shiftos.pricing.eyebrow")}</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>{t("shiftos.pricing.title")}</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.65 }}>
                {t("shiftos.pricing.subtitle")}
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div className="sos-seg">
                  <button className={track === "dealer" ? "on" : ""} onClick={() => setTrack("dealer")}>{t("shiftos.pricing.forDealers")}</button>
                  <button className={track === "salesman" ? "on" : ""} onClick={() => setTrack("salesman")}>{t("shiftos.pricing.forSalesmen")}</button>
                </div>
              </div>
            </div>
          </Reveal>

          <div style={{ maxWidth: track === "salesman" ? 680 : "100%", margin: "0 auto" }}>
            <PricingSection track={track} />
          </div>

          <p style={{ textAlign: "center", color: "#374151", fontSize: 13, marginTop: 32 }}>
            {t("shiftos.pricing.needMore")}{" "}
            <a href={WA} target="_blank" rel="noopener noreferrer" style={{ color: "#ef4444", textDecoration: "none", fontWeight: 600 }}>
              {t("shiftos.pricing.talkToTeam")} <ChevronRight size={13} style={{ verticalAlign: "middle" }} />
            </a>
          </p>
        </section>

        {/* ── Testimonial ── */}
        <section className="sos-wrap" style={{ maxWidth: 820, paddingBottom: 96 }}>
          <Reveal>
            <div style={{ borderLeft: "3px solid #dc2626", paddingLeft: 30 }}>
              <p style={{ fontSize: 19, fontStyle: "italic", color: "#cbd5e1", lineHeight: 1.75, marginBottom: 16 }}>
                “{t("shiftos.testimonial.quote")}”
              </p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>{t("shiftos.testimonial.author")}</p>
            </div>
          </Reveal>
        </section>

        {/* ── Final CTA ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div className="sos-glass" style={{ padding: "68px 40px", textAlign: "center", background: "radial-gradient(ellipse 800px 400px at 50% -10%, rgba(220,38,38,0.2) 0%, rgba(255,255,255,0.04) 100%)" }}>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 14 }}>{t("shiftos.finalCta.title")}</h2>
              <p style={{ fontSize: 16, color: "#94a3b8", maxWidth: 520, margin: "0 auto 38px", lineHeight: 1.65 }}>
                {t("shiftos.finalCta.subtitle")}
              </p>
              <div className="sos-cta-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => scrollTo(pricingRef)} className="sos-btn-primary" style={{ fontSize: 15, padding: "15px 34px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {t("shiftos.finalCta.startFree")} <ArrowRight size={16} />
                </button>
                <a href={WA} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ fontSize: 15, padding: "15px 34px" }}>
                  <MessageCircle size={16} /> {t("shiftos.finalCta.whatsappUs")}
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "48px 24px" }}>
          <div className="sos-wrap sos-footer-inner" style={{ padding: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 32 }}>
            <div>
              <Logo size={28} />
              <p style={{ fontSize: 12, color: "#374151", marginTop: 12, maxWidth: 280, lineHeight: 1.6 }}>
                {t("shiftos.footer.tagline")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <button onClick={() => scrollTo(featRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>{t("shiftos.footer.features")}</button>
              <button onClick={() => scrollTo(pricingRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>{t("shiftos.footer.pricing")}</button>
              <Link to="/login" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>{t("shiftos.footer.login")}</Link>
              <Link to="/" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>xdrive.my</Link>
            </div>
          </div>
          <div className="sos-wrap" style={{ padding: 0, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontSize: 12, color: "#1f2937" }}>© {new Date().getFullYear()} {t("shiftos.footer.copyright")}</p>
            <p style={{ fontSize: 12, color: "#1f2937" }}>{t("shiftos.footer.poweredBy")} <span style={{ color: "#dc2626" }}>XDrive</span></p>
          </div>
        </footer>

      </div>
    </div>
  );
}
