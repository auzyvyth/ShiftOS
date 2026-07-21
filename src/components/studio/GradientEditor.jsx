import React from "react";
import DragSlider from "./DragSlider";

// Shared: build the CSS string for a gradient value {angle, stops:[{color,pos}]}
export function gradientCss(g) {
  if (!g || !g.stops || g.stops.length < 2) return null;
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(", ");
  return `linear-gradient(${g.angle ?? 90}deg, ${stops})`;
}

export const DEFAULT_GRADIENT = {
  angle: 90,
  stops: [
    { color: "#f9d423", pos: 0 },
    { color: "#e14fad", pos: 100 },
  ],
};

const PRESETS = [
  { angle: 90, stops: [{ color: "#f9d423", pos: 0 }, { color: "#ff4e50", pos: 100 }] },
  { angle: 90, stops: [{ color: "#00c6ff", pos: 0 }, { color: "#0072ff", pos: 100 }] },
  { angle: 90, stops: [{ color: "#f5f7fa", pos: 0 }, { color: "#c9a84c", pos: 100 }] },
  { angle: 90, stops: [{ color: "#11998e", pos: 0 }, { color: "#38ef7d", pos: 100 }] },
  { angle: 90, stops: [{ color: "#fc466b", pos: 0 }, { color: "#3f5efb", pos: 100 }] },
  { angle: 90, stops: [{ color: "#ffffff", pos: 0 }, { color: "#8e9eab", pos: 100 }] },
];

export default function GradientEditor({ value, onChange }) {
  const g = value || DEFAULT_GRADIENT;
  const patch = (p) => onChange({ ...g, ...p });
  const setStop = (i, p) =>
    patch({ stops: g.stops.map((s, idx) => (idx === i ? { ...s, ...p } : s)) });
  const addStop = () => {
    if (g.stops.length >= 4) return;
    patch({ stops: [...g.stops, { color: "#ffffff", pos: 50 }].sort((a, b) => a.pos - b.pos) });
  };
  const removeStop = (i) => {
    if (g.stops.length <= 2) return;
    patch({ stops: g.stops.filter((_, idx) => idx !== i) });
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Live preview bar */}
      <div style={{ height: 26, borderRadius: 7, background: gradientCss(g), border: "1px solid rgba(255,255,255,0.15)", marginBottom: 10 }} />

      {/* Presets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5, marginBottom: 10 }}>
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => onChange({ ...p })}
            style={{ height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: gradientCss(p), cursor: "pointer" }}
          />
        ))}
      </div>

      {/* Angle */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Angle</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{Math.round(g.angle ?? 90)}°</span>
      </div>
      <DragSlider value={g.angle ?? 90} min={0} max={360} step={1} onChange={(v) => patch({ angle: v })} />

      {/* Stops */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {g.stops.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ position: "relative", width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: s.color, cursor: "pointer", flexShrink: 0 }}>
              <input type="color" value={s.color} onChange={(e) => setStop(i, { color: e.target.value })} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
            </label>
            <div style={{ flex: 1 }}>
              <DragSlider value={s.pos} min={0} max={100} step={1} onChange={(v) => setStop(i, { pos: v })} />
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", width: 30, textAlign: "right" }}>{Math.round(s.pos)}%</span>
            {g.stops.length > 2 && (
              <button onClick={() => removeStop(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
            )}
          </div>
        ))}
      </div>
      {g.stops.length < 4 && (
        <button onClick={addStop} style={{ marginTop: 8, width: "100%", padding: "6px 0", borderRadius: 7, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer" }}>
          + Add color stop
        </button>
      )}
    </div>
  );
}
