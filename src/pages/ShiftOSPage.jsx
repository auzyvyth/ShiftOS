import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  Wallet,
  Users,
  Bot,
  Globe,
  MessageCircle,
  ArrowRight,
  Check,
  ClipboardCheck,
  Landmark,
  BellRing,
  LineChart,
  Send,
  Video,
  ShieldCheck,
  Receipt,
  UserCheck,
  Calculator,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { PLAN_CONFIG } from "../utils/planConfig";

// ─── Styles ─────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .sos * { box-sizing: border-box; }
  .sos {
    font-family: 'DM Sans', sans-serif;
    background: #05070D;
    min-height: 100vh;
    color: #fff;
    position: relative;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }
  /* Ambient background — pure CSS, zero per-frame JS */
  .sos-bg {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(900px 600px at 18% -5%, rgba(220,38,38,0.16), transparent 60%),
      radial-gradient(800px 600px at 95% 8%, rgba(40,90,200,0.10), transparent 55%),
      #05070D;
  }
  .sos-grid {
    position: fixed; inset: -2px; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 46px 46px;
    -webkit-mask-image: radial-gradient(circle at 50% 22%, #000 0%, transparent 78%);
    mask-image: radial-gradient(circle at 50% 22%, #000 0%, transparent 78%);
    animation: sos-drift 24s linear infinite;
  }
  @keyframes sos-drift { from { background-position: 0 0; } to { background-position: 46px 46px; } }
  @media (prefers-reduced-motion: reduce) { .sos-grid { animation: none; } }

  .sos-content { position: relative; z-index: 1; }
  .sos-wrap { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

  .sos-nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(7,9,16,0.72);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .sos-heading { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
  .sos-red-text {
    background: linear-gradient(135deg,#f87171,#dc2626);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }

  .sos-btn-red {
    background: linear-gradient(135deg,#dc2626,#b91c1c); color:#fff; border:none; border-radius:10px;
    padding:12px 22px; font-family:inherit; font-weight:600; font-size:14px; cursor:pointer;
    display:inline-flex; align-items:center; gap:8px; text-decoration:none;
    transition: transform .15s, box-shadow .15s; box-shadow: 0 4px 18px rgba(220,38,38,0.32);
  }
  .sos-btn-red:hover { transform: translateY(-1px); box-shadow: 0 8px 26px rgba(220,38,38,0.42); }
  .sos-btn-ghost {
    background: rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.14);
    border-radius:10px; padding:12px 22px; font-family:inherit; font-weight:500; font-size:14px;
    cursor:pointer; display:inline-flex; align-items:center; gap:8px; text-decoration:none;
    transition: background .2s, border-color .2s;
  }
  .sos-btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.22); }

  .sos-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px; position: relative; isolation: isolate;
    backdrop-filter: blur(8px);
  }

  .sos-pill {
    display:inline-flex; align-items:center; gap:8px; padding:5px 14px; border-radius:99px;
    font-size:12px; font-weight:500; letter-spacing:.06em;
    background: rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.22); color:#fca5a5;
  }

  /* Pain → Solution rows */
  .sos-ps {
    display:grid; grid-template-columns: 1fr 1.3fr; gap:0; overflow:hidden;
  }
  .sos-ps-pain {
    padding:28px; background: rgba(239,68,68,0.04); border-right:1px solid rgba(255,255,255,0.07);
  }
  .sos-ps-sol { padding:28px; }

  /* Reveal on scroll */
  .sos-reveal { opacity:0; transform: translateY(18px); transition: opacity .6s ease, transform .6s ease; }
  .sos-reveal.in { opacity:1; transform:none; }
  @media (prefers-reduced-motion: reduce) { .sos-reveal { opacity:1; transform:none; } }

  .sos-feat-grid { display:grid; grid-template-columns: repeat(3,1fr); gap:16px; }
  .sos-feat:hover { border-color: rgba(220,38,38,0.34); background: rgba(255,255,255,0.06); }
  .sos-feat { transition: border-color .25s, background .25s, transform .25s; }
  .sos-feat:hover { transform: translateY(-2px); }

  .sos-price-grid { display:grid; gap:18px; }

  .sos-iconbox {
    width:44px; height:44px; border-radius:11px; display:flex; align-items:center; justify-content:center;
    background: rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.2); flex-shrink:0;
  }

  .sos-seg {
    display:inline-flex; padding:4px; border-radius:12px; gap:4px;
    background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
  }
  .sos-seg button {
    border:none; background:transparent; color:#9ca3af; font-family:inherit; font-weight:600;
    font-size:13px; padding:9px 20px; border-radius:9px; cursor:pointer; transition: all .2s;
  }
  .sos-seg button.on { background:#dc2626; color:#fff; box-shadow:0 2px 12px rgba(220,38,38,0.4); }

  @media (max-width: 860px) {
    .sos-feat-grid { grid-template-columns: 1fr; }
    .sos-ps { grid-template-columns: 1fr; }
    .sos-ps-pain { border-right:none; border-bottom:1px solid rgba(255,255,255,0.07); }
    .sos-nav-links { display:none !important; }
    .sos-hero-h1 { font-size: 46px !important; }
    .sos-stats { grid-template-columns: 1fr 1fr !important; }
  }
`;

// ─── Data ───────────────────────────────────────────────────────────────────
const STATS = [
  { num: "1", label: "Dashboard replaces 5+ tools" },
  { num: "100%", label: "Leads & test drives auto-logged" },
  { num: "RM0", label: "Setup fee, no contract" },
  { num: "< 30 min", label: "To go live" },
];

// The genuinely highest-value, most pain-solving capabilities in the product.
const PAIN_SOLUTIONS = [
  {
    Icon: Wallet,
    tag: "Live P&L",
    pain: "“Berapa untung sebenar setiap unit? Lepas tolak recon, komisen, kos transfer — tak pernah tahu betul-betul.”",
    title: "Real per-unit gross profit, automatically",
    desc: "ShiftOS computes front gross (sale − purchase − recon − services − commission − handover costs) AND back gross (F&I add-on revenue) for every car. No spreadsheet, no guessing — open the P&L modal and see exactly what each unit made.",
  },
  {
    Icon: ClipboardCheck,
    tag: "Auto handover",
    pain: "“Lepas deal close, JPJ pindah milik, Puspakom B5/B7, loan settlement, road tax — semua berterabur. Selalu terlupa step.”",
    title: "The full Malaysian transfer flow, seeded the moment a deal is won",
    desc: "Mark a lead won and ShiftOS instantly creates the customer record and a complete handover checklist: loan settlement → insurance → Puspakom B5/B7 → JPJ pindah milik → road tax → geran → handover. Every step has the official fee, owner, and due date.",
  },
  {
    Icon: Users,
    tag: "Accountability",
    pain: "“Salesman report sendiri. Susah nak tahu siapa betul-betul produktif, siapa lambat reply lead.”",
    title: "Every lead, enquiry and test drive — auto-logged and attributed",
    desc: "No more trusting WhatsApp screenshots. ShiftOS tracks response time, conversion rate, close rate, and commission per salesman, then ranks the whole team on a quality scorecard the owner can actually trust.",
  },
  {
    Icon: Landmark,
    tag: "F&I engine",
    pain: "“Hantar loan ke banyak bank satu-satu, manual. Tak nampak bank mana approval rate tinggi. Back-end revenue bocor.”",
    title: "Multi-bank HP submission with a live approval scorecard",
    desc: "Submit to several banks in parallel, track LOU and JPJ status, and see each bank’s real approval rate and days-to-decision. Capture F&I add-on revenue (warranty, coating, insurance) as back-end gross on every deal.",
  },
  {
    Icon: Send,
    tag: "Distribution",
    pain: "“Posting satu listing ambil masa, kena upload ke website, Telegram, buat content TikTok asing-asing.”",
    title: "List once — published everywhere",
    desc: "Add a car once and it auto-publishes to your branded xdrive.my storefront, auto-posts to your Telegram channel, and generates ready-to-post TikTok content slides. Under five minutes, zero copy-paste.",
  },
  {
    Icon: BellRing,
    tag: "Retention",
    pain: "“Customer beli sekali je. Road tax & insurance expiry tak track — repeat business hilang.”",
    title: "Customer lifecycle that brings buyers back",
    desc: "ShiftOS keeps a full customer record per sale and fires automatic road-tax and insurance renewal reminders at 30 and 7 days. Sell prepaid service packages and track visits — turning one-time buyers into recurring revenue.",
  },
];

const FEATURE_GROUPS = [
  {
    Icon: Car,
    title: "Inventory & Stock",
    desc: "Procurement intake, encumbrance & Puspakom tracking, recon job cards, vendor directory, CSV import, days-on-lot aging.",
  },
  {
    Icon: LineChart,
    title: "Sales CRM",
    desc: "Kanban pipeline, lead attribution, appointments, deposit tracking, deal-sheet generator, stale-lead alerts.",
  },
  {
    Icon: Landmark,
    title: "F&I & Financing",
    desc: "Multi-bank HP queue, bank scorecards, LOU & JPJ milestones, F&I add-on products, financing calculator.",
  },
  {
    Icon: ClipboardCheck,
    title: "Post-Sale & Handover",
    desc: "Auto-seeded Malaysian transfer checklist, per-step fees & owners, handover processing costs fed into P&L.",
  },
  {
    Icon: Receipt,
    title: "Documents",
    desc: "Sales Agreement, Deposit Receipt, Handover Checklist — proper CPA 1999 output, approval gate, email to buyer.",
  },
  {
    Icon: Bot,
    title: "AI Advisor",
    desc: "Ask plain questions — “which cars have sat too long?” — and get instant, data-backed answers and lead suggestions.",
  },
  {
    Icon: ShieldCheck,
    title: "Owner Oversight",
    desc: "Real-time MTD/LMTD revenue & gross, units sold, capital tied up, salesman quality ranking, full audit trail.",
  },
  {
    Icon: Globe,
    title: "Storefront & Marketplace",
    desc: "Branded sub.xdrive.my catalog, auto-listing on the xdrive.my marketplace, Telegram auto-post, TikTok studio.",
  },
  {
    Icon: ShieldCheck,
    title: "Security & Roles",
    desc: "2FA, granular permission matrix, scoped dashboards per role, hardened multi-tenant RLS, log-out-all-devices.",
  },
];

const TEAM_ROLES = [
  { Icon: UserCheck, role: "Salesman", desc: "Own pipeline, listings, commissions, referral link." },
  { Icon: Briefcase, role: "F&I Officer", desc: "HP submissions, bank queue, add-on products." },
  { Icon: Calculator, role: "Accountant", desc: "Payouts, commission approvals, payroll." },
  { Icon: LineChart, role: "Manager", desc: "Team oversight, approvals, full pipeline." },
  { Icon: ShieldCheck, role: "Admin", desc: "Settings, seats, integrations, audit log." },
];

// UI-only feature lists per plan; prices/caps come from PLAN_CONFIG.
const PLAN_FEATURES = {
  salesman_lite: [
    "Personal storefront — xdrive.my/s/you",
    "Lead & enquiry inbox",
    "Appointment tracking",
    "Stale-lead alerts",
  ],
  salesman_full: [
    "Everything in Lite",
    "Referral link tracking",
    "Live commission reports",
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
    "Owner oversight P&L dashboard",
    "Salesman quality scorecards",
    "Full audit trail",
    "Priority onboarding & support",
  ],
};

const SALESMAN_PLANS = ["salesman_lite", "salesman_full"];
const DEALER_PLANS = ["dealer_starter", "dealer_growth", "dealer_pro"];
const PLAN_META = {
  salesman_lite: { cta: "Daftar Percuma", to: "/onboarding/lite", accent: "#9ca3af" },
  salesman_full: { cta: "Mula Sekarang", to: "/onboarding/premium", accent: "#dc2626" },
  dealer_starter: { cta: "Get Started", to: "/onboarding/dealer", accent: "#9ca3af" },
  dealer_growth: { cta: "Get Started", to: "/onboarding/dealer", accent: "#dc2626", popular: true },
  dealer_pro: { cta: "Talk to Sales", to: "/onboarding/dealer", accent: "#d4a84b" },
};

const WA_LINK =
  "https://wa.me/60174155191?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

// ─── Reveal hook ──────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, style }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="sos-reveal" style={style}>
      {children}
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────
function PriceCard({ planKey }) {
  const cfg = PLAN_CONFIG[planKey];
  const meta = PLAN_META[planKey];
  const feats = PLAN_FEATURES[planKey] || [];
  const popular = meta.popular;
  const gold = planKey === "dealer_pro";

  return (
    <div
      className="sos-card"
      style={{
        padding: 30,
        display: "flex",
        flexDirection: "column",
        border: popular
          ? "1px solid rgba(220,38,38,0.45)"
          : gold
            ? "1px solid rgba(212,168,75,0.32)"
            : "1px solid rgba(255,255,255,0.09)",
        boxShadow: popular ? "0 8px 40px rgba(220,38,38,0.18)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, minHeight: 22 }}>
        <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600, margin: 0 }}>{cfg.label}</p>
        {popular && (
          <span style={{ fontSize: 10, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", borderRadius: 5, padding: "2px 9px", color: "#fca5a5", letterSpacing: "0.06em", fontWeight: 700 }}>
            MOST POPULAR
          </span>
        )}
      </div>

      <p className="sos-heading" style={{ fontSize: 50, lineHeight: 1, margin: "14px 0 4px", color: gold ? "#d4a84b" : "#fff" }}>
        {cfg.price === 0 ? "RM0" : `RM${cfg.price.toLocaleString("en-MY")}`}
        <span style={{ fontSize: 20, color: "#6b7280" }}>/mo</span>
      </p>

      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 18px" }}>
        {cfg.listingCap} listings · {cfg.seatCap} {cfg.seatCap === 1 ? "seat" : "team seats"}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 26px", flex: 1 }}>
        {feats.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#d1d5db", marginBottom: 11, lineHeight: 1.45 }}>
            <Check size={15} color={gold ? "#d4a84b" : popular ? "#ef4444" : "#6b7280"} style={{ flexShrink: 0, marginTop: 1 }} />
            {f}
          </li>
        ))}
      </ul>

      <Link
        to={meta.to}
        className={meta.accent === "#dc2626" ? "sos-btn-red" : "sos-btn-ghost"}
        style={{
          justifyContent: "center",
          ...(gold ? { background: "linear-gradient(135deg,#b47828,#92600d)", border: "none", color: "#fff", boxShadow: "0 2px 12px rgba(180,120,40,0.3)" } : {}),
        }}
      >
        {meta.cta}
      </Link>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = 34 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "#dc2626", borderRadius: 7, transform: "rotate(6deg)" }} />
        <span style={{ position: "relative", fontFamily: "'Bebas Neue',sans-serif", fontSize: size * 0.52, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>S</span>
      </div>
      <div>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 21, letterSpacing: "0.04em" }} className="sos-red-text">ShiftOS</span>
        <span style={{ display: "block", fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", lineHeight: 1, marginTop: -2 }}>by XDrive</span>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ShiftOSPage() {
  const featuresRef = useRef(null);
  const pricingRef = useRef(null);
  const [track, setTrack] = useState("dealer");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    document.title = "ShiftOS — The Dealer Management System for Malaysian Car Dealers";
    return () => { document.head.removeChild(s); };
  }, []);

  const scrollTo = useCallback((ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const planKeys = track === "dealer" ? DEALER_PLANS : SALESMAN_PLANS;

  return (
    <div className="sos">
      <div className="sos-bg" />
      <div className="sos-grid" />

      <div className="sos-content">
        {/* ── Nav ── */}
        <nav className="sos-nav">
          <div className="sos-wrap" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link to="/shiftos" style={{ textDecoration: "none" }}><Logo /></Link>
            <div className="sos-nav-links" style={{ display: "flex", alignItems: "center", gap: 30 }}>
              {[
                { label: "Features", ref: featuresRef },
                { label: "Pricing", ref: pricingRef },
              ].map(({ label, ref }) => (
                <button key={label} onClick={() => scrollTo(ref)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}>
                  {label}
                </button>
              ))}
              <a href="https://xdrive.my" target="_blank" rel="noopener noreferrer" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}>
                Marketplace
              </a>
              <Link to="/login" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}>
                Log in
              </Link>
            </div>
            <Link to="/onboarding/dealer" className="sos-btn-red" style={{ fontSize: 13, padding: "9px 18px" }}>
              Start Free <ArrowRight size={15} />
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="sos-wrap" style={{ padding: "96px 24px 72px", textAlign: "center" }}>
          <span className="sos-pill" style={{ marginBottom: 26 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
            THE DEALER OS · PENANG · KL · JB
          </span>
          <h1 className="sos-heading sos-hero-h1" style={{ fontSize: 76, lineHeight: 1.02, margin: "0 0 22px", maxWidth: 920, marginInline: "auto" }}>
            Run Your Entire Dealership From <span className="sos-red-text">One Dashboard</span>
          </h1>
          <p style={{ fontSize: 18, fontWeight: 300, color: "#9ca3af", maxWidth: 640, margin: "0 auto 38px", lineHeight: 1.6 }}>
            Inventory, leads, financing, post-sale transfers and real profit — in a single system built for Malaysian car dealers. Replace Excel, scattered WhatsApp groups and manual paperwork.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
            <Link to="/onboarding/dealer" className="sos-btn-red" style={{ fontSize: 15, padding: "13px 28px" }}>
              Start Free <ArrowRight size={16} />
            </Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="sos-btn-ghost" style={{ fontSize: 15, padding: "13px 28px" }}>
              <MessageCircle size={16} /> Talk to Us
            </a>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Setup in 30 minutes · No contract · Cancel anytime
          </p>
        </section>

        {/* ── Stats ── */}
        <section className="sos-wrap" style={{ paddingBottom: 80 }}>
          <div className="sos-card sos-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", overflow: "hidden" }}>
            {STATS.map(({ num, label }, i) => (
              <div key={label} style={{ padding: "32px 20px", textAlign: "center", borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <p className="sos-heading sos-red-text" style={{ fontSize: 40, lineHeight: 1, margin: "0 0 8px" }}>{num}</p>
                <p style={{ fontSize: 12, color: "#6b7280", letterSpacing: "0.04em", margin: 0, lineHeight: 1.4 }}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pain → Solution ── */}
        <section className="sos-wrap" style={{ padding: "20px 24px 90px" }}>
          <Reveal>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
              Real problems, solved
            </p>
            <h2 className="sos-heading" style={{ textAlign: "center", fontSize: 44, margin: "0 0 12px" }}>
              Every Dealer Hits The Same Walls
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 48, maxWidth: 560, marginInline: "auto" }}>
              ShiftOS was built around the problems Malaysian dealers actually lose money to.
            </p>
          </Reveal>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {PAIN_SOLUTIONS.map(({ Icon, tag, pain, title, desc }) => (
              <Reveal key={title}>
                <div className="sos-card sos-ps">
                  <div className="sos-ps-pain">
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.12em" }}>The pain</span>
                    <p style={{ margin: "12px 0 0", fontSize: 16, color: "#cbd5e1", lineHeight: 1.6, fontStyle: "italic" }}>{pain}</p>
                  </div>
                  <div className="sos-ps-sol">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div className="sos-iconbox"><Icon size={20} color="#ef4444" /></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fca5a5", textTransform: "uppercase", letterSpacing: "0.1em" }}>{tag}</span>
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "#fff", lineHeight: 1.35 }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" ref={featuresRef} className="sos-wrap" style={{ padding: "20px 24px 90px" }}>
          <Reveal>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
              One platform
            </p>
            <h2 className="sos-heading" style={{ textAlign: "center", fontSize: 44, margin: "0 0 12px" }}>
              From Stock In To Car Sold
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 48, maxWidth: 560, marginInline: "auto" }}>
              A full dealer management system — not a listing site. Everything your team touches, in one place.
            </p>
          </Reveal>
          <div className="sos-feat-grid">
            {FEATURE_GROUPS.map(({ Icon, title, desc }) => (
              <Reveal key={title}>
                <div className="sos-card sos-feat" style={{ padding: 24, height: "100%" }}>
                  <div className="sos-iconbox" style={{ marginBottom: 16 }}><Icon size={20} color="#ef4444" /></div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>{title}</p>
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Team roles ── */}
        <section className="sos-wrap" style={{ padding: "20px 24px 90px" }}>
          <Reveal>
            <div className="sos-card" style={{ padding: "44px 32px", textAlign: "center" }}>
              <h2 className="sos-heading" style={{ fontSize: 40, margin: "0 0 10px" }}>Built For Your Whole Team</h2>
              <p style={{ color: "#6b7280", fontSize: 15, margin: "0 auto 36px", maxWidth: 600, lineHeight: 1.6 }}>
                Dealer plans include team seats with scoped dashboards. Everyone sees exactly what they need — nothing more.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
                {TEAM_ROLES.map(({ Icon, role, desc }) => (
                  <div key={role} style={{ padding: "20px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <Icon size={22} color="#ef4444" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>{role}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" ref={pricingRef} className="sos-wrap" style={{ padding: "20px 24px 90px" }}>
          <Reveal>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
              Simple pricing
            </p>
            <h2 className="sos-heading" style={{ textAlign: "center", fontSize: 44, margin: "0 0 12px" }}>
              Plans That Scale With You
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 32, maxWidth: 560, marginInline: "auto" }}>
              Start solo or run a full team. No setup fee, no lock-in.
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
              <div className="sos-seg">
                <button className={track === "dealer" ? "on" : ""} onClick={() => setTrack("dealer")}>For Dealerships</button>
                <button className={track === "salesman" ? "on" : ""} onClick={() => setTrack("salesman")}>For Salesmen</button>
              </div>
            </div>
          </Reveal>

          <div className="sos-price-grid" style={{ gridTemplateColumns: `repeat(${planKeys.length},1fr)`, maxWidth: track === "salesman" ? 720 : "100%", marginInline: "auto" }}>
            {planKeys.map((k) => <PriceCard key={k} planKey={k} />)}
          </div>

          <p style={{ textAlign: "center", color: "#4b5563", fontSize: 13, marginTop: 28 }}>
            Need more than 150 listings or 15 seats?{" "}
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" style={{ color: "#ef4444", textDecoration: "none", fontWeight: 600 }}>
              Talk to our team <ChevronRight size={13} style={{ verticalAlign: "middle" }} />
            </a>
          </p>
        </section>

        {/* ── Testimonial ── */}
        <section className="sos-wrap" style={{ padding: "0 24px 90px", maxWidth: 800 }}>
          <Reveal>
            <div style={{ borderLeft: "3px solid #dc2626", paddingLeft: 28 }}>
              <p style={{ fontSize: 19, fontStyle: "italic", color: "#cbd5e1", lineHeight: 1.7, margin: "0 0 14px" }}>
                “Dulu semua dalam Excel dan WhatsApp. Sekarang salesman boleh check stok sendiri, owner nampak untung setiap kereta, dan tak ada lagi paperwork JPJ yang terlupa.”
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>— Dealer, Penang</p>
            </div>
          </Reveal>
        </section>

        {/* ── Final CTA ── */}
        <section className="sos-wrap" style={{ padding: "0 24px 90px" }}>
          <Reveal>
            <div className="sos-card" style={{ padding: "60px 40px", textAlign: "center", background: "radial-gradient(700px 400px at 50% -20%, rgba(220,38,38,0.16), rgba(255,255,255,0.04))" }}>
              <h2 className="sos-heading" style={{ fontSize: 46, margin: "0 0 14px" }}>Ready To Scale Your Dealership?</h2>
              <p style={{ fontSize: 16, color: "#9ca3af", margin: "0 auto 34px", maxWidth: 520, lineHeight: 1.6 }}>
                Join the dealers running leaner, selling more, and finally knowing their real numbers.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/onboarding/dealer" className="sos-btn-red" style={{ fontSize: 15, padding: "14px 30px" }}>
                  Start Free <ArrowRight size={16} />
                </Link>
                <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="sos-btn-ghost" style={{ fontSize: 15, padding: "14px 30px" }}>
                  <MessageCircle size={16} /> WhatsApp Us
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 24px" }}>
          <div className="sos-wrap" style={{ padding: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 28 }}>
              <div>
                <Logo size={28} />
                <p style={{ fontSize: 12, color: "#4b5563", marginTop: 10, maxWidth: 280, lineHeight: 1.5 }}>
                  The dealer management system for Malaysian car dealers.
                </p>
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <button onClick={() => scrollTo(featuresRef)} style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Features</button>
                <button onClick={() => scrollTo(pricingRef)} style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Pricing</button>
                <Link to="/login" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Log in</Link>
                <Link to="/" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>xdrive.my</Link>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>© {new Date().getFullYear()} ShiftOS. Built for Malaysian dealers.</p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>Powered by <span style={{ color: "#ef4444" }}>XDrive</span></p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
