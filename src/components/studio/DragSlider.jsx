import React, { useRef, useCallback } from "react";

// Robust slider built on Pointer Events + setPointerCapture. Native
// <input type=range> loses its thumb-drag on Android when an ancestor
// declares a touch-action (the studio locks pan-y), and touch-action:none
// on the input itself disables the browser's own slider gesture — so we own
// the whole interaction. Works identically for mouse and touch.
export default function DragSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  accent = "#3b82f6",
  height = 28,
}) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const valFromX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return value;
      const r = el.getBoundingClientRect();
      let t = (clientX - r.left) / Math.max(1, r.width);
      t = Math.max(0, Math.min(1, t));
      let v = min + t * (max - min);
      if (step) v = Math.round(v / step) * step;
      return Math.max(min, Math.min(max, v));
    },
    [min, max, step, value],
  );

  const down = useCallback(
    (e) => {
      e.stopPropagation();
      dragging.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      onChange(valFromX(e.clientX));
    },
    [onChange, valFromX],
  );
  const move = useCallback(
    (e) => {
      if (!dragging.current) return;
      e.stopPropagation();
      onChange(valFromX(e.clientX));
    },
    [onChange, valFromX],
  );
  const up = useCallback(
    (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      onCommit?.();
    },
    [onCommit],
  );

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div
      ref={trackRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        position: "relative",
        height,
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.16)" }} />
      <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 5, borderRadius: 3, background: accent }} />
      <div
        style={{
          position: "absolute",
          left: `${pct}%`,
          transform: "translateX(-50%)",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          border: `2px solid ${accent}`,
          boxShadow: "0 1px 5px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
