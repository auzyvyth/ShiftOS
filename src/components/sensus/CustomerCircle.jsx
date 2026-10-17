import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValueEvent, useReducedMotion } from "framer-motion";

// SENSUS-1: "One record for the whole customer life", drawn as an actual circle.
// The section is tall and its stage is sticky: scrolling through it drives a
// gold comet once round the ring, lighting each of the 11 stages in turn, and
// the centre of the ring shows the stage the reader has reached. It ends back at
// the top, which is the point of stage 11 ("back to stage 1").
//
// Reduced motion gets the plain list (`fallback`), no scroll-jacking of any kind.
// Screen readers always get the list; the ring is aria-hidden decoration over it.

const N_VH = 34;              // scroll distance per stage, in vh
const R = 160, CX = 200, CY = 200;
const pos = (t) => {          // t: 0..1 round the ring, starting at 12 o'clock
  const a = t * Math.PI * 2 - Math.PI / 2;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
};

const CSS = `
.cc{position:relative}
.cc-stick{position:sticky;top:60px;height:calc(100svh - 60px);display:flex;align-items:center}
.cc-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center;width:100%}
.cc-ring{position:relative;width:min(100%,520px,calc(100svh - 140px));aspect-ratio:1;margin:0 auto}
.cc-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.cc-node{cursor:pointer;outline:none}
.cc-node:focus-visible circle.cc-dotc{stroke:#E9DFCC;stroke-width:2}
.cc-center{position:absolute;left:50%;top:50%;width:58%;transform:translate(-50%,-50%);text-align:center}
.cc-n{font-size:clamp(36px,7vw,64px);font-weight:800;line-height:1;letter-spacing:-.03em;color:#B08D57;font-variant-numeric:tabular-nums}
.cc-n small{font-size:.32em;color:rgba(233,223,204,.46);letter-spacing:0;margin-left:4px}
.cc-t{font-size:clamp(16px,2vw,21px);font-weight:700;margin:8px 0 6px;line-height:1.2;text-wrap:balance}
.cc-b{font-size:clamp(12.5px,1.4vw,15px);color:rgba(233,223,204,.68);line-height:1.45;margin:0}
.cc-who{display:inline-block;margin-top:10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:5px 10px;border-radius:999px;border:1px solid rgba(233,223,204,.16)}
.cc-list{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:2px}
.cc-list button{all:unset;cursor:pointer;display:flex;gap:12px;align-items:baseline;padding:5px 0;font-size:14.5px;color:rgba(233,223,204,.42);transition:color .25s ease}
.cc-list button[aria-current="step"]{color:#EFE9DD}
.cc-list button:focus-visible{outline:2px solid #B08D57;outline-offset:2px;border-radius:4px}
.cc-list i{font-style:normal;font-variant-numeric:tabular-nums;font-size:12px;width:18px;color:inherit}
.cc-pulse{transform-box:fill-box;transform-origin:center;animation:ccPulse 1.8s ease-out infinite}
@keyframes ccPulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.4);opacity:0}}
.cc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:820px){
  .cc-grid{grid-template-columns:1fr;gap:14px}
  .cc-list{display:none}
  .cc-ring{width:min(100%,calc(100svh - 300px),420px)}
  .cc-head h2{font-size:24px !important}
  .cc-head .sx-lead{display:none}
}
`;

export default function CustomerCircle({ circle, colors, fallback }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // A spring between the scroll and the ring, so a flick of the wheel glides
  // instead of jumping (Apple: critically damped, no overshoot).
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.6 });
  const dash = useTransform(p, (v) => 1 - v);
  const cometX = useTransform(p, (v) => pos(v)[0]);
  const cometY = useTransform(p, (v) => pos(v)[1]);
  const stages = circle.stages;
  const n = stages.length;
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(v * n)));
    setActive((cur) => (cur === i ? cur : i));
  });

  if (reduce) return fallback;

  const jump = (i) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / n) * run, behavior: "smooth" });
  };

  const s = stages[active];
  const who = { inbound: circle.legend.inbound, outbound: circle.legend.outbound, human: circle.legend.human };
  const dirColor = (d) => (d === "human" ? "#EFE9DD" : colors[d]);

  return (
    <section className="cc" ref={ref} style={{ height: `calc(100svh + ${n * N_VH}vh)` }} aria-labelledby="cc-title">
      <style>{CSS}</style>
      <ol className="cc-sr">
        {stages.map((st) => <li key={st.n}>{st.title}: {st.body}</li>)}
      </ol>
      <div className="cc-stick">
        <div className="sx-w cc-grid">
          <div className="cc-head">
            <h2 id="cc-title">{circle.title}</h2>
            <p className="sx-lead">{circle.lead}</p>
            <div className="sx-legend" style={{ marginBottom: 0 }}>
              {Object.entries(circle.legend).map(([k, v]) => (
                <span key={k}><i className="sx-dot" style={{ background: colors[k], boxShadow: k === "human" ? "inset 0 0 0 1px rgba(233,223,204,.46)" : undefined }} />{v}</span>
              ))}
            </div>
            <ul className="cc-list" aria-hidden="true">
              {stages.map((st, i) => (
                <li key={st.n}>
                  <button tabIndex={-1} aria-current={i === active ? "step" : undefined} onClick={() => jump(i)}>
                    <i>{String(st.n).padStart(2, "0")}</i>{st.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="cc-ring" aria-hidden="true">
            <svg viewBox="0 0 400 400">
              <defs>
                <filter id="ccGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(233,223,204,.10)" strokeWidth="2" />
              <motion.circle
                cx={CX} cy={CY} r={R} fill="none" stroke={colors.outbound} strokeWidth="2.5" strokeLinecap="round"
                pathLength="1" strokeDasharray="1" style={{ strokeDashoffset: dash }}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
              {stages.map((st, i) => {
                const [x, y] = pos(i / n);
                const reached = i <= active;
                const on = i === active;
                const fill = st.dir.length > 1 ? `url(#ccSplit${i})` : st.dir[0] === "human" ? "#3A3A3F" : colors[st.dir[0]];
                return (
                  <g key={st.n} className="cc-node" onClick={() => jump(i)}>
                    {st.dir.length > 1 && (
                      <defs>
                        <linearGradient id={`ccSplit${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="50%" stopColor={colors[st.dir[0]]} />
                          <stop offset="50%" stopColor={colors[st.dir[1]]} />
                        </linearGradient>
                      </defs>
                    )}
                    {on && <circle className="cc-pulse" cx={x} cy={y} r="21" fill="none" stroke={colors.outbound} strokeWidth="1.5" />}
                    <motion.circle
                      className="cc-dotc" cx={x} cy={y}
                      initial={false}
                      animate={{ r: on ? 21 : 17, opacity: reached ? 1 : 0.35 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      fill={reached ? fill : "#161618"}
                      stroke={reached ? "none" : "rgba(233,223,204,.25)"}
                    />
                    <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize="12" fontWeight="800"
                      fill={reached ? (st.dir[0] === "human" && st.dir.length === 1 ? "#EFE9DD" : "#0B0B0C") : "rgba(233,223,204,.5)"}
                      style={{ pointerEvents: "none", fontVariantNumeric: "tabular-nums" }}>{st.n}</text>
                  </g>
                );
              })}
              <motion.circle cx={cometX} cy={cometY} r="6" fill="#E9DFCC" filter="url(#ccGlow)" />
            </svg>

            <div className="cc-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                >
                  <div className="cc-n">{String(s.n).padStart(2, "0")}<small>/ {n}</small></div>
                  <div className="cc-t">{s.title}</div>
                  <p className="cc-b">{s.body}</p>
                  <span className="cc-who" style={{ color: dirColor(s.dir[0]) }}>
                    {s.dir.map((d) => who[d].split(":")[0]).join(" + ")}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
