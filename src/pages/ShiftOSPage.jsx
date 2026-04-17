import React, { useEffect, useRef } from "react";
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
    background: linear-gradient(135deg, #080810 0%, #0a0812 40%, #0c080a 100%);
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
    background: rgba(8,8,16,0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
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
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 24px;
    transition: border-color 0.2s, background 0.2s;
  }
  .shiftos-feature-card:hover {
    border-color: rgba(220,38,38,0.3);
    background: rgba(255,255,255,0.07);
  }
  .shiftos-pain-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 28px 24px;
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
const PAIN_POINTS = [
  {
    Icon: AlertCircle,
    title: "Siapa close? Siapa cakap je?",
    desc: "Without real commission and lead tracking, your best salesman gets the same credit as the one who disappeared after lunch.",
  },
  {
    Icon: BarChart2,
    title: "Still running stock on Excel?",
    desc: "No purchase price visibility, no recon tracking, no P&L per unit. You don't actually know which cars made you money.",
  },
  {
    Icon: Video,
    title: "TikTok content eats your whole Sunday",
    desc: "Filming, editing, captioning — repeat for every car every week. ShiftOS generates branded slides in seconds.",
  },
];

const FEATURES = [
  {
    Icon: Car,
    title: "Inventory Management",
    desc: "Add, edit, and track every car. Full history, status, pricing and photos in one place.",
  },
  {
    Icon: Video,
    title: "TikTok Content Studio",
    desc: "Generate branded slides for any listing and export in one click. No editing skills needed.",
  },
  {
    Icon: Send,
    title: "Telegram Auto-Post",
    desc: "New listings automatically post to your Telegram channel the moment they go live.",
  },
  {
    Icon: Users,
    title: "Salesman Panel",
    desc: "Referral links, commission tracking, appointments, and lead attribution per salesman.",
  },
  {
    Icon: Bot,
    title: "AI Performance Advisor",
    desc: "Ask plain questions about your inventory and get instant data-backed answers.",
  },
  {
    Icon: Globe,
    title: "Drevo Marketplace",
    desc: "Your cars are automatically listed on xdrive.my, reaching buyers without extra work.",
  },
];

const STATS = [
  { num: "RM1K", label: "Standard per month" },
  { num: "RM500", label: "Founder rate" },
  { num: "5 min", label: "Setup time" },
  { num: "1", label: "Dashboard for everything" },
];

const FOUNDING_FEATURES = [
  "Full lifetime access",
  "All future features included",
  "Priority support",
  "Drevo marketplace listing",
  "White-label ready",
];

const MONTHLY_FEATURES = [
  "Full dashboard access",
  "Unlimited listings",
  "Team & salesman management",
  "TikTok content studio",
  "AI performance advisor",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShiftOSPage() {
  const featuresRef = useRef(null);
  const pricingRef  = useRef(null);
  const contactRef  = useRef(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    document.title = "ShiftOS — The Operating System for Malaysian Car Dealers";

    // ── Lightning canvas ──────────────────────────────────────────────────────
    const canvas = document.getElementById("shiftos-bg");
    if (!canvas) return () => document.head.removeChild(s);
    const ctx = canvas.getContext("2d");

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // 28 floating nodes
    const nodes = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    }));

    const bolts = [];

    // Build a zigzag polyline between two points
    function makeBolt(ax, ay, bx, by) {
      const segs = 4 + Math.floor(Math.random() * 5);
      const pts = [{ x: ax, y: ay }];
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const mx = ax + (bx - ax) * t;
        const my = ay + (by - ay) * t;
        const perp = { x: -(by - ay), y: bx - ax };
        const len = Math.sqrt(perp.x ** 2 + perp.y ** 2) || 1;
        const jitter = (Math.random() - 0.5) * 28;
        pts.push({ x: mx + (perp.x / len) * jitter, y: my + (perp.y / len) * jitter });
      }
      pts.push({ x: bx, y: by });
      return pts;
    }

    function drawPoly(pts, alpha, lineWidth) {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = `rgba(220,38,38,${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // Fire bolts periodically
    let boltTimer = 0;
    const scheduleBolt = () => 200 + Math.random() * 300;
    let nextBolt = scheduleBolt();

    let last = performance.now();
    let rafId;

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      const dt = now - last;
      last = now;

      // Fill background
      ctx.fillStyle = "#080C14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Move nodes + bounce
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width)  { n.vx *= -1; n.x = Math.max(0, Math.min(canvas.width, n.x)); }
        if (n.y < 0 || n.y > canvas.height) { n.vy *= -1; n.y = Math.max(0, Math.min(canvas.height, n.y)); }
      }

      // Maybe fire 1-2 new bolts
      boltTimer += dt;
      if (boltTimer >= nextBolt) {
        boltTimer = 0;
        nextBolt = scheduleBolt();
        const count = Math.random() < 0.4 ? 2 : 1;
        for (let b = 0; b < count; b++) {
          const ai = Math.floor(Math.random() * nodes.length);
          let bi = ai;
          let attempts = 0;
          while (bi === ai && attempts++ < 10) bi = Math.floor(Math.random() * nodes.length);
          const a = nodes[ai], bl = nodes[bi];
          const dist = Math.hypot(a.x - bl.x, a.y - bl.y);
          if (dist < 60 || dist > 260) continue;
          const pts = makeBolt(a.x, a.y, bl.x, bl.y);
          bolts.push({ pts, life: 1, maxLife: 1 });
          // 35% branch from midpoint
          if (Math.random() < 0.35) {
            const mid = pts[Math.floor(pts.length / 2)];
            const ci = Math.floor(Math.random() * nodes.length);
            const c = nodes[ci];
            const bd = Math.hypot(mid.x - c.x, mid.y - c.y);
            if (bd > 30 && bd < 180) {
              bolts.push({ pts: makeBolt(mid.x, mid.y, c.x, c.y), life: 0.8, maxLife: 0.8 });
            }
          }
        }
      }

      // Draw + age bolts
      for (let i = bolts.length - 1; i >= 0; i--) {
        const bolt = bolts[i];
        bolt.life -= dt / 500;
        if (bolt.life <= 0) { bolts.splice(i, 1); continue; }
        const a = bolt.life / bolt.maxLife;
        // Red glow pass
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(220,38,38,${a * 0.6})`;
        drawPoly(bolt.pts, a * 0.25, 3);
        ctx.shadowBlur = 0;
        // Main stroke
        drawPoly(bolt.pts, a * 0.85, 1);
        // Endpoint dots
        const first = bolt.pts[0], last2 = bolt.pts[bolt.pts.length - 1];
        ctx.beginPath();
        ctx.arc(first.x, first.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${a})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(last2.x, last2.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      document.head.removeChild(s);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const waLink =
    "https://wa.me/60112345678?text=Hi%2C%20I%27m%20interested%20in%20ShiftOS%20for%20my%20dealership";

  return (
    <div className="shiftos-page">
      <canvas id="shiftos-bg" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />

      <div className="shiftos-content">

        {/* ── Navbar ── */}
        <nav className="shiftos-nav">
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Logo */}
            <Link to="/shiftos" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 34, height: 34, flexShrink: 0 }}>
                <div style={{ position: "absolute", inset: 0, background: "#dc2626", borderRadius: 6, transform: "rotate(6deg)" }} />
                <span style={{ position: "relative", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "white", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>S</span>
              </div>
              <div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.05em", background: "linear-gradient(135deg,#ef4444,#dc2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ShiftOS</span>
                <span style={{ display: "block", fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", lineHeight: 1, marginTop: -2 }}>by XDrive</span>
              </div>
            </Link>

            {/* Links */}
            <div className="shiftos-nav-links" style={{ display: "flex", alignItems: "center", gap: 28 }}>
              {[
                { label: "Features", ref: featuresRef },
                { label: "Pricing",  ref: pricingRef },
                { label: "Contact",  ref: contactRef },
              ].map(({ label, ref }) => (
                <button
                  key={label}
                  onClick={() => scrollTo(ref)}
                  style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0, transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "white"}
                  onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* CTA */}
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="shiftos-btn-red" style={{ fontSize: 13, padding: "8px 16px" }}>
              WhatsApp Us
            </a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 20, padding: "4px 14px", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 500, letterSpacing: "0.08em" }}>LIVE · PENANG · KL · JB</span>
          </div>

          <h1
            className="shiftos-heading shiftos-hero-h1"
            style={{ fontSize: 72, lineHeight: 1.05, margin: "0 0 24px", color: "white" }}
          >
            THE OPERATING SYSTEM FOR{" "}
            <span className="shiftos-red-text">MALAYSIAN</span> CAR DEALERS
          </h1>

          <p style={{ fontSize: 18, fontWeight: 300, color: "#9ca3af", maxWidth: 620, margin: "0 auto 40px", lineHeight: 1.6 }}>
            From stock intake to sold — manage listings, track commissions, book appointments, and close deals faster. Built for Malaysian dealers, not generic SaaS.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="shiftos-btn-red" style={{ fontSize: 15, padding: "12px 28px" }}>
              <MessageCircle size={16} /> WhatsApp Us
            </a>
            <button
              onClick={() => scrollTo(featuresRef)}
              className="shiftos-btn-ghost"
              style={{ fontSize: 15, padding: "12px 28px" }}
            >
              See Features <ChevronDown size={16} />
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#4b5563", letterSpacing: "0.08em" }}>
            Trusted by independent dealers across Malaysia
          </p>
        </section>

        {/* ── Pain Points ── */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
          <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Sound familiar?</h2>
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 48 }}>
            Every independent dealer runs into the same walls.
          </p>
          <div
            className="shiftos-pain-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}
          >
            {PAIN_POINTS.map(({ Icon, title, desc }) => (
              <div key={title} className="shiftos-pain-card">
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon size={18} color="#ef4444" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "white", lineHeight: 1.4 }}>{title}</p>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" ref={featuresRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
          <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Everything in one dashboard</h2>
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 52 }}>
            No more switching between five apps. One login, full control.
          </p>
          <div
            className="shiftos-features-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}
          >
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="shiftos-feature-card">
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <Icon size={18} color="#ef4444" />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 8 }}>{title}</p>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats Strip ── */}
        <section style={{ padding: "0 24px 80px" }}>
          <div
            style={{ maxWidth: 1100, margin: "0 auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}
          >
            <div
              className="shiftos-stats-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}
            >
              {STATS.map(({ num, label }, i) => (
                <div
                  key={label}
                  style={{ padding: "36px 24px", textAlign: "center", borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                >
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, lineHeight: 1, margin: "0 0 8px", background: "linear-gradient(135deg,#f87171,#dc2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{num}</p>
                  <p style={{ fontSize: 12, color: "#6b7280", letterSpacing: "0.06em", margin: 0 }}>{label.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" ref={pricingRef} style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 80px" }}>
          <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Simple pricing</h2>
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 52 }}>
            No hidden fees. No per-listing charges. Just one flat price.
          </p>
          <div
            className="shiftos-pricing-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 780, margin: "0 auto" }}
          >
            {/* Founding Member */}
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,168,75,0.3)", borderRadius: 8, padding: 32, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, margin: 0 }}>Founding Member</p>
                <span style={{ fontSize: 10, background: "rgba(212,168,75,0.12)", border: "1px solid rgba(212,168,75,0.3)", borderRadius: 4, padding: "2px 8px", color: "#d4a84b", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>LIMITED — 10 SPOTS</span>
              </div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, lineHeight: 1, margin: "12px 0 4px", color: "#d4a84b" }}>RM 500<span style={{ fontSize: 22, color: "#92600d" }}>/mo</span></p>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 28 }}>founder rate · locked in forever</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flex: 1 }}>
                {FOUNDING_FEATURES.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#d1d5db", marginBottom: 12 }}>
                    <Check size={14} color="#d4a84b" style={{ flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="shiftos-btn-red" style={{ justifyContent: "center", background: "linear-gradient(135deg,#b47828,#92600d)", boxShadow: "0 2px 12px rgba(180,120,40,0.3)" }}>
                WhatsApp to Claim
              </a>
            </div>

            {/* Monthly Standard */}
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 32, display: "flex", flexDirection: "column" }}>
              <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, marginBottom: 4 }}>Monthly Standard</p>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, lineHeight: 1, margin: "12px 0 4px", color: "white" }}>RM 1,000<span style={{ fontSize: 22, color: "#6b7280" }}>/mo</span></p>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 28 }}>cancel anytime · no lock-in</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flex: 1 }}>
                {MONTHLY_FEATURES.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#d1d5db", marginBottom: 12 }}>
                    <Check size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="shiftos-btn-red" style={{ justifyContent: "center" }}>
                WhatsApp Us
              </a>
            </div>
          </div>
        </section>

        {/* ── Contact / CTA ── */}
        <section id="contact" ref={contactRef} style={{ padding: "0 24px 80px" }}>
          <div
            style={{ maxWidth: 760, margin: "0 auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "60px 40px", textAlign: "center" }}
          >
            <h2 style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>This isn't a simple app. Come see it first.</h2>
            <p style={{ fontSize: 15, color: "#9ca3af", marginBottom: 36 }}>
              ShiftOS is built for serious dealers. WhatsApp us for a live walkthrough — we'll show you exactly what it can do for your lot.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#25D366", color: "white", borderRadius: 8, padding: "14px 32px", fontSize: 15, fontWeight: 600, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 20px rgba(37,211,102,0.25)", transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <MessageCircle size={20} />
              Chat on WhatsApp
            </a>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "40px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 32 }}>
              {/* Logo */}
              <div>
                <Link to="/shiftos" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
                    <div style={{ position: "absolute", inset: 0, background: "#dc2626", borderRadius: 5, transform: "rotate(6deg)" }} />
                    <span style={{ position: "relative", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "white", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>S</span>
                  </div>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.05em", background: "linear-gradient(135deg,#ef4444,#dc2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ShiftOS</span>
                </Link>
                <p style={{ fontSize: 12, color: "#4b5563", marginTop: 6 }}>The operating system for Malaysian car dealers.</p>
              </div>

              {/* Links */}
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Features",  action: () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }) },
                  { label: "Pricing",   action: () => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }) },
                  { label: "xdrive.my", href: "/" },
                ].map(({ label, href, action }) =>
                  href ? (
                    <Link key={label} to={href} style={{ fontSize: 13, color: "#6b7280", textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.color = "white"}
                      onMouseLeave={e => e.currentTarget.style.color = "#6b7280"}
                    >{label}</Link>
                  ) : (
                    <button key={label} onClick={action} style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif", transition: "color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.color = "white"}
                      onMouseLeave={e => e.currentTarget.style.color = "#6b7280"}
                    >{label}</button>
                  )
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>© 2025 ShiftOS. Built for Malaysian dealers.</p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>Powered by <span style={{ color: "#ef4444" }}>XDrive</span></p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
