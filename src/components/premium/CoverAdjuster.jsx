import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { premiumDark as PD } from "../../theme/tokens";
import { useModalHistory } from "../../hooks/useModalHistory";
import { COVER_FOCUS_DEFAULT } from "../../utils/coverFocus";

// Pick which part of the cover photo shows (BANNER-FOCUS, 2026-11-01).
// Opens BEFORE a new cover uploads (Cancel = nothing saved) and from "Adjust
// position" on an existing one. The big frame is the exact shape of the banner
// in the link preview (api/agent-card.js: 1200 x 340); the small one is the page
// on a phone (.ap-cover, ~343 x 150). Both use object-position 50% <y>%, the
// same rule the share picture is cut with, so what you see is what WhatsApp gets.
const SHARE_RATIO = 1200 / 340;
const PHONE_RATIO = 343 / 150;

export default function CoverAdjuster({ src, initialY = COVER_FOCUS_DEFAULT, busy = false, onApply, onCancel }) {
  const { t } = useTranslation();
  const tr = (k, fallback, o) => t(`salesmanPremium.settings.coverAdjust.${k}`, { defaultValue: fallback, ...o });
  const [y, setY] = useState(initialY);
  const [natural, setNatural] = useState(null);   // { w, h }
  const [frameW, setFrameW] = useState(0);
  const frameRef = useRef(null);
  const drag = useRef(null);

  // Mounted only while open: Back closes it (overlay rule 5), the page behind
  // does not scroll (rule 2).
  useModalHistory(true, onCancel);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    setFrameW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // How many px the photo sticks out above + below the frame. 0 = it already
  // fits (a wide panorama): nothing to move.
  const frameH = frameW / SHARE_RATIO;
  const overflow = natural && frameW ? Math.max(0, frameW * (natural.h / natural.w) - frameH) : 0;
  const movable = overflow > 2;

  const clamp = (v) => Math.min(100, Math.max(0, v));
  const onPointerDown = (e) => {
    if (!movable || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, from: y };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    // Dragging the photo DOWN shows more of its top, so the focus goes up.
    const dy = e.clientY - drag.current.startY;
    setY(clamp(drag.current.from - (dy / overflow) * 100));
  };
  const endDrag = () => { drag.current = null; };
  const onKeyDown = (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); setY((v) => clamp(v - 4)); }
    if (e.key === "ArrowDown") { e.preventDefault(); setY((v) => clamp(v + 4)); }
  };

  const pos = `50% ${Math.round(y)}%`;
  const label = { margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: PD.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" };
  const chip = (on) => ({ height: 34, padding: "0 14px", borderRadius: PD.radius.pill, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: on ? 600 : 500, background: on ? PD.text : PD.raised, color: on ? PD.card : PD.textSec });
  const near = (v) => Math.abs(y - v) < 3;

  return createPortal(
    <div onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, zIndex: 10050, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("title", "Choose what people see")}
        style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", background: PD.card, color: PD.text, borderRadius: PD.radius.card, padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{tr("title", "Choose what people see")}</p>
          <button onClick={onCancel} disabled={busy} aria-label={tr("cancel", "Cancel")} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 99, background: PD.raised, border: "none", color: PD.textSec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: PD.textSec, lineHeight: 1.5 }}>
          {movable ? tr("hint", "Drag the photo up or down. This is the strip your link shows on WhatsApp and Facebook, and on your page.") : tr("fits", "This photo already fits the banner, there is nothing to move.")}
        </p>

        <p style={label}>{tr("share", "Link preview (WhatsApp, Facebook)")}</p>
        <div
          ref={frameRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ position: "relative", width: "100%", aspectRatio: `${SHARE_RATIO}`, borderRadius: PD.radius.row, overflow: "hidden", background: PD.raised, cursor: movable ? (drag.current ? "grabbing" : "grab") : "default", touchAction: "none", outline: "none", userSelect: "none", WebkitUserSelect: "none" }}
        >
          <img src={src} alt="" draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, userSelect: "none", pointerEvents: "none" }} />
          {movable && (
            <span style={{ position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)", padding: "4px 10px", borderRadius: 99, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11.5, fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap" }}>
              {tr("drag", "Drag to move")}
            </span>
          )}
        </div>

        {movable && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setY(0)} style={chip(near(0))}>{tr("top", "Top")}</button>
            <button type="button" onClick={() => setY(50)} style={chip(near(50))}>{tr("middle", "Middle")}</button>
            <button type="button" onClick={() => setY(100)} style={chip(near(100))}>{tr("bottom", "Bottom")}</button>
          </div>
        )}

        <p style={{ ...label, marginTop: 18 }}>{tr("page", "Your page on a phone")}</p>
        <div style={{ width: "min(100%, 300px)", aspectRatio: `${PHONE_RATIO}`, borderRadius: 12, overflow: "hidden", background: PD.raised }}>
          <img src={src} alt="" draggable={false} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: pos }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ height: 42, padding: "0 18px", borderRadius: PD.radius.pill, background: PD.raised, border: "none", color: PD.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {tr("cancel", "Cancel")}
          </button>
          <button type="button" onClick={() => onApply(Math.round(y))} disabled={busy} style={{ height: 42, padding: "0 22px", borderRadius: PD.radius.pill, background: PD.accent, border: "none", color: PD.onAccent, fontSize: 14, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}>
            {busy ? tr("saving", "Saving...") : tr("apply", "Apply")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
