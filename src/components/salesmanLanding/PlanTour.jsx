import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring,
} from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

// "What you get with each plan" — one section per dashboard tab, screenshot
// alternating left/right, joined by a circuit trace that draws itself as the
// visitor scrolls (scroll-linked, not a looping animation — DESIGN.md Motion).
// A section with `img: null` renders a placeholder frame until the owner
// supplies that screenshot.
//
// Copy rule: no invented numbers. Nothing here promises an income figure;
// the "why it pays" line argues from behaviour (follow-up happens), not RM.

const LITE = [
  {
    key: "dashboard", tab: "Dashboard",
    img: null,
    title: "Open the app. Know who needs you today.",
    pain: "Buyers are spread across forty WhatsApp chats. The one who was ready to book a viewing goes cold while you answer someone else, and you notice two weeks later.",
    moment: "8am, before you reach the lot. The first line says 4 leads are waiting on a follow-up. Below it: how many people opened your page this week, and your link ready to copy into today's WhatsApp status.",
    points: [
      "Overdue follow-ups counted for you, right at the top",
      "Views, page visits and WhatsApp taps for the last 30 days",
      "Your page link: copy, share or open it in one tap",
      "Where visitors came from: Instagram, Facebook or direct",
    ],
    pays: "The buyer you remember to call back is the deal you close.",
  },
  {
    key: "performance", tab: "Performance",
    img: null,
    title: "See which car pulls buyers, and which one is stuck.",
    pain: "You post every car the same way and hope. The car that has sat for a month gets as much of your time as the one buyers keep asking about.",
    moment: "Friday, deciding what to push on your status this weekend. The Lexus RX has buyers tapping WhatsApp and is marked Rising, so it goes first. The Vellfire has 16 views and no taps, so it needs a new price or better photos.",
    points: [
      "Views, WhatsApp taps and conversion rate for every car",
      "A Rising tag on the cars buyers are warming to",
      "Views with no taps point to a price or photo problem",
      "A 30-day window, so you see what works right now",
    ],
    pays: "Put your effort behind the cars buyers already want, and fix the stuck ones before they cost you the month.",
  },
  {
    key: "leads", tab: "Leads",
    img: null,
    title: "Every buyer in a stage, not lost in a chat.",
    pain: "A buyer asks about a car at 11pm. You mean to reply in the morning. By then they have bought from the agent who answered first.",
    moment: "A guest messages you about the Vellfire from the marketplace. They land in your pipeline with the car and price attached, and a flag says \"Never contacted · 9d\" until somebody replies.",
    points: [
      "Stages from New through Contacted, Viewing and Test drive to Won",
      "Flags buyers nobody has replied to, and how long they have waited",
      "Move the deal forward or open the chat from the card",
      "Warm and cold tags, so you call the right person first",
    ],
    pays: "Most lost deals are not lost on price. They are lost because nobody followed up.",
  },
];

const PREMIUM = [
  {
    key: "p-dashboard", tab: "Dashboard",
    img: "/for-salesmen/premium-dashboard.png", w: 390, h: 437,
    alt: "Salesman Premium dashboard showing 4 overdue follow-ups, 30-day views, page visits and WhatsApp taps, and a 7-day traffic chart",
    title: "Open the app. Know who needs you today.",
    pain: "Buyers are spread across forty WhatsApp chats. The one who was ready to book a viewing goes cold while you answer someone else, and you notice two weeks later.",
    moment: "8am, before you reach the lot. The first line says 4 leads are waiting on a follow-up. Below it: how many people opened your page this week, and your link ready to copy into today's WhatsApp status.",
    points: [
      "Overdue follow-ups counted for you, right at the top",
      "Views, page visits and WhatsApp taps for the last 30 days",
      "Your page link: copy, share or open it in one tap",
      "Where visitors came from: Instagram, Facebook or direct",
    ],
    pays: "The buyer you remember to call back is the deal you close.",
  },
  {
    key: "p-performance", tab: "Dashboard",
    img: "/for-salesmen/premium-performance.png", w: 391, h: 285,
    alt: "Per-car performance list showing views, WhatsApp taps and conversion rate, with one car tagged Rising",
    title: "See which car pulls buyers, and which one is stuck.",
    pain: "You post every car the same way and hope. The car that has sat for a month gets as much of your time as the one buyers keep asking about.",
    moment: "Friday, deciding what to push on your status this weekend. The Lexus RX has buyers tapping WhatsApp and is marked Rising, so it goes first. The Vellfire has 16 views and no taps, so it needs a new price or better photos.",
    points: [
      "Views, WhatsApp taps and conversion rate for every car",
      "A Rising tag on the cars buyers are warming to",
      "Views with no taps point to a price or photo problem",
      "A 30-day window, so you see what works right now",
    ],
    pays: "Put your effort behind the cars buyers already want, and fix the stuck ones before they cost you the month.",
  },
  {
    key: "p-leads", tab: "Leads",
    img: "/for-salesmen/premium-leads.png", w: 403, h: 496,
    alt: "Lead pipeline with stage filters and buyer cards flagged Never contacted with the number of days waiting",
    title: "Every buyer in a stage, not lost in a chat.",
    pain: "A buyer asks about a car at 11pm. You mean to reply in the morning. By then they have bought from the agent who answered first.",
    moment: "A guest messages you about the Vellfire from the marketplace. They land in your pipeline with the car and price attached, and a flag says \"Never contacted · 9d\" until somebody replies.",
    points: [
      "Stages from New through Contacted, Viewing and Test drive to Won",
      "Flags buyers nobody has replied to, and how long they have waited",
      "Move the deal forward or open the chat from the card",
      "Queue a follow-up reminder with the message already drafted",
    ],
    pays: "Most lost deals are not lost on price. They are lost because nobody followed up.",
  },
  {
    key: "thisweek", tab: "Dashboard",
    img: "/for-salesmen/premium-thisweek.png", w: 555, h: 468,
    alt: "Today's Agenda showing missed appointments, test drives and scheduled follow-ups for the day",
    title: "A call list for this week, already sorted.",
    pain: "Past buyers, quiet leads and reminders you set all live on different screens, so the calls that bring repeat business never get made.",
    moment: "Monday morning. One list: two buyers nobody replied to, one lead going quiet, and a past customer whose insurance is due. One row per person, even when there are two reasons to call.",
    points: [
      "Buyers never replied to come first",
      "Leads going quiet and reminders that are due",
      "Past buyers with a renewal due or a car ready to trade up",
      "Tap Message and WhatsApp opens with a draft. You press send.",
    ],
    pays: "Repeat buyers and referrals are the cheapest deals you will ever close.",
  },
  {
    key: "sold", tab: "Sold",
    img: "/for-salesmen/premium-sold.png", w: 435, h: 617,
    alt: "8-step handover checklist for a won deal, with loan settlement and insurance done and Puspakom inspection next",
    title: "Won is not done. The handover, step by step.",
    pain: "After the deal comes loan settlement, insurance, Puspakom, the JPJ transfer and road tax. Miss one and the buyer calls you angry instead of recommending you.",
    moment: "You mark a deal Won. An 8-step handover checklist appears in the right order with the official fees filled in. Tick insurance done and next year's renewal date is saved.",
    points: [
      "An 8-step checklist created the moment a deal is won",
      "Puspakom, JPJ transfer and road tax in the right order",
      "The buyer saved as a customer with their car and price",
      "Insurance and road tax dates kept for the renewal reminder",
    ],
    pays: "A smooth handover is how one sale turns into the buyer's brother, cousin and colleague.",
  },
  {
    key: "analytics", tab: "Analytics",
    img: "/for-salesmen/premium-analytics.png", w: 763, h: 609,
    alt: "Close rate funnel showing where deals stop, with Contacted marked as the weakest step, plus median reply speed",
    title: "Find out where you are losing deals.",
    pain: "You know you closed three this month. You do not know whether you lost the rest at the first reply, the viewing or the test drive.",
    moment: "End of the month. The funnel shows most of your lost buyers dropped after booking a viewing. That is what you fix next month, not your ads.",
    points: [
      "The stage each lost deal actually died at",
      "Close rate with a 30-day trend",
      "How fast you reply, and why deals were lost",
      "Which lead sources turn into sales",
    ],
    pays: "Fix the one step where you lose the most people and every lead you already get is worth more.",
  },
];

const PLANS = {
  lite: { label: "Lite", price: "Free", sections: LITE, cta: "Sign up free", to: "/salesman-onboarding/lite" },
  premium: { label: "Premium", price: "RM35/mo", sections: PREMIUM, cta: "Start Premium", to: "/salesman-onboarding/premium" },
};

const DESKTOP_MQ = "(min-width: 861px)";
const MOBILE_X = 11;

// Orthogonal polyline -> path with rounded corners (a PCB trace, not a zig-zag).
function tracePath(pts, r = 14) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const inX = Math.sign(b.x - a.x), inY = Math.sign(b.y - a.y);
    const outX = Math.sign(c.x - b.x), outY = Math.sign(c.y - b.y);
    if (inX === outX && inY === outY) { d += ` L ${b.x} ${b.y}`; continue; }
    const rr = Math.min(r, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    d += ` L ${b.x - inX * rr} ${b.y - inY * rr} Q ${b.x} ${b.y} ${b.x + outX * rr} ${b.y + outY * rr}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L ${z.x} ${z.y}`;
}

// Where along the polyline (0..1) each pad sits, so a pad lights when the
// drawn trace reaches it.
function padFractions(pts, pads) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push({ a: pts[i - 1], b: pts[i], start: total, len });
    total += len;
  }
  return pads.map((p) => {
    const s = seg.find((sg) =>
      Math.min(sg.a.x, sg.b.x) - 0.5 <= p.x && p.x <= Math.max(sg.a.x, sg.b.x) + 0.5 &&
      Math.min(sg.a.y, sg.b.y) - 0.5 <= p.y && p.y <= Math.max(sg.a.y, sg.b.y) + 0.5);
    const along = s ? s.start + Math.hypot(p.x - s.a.x, p.y - s.a.y) : total;
    return { ...p, frac: total ? along / total : 0 };
  });
}

function Shot({ s, shotRef }) {
  return (
    <div className="pt-shot" ref={shotRef}>
      {s.img ? (
        <img src={s.img} alt={s.alt} width={s.w} height={s.h} loading="lazy" decoding="async" />
      ) : (
        <div className="pt-shot-empty">
          <span>{s.tab}</span>
          Screenshot coming
        </div>
      )}
    </div>
  );
}

export default function PlanTour() {
  const reduce = useReducedMotion();
  const [plan, setPlan] = useState("lite");
  const [geo, setGeo] = useState({ w: 0, h: 0, d: "", pads: [] });
  const [lit, setLit] = useState(0);
  const flowRef = useRef(null);
  const secRefs = useRef([]);
  const shotRefs = useRef([]);
  const pathRef = useRef(null);
  const tipRef = useRef(null);
  const cfg = PLANS[plan];

  const measure = useCallback(() => {
    const box = flowRef.current;
    if (!box) return;
    const B = box.getBoundingClientRect();
    const W = B.width, H = box.offsetHeight;
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - B.top, bottom: r.bottom - B.top, cx: r.left - B.left + r.width / 2 };
    };
    const secs = secRefs.current.slice(0, cfg.sections.length).filter(Boolean).map(rel);
    const shots = shotRefs.current.slice(0, cfg.sections.length).filter(Boolean).map(rel);
    if (!secs.length || secs.length !== shots.length) return;

    let pts, pads;
    if (window.matchMedia(DESKTOP_MQ).matches) {
      // Down the centre, then into each chip (screenshot) and out of its
      // bottom, crossing to the next chip in the gap between sections.
      const cx = W / 2;
      const firstGap = Math.max(12, secs[0].top / 2);
      pts = [{ x: cx, y: 0 }, { x: cx, y: firstGap }, { x: shots[0].cx, y: firstGap }];
      pads = [];
      shots.forEach((s, i) => {
        pts.push({ x: s.cx, y: s.top }, { x: s.cx, y: s.bottom });
        pads.push({ x: s.cx, y: s.top }, { x: s.cx, y: s.bottom });
        const nextTop = i < shots.length - 1 ? secs[i + 1].top : H;
        const gap = (secs[i].bottom + nextTop) / 2;
        const nx = i < shots.length - 1 ? shots[i + 1].cx : cx;
        pts.push({ x: s.cx, y: gap }, { x: nx, y: gap });
      });
      pts.push({ x: cx, y: H });
    } else {
      // Stacked layout: one trace down the left gutter, a pad per section.
      pts = [{ x: MOBILE_X, y: 0 }, { x: MOBILE_X, y: H }];
      pads = secs.map((s) => ({ x: MOBILE_X, y: s.top + 12 }));
    }
    setGeo({ w: W, h: H, d: tracePath(pts), pads: padFractions(pts, pads) });
  }, [cfg.sections.length]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (flowRef.current) ro.observe(flowRef.current);
    return () => ro.disconnect();
  }, [measure, plan]);

  const { scrollYProgress } = useScroll({ target: flowRef, offset: ["start 70%", "end 70%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  const paint = useCallback((v) => {
    const p = pathRef.current;
    if (p && tipRef.current && geo.d) {
      const pt = p.getPointAtLength(Math.max(0, Math.min(1, v)) * p.getTotalLength());
      tipRef.current.setAttribute("cx", pt.x);
      tipRef.current.setAttribute("cy", pt.y);
    }
    const n = geo.pads.filter((pd) => pd.frac <= v + 0.002).length;
    setLit((prev) => (prev === n ? prev : n));
  }, [geo]);

  useMotionValueEvent(progress, "change", (v) => { if (!reduce) paint(v); });
  useEffect(() => { paint(reduce ? 1 : progress.get()); }, [paint, reduce, progress]);

  return (
    <section className="pt" aria-labelledby="pt-heading">
      <style>{CSS}</style>
      <div className="pt-wrap">
        <p className="pt-kicker">Inside the app</p>
        <h2 id="pt-heading" className="pt-h2">What you get with each plan</h2>
        <div className="pt-toggle" role="group" aria-label="Choose a plan">
          {Object.entries(PLANS).map(([k, p]) => (
            <button
              key={k}
              type="button"
              className={`pt-toggle-btn${plan === k ? " is-on" : ""}`}
              aria-pressed={plan === k}
              onClick={() => { setPlan(k); setLit(0); }}
            >
              {p.label} <span>{p.price}</span>
            </button>
          ))}
        </div>
        {plan === "premium" && (
          <p className="pt-plus">
            Everything in Lite, plus more on every tab.{" "}
            <button type="button" onClick={() => setPlan("lite")}>See Lite</button>
          </p>
        )}
      </div>

      <div className="pt-wrap">
        <div className="pt-flow" ref={flowRef}>
          {geo.d && (
            <svg className="pt-trace" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
              <path d={geo.d} className="pt-trace-base" />
              <motion.path ref={pathRef} d={geo.d} className="pt-trace-lit" style={{ pathLength: reduce ? 1 : progress }} />
              {geo.pads.map((pd, i) => (
                <rect key={i} x={pd.x - 5} y={pd.y - 5} width="10" height="10" rx="2"
                  className={`pt-pad${i < lit ? " is-lit" : ""}`} />
              ))}
              {!reduce && <circle ref={tipRef} r="4" className="pt-tip" />}
            </svg>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={plan}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25 }}
              onAnimationComplete={measure}
            >
              {cfg.sections.map((s, i) => (
                <article key={s.key} className={`pt-sec${i % 2 ? " pt-sec-flip" : ""}`} ref={(el) => { secRefs.current[i] = el; }}>
                  <div className="pt-copy">
                    <p className="pt-tab"><span>{String(i + 1).padStart(2, "0")}</span> {s.tab}</p>
                    <h3 className="pt-title">{s.title}</h3>
                    <p className="pt-label">The problem</p>
                    <p className="pt-body">{s.pain}</p>
                    <p className="pt-label">When you'd use it</p>
                    <p className="pt-body">{s.moment}</p>
                    <ul className="pt-points">
                      {s.points.map((x) => <li key={x}><Check size={15} /> {x}</li>)}
                    </ul>
                    <p className="pt-pays">{s.pays}</p>
                  </div>
                  <Shot s={s} shotRef={(el) => { shotRefs.current[i] = el; }} />
                </article>
              ))}

              <div className="pt-end">
                <Link to={cfg.to} className="pt-cta">{cfg.cta} <ArrowRight size={17} /></Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

const CSS = `
  .pt { background: #0a0a0a; color: #fff; padding: 72px 0 48px; }
  .pt-wrap { max-width: 1080px; margin: 0 auto; padding: 0 22px; }
  .pt-kicker { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #f87171; margin: 0 0 12px; }
  .pt-h2 { text-align: center; font-size: clamp(28px, 4.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 28px; color: #fff; }
  .pt-toggle { display: flex; width: max-content; max-width: 100%; margin: 0 auto; padding: 4px; gap: 4px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); }
  .pt-toggle-btn { font-family: inherit; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.6); background: none; border: none; border-radius: 9px; padding: 12px 28px; min-height: 44px; cursor: pointer; transition: background .15s, color .15s; }
  .pt-toggle-btn span { font-size: 12px; font-weight: 600; margin-left: 6px; color: rgba(255,255,255,0.4); }
  .pt-toggle-btn.is-on { background: #fff; color: #0a0a0a; }
  .pt-toggle-btn.is-on span { color: #6b7280; }
  .pt-plus { text-align: center; font-size: 14px; color: rgba(255,255,255,0.55); margin: 16px 0 0; }
  .pt-plus button { font: inherit; font-weight: 700; color: #f87171; background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }

  .pt-flow { position: relative; padding-top: 48px; }
  .pt-trace { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; z-index: 0; }
  .pt-trace-base { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 2; }
  .pt-trace-lit { fill: none; stroke: #dc2626; stroke-width: 2; stroke-linecap: round; }
  .pt-pad { fill: #0a0a0a; stroke: rgba(255,255,255,0.22); stroke-width: 1.5; transition: fill .2s, stroke .2s; }
  .pt-pad.is-lit { fill: #dc2626; stroke: #dc2626; }
  .pt-tip { fill: #fff; stroke: #dc2626; stroke-width: 2; }

  .pt-sec { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; padding: 48px 0; }
  .pt-sec-flip .pt-copy { order: 2; }
  .pt-sec-flip .pt-shot { order: 1; }
  .pt-copy { min-width: 0; }
  .pt-tab { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin: 0 0 12px; }
  .pt-tab span { color: #f87171; margin-right: 6px; }
  .pt-title { font-size: clamp(22px, 2.8vw, 30px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; margin: 0 0 20px; color: #fff; }
  .pt-label { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin: 0 0 6px; }
  .pt-body { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.68); margin: 0 0 16px; }
  .pt-points { list-style: none; padding: 0; margin: 4px 0 20px; }
  .pt-points li { display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; line-height: 1.5; color: #fff; padding: 5px 0; }
  .pt-points svg { color: #dc2626; flex-shrink: 0; margin-top: 3px; }
  .pt-pays { font-size: 15px; font-weight: 700; line-height: 1.5; color: #fff; margin: 0; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); }

  .pt-shot { justify-self: center; width: 100%; max-width: 380px; padding: 8px; border-radius: 18px; background: #11151c; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
  .pt-shot img { display: block; width: 100%; height: auto; border-radius: 12px; }
  .pt-shot-empty { aspect-ratio: 4 / 5; border-radius: 12px; border: 1.5px dashed rgba(255,255,255,0.18); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.4); }
  .pt-shot-empty span { font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.7); }

  .pt-end { position: relative; z-index: 1; display: flex; justify-content: center; padding: 40px 0 24px; }
  .pt-cta { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #fff; background: #dc2626; padding: 16px 32px; border-radius: 10px; text-decoration: none; transition: background .15s, transform .15s; }
  .pt-cta:hover { background: #b91c1c; transform: translateY(-1px); }

  @media (max-width: 860px) {
    .pt { padding: 48px 0 32px; }
    .pt-flow { padding-left: 32px; padding-top: 32px; }
    .pt-sec { grid-template-columns: 1fr; gap: 28px; padding: 32px 0; }
    .pt-sec-flip .pt-copy, .pt-sec-flip .pt-shot { order: 0; }
    .pt-shot { max-width: 340px; }
    .pt-toggle-btn { padding: 12px 20px; }
    .pt-end { justify-content: flex-start; }
  }
`;
