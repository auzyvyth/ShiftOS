import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import {
  Wallet, Users, Bot, Globe, MessageCircle, ArrowRight, Check,
  ClipboardCheck, Landmark, BellRing, LineChart, ShieldCheck,
  Receipt, UserCheck, Calculator, Briefcase, ChevronRight, Car,
  Building2, ChevronDown,
} from "lucide-react";
import { PLAN_CONFIG } from "../utils/planConfig";
import { supabase } from "../supabaseClient";
import { trackPageView } from "../utils/analytics";
import HeroShowcase from "../components/shiftos/HeroShowcase";
import { PAIN_PREVIEWS } from "../components/shiftos/PainPreviews";

// ─── SEO / AEO (GEO) ─────────────────────────────────────────────────────────
// Keyword-dense meta, schema markup and an FAQ block so ShiftOS surfaces for the
// vocabulary Malaysian used-car dealers actually search (BM/Manglish first), and
// so AI answer engines can extract clean Q&A passages.
const SEO_DESC =
  "ShiftOS ialah software dealer kereta Malaysia & used car DMS untuk urus stok kereta terpakai, lead CRM, rekod jualan dan komisen salesman. Sistem urus stok kereta terpakai untuk dealer & salesman — mula percuma.";

const SEO_KEYWORDS = [
  "app urus stok kereta", "sistem urus stok kereta terpakai", "software rekod jualan kereta",
  "app untuk dealer kereta terpakai", "cara urus stok kereta dealer", "software dealer kereta Malaysia",
  "sistem jualan kereta Malaysia", "app salesmen kereta", "rekod komisen salesmen kereta",
  "cara urus enquiry kereta", "cara urus stok kereta terpakai Malaysia", "app rekod keuntungan jual kereta",
  "sistem booking test drive kereta", "app salesman kereta Malaysia", "software dealer kereta murah",
  "used car dealer software Malaysia", "car dealer management app Malaysia", "car inventory management Malaysia",
  "used car DMS Malaysia", "car dealer CRM Malaysia", "salesman commission tracking car dealer",
].join(", ");

const FAQS = [
  {
    q: "Apa itu ShiftOS?",
    a: "ShiftOS ialah sistem urus stok kereta terpakai (used car DMS Malaysia) yang direka khas untuk dealer kereta di Malaysia. Ia satu app urus stok kereta dan app untuk dealer kereta terpakai yang menggabungkan CRM lead, rekod jualan, komisen salesman dan analitik keuntungan dalam satu platform.",
  },
  {
    q: "Berapa harga ShiftOS?",
    a: "Harga ShiftOS bermula RM0 untuk Salesman Lite (percuma) dan RM35/bulan untuk Salesman Premium. Untuk dealer: Dealer Starter RM299/bulan, Dealer Growth RM599/bulan dan Dealer Pro RM1,199/bulan. Ia software dealer kereta murah berbanding kos rekod manual Excel atau upah kakitangan tambahan.",
  },
  {
    q: "Adakah ShiftOS sesuai untuk dealer kecil?",
    a: "Ya. ShiftOS sesuai untuk dealer kereta terpakai kecil dan besar. Dealer kecil boleh mula dengan pelan Dealer Starter RM299/bulan, manakala salesman individu boleh guna Salesman Lite percuma — sebuah app salesman kereta Malaysia untuk urus listing, lead dan komisen sendiri.",
  },
  {
    q: "Boleh ke guna ShiftOS dengan Mudah dan Carlist?",
    a: "Boleh. ShiftOS melengkapkan Mudah dan Carlist, bukan menggantikannya. Anda urus stok, lead dan jualan dalam ShiftOS dan masih boleh iklan di Mudah atau Carlist. Setiap dealer juga dapat storefront XDrive sendiri secara percuma.",
  },
  {
    q: "Macam mana cara urus stok kereta dealer guna ShiftOS?",
    a: "Cara urus stok kereta terpakai Malaysia dengan ShiftOS: rekod setiap unit (kos beli, recon, harga jual), pantau umur stok, dan lihat keuntungan setiap kereta secara automatik. Anda tak perlu lagi Excel atau WhatsApp untuk cara urus stok kereta dealer.",
  },
  {
    q: "Ada tak software rekod jualan kereta dan keuntungan?",
    a: "Ada. ShiftOS ialah software rekod jualan kereta dan app rekod keuntungan jual kereta. Setiap jualan direkod dengan front gross, back gross (F&I add-on) dan kos handover, jadi anda nampak untung sebenar setiap unit.",
  },
  {
    q: "Macam mana ShiftOS buat rekod komisen salesmen kereta?",
    a: "ShiftOS buat rekod komisen salesmen kereta secara automatik (salesman commission tracking car dealer). Setiap deal yang ditutup salesman dikira komisennya tanpa kira manual — sesuai untuk app salesmen kereta dengan ramai rep.",
  },
  {
    q: "Ada sistem untuk urus enquiry dan booking test drive?",
    a: "Ya. ShiftOS ada CRM untuk cara urus enquiry kereta dari semua sumber (WhatsApp, walk-in, Mudah, Carlist) dan sistem booking test drive kereta supaya setiap appointment dan lead terurus rapi.",
  },
  {
    q: "Apa itu Dealer Management System (DMS) untuk kereta?",
    a: "Dealer Management System (DMS) ialah sistem jualan kereta Malaysia yang menyatukan stok, lead, jualan, dokumen dan laporan. ShiftOS ialah software dealer kereta Malaysia jenis DMS yang dibina khas untuk dealer kereta terpakai.",
  },
  {
    q: "What is the best app for Malaysian used car dealers?",
    a: "ShiftOS is a purpose-built used car dealer software Malaysia. It combines car inventory management Malaysia, a car dealer CRM Malaysia, salesman commission tracking, F&I and revenue analytics — designed for local workflows like Puspakom B5/B7, JPJ pindah milik and HP financing.",
  },
  {
    q: "Is there a DMS for used car dealers in Malaysia?",
    a: "Yes. ShiftOS is a used car DMS Malaysia (dealer management system) and car dealer management app Malaysia built for independent dealers. It replaces spreadsheets with one system for stock, leads, sales, documents and reporting.",
  },
  {
    q: "How do I manage my car dealer inventory in Malaysia?",
    a: "Use a car inventory management Malaysia tool like ShiftOS: log each unit's purchase, recon and asking price, track days-in-stock, and get automatic per-unit profit. It is faster and far more accurate than a manual stock list or WhatsApp.",
  },
];

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ShiftOS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://xdrive.my/shiftos",
  description:
    "ShiftOS is a used car dealer software Malaysia (used car DMS) — sistem urus stok kereta terpakai for inventory management, leads CRM, sales records, salesman commission tracking and profit analytics. Built for Malaysian used car dealers and salesmen.",
  inLanguage: ["ms-MY", "en-MY"],
  offers: Object.values(PLAN_CONFIG).map((c) => ({
    "@type": "Offer",
    name: c.label,
    price: String(c.price),
    priceCurrency: "MYR",
    category: c.isDealer ? "Dealer plan" : "Salesman plan",
  })),
  featureList: [
    "Car inventory / stock management (urus stok kereta)",
    "Leads CRM & enquiry management (urus enquiry kereta)",
    "Sales & profit records (rekod jualan & keuntungan)",
    "Salesman commission tracking (rekod komisen salesman)",
    "Test drive booking (booking test drive kereta)",
    "F&I add-ons & revenue analytics",
    "Dealer storefront on the XDrive marketplace",
  ],
  publisher: {
    "@type": "Organization",
    "@id": "https://xdrive.my/#organization",
    name: "XDrive",
    url: "https://xdrive.my",
    logo: "https://xdrive.my/xdrivelogo.png",
    sameAs: [
      "https://facebook.com/xdrive.my",
      "https://instagram.com/xdrive.my",
      "https://tiktok.com/@xdrive.my",
    ],
  },
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

  /* Light theme. Text: #0f172a headings, #374151 body, #6b7280 muted.
     Cards: #fff on a warm off-white page, border #e5e7eb. One accent: red. */
  .sos *{box-sizing:border-box;margin:0;padding:0;}
  .sos{
    font-family:var(--xd-font-body);
    background:#FBF9F8;
    min-height:100vh;
    color:#0f172a;
    overflow-x:hidden;
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
  }

  /* ── Background: faint red smudges behind the whole page ── */
  .sos-bg{
    position:fixed;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(ellipse 900px 600px at 0% 35%,   rgba(220,38,38,0.05) 0%, transparent 65%),
      radial-gradient(ellipse 800px 600px at 100% 70%, rgba(251,113,133,0.06) 0%, transparent 65%),
      #FBF9F8;
  }
  .sos-grid{
    position:fixed;inset:-1px;z-index:0;pointer-events:none;
    background-image:
      linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px);
    background-size:52px 52px;
    -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 100%);
    mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 100%);
  }

  .sos-content{position:relative;z-index:1;}
  .sos-wrap{max-width:1160px;margin:0 auto;padding:0 24px;}

  /* ── Scroll progress bar ── */
  .sos-progress{
    position:fixed;top:0;left:0;right:0;height:2px;z-index:200;pointer-events:none;
    background:transparent;
  }
  .sos-progress > div{
    height:100%;width:100%;
    background:linear-gradient(90deg,#dc2626,#fb7185);
    transform-origin:0 50%;transform:scaleX(0);
  }

  /* ── Nav ── */
  .sos-nav{
    position:sticky;top:0;z-index:100;
    background:rgba(251,249,248,0.9);
    backdrop-filter:blur(24px) saturate(1.6);
    -webkit-backdrop-filter:blur(24px) saturate(1.6);
    border-bottom:1px solid rgba(15,23,42,0.07);
  }

  /* ── Smudged panels (hero + final CTA): white with soft red glows ── */
  .sos-smudge{position:relative;isolation:isolate;overflow:hidden;}
  .sos-smudge::before{
    content:'';position:absolute;inset:-10%;z-index:-1;pointer-events:none;
    background:
      radial-gradient(ellipse 520px 380px at 4% 8%,   rgba(220,38,38,0.26) 0%, transparent 70%),
      radial-gradient(ellipse 480px 420px at 98% 22%, rgba(251,113,133,0.30) 0%, transparent 70%),
      radial-gradient(ellipse 620px 300px at 62% 78%, rgba(239,68,68,0.12) 0%, transparent 70%),
      radial-gradient(ellipse 380px 260px at 18% 70%, rgba(252,165,165,0.22) 0%, transparent 70%);
    filter:blur(28px);
  }
  .sos-hero-light{background:#FBF9F8;}

  /* ── Typography ── */
  .sos-h{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em;line-height:1.02;color:#0f172a;}
  .sos-red{
    background:linear-gradient(135deg,#ef4444,#b91c1c 60%);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .sos-kicker{
    display:flex;align-items:center;justify-content:center;gap:14px;
    font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#6b7280;
  }
  .sos-kicker::before,.sos-kicker::after{
    content:'';height:1px;width:42px;
    background:linear-gradient(90deg,transparent,rgba(220,38,38,0.45));
  }
  .sos-kicker::after{background:linear-gradient(90deg,rgba(220,38,38,0.45),transparent);}
  .sos-kicker b{color:#dc2626;font-weight:800;}
  .sos-sub{font-size:15px;color:#4b5563;max-width:540px;margin:0 auto;line-height:1.65;}

  /* ── Buttons ── */
  .sos-btn-primary{
    background:linear-gradient(135deg,#e02020,#b91c1c);
    color:#fff;border:none;border-radius:11px;
    padding:13px 26px;font-family:inherit;font-weight:700;font-size:14px;
    cursor:pointer;display:inline-flex;align-items:center;gap:9px;text-decoration:none;white-space:nowrap;
    box-shadow:0 4px 18px rgba(220,38,38,0.28),inset 0 1px 0 rgba(255,255,255,0.14);
    transition:transform .15s,box-shadow .15s;letter-spacing:.01em;
  }
  .sos-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(220,38,38,0.36),inset 0 1px 0 rgba(255,255,255,0.14);}
  .sos-btn-primary:focus-visible{outline:2px solid #dc2626;outline-offset:3px;}
  .sos-btn-outline{
    background:#fff;color:#111827;
    border:1px solid #e5e7eb;border-radius:11px;
    padding:13px 26px;font-family:inherit;font-weight:600;font-size:14px;
    cursor:pointer;display:inline-flex;align-items:center;gap:9px;text-decoration:none;white-space:nowrap;
    transition:border-color .2s,transform .15s;
    box-shadow:0 1px 2px rgba(15,23,42,0.06);
  }
  .sos-btn-outline:hover{border-color:#d1d5db;transform:translateY(-1px);}
  .sos-btn-outline:focus-visible{outline:2px solid #dc2626;outline-offset:3px;}

  /* ── Card (was a dark glass panel) ── */
  .sos-glass{
    background:#fff;
    border:1px solid #e5e7eb;
    border-radius:20px;
    box-shadow:0 1px 2px rgba(15,23,42,0.04),0 12px 32px -16px rgba(15,23,42,0.12);
    position:relative;isolation:isolate;
  }

  /* ── Icon box ── */
  .sos-icon{
    width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;
    background:rgba(220,38,38,0.07);
    border:1px solid rgba(220,38,38,0.18);flex-shrink:0;
  }

  /* ── Eyebrow tag ── */
  .sos-eyebrow{
    display:inline-flex;align-items:center;gap:8px;padding:5px 16px;border-radius:99px;
    font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
    background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.22);color:#b91c1c;
  }

  /* ── Hero showcase (coded dashboard frames) ── */
  .hs-in{opacity:0;transform:translateY(18px);animation:sos-rise .8s cubic-bezier(.2,.7,.2,1) forwards;}
  .hs-line{stroke-dasharray:520;stroke-dashoffset:520;animation:sos-draw 1.8s cubic-bezier(.5,0,.2,1) .9s forwards;}
  @keyframes sos-rise{to{opacity:1;transform:none;}}
  @keyframes sos-draw{to{stroke-dashoffset:0;}}

  /* ── Flow connector (walks the eye between sections) ── */
  .sos-flow{display:flex;flex-direction:column;align-items:center;padding:8px 0 40px;}
  .sos-flow svg{display:block;overflow:visible;}
  .sos-flow .stem{
    stroke-dasharray:88;stroke-dashoffset:88;
    transition:stroke-dashoffset 1s cubic-bezier(.5,0,.2,1) .15s;
  }
  .sos-reveal.in .sos-flow .stem,.sos-flow.in .stem{stroke-dashoffset:0;}
  .sos-flow .rider{opacity:0;transition:opacity .4s ease 1s;}
  .sos-reveal.in .sos-flow .rider,.sos-flow.in .rider{opacity:1;}
  .sos-flow-label{
    margin-top:14px;display:inline-flex;align-items:center;gap:8px;
    font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;
  }
  .sos-flow-label.hot{
    color:#b91c1c;background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.22);
    padding:7px 18px;border-radius:99px;
  }

  /* ── Pain -> solution rows: copy beside a coded preview, alternating sides ── */
  .sos-ps{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:56px;align-items:center;}
  .sos-ps.rev .sos-ps-copy{order:2;}
  .sos-ps-quote{
    font-size:14px;color:#6b7280;line-height:1.65;font-style:italic;
    padding:12px 16px;border-radius:12px;background:rgba(15,23,42,0.03);margin-bottom:22px;
  }
  .pp-frame{
    background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;
    box-shadow:0 1px 2px rgba(15,23,42,0.04),0 24px 56px -24px rgba(15,23,42,0.22);
  }
  .sos-ps-stage{position:relative;padding:28px;border-radius:24px;isolation:isolate;}
  .sos-ps-stage::before{
    content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;
    background:
      radial-gradient(ellipse 70% 70% at 20% 10%, rgba(220,38,38,0.10) 0%, transparent 70%),
      radial-gradient(ellipse 60% 60% at 90% 90%, rgba(251,113,133,0.12) 0%, transparent 70%),
      rgba(15,23,42,0.025);
  }
  /* Phones: drop the secondary columns and let the rest take the room. */
  @media(max-width:420px){
    .pp-sm-hide{display:none!important;}
    .pp-stock{grid-template-columns:minmax(0,1fr) auto auto!important;}
  }

  /* ── Features grid ── */
  .sos-feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .sos-feat{transition:border-color .25s,transform .2s;cursor:default;}
  .sos-feat:hover{border-color:rgba(220,38,38,0.35)!important;transform:translateY(-3px);}

  /* ── Scroll reveal ── */
  .sos-reveal{opacity:0;transform:translateY(22px);transition:opacity .65s ease,transform .65s ease;}
  .sos-reveal.in{opacity:1;transform:none;}

  /* ── Path chooser (CTA cards) ── */
  .sos-path-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:760px;margin:0 auto 44px;}
  .sos-path{
    position:relative;text-align:left;cursor:pointer;border-radius:18px;padding:26px 26px 24px;
    background:#fff;border:1px solid #e5e7eb;
    font-family:inherit;color:#0f172a;width:100%;
    transition:border-color .25s,transform .2s,box-shadow .25s;
  }
  .sos-path:hover{transform:translateY(-3px);border-color:rgba(220,38,38,0.4);}
  .sos-path:focus-visible{outline:2px solid #dc2626;outline-offset:3px;}
  .sos-path.on{
    border-color:#dc2626;
    background:linear-gradient(160deg,rgba(220,38,38,0.05) 0%,#fff 100%);
    box-shadow:0 12px 36px -12px rgba(220,38,38,0.28);
  }
  .sos-path .tick{
    position:absolute;top:16px;right:16px;width:22px;height:22px;border-radius:50%;
    border:1.5px solid #d1d5db;display:flex;align-items:center;justify-content:center;
    transition:all .2s;color:transparent;
  }
  .sos-path.on .tick{background:#dc2626;border-color:#dc2626;color:#fff;}

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
    background:rgba(15,23,42,0.15);border:none;cursor:pointer;padding:0;
    transition:background .2s,transform .2s;
  }
  .sos-dot.on{background:#dc2626;transform:scale(1.3);}

  /* ── Pricing card ── */
  .sos-pc{
    padding:32px;display:flex;flex-direction:column;border-radius:20px;height:100%;
    transition:transform .22s,box-shadow .22s;position:relative;overflow:hidden;
  }
  .sos-pc:hover{transform:translateY(-4px);}

  /* ── Stats strip ── */
  .sos-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);}

  /* ── Team roles grid ── */
  .sos-roles{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;}

  @media(prefers-reduced-motion:reduce){
    .sos-reveal{opacity:1;transform:none;}
    .hs-in{animation:none;opacity:1;transform:none;}
    .hs-line{animation:none;stroke-dashoffset:0;}
    .sos-flow .stem{transition:none;stroke-dashoffset:0;}
    .sos-flow .rider{transition:none;opacity:1;}
    .sos-flow .rider animate,.sos-flow animate{display:none;}
  }

  @media(max-width:860px){
    .sos-nav-links{display:none!important;}
    /* Compact nav CTA on mobile so the longer BM label ("Mula Percuma") fits
       on one line next to the logo + language toggle without overflowing. */
    .sos-nav .sos-btn-primary{padding:8px 13px!important;font-size:12px!important;gap:6px!important;}
    .sos-hero-h1{font-size:44px!important;line-height:1.04!important;}
    .sos-hero-sub{font-size:16px!important;}
    .sos-ps{grid-template-columns:minmax(0,1fr);gap:24px;}
    .sos-ps.rev .sos-ps-copy{order:0;}
    .sos-ps-stage{padding:14px;border-radius:18px;}
    .sos-feat-grid{grid-template-columns:1fr;}
    .sos-stats-grid{grid-template-columns:1fr 1fr;}
    .sos-roles{grid-template-columns:1fr 1fr;}
    .sos-path-grid{grid-template-columns:1fr;}
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

const SALESMAN_PLANS = ["salesman_lite", "salesman_full"];
const DEALER_PLANS   = ["dealer_starter", "dealer_growth", "dealer_pro"];
const WA = "https://wa.me/601111521742?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

// ─── Scroll progress bar ──────────────────────────────────────────────────────
function ScrollProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = barRef.current;
        if (!el) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        el.style.transform = `scaleX(${p})`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <div className="sos-progress" aria-hidden="true"><div ref={barRef} /></div>;
}

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

// ─── Flow connector — animated SVG line that walks the eye to the next stop ──
function FlowConnector({ label, hot = false }) {
  return (
    <Reveal>
      <div className="sos-flow" aria-hidden="true">
        <svg width="24" height="96" viewBox="0 0 24 96">
          <defs>
            <linearGradient id="sos-flow-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(220,38,38,0.0)" />
              <stop offset="30%" stopColor="rgba(220,38,38,0.55)" />
              <stop offset="100%" stopColor="rgba(251,113,133,0.9)" />
            </linearGradient>
          </defs>
          <line className="stem" x1="12" y1="2" x2="12" y2="78" stroke="url(#sos-flow-g)" strokeWidth="2" strokeLinecap="round" />
          {/* rider dot drifting down the stem — pure SVG (SMIL), no JS */}
          <circle className="rider" r="3" cx="12" cy="2" fill="#fb7185" opacity="0">
            <animate attributeName="cy" values="6;74" dur="2.6s" repeatCount="indefinite" begin="1s" />
            <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.8;1" dur="2.6s" repeatCount="indefinite" begin="1s" />
          </circle>
          <path className="rider" d="M6 80 L12 88 L18 80" stroke="#fb7185" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label && (
          <span className={`sos-flow-label${hot ? " hot" : ""}`}>
            {label}
            {hot && <ChevronDown size={13} />}
          </span>
        )}
      </div>
    </Reveal>
  );
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
        {/* The lockup replaces the gradient-filled wordmark. Height tracks the
            size prop so the nav (34) and the footer (28) stay proportional. */}
        <img src="/logo-shiftos-dark.png" alt="ShiftOS" width="354" height="59"
             style={{ height: Math.round(size * 0.5), width: "auto", display: "block" }} />
        <span style={{ display: "block", fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", lineHeight: 1, marginTop: 3 }}>by XDrive</span>
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
  const isSoon    = meta.soon;

  const borderCol = isPopular ? "#dc2626"
                  : isGold    ? "rgba(217,119,6,0.45)"
                  : "#e5e7eb";
  const bgGrad = isPopular
    ? "linear-gradient(160deg,rgba(220,38,38,0.05) 0%,#fff 55%)"
    : isGold
      ? "linear-gradient(160deg,rgba(217,119,6,0.06) 0%,#fff 55%)"
      : "#fff";
  const shadow = isPopular ? "0 18px 44px -16px rgba(220,38,38,0.32)"
               : isGold    ? "0 18px 44px -18px rgba(217,119,6,0.28)"
               : "0 1px 2px rgba(15,23,42,0.04),0 12px 32px -16px rgba(15,23,42,0.12)";
  const priceCol = isGold ? "#b45309" : "#0f172a";
  const checkCol = isPopular ? "#dc2626" : isGold ? "#d97706" : "#9ca3af";

  return (
    <div className="sos-pc" style={{ background: bgGrad, border: `1px solid ${borderCol}`, boxShadow: shadow }}>
      {isPopular && (
        <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", background: "#dc2626", borderRadius: "0 0 10px 10px", padding: "3px 16px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#fff", whiteSpace: "nowrap" }}>
          {t("shiftos.pricing.mostPopular")}
        </div>
      )}
      <div style={{ marginBottom: 6, marginTop: isPopular ? 18 : 0 }}>
        <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{cfg.label}</p>
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
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#374151", marginBottom: 12, lineHeight: 1.5 }}>
            <Check size={15} color={checkCol} style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
      {isSoon ? (
        <span aria-disabled="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 26px", borderRadius: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700, fontSize: 14, cursor: "not-allowed", letterSpacing: "0.04em" }}>{t("shiftos.pricing.comingSoon", "Coming soon")}</span>
      ) : (
        <>
          {meta.variant === "primary" && (
            <Link to={meta.to} className="sos-btn-primary" style={{ justifyContent: "center", fontSize: 14 }}>{cta}</Link>
          )}
          {meta.variant === "outline" && (
            <Link to={meta.to} className="sos-btn-outline" style={{ justifyContent: "center", fontSize: 14 }}>{cta}</Link>
          )}
          {meta.variant === "gold" && (
            <Link to={meta.to} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 26px", borderRadius: 11, background: "linear-gradient(135deg,#d97706,#92400e)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 20px rgba(180,120,40,0.38),inset 0 1px 0 rgba(255,255,255,0.14)", transition: "transform .15s,box-shadow .15s" }}>{cta}</Link>
          )}
        </>
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
      <div className="sos-price-track" ref={trackRef} onScroll={onScroll} style={track === "dealer" ? { gridTemplateColumns: "repeat(3, 1fr)" } : undefined}>
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

// ─── Path chooser — the CTA the page walks toward ────────────────────────────
function PathChooser({ track, setTrack }) {
  const { t } = useTranslation();
  const paths = [
    { id: "dealer",   Icon: Building2, title: t("shiftos.pricing.pathDealer.title"),   desc: t("shiftos.pricing.pathDealer.desc") },
    { id: "salesman", Icon: UserCheck, title: t("shiftos.pricing.pathSalesman.title"), desc: t("shiftos.pricing.pathSalesman.desc") },
  ];
  return (
    <div className="sos-path-grid" role="radiogroup" aria-label={t("shiftos.pricing.choosePath")}>
      {paths.map(({ id, Icon, title, desc }) => {
        const on = track === id;
        return (
          <button key={id} role="radio" aria-checked={on} className={`sos-path${on ? " on" : ""}`} onClick={() => setTrack(id)}>
            <span className="tick"><Check size={13} /></span>
            <div className="sos-icon" style={{ marginBottom: 16, ...(on ? {} : { background: "#f9fafb", borderColor: "#e5e7eb" }) }}>
              <Icon size={20} color={on ? "#dc2626" : "#6b7280"} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 7 }}>{title}</p>
            <p style={{ fontSize: 13, color: on ? "#374151" : "#6b7280", lineHeight: 1.6 }}>{desc}</p>
          </button>
        );
      })}
    </div>
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

  useEffect(() => trackPageView(supabase, "/shiftos", "landing_page_view"), []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("for") === "salesman" || location.hash === "#salesmen") {
      setTrack("salesman");
      setTimeout(() => pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else if (location.hash === "#pricing") {
      setTimeout(() => pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else if (location.hash === "#features") {
      setTimeout(() => featRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else if (location.hash) {
      // Any other in-page anchor (e.g. #feat-inventory from the footer's
      // product links) — scroll to the matching element by id.
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [location.hash, location.search]);

  const scrollTo = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="sos">
      <Helmet>
        <title>ShiftOS — Software Dealer Kereta Malaysia | Used Car DMS &amp; Sistem Urus Stok Kereta</title>
        <meta name="description" content={SEO_DESC} />
        <meta name="keywords" content={SEO_KEYWORDS} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <link rel="canonical" href="https://xdrive.my/shiftos" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ShiftOS — Software Dealer Kereta Malaysia (Used Car DMS)" />
        <meta property="og:description" content={SEO_DESC} />
        <meta property="og:url" content="https://xdrive.my/shiftos" />
        <meta property="og:site_name" content="ShiftOS by XDrive" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ShiftOS — Used Car Dealer Software Malaysia" />
        <meta name="twitter:description" content={SEO_DESC} />
        <script type="application/ld+json">{JSON.stringify(SOFTWARE_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(FAQ_LD)}</script>
      </Helmet>
      <div className="sos-bg" />
      <div className="sos-grid" />
      <ScrollProgress />
      <div className="sos-content">

        {/* ── Nav ── */}
        <nav className="sos-nav">
          <div className="sos-wrap" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo />
            <div className="sos-nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
              {[{ label: t("shiftos.nav.features"), ref: featRef }, { label: t("shiftos.nav.pricing"), ref: pricingRef }].map(({ label, ref }) => (
                <button key={label} onClick={() => scrollTo(ref)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".01em", transition: "color .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{label}</button>
              ))}
              <a href="https://xdrive.my" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{t("shiftos.nav.marketplace")}</a>
              <Link to="/login" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{t("shiftos.nav.login")}</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", background: "rgba(15,23,42,0.03)", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 50, padding: 3 }}>
                <button onClick={toggleLang} aria-label="Switch to English" aria-pressed={isEn} style={{ padding: "3px 10px", borderRadius: 50, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: ".06em", fontFamily: "inherit", background: isEn ? "rgba(220,38,38,0.08)" : "transparent", color: isEn ? "#dc2626" : "rgba(15,23,42,0.4)" }}>EN</button>
                <button onClick={toggleLang} aria-label="Tukar ke Bahasa Malaysia" aria-pressed={!isEn} style={{ padding: "3px 10px", borderRadius: 50, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", letterSpacing: ".06em", fontFamily: "inherit", background: !isEn ? "rgba(220,38,38,0.08)" : "transparent", color: !isEn ? "#dc2626" : "rgba(15,23,42,0.4)" }}>BM</button>
              </div>
              <button onClick={() => scrollTo(pricingRef)} className="sos-btn-primary" style={{ fontSize: 13, padding: "9px 18px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {t("shiftos.nav.startFree")} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <div className="sos-hero-light sos-smudge">
        <section className="sos-wrap" style={{ padding: "92px 24px 72px", textAlign: "center" }}>
          <Reveal>
            <div className="sos-eyebrow" style={{ marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
              {t("shiftos.hero.eyebrow")}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="sos-h sos-hero-h1" style={{ fontSize: 78, color: "#0f172a", margin: "0 auto 22px", maxWidth: 980, lineHeight: 1.02 }}>
              {t("shiftos.hero.title1")}<br />{t("shiftos.hero.title2lead")} <span className="sos-red">{t("shiftos.hero.title2accent")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="sos-hero-sub" style={{ fontSize: 18, fontWeight: 400, color: "#475569", maxWidth: 620, margin: "0 auto 38px", lineHeight: 1.65 }}>
              {t("shiftos.hero.subtitle")}
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="sos-cta-btns" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
              <button onClick={() => scrollTo(pricingRef)} className="sos-btn-primary" style={{ fontSize: 15, padding: "14px 30px", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {t("shiftos.hero.startFree")} <ArrowRight size={16} />
              </button>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ fontSize: 15, padding: "14px 30px" }}>
                <MessageCircle size={16} /> {t("shiftos.hero.talkToUs")}
              </a>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", letterSpacing: ".04em" }}>
              {t("shiftos.hero.trust")}
            </p>
          </Reveal>
          {/* What is actually inside the DMS: dashboard + the screens that answer the pains below */}
          <div style={{ marginTop: 56 }}><HeroShowcase /></div>
        </section>
        </div>

        {/* ── Stats strip ── */}
        <section className="sos-wrap" style={{ paddingBottom: 16 }}>
          <Reveal>
            <div className="sos-glass sos-stats-grid" style={{ overflow: "hidden" }}>
              {[
                { num: "1",       label: t("shiftos.stats.s1") },
                { num: "100%",    label: t("shiftos.stats.s2") },
                { num: "RM0",     label: t("shiftos.stats.s3") },
                { num: "< 30m",   label: t("shiftos.stats.s4") },
              ].map(({ num, label }, i, arr) => (
                <div key={label} style={{ padding: "34px 20px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <p className="sos-h sos-red" style={{ fontSize: 42, marginBottom: 8 }}>{num}</p>
                  <p style={{ fontSize: 12, color: "#6b7280", letterSpacing: ".05em", lineHeight: 1.4, textTransform: "uppercase" }}>{label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <FlowConnector label={t("shiftos.journey.step1")} />

        {/* ── Pain → Solution ── */}
        <section className="sos-wrap" style={{ paddingBottom: 16 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p className="sos-kicker" style={{ marginBottom: 18 }}><b>01</b> {t("shiftos.pain.eyebrow")}</p>
              <h2 className="sos-h" style={{ fontSize: 50, marginBottom: 12 }}>{t("shiftos.pain.title")}</h2>
              <p className="sos-sub">
                {t("shiftos.pain.subtitle")}
              </p>
            </div>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 88 }}>
            {PAIN_SOLUTIONS.map(({ Icon, key }, i) => {
              const Preview = PAIN_PREVIEWS[key];
              return (
                <Reveal key={key}>
                  <div className={`sos-ps${i % 2 ? " rev" : ""}`}>
                    <div className="sos-ps-copy">
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div className="sos-icon" style={{ width: 40, height: 40, borderRadius: 11 }}><Icon size={18} color="#dc2626" /></div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c", textTransform: "uppercase", letterSpacing: ".1em" }}>{t(`shiftos.pain.items.${key}.tag`)}</span>
                      </div>
                      <p style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 12, lineHeight: 1.3, letterSpacing: "-.01em" }}>{t(`shiftos.pain.items.${key}.title`)}</p>
                      <p style={{ fontSize: 14.5, color: "#4b5563", lineHeight: 1.7, marginBottom: 20 }}>{t(`shiftos.pain.items.${key}.desc`)}</p>
                      <p className="sos-ps-quote">
                        <span style={{ display: "block", fontStyle: "normal", fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 6 }}>{t("shiftos.pain.label")}</span>
                        “{t(`shiftos.pain.items.${key}.quote`)}”
                      </p>
                    </div>
                    <div className="sos-ps-stage"><Preview /></div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        <FlowConnector label={t("shiftos.journey.step2")} />

        {/* ── Features ── */}
        <section id="features" ref={featRef} className="sos-wrap" style={{ paddingBottom: 16 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p className="sos-kicker" style={{ marginBottom: 18 }}><b>02</b> {t("shiftos.features.eyebrow")}</p>
              <h2 className="sos-h" style={{ fontSize: 50, marginBottom: 12 }}>{t("shiftos.features.title")}</h2>
              <p className="sos-sub">
                {t("shiftos.features.subtitle")}
              </p>
            </div>
          </Reveal>
          <div className="sos-feat-grid">
            {FEATURES.map(({ Icon, key }, i) => (
              <Reveal key={key} delay={i * 30}>
                <div id={`feat-${key}`} className="sos-glass sos-feat" style={{ padding: 26, height: "100%", scrollMarginTop: 90 }}>
                  <div className="sos-icon" style={{ marginBottom: 18 }}><Icon size={20} color="#dc2626" /></div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 9 }}>{t(`shiftos.features.items.${key}.title`)}</p>
                  <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65 }}>{t(`shiftos.features.items.${key}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <FlowConnector label={t("shiftos.journey.step3")} />

        {/* ── Team roles ── */}
        <section className="sos-wrap" style={{ paddingBottom: 16 }}>
          <Reveal>
            <div className="sos-glass" style={{ padding: "52px 40px", textAlign: "center" }}>
              <p className="sos-kicker" style={{ marginBottom: 18 }}><b>03</b> {t("shiftos.team.title")}</p>
              <h2 className="sos-h" style={{ fontSize: 46, marginBottom: 12 }}>{t("shiftos.team.title")}</h2>
              <p className="sos-sub" style={{ maxWidth: 580, marginBottom: 40 }}>
                {t("shiftos.team.subtitle")}
              </p>
              <div className="sos-roles">
                {TEAM_ROLES.map(({ Icon, key }) => (
                  <div key={key} style={{ padding: "22px 18px", borderRadius: 14, background: "#f9fafb", border: "1px solid #f3f4f6", textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                      <Icon size={18} color="#dc2626" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{t(`shiftos.team.roles.${key}.role`)}</p>
                    <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.55 }}>{t(`shiftos.team.roles.${key}.desc`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <FlowConnector label={t("shiftos.journey.toPricing")} hot />

        {/* ── Pricing — the destination CTA ── */}
        <section id="pricing" ref={pricingRef} className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <p className="sos-kicker" style={{ marginBottom: 18 }}><b>04</b> {t("shiftos.pricing.eyebrow")}</p>
              <h2 className="sos-h" style={{ fontSize: 50, marginBottom: 12 }}>{t("shiftos.pricing.title")}</h2>
              <p className="sos-sub" style={{ maxWidth: 480, marginBottom: 10 }}>
                {t("shiftos.pricing.subtitle")}
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: ".02em", marginTop: 22 }}>
                {t("shiftos.pricing.choosePath")}
              </p>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <PathChooser track={track} setTrack={setTrack} />
          </Reveal>

          <div style={{ maxWidth: track === "salesman" ? 680 : "100%", margin: "0 auto" }}>
            <PricingSection track={track} />
          </div>

          <p style={{ textAlign: "center", color: "#4b5563", fontSize: 13, marginTop: 32 }}>
            {t("shiftos.pricing.needMore")}{" "}
            <a href={WA} target="_blank" rel="noopener noreferrer" style={{ color: "#dc2626", textDecoration: "none", fontWeight: 600 }}>
              {t("shiftos.pricing.talkToTeam")} <ChevronRight size={13} style={{ verticalAlign: "middle", display: "inline-block" }} />
            </a>
          </p>
        </section>

        {/* ── Testimonial ── */}
        <section className="sos-wrap" style={{ maxWidth: 820, paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center" }}>
              <p className="sos-h" aria-hidden="true" style={{ fontSize: 64, color: "#dc2626", lineHeight: 0.6, marginBottom: 14 }}>“</p>
              <p style={{ fontSize: 19, fontStyle: "italic", color: "#1f2937", lineHeight: 1.75, marginBottom: 16 }}>
                “{t("shiftos.testimonial.quote")}”
              </p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>{t("shiftos.testimonial.author")}</p>
            </div>
          </Reveal>
        </section>

        {/* ── Final CTA ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div className="sos-glass sos-smudge" style={{ padding: "68px 40px", textAlign: "center" }}>
              <h2 className="sos-h" style={{ fontSize: 50, marginBottom: 14 }}>{t("shiftos.finalCta.title")}</h2>
              <p style={{ fontSize: 16, color: "#4b5563", maxWidth: 520, margin: "0 auto 38px", lineHeight: 1.65 }}>
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

        {/* ── FAQ (SEO / AEO) ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <style>{`.sos details > summary::-webkit-details-marker{display:none;} .sos details[open] .sos-faq-chev{transform:rotate(180deg);}`}</style>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <p className="sos-kicker" style={{ marginBottom: 18 }}><b>05</b> FAQ</p>
              <h2 className="sos-h" style={{ fontSize: 50, marginBottom: 12 }}>Soalan Lazim</h2>
              <p className="sos-sub">
                Soalan biasa tentang ShiftOS — software dealer kereta Malaysia dan sistem urus stok kereta terpakai untuk dealer &amp; salesman.
              </p>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {FAQS.map((f, i) => (
                <details key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "0 20px" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", padding: "18px 0", fontSize: 15, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                    <span>{f.q}</span>
                    <ChevronDown className="sos-faq-chev" size={16} style={{ flexShrink: 0, color: "#6b7280", transition: "transform .2s" }} />
                  </summary>
                  <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.7, padding: "0 0 20px", margin: 0 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid #e5e7eb", background: "#fff", padding: "48px 24px" }}>
          <div className="sos-wrap sos-footer-inner" style={{ padding: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 32 }}>
            <div>
              <Logo size={28} />
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 12, maxWidth: 280, lineHeight: 1.6 }}>
                {t("shiftos.footer.tagline")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <button onClick={() => scrollTo(featRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>{t("shiftos.footer.features")}</button>
              <button onClick={() => scrollTo(pricingRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>{t("shiftos.footer.pricing")}</button>
              <Link to="/login" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>{t("shiftos.footer.login")}</Link>
              <Link to="/" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>xdrive.my</Link>
            </div>
          </div>
          <div className="sos-wrap" style={{ padding: 0, borderTop: "1px solid #f3f4f6", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontSize: 12, color: "#9ca3af" }}>© {new Date().getFullYear()} {t("shiftos.footer.copyright")}</p>
            <p style={{ fontSize: 12, color: "#9ca3af" }}>{t("shiftos.footer.poweredBy")} <span style={{ color: "#dc2626" }}>XDrive</span></p>
          </div>
        </footer>

      </div>
    </div>
  );
}
