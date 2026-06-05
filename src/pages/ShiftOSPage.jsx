import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, Users, Bot, Globe, MessageCircle, ArrowRight, Check,
  ClipboardCheck, Landmark, BellRing, LineChart, ShieldCheck,
  Receipt, UserCheck, Calculator, Briefcase, ChevronRight, Car,
  Menu, X, ChevronDown, Minus,
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

  /* ── Screenshots grid ── */
  @media(max-width:860px){
    .sos-screenshots{grid-template-columns:1fr!important;}
  }

  /* ── Mobile nav (hamburger) ── */
  .sos-burger{
    display:none;width:42px;height:42px;border-radius:10px;align-items:center;justify-content:center;
    background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);color:#e2e8f0;cursor:pointer;
    transition:background .2s,border-color .2s;flex-shrink:0;
  }
  .sos-burger:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.26);}
  .sos-mobile-menu{
    display:none;flex-direction:column;gap:2px;padding:10px 24px 18px;
    border-top:1px solid rgba(255,255,255,0.07);background:rgba(6,8,15,0.97);
    backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
    animation:sos-menu-in .22s ease;
  }
  @keyframes sos-menu-in{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}
  .sos-mobile-menu a,.sos-mobile-menu button{
    text-align:left;background:none;border:none;color:#cbd5e1;font-family:inherit;font-size:15px;font-weight:500;
    padding:13px 4px;border-radius:8px;cursor:pointer;text-decoration:none;display:block;width:100%;
    border-bottom:1px solid rgba(255,255,255,0.05);
  }
  .sos-mobile-menu a:active,.sos-mobile-menu button:active{color:#fff;}
  .sos-mobile-cta{display:flex;flex-direction:column;gap:10px;margin-top:14px;}
  .sos-mobile-cta a{border-bottom:none!important;padding:0!important;}

  /* ── FAQ accordion ── */
  .sos-faq-item{border-bottom:1px solid rgba(255,255,255,0.08);}
  .sos-faq-item:last-child{border-bottom:none;}
  .sos-faq-q{
    width:100%;display:flex;align-items:center;justify-content:space-between;gap:18px;
    background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;
    padding:22px 4px;color:#f1f5f9;font-size:16px;font-weight:600;line-height:1.4;
  }
  .sos-faq-q:hover{color:#fff;}
  .sos-faq-chev{transition:transform .25s ease;color:#6b7280;flex-shrink:0;}
  .sos-faq-chev.open{transform:rotate(180deg);color:#f87171;}
  .sos-faq-a{
    overflow:hidden;max-height:0;transition:max-height .3s ease,opacity .3s ease,padding .3s ease;opacity:0;
  }
  .sos-faq-a.open{max-height:520px;opacity:1;padding:0 4px 22px;}

  /* ── Comparison table ── */
  .sos-cmp-toggle{
    display:inline-flex;align-items:center;gap:8px;margin:0 auto;
    background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:11px;
    color:#cbd5e1;font-family:inherit;font-size:13px;font-weight:600;padding:11px 22px;cursor:pointer;
    transition:background .2s,border-color .2s;
  }
  .sos-cmp-toggle:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.24);}
  .sos-cmp-wrap{margin-top:24px;border-radius:18px;overflow:hidden;}
  .sos-cmp{width:100%;border-collapse:collapse;font-size:13px;}
  .sos-cmp th,.sos-cmp td{padding:13px 10px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);}
  .sos-cmp thead th{color:#9ca3af;font-size:12px;font-weight:700;letter-spacing:.04em;background:rgba(255,255,255,0.02);}
  .sos-cmp thead th .pcol{display:block;font-family:'Bebas Neue',sans-serif;font-size:19px;letter-spacing:.02em;color:#fff;}
  .sos-cmp th:first-child,.sos-cmp td:first-child{text-align:left;color:#cbd5e1;font-weight:500;}
  .sos-cmp .hl{background:rgba(220,38,38,0.07);}
  .sos-cmp thead th.hl .pcol{color:#fca5a5;}
  .sos-cmp-grp td{
    text-align:left;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
    color:#6b7280;background:rgba(255,255,255,0.03);padding-top:16px;padding-bottom:10px;
  }
  @media(max-width:860px){
    .sos-cmp{font-size:12px;}
    .sos-cmp th,.sos-cmp td{padding:11px 4px;}
    .sos-cmp thead th .pcol{font-size:16px;}
  }

  @media(max-width:860px){
    .sos-burger{display:flex!important;}
    .sos-nav-cta{display:none!important;}
    .sos-mobile-menu.open{display:flex!important;}
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
const PAIN_SOLUTIONS = [
  {
    Icon: Wallet, tag: "Live P&L",
    pain: '"What\'s my real profit on each unit? After recon, commission and transfer costs, I\'ve never actually known."',
    title: "Real per-unit gross profit, automatically",
    desc: "ShiftOS computes front gross (sale − purchase − recon − services − commission − handover costs) AND back gross (F&I add-ons) for every unit. Open the P&L modal and see exactly what each car made — no spreadsheet, no guessing.",
  },
  {
    Icon: ClipboardCheck, tag: "Auto handover",
    pain: '"Once a deal closes, JPJ, Puspakom, loan settlement and road tax are all scattered — a step always slips through."',
    title: "The full Malaysian transfer checklist, seeded the moment a deal is won",
    desc: "Mark a lead won → customer record created + 8-step handover checklist auto-seeded instantly: loan settlement → insurance → Puspakom B5/B7 → JPJ pindah milik → road tax → geran → handover. Every step has the official fee, owner, and due date.",
  },
  {
    Icon: Users, tag: "Accountability",
    pain: '"Salesmen report their own numbers. I can\'t tell who\'s actually productive and who\'s slow to reply to leads."',
    title: "Every lead, enquiry and test drive — auto-logged and attributed",
    desc: "No more trusting unverified WhatsApp screenshots. ShiftOS tracks response time, conversion rate, close rate, and gross per salesman, then ranks the whole team on a quality scorecard the owner can trust.",
  },
  {
    Icon: Landmark, tag: "F&I engine",
    pain: '"I submit loans to banks one at a time with no view of who approves fastest — and back-end revenue just leaks away."',
    title: "Multi-bank HP submission with a live bank approval scorecard",
    desc: "Submit to multiple banks in parallel, track LOU and JPJ status per deal, and see each bank's real approval rate and days-to-decision. Capture F&I add-on revenue as back-end gross on every closed deal.",
  },
  {
    Icon: Globe, tag: "Distribution",
    pain: '"Posting one listing eats half an hour — website, Telegram and TikTok content all done separately."',
    title: "List once — published everywhere in under 5 minutes",
    desc: "Add a car and it auto-publishes to your branded xdrive.my storefront, auto-posts to your Telegram channel, and generates ready-to-post TikTok content slides. Zero copy-paste, zero designer required.",
  },
  {
    Icon: BellRing, tag: "Retention",
    pain: '"A customer buys once and disappears. Road tax and insurance expiries go untracked, so repeat business and referrals vanish."',
    title: "Customer lifecycle that brings buyers back",
    desc: "Full customer record per sale with automatic road-tax and insurance renewal reminders at 30 and 7 days. Sell prepaid service packages, track visits, and turn one-time buyers into recurring revenue.",
  },
];

const FEATURES = [
  { Icon: Car,            kicker: "Inventory & Stock",    title: "Stop aging stock from eating your margin", desc: "Procurement intake, Puspakom B5/B7, recon job cards, encumbrance tracking, a vendor directory, CSV import and days-on-lot aging — so no unit quietly bleeds cash on the lot." },
  { Icon: LineChart,      kicker: "Sales CRM",            title: "Never lose a buyer to a slow reply",       desc: "A Kanban pipeline with lead attribution, appointments, deposit tracking, a deal-sheet generator and stale-lead alerts per salesman keeps every enquiry moving." },
  { Icon: Landmark,       kicker: "F&I & Financing",      title: "Win more loans, leak less back-end",       desc: "Multi-bank HP queue, bank approval scorecards, LOU & JPJ milestones, F&I add-on products and a financing calculator capture every ringgit of back-end gross." },
  { Icon: ClipboardCheck, kicker: "Post-Sale & Handover", title: "No JPJ or Puspakom step ever forgotten",   desc: "An auto-seeded Malaysian transfer checklist with per-step official fees and owner assignments — and the costs flow straight into each unit's P&L." },
  { Icon: Receipt,        kicker: "Documents",            title: "Compliant paperwork in two clicks",        desc: "Sales Agreement, Deposit Receipt and Handover Checklist with proper CPA 1999 output, a manager approval gate, and one-tap email to the buyer." },
  { Icon: Bot,            kicker: "AI Advisor",           title: "Get answers, not more spreadsheets",       desc: 'Ask "which cars have sat too long?" in plain language and get instant, data-backed answers plus lead follow-up suggestions.' },
  { Icon: Wallet,         kicker: "Owner Dashboard",      title: "See your real profit, live",               desc: "Real-time MTD/LMTD revenue and gross, units sold, capital tied up, a 30-day sparkline and goal pace tracking — all on one screen." },
  { Icon: Globe,          kicker: "Storefront & Market",  title: "List once, sell everywhere",               desc: "A branded sub.xdrive.my catalogue, auto-listing on the xdrive.my marketplace, Telegram auto-post and a TikTok slide studio — all from a single upload." },
  { Icon: ShieldCheck,    kicker: "Security & Roles",     title: "Everyone sees only what they should",      desc: "2FA / TOTP, a granular permission matrix, role-scoped dashboards, hardened multi-tenant isolation and log-out-all-devices." },
];

const FAQS = [
  {
    q: "Is my data safe and PDPA-compliant?",
    a: "Yes. ShiftOS is built around Malaysia's Personal Data Protection Act (PDPA), including the 2025 amendments on breach notification and data portability. Your customer and deal data is encrypted in transit and at rest, hosted on secure cloud infrastructure, and locked down by role — salesmen, managers and F&I officers only see what you allow. As the owner, you decide who sees what, and your records stay exportable and under your control at all times.",
  },
  {
    q: "Can I import my existing stock from Excel?",
    a: "Yes. Export your current inventory as a CSV and upload it directly — ShiftOS walks you through mapping your columns (make, model, price, mileage and more) to the right fields, so your whole stock list moves over in minutes. No re-typing, no data-entry team.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "It stays yours. You can export your full inventory, leads and customer records to CSV at any time. After cancellation we keep your data for 30 days so you can reactivate or pull a final export, then it's permanently deleted. No hostage-taking, no hidden lock-in.",
  },
  {
    q: "Does it work on my phone?",
    a: "Completely. ShiftOS is mobile-first and runs in any browser — there's no app to install. Add a listing, reply to a lead or update a JPJ transfer step from your phone on the showroom floor or out at Puspakom.",
  },
  {
    q: "What if I exceed my listing or seat cap?",
    a: "Nothing breaks. You'll get a heads-up as you approach your limit and can upgrade to a higher tier in a couple of clicks — your data and settings carry straight over. You only pay for what your dealership actually needs.",
  },
  {
    q: "How long does onboarding take, and is support in Malay?",
    a: "Most dealers are live the same day — import your stock, invite your team, and you're selling. No IT setup, no installation. Support is in English and Bahasa Malaysia, and the system is built for Malaysian workflows (JPJ pindah milik, Puspakom B5/B7, HP loan submissions), so there's nothing to adapt. No long contracts either — you stay because it works.",
  },
];

// Dealer plan feature comparison — values map 1:1 to PLAN_FEATURES
const COMPARE_GROUPS = [
  {
    group: "Plans & limits",
    rows: [
      { label: "Listings included",      vals: ["30", "60", "150"] },
      { label: "Team seats",             vals: ["3", "8", "15"] },
      { label: "Free trial",             vals: ["14 days", "14 days", "Demo"] },
    ],
  },
  {
    group: "Inventory & sales",
    rows: [
      { label: "Full inventory + per-unit P&L", vals: [true, true, true] },
      { label: "Lead CRM pipeline",             vals: [true, true, true] },
      { label: "Branded storefront + Telegram", vals: [true, true, true] },
      { label: "Document generator (SA / DR / HC)", vals: [true, true, true] },
      { label: "TikTok content studio",         vals: [true, true, true] },
    ],
  },
  {
    group: "Finance & post-sale",
    rows: [
      { label: "F&I module + multi-bank HP",    vals: [false, true, true] },
      { label: "Post-sale handover automation", vals: [false, true, true] },
      { label: "Customer lifecycle + reminders",vals: [false, true, true] },
      { label: "AI performance advisor",        vals: [false, true, true] },
    ],
  },
  {
    group: "Owner & scale",
    rows: [
      { label: "Realtime AI assistant",         vals: [false, false, true] },
      { label: "Owner P&L dashboard + scorecards", vals: [false, false, true] },
      { label: "Full audit trail",              vals: [false, false, true] },
      { label: "Priority onboarding & support", vals: [false, false, true] },
    ],
  },
];

const TEAM_ROLES = [
  { Icon: UserCheck,  role: "Salesman",    desc: "Own pipeline, listings, commissions, referral link." },
  { Icon: Briefcase,  role: "F&I Officer", desc: "HP submissions, bank queue, add-on products." },
  { Icon: Calculator, role: "Accountant",  desc: "Payouts, commission approvals, payroll." },
  { Icon: LineChart,  role: "Manager",     desc: "Team oversight, approvals, full pipeline view." },
  { Icon: ShieldCheck,role: "Admin",       desc: "Settings, seats, integrations, full audit log." },
];

const PLAN_FEATURES = {
  salesman_lite: [
    "Personal storefront — xdrive.my/s/you",
    "Lead & enquiry inbox",
    "Appointment tracking",
    "Stale-lead alerts",
  ],
  salesman_full: [
    "Everything in Lite",
    "Referral link + commission reports",
    "AI lead advisor",
    "HP / loan submission tools",
    "Deal-sheet generator",
  ],
  dealer_starter: [
    "Full inventory + per-unit P&L",
    "Lead CRM pipeline",
    "Branded storefront + Telegram auto-post",
    "Document generator (SA / DR / HC)",
    "TikTok content studio",
  ],
  dealer_growth: [
    "Everything in Starter",
    "F&I module + multi-bank HP",
    "Post-sale handover automation",
    "Customer lifecycle + reminders",
    "AI performance advisor",
  ],
  dealer_pro: [
    "Everything in Growth",
    "Realtime AI assistant (stock, leads, P&L)",
    "Owner P&L dashboard + scorecards",
    "Full audit trail",
    "Priority onboarding & support",
  ],
};

const WA   = "https://wa.me/60174155191?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";
const DEMO = "https://wa.me/60174155191?text=Hi%2C%20I%27d%20like%20to%20book%20a%20ShiftOS%20demo%20for%20my%20dealership";

const PLAN_META = {
  salesman_lite: { cta: "Daftar Percuma", to: "/onboarding/lite",           variant: "outline" },
  salesman_full: { cta: "Mula Sekarang",  to: "/onboarding/premium",        variant: "primary" },
  dealer_starter:{ cta: "Start Free Trial", to: "/onboarding/dealer",         variant: "outline", trial: true },
  dealer_growth: { cta: "Start Free Trial", to: "/onboarding/dealer_growth",  variant: "primary", popular: true, trial: true },
  dealer_pro:    { cta: "Book a Demo",    href: DEMO,                       variant: "gold", sub: "For multi-branch dealers — we'll tailor it" },
};

const SALESMAN_PLANS = ["salesman_lite", "salesman_full"];
const DEALER_PLANS   = ["dealer_starter", "dealer_growth", "dealer_pro"];

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
  const cfg  = PLAN_CONFIG[planKey];
  const meta = PLAN_META[planKey];
  const feats = PLAN_FEATURES[planKey] || [];
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
          MOST POPULAR
        </div>
      )}
      <div style={{ marginBottom: 6, marginTop: isPopular ? 18 : 0 }}>
        <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{cfg.label}</p>
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 58, lineHeight: 1, color: priceCol, letterSpacing: 0 }}>
          {cfg.price === 0 ? "RM0" : `RM${cfg.price}`}
        </span>
        <span style={{ fontSize: 16, color: "#6b7280", marginLeft: 2 }}>/mo</span>
      </div>
      {meta.trial && (
        <p style={{ fontSize: 12, color: "#86efac", fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>
          14 days free, then RM{cfg.price}/mo · no card required
        </p>
      )}
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>
        {cfg.listingCap} listings · {cfg.seatCap} {cfg.seatCap === 1 ? "seat" : "team seats"}
      </p>
      <ul style={{ listStyle: "none", flex: 1, marginBottom: 28 }}>
        {feats.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#cbd5e1", marginBottom: 12, lineHeight: 1.5 }}>
            <Check size={15} color={checkCol} style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
      {meta.variant === "primary" && (
        <Link to={meta.to} className="sos-btn-primary" style={{ justifyContent: "center", fontSize: 14 }}>{meta.cta}</Link>
      )}
      {meta.variant === "outline" && (
        <Link to={meta.to} className="sos-btn-outline" style={{ justifyContent: "center", fontSize: 14 }}>{meta.cta}</Link>
      )}
      {meta.variant === "gold" && (
        <a href={meta.href || meta.to} target={meta.href ? "_blank" : undefined} rel={meta.href ? "noopener noreferrer" : undefined}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 26px", borderRadius: 11, background: "linear-gradient(135deg,#d97706,#92400e)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 20px rgba(180,120,40,0.38),inset 0 1px 0 rgba(255,255,255,0.14)", transition: "transform .15s,box-shadow .15s" }}>{meta.cta}</a>
      )}
      {meta.sub && (
        <p style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 11, lineHeight: 1.45 }}>{meta.sub}</p>
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
  const featRef    = useRef(null);
  const pricingRef = useRef(null);
  const faqRef     = useRef(null);
  const [track, setTrack] = useState("dealer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    document.title = "ShiftOS — The Dealer Management System for Malaysian Car Dealers";
    return () => { document.head.removeChild(s); };
  }, []);

  const scrollTo = useCallback((ref) => {
    setMenuOpen(false);
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
              {[{ label: "Features", ref: featRef }, { label: "Pricing", ref: pricingRef }, { label: "FAQ", ref: faqRef }].map(({ label, ref }) => (
                <button key={label} onClick={() => scrollTo(ref)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".01em", transition: "color .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>{label}</button>
              ))}
              <a href="https://xdrive.my" target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>Marketplace</a>
              <Link to="/login" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}>Log in</Link>
            </div>
            <div className="sos-nav-cta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <a href={DEMO} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ fontSize: 13, padding: "9px 18px" }}>
                Book a Demo
              </a>
              <Link to="/onboarding/dealer" className="sos-btn-primary" style={{ fontSize: 13, padding: "9px 18px" }}>
                Start Free <ArrowRight size={15} />
              </Link>
            </div>
            <button className="sos-burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          <div className={`sos-mobile-menu${menuOpen ? " open" : ""}`}>
            <button onClick={() => scrollTo(featRef)}>Features</button>
            <button onClick={() => scrollTo(pricingRef)}>Pricing</button>
            <button onClick={() => scrollTo(faqRef)}>FAQ</button>
            <a href="https://xdrive.my" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Marketplace</a>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
            <div className="sos-mobile-cta">
              <a href={DEMO} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ justifyContent: "center" }} onClick={() => setMenuOpen(false)}>
                <MessageCircle size={16} /> Book a Demo
              </a>
              <Link to="/onboarding/dealer" className="sos-btn-primary" style={{ justifyContent: "center" }} onClick={() => setMenuOpen(false)}>
                Start Free <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="sos-wrap" style={{ padding: "100px 24px 80px", textAlign: "center" }}>
          <Reveal>
            <div className="sos-eyebrow" style={{ marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
              THE DEALER OS · BUILT FOR MALAYSIA
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="sos-h sos-hero-h1" style={{ fontSize: 80, color: "#fff", margin: "0 auto 24px", maxWidth: 980, lineHeight: 1.02 }}>
              Run Your Entire Dealership<br />From <span className="sos-red">One Dashboard</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="sos-hero-sub" style={{ fontSize: 18, fontWeight: 400, color: "#94a3b8", maxWidth: 620, margin: "0 auto 42px", lineHeight: 1.65 }}>
              Inventory, leads, financing, post-sale transfers and real profit — in a single system built for Malaysian car dealers. Replace Excel, scattered WhatsApp groups and manual paperwork.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="sos-cta-btns" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
              <Link to="/onboarding/dealer" className="sos-btn-primary" style={{ fontSize: 15, padding: "14px 30px" }}>
                Start Free <ArrowRight size={16} />
              </Link>
              <a href={DEMO} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ fontSize: 15, padding: "14px 30px" }}>
                <MessageCircle size={16} /> Book a Demo
              </a>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", letterSpacing: ".04em" }}>
              14-day free trial · No credit card · No contract · Live in 30 minutes
            </p>
          </Reveal>
        </section>

        {/* ── Replaces your toolbox ── */}
        <section className="sos-wrap" style={{ paddingBottom: 88 }}>
          <Reveal>
            <div className="sos-glass" style={{ padding: "44px 32px", textAlign: "center", overflow: "hidden" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#fca5a5", marginBottom: 14 }}>
                One login, not five
              </p>
              <h2 className="sos-h" style={{ fontSize: 36, color: "#fff", marginBottom: 26, lineHeight: 1.08 }}>
                Replaces The Five Tools Your Dealership Juggles Today
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
                {[
                  "Excel stock sheets",
                  "WhatsApp lead chats",
                  "Manual JPJ & Puspakom tracking",
                  "Printed deal paperwork",
                  "Telegram listing posts",
                ].map((t) => (
                  <span key={t} style={{ fontSize: 13, color: "#cbd5e1", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "8px 16px", textDecoration: "line-through", textDecorationColor: "rgba(248,113,113,0.6)", textDecorationThickness: "1.5px" }}>
                    {t}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 22, lineHeight: 1.6 }}>
                All of it, in one system your whole team logs into — no setup fee, no contract, live in under 30 minutes.
              </p>
            </div>
          </Reveal>
        </section>

        {/* ── See It In Action ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>See it in action</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>The Dashboard Your Team Uses Daily</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 480, margin: "0 auto", lineHeight: 1.65 }}>
                Real screens from ShiftOS — not mockups.
              </p>
            </div>
          </Reveal>
          <div className="sos-screenshots" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {[
              { label: "Per-Unit P&L Modal",       caption: "Front gross + back gross per car — sale price minus every cost, calculated automatically.",              badge: "Owner · P&L" },
              { label: "Owner Dashboard",           caption: "MTD revenue, units sold, capital tied up, and goal pace — all in one screen updated in real time.",     badge: "Owner · Analytics" },
              { label: "Sales CRM Pipeline",        caption: "Every lead attributed to a salesman, response time tracked, stale-lead alerts fired automatically.",    badge: "Sales · CRM" },
              { label: "Post-Sale Handover Board",  caption: "Auto-seeded JPJ + Puspakom + road tax checklist the moment a deal is marked won. No step forgotten.",  badge: "Operations · Handover" },
            ].map(({ label, caption, badge }) => (
              <Reveal key={label}>
                <div className="sos-glass" style={{ overflow: "hidden" }}>
                  <div style={{
                    aspectRatio: "16 / 9",
                    background: "rgba(255,255,255,0.02)",
                    border: "2px dashed rgba(220,38,38,0.25)",
                    borderRadius: "18px 18px 0 0",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: 24,
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(220,38,38,0.7)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(220,38,38,0.55)", fontWeight: 600, letterSpacing: "0.04em", textAlign: "center" }}>{label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em", textTransform: "uppercase" }}>screenshot coming soon</p>
                  </div>
                  <div style={{ padding: "16px 22px 20px", background: "rgba(0,0,0,0.18)" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(220,38,38,0.1)", borderRadius: 4, padding: "2px 8px", marginBottom: 8, display: "inline-block" }}>{badge}</span>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginTop: 6 }}>{caption}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Pain → Solution ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>Real problems, solved</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>Every Dealer Hits The Same Walls</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 540, margin: "0 auto", lineHeight: 1.65 }}>
                ShiftOS was built around the problems Malaysian dealers actually lose money to.
              </p>
            </div>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {PAIN_SOLUTIONS.map(({ Icon, tag, pain, title, desc }, i) => (
              <Reveal key={title} delay={i * 40}>
                <div className="sos-glass sos-ps">
                  <div className="sos-ps-l">
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: ".12em" }}>The pain</span>
                    <p style={{ marginTop: 14, fontSize: 15, color: "#cbd5e1", lineHeight: 1.7, fontStyle: "italic" }}>{pain}</p>
                  </div>
                  <div className="sos-ps-r">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div className="sos-icon"><Icon size={20} color="#ef4444" /></div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", textTransform: "uppercase", letterSpacing: ".1em" }}>{tag}</span>
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginBottom: 10, lineHeight: 1.38 }}>{title}</p>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{desc}</p>
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
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>One platform</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>From Stock In To Car Sold</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 540, margin: "0 auto", lineHeight: 1.65 }}>
                A full dealer management system — not a listing site. Everything your team touches, in one place.
              </p>
            </div>
          </Reveal>
          <div className="sos-feat-grid">
            {FEATURES.map(({ Icon, kicker, title, desc }, i) => (
              <Reveal key={title} delay={i * 30}>
                <div className="sos-glass sos-feat" style={{ padding: 26, height: "100%" }}>
                  <div className="sos-icon" style={{ marginBottom: 18 }}><Icon size={20} color="#ef4444" /></div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", letterSpacing: ".11em", textTransform: "uppercase", marginBottom: 8 }}>{kicker}</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 9, lineHeight: 1.32 }}>{title}</p>
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.65 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Team roles ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div className="sos-glass" style={{ padding: "52px 40px", textAlign: "center" }}>
              <h2 className="sos-h" style={{ fontSize: 46, color: "#fff", marginBottom: 12 }}>Built For Your Whole Team</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.65 }}>
                Dealer plans include team seats with scoped dashboards. Everyone sees exactly what they need — nothing more, nothing less.
              </p>
              <div className="sos-roles">
                {TEAM_ROLES.map(({ Icon, role, desc }) => (
                  <div key={role} style={{ padding: "22px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                      <Icon size={18} color="#ef4444" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{role}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>{desc}</p>
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
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>Simple pricing</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>Plans That Scale With You</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.65 }}>
                Start solo or build a full team. No setup fee, no lock-in.
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div className="sos-seg">
                  <button className={track === "dealer" ? "on" : ""} onClick={() => setTrack("dealer")}>For Dealerships</button>
                  <button className={track === "salesman" ? "on" : ""} onClick={() => setTrack("salesman")}>For Salesmen</button>
                </div>
              </div>
            </div>
          </Reveal>

          <div style={{ maxWidth: track === "salesman" ? 680 : "100%", margin: "0 auto" }}>
            <PricingSection track={track} />
          </div>

          {track === "dealer" && (
            <div style={{ textAlign: "center", marginTop: 34 }}>
              <button className="sos-cmp-toggle" onClick={() => setShowCompare((s) => !s)} aria-expanded={showCompare}>
                {showCompare ? "Hide full comparison" : "Compare all features"}
                <ChevronDown size={16} style={{ transform: showCompare ? "rotate(180deg)" : "none", transition: "transform .25s" }} />
              </button>
              {showCompare && (
                <Reveal>
                  <div className="sos-glass sos-cmp-wrap">
                    <table className="sos-cmp">
                      <thead>
                        <tr>
                          <th></th>
                          <th><span className="pcol">Starter</span>RM399/mo</th>
                          <th className="hl"><span className="pcol">Growth</span>RM699/mo</th>
                          <th><span className="pcol">Pro</span>RM999/mo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_GROUPS.map((g) => (
                          <React.Fragment key={g.group}>
                            <tr className="sos-cmp-grp"><td colSpan={4}>{g.group}</td></tr>
                            {g.rows.map((r) => (
                              <tr key={r.label}>
                                <td>{r.label}</td>
                                {r.vals.map((v, idx) => (
                                  <td key={idx} className={idx === 1 ? "hl" : undefined}>
                                    {v === true
                                      ? <Check size={16} color="#4ade80" style={{ verticalAlign: "middle" }} />
                                      : v === false
                                        ? <Minus size={15} color="rgba(255,255,255,0.22)" style={{ verticalAlign: "middle" }} />
                                        : <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{v}</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Reveal>
              )}
            </div>
          )}

          <p style={{ textAlign: "center", color: "#6b7280", fontSize: 13, marginTop: 32 }}>
            Need more than 150 listings or 15 seats?{" "}
            <a href={WA} target="_blank" rel="noopener noreferrer" style={{ color: "#ef4444", textDecoration: "none", fontWeight: 600 }}>
              Talk to our team <ChevronRight size={13} style={{ verticalAlign: "middle" }} />
            </a>
          </p>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" ref={faqRef} className="sos-wrap" style={{ maxWidth: 820, paddingBottom: 96 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div className="sos-eyebrow" style={{ marginBottom: 18 }}>Questions, answered</div>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 12 }}>Before You Sign Up</h2>
              <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>
                The things dealers ask us most. Still unsure?{" "}
                <a href={WA} target="_blank" rel="noopener noreferrer" style={{ color: "#ef4444", textDecoration: "none", fontWeight: 600 }}>Message us on WhatsApp</a>.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="sos-glass" style={{ padding: "6px 26px" }}>
              {FAQS.map(({ q, a }, i) => {
                const open = openFaq === i;
                return (
                  <div key={q} className="sos-faq-item">
                    <button className="sos-faq-q" onClick={() => setOpenFaq(open ? -1 : i)} aria-expanded={open}>
                      {q}
                      <ChevronDown size={20} className={`sos-faq-chev${open ? " open" : ""}`} />
                    </button>
                    <div className={`sos-faq-a${open ? " open" : ""}`}>
                      <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>{a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </section>

        {/* ── Final CTA ── */}
        <section className="sos-wrap" style={{ paddingBottom: 96 }}>
          <Reveal>
            <div className="sos-glass" style={{ padding: "68px 40px", textAlign: "center", background: "radial-gradient(ellipse 800px 400px at 50% -10%, rgba(220,38,38,0.2) 0%, rgba(255,255,255,0.04) 100%)" }}>
              <h2 className="sos-h" style={{ fontSize: 50, color: "#fff", marginBottom: 14 }}>Ready To Scale Your Dealership?</h2>
              <p style={{ fontSize: 16, color: "#94a3b8", maxWidth: 520, margin: "0 auto 38px", lineHeight: 1.65 }}>
                Built for dealers who want real numbers — leaner operations, more sales, and zero guesswork.
              </p>
              <div className="sos-cta-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/onboarding/dealer" className="sos-btn-primary" style={{ fontSize: 15, padding: "15px 34px" }}>
                  Start Free <ArrowRight size={16} />
                </Link>
                <a href={DEMO} target="_blank" rel="noopener noreferrer" className="sos-btn-outline" style={{ fontSize: 15, padding: "15px 34px" }}>
                  <MessageCircle size={16} /> Book a Demo
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
                The dealer management system for Malaysian car dealers.
              </p>
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <button onClick={() => scrollTo(featRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>Features</button>
              <button onClick={() => scrollTo(pricingRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>Pricing</button>
              <button onClick={() => scrollTo(faqRef)} style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>FAQ</button>
              <Link to="/login" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>Log in</Link>
              <Link to="/" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>xdrive.my</Link>
            </div>
          </div>
          <div className="sos-wrap" style={{ padding: 0, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontSize: 12, color: "#4b5563" }}>© {new Date().getFullYear()} ShiftOS. Built for Malaysian dealers.</p>
            <p style={{ fontSize: 12, color: "#4b5563" }}>Powered by <span style={{ color: "#dc2626" }}>XDrive</span></p>
          </div>
        </footer>

      </div>
    </div>
  );
}
