import { useEffect, useRef } from "react";

const CSS = `
@keyframes sfl-spin { to { transform: rotate(360deg); } }
@keyframes sfl-pulse { 0%,100% { opacity:.15; } 50% { opacity:.6; } }
@keyframes sfl-blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
@keyframes sfl-scan {
  0%   { transform: translateY(-100%); opacity:0; }
  10%  { opacity:.7; }
  90%  { opacity:.7; }
  100% { transform: translateY(100vh); opacity:0; }
}
@keyframes sfl-float {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-12px); }
}
@keyframes sfl-fade-in { from { opacity:0; } to { opacity:1; } }
@keyframes sfl-bar {
  0%   { width:0%; }
  20%  { width:18%; }
  45%  { width:47%; }
  65%  { width:63%; }
  80%  { width:79%; }
  100% { width:96%; }
}
@keyframes sfl-glitch {
  0%,90%,100% { clip-path: none; transform: none; }
  92% { clip-path: inset(30% 0 50% 0); transform: translateX(-3px); }
  94% { clip-path: inset(60% 0 10% 0); transform: translateX(3px); }
  96% { clip-path: inset(10% 0 70% 0); transform: translateX(-2px); }
}
.sfl-root {
  position: fixed; inset: 0; z-index: 9999;
  background: #080C14;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: 'DM Sans', sans-serif;
  overflow: hidden;
}
.sfl-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(220,38,38,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(220,38,38,.06) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
}
.sfl-scan-line {
  position: absolute; left:0; right:0; height:2px;
  background: linear-gradient(90deg, transparent, rgba(220,38,38,.5), transparent);
  animation: sfl-scan 3s linear infinite;
}
.sfl-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  animation: sfl-pulse 4s ease-in-out infinite;
}
.sfl-symbols {
  position: absolute; inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.sfl-sym {
  position: absolute;
  color: rgba(220,38,38,.18);
  font-size: 14px;
  font-family: 'Courier New', monospace;
  animation: sfl-float linear infinite;
  user-select: none;
}
.sfl-center {
  position: relative; z-index: 2;
  display: flex; flex-direction: column;
  align-items: center; gap: 32px;
  animation: sfl-fade-in .6s ease both;
}
.sfl-ring-wrap {
  position: relative; width:120px; height:120px;
  animation: sfl-float 3s ease-in-out infinite;
}
.sfl-ring {
  position: absolute; border-radius: 50%;
  border: 2px solid transparent;
}
.sfl-ring-1 {
  inset: 0;
  border-top-color: #dc2626;
  border-right-color: rgba(220,38,38,.3);
  animation: sfl-spin 1.2s linear infinite;
}
.sfl-ring-2 {
  inset: 14px;
  border-bottom-color: #ef4444;
  border-left-color: rgba(239,68,68,.2);
  animation: sfl-spin 1.8s linear infinite reverse;
}
.sfl-ring-3 {
  inset: 28px;
  border-top-color: rgba(220,38,38,.5);
  border-right-color: rgba(220,38,38,.1);
  animation: sfl-spin 2.4s linear infinite;
}
.sfl-inner-dot {
  position: absolute; inset: 42px;
  background: radial-gradient(circle, #dc2626 0%, rgba(220,38,38,.3) 50%, transparent 70%);
  border-radius: 50%;
  animation: sfl-pulse 1.6s ease-in-out infinite;
}
.sfl-text-block {
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.sfl-title {
  font-size: 11px;
  letter-spacing: .3em;
  text-transform: uppercase;
  color: rgba(220,38,38,.8);
  font-weight: 500;
}
.sfl-eq {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: rgba(255,255,255,.25);
  letter-spacing: .05em;
  min-height: 18px;
  animation: sfl-glitch 6s ease-in-out infinite;
}
.sfl-bar-wrap {
  width: 220px;
  height: 2px;
  background: rgba(255,255,255,.06);
  border-radius: 2px;
  overflow: hidden;
}
.sfl-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #dc2626, #ef4444);
  border-radius: 2px;
  animation: sfl-bar 4s cubic-bezier(.4,0,.2,1) infinite;
  box-shadow: 0 0 8px rgba(220,38,38,.6);
}
.sfl-status {
  font-size: 11px;
  color: rgba(255,255,255,.2);
  letter-spacing: .15em;
  text-transform: uppercase;
}
.sfl-cursor {
  display: inline-block;
  width: 6px; height: 11px;
  background: #dc2626;
  margin-left: 3px;
  vertical-align: middle;
  animation: sfl-blink .9s step-end infinite;
}
`;

const EQUATIONS = [
  "∇²ψ + k²ψ = 0",
  "E = mc²",
  "∮ B·dA = 0",
  "i∂ψ/∂t = Ĥψ",
  "∑∞ₙ₌₁ 1/n²= π²/6",
  "ds² = -c²dt² + dx²",
  "F = q(E + v×B)",
  "S = -kB ∑ pᵢ ln pᵢ",
];

const SYMBOLS = [
  "01101101","∂","∇","∫","∑","∞","α","β","γ","λ","μ","ω","π",
  "10110011","∮","⊗","⊕","≡","≈","∈","∀","∃","Δ","Φ","Ψ","01010110",
];

export default function SciFiLoader() {
  const eqRef = useRef(null);

  useEffect(() => {
    let i = 0;
    const el = eqRef.current;
    if (!el) return;
    el.textContent = EQUATIONS[0];
    const id = setInterval(() => {
      i = (i + 1) % EQUATIONS.length;
      if (eqRef.current) eqRef.current.textContent = EQUATIONS[i];
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const symItems = SYMBOLS.map((s, idx) => ({
    s,
    left: `${(idx * 37 + 7) % 95}%`,
    top:  `${(idx * 53 + 11) % 90}%`,
    dur:  `${3 + (idx % 4)}s`,
    delay:`${(idx * 0.3) % 3}s`,
  }));

  return (
    <div className="sfl-root">
      <style>{CSS}</style>

      <div className="sfl-grid" />
      <div className="sfl-scan-line" />

      <div
        className="sfl-orb"
        style={{
          width: 400, height: 400,
          background: "rgba(220,38,38,.07)",
          top: "10%", left: "50%",
          transform: "translateX(-50%)",
          animationDelay: "0s",
        }}
      />
      <div
        className="sfl-orb"
        style={{
          width: 250, height: 250,
          background: "rgba(30,58,138,.08)",
          bottom: "15%", right: "10%",
          animationDelay: "2s",
        }}
      />

      <div className="sfl-symbols">
        {symItems.map((item, idx) => (
          <span
            key={idx}
            className="sfl-sym"
            style={{
              left: item.left,
              top: item.top,
              animationDuration: item.dur,
              animationDelay: item.delay,
            }}
          >
            {item.s}
          </span>
        ))}
      </div>

      <div className="sfl-center">
        <div className="sfl-ring-wrap">
          <div className="sfl-ring sfl-ring-1" />
          <div className="sfl-ring sfl-ring-2" />
          <div className="sfl-ring sfl-ring-3" />
          <div className="sfl-inner-dot" />
        </div>

        <div className="sfl-text-block">
          <div className="sfl-title">ShiftOS · Initializing</div>
          <div className="sfl-eq" ref={eqRef} />
        </div>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <div className="sfl-bar-wrap">
            <div className="sfl-bar-fill" />
          </div>
          <div className="sfl-status">
            Loading<span className="sfl-cursor" />
          </div>
        </div>
      </div>
    </div>
  );
}
