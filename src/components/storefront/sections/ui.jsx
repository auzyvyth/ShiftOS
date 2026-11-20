// Shared pieces of the dealer site (<sub>.drevo.my) sections: the scroll-in fade, the
// count-up, the card skeleton and the page's one style sheet. STOREFRONT-2 stage 1
// (docs/STOREFRONT_PLAN.md): split out of HomePage.jsx with no visible change.
import { useState, useEffect, useRef } from "react";

// ── FadeIn ────────────────────────────────────────────────────────────────────
export function FadeIn({ children, delay = 0, from = "up", className, style = {} }) {
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
export function CountUp({ end = 0, duration = 1500, style }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    // Counted once already and the number changed (a count that arrived later): show the
    // new number straight away instead of keeping the old one.
    if (started.current) { setVal(end); return; }
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
export function SkeletonCard() {
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

// The page's one style sheet (class names used by every section).
const CSS = `
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

        /* Heading font: the dealer's pick (storefrontLayout.js FONTS). HomePage sets the --sf-head-*
           values only for a pick other than Modern, so each fallback here IS the Modern look. */
        .sec-title {
          font-family: var(--sf-font-head, 'Outfit', sans-serif);
          color: #F0F0F0;
          font-size: calc(clamp(1.5rem, 4vw, 2.4rem) * var(--sf-head-scale, 1));
          font-weight: var(--sf-head-weight, 700);
          text-transform: var(--sf-head-case, none);
          letter-spacing: var(--sf-head-track, -0.025em);
          margin: 0;
          line-height: 1.1;
        }

        /* Versions B and C of the lower sections (STOREFRONT-2 stage 4): one type and spacing
           scale for all of them, and the dealer's colour (--sf-accent, shared.js accentOf) as
           the only accent, used as a fill or a line, never as text on the dark page. */
        .sfv-eyebrow { display:flex; align-items:center; gap:10px; margin:0 0 12px; font-size:11px; font-weight:700;
          letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,0.55); }
        .sfv-eyebrow::before { content:''; width:20px; height:2px; border-radius:2px; flex-shrink:0; background:var(--sf-accent, #DC2626); }
        .sfv-head { margin-bottom:40px; }
        .sfv-t { font-size:18px; font-weight:600; letter-spacing:-.01em; color:#F0F0F0; margin:0 0 6px; }
        .sfv-d { font-size:15px; line-height:1.7; color:rgba(255,255,255,0.62); margin:0; }
        .sfv-num { font-family:var(--sf-font-head, 'Outfit', sans-serif); font-weight:var(--sf-head-weight, 800);
          letter-spacing:var(--sf-head-track, -0.03em); font-variant-numeric:tabular-nums; line-height:1; color:#F0F0F0; }
        .sfv-dot { flex-shrink:0; width:32px; height:32px; border-radius:50%; display:grid; place-items:center;
          background:var(--sf-accent, #DC2626); color:#fff; font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; }
        @media(max-width:480px){ .sfv-head { margin-bottom:28px; } }

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
      `;
export function StorefrontStyles() {
  return <style>{CSS}</style>;
}
