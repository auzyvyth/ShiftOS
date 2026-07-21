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

  if (layer.type === "triangle") {
    return (
      <div
        style={{
          ...base,
          overflow: "hidden",
          background: hexToRgba(
            layer.fill || "#f59e0b",
            layer.fillOpacity ?? 100,
          ),
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
        background: hexToRgba(
          layer.fill || "#e63946",
          layer.fillOpacity ?? 100,
        ),
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
  onDelete,
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

      {/* Delete — top-right, 32px hit area */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete();
        }}
        style={{
          position: "absolute",
          right: -16 - 6,
          top: -16 - 6,
          width: 32,
          height: 32,
          cursor: "pointer",
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 201,
          touchAction: "none",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            background: "#ef4444",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 5px rgba(0,0,0,0.5)",
          }}
        >
          <Trash2 size={10} color="#fff" />
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

// ─── QuickPanel — floating mini toolbar near selected layer ──────────────────
const Q_BTN = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 5,
  color: "rgba(255,255,255,0.65)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};

function QuickPanel({ layer, cW, cH, onUpdate, onCommit, onShiftZ }) {
  // Guarded placement: anchor the bar to the selection box and hard-clamp it
  // so it can NEVER leave the visible canvas frame — in any aspect ratio, for
  // any selection position (incl. a full-frame layer). Prefer just above the
  // selection; fall back to just below; otherwise dock to the top edge.
  const M = 8; // margin from the canvas edges
  const PANEL_H = 40; // approx bar height (padding + control)
  const PANEL_W = Math.min(216, Math.max(120, cW - M * 2));

  const sx = (layer.x / 100) * cW;
  const sy = (layer.y / 100) * cH;
  const sw = (layer.width / 100) * cW;
  const sh = (layer.height / 100) * cH;

  const maxLeft = Math.max(M, cW - PANEL_W - M);
  const panelLeft = Math.min(maxLeft, Math.max(M, sx + sw / 2 - PANEL_W / 2));

  const above = sy - PANEL_H - M;
  const below = sy + sh + M;
  const maxTop = Math.max(M, cH - PANEL_H - M);
  let panelTop;
  if (above >= M) panelTop = above;
  else if (below <= maxTop) panelTop = below;
  else panelTop = M;
  panelTop = Math.min(maxTop, Math.max(M, panelTop));

  const hasText = ["text", "rect", "circle", "triangle"].includes(layer.type);
  const hasShapeColor = layer.type !== "image" && layer.type !== "text";

  return (
    <div
      style={{
        position: "absolute",
        left: panelLeft,
        top: panelTop,
        width: PANEL_W,
        background: "#1a2035",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 8,
        padding: "5px 8px",
        display: "flex",
        alignItems: "center",
        gap: 5,
        zIndex: 202,
        pointerEvents: "auto",
        boxShadow: "0 4px 20px rgba(0,0,0,0.65)",
        touchAction: "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {hasText && (
        <input
          value={layer.text || ""}
          onChange={(e) => onUpdate(layer.id, { text: e.target.value })}
          onBlur={() => onCommit?.()}
          placeholder="Text…"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5,
            padding: "4px 6px",
            color: "#fff",
            fontSize: 11,
            outline: "none",
            minWidth: 0,
            fontFamily: "inherit",
          }}
        />
      )}
      {hasShapeColor && (
        <label title="Fill color" style={{ flexShrink: 0, cursor: "pointer" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.2)",
              background: layer.fill || "#e63946",
              position: "relative",
            }}
          >
            <input
              type="color"
              value={layer.fill || "#e63946"}
              onChange={(e) => onUpdate(layer.id, { fill: e.target.value })}
              onBlur={() => onCommit?.()}
              style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }}
            />
          </div>
        </label>
      )}
      {layer.type === "text" && (
        <label title="Text color" style={{ flexShrink: 0, cursor: "pointer" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.2)",
              background: layer.textColor || "#ffffff",
              position: "relative",
            }}
          >
            <input
              type="color"
              value={layer.textColor || "#ffffff"}
              onChange={(e) => onUpdate(layer.id, { textColor: e.target.value })}
              onBlur={() => onCommit?.()}
              style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }}
            />
          </div>
        </label>
      )}
      <button onClick={() => onShiftZ(5)} title="Bring to front" style={Q_BTN}>
        <ChevronsUp size={11} />
      </button>
      <button onClick={() => onShiftZ(-5)} title="Send to back" style={Q_BTN}>
        <ChevronsDown size={11} />
      </button>
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
      dragRef.current = { id: layer.id, startX: cx, startY: cy, origX: p.x, origY: p.y, w: p.w, h: p.h };
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
      if (dragRef.current || resizeRef.current || rotateRef.current || pinchRef.current) {
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
    return () => {
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
            onDelete={() => onDeleteLayer?.(selectedLayer.id)}
          />
          <QuickPanel
            layer={selectedLayer}
            cW={cW}
            cH={cH}
            onUpdate={onUpdateLayer}
            onCommit={onCommitHistory}
            onShiftZ={(delta) =>
              onUpdateLayer(selectedLayer.id, {
                zIndex: clamp((selectedLayer.zIndex ?? Z_ABOVE_TEMPLATE) + delta, 1, 199),
              })
            }
          />
        </>
      )}
    </div>
  );
}

// ─── LayerToolbar ──────────────────────────────────────────────────────────────
export function LayerToolbar({
  onAddShape,
  onAddImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  const inputRef = useRef(null);

  const btn = (content, title, onClick, disabled) => (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: disabled ? "transparent" : "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 7,
        color: disabled ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      }}
    >
      {content}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "6px 5px",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        background: "#1a2035",
        flexShrink: 0,
        width: 44,
      }}
    >
      <div
        style={{
          fontSize: 7,
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        Layers
      </div>
      {btn(<Square size={14} />, "Add Rectangle", () => onAddShape("rect"))}
      {btn(<CircleIcon size={14} />, "Add Circle", () => onAddShape("circle"))}
      {btn(<Triangle size={14} />, "Add Triangle", () =>
        onAddShape("triangle"),
      )}
      {btn(<Type size={14} />, "Add Text", () => onAddShape("text"))}
      {btn(<ImagePlus size={14} />, "Add Image", () =>
        inputRef.current?.click(),
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAddImage(URL.createObjectURL(f));
          e.target.value = "";
        }}
      />
      <div
        style={{
          width: "100%",
          height: 1,
          background: "rgba(255,255,255,0.07)",
          margin: "4px 0",
        }}
      />
      {btn(<Undo2 size={13} />, "Undo", onUndo, !canUndo)}
      {btn(<Redo2 size={13} />, "Redo", onRedo, !canRedo)}
    </div>
  );
}

// ─── LayerStack ────────────────────────────────────────────────────────────────
export function LayerStack({
  layers = [],
  selectedIds = [],
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onShiftZ,
}) {
  if (!layers.length) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "#141a28",
        overflowX: "auto",
        flexShrink: 0,
        minHeight: 40,
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          flexShrink: 0,
        }}
      >
        Layers:
      </span>

      {[...layers].reverse().map((layer) => {
        const sel = selectedIds.includes(layer.id);
        return (
          <div
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "3px 7px",
              borderRadius: 5,
              cursor: "pointer",
              flexShrink: 0,
              background: sel
                ? "rgba(59,130,246,0.12)"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${sel ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.07)"}`,
              fontSize: 10,
              color: sel ? "#60a5fa" : "rgba(255,255,255,0.6)",
              transition: "all 0.1s",
            }}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayer(layer.id, { visible: !layer.visible });
              }}
              style={{
                cursor: "pointer",
                opacity: layer.visible === false ? 0.4 : 1,
                display: "flex",
              }}
            >
              {layer.visible === false ? (
                <EyeOff size={11} />
              ) : (
                <Eye size={11} />
              )}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayer(layer.id, { locked: !layer.locked });
              }}
              style={{
                cursor: "pointer",
                opacity: layer.locked ? 1 : 0.3,
                display: "flex",
              }}
            >
              {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
            </span>
            <span
              style={{
                maxWidth: 56,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {layer.label || layer.type}
            </span>
            {(layer.zIndex ?? 20) < 10 && (
              <span
                title="Behind template"
                style={{ fontSize: 8, color: "#fbbf24", flexShrink: 0 }}
              >
                bg
              </span>
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onShiftZ(layer.id, "up");
              }}
              style={{ cursor: "pointer", opacity: 0.5, display: "flex" }}
              title="Bring forward"
            >
              <MoveUp size={9} />
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onShiftZ(layer.id, "down");
              }}
              style={{ cursor: "pointer", opacity: 0.5, display: "flex" }}
              title="Send back"
            >
              <MoveDown size={9} />
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onDeleteLayer(layer.id);
              }}
              style={{
                cursor: "pointer",
                color: "#ef4444",
                opacity: 0.7,
                display: "flex",
              }}
              title="Delete"
            >
              <Trash2 size={9} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── LayerPropertiesPanel ──────────────────────────────────────────────────────
function PropRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
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
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.8)",
            fontWeight: 600,
          }}
        >
          {fmt ? fmt(value) : value}
        </span>
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
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6,
  padding: "5px 8px",
  color: "rgba(255,255,255,0.8)",
  fontSize: 11,
  outline: "none",
};

export function LayerPropertiesPanel({
  layer,
  onUpdate,
  onCommit,
  onDelete,
  onDuplicate,
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

  return (
    <div style={{ overflowY: "auto", paddingBottom: 16 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          padding: "4px 0",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#60a5fa",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          ▣ {layer.label || layer.type}
        </span>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            onClick={() => onDuplicate?.(layer.id)}
            style={{
              padding: "3px 8px",
              fontSize: 9,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 5,
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Copy size={10} /> Copy
          </button>
          <button
            onClick={() => onDelete?.(layer.id)}
            style={{
              padding: "3px 8px",
              fontSize: 9,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 5,
              color: "#f87171",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Trash2 size={10} /> Delete
          </button>
        </div>
      </div>

      {/* Fill + Border first — the controls people actually reach for */}
      {layer.type !== "image" && layer.type !== "text" && (
        <>
          <SectionLabel>Fill</SectionLabel>
          <PropRow label="Color">
            <LColorInput
              value={layer.fill || "#e63946"}
              onChange={(v) => u({ fill: v })}
            />
          </PropRow>
          <LSlider
            label="Fill Opacity"
            value={layer.fillOpacity ?? 100}
            min={0}
            max={100}
            onChange={(v) => u({ fillOpacity: v })}
            fmt={(v) => `${v}%`}
          />
          {(layer.type === "rect" || layer.type === "circle") && (
            <LSlider
              label="Corner Radius"
              value={layer.borderRadius || 0}
              min={0}
              max={100}
              onChange={(v) => u({ borderRadius: v })}
              fmt={(v) => `${v}px`}
            />
          )}
        </>
      )}

      {/* Border — width / colour / opacity */}
      <SectionLabel>Border</SectionLabel>
      <LSlider
        label="Width"
        value={layer.borderWidth ?? 0}
        min={0}
        max={20}
        onChange={(v) => u({ borderWidth: v })}
        fmt={(v) => `${v}px`}
      />
      {(layer.borderWidth || 0) > 0 && (
        <>
          <PropRow label="Color">
            <LColorInput
              value={layer.borderColor || "#ffffff"}
              onChange={(v) => u({ borderColor: v })}
            />
          </PropRow>
          <LSlider
            label="Border Opacity"
            value={layer.borderOpacity ?? 100}
            min={0}
            max={100}
            onChange={(v) => u({ borderOpacity: v })}
            fmt={(v) => `${v}%`}
          />
        </>
      )}

      {/* Issue 4: Text — full controls for text/rect/circle/triangle */}
      {(layer.type === "text" ||
        layer.type === "rect" ||
        layer.type === "circle" ||
        layer.type === "triangle") && (
        <>
          <SectionLabel>Text</SectionLabel>
          <PropRow label="Content">
            <textarea
              value={layer.text || ""}
              onChange={(e) => u({ text: e.target.value })}
              onBlur={() => onCommit?.()}
              rows={3}
              placeholder="Enter text…"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "5px 8px",
                color: "rgba(255,255,255,0.8)",
                fontSize: 11,
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </PropRow>

          {/* Font family */}
          <PropRow label="Font">
            <select
              value={layer.fontFamily || "DM Sans"}
              onChange={(e) => u({ fontFamily: e.target.value })}
              style={selectStyle}
            >
              {TEXT_FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </PropRow>

          <LSlider
            label="Font Size"
            value={layer.fontSize || 24}
            min={8}
            max={200}
            onChange={(v) => u({ fontSize: v })}
            fmt={(v) => `${v}px`}
          />

          <PropRow label="Color">
            <LColorInput
              value={layer.textColor || "#ffffff"}
              onChange={(v) => u({ textColor: v })}
            />
          </PropRow>

          {/* Align + Bold/Italic in one row */}
          <PropRow label="Style">
            <div style={{ display: "flex", gap: 4 }}>
              {[
                [<AlignLeft key="left-icon" size={11} />, "left"],
                [<AlignCenter key="center-icon" size={11} />, "center"],
                [<AlignRight key="right-icon" size={11} />, "right"],
              ].map(([icon, val]) => (
                <button
                  key={val}
                  onClick={() => u({ textAlign: val })}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    borderRadius: 6,
                    fontSize: 10,
                    background:
                      (layer.textAlign || "center") === val
                        ? "rgba(59,130,246,0.2)"
                        : "rgba(255,255,255,0.05)",
                    border: `1px solid ${(layer.textAlign || "center") === val ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color:
                      (layer.textAlign || "center") === val
                        ? "#60a5fa"
                        : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {icon}
                </button>
              ))}
              <button
                onClick={() =>
                  u({
                    fontWeight: layer.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
                style={{
                  flex: 1,
                  padding: "5px 0",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background:
                    layer.fontWeight === "bold"
                      ? "rgba(59,130,246,0.2)"
                      : "rgba(255,255,255,0.05)",
                  border: `1px solid ${layer.fontWeight === "bold" ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                  color:
                    layer.fontWeight === "bold"
                      ? "#60a5fa"
                      : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                }}
              >
                B
              </button>
              <button
                onClick={() =>
                  u({
                    fontStyle:
                      layer.fontStyle === "italic" ? "normal" : "italic",
                  })
                }
                style={{
                  flex: 1,
                  padding: "5px 0",
                  borderRadius: 6,
                  fontSize: 11,
                  fontStyle: "italic",
                  fontWeight: 600,
                  background:
                    layer.fontStyle === "italic"
                      ? "rgba(59,130,246,0.2)"
                      : "rgba(255,255,255,0.05)",
                  border: `1px solid ${layer.fontStyle === "italic" ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                  color:
                    layer.fontStyle === "italic"
                      ? "#60a5fa"
                      : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                }}
              >
                I
              </button>
            </div>
          </PropRow>

          {/* Vertical align */}
          <PropRow label="Vertical">
            <div style={{ display: "flex", gap: 4 }}>
              {[
                ["top", "Top"],
                ["center", "Mid"],
                ["bottom", "Bot"],
              ].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => u({ textVerticalAlign: val })}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    borderRadius: 6,
                    fontSize: 9,
                    background:
                      (layer.textVerticalAlign || "center") === val
                        ? "rgba(59,130,246,0.2)"
                        : "rgba(255,255,255,0.05)",
                    border: `1px solid ${(layer.textVerticalAlign || "center") === val ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color:
                      (layer.textVerticalAlign || "center") === val
                        ? "#60a5fa"
                        : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </PropRow>
        </>
      )}

      {/* Issue 3: Z-Order controls */}
      <SectionLabel>Z-Order</SectionLabel>
      <div
        style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}
      >
        {[
          [<ChevronsUp key="front-icon" size={11} />, "Front", () => uc({ zIndex: Z_FRONT })],
          [
            <ChevronUp key="fwd-icon" size={11} />,
            "Fwd +1",
            () => uc({ zIndex: clamp(curZ + 1, 1, 199) }),
          ],
          [
            <ChevronDown key="back-icon" size={11} />,
            "Back -1",
            () => uc({ zIndex: clamp(curZ - 1, 1, 199) }),
          ],
          [
            <ChevronsDown key="behind-icon" size={11} />,
            "Behind",
            () => uc({ zIndex: Z_BELOW_TEMPLATE }),
          ],
        ].map(([icon, label, fn]) => (
          <button
            key={label}
            onClick={fn}
            style={{
              flex: 1,
              minWidth: 54,
              padding: "5px 2px",
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background:
                label === "Behind"
                  ? "rgba(251,191,36,0.08)"
                  : "rgba(255,255,255,0.05)",
              border: `1px solid ${label === "Behind" ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: label === "Behind" ? "#fbbf24" : "rgba(255,255,255,0.55)",
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.25)",
          marginBottom: 8,
        }}
      >
        z={curZ} · template at z=10 · "Behind" puts layer below template
      </div>

      {/* Transform */}
      <SectionLabel>Transform</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 8,
        }}
      >
        {[
          ["X %", layer.x, (v) => u({ x: v }), 0, 100],
          ["Y %", layer.y, (v) => u({ y: v }), 0, 100],
          ["W %", layer.width, (v) => u({ width: v }), 1, 100],
          ["H %", layer.height, (v) => u({ height: v }), 1, 100],
        ].map(([lbl, val, fn, lo, hi]) => (
          <div key={lbl}>
            <div style={{ fontSize: 9, color: "#9ca3af", marginBottom: 3 }}>
              {lbl}
            </div>
            <LNumInput value={val} onChange={fn} min={lo} max={hi} />
          </div>
        ))}
      </div>
      <LSlider
        label="Rotation"
        value={layer.rotation || 0}
        min={-180}
        max={180}
        onChange={(v) => u({ rotation: v })}
        fmt={(v) => `${v}°`}
      />

      {/* Image source */}
      {layer.type === "image" && (
        <>
          <SectionLabel>Image</SectionLabel>
          <PropRow label="URL">
            <input
              value={layer.src || ""}
              placeholder="https://…"
              onChange={(e) => u({ src: e.target.value })}
              onBlur={() => onCommit?.()}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "5px 8px",
                color: "rgba(255,255,255,0.8)",
                fontSize: 11,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </PropRow>
          <PropRow label="Fit">
            <select
              value={layer.objectFit || "cover"}
              onChange={(e) => uc({ objectFit: e.target.value })}
              style={selectStyle}
            >
              {["cover", "contain", "fill", "none"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </PropRow>
          <LSlider
            label="Corner Radius"
            value={layer.borderRadius || 0}
            min={0}
            max={100}
            onChange={(v) => u({ borderRadius: v })}
            fmt={(v) => `${v}px`}
          />
        </>
      )}

      {/* Label — rarely used, lives at the bottom */}
      <SectionLabel>Label</SectionLabel>
      <PropRow label="Label">
        <input
          value={layer.label || ""}
          onChange={(e) => u({ label: e.target.value })}
          onBlur={() => onCommit?.()}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: "5px 8px",
            color: "rgba(255,255,255,0.8)",
            fontSize: 11,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </PropRow>

      {/* Filters */}
      <SectionLabel>Filters</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 5,
          marginBottom: 10,
        }}
      >
        {Object.keys(FILTER_PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            style={{
              padding: "5px 4px",
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 6,
              border: `1px solid ${f.preset === name ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
              background:
                f.preset === name
                  ? "rgba(59,130,246,0.12)"
                  : "rgba(255,255,255,0.04)",
              color: f.preset === name ? "#60a5fa" : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <LSlider
        label="Brightness"
        value={f.brightness}
        min={0}
        max={200}
        onChange={(v) => u({ filters: { ...f, brightness: v, preset: null } })}
        fmt={(v) => `${v}%`}
      />
      <LSlider
        label="Contrast"
        value={f.contrast}
        min={0}
        max={200}
        onChange={(v) => u({ filters: { ...f, contrast: v, preset: null } })}
        fmt={(v) => `${v}%`}
      />
      <LSlider
        label="Saturation"
        value={f.saturation}
        min={0}
        max={200}
        onChange={(v) => u({ filters: { ...f, saturation: v, preset: null } })}
        fmt={(v) => `${v}%`}
      />
      <LSlider
        label="Blur"
        value={f.blur}
        min={0}
        max={20}
        onChange={(v) => u({ filters: { ...f, blur: v, preset: null } })}
        fmt={(v) => `${v}px`}
      />
      <LSlider
        label="Opacity"
        value={f.opacity}
        min={0}
        max={100}
        onChange={(v) => u({ filters: { ...f, opacity: v, preset: null } })}
        fmt={(v) => `${v}%`}
      />
      <LSlider
        label="Hue Rotate"
        value={f.hue}
        min={0}
        max={360}
        onChange={(v) => u({ filters: { ...f, hue: v, preset: null } })}
        fmt={(v) => `${v}°`}
      />
      <LSlider
        label="Sepia"
        value={f.sepia}
        min={0}
        max={100}
        onChange={(v) => u({ filters: { ...f, sepia: v, preset: null } })}
        fmt={(v) => `${v}%`}
      />
      <button
        onClick={() => uc({ filters: { ...FILTER_DEFAULTS } })}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          fontSize: 10,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          color: "rgba(255,255,255,0.45)",
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        <RotateCcw size={11} /> Reset filters
      </button>

      {/* Layer */}
      <SectionLabel>Layer</SectionLabel>
      <PropRow label="Blend Mode">
        <select
          value={layer.blendMode || "normal"}
          onChange={(e) => uc({ blendMode: e.target.value })}
          style={selectStyle}
        >
          {[
            "normal",
            "multiply",
            "screen",
            "overlay",
            "darken",
            "lighten",
            "color-dodge",
            "color-burn",
            "hard-light",
            "soft-light",
            "difference",
            "exclusion",
            "hue",
            "saturation",
            "color",
            "luminosity",
          ].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </PropRow>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        {[
          ["locked", "Locked"],
          ["visible", "Visible"],
        ].map(([key, lbl]) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={
                key === "visible" ? layer.visible !== false : !!layer[key]
              }
              onChange={(e) =>
                uc(
                  key === "visible"
                    ? { visible: e.target.checked }
                    : { [key]: e.target.checked },
                )
              }
            />
            {lbl}
          </label>
        ))}
      </div>
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
      ctx.fillStyle = hexToRgba(
        layer.fill || "#f59e0b",
        layer.fillOpacity ?? 100,
      );
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
      ctx.fillStyle = hexToRgba(
        layer.fill || "#e63946",
        layer.fillOpacity ?? 100,
      );
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
