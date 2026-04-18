import React, { useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  BarChart2,
  Video,
  Users,
  Bot,
  Globe,
  MessageCircle,
  ArrowRight,
  Check,
  AlertCircle,
  Zap,
  Send,
  ChevronDown,
} from "lucide-react";

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .shiftos-page * { box-sizing: border-box; }
  .shiftos-page {
    font-family: 'DM Sans', sans-serif;
    background: #04060A;
    min-height: 100vh;
    color: white;
    position: relative;
  }
  .shiftos-content { position: relative; z-index: 1; }
  .shiftos-glass {
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
  }
  .shiftos-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(8,10,20,0.5);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    box-shadow: inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(255,255,255,0.06);
  }
  .shiftos-btn-red {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    transition: opacity 0.2s;
    box-shadow: 0 2px 12px rgba(220,38,38,0.3);
  }
  .shiftos-btn-red:hover { opacity: 0.88; }
  .shiftos-btn-ghost {
    background: rgba(255,255,255,0.06);
    color: white;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 10px 20px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    transition: background 0.2s;
  }
  .shiftos-btn-ghost:hover { background: rgba(255,255,255,0.1); }
  .shiftos-feature-card {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 16px;
    padding: 24px;
    transition: border-color 0.25s, background 0.25s;
    position: relative;
    isolation: isolate;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 24px rgba(0,0,0,0.3);
  }
  .shiftos-feature-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, rgba(255,255,255,0.08) 0%, transparent 50%);
    pointer-events: none;
  }
  .shiftos-feature-card:hover {
    border-color: rgba(220,38,38,0.35);
    background: rgba(255,255,255,0.09);
  }
  .shiftos-pain-card {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid rgba(255,255,255,0.13);
    border-radius: 16px;
    padding: 28px 24px;
    position: relative;
    isolation: isolate;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.13), 0 4px 20px rgba(0,0,0,0.28);
  }
  .shiftos-pain-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, rgba(255,255,255,0.07) 0%, transparent 50%);
    pointer-events: none;
  }
  .shiftos-heading {
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 0.02em;
  }
  .shiftos-red-text {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .shiftos-pricing-card {
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    isolation: isolate;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.13), 0 8px 32px rgba(0,0,0,0.35);
  }
  .shiftos-pricing-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, rgba(255,255,255,0.08) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }
  .shiftos-pricing-card::after {
    content: '';
    position: absolute;
    top: -60%;
    left: -60%;
    width: 60%;
    height: 220%;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
    animation: pricing-shine 3.6s ease-in-out infinite;
    pointer-events: none;
  }
  .shiftos-pricing-card.gold::after {
    background: linear-gradient(105deg, transparent 40%, rgba(212,168,75,0.10) 50%, transparent 60%);
    animation-delay: 1.8s;
  }
  @keyframes pricing-shine {
    0%   { left: -60%; }
    50%  { left: 130%; }
    100% { left: 130%; }
  }
  .shiftos-liquid {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid rgba(255,255,255,0.13);
    border-radius: 16px;
    position: relative;
    isolation: isolate;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.13), 0 4px 24px rgba(0,0,0,0.3);
  }
  .shiftos-liquid::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 55%, transparent 100%);
    pointer-events: none;
    z-index: 0;
  }
  @media (max-width: 768px) {
    .shiftos-features-grid { grid-template-columns: 1fr !important; }
    .shiftos-pricing-grid  { grid-template-columns: 1fr !important; }
    .shiftos-pain-grid     { grid-template-columns: 1fr !important; }
    .shiftos-stats-grid    { grid-template-columns: 1fr 1fr !important; }
    .shiftos-nav-links     { display: none !important; }
    .shiftos-hero-h1       { font-size: 52px !important; }
  }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────
const PAIN_EMOJIS = [
  ["😤", "🤯", "📋"],
  ["📊", "💸", "😬"],
  ["🎬", "😩", "⏰"],
];

const PAIN_POINTS = [
  {
    Icon: AlertCircle,
    title: "Masih post listing satu-satu?",
    desc: "Auto-post ke Telegram channel dan TikTok the moment you go live. No extra steps.",
  },
  {
    Icon: BarChart2,
    title: "Tak tahu salesman mana yang close deal?",
    desc: "Every referral link is tracked. See clicks, leads, and conversions per salesman — live.",
  },
  {
    Icon: Video,
    title: "Buyer tanya pastu hilang?",
    desc: "All WhatsApp enquiries in one inbox. AI advisor tells you which cars to push and who to follow up.",
  },
];

const FEATURES = [
  {
    Icon: Car,
    title: "Stok Tracker",
    desc: "Add, edit, and track every unit. Full history, pricing, photos, and status in one place. No more Excel.",
  },
  {
    Icon: Video,
    title: "TikTok Content Studio",
    desc: "Generate branded slides for any listing and export in one click. Post-ready content without a designer.",
  },
  {
    Icon: Send,
    title: "Telegram Auto-Post",
    desc: "New listings hit your Telegram channel automatically the moment they go live. Zero manual work.",
  },
  {
    Icon: Users,
    title: "Salesman Panel",
    desc: "Unique referral links, live commission tracking, appointments, and lead attribution per salesman.",
  },
  {
    Icon: Bot,
    title: "AI Performance Advisor",
    desc: "Ask plain questions like 'which cars have been sitting too long?' and get instant, data-backed answers.",
  },
  {
    Icon: Globe,
    title: "xdrive.my Marketplace",
    desc: "Your listings automatically appear on xdrive.my — reaching buyers across Malaysia without extra work.",
  },
];

const STATS = [
  { num: "100%", label: "Automated listing workflow" },
  { num: "1 Dashboard", label: "Replaces 4-5 tools" },
  { num: "< 5 min", label: "To list a new car" },
  { num: "1", label: "Dashboard for everything" },
];

const FOUNDING_FEATURES = [
  "Unlimited car listings",
  "TikTok Content Studio",
  "Telegram Auto-Post",
  "Salesman Panel + referral tracking",
  "AI Performance Advisor",
  "xdrive.my marketplace listing",
  "WhatsApp Enquiry Inbox",
  "Priority onboarding support",
];

const MONTHLY_FEATURES = [
  "Full dashboard access",
  "Unlimited listings",
  "Team & salesman management",
  "TikTok content studio",
  "AI performance advisor",
];

// ─── Emoji burst helper ───────────────────────────────────────────────────────
function spawnEmojis(container, emojis) {
  if (!document.getElementById("sos-emoji-kf")) {
    const s = document.createElement("style");
    s.id = "sos-emoji-kf";
    s.textContent =
      "@keyframes sos-emoji-burst{0%{opacity:1;transform:translate(0,0) scale(1.3)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0.4)}}";
    document.head.appendChild(s);
  }
  const count = 9;
  for (let i = 0; i < count; i++) {
    const emoji = emojis[i % emojis.length];
    const angle =
      (Math.PI * 2 * i) / count - Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    const radial = 50 + Math.random() * 50;
    const extraUp = 60 + Math.random() * 40;
    const dx = Math.round(Math.cos(angle) * radial);
    const dy = Math.round(Math.sin(angle) * radial - extraUp);
    const el = document.createElement("div");
    el.setAttribute("data-sos-emoji", "1");
    el.textContent = emoji;
    Object.assign(el.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      marginLeft: "-11px",
      marginTop: "-11px",
      fontSize: "22px",
      pointerEvents: "none",
      zIndex: "10",
      animation: `sos-emoji-burst 900ms ease-out ${i * 50}ms forwards`,
    });
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 960 + i * 50);
  }
}

// ─── Network Animation ────────────────────────────────────────────────────────
function NetworkAnimation() {
  const svgRef = useRef(null);
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const lPaths = [...svg.querySelectorAll(".sos-lp")];
    const rPaths = [...svg.querySelectorAll(".sos-rp")];
    const ballLayer = svg.querySelector(".sos-balls");

    const entries = [
      ...lPaths.flatMap((p, i) => [
        { p, t: i * 0.25, spd: 0.0028 + i * 0.0003, side: "L" },
        { p, t: (i * 0.25 + 0.5) % 1, spd: 0.0028 + i * 0.0003, side: "L" },
      ]),
      ...rPaths.flatMap((p, i) => [
        { p, t: i * 0.25, spd: 0.0025 + i * 0.0003, side: "R" },
        { p, t: (i * 0.25 + 0.5) % 1, spd: 0.0025 + i * 0.0003, side: "R" },
      ]),
    ];

    const circles = entries.map((e) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", "4");
      c.setAttribute("filter", `url(#sos-glow-${e.side === "L" ? "red" : "blue"})`);
      ballLayer.appendChild(c);
      return c;
    });

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      entries.forEach((e, i) => {
        e.t = (e.t + e.spd) % 1;
        const len = e.p.getTotalLength();
        const pt = e.p.getPointAtLength(e.t * len);
        const t = e.t;
        const op = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1;
        circles[i].setAttribute("cx", pt.x);
        circles[i].setAttribute("cy", pt.y);
        circles[i].setAttribute("fill", e.side === "L" ? "#dc2626" : "#4a90d9");
        circles[i].setAttribute("opacity", op.toFixed(3));
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ballLayer.innerHTML = "";
    };
  }, [isMobile]);

  const lPills = ["Stock Units", "Walk-in Leads", "WhatsApp Enquiries", "Test Drive Bookings"];
  const rPills = ["Car Listings", "TikTok Content", "Documents", "Analytics"];

  const svgDefs = (
    <defs>
      <filter id="sos-glow-red">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="sos-glow-blue">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );

  if (isMobile) {
    const mLCX = 64, mRCX = 296;
    const mPillW = 116, mPillH = 28;
    const mHubCX = 180, mHubCY = 200, mHubW = 92, mHubH = 46;
    const mYs = [82, 152, 224, 296];
    const mLRX = mLCX + mPillW / 2;
    const mRLX = mRCX - mPillW / 2;
    const mHLX = mHubCX - mHubW / 2;
    const mHRX = mHubCX + mHubW / 2;

    return (
      <div style={{ width: "100%", margin: "0 auto 8px" }}>
        <svg ref={svgRef} viewBox="0 0 360 378" width="100%" style={{ display: "block" }}>
          {svgDefs}

          <text x={mLCX} y={30} textAnchor="middle" fill="#374151" fontSize="8" fontFamily="'DM Sans',sans-serif" letterSpacing="2">INPUTS</text>
          <text x={mRCX} y={30} textAnchor="middle" fill="#374151" fontSize="8" fontFamily="'DM Sans',sans-serif" letterSpacing="2">OUTPUTS</text>

          {mYs.map((y, i) => (
            <path key={`lp${i}`} className="sos-lp"
              d={`M ${mLRX} ${y} C ${mLRX + 48} ${y} ${mHLX} ${mHubCY} ${mHLX} ${mHubCY}`}
              fill="none" stroke="rgba(220,38,38,0.22)" strokeWidth="1.5" strokeDasharray="4 4" />
          ))}

          {mYs.map((y, i) => (
            <path key={`rp${i}`} className="sos-rp"
              d={`M ${mHRX} ${mHubCY} C ${mHRX} ${y} ${mRLX - 48} ${y} ${mRLX} ${y}`}
              fill="none" stroke="rgba(74,144,217,0.22)" strokeWidth="1.5" strokeDasharray="4 4" />
          ))}

          {lPills.map((label, i) => (
            <g key={`lpill${i}`}>
              <rect x={mLCX - mPillW / 2} y={mYs[i] - mPillH / 2} width={mPillW} height={mPillH} rx={mPillH / 2}
                fill="rgba(220,38,38,0.07)" stroke="rgba(220,38,38,0.3)" strokeWidth="1" />
              <text x={mLCX} y={mYs[i] + 1} textAnchor="middle" dominantBaseline="middle"
                fill="#fca5a5" fontSize="8.5" fontFamily="'DM Sans',sans-serif" fontWeight="500">{label}</text>
            </g>
          ))}

          {rPills.map((label, i) => (
            <g key={`rpill${i}`}>
              <rect x={mRCX - mPillW / 2} y={mYs[i] - mPillH / 2} width={mPillW} height={mPillH} rx={mPillH / 2}
                fill="rgba(74,144,217,0.07)" stroke="rgba(74,144,217,0.3)" strokeWidth="1" />
              <text x={mRCX} y={mYs[i] + 1} textAnchor="middle" dominantBaseline="middle"
                fill="#93c5fd" fontSize="8.5" fontFamily="'DM Sans',sans-serif" fontWeight="500">{label}</text>
            </g>
          ))}

          <rect x={mHLX} y={mHubCY - mHubH / 2} width={mHubW} height={mHubH} rx="8"
            fill="rgba(220,38,38,0.1)" stroke="rgba(220,38,38,0.5)" strokeWidth="1.5" />
          <text x={mHubCX} y={mHubCY - 7} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="13" fontFamily="'Bebas Neue',sans-serif" letterSpacing="2">ShiftOS</text>
          <text x={mHubCX} y={mHubCY + 11} textAnchor="middle" dominantBaseline="middle"
            fill="#6b7280" fontSize="8" fontFamily="'DM Sans',sans-serif">by XDrive</text>

          <g className="sos-balls" />
        </svg>
      </div>
    );
  }

  const ys = [75, 165, 255, 345];
  const lCX = 150, rCX = 750;
  const pillW = 148, pillH = 30;
  const hubCX = 450, hubCY = 210;
  const hubW = 110, hubH = 50;
  const lRX = lCX + pillW / 2;
  const rLX = rCX - pillW / 2;
  const hLX = hubCX - hubW / 2;
  const hRX = hubCX + hubW / 2;

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto 8px" }}>
      <svg ref={svgRef} viewBox="0 0 900 420" width="100%" style={{ display: "block" }}>
        {svgDefs}

        <text x={lCX} y={28} textAnchor="middle" fill="#374151" fontSize="9" fontFamily="'DM Sans',sans-serif" letterSpacing="2">INPUTS</text>
        <text x={rCX} y={28} textAnchor="middle" fill="#374151" fontSize="9" fontFamily="'DM Sans',sans-serif" letterSpacing="2">OUTPUTS</text>

        {ys.map((y, i) => (
          <path key={`lp${i}`} className="sos-lp"
            d={`M ${lRX} ${y} C ${lRX + 86} ${y} ${hLX} ${hubCY} ${hLX} ${hubCY}`}
            fill="none" stroke="rgba(220,38,38,0.22)" strokeWidth="1.5" strokeDasharray="5 5" />
        ))}

        {ys.map((y, i) => (
          <path key={`rp${i}`} className="sos-rp"
            d={`M ${hRX} ${hubCY} C ${hRX} ${y} ${rLX - 86} ${y} ${rLX} ${y}`}
            fill="none" stroke="rgba(74,144,217,0.22)" strokeWidth="1.5" strokeDasharray="5 5" />
        ))}

        {lPills.map((label, i) => (
          <g key={`lpill${i}`}>
            <rect x={lCX - pillW / 2} y={ys[i] - pillH / 2} width={pillW} height={pillH} rx={pillH / 2}
              fill="rgba(220,38,38,0.07)" stroke="rgba(220,38,38,0.3)" strokeWidth="1" />
            <text x={lCX} y={ys[i] + 1} textAnchor="middle" dominantBaseline="middle"
              fill="#fca5a5" fontSize="11" fontFamily="'DM Sans',sans-serif" fontWeight="500">{label}</text>
          </g>
        ))}

        {rPills.map((label, i) => (
          <g key={`rpill${i}`}>
            <rect x={rCX - pillW / 2} y={ys[i] - pillH / 2} width={pillW} height={pillH} rx={pillH / 2}
              fill="rgba(74,144,217,0.07)" stroke="rgba(74,144,217,0.3)" strokeWidth="1" />
            <text x={rCX} y={ys[i] + 1} textAnchor="middle" dominantBaseline="middle"
              fill="#93c5fd" fontSize="11" fontFamily="'DM Sans',sans-serif" fontWeight="500">{label}</text>
          </g>
        ))}

        <rect x={hLX} y={hubCY - hubH / 2} width={hubW} height={hubH} rx="8"
          fill="rgba(220,38,38,0.1)" stroke="rgba(220,38,38,0.5)" strokeWidth="1.5" />
        <text x={hubCX} y={hubCY - 7} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="14" fontFamily="'Bebas Neue',sans-serif" letterSpacing="2">ShiftOS</text>
        <text x={hubCX} y={hubCY + 11} textAnchor="middle" dominantBaseline="middle"
          fill="#6b7280" fontSize="9" fontFamily="'DM Sans',sans-serif">by XDrive</text>

        <g className="sos-balls" />
      </svg>
    </div>
  );
}

// ─── Pain Card ────────────────────────────────────────────────────────────────
function PainCard({ Icon, title, desc, emojis }) {
  const cardRef = useRef(null);
  const triggered = useRef(false);
  const cooldown = useRef(false);

  const burst = useCallback(() => {
    if (!cardRef.current || cooldown.current) return;
    cooldown.current = true;
    spawnEmojis(cardRef.current, emojis);
    setTimeout(() => { cooldown.current = false; }, 1100);
  }, [emojis]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (window.innerWidth >= 768) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          burst();
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(card);
    return () => obs.disconnect();
  }, [burst]);

  return (
    <div
      ref={cardRef}
      className="shiftos-pain-card"
      style={{ overflow: "visible" }}
      onMouseEnter={() => { if (window.innerWidth >= 768) burst(); }}
      onMouseLeave={() => {
        cardRef.current?.querySelectorAll("[data-sos-emoji]").forEach((el) => el.remove());
      }}
    >
      <div style={{ width:40, height:40, borderRadius:8, background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.15)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
        <Icon size={18} color="#ef4444" />
      </div>
      <p style={{ fontSize:15, fontWeight:600, marginBottom:8, color:"white", lineHeight:1.4 }}>{title}</p>
      <p style={{ fontSize:13, color:"#6b7280", lineHeight:1.6, margin:0 }}>{desc}</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShiftOSPage() {
  const featuresRef = useRef(null);
  const pricingRef = useRef(null);
  const contactRef = useRef(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    document.title = "ShiftOS — The Operating System for Malaysian Car Dealers";

    // ── Dot-grid canvas ───────────────────────────────────────────────────────
    const cv = document.getElementById("shiftos-bg");
    if (!cv) return () => document.head.removeChild(s);
    const ctx = cv.getContext("2d");

    const GAP = 28;
    let W, H, cols, rows;
    let mouse = { x: -9999, y: -9999 };

    const resize = () => {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
      cols = Math.ceil(W / GAP) + 1;
      rows = Math.ceil(H / GAP) + 1;
    };
    resize();

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", resize);

    // 4 scanlines
    const scanlines = [0.15, 0.38, 0.62, 0.85].map((frac) => ({
      y: frac * window.innerHeight,
      speed: 18 + Math.random() * 12,
    }));

    let t = 0;
    let rafId;

    function draw() {
      rafId = requestAnimationFrame(draw);
      t += 0.016;

      ctx.fillStyle = "#04060A";
      ctx.fillRect(0, 0, W, H);

      // Dot grid with wave + proximity
      const PROX = 110;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bx = c * GAP;
          const wave = Math.sin(t * 1.1 + c * 0.22 + r * 0.18) * 4;
          const by = r * GAP + wave;
          const dx = bx - mouse.x;
          const dy = by - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < PROX) {
            const ratio = 1 - dist / PROX;
            const rad = 1.5 + ratio * 3.5;
            const bloom = ctx.createRadialGradient(
              bx,
              by,
              0,
              bx,
              by,
              rad * 2.5,
            );
            bloom.addColorStop(0, `rgba(220,38,38,${0.85 * ratio})`);
            bloom.addColorStop(1, "rgba(220,38,38,0)");
            ctx.fillStyle = bloom;
            ctx.beginPath();
            ctx.arc(bx, by, rad * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,${80 + Math.round(ratio * 80)},${80 + Math.round(ratio * 40)},${0.9 * ratio + 0.2})`;
            ctx.beginPath();
            ctx.arc(bx, by, rad, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.13)";
            ctx.beginPath();
            ctx.arc(bx, by, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Scanlines
      for (const sl of scanlines) {
        sl.y += sl.speed * 0.016;
        if (sl.y > H + 20) sl.y = -20;
        const sg = ctx.createLinearGradient(0, sl.y - 6, 0, sl.y + 6);
        sg.addColorStop(0, "rgba(220,38,38,0)");
        sg.addColorStop(0.5, "rgba(220,38,38,0.06)");
        sg.addColorStop(1, "rgba(220,38,38,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(0, sl.y - 6, W, 12);
      }
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      document.head.removeChild(s);
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const waLink =
    "https://wa.me/60174155191?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

  return (
    <div className="shiftos-page">
      <canvas
        id="shiftos-bg"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div className="shiftos-content">
        {/* ── Navbar ── */}
        <nav className="shiftos-nav">
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "0 24px",
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Logo */}
            <Link
              to="/shiftos"
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#dc2626",
                    borderRadius: 6,
                    transform: "rotate(6deg)",
                  }}
                />
                <span
                  style={{
                    position: "relative",
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 18,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  S
                </span>
              </div>
              <div>
                <span
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 20,
                    letterSpacing: "0.05em",
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  ShiftOS
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#6b7280",
                    letterSpacing: "0.1em",
                    lineHeight: 1,
                    marginTop: -2,
                  }}
                >
                  by XDrive
                </span>
              </div>
            </Link>

            {/* Links */}
            <div
              className="shiftos-nav-links"
              style={{ display: "flex", alignItems: "center", gap: 28 }}
            >
              {[
                { label: "Features", ref: featuresRef },
                { label: "Pricing", ref: pricingRef },
                { label: "Contact", ref: contactRef },
              ].map(({ label, ref }) => (
                <button
                  key={label}
                  onClick={() => scrollTo(ref)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#9ca3af",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    padding: 0,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#9ca3af")
                  }
                >
                  {label}
                </button>
              ))}
              <a
                href="https://xdrive.my"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#9ca3af",
                  fontSize: 14,
                  textDecoration: "none",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                Marketplace
              </a>
            </div>

            {/* CTA */}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shiftos-btn-red"
              style={{ fontSize: 13, padding: "8px 16px" }}
            >
              WhatsApp Us
            </a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "100px 24px 80px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.2)",
              borderRadius: 20,
              padding: "4px 14px",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ef4444",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#ef4444",
                fontWeight: 500,
                letterSpacing: "0.08em",
              }}
            >
              LIVE · PENANG · KL · JB
            </span>
          </div>

          <h1
            className="shiftos-heading shiftos-hero-h1"
            style={{
              fontSize: 72,
              lineHeight: 1.05,
              margin: "0 0 24px",
              color: "white",
            }}
          >
            Jual Lebih Banyak Kereta.{" "}
            <span className="shiftos-red-text">Urus Semua</span> Dalam Satu Tempat.
          </h1>

          <p
            style={{
              fontSize: 18,
              fontWeight: 300,
              color: "#9ca3af",
              maxWidth: 620,
              margin: "0 auto 40px",
              lineHeight: 1.6,
            }}
          >
            ShiftOS replaces your WhatsApp groups, Excel sheets, and manual
            posting — one dashboard built for Malaysian independent used car
            dealers.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 40,
            }}
          >
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shiftos-btn-red"
              style={{ fontSize: 15, padding: "12px 28px" }}
            >
              <MessageCircle size={16} /> Cuba Percuma — Tanpa Kad Kredit
            </a>
            <button
              onClick={() => scrollTo(featuresRef)}
              className="shiftos-btn-ghost"
              style={{ fontSize: 15, padding: "12px 28px" }}
            >
              Tengok Demo <ChevronDown size={16} />
            </button>
          </div>

          <NetworkAnimation />

          <p
            style={{ fontSize: 12, color: "#4b5563", letterSpacing: "0.08em" }}
          >
            Digunakan oleh dealer di Penang, KL & Johor
          </p>
        </section>

        {/* ── Pain Points ── */}
        <section
          style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}
        >
          <h2
            style={{
              textAlign: "center",
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Sound familiar?
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: 15,
              marginBottom: 48,
            }}
          >
            Every independent dealer runs into the same walls.
          </p>
          <div
            className="shiftos-pain-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 16,
            }}
          >
            {PAIN_POINTS.map(({ Icon, title, desc }, i) => (
              <PainCard key={title} Icon={Icon} title={title} desc={desc} emojis={PAIN_EMOJIS[i]} />
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section
          id="features"
          ref={featuresRef}
          style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}
        >
          <h2
            style={{
              textAlign: "center",
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Dari stok masuk sampai kereta sold — semua dalam ShiftOS.
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: 15,
              marginBottom: 52,
            }}
          >
            SEMUA YANG DEALER PERLUKAN
          </p>
          <div
            className="shiftos-features-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 16,
            }}
          >
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="shiftos-feature-card">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <Icon size={18} color="#ef4444" />
                </div>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "white",
                    marginBottom: 8,
                  }}
                >
                  {title}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats Strip ── */}
        <section style={{ padding: "0 24px 80px" }}>
          <div
            className="shiftos-liquid"
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
            <div
              className="shiftos-stats-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}
            >
              {STATS.map(({ num, label }, i) => (
                <div
                  key={label}
                  style={{
                    padding: "36px 24px",
                    textAlign: "center",
                    borderRight:
                      i < STATS.length - 1
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "none",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 40,
                      lineHeight: 1,
                      margin: "0 0 8px",
                      background: "linear-gradient(135deg,#f87171,#dc2626)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {num}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      letterSpacing: "0.06em",
                      margin: 0,
                    }}
                  >
                    {label.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          ref={pricingRef}
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "60px 24px 80px",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Satu Harga. Semua Features.
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: 15,
              marginBottom: 52,
            }}
          >
            Founding Member deal — masuk awal, kunci harga seumur hidup.
          </p>
          <div
            className="shiftos-pricing-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            {/* Founding Member */}
            <div
              className="shiftos-pricing-card gold"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(212,168,75,0.3)",
                borderRadius: 8,
                padding: 32,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  Founding Member
                </p>
                <span
                  style={{
                    fontSize: 10,
                    background: "rgba(212,168,75,0.12)",
                    border: "1px solid rgba(212,168,75,0.3)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    color: "#d4a84b",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  LIMITED — 10 SPOTS
                </span>
              </div>
              <p
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 52,
                  lineHeight: 1,
                  margin: "12px 0 4px",
                  color: "#d4a84b",
                }}
              >
                RM700
                <span style={{ fontSize: 22, color: "#92600d" }}>/mo</span>
              </p>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 28 }}>
                founder rate · locked in forever
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 32px",
                  flex: 1,
                }}
              >
                {FOUNDING_FEATURES.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: "#d1d5db",
                      marginBottom: 12,
                    }}
                  >
                    <Check
                      size={14}
                      color="#d4a84b"
                      style={{ flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shiftos-btn-red"
                style={{
                  justifyContent: "center",
                  background: "linear-gradient(135deg,#b47828,#92600d)",
                  boxShadow: "0 2px 12px rgba(180,120,40,0.3)",
                }}
              >
                Dapatkan Founding Member Access
              </a>
            </div>

            {/* Monthly Standard */}
            <div
              className="shiftos-pricing-card"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: 32,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "#9ca3af",
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Monthly Standard
              </p>
              <p
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 52,
                  lineHeight: 1,
                  margin: "12px 0 4px",
                  color: "white",
                }}
              >
                RM 1,000
                <span style={{ fontSize: 22, color: "#6b7280" }}>/mo</span>
              </p>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 28 }}>
                cancel anytime · no lock-in
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 32px",
                  flex: 1,
                }}
              >
                {MONTHLY_FEATURES.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: "#d1d5db",
                      marginBottom: 12,
                    }}
                  >
                    <Check
                      size={14}
                      color="#ef4444"
                      style={{ flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="shiftos-btn-red"
                style={{ justifyContent: "center" }}
              >
                WhatsApp Us
              </a>
            </div>
          </div>
        </section>

        {/* ── Contact / CTA ── */}
        <section
          id="contact"
          ref={contactRef}
          style={{ padding: "0 24px 80px" }}
        >
          <div
            className="shiftos-liquid"
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "60px 40px",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>
              Ready to Scale Your Dealership?
            </h2>
            <p style={{ fontSize: 15, color: "#9ca3af", marginBottom: 36 }}>
              Join dealer-dealer yang dah guna ShiftOS untuk jual lebih, kerja
              kurang.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#25D366",
                color: "white",
                borderRadius: 8,
                padding: "14px 32px",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 20px rgba(37,211,102,0.25)",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <MessageCircle size={20} />
              Mula Sekarang — Percuma
            </a>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "40px 24px",
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 20,
                marginBottom: 32,
              }}
            >
              {/* Logo */}
              <div>
                <Link
                  to="/shiftos"
                  style={{
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "#dc2626",
                        borderRadius: 5,
                        transform: "rotate(6deg)",
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 14,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      S
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 18,
                      letterSpacing: "0.05em",
                      background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    ShiftOS
                  </span>
                </Link>
                <p style={{ fontSize: 12, color: "#4b5563", marginTop: 6 }}>
                  The operating system for Malaysian car dealers.
                </p>
              </div>

              {/* Links */}
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  {
                    label: "Features",
                    action: () =>
                      document
                        .getElementById("features")
                        ?.scrollIntoView({ behavior: "smooth" }),
                  },
                  {
                    label: "Pricing",
                    action: () =>
                      document
                        .getElementById("pricing")
                        ?.scrollIntoView({ behavior: "smooth" }),
                  },
                  { label: "xdrive.my", href: "/" },
                ].map(({ label, href, action }) =>
                  href ? (
                    <Link
                      key={label}
                      to={href}
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        textDecoration: "none",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "white")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#6b7280")
                      }
                    >
                      {label}
                    </Link>
                  ) : (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "'DM Sans', sans-serif",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "white")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#6b7280")
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.04)",
                paddingTop: 20,
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
                © 2025 ShiftOS. Built for Malaysian dealers.
              </p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
                Powered by <span style={{ color: "#ef4444" }}>XDrive</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
