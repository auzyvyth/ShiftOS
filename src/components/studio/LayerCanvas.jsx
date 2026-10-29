/**
 * LayerCanvas — Canva-style layer editor overlay for TikTok Studio V3
 * v3: pinch-zoom prevention, full z-order control, font-family on text,
 *     tap-away deselect, text overflow clipping, background layer support.
 */

import React, { useRef, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Square,
  Circle as CircleIcon,
  Triangle,
  Blend,
  ImagePlus,
  Type,
  Undo2,
  Redo2,
  MoveUp,
  MoveDown,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import DragSlider from "./DragSlider";
import AdjustStrip from "./AdjustStrip";
import GradientEditor, { gradientCss, stopColor, DARK_SCRIM_GRADIENT } from "./GradientEditor";
// react-konva removed — now using CSS div rendering for z-interleave with template

// ─── Constants ─────────────────────────────────────────────────────────────────
const HANDLE_SIZE = 9;
const ROTATE_OFFSET = 22;
const SNAP_THRESHOLD = 2; // % of dimension
const ROTATION_SNAP = 15; // degrees
const Z_ABOVE_TEMPLATE = 20; // default z for new layers (above slide at z=10)
const Z_BELOW_TEMPLATE = 5; // z for "Send to Back" (below slide elements at z=10)
const Z_FRONT = 99;

const FILTER_DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  opacity: 100,
  hue: 0,
  sepia: 0,
  preset: null,
};

const FILTER_PRESETS = {
  moody: { brightness: 85, contrast: 110, saturation: 75, hue: 0, sepia: 0 },
  vivid: { brightness: 110, contrast: 120, saturation: 140, hue: 0, sepia: 0 },
  faded: { brightness: 110, contrast: 85, saturation: 70, hue: 0, sepia: 15 },
  bw: { brightness: 100, contrast: 110, saturation: 0, hue: 0, sepia: 0 },
  warm: { brightness: 105, contrast: 100, saturation: 110, hue: 15, sepia: 10 },
  cool: { brightness: 100, contrast: 105, saturation: 90, hue: 200, sepia: 0 },
};

const TEXT_FONTS = [
  "DM Sans",
  "Inter",
  "Montserrat",
  "Oswald",
  "Bebas Neue",
  "Roboto",
  "Poppins",
  "Lato",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function deg2rad(d) {
  return (d * Math.PI) / 180;
}
function hexToRgba(hex, opacity) {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${(opacity ?? 100) / 100})`;
}
function getAngle(cx, cy, ex, ey) {
  return Math.atan2(ey - cy, ex - cx) * (180 / Math.PI) + 90;
}
function buildFilterStr(f = {}) {
  const ff = { ...FILTER_DEFAULTS, ...f };
  return `brightness(${ff.brightness}%) contrast(${ff.contrast}%) saturate(${ff.saturation}%) blur(${ff.blur}px) hue-rotate(${ff.hue}deg) sepia(${ff.sepia}%)`;
}

// ─── Text content renderer (shared by LayerDiv and canvas export) ──────────────
function TextContent({ layer, scale = 1 }) {
  const justifyContent =
    layer.textAlign === "left"
      ? "flex-start"
      : layer.textAlign === "right"
        ? "flex-end"
        : "center";
  const alignItems =
    layer.textVerticalAlign === "top"
      ? "flex-start"
      : layer.textVerticalAlign === "bottom"
        ? "flex-end"
        : "center";

  // Scale font size to match the display canvas scale so text doesn't overflow on mobile
  const displayFontSize = Math.round((layer.fontSize || 24) * scale);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden", // CLIP text to shape bounds
        display: "flex",
        alignItems,
        justifyContent,
        padding: `${Math.round(4 * scale)}px ${Math.round(6 * scale)}px`,
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: layer.fontFamily || "DM Sans",
          fontSize: `${displayFontSize}px`,
          fontWeight: layer.fontWeight || "bold",
          fontStyle: layer.fontStyle === "italic" ? "italic" : "normal",
          color: layer.textColor || "#ffffff",
          textAlign: layer.textAlign || "center",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          maxWidth: "100%",
          lineHeight: 1.25,
          userSelect: "none",
        }}
      >
        {layer.text || (layer.type === "text" ? "Text" : "")}
      </span>
    </div>
  );
}

// ─── Layer shape renderer (CSS-based) ─────────────────────────────────────────
function LayerDiv({
  layer,
  scale,
  onMouseDown,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) {
  const f = { ...FILTER_DEFAULTS, ...layer.filters };
  const filterStr = buildFilterStr(f);

  // borderWidth / borderRadius are px in canvas space — scale them by `scale`
  // so the down-scaled preview matches the full-res export pixel-for-pixel
  // (previously they were emitted unscaled and looked thicker/rounder than the
  // downloaded image).
  const borderStyle = {
    borderWidth: (layer.borderWidth || 0) * scale,
    borderStyle: layer.borderStyle || "solid",
    borderColor: hexToRgba(
      layer.borderColor || "#ffffff",
      layer.borderOpacity ?? 100,
    ),
    borderRadius:
      layer.type === "circle" ? "50%" : `${(layer.borderRadius || 0) * scale}px`,
  };

  const base = {
    position: "absolute",
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.width}%`,
    height: `${layer.height}%`,
    transform: `rotate(${layer.rotation || 0}deg)`,
    transformOrigin: "center center",
    filter: filterStr,
    opacity: f.opacity / 100,
    mixBlendMode: layer.blendMode || "normal",
    pointerEvents: layer.locked ? "none" : "auto",
    cursor: "move",
    zIndex: layer.zIndex ?? Z_ABOVE_TEMPLATE,
    boxSizing: "border-box",
    userSelect: "none",
    visibility: layer.visible === false ? "hidden" : "visible",
    touchAction: "none",
  };

  const handlers = { onMouseDown, onTouchStart, onTouchMove, onTouchEnd };

  if (layer.type === "image") {
    return (
      <div style={base} {...handlers}>
        {layer.src ? (
          <img
            src={layer.src}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: layer.objectFit || "cover",
              ...borderStyle,
              pointerEvents: "none",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.08)",
              ...borderStyle,
            }}
          >
            <ImagePlus size={24} style={{ opacity: 0.35 }} />
          </div>
        )}
      </div>
    );
  }

  // Shape fill — a gradient value wins over the solid fill so any rect / circle /
  // triangle can be painted with a (optionally transparent) linear gradient.
  const shapeBg = layer.gradient
    ? gradientCss(layer.gradient)
    : hexToRgba(layer.fill || "#e63946", layer.fillOpacity ?? 100);

  if (layer.type === "triangle") {
    return (
      <div
        style={{
          ...base,
          overflow: "hidden",
          background: layer.gradient
            ? gradientCss(layer.gradient)
            : hexToRgba(layer.fill || "#f59e0b", layer.fillOpacity ?? 100),
          clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        }}
        {...handlers}
      >
        {layer.text && <TextContent layer={layer} scale={scale} />}
      </div>
    );
  }

  if (layer.type === "text") {
    return (
      <div
        style={{ ...base, background: "transparent", overflow: "hidden" }}
        {...handlers}
      >
        <TextContent layer={layer} scale={scale} />
      </div>
    );
  }

  // rect / circle (default)
  return (
    <div
      style={{
        ...base,
        overflow: "hidden",
        background: shapeBg,
        ...borderStyle,
      }}
      {...handlers}
    >
      {layer.text && <TextContent layer={layer} scale={scale} />}
    </div>
  );
}

// ─── Selection overlay ─────────────────────────────────────────────────────────
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSOR = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

// Canva-style selection chrome: tiny 8px visual dots inside invisible 28px
// hit areas, so handles are precise to look at but easy to grab on touch.
const HIT = 28;

function SelectionBox({
  layer,
  containerW,
  containerH,
  onHandleMouseDown,
  onHandleTouchStart,
  onRotateMouseDown,
  onRotateTouchStart,
}) {
  const x = (layer.x / 100) * containerW;
  const y = (layer.y / 100) * containerH;
  const w = (layer.width / 100) * containerW;
  const h = (layer.height / 100) * containerH;

  // Hit-box CENTER positions for each handle
  const handleCenter = {
    nw: [0, 0], n: [w / 2, 0], ne: [w, 0],
    e: [w, h / 2], se: [w, h], s: [w / 2, h],
    sw: [0, h], w: [0, h / 2],
  };

  const dot = (round) => ({
    width: 8,
    height: 8,
    background: "#fff",
    border: "1.5px solid #3b82f6",
    borderRadius: round ? "50%" : 2,
    boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
    pointerEvents: "none",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `rotate(${layer.rotation || 0}deg)`,
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: 200,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "1.5px solid #3b82f6",
          pointerEvents: "none",
          boxSizing: "border-box",
        }}
      />

      {HANDLES.map((hk) => {
        // Side handles render as pills along their edge; corners as squares
        const isSide = hk.length === 1;
        return (
          <div
            key={hk}
            onMouseDown={(e) => {
              e.stopPropagation();
              onHandleMouseDown(e, hk);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onHandleTouchStart(e, hk);
            }}
            style={{
              position: "absolute",
              left: handleCenter[hk][0] - HIT / 2,
              top: handleCenter[hk][1] - HIT / 2,
              width: HIT,
              height: HIT,
              background: "transparent",
              cursor: CURSOR[hk],
              pointerEvents: "auto",
              zIndex: 201,
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={
                isSide
                  ? {
                      ...dot(false),
                      width: hk === "n" || hk === "s" ? 16 : 5,
                      height: hk === "n" || hk === "s" ? 5 : 16,
                      borderRadius: 3,
                    }
                  : dot(false)
              }
            />
          </div>
        );
      })}

      {/* Rotate handle — 36px hit area below the shape (Canva placement) */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onRotateMouseDown(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRotateTouchStart(e);
        }}
        style={{
          position: "absolute",
          left: w / 2 - 18,
          top: h + 10,
          width: 36,
          height: 36,
          cursor: "grab",
          pointerEvents: "auto",
          zIndex: 201,
          touchAction: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
        title="Rotate"
      >
        <div
          style={{
            width: 18,
            height: 18,
            background: "#fff",
            border: "1.5px solid #3b82f6",
            borderRadius: "50%",
            boxShadow: "0 1px 5px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RotateCcw size={10} color="#3b82f6" />
        </div>
      </div>

    </div>
  );
}

// ─── Snap guides ───────────────────────────────────────────────────────────────
function SnapGuides({ snapH, snapV }) {
  return (
    <>
      {snapH && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: "100%",
            height: 1,
            background: "#3b82f6",
            opacity: 0.8,
            pointerEvents: "none",
            zIndex: 210,
            transform: "translateY(-50%)",
          }}
        />
      )}
      {snapV && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 1,
            height: "100%",
            background: "#3b82f6",
            opacity: 0.8,
            pointerEvents: "none",
            zIndex: 210,
            transform: "translateX(-50%)",
          }}
        />
      )}
    </>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text, x, y }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x + 12,
        top: y + 12,
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        fontSize: 10,
        padding: "3px 7px",
        borderRadius: 4,
        pointerEvents: "none",
        zIndex: 220,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

// ─── Mini bar over the selected layer: Duplicate, Lock, Delete ──────────────
// The same three actions as over a selected text (STUDIO-UX-2). Everything
// else about the object lives in its own tools, in one place, so nothing here
// duplicates a panel control (the old bar had text, fill, colour and +/-5 z).
const MINI_BTN = {
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  borderRadius: 10,
  color: "#f2f4f7",
  cursor: "pointer",
  padding: 0,
};

function ObjectMiniBar({ layer, cW, cH, onDuplicate, onToggleLock, onDelete }) {
  // Hard-clamped inside the canvas frame: just above the selection, else just
  // below it, else docked to the top edge (a full-frame layer).
  const M = 6;
  const BAR_H = 44;
  const BAR_W = 128;
  const sx = (layer.x / 100) * cW;
  const sy = (layer.y / 100) * cH;
  const sw = (layer.width / 100) * cW;
  const sh = (layer.height / 100) * cH;
  const left = Math.min(Math.max(M, cW - BAR_W - M), Math.max(M, sx + sw / 2 - BAR_W / 2));
  const above = sy - BAR_H - 34; // clear of the rotate handle row
  const below = sy + sh + 40;
  const maxTop = Math.max(M, cH - BAR_H - M);
  let top = above >= M ? above : below <= maxTop ? below : M;
  top = Math.min(maxTop, Math.max(M, top));
  const stop = (e) => e.stopPropagation();
  return (
    <div
      onMouseDown={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
      style={{
        position: "absolute",
        left,
        top,
        height: BAR_H,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 2px",
        borderRadius: 12,
        background: "#181b21",
        boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
        zIndex: 202,
        pointerEvents: "auto",
      }}
    >
      <button aria-label="Duplicate" title="Duplicate" onClick={onDuplicate} style={MINI_BTN}><Copy size={17} /></button>
      <button aria-label={layer.locked ? "Unlock" : "Lock"} title={layer.locked ? "Unlock" : "Lock"} onClick={onToggleLock} style={MINI_BTN}>
        {layer.locked ? <Unlock size={17} /> : <Lock size={17} />}
      </button>
      <button aria-label="Delete" title="Delete" onClick={onDelete} style={{ ...MINI_BTN, color: "#f87171" }}><Trash2 size={17} /></button>
    </div>
  );
}

// ─── LayerCanvas (CSS div-based, per-layer z-index for template interleave) ──
export default function LayerCanvas({
  layers = [],
  selectedIds = [],
  scale = 1,
  canvasW,
  canvasH,
  onSelectLayer,
  onClearSelection,
  onUpdateLayer,
  onCommitHistory,
  onDeleteLayer,
  onDuplicateLayer,
  onToggleLockLayer,
  showMiniBar = true,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const rotateRef = useRef(null);
  const pinchRef = useRef(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [snap, setSnap] = React.useState({ v: false, h: false });
  const [tip, setTip] = React.useState(null);

  const CW = canvasW || 1080;
  const CH = canvasH || 1920;
  const cW = CW * scale;
  const cH = CH * scale;

  const selectedLayer = layers.find((l) => selectedIds.includes(l.id)) || null;
  const sortedLayers = [...layers].sort(
    (a, b) => (a.zIndex ?? Z_ABOVE_TEMPLATE) - (b.zIndex ?? Z_ABOVE_TEMPLATE),
  );

  // px-space snapshot of a layer (display px, matching pointer coords)
  const pxOf = useCallback((layer) => ({
    x: (layer.x / 100) * cW,
    y: (layer.y / 100) * cH,
    w: (layer.width / 100) * cW,
    h: (layer.height / 100) * cH,
  }), [cW, cH]);

  const startPinch = useCallback((layer, t1, t2) => {
    const p = pxOf(layer);
    pinchRef.current = {
      id: layer.id,
      startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1,
      startAngle: (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI,
      startMidX: (t1.clientX + t2.clientX) / 2,
      startMidY: (t1.clientY + t2.clientY) / 2,
      origX: p.x, origY: p.y, origW: p.w, origH: p.h,
      origRotation: layer.rotation || 0,
      origFontSize: layer.fontSize || 24,
      isText: layer.type === "text",
    };
    dragRef.current = null;
    resizeRef.current = null;
    rotateRef.current = null;
  }, [pxOf]);

  // ── Drag (1 finger / mouse) or pinch (2 fingers) ─────────────────────────
  const onLayerPointerDown = useCallback(
    (e, layer) => {
      if (layer.locked) return;
      e.stopPropagation();
      e.preventDefault();
      onSelectLayer?.(layer.id);
      if (e.touches && e.touches.length >= 2) {
        startPinch(layer, e.touches[0], e.touches[1]);
        return;
      }
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      const p = pxOf(layer);
      dragRef.current = { id: layer.id, startX: cx, startY: cy, origX: p.x, origY: p.y, w: p.w, h: p.h, moved: false };
    },
    [onSelectLayer, startPinch, pxOf],
  );

  // ── Resize handle ─────────────────────────────────────────────────────────
  const onHandlePointerDown = useCallback(
    (e, handle) => {
      if (!selectedLayer) return;
      e.stopPropagation();
      e.preventDefault();
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      const p = pxOf(selectedLayer);
      resizeRef.current = {
        id: selectedLayer.id, handle,
        startX: cx, startY: cy,
        origX: p.x, origY: p.y, origW: p.w, origH: p.h,
        rotation: selectedLayer.rotation || 0,
        origFontSize: selectedLayer.fontSize || 24,
        isText: selectedLayer.type === "text",
      };
    },
    [selectedLayer, pxOf],
  );

  // ── Rotate handle ─────────────────────────────────────────────────────────
  const onRotatePointerDown = useCallback(
    (e) => {
      if (!selectedLayer || !containerRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + ((selectedLayer.x + selectedLayer.width / 2) / 100) * rect.width;
      const cy = rect.top + ((selectedLayer.y + selectedLayer.height / 2) / 100) * rect.height;
      const ex = e.touches?.[0]?.clientX ?? e.clientX;
      const ey = e.touches?.[0]?.clientY ?? e.clientY;
      rotateRef.current = {
        id: selectedLayer.id,
        centerX: cx, centerY: cy,
        containerRect: rect,
        startAngle: Math.atan2(ey - cy, ex - cx) * (180 / Math.PI),
        origRotation: selectedLayer.rotation || 0,
      };
    },
    [selectedLayer],
  );

  // ── Global move / up ─────────────────────────────────────────────────────
  useEffect(() => {
    const SNAP_PX = Math.max(6, cW * 0.014);

    const onMove = (e) => {
      // A second finger landing mid-drag upgrades the gesture to a pinch
      if (dragRef.current && e.touches && e.touches.length >= 2) {
        const layer = layersRef.current.find((l) => l.id === dragRef.current.id);
        if (layer) startPinch(layer, e.touches[0], e.touches[1]);
      }

      // ── Pinch: move + scale + rotate with two fingers ──
      if (pinchRef.current && e.touches && e.touches.length >= 2) {
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const P = pinchRef.current;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
        const ang = (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;
        const k = clamp(dist / P.startDist, 0.2, 8);
        const nw = P.origW * k, nh = P.origH * k;
        const midX = (t1.clientX + t2.clientX) / 2, midY = (t1.clientY + t2.clientY) / 2;
        const ncx = P.origX + P.origW / 2 + (midX - P.startMidX);
        const ncy = P.origY + P.origH / 2 + (midY - P.startMidY);
        let rot = ((P.origRotation + ang - P.startAngle) % 360 + 360) % 360;
        const near45 = Math.round(rot / 45) * 45;
        if (Math.abs(rot - near45) < 4) rot = near45 % 360;
        onUpdateLayer(P.id, {
          x: ((ncx - nw / 2) / cW) * 100,
          y: ((ncy - nh / 2) / cH) * 100,
          width: (nw / cW) * 100,
          height: (nh / cH) * 100,
          rotation: Math.round(rot * 10) / 10,
          ...(P.isText ? { fontSize: Math.max(8, Math.round(P.origFontSize * k)) } : {}),
        }, true);
        return;
      }

      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;

      // ── Drag with center/edge snapping ──
      if (dragRef.current) {
        if (e.touches) e.preventDefault();
        const { id, startX, startY, origX, origY, w, h } = dragRef.current;
        // A tap wobbles a few pixels: only a real move drags the shape.
        if (!dragRef.current.moved) {
          if (Math.hypot(cx - startX, cy - startY) < 5) return;
          dragRef.current.moved = true;
        }
        let nx = origX + (cx - startX);
        let ny = origY + (cy - startY);
        let sV = false, sH = false;
        if (Math.abs(nx + w / 2 - cW / 2) < SNAP_PX) { nx = cW / 2 - w / 2; sV = true; }
        if (Math.abs(ny + h / 2 - cH / 2) < SNAP_PX) { ny = cH / 2 - h / 2; sH = true; }
        if (Math.abs(nx) < SNAP_PX * 0.8) nx = 0;
        if (Math.abs(nx + w - cW) < SNAP_PX * 0.8) nx = cW - w;
        if (Math.abs(ny) < SNAP_PX * 0.8) ny = 0;
        if (Math.abs(ny + h - cH) < SNAP_PX * 0.8) ny = cH - h;
        setSnap((s) => (s.v === sV && s.h === sH ? s : { v: sV, h: sH }));
        onUpdateLayer(id, { x: (nx / cW) * 100, y: (ny / cH) * 100 }, true);
      }

      // ── Resize: rotation-aware; corners scale proportionally ──
      if (resizeRef.current) {
        if (e.touches) e.preventDefault();
        const R = resizeRef.current;
        const dx = cx - R.startX, dy = cy - R.startY;
        const th = deg2rad(R.rotation);
        const cos = Math.cos(th), sin = Math.sin(th);
        // pointer delta in the layer's local (rotated) space
        const ldx = dx * cos + dy * sin;
        const ldy = -dx * sin + dy * cos;
        let dW = 0, dH = 0, dCx = 0, dCy = 0;
        let fontK = 1;
        if (R.handle.length === 2) {
          const sX = R.handle.includes("e") ? 1 : -1;
          const sY = R.handle.includes("s") ? 1 : -1;
          const k = Math.max(0.08, 1 + ((ldx * sX) / R.origW + (ldy * sY) / R.origH) / 2);
          dW = R.origW * (k - 1);
          dH = R.origH * (k - 1);
          dCx = (sX * dW) / 2;
          dCy = (sY * dH) / 2;
          fontK = k;
        } else {
          if (R.handle === "e") { dW = ldx; dCx = ldx / 2; }
          if (R.handle === "w") { dW = -ldx; dCx = ldx / 2; }
          if (R.handle === "s") { dH = ldy; dCy = ldy / 2; }
          if (R.handle === "n") { dH = -ldy; dCy = ldy / 2; }
        }
        const nw = Math.max(18, R.origW + dW);
        const nh = Math.max(18, R.origH + dH);
        // center shift back in global space keeps the opposite edge pinned
        const gx = dCx * cos - dCy * sin;
        const gy = dCx * sin + dCy * cos;
        const nx = R.origX + gx - (nw - R.origW) / 2;
        const ny = R.origY + gy - (nh - R.origH) / 2;
        onUpdateLayer(R.id, {
          x: (nx / cW) * 100,
          y: (ny / cH) * 100,
          width: (nw / cW) * 100,
          height: (nh / cH) * 100,
          ...(R.isText && R.handle.length === 2
            ? { fontSize: Math.max(8, Math.round(R.origFontSize * fontK)) }
            : {}),
        }, true);
      }

      // ── Rotate with 45° snapping + live angle tooltip ──
      if (rotateRef.current) {
        if (e.touches) e.preventDefault();
        const { id, centerX, centerY, startAngle, origRotation, containerRect } = rotateRef.current;
        const angle = Math.atan2(cy - centerY, cx - centerX) * (180 / Math.PI);
        let rot = ((origRotation + angle - startAngle) % 360 + 360) % 360;
        const near45 = Math.round(rot / 45) * 45;
        if (Math.abs(rot - near45) < 4) rot = near45 % 360;
        setTip({ text: `${Math.round(rot)}°`, x: cx - containerRect.left, y: cy - containerRect.top });
        onUpdateLayer(id, { rotation: Math.round(rot * 10) / 10 }, true);
      }
    };

    const onUp = (e) => {
      // Pinch → single finger left: end the whole gesture cleanly
      if (pinchRef.current && e.touches && e.touches.length >= 1) {
        onCommitHistory?.();
        pinchRef.current = null;
        return;
      }
      if (dragRef.current?.moved || resizeRef.current || rotateRef.current || pinchRef.current) {
        onCommitHistory?.();
      }
      dragRef.current = null;
      resizeRef.current = null;
      rotateRef.current = null;
      pinchRef.current = null;
      setSnap((s) => (s.v || s.h ? { v: false, h: false } : s));
      setTip(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
    return () => {
      document.removeEventListener("touchcancel", onUp);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [onUpdateLayer, onCommitHistory, cW, cH, startPinch]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
      onMouseDown={(e) => {
        if (e.target === containerRef.current) onClearSelection?.();
      }}
      onTouchEnd={(e) => {
        if (e.target === containerRef.current) onClearSelection?.();
      }}
    >
      {sortedLayers.map((layer) => {
        if (layer.visible === false) return null;
        return (
          <LayerDiv
            key={layer.id}
            layer={layer}
            scale={scale}
            onMouseDown={(e) => onLayerPointerDown(e, layer)}
            onTouchStart={(e) => onLayerPointerDown(e, layer)}
            onTouchMove={(e) => { if (dragRef.current || pinchRef.current) e.preventDefault(); }}
            onTouchEnd={() => {}}
          />
        );
      })}

      <SnapGuides snapH={snap.h} snapV={snap.v} />
      {tip && <Tooltip text={tip.text} x={tip.x} y={tip.y} />}

      {selectedLayer && (
        <>
          <SelectionBox
            layer={selectedLayer}
            containerW={cW}
            containerH={cH}
            onHandleMouseDown={onHandlePointerDown}
            onHandleTouchStart={onHandlePointerDown}
            onRotateMouseDown={onRotatePointerDown}
            onRotateTouchStart={onRotatePointerDown}
          />
          {showMiniBar && (
            <ObjectMiniBar
              layer={selectedLayer}
              cW={cW}
              cH={cH}
              onDuplicate={() => onDuplicateLayer?.(selectedLayer.id)}
              onToggleLock={() => onToggleLockLayer?.(selectedLayer.id)}
              onDelete={() => onDeleteLayer?.(selectedLayer.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── LayerPropertiesPanel ──────────────────────────────────────────────────────
function PropRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#a3a9b5", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function LColorInput({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 28,
          height: 28,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "none",
          borderRadius: 6,
          cursor: "pointer",
          padding: 2,
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          padding: "4px 8px",
          color: "rgba(255,255,255,0.8)",
          fontSize: 11,
          fontFamily: "monospace",
          outline: "none",
        }}
      />
    </div>
  );
}

function LSlider({ label, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: "#a3a9b5" }}>{label}</span>
        <span style={{ fontSize: 12, color: "#f2f4f7", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt ? fmt(value) : value}</span>
      </div>
      <DragSlider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}

function LNumInput({ value, onChange, min, max }) {
  return (
    <input
      type="number"
      value={Math.round(value * 10) / 10}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        padding: "4px 6px",
        color: "rgba(255,255,255,0.8)",
        fontSize: 11,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: "rgba(255,255,255,0.3)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        margin: "12px 0 8px",
        paddingBottom: 4,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </div>
  );
}

const selectStyle = {
  width: "100%",
  height: 40,
  background: "#181b21",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "0 10px",
  color: "#f2f4f7",
  fontSize: 13,
  outline: "none",
};

// Sections a caller can ask for with `only` (STUDIO-UX-2: one tool tab each):
// fill, border, content, font, textColour, textStyle, image, fit, effects,
// arrange. Without `only` every section a layer type supports is shown.
const LAYER_ADJUST = [
  { key: "brightness", label: "Brightness", min: 0, max: 200, step: 1, def: 100, fmt: (v) => signedPct(v - 100) },
  { key: "contrast", label: "Contrast", min: 0, max: 200, step: 1, def: 100, fmt: (v) => signedPct(v - 100) },
  { key: "saturation", label: "Saturation", min: 0, max: 200, step: 1, def: 100, fmt: (v) => signedPct(v - 100) },
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.5, def: 0, fmt: (v) => `${v}` },
  { key: "hue", label: "Hue", min: 0, max: 360, step: 1, def: 0, fmt: (v) => `${Math.round(v)}°` },
  { key: "sepia", label: "Sepia", min: 0, max: 100, step: 1, def: 0, fmt: (v) => `${Math.round(v)}` },
];
function signedPct(n) {
  const r = Math.round(n);
  return (r > 0 ? "+" : "") + r;
}

const segBtn = (on) => ({
  flex: 1,
  height: 34,
  borderRadius: 9,
  border: "none",
  fontSize: 12,
  fontWeight: on ? 600 : 500,
  cursor: "pointer",
  background: on ? "#2a2f38" : "transparent",
  color: on ? "#f2f4f7" : "#a3a9b5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  fontFamily: "inherit",
});
const segWrap = { display: "flex", padding: 3, borderRadius: 12, background: "#181b21", marginBottom: 10, gap: 2 };
const tileBtn = {
  height: 44,
  borderRadius: 12,
  border: "none",
  background: "#181b21",
  color: "#f2f4f7",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: "inherit",
};

export function LayerPropertiesPanel({
  layer,
  onUpdate,
  onCommit,
  onDelete,
  onDuplicate,
  onZ,
  only,
}) {
  if (!layer) {
    return (
      <div
        style={{
          padding: 16,
          color: "rgba(255,255,255,0.3)",
          fontSize: 11,
          textAlign: "center",
        }}
      >
        Select a layer to edit its properties
      </div>
    );
  }

  const u = (patch) => onUpdate(layer.id, patch);
  const uc = (patch) => {
    onUpdate(layer.id, patch);
    onCommit?.();
  };

  const f = { ...FILTER_DEFAULTS, ...layer.filters };
  const applyPreset = (name) => {
    const preset = FILTER_PRESETS[name];
    if (!preset) return;
    uc({ filters: { ...f, ...preset, preset: name } });
  };

  const curZ = layer.zIndex ?? Z_ABOVE_TEMPLATE;
  const isShape = layer.type !== "image" && layer.type !== "text";
  const hasText = layer.type === "text" || isShape;
  const show = (k) => {
    if (only) return only.includes(k);
    if (k === "fill") return isShape;
    if (["content", "font", "textColour", "textStyle"].includes(k)) return hasText;
    if (k === "image" || k === "fit") return layer.type === "image";
    return true;
  };
  // Z order: the caller can route it (All slides mode); else write zIndex here.
  const setZ = (z) => (onZ ? onZ(z) : uc({ zIndex: z }));

  return (
    <div style={{ paddingBottom: 8 }}>
      {!only && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "4px 0" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#f2f4f7" }}>{layer.label || layer.type}</span>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => onDuplicate?.(layer.id)} style={{ ...tileBtn, height: 30, padding: "0 10px" }}>
              <Copy size={12} /> Copy
            </button>
            <button onClick={() => onDelete?.(layer.id)} style={{ ...tileBtn, height: 30, padding: "0 10px", color: "#f87171" }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}

      {show("fill") && (
        <>
          {!only && <SectionLabel>Fill</SectionLabel>}
          <div style={segWrap}>
            <button onClick={() => uc({ gradient: null })} style={segBtn(!layer.gradient)}>Solid</button>
            <button onClick={() => uc({ gradient: layer.gradient || DARK_SCRIM_GRADIENT })} style={segBtn(!!layer.gradient)}>Gradient</button>
          </div>
          {layer.gradient ? (
            <GradientEditor value={layer.gradient} onChange={(g) => u({ gradient: g })} showAlpha />
          ) : (
            <>
              <PropRow label={layer.type === "text" ? "Box colour" : "Colour"}>
                <LColorInput value={layer.fill && layer.fill !== "transparent" ? layer.fill : "#e63946"} onChange={(v) => u({ fill: v })} />
              </PropRow>
              <LSlider label="Opacity" value={layer.fillOpacity ?? 100} min={0} max={100} onChange={(v) => u({ fillOpacity: v })} fmt={(v) => `${v}%`} />
            </>
          )}
        </>
      )}

      {show("border") && (
        <>
          {!only && <SectionLabel>Border</SectionLabel>}
          <LSlider label="Width" value={layer.borderWidth ?? 0} min={0} max={20} onChange={(v) => u({ borderWidth: v })} fmt={(v) => `${v}px`} />
          {(layer.borderWidth || 0) > 0 && (
            <>
              <PropRow label="Colour">
                <LColorInput value={layer.borderColor || "#ffffff"} onChange={(v) => u({ borderColor: v })} />
              </PropRow>
              <LSlider label="Opacity" value={layer.borderOpacity ?? 100} min={0} max={100} onChange={(v) => u({ borderOpacity: v })} fmt={(v) => `${v}%`} />
            </>
          )}
          {layer.type !== "circle" && layer.type !== "triangle" && (
            <LSlider label="Corner radius" value={layer.borderRadius || 0} min={0} max={100} onChange={(v) => u({ borderRadius: v })} fmt={(v) => `${v}px`} />
          )}
        </>
      )}

      {show("content") && (
        <>
          {!only && <SectionLabel>Text</SectionLabel>}
          <PropRow label="Text">
            <textarea
              value={layer.text || ""}
              onChange={(e) => u({ text: e.target.value })}
              onBlur={() => onCommit?.()}
              rows={3}
              placeholder="Type here"
              style={{
                width: "100%",
                background: "#181b21",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "8px 10px",
                color: "#f2f4f7",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </PropRow>
        </>
      )}

      {show("font") && (
        <>
          <PropRow label="Font">
            <select value={layer.fontFamily || "DM Sans"} onChange={(e) => uc({ fontFamily: e.target.value })} style={selectStyle}>
              {TEXT_FONTS.map((fnt) => (
                <option key={fnt} value={fnt} style={{ fontFamily: fnt }}>{fnt}</option>
              ))}
            </select>
          </PropRow>
          <LSlider label="Size" value={layer.fontSize || 24} min={8} max={200} onChange={(v) => u({ fontSize: v })} fmt={(v) => `${v}px`} />
        </>
      )}

      {show("textColour") && (
        <PropRow label="Text colour">
          <LColorInput value={layer.textColor || "#ffffff"} onChange={(v) => u({ textColor: v })} />
        </PropRow>
      )}

      {show("textStyle") && (
        <>
          <PropRow label="Align">
            <div style={{ ...segWrap, marginBottom: 0 }}>
              {[
                [<AlignLeft key="l" size={15} />, "left"],
                [<AlignCenter key="c" size={15} />, "center"],
                [<AlignRight key="r" size={15} />, "right"],
              ].map(([icon, val]) => (
                <button key={val} aria-label={`Align ${val}`} onClick={() => uc({ textAlign: val })} style={segBtn((layer.textAlign || "center") === val)}>{icon}</button>
              ))}
            </div>
          </PropRow>
          <PropRow label="Up / down">
            <div style={{ ...segWrap, marginBottom: 0 }}>
              {[["top", "Top"], ["center", "Middle"], ["bottom", "Bottom"]].map(([val, lbl]) => (
                <button key={val} onClick={() => uc({ textVerticalAlign: val })} style={segBtn((layer.textVerticalAlign || "center") === val)}>{lbl}</button>
              ))}
            </div>
          </PropRow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            <button onClick={() => uc({ fontWeight: layer.fontWeight === "bold" || Number(layer.fontWeight) >= 700 ? "normal" : "bold" })}
              style={{ ...tileBtn, fontWeight: 800, background: layer.fontWeight === "bold" || Number(layer.fontWeight) >= 700 ? "#2a2f38" : "#181b21" }}>Bold</button>
            <button onClick={() => uc({ fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" })}
              style={{ ...tileBtn, fontStyle: "italic", background: layer.fontStyle === "italic" ? "#2a2f38" : "#181b21" }}>Italic</button>
          </div>
        </>
      )}

      {show("image") && (
        <>
          <label style={{ ...tileBtn, width: "100%", marginBottom: 10 }}>
            <ImagePlus size={16} /> Replace image
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uc({ src: URL.createObjectURL(file) });
                e.target.value = "";
              }}
            />
          </label>
          <PropRow label="Or paste an image link">
            <input
              value={layer.src && !String(layer.src).startsWith("blob:") ? layer.src : ""}
              placeholder="https://"
              onChange={(e) => u({ src: e.target.value })}
              onBlur={() => onCommit?.()}
              style={{ width: "100%", background: "#181b21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 10px", color: "#f2f4f7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </PropRow>
        </>
      )}

      {show("fit") && (
        <>
          <PropRow label="Fit">
            <div style={{ ...segWrap, marginBottom: 0 }}>
              {[["cover", "Fill the box"], ["contain", "Show it all"]].map(([val, lbl]) => (
                <button key={val} onClick={() => uc({ objectFit: val })} style={segBtn((layer.objectFit || "cover") === val)}>{lbl}</button>
              ))}
            </div>
          </PropRow>
          <LSlider label="Corner radius" value={layer.borderRadius || 0} min={0} max={100} onChange={(v) => u({ borderRadius: v })} fmt={(v) => `${v}px`} />
        </>
      )}

      {show("effects") && (
        <>
          {!only && <SectionLabel>Effects</SectionLabel>}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, scrollbarWidth: "none" }}>
            {Object.keys(FILTER_PRESETS).map((name) => (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                style={{ flex: "0 0 auto", height: 34, padding: "0 12px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: f.preset === name ? 600 : 500, cursor: "pointer", background: f.preset === name ? "#2a2f38" : "#181b21", color: f.preset === name ? "#f2f4f7" : "#a3a9b5", textTransform: "capitalize", fontFamily: "inherit" }}
              >
                {name}
              </button>
            ))}
          </div>
          <AdjustStrip
            items={LAYER_ADJUST}
            values={f}
            onChange={(key, v) => u({ filters: { ...f, [key]: v, preset: null } })}
            onResetAll={() => uc({ filters: { ...FILTER_DEFAULTS, opacity: f.opacity } })}
          />
          <PropRow label="Blend with what is behind">
            <select value={layer.blendMode || "normal"} onChange={(e) => uc({ blendMode: e.target.value })} style={{ ...selectStyle, marginTop: 4 }}>
              {["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </PropRow>
        </>
      )}

      {show("arrange") && (
        <>
          {!only && <SectionLabel>Arrange</SectionLabel>}
          <LSlider label="Opacity" value={f.opacity} min={0} max={100} onChange={(v) => u({ filters: { ...f, opacity: v } })} fmt={(v) => `${v}%`} />
          <LSlider label="Rotate" value={Math.round(((layer.rotation || 0) + 540) % 360) - 180} min={-180} max={180} onChange={(v) => u({ rotation: v })} fmt={(v) => `${v}°`} />
          <PropRow label="Order">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
              {[
                ["To front", () => setZ(Z_FRONT)],
                ["Forward", () => setZ(clamp(curZ + 1, 1, 199))],
                ["Back", () => setZ(clamp(curZ - 1, 1, 199))],
                ["To back", () => setZ(Z_BELOW_TEMPLATE)],
              ].map(([lbl, fn]) => (
                <button key={lbl} onClick={fn} style={tileBtn}>{lbl}</button>
              ))}
            </div>
          </PropRow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 10 }}>
            <button onClick={() => uc({ locked: !layer.locked })} style={{ ...tileBtn, background: layer.locked ? "#2a2f38" : "#181b21" }}>
              {layer.locked ? <Lock size={15} /> : <Unlock size={15} />} {layer.locked ? "Locked" : "Lock in place"}
            </button>
            <button onClick={() => uc({ visible: layer.visible === false })} style={{ ...tileBtn, background: layer.visible === false ? "#2a2f38" : "#181b21" }}>
              {layer.visible === false ? <EyeOff size={15} /> : <Eye size={15} />} {layer.visible === false ? "Hidden" : "Hide"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginBottom: 10 }}>
            {[
              ["X", layer.x, (v) => u({ x: v }), 0, 100],
              ["Y", layer.y, (v) => u({ y: v }), 0, 100],
              ["W", layer.width, (v) => u({ width: v }), 1, 100],
              ["H", layer.height, (v) => u({ height: v }), 1, 100],
            ].map(([lbl, val, fn, lo, hi]) => (
              <div key={lbl}>
                <div style={{ fontSize: 10, color: "#848b98", marginBottom: 3 }}>{lbl} %</div>
                <LNumInput value={val} onChange={fn} min={lo} max={hi} />
              </div>
            ))}
          </div>
          <PropRow label="Name (in the Layers list)">
            <input
              value={layer.label || ""}
              onChange={(e) => u({ label: e.target.value })}
              onBlur={() => onCommit?.()}
              style={{ width: "100%", background: "#181b21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 10px", color: "#f2f4f7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </PropRow>
        </>
      )}
    </div>
  );
}

// Draw layer text exactly like the TextContent preview: \n honored, long
// lines word-wrapped to the box, 1.25 line-height, horizontal + vertical
// alignment, 4/6px padding.
function drawLayerText(ctx, layer, x, y, w, h) {
  const fontSize = layer.fontSize || 24;
  const lineH = fontSize * 1.25;
  const maxW = Math.max(10, w - 12);
  ctx.font = `${layer.fontStyle === "italic" ? "italic " : ""}${layer.fontWeight || "bold"} ${fontSize}px "${layer.fontFamily || "DM Sans"}", sans-serif`;
  ctx.fillStyle = layer.textColor || "#ffffff";
  ctx.textAlign = layer.textAlign || "center";
  ctx.textBaseline = "middle";

  // \n splits first, then word-wrap each segment to the box width
  const lines = [];
  for (const seg of String(layer.text || "").split("\n")) {
    const words = seg.split(" ");
    let cur = "";
    for (const word of words) {
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    lines.push(cur);
  }

  const blockH = lines.length * lineH;
  const va = layer.textVerticalAlign || "center";
  let startY =
    va === "top" ? y + 4 + lineH / 2
    : va === "bottom" ? y + h - 4 - blockH + lineH / 2
    : y + h / 2 - blockH / 2 + lineH / 2;

  const tx =
    (layer.textAlign || "center") === "left" ? x + 6
    : layer.textAlign === "right" ? x + w - 6
    : x + w / 2;

  for (const line of lines) {
    ctx.fillText(line, tx, startY);
    startY += lineH;
  }
}

// Wait for every font used by the given layers so canvas export renders with
// the same faces the DOM preview showed (canvas silently falls back when a
// webfont isn't loaded yet — that's how exports drift from the preview).
async function ensureLayerFonts(layers) {
  try {
    const loads = [];
    for (const l of layers || []) {
      if (!l.text) continue;
      loads.push(
        document.fonts.load(
          `${l.fontStyle === "italic" ? "italic " : ""}${l.fontWeight || "bold"} ${l.fontSize || 24}px "${l.fontFamily || "DM Sans"}"`,
        ),
      );
    }
    await Promise.all(loads);
  } catch {}
}

// ─── renderLayersToCanvas ──────────────────────────────────────────────────────
// Build a canvas linear gradient across a shape's box, matching the CSS
// `linear-gradient(<angle>deg, …)` used in the live preview so export is WYSIWYG.
function canvasGradientFor(ctx, g, x, y, w, h) {
  const ang = ((g.angle ?? 90) * Math.PI) / 180;
  const dx = Math.sin(ang);
  const dy = -Math.cos(ang);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
  const grad = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  [...g.stops]
    .sort((a, b) => a.pos - b.pos)
    .forEach((s) => grad.addColorStop(Math.max(0, Math.min(1, s.pos / 100)), stopColor(s)));
  return grad;
}

export async function renderLayersToCanvas(canvas, layers, CW, CH) {
  if (!layers?.length) return;
  await ensureLayerFonts(layers);
  const ctx = canvas.getContext("2d");

  // Sort by zIndex so low-z layers paint first
  const sorted = [...layers].sort(
    (a, b) => (a.zIndex ?? Z_ABOVE_TEMPLATE) - (b.zIndex ?? Z_ABOVE_TEMPLATE),
  );

  for (const layer of sorted) {
    if (layer.visible === false) continue;
    const x = (layer.x / 100) * CW;
    const y = (layer.y / 100) * CH;
    const w = (layer.width / 100) * CW;
    const h = (layer.height / 100) * CH;

    ctx.save();
    ctx.globalAlpha = (layer.filters?.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = layer.blendMode || "source-over";
    const f = { ...FILTER_DEFAULTS, ...layer.filters };
    ctx.filter = buildFilterStr(f);

    const cx = x + w / 2,
      cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(deg2rad(layer.rotation || 0));
    ctx.translate(-cx, -cy);

    if (layer.type === "image" && layer.src) {
      try {
        const img = await _loadImg(layer.src);
        // borderRadius is px in canvas space (matches the CSS preview + the
        // 0–999px corner-radius slider), not a percent of the box.
        const rr = layer.borderRadius || 0;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, rr);
        ctx.clip();
        const sc =
          layer.objectFit === "contain"
            ? Math.min(w / img.naturalWidth, h / img.naturalHeight)
            : Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const sw = img.naturalWidth * sc,
          sh = img.naturalHeight * sc;
        ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
      } catch {}
    } else if (layer.type === "triangle") {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fillStyle = layer.gradient
        ? canvasGradientFor(ctx, layer.gradient, x, y, w, h)
        : hexToRgba(layer.fill || "#f59e0b", layer.fillOpacity ?? 100);
      ctx.fill();
    } else if (layer.type === "text") {
      // Text-only layer — full multiline parity with the preview
      drawLayerText(ctx, layer, x, y, w, h);
    } else {
      // rect / circle — borderRadius is px in canvas space (matches the CSS
      // preview + the corner-radius slider), not a percent of the box.
      const rr =
        layer.type === "circle" ? Math.min(w, h) / 2 : layer.borderRadius || 0;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, rr);
      ctx.fillStyle = layer.gradient
        ? canvasGradientFor(ctx, layer.gradient, x, y, w, h)
        : hexToRgba(layer.fill || "#e63946", layer.fillOpacity ?? 100);
      ctx.fill();
      if ((layer.borderWidth || 0) > 0) {
        ctx.strokeStyle = hexToRgba(
          layer.borderColor || "#ffffff",
          layer.borderOpacity ?? 100,
        );
        ctx.lineWidth = layer.borderWidth;
        if (layer.borderStyle === "dashed")
          ctx.setLineDash([layer.borderWidth * 3, layer.borderWidth * 2]);
        else if (layer.borderStyle === "dotted")
          ctx.setLineDash([layer.borderWidth, layer.borderWidth * 1.5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (layer.text) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, rr);
        ctx.clip();
        drawLayerText(ctx, layer, x, y, w, h);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

const _imgCache = new Map();
function _loadImg(src) {
  if (_imgCache.has(src)) return _imgCache.get(src);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
  _imgCache.set(src, p);
  return p;
}
