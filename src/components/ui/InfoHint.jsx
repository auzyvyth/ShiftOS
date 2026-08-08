import React, { useState, useRef, useEffect } from "react";

// Small "i" help glyph for the dark superadmin panels. Shows a popover on hover
// (desktop) and on tap (touch — native title=/hover never fire on mobile, same
// rationale as GradeBadge). Self-contained dark styling so it matches the platform
// tabs without pulling the light theme tokens.
//
// Usage: <InfoHint text="Plain-language explanation." /> next to a heading.
export default function InfoHint({ text, title, size = 15 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={title || "More info"}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          width: size, height: size, lineHeight: `${size - 1}px`, textAlign: "center",
          borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)",
          color: "#9ca3af", fontSize: Math.round(size * 0.62), fontWeight: 700, fontStyle: "italic",
          fontFamily: "Georgia, serif", cursor: "pointer", padding: 0, flexShrink: 0,
        }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
            width: "max-content", maxWidth: 260, background: "#111827", color: "#e5e7eb",
            fontSize: 12, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, textTransform: "none",
            padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 200, whiteSpace: "normal",
            fontFamily: "system-ui, sans-serif", textAlign: "left",
          }}
        >
          {title && <span style={{ display: "block", fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>{title}</span>}
          {text}
        </span>
      )}
    </span>
  );
}
