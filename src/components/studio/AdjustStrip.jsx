import React, { useRef, useState } from "react";
import DragSlider from "./DragSlider";

// Photo-app style adjustments: one row of named adjustments, ONE slider under
// it (STUDIO-UX-2). A ring marks every adjustment that is off its default, the
// slider snaps to the default near it, and a double tap resets it. Used for the
// slide photo (bgAdjust) and for image / shape layer filters, so both read the
// same way even though they store different scales.
//
// items: [{ key, label, min, max, step, def, fmt(v) }]
export default function AdjustStrip({ items, values, onChange, onResetAll }) {
  const [activeKey, setActiveKey] = useState(items[0]?.key);
  const lastUp = useRef(0);
  const item = items.find((i) => i.key === activeKey) || items[0];
  if (!item) return null;
  const val = values[item.key] ?? item.def;
  const changed = (it) => Math.abs((values[it.key] ?? it.def) - it.def) > (it.step || 0.001) / 2;
  const anyChanged = items.some(changed);

  // Snap to the default within 2% of the range, so "back to normal" is easy.
  const set = (v) => {
    const near = (item.max - item.min) * 0.02;
    onChange(item.key, Math.abs(v - item.def) <= near ? item.def : v);
  };
  // A second tap within 320ms resets (the first tap of the pair moved it).
  const onUp = () => {
    const now = Date.now();
    if (now - lastUp.current < 320) {
      onChange(item.key, item.def);
      lastUp.current = 0;
    } else {
      lastUp.current = now;
    }
  };

  const defPct = ((item.def - item.min) / (item.max - item.min)) * 100;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {items.map((it) => {
          const on = it.key === item.key;
          const ch = changed(it);
          return (
            <button
              key={it.key}
              onClick={() => setActiveKey(it.key)}
              aria-pressed={on}
              style={{ flex: "0 0 auto", width: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: on ? "#2a2f38" : "#181b21",
                  border: `2px solid ${on ? "#f2f4f7" : ch ? "#6ee7b7" : "transparent"}`,
                  color: on ? "#f2f4f7" : "#a3a9b5",
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {it.fmt(values[it.key] ?? it.def)}
              </span>
              <span style={{ fontSize: 11, color: on ? "#f2f4f7" : "#a3a9b5", fontWeight: on ? 600 : 500, whiteSpace: "nowrap" }}>{it.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "12px 0 2px" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f2f4f7" }}>{item.label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f2f4f7", fontVariantNumeric: "tabular-nums" }}>{item.fmt(val)}</span>
      </div>
      <div onPointerUp={onUp} style={{ position: "relative" }}>
        {/* the default's mark on the track */}
        {defPct > 0 && defPct < 100 && (
          <div style={{ position: "absolute", left: `${defPct}%`, top: 7, width: 2, height: 14, marginLeft: -1, background: "#848b98", borderRadius: 1, pointerEvents: "none" }} />
        )}
        <DragSlider min={item.min} max={item.max} step={item.step} value={val} onChange={set} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: "#848b98" }}>Double-tap the slider to reset</span>
        {onResetAll && (
          <button
            onClick={onResetAll}
            disabled={!anyChanged}
            style={{ height: 34, padding: "0 12px", borderRadius: 999, border: "none", background: "#181b21", color: anyChanged ? "#f2f4f7" : "#5b616d", fontSize: 12, fontWeight: 500, cursor: anyChanged ? "pointer" : "default", fontFamily: "inherit" }}
          >
            Reset all
          </button>
        )}
      </div>
    </div>
  );
}
