import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../supabaseClient";
import { useModalHistory } from "../hooks/useModalHistory";
import { calcMonthly } from "../utils/financing";
import { cutOutBackground, cutoutErrorText, isCutoutModelSaved, CUTOUT_MODEL_BYTES } from "../lib/cutout";
import {
  Undo2,
  Redo2,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Square,
  Circle,
  Triangle,
  ImagePlus,
  Layers,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  MoveUp,
  MoveDown,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  LayoutTemplate,
  Tag,
  Smartphone,
  Monitor,
  Pencil,
  CaseSensitive,
  Droplet,
  Move,
  RefreshCw,
  Scissors,
  Sunrise,
  PaintBucket,
  Wand2,
  Crop,
  Stamp,
  Camera,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useLayerEditor, makeLayer } from "../hooks/useLayerEditor";
import LayerCanvas, {
  LayerPropertiesPanel,
  renderLayersToCanvas,
} from "./studio/LayerCanvas";
import AdjustStrip from "./studio/AdjustStrip";
import {
  linkKey,
  patchElements,
  removeElements,
  shiftElements,
  patchOtherLayers,
  removeOtherLayers,
  addToOthers,
  patchPhotos,
} from "./studio/scope";
import { CAR_TEMPLATES, buildTemplateCtx } from "./studio/carTemplates";
import { BACKDROPS, DEFAULT_BACKDROP, DEFAULT_CAR_FIT, placeCar, cutoutBounds, drawBackdrop, drawCarShadow } from "./studio/backdrops";
import CameraCapture from "./studio/CameraCapture";
import DragSlider from "./studio/DragSlider";
import GradientEditor, { gradientCss, DEFAULT_GRADIENT, DARK_SCRIM_GRADIENT } from "./studio/GradientEditor";
import { loadCustomFonts, saveCustomFont, deleteCustomFont } from "./studio/customFonts";

// ─── Constants ────────────────────────────────────────────────────────────────
// A press moves the object only after the finger travels this far.
const DRAG_START_PX = 5;
const CANVAS_W = 1080;
const CANVAS_H = 1920;
// zIndex plane the interactive text/badge elements render on (see CanvasPreview
// overlay). Layers below it sit behind text; layers at/above it sit in front.
// Export interleaves layers around this plane so it matches the live preview.
const ELEMENT_PLANE_Z = 25;
// Default zIndex for the seeded dark gradient overlay — above the photo, behind
// the template text so headline/price stay readable.
const OVERLAY_Z = 12;
const SERVER_URL = import.meta.env.VITE_API_URL || "";
const AI_MESSAGES_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/ai/messages` : '/api/ai-messages';
const AI_LIMIT = 100;

async function getAIAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

const FORMATS = [
  {
    id: "9:16",
    label: "TikTok / Reels",
    w: 1080,
    h: 1920,
    icon: <Smartphone size={13} />,
  },
  {
    id: "1:1",
    label: "Square Post",
    w: 1080,
    h: 1080,
    icon: <Square size={13} />,
  },
  {
    id: "4:5",
    label: "Portrait Feed",
    w: 1080,
    h: 1350,
    icon: <ImagePlus size={13} />,
  },
  {
    id: "16:9",
    label: "YouTube / FB",
    w: 1920,
    h: 1080,
    icon: <Monitor size={13} />,
  },
];

// Compute the largest display size that fits within (maxW × maxH) for a given aspect ratio
function computeDisplaySize(aspectRatio, maxW, maxH) {
  let w = maxW;
  let h = maxW / aspectRatio;
  if (h > maxH) {
    h = maxH;
    w = maxH * aspectRatio;
  }
  return { displayW: Math.floor(w), displayH: Math.floor(h) };
}

// Uniformly scale + center a slide's elements + layers from an authored
// (fromW×fromH) canvas into a target (toW×toH) format, so every pre-made
// template fits INSIDE all 4 aspect ratios instead of spilling off-frame.
// Identity when from===to (e.g. a 9:16-authored template applied at 9:16).
// Coordinate systems (must match both the preview and the export renderer):
//   - elements: absolute px in canvas space; fontSize/strokeWidth in px
//   - layers:   percent (0–100) of canvas for x/y/width/height; px fontSize/borderWidth
function fitCanvasContent({ elements = [], layers = [], fromW, fromH, toW, toH }) {
  const s = Math.min(toW / fromW, toH / fromH);
  const ox = (toW - fromW * s) / 2;
  const oy = (toH - fromH * s) / 2;
  const nextElements = elements.map((e) => ({
    ...e,
    x: Math.round((e.x || 0) * s + ox),
    y: Math.round((e.y || 0) * s + oy),
    ...(e.fontSize ? { fontSize: Math.max(8, Math.round(e.fontSize * s)) } : {}),
    ...(e.strokeWidth ? { strokeWidth: e.strokeWidth * s } : {}),
  }));
  const nextLayers = layers.map((l) => {
    // percent → authored px → target px → percent of target
    const ax = ((l.x || 0) / 100) * fromW;
    const ay = ((l.y || 0) / 100) * fromH;
    const aw = ((l.width || 0) / 100) * fromW;
    const ah = ((l.height || 0) / 100) * fromH;
    return {
      ...l,
      x: ((ax * s + ox) / toW) * 100,
      y: ((ay * s + oy) / toH) * 100,
      width: ((aw * s) / toW) * 100,
      height: ((ah * s) / toH) * 100,
      ...(l.fontSize ? { fontSize: Math.max(8, Math.round(l.fontSize * s)) } : {}),
      ...(l.borderWidth ? { borderWidth: l.borderWidth * s } : {}),
    };
  });
  return { elements: nextElements, layers: nextLayers };
}

const SUGGESTION_POOL = [
  "make price bigger",
  "center the hook",
  "price in red",
  "rotate headline -5deg",
  "make hook smaller",
  "gold accent",
  "move price to top",
  "bold the headline",
  "hide watermark",
  "make it minimal",
  "add hot deal badge",
  "increase opacity",
];

// ─── CSS animations ───────────────────────────────────────────────────────────
if (
  typeof document !== "undefined" &&
  !document.getElementById("ttsv3-styles")
) {
  const s = document.createElement("style");
  s.id = "ttsv3-styles";
  s.textContent = `
    @keyframes ttsv3-spin { to { transform: rotate(360deg); } }
    @keyframes ttsv3-highlight { 0%,100%{ box-shadow:none; } 40%{ box-shadow:0 0 0 4px rgba(37,99,235,0.7); } }
    /* Sliders must own their touch gesture — ancestors declare pan-y, which
       makes horizontal thumb drags lose gesture arbitration on Android
       (tap works, drag doesn't). Also give the thumb a real touch target. */
    input[type="range"] { touch-action: none; }
    input[type="range"]::-webkit-slider-thumb { width: 18px; height: 18px; }
  `;
  document.head.appendChild(s);
}

// ─── roundRect polyfill ───────────────────────────────────────────────────────
(function () {
  if (typeof CanvasRenderingContext2D === "undefined") return;
  if (CanvasRenderingContext2D.prototype.roundRect) return;
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(
      typeof r === "number" ? r : 0,
      Math.abs(w) / 2,
      Math.abs(h) / 2,
    );
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
})();

// ─── Utils ────────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  try {
    const p = JSON.parse(val);
    if (Array.isArray(p)) return p.filter(Boolean);
  } catch {}
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
const IMG_CACHE = new Map();
function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!IMG_CACHE.has(url)) {
    IMG_CACHE.set(
      url,
      new Promise((res) => {
        // The same photo is usually already on screen as a plain <img> (the car
        // card thumbnail), loaded WITHOUT CORS. Browsers, Safari especially,
        // can answer this CORS request from that cached copy, which has no CORS
        // header, so the load fails and the slide paints with no car. On a
        // failure, retry once with a cache-busting query so the browser fetches
        // a fresh, CORS-enabled copy (Supabase storage ignores the extra param).
        const attempt = (src, isRetry) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => res(img);
          img.onerror = () => {
            if (isRetry || src.startsWith("data:") || src.startsWith("blob:")) return res(null);
            attempt(src + (src.includes("?") ? "&" : "?") + "cors=1", true);
          };
          img.src = src;
        };
        attempt(url, false);
      }),
    );
  }
  return IMG_CACHE.get(url);
}
let _zip = null;
function loadJSZip() {
  if (!_zip)
    _zip = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = () => res(window.JSZip);
      s.onerror = rej;
      document.head.appendChild(s);
    });
  return _zip;
}

// ─── Fonts ────────────────────────────────────────────────────────────────────
const FONTS = [
  {
    id: "dm",
    label: "DM Sans",
    stack: "'DM Sans',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&display=swap",
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    stack: "'Bebas Neue',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  },
  {
    id: "oswald",
    label: "Oswald",
    stack: "'Oswald',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    stack: "'Montserrat',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap",
  },
  {
    id: "anton",
    label: "Anton",
    stack: "'Anton',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
  },
  {
    id: "barlow",
    label: "Barlow Condensed",
    stack: "'Barlow Condensed',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap",
  },
  {
    id: "russo",
    label: "Russo One",
    stack: "'Russo One',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Russo+One&display=swap",
  },
  {
    id: "raleway",
    label: "Raleway",
    stack: "'Raleway',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap",
  },
  {
    id: "poppins",
    label: "Poppins",
    stack: "'Poppins',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap",
  },
  {
    id: "inter",
    label: "Inter",
    stack: "'Inter',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap",
  },
  {
    id: "nunito",
    label: "Nunito",
    stack: "'Nunito',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    stack: "'Playfair Display',serif",
    url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&display=swap",
  },
  {
    id: "exo",
    label: "Exo 2",
    stack: "'Exo 2',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&display=swap",
  },
  {
    id: "teko",
    label: "Teko",
    stack: "'Teko',sans-serif",
    url: "https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&display=swap",
  },
];
const GFONTS_LOADED = new Set();
function ensureFont(fontId) {
  if (GFONTS_LOADED.has(fontId)) return;
  GFONTS_LOADED.add(fontId);
  const f = FONTS.find((f) => f.id === fontId);
  if (!f?.url) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = f.url;
  document.head.appendChild(l);
}

// ─── Style Presets ────────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  {
    id: "dark-luxury",
    label: "Dark Luxury",
    dots: ["#0d0d0d", "#c9a84c"],
    theme: { accentColor: "#c9a84c", bgColor: "#0d0d0d", overlayOpacity: 0.55 },
  },
  {
    id: "street-red",
    label: "Street Bold",
    dots: ["#0a0a0a", "#e53935"],
    theme: { accentColor: "#e53935", bgColor: "#0a0a0a", overlayOpacity: 0.45 },
  },
  {
    id: "neon-blue",
    label: "Neon Blue",
    dots: ["#020918", "#00d4ff"],
    theme: { accentColor: "#00d4ff", bgColor: "#020918", overlayOpacity: 0.5 },
  },
  {
    id: "clean-white",
    label: "Clean White",
    dots: ["#f5f5f5", "#1a1a1a"],
    theme: { accentColor: "#1a1a1a", bgColor: "#f0f0f0", overlayOpacity: 0.3 },
  },
  {
    id: "emerald",
    label: "Emerald",
    dots: ["#021a0d", "#00c853"],
    theme: { accentColor: "#00c853", bgColor: "#021a0d", overlayOpacity: 0.5 },
  },
  {
    id: "purple-haze",
    label: "Purple Haze",
    dots: ["#0d0520", "#8b5cf6"],
    theme: { accentColor: "#8b5cf6", bgColor: "#0d0520", overlayOpacity: 0.52 },
  },
];


// ─── Default Theme ────────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  accentColor: "#dc2626",
  bgColor: "#060910",
  // The dark scrim is now a movable gradient shape (see makeOverlayLayer), not a
  // baked background overlay — so the background gradient is off by default.
  overlayOpacity: 0.45,
  overlayStyle: "dark",
  overlayGradient: "none",
  textColor: "#ffffff",
  watermarkText: "",
  watermarkOpacity: 0.14,
  watermarkPos: "top-right",
  logoUrl: null,
  logoSize: 80,
  showAccentBar: true,
  showConditionBadge: false,
  showHotDealBadge: false,
  customBadgeText: "",
  badgeColor: "#dc2626",
  blurIntensity: 18,
};

// ─── Default elements builder ─────────────────────────────────────────────────
function buildDefaultElements(listing, theme, dealerName) {
  return [
    {
      id: "watermark",
      type: "text",
      content: dealerName || "",
      x: 1020,
      y: 72,
      fontSize: 24,
      fontWeight: "400",
      color: "rgba(255,255,255,0.35)",
      rotation: 0,
      opacity: 0.5,
      align: "right",
      visible: true,
      locked: true,
    },
  ];
}

// ─── Dark gradient overlay shape ──────────────────────────────────────────────
// The dark transparent scrim used to be baked into every slide's background as a
// fixed overlay. It is now a real, movable/rotatable/deletable shape seeded into
// every template — a full-bleed rect with a transparent dark gradient fill,
// sitting above the photo but behind the headline/price text (OVERLAY_Z).
function makeOverlayLayer(overrides = {}) {
  return makeLayer("rect", {
    label: "Gradient",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    gradient: DARK_SCRIM_GRADIENT,
    fill: "#060910",
    fillOpacity: 100,
    borderWidth: 0,
    borderRadius: 0,
    zIndex: OVERLAY_Z,
    // Covers the whole canvas: unlocked, it caught every tap meant for "empty
    // space", so nothing ever unselected. Unlock it from the Layers list to edit.
    locked: true,
    // The same gradient on every slide: All slides mode edits them together.
    link: "overlay",
    ...overrides,
  });
}

// ─── Build default slides ─────────────────────────────────────────────────────
function buildDefaultSlides(listing, images, features, dealerName, whatsapp) {
  const brand = listing?.brand || "";
  const model = listing?.model || "";
  const variant = listing?.variant || "";
  const year = String(listing?.year || "");
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
  const mileage = listing?.mileage
    ? Number(listing.mileage).toLocaleString() + " km"
    : "";
  const cond = listing?.condition || "";
  const condLabel =
    { new: "Brand New", recon: "Recon", used: "Used" }[cond] || cond;
  const statsLine = [year, condLabel, mileage].filter(Boolean).join(" · ");

  const makeSlide = (img, template) => ({
    id: uid(),
    imageUrl: img || null,
    template,
    carName: `${year} ${brand} ${model}${variant ? " " + variant : ""}`.trim(),
    priceStr,
    priceNum: price || 0,
    statsLine,
    hookText: "",
    features,
    condition: cond,
    dealerName: dealerName || "",
    whatsapp: whatsapp || "",
    monthly: calcMonthly(price),
    elements: buildDefaultElements(listing, DEFAULT_THEME, dealerName),
    layers: [makeOverlayLayer()],
    bgAdjust: { brightness: 1, contrast: 1, saturation: 1, warmth: 0, blur: 0, vignette: 0 },
  });

  if (!images.length) return [makeSlide(null, "hype")];
  const tpls = ["hype", "story", "pricing", "cta", "minimal", "hype", "hype"];
  return images.map((img, i) => makeSlide(img, tpls[i] || "hype"));
}

// ─── AI: rate limiting via Supabase ai_usage ──────────────────────────────────
async function getAIUsage(dealerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("dealer_id", dealerId)
    .eq("date", today)
    .maybeSingle();
  return data?.count || 0;
}
async function incrementAIUsage(dealerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ai_usage")
    .select("id,count")
    .eq("dealer_id", dealerId)
    .eq("date", today)
    .maybeSingle();
  if (data) {
    await supabase
      .from("ai_usage")
      .update({ count: data.count + 1 })
      .eq("id", data.id);
    return data.count + 1;
  }
  await supabase
    .from("ai_usage")
    .insert({ dealer_id: dealerId, date: today, count: 1 });
  return 1;
}

// ─── AI: canvas edit command ──────────────────────────────────────────────────
async function applyAICommand(command, elements, theme, selectedElementId) {
  const system = `You are a canvas design AI for TikTok car listing slides. Canvas is 1080x1920px. Return ONLY valid JSON: {"elements":[only changed elements with id + changed fields],"theme":{only changed theme fields}}. Never return unchanged items. x:0-1080, y:0-1920, fontSize:20-200.`;
  const res = await fetch(AI_MESSAGES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAIAuthHeaders()) },
    body: JSON.stringify({
      feature: "tiktok_studio",
      system,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            command,
            elements,
            selectedElementId,
            theme,
          }),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error("AI error");
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((b) => b.text || "").join("")
    : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}


// ─── renderBackground: image + gradient + chrome (no text elements) ───────────
// Used by both CanvasPreview (live background) and renderToCanvas (export).
async function renderBackground(
  canvas,
  slide,
  theme,
  fontId = "dm",
  CW = CANVAS_W,
  CH = CANVAS_H,
) {
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d");
  const W = CW;
  const H = CH;
  const fontObj = FONTS.find((f) => f.id === fontId) || FONTS[0];
  const fstack = fontObj.stack.replace(/'/g, "");

  ctx.clearRect(0, 0, W, H);

  // Hard clip — nothing can paint outside the canvas bounds
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  ctx.fillStyle = theme.bgColor || "#060910";
  ctx.fillRect(0, 0, W, H);

  // ── Car photo ────────────────────────────────────────────────────────────
  if (slide.imageUrl) {
    const img = await loadImage(slide.imageUrl);
    // A cut-out (Remove BG done) has no scene of its own. With a backdrop
    // picked (Premium) the scene is drawn and the car stands on its floor.
    const cutout = !!(img && slide.originalImageUrl);
    const backdrop = cutout && slide.backdrop && slide.backdrop !== "none" ? slide.backdrop : null;
    if (img && backdrop) {
      const adj = slide.bgAdjust || {};
      const place = placeCar({ bounds: cutoutBounds(img), W, H, zone: slide.carZone, fit: slide.carFit });
      drawBackdrop(ctx, backdrop, W, H, place.floorY, theme.accentColor);
      if (slide.carShadow !== false) drawCarShadow(ctx, place, backdrop === "light");
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = `brightness(${adj.brightness ?? 1}) contrast(${adj.contrast ?? 1}) saturate(${adj.saturation ?? 1}) sepia(${(adj.warmth ?? 0) * 0.6})${(adj.blur ?? 0) > 0 ? ` blur(${adj.blur}px)` : ""}`;
      ctx.drawImage(img, place.sx, place.sy, place.sw, place.sh, place.dx, place.dy, place.dw, place.dh);
      ctx.restore();
    } else if (img) {
      // Blurred background — cover fill (no black bars). Skipped for a
      // cut-out: blurring a clear PNG only smears a dark ghost of the car.
      if (!cutout) {
      ctx.save();
      ctx.filter = `blur(${theme.blurIntensity ?? 18}px) brightness(0.35)`;
      const bAr = img.naturalWidth / img.naturalHeight;
      const cAr = W / H;
      let bw, bh, bx, by;
      if (bAr > cAr) {
        bh = H;
        bw = H * bAr;
        bx = (W - bw) / 2;
        by = 0;
      } else {
        bw = W;
        bh = W / bAr;
        bx = 0;
        by = (H - bh) / 2;
      }
      ctx.drawImage(img, bx, by, bw, bh);
      ctx.restore();
      }

      // Main image — CONTAIN so full car is always visible
      ctx.save();
      const ar = img.naturalWidth / img.naturalHeight;
      const car = W / H;
      let dw, dh, dx, dy;
      if (ar > car) {
        dw = W;
        dh = W / ar;
        dx = 0;
        dy = (H - dh) / 2;
      } else {
        dh = H;
        dw = H * ar;
        dx = (W - dw) / 2;
        dy = 0;
      }
      const adj = slide.bgAdjust || {};
      const br = adj.brightness ?? 1;
      const co = adj.contrast ?? 1;
      const sa = adj.saturation ?? 1;
      const wa = adj.warmth ?? 0;
      const bl = adj.blur ?? 0;
      ctx.globalAlpha = 1.0;
      ctx.filter = `brightness(${br}) contrast(${co}) saturate(${sa}) sepia(${wa * 0.6})${bl > 0 ? ` blur(${bl}px)` : ""}`;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();

      // Vignette overlay
      const vg = adj.vignette ?? 0;
      if (vg > 0) {
        const vig = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.15, W / 2, H * 0.5, H * 0.72);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, `rgba(0,0,0,${(vg * 0.85).toFixed(2)})`);
        ctx.save();
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    if (img && backdrop) {
      const vg = slide.bgAdjust?.vignette ?? 0;
      if (vg > 0) {
        const vig = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.15, W / 2, H * 0.5, H * 0.72);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, `rgba(0,0,0,${(vg * 0.85).toFixed(2)})`);
        ctx.save();
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }

  // ── Gradient overlay ─────────────────────────────────────────────────────
  const overlayGrad = theme.overlayGradient || "none";
  const op = theme.overlayOpacity ?? 0.45;
  // Scale each stop's alpha linearly with overlayOpacity
  const gc = (a) => `rgba(6,9,16,${Math.min(1, a * op).toFixed(3)})`;
  if (overlayGrad !== "none") {
    let gradFill;
    if (overlayGrad === "standard") {
      gradFill = ctx.createLinearGradient(0, 0, 0, H);
      gradFill.addColorStop(0, gc(2.1)); // ~full dark at top
      gradFill.addColorStop(0.18, gc(0.18));
      gradFill.addColorStop(0.46, gc(0.08));
      gradFill.addColorStop(0.66, gc(1.8)); // strong dark at bottom text area
      gradFill.addColorStop(1, gc(2.2));
    } else if (overlayGrad === "top") {
      gradFill = ctx.createLinearGradient(0, 0, 0, H);
      gradFill.addColorStop(0, gc(2.1));
      gradFill.addColorStop(0.5, gc(0.08));
      gradFill.addColorStop(1, "rgba(6,9,16,0)");
    } else if (overlayGrad === "bottom") {
      gradFill = ctx.createLinearGradient(0, H, 0, 0);
      gradFill.addColorStop(0, gc(2.1));
      gradFill.addColorStop(0.5, gc(0.08));
      gradFill.addColorStop(1, "rgba(6,9,16,0)");
    }
    if (gradFill) {
      ctx.fillStyle = gradFill;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Accent bar ───────────────────────────────────────────────────────────
  if (theme.showAccentBar !== false) {
    ctx.fillStyle = theme.accentColor || "#dc2626";
    ctx.fillRect(0, 0, W, 6);
  }

  // ── Theme badges (condition / hot deal / custom) ─────────────────────────
  const acc = theme.accentColor || "#dc2626";
  const badgePad = 16,
    badgeH = 38,
    badgeR = 6;
  let badgeX = 60;
  const badgeY = H * 0.55;

  const drawBadge = (label, bg, fg) => {
    ctx.save();
    ctx.font = `700 22px ${fstack}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, tw + badgePad * 2, badgeH, badgeR);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, badgeX + badgePad, badgeY + badgeH / 2);
    badgeX += tw + badgePad * 2 + 12;
    ctx.restore();
  };

  if (theme.showConditionBadge && slide.condition) {
    const label =
      { new: "Brand New", recon: "Recon", used: "Used" }[slide.condition] ||
      slide.condition;
    drawBadge(label, acc, "#fff");
  }
  if (theme.showHotDealBadge) {
    drawBadge("🔥 HOT DEAL", "#f59e0b", "#000");
  }
  if (theme.customBadgeText) {
    drawBadge(theme.customBadgeText, theme.badgeColor || acc, "#fff");
  }

  // ── Logo ─────────────────────────────────────────────────────────────────
  if (theme.logoUrl) {
    const logoImg = await loadImage(theme.logoUrl);
    if (logoImg) {
      const sz = theme.logoSize || 80;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.drawImage(logoImg, W - 60 - sz, H - 180 - sz, sz, sz);
      ctx.restore();
    }
  }

  // ── Watermark ────────────────────────────────────────────────────────────
  if (theme.watermarkText && !slide.elements?.find((e) => e.id === "watermark")) {
    ctx.save();
    ctx.globalAlpha = theme.watermarkOpacity ?? 0.14;
    ctx.fillStyle = "#ffffff";
    ctx.font = `400 22px ${fstack}`;
    const isRight = !theme.watermarkPos || theme.watermarkPos.includes("right");
    const isBottom = theme.watermarkPos?.includes("bottom");
    ctx.textAlign = isRight ? "right" : "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      theme.watermarkText,
      isRight ? W - 60 : 60,
      isBottom ? H - 80 : 60,
    );
    ctx.restore();
  }

  // Close the hard clip opened at the top of renderBackground
  ctx.restore();
}

// ─── Export: render full slide (background + elements) to HTML5 canvas ────────
async function renderToCanvas(
  canvas,
  slide,
  theme,
  fontId = "dm",
  CW = CANVAS_W,
  CH = CANVAS_H,
) {
  await renderBackground(canvas, slide, theme, fontId, CW, CH);
  await renderElements(canvas, slide, theme, fontId, CW, CH);
}

// Composite background + below-text layers + text elements + above-text layers,
// so movable shapes (e.g. the dark gradient overlay) sit at the right depth in
// the export exactly as they do in the live preview.
async function renderComposite(
  canvas,
  slide,
  theme,
  fontId = "dm",
  CW = CANVAS_W,
  CH = CANVAS_H,
  layers = [],
) {
  const below = (layers || []).filter((l) => (l.zIndex ?? 20) < ELEMENT_PLANE_Z);
  const above = (layers || []).filter((l) => (l.zIndex ?? 20) >= ELEMENT_PLANE_Z);
  await renderBackground(canvas, slide, theme, fontId, CW, CH);
  await renderLayersToCanvas(canvas, below, CW, CH);
  await renderElements(canvas, slide, theme, fontId, CW, CH);
  await renderLayersToCanvas(canvas, above, CW, CH);
}

// Text / badge elements pass — drawn on top of the background.
async function renderElements(
  canvas,
  slide,
  theme,
  fontId = "dm",
  CW = CANVAS_W,
  CH = CANVAS_H,
) {
  const ctx = canvas.getContext("2d");
  const W = CW;
  const H = CH;
  const fontObj = FONTS.find((f) => f.id === fontId) || FONTS[0];
  const fstack = fontObj.stack.replace(/'/g, "");

  // Wait for every webfont the elements use — canvas silently substitutes a
  // fallback face for unloaded fonts, which changes glyph sizes and is why
  // downloads used to drift from the preview.
  try {
    const loads = [];
    for (const el of slide.elements || []) {
      if (!el.visible || !el.content) continue;
      const fam = (el.fontFamily || fontObj.stack).replace(/'/g, "").split(",")[0].trim();
      loads.push(
        document.fonts.load(
          `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight || "400"} ${el.fontSize || 32}px "${fam}"`,
        ),
      );
    }
    await Promise.all(loads);
  } catch {}

  for (const el of slide.elements || []) {
    if (!el.visible) continue;

    if (!el.content) continue; // skip empty elements
    if (el.type === "badge") {
      // Match HTML CanvasElement badge exactly:
      // box top-left at (el.x, el.y), padding 6px vertical / 14px horizontal
      const padH = 14;
      const padV = 6;
      const elFont = el.fontFamily ? el.fontFamily.replace(/'/g, "") : fstack;
      const fontSize = el.fontSize || 28;
      ctx.font = `${el.fontWeight || "700"} ${fontSize}px ${elFont}`;
      const tw = ctx.measureText(el.content).width;
      const bw = tw + padH * 2;
      const bh = Math.round(fontSize * 1.3) + padV * 2;
      const br = el.borderRadius !== undefined ? el.borderRadius : 999;
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      ctx.translate(el.x, el.y);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = el.bgColor || el.color || "#dc2626";
      ctx.beginPath();
      ctx.roundRect(0, 0, bw, bh, br);
      ctx.fill();
      // Badge text: honor an explicit text color when the badge also defines
      // its own bgColor (legacy badges used `color` AS the background).
      ctx.fillStyle = el.bgColor && el.color ? el.color : "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(el.content, padH, padV);
      ctx.restore();
      continue;
    }

    const elFont2 = el.fontFamily ? el.fontFamily.replace(/'/g, "") : fstack;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
    ctx.font = `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight || "400"} ${el.fontSize || 32}px ${elFont2}`;
    // Background fill — box starts at 0 (matching HTML div left edge at el.x)
    const pad2 = 10;
    if (el.bgColor) {
      const tw2 = ctx.measureText(el.content || "").width;
      ctx.fillStyle = el.bgColor;
      ctx.beginPath();
      ctx.roundRect(
        0,
        0,
        tw2 + pad2 * 2,
        (el.fontSize || 32) * 1.3,
        6,
      );
      ctx.fill();
    }
    // Always left-align: HTML whiteSpace:nowrap div always renders text at el.x
    // regardless of textAlign setting — match that behaviour here.
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const textX = el.bgColor ? pad2 : 0;
    // Text stroke (outline) — drawn first so fill sits on top, matching the
    // HTML preview's paint-order: stroke fill. lineWidth is 2x because canvas
    // strokes are centered on the glyph edge (half inside, half outside).
    if (el.strokeWidth > 0) {
      ctx.lineWidth = el.strokeWidth * 2;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = el.strokeColor || "#000000";
      ctx.strokeText(el.content || "", textX, 0);
    }
    // Gradient text: build a canvas gradient across the glyph box, matching
    // the CSS background-clip:text preview.
    if (el.gradient && el.gradient.stops?.length >= 2) {
      const tw = ctx.measureText(el.content || "").width;
      const th = el.fontSize || 32;
      const ang = ((el.gradient.angle ?? 90) - 90) * (Math.PI / 180);
      const cx0 = textX + tw / 2, cy0 = th / 2;
      const half = Math.max(tw, th) / 2;
      const g = ctx.createLinearGradient(
        cx0 - Math.cos(ang) * half, cy0 - Math.sin(ang) * half,
        cx0 + Math.cos(ang) * half, cy0 + Math.sin(ang) * half,
      );
      [...el.gradient.stops].sort((a, b) => a.pos - b.pos).forEach((s) =>
        g.addColorStop(Math.max(0, Math.min(1, s.pos / 100)), s.color),
      );
      ctx.fillStyle = g;
      ctx.fillText(el.content || "", textX, 0);
    } else if (el.color !== "transparent") {
      // "Invisible" fill (stroke-only text) skips the fill passes entirely
      ctx.fillStyle = el.color || "#fff";
      if (el.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
      }
      ctx.fillText(el.content || "", textX, 0);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      if (el.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        ctx.fillText(el.content || "", textX, 0);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
    }
    ctx.restore();
  }
}

// ─── CanvasElement ─────────────────────────────────────────────────────────────
// Pure rendering only — no selection visuals. SelectionOverlay handles all that.
function CanvasElement({
  el,
  scale,
  highlighted,
  fontStack,
  onSelect,
  onStartDrag,
  onDoubleClick,
}) {
  // Double-tap to edit, measured here: phones do not reliably fire dblclick.
  const lastTap = React.useRef(0);
  if (!el.visible) return null;

  const sharedStyle = {
    position: "absolute",
    left: el.x * scale,
    top: el.y * scale,
    opacity: el.opacity ?? 1,
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: "center",
    cursor: el.locked ? "default" : "pointer",
    userSelect: "none",
    WebkitUserSelect: "none",
    // This finger is ours: without it a vertical drag scrolled the page instead.
    touchAction: "none",
    animation: highlighted ? "ttsv3-highlight 0.6s ease" : "none",
  };

  const handlers = {
    onClick: (e) => {
      e.stopPropagation();
      onSelect(el.id);
      const now = Date.now();
      if (now - lastTap.current < 320 && !el.locked) {
        lastTap.current = 0;
        onDoubleClick(el.id);
      } else {
        lastTap.current = now;
      }
    },
    onMouseDown: (e) => {
      if (el.locked) return;
      e.stopPropagation();
      onStartDrag(e, el.id);
    },
    onTouchStart: (e) => {
      if (el.locked) return;
      e.stopPropagation();
      onStartDrag(e, el.id);
    },
  };

  if (el.type === "badge") {
    return (
      <div
        data-el-id={el.id}
        style={{
          ...sharedStyle,
          background: el.bgColor || el.color || "#dc2626",
          color: el.bgColor && el.color ? el.color : "#fff",
          fontSize: el.fontSize * scale,
          fontWeight: el.fontWeight,
          fontFamily: el.fontFamily || fontStack,
          padding: `${6 * scale}px ${14 * scale}px`,
          borderRadius: (el.borderRadius ?? 999) * scale,
          whiteSpace: "nowrap",
          zIndex: 10,
          lineHeight: 1.3,
        }}
        {...handlers}
      >
        {el.content}
      </div>
    );
  }

  // Gradient text clips a gradient to the glyphs; it needs `background` for the
  // clip so it can't coexist with a background box — gradient wins.
  const grad = el.gradient ? gradientCss(el.gradient) : null;
  return (
    <div
      data-el-id={el.id}
      style={{
        ...sharedStyle,
        fontSize: el.fontSize * scale,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle || "normal",
        color: grad ? "transparent" : el.color,
        textAlign: el.align,
        fontFamily: el.fontFamily || fontStack,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        zIndex: 10,
        textShadow: el.shadow && el.color !== "transparent" && !grad
          ? "0 2px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.9)"
          : "none",
        WebkitTextStroke: el.strokeWidth > 0
          ? `${el.strokeWidth * scale}px ${el.strokeColor || "#000000"}`
          : undefined,
        paintOrder: "stroke fill",
        ...(grad
          ? {
              backgroundImage: grad,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              padding: 0,
            }
          : {
              background: el.bgColor || "transparent",
              padding: el.bgColor ? `${4 * scale}px ${10 * scale}px` : 0,
              borderRadius: el.bgColor ? 6 * scale : 0,
            }),
      }}
      {...handlers}
    >
      {el.content}
    </div>
  );
}

// ─── SelectionOverlay ──────────────────────────────────────────────────────────
// Separate bounding-box overlay — matches how Canva/Figma/tldraw work.
// Measures the actual rendered element via getBoundingClientRect so the box
// is always pixel-perfect regardless of text length, rotation, or fontSize.
function SelectionOverlay({
  elId,
  el,
  canvasInnerRef,
  onStartResize,
  onStartRotate,
  onUpdate,
  onDuplicate,
  onToggleLock,
  onDelete,
}) {
  const [bounds, setBounds] = React.useState(null);

  React.useEffect(() => {
    if (!canvasInnerRef?.current || !elId) {
      setBounds(null);
      return;
    }
    const measure = () => {
      const container = canvasInnerRef.current;
      const div = container?.querySelector(`[data-el-id="${elId}"]`);
      if (!div || !container) {
        setBounds(null);
        return;
      }
      const cRect = container.getBoundingClientRect();
      const eRect = div.getBoundingClientRect();
      setBounds({
        left: eRect.left - cRect.left,
        top: eRect.top - cRect.top,
        width: eRect.width,
        height: eRect.height,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    const container = canvasInnerRef.current;
    const div = container?.querySelector(`[data-el-id="${elId}"]`);
    if (div) ro.observe(div);
    // Also re-measure on animation frame to catch position changes during drag
    let raf;
    const loop = () => {
      measure();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [elId, canvasInnerRef, el]);

  if (!bounds || el?.locked) return null;

  const PAD = 4;
  const H = 8; // visual handle square size
  const HALF = H / 2;
  const HIT = 28; // touch/click hit area
  const HITHALF = HIT / 2;

  const hitBase = {
    position: "absolute",
    width: HIT,
    height: HIT,
    background: "transparent",
    pointerEvents: "all",
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "none",
  };

  const dotStyle = {
    width: H,
    height: H,
    background: "#ffffff",
    border: "1.5px solid #2563eb",
    borderRadius: 2,
    boxSizing: "border-box",
    boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
    pointerEvents: "none",
  };

  const corners = [
    { pos: "nw", style: { top: -HITHALF, left: -HITHALF, cursor: "nw-resize" } },
    { pos: "ne", style: { top: -HITHALF, right: -HITHALF, cursor: "ne-resize" } },
    { pos: "sw", style: { bottom: -HITHALF, left: -HITHALF, cursor: "sw-resize" } },
    { pos: "se", style: { bottom: -HITHALF, right: -HITHALF, cursor: "se-resize" } },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: bounds.left - PAD,
        top: bounds.top - PAD,
        width: bounds.width + PAD * 2,
        height: bounds.height + PAD * 2,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {/* 1px clean selection border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "1.5px solid rgba(255,255,255,0.88)",
          borderRadius: 2,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />

      {/* Corner resize handles — large invisible hit area, small visible dot */}
      {corners.map(({ pos, style }) => (
        <div
          key={pos}
          style={{ ...hitBase, ...style }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartResize(e, elId, pos);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onStartResize(e, elId, pos);
          }}
        >
          <div style={dotStyle} />
        </div>
      ))}

      {/* Rotate handle — above top-center; large transparent hit area */}
      <div
        style={{
          position: "absolute",
          top: -(30 + HALF + 14),
          left: "50%",
          transform: "translateX(-50%)",
          width: 36,
          height: 44,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          pointerEvents: "all",
          cursor: "grab",
          gap: 0,
          zIndex: 4,
          touchAction: "none",
          background: "transparent",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartRotate(e, elId);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartRotate(e, elId);
        }}
      >
        <div
          style={{
            width: 1.5,
            height: 18,
            background: "rgba(255,255,255,0.45)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            width: H + 2,
            height: H + 2,
            borderRadius: "50%",
            background: "#fff",
            border: "1.5px solid #2563eb",
            boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "#2563eb",
            lineHeight: 1,
            fontWeight: 700,
            pointerEvents: "none",
          }}
        >
          ↻
        </div>
      </div>

      {/* Mini bar: Duplicate / Lock / Delete, the same three as over a shape
          (STUDIO-UX-2). Every other setting lives in the text's own tools, so
          nothing here repeats a panel control. Flips below the element near
          the top edge so it is never cut off. */}
      <div
        style={{
          position: "absolute",
          ...(bounds.top < 130
            ? { top: "100%", marginTop: 14 }
            : { bottom: "100%", marginBottom: 38 }),
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          pointerEvents: "all",
          background: "#181b21",
          borderRadius: 12,
          padding: "0 2px",
          height: 44,
          boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
          whiteSpace: "nowrap",
          zIndex: 5,
        }}
      >
        <MiniBtn onClick={onDuplicate} title="Duplicate"><Copy size={17} /></MiniBtn>
        <MiniBtn onClick={onToggleLock} title="Lock"><Lock size={17} /></MiniBtn>
        <MiniBtn danger onClick={onDelete} title="Delete"><Trash2 size={17} /></MiniBtn>
      </div>
    </div>
  );
}

function MiniBtn({ children, onClick, danger, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 40,
        height: 40,
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        background: "transparent",
        color: danger ? "#f87171" : "#f2f4f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── InlineEditor ─────────────────────────────────────────────────────────────
function InlineEditor({ el, scale, onCommit, onCancel }) {
  const [val, setVal] = useState(el.content);
  return (
    <div
      style={{
        position: "absolute",
        left: el.x * scale,
        top: el.y * scale,
        zIndex: 60,
        transform: `rotate(${el.rotation || 0}deg)`,
        transformOrigin: "top left",
      }}
    >
      <textarea
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onCommit(val);
          }
        }}
        onBlur={() => onCommit(val)}
        style={{
          fontSize: el.fontSize * scale,
          fontWeight: el.fontWeight,
          color: el.color,
          fontFamily: "inherit",
          background: "rgba(0,0,0,0.8)",
          border: "2px solid #2563eb",
          borderRadius: 4,
          padding: 4,
          outline: "none",
          resize: "both",
          minWidth: 80,
          lineHeight: 1.2,
        }}
      />
    </div>
  );
}

// ─── CanvasPreview ────────────────────────────────────────────────────────────
// Background is rendered to an HTML5 canvas using the EXACT same code as
// renderToCanvas — guaranteeing what-you-see-is-what-you-get.
// Interactive text/badge elements are overlaid as divs on top.
function CanvasPreview({
  slide,
  theme,
  scale,
  fontStack,
  fontId,
  selectedId,
  highlightIds,
  aiLoading,
  canvasW,
  canvasH,
  onSelectElement,
  onDeselectAll,
  onStartDrag,
  onStartResize,
  onStartRotate,
  onDoubleClickElement,
  editingId,
  onCommitEdit,
  onCancelEdit,
  selectedEl,
  onUpdateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  innerRef,
  hideInteractive = false,
}) {
  const bgCanvasRef = React.useRef(null);
  const localRef = React.useRef(null);

  const combinedRef = (node) => {
    localRef.current = node;
    if (typeof innerRef === "function") innerRef(node);
    else if (innerRef) innerRef.current = node;
  };

  const CW = canvasW || CANVAS_W;
  const CH = canvasH || CANVAS_H;
  const W = CW * scale;
  const H = CH * scale;

  // ── Render background to canvas whenever anything visual changes ──────────
  React.useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    // renderBackground is async; we discard stale renders via a cancelled flag
    let cancelled = false;
    renderBackground(canvas, slide, theme, fontId || "dm", CW, CH)
      .then(() => {
        // nothing extra needed; canvas is updated in-place
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Stringify theme so effect re-runs only when values actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slide.imageUrl,
    slide.condition,
    CW,
    CH,
    fontId,
    theme.bgColor,
    theme.overlayOpacity,
    theme.overlayGradient,
    theme.blurIntensity,
    theme.accentColor,
    theme.showAccentBar,
    theme.showConditionBadge,
    theme.showHotDealBadge,
    theme.customBadgeText,
    theme.badgeColor,
    theme.logoUrl,
    theme.logoSize,
    theme.watermarkText,
    theme.watermarkOpacity,
    theme.watermarkPos,
    // bgAdjust — stringify so any slider change triggers re-render
    JSON.stringify(slide.bgAdjust),
    // Backdrop (Premium, after Remove BG)
    slide.originalImageUrl,
    slide.backdrop,
    slide.carShadow,
    JSON.stringify(slide.carFit),
    JSON.stringify(slide.carZone),
  ]);

  return (
    <div
      ref={combinedRef}
      onClick={onDeselectAll}
      onTouchEnd={(e) => {
        // Issue 5: Tap on empty canvas background deselects layers on mobile
        if (e.target === e.currentTarget || e.target.tagName === "CANVAS") {
          onDeselectAll();
        }
      }}
      style={{
        position: "relative",
        width: W,
        height: H,
        // overflow stays visible so selection handles / toolbars never clip
        // at the canvas edge; the element layer below clips content itself.
        borderRadius: 4,
        userSelect: "none",
        flexShrink: 0,
        background: "#0a0d14",
        isolation: "isolate",
        zIndex: 10, // Fix 2: template sits at z=10; user layers at z<10 go behind, z>10 in front
      }}
    >
      {/* ── Background canvas: pixel-perfect match to export ── */}
      <canvas
        ref={bgCanvasRef}
        width={CW}
        height={CH}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          borderRadius: 4,
        }}
      />

      {/* ── Car photo placeholder (template applied, no image yet) ── */}
      {slide.carZone && !slide.imageUrl && (
        <div
          style={{
            position: "absolute",
            left: `${slide.carZone.x}%`,
            top: `${slide.carZone.y}%`,
            width: `${slide.carZone.w}%`,
            height: `${slide.carZone.h}%`,
            border: "2px dashed rgba(255,255,255,0.55)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6 * scale,
            pointerEvents: "none",
            zIndex: 9,
          }}
        >
          <span style={{ fontSize: 26 * scale, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
            Your car here
          </span>
          {slide.carZone.hint && (
            <span style={{ fontSize: 17 * scale, color: "rgba(255,255,255,0.55)", textAlign: "center", padding: `0 ${20 * scale}px` }}>
              📐 {slide.carZone.hint}
            </span>
          )}
        </div>
      )}

      {/* ── AI loading overlay ── */}
      {aiLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 36 * scale,
                height: 36 * scale,
                margin: "0 auto 10px",
                border: `${3 * scale}px solid rgba(37,99,235,0.3)`,
                borderTop: `${3 * scale}px solid #2563eb`,
                borderRadius: "50%",
                animation: "ttsv3-spin 0.8s linear infinite",
              }}
            />
            <p
              style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 * scale }}
            >
              AI is editing…
            </p>
          </div>
        </div>
      )}

      {/* ── Interactive text / badge elements layer (skipped when hideInteractive) ── */}
      {!hideInteractive && (
        <>
          <div style={{ position: "absolute", inset: 0, zIndex: 10, overflow: "hidden" }}>
            {(slide.elements || [])
              .filter((el) => el.id !== "watermark")
              .map((el) => (
                <React.Fragment key={el.id}>
                  {editingId === el.id ? (
                    <InlineEditor
                      el={el}
                      scale={scale}
                      onCommit={(v) => onCommitEdit(el.id, v)}
                      onCancel={onCancelEdit}
                    />
                  ) : (
                    <CanvasElement
                      el={el}
                      scale={scale}
                      highlighted={(highlightIds || []).includes(el.id)}
                      fontStack={fontStack}
                      onSelect={onSelectElement}
                      onStartDrag={onStartDrag}
                      onDoubleClick={onDoubleClickElement}
                    />
                  )}
                </React.Fragment>
              ))}
          </div>

          {/* ── Selection overlay ── */}
          {selectedEl && selectedId && !editingId && !selectedEl.locked && (
            <SelectionOverlay
              elId={selectedId}
              el={selectedEl}
              canvasInnerRef={localRef}
              onStartResize={onStartResize}
              onStartRotate={onStartRotate}
              onUpdate={onUpdateSelected}
              onDuplicate={onDuplicateSelected}
              onDelete={onDeleteSelected}
            />
          )}
        </>
      )}
    </div>
  );
}








// ─── Studio UI kit (STUDIO-UX-2) ──────────────────────────────────────────────
// The tool panels' look: premiumDark tones (src/theme/tokens.js), depth by
// tone, red only as a fill, 44px touch targets. Module-level so they are
// stable component types (safe to render as JSX).
const C = {
  bg: "#08090c",
  card: "#111318",
  raised: "#181b21",
  hover: "#1f232a",
  sel: "#2a2f38",
  line: "rgba(255,255,255,0.06)",
  text: "#f2f4f7",
  sec: "#a3a9b5",
  muted: "#848b98",
  red: "#dc2626",
  redText: "#f87171",
};
const STUDIO_FONT = "var(--xd-font-body, system-ui), system-ui, sans-serif";
const segStyle = (on) => ({
  flex: 1,
  minWidth: 0,
  height: 36,
  borderRadius: 9,
  border: "none",
  background: on ? C.sel : "transparent",
  color: on ? C.text : C.sec,
  fontSize: 13,
  fontWeight: on ? 600 : 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  fontFamily: "inherit",
  whiteSpace: "nowrap",
});
const tileStyle = (on = false) => ({
  height: 44,
  borderRadius: 12,
  border: "none",
  background: on ? C.sel : C.raised,
  color: C.text,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: "inherit",
  padding: "0 10px",
});
const primaryBtn = { ...tileStyle(), background: C.red, color: "#fff", fontWeight: 600, flex: 1 };
const inputStyle = {
  width: "100%",
  height: 44,
  padding: "0 12px",
  background: C.raised,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  color: C.text,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function SLabel({ children, style }) {
  return <div style={{ fontSize: 12, color: C.sec, margin: "14px 0 8px", ...style }}>{children}</div>;
}
function SNote({ children }) {
  return <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, margin: "0 0 10px" }}>{children}</p>;
}
function SSeg({ items, value, onPick, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", padding: 3, borderRadius: 12, background: C.raised, gap: 2 }}>
      {items.map(([v, l]) => (
        <button key={String(v)} aria-pressed={value === v} onClick={() => onPick(v)} style={segStyle(value === v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
function SSlider({ label, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: C.sec }}>{label}</span>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt ? fmt(value) : value}</span>
      </div>
      <DragSlider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}
function SSwitch({ label, value, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={!!value}
      onClick={() => onChange(!value)}
      style={{ ...tileStyle(), width: "100%", justifyContent: "space-between", padding: "0 12px", marginBottom: 6 }}
    >
      <span>{label}</span>
      <span style={{ width: 38, height: 22, borderRadius: 999, background: value ? C.text : "#3a404b", position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: value ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: value ? C.bg : C.sec }} />
      </span>
    </button>
  );
}
// Quick colours + any colour. `presets` are hex strings.
function SColorPick({ label, value, onChange, presets }) {
  const cur = (value || "").toLowerCase();
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <div style={{ fontSize: 12, color: C.sec, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {presets.map((p) => (
          <button
            key={p}
            aria-label={`Colour ${p}`}
            aria-pressed={cur === p.toLowerCase()}
            onClick={() => onChange(p)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              padding: 0,
              cursor: "pointer",
              background: p,
              border: `2px solid ${C.card}`,
              boxShadow: cur === p.toLowerCase() ? `0 0 0 2px ${C.text}` : "0 0 0 1px rgba(255,255,255,0.14)",
            }}
          />
        ))}
        <label
          aria-label="Pick any colour"
          style={{ position: "relative", width: 34, height: 34, borderRadius: 999, border: `1px dashed ${C.muted}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.sec, cursor: "pointer" }}
        >
          <Plus size={14} />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
          />
        </label>
      </div>
    </div>
  );
}

const DEF_ADJ = { brightness: 1, contrast: 1, saturation: 1, warmth: 0, blur: 0, vignette: 0 };
const signedOf = (v, d) => {
  const n = Math.round((v - d) * 100);
  return (n > 0 ? "+" : "") + n;
};
const PHOTO_ADJUST = [
  { key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.01, def: 1, fmt: (v) => signedOf(v, 1) },
  { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.01, def: 1, fmt: (v) => signedOf(v, 1) },
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01, def: 1, fmt: (v) => signedOf(v, 1) },
  { key: "warmth", label: "Warmth", min: 0, max: 1, step: 0.01, def: 0, fmt: (v) => `${Math.round(v * 100)}` },
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.5, def: 0, fmt: (v) => `${v}` },
  { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.01, def: 0, fmt: (v) => `${Math.round(v * 100)}` },
];

// ─── Main Component ───────────────────────────────────────────────────────────
// Small preview tile of a backdrop scene for the picker.
function BackdropSwatch({ id, accent, active, label, onPick }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 54;
    c.height = 84;
    ctx.fillStyle = "#1f2128";
    ctx.fillRect(0, 0, 54, 84);
    if (id !== "none") drawBackdrop(ctx, id, 54, 84, 84 * 0.66, accent);
  }, [id, accent]);
  return (
    <button onClick={onPick} aria-pressed={active}
      style={{ flex: "0 0 auto", background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ display: "block", width: 54, height: 84, borderRadius: 8, overflow: "hidden", boxShadow: active ? "0 0 0 2px #fff" : "0 0 0 1px rgba(255,255,255,0.12)", position: "relative" }}>
        <canvas ref={ref} style={{ width: 54, height: 84, display: "block" }} />
        {id === "none" && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Off</span>}
      </span>
      <span style={{ fontSize: 10, color: active ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

// `backdrops`: Salesman Premium only (SalesmanPremium.jsx passes it). Unlocks
// drawn scenes behind a cut-out car; see src/components/studio/backdrops.js.
export default function TikTokStudioV3({ listing, onClose, backdrops = false }) {
  // ── State ────────────────────────────────────────────────────────────────
  const [slides, setSlides] = useState([]);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  // The slide photo is a selectable thing too (its own tools), entered from
  // the slide's Photo tool. Tapping empty canvas leaves it (STUDIO-UX-2).
  const [photoSel, setPhotoSel] = useState(false);
  // "This slide | All slides": in All, an edit reaches the same object on
  // every slide, live (src/components/studio/scope.js).
  const [scopeAll, setScopeAll] = useState(false);
  // Desktop: the tool tab last used per kind of object, so it reopens there.
  const [lastTool, setLastTool] = useState({});
  // Desktop inspector showing the Add list or the Layers list instead.
  const [deskMode, setDeskMode] = useState(null);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [font, setFont] = useState("dm");
  const [aiCmd, setAiCmd] = useState("");
  const [applyingCmd, setApplyingCmd] = useState(false);
  const [aiUsage, setAiUsage] = useState({ count: 0, loaded: false });
  const [highlightIds, setHighlightIds] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [dlIdx, setDlIdx] = useState(null);
  const [savedBrand, setSavedBrand] = useState(false);
  const [genError, setGenError] = useState(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState(null);
  const [removeBgStatus, setRemoveBgStatus] = useState(null); // "Downloading 12 of 47 MB" / "Removing..."
  const [cutoutSaved, setCutoutSaved] = useState(true); // tool already on this phone? (checked below)
  useEffect(() => { isCutoutModelSaved().then(setCutoutSaved); }, []);
  const [isMobile, setIsMobile] = useState(false);
  // Phone: the canvas area's REAL size, measured. It used to be guessed from
  // window.innerHeight once, so rotating, the browser bar hiding or a panel
  // opening left the canvas the wrong size (cut off or overflowing).
  const [mobArea, setMobArea] = useState({ w: 0, h: 0 });
  const mobAreaObs = useRef(null);
  const mobAreaRef = useCallback((node) => {
    mobAreaObs.current?.disconnect();
    mobAreaObs.current = null;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMobArea((p) => (Math.abs(p.w - width) < 1 && Math.abs(p.h - height) < 1 ? p : { w: width, h: height }));
    });
    ro.observe(node);
    mobAreaObs.current = ro;
  }, []);
  const [sheetPanel, setSheetPanel] = useState(null); // mobile bottom sheet
  // Measured size of the desktop canvas workspace div (excluding padding)
  const [desktopWrapperSize, setDesktopWrapperSize] = useState({
    w: 800,
    h: 600,
  });
  const desktopWrapperRef = useRef(null);
  // Measured CONTENT size of the desktop single-slide canvas row, so the
  // canvas fits the true available box without touching the top-level
  // `scale` that element-drag math depends on.
  const [canvasAreaSize, setCanvasAreaSize] = useState({ w: 0, h: 0 });
  const canvasAreaObs = useRef(null);
  const measureCanvasArea = useCallback((node) => {
    if (canvasAreaObs.current) {
      canvasAreaObs.current.disconnect();
      canvasAreaObs.current = null;
    }
    if (node) {
      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        setCanvasAreaSize({ w: width, h: height });
      });
      ro.observe(node);
      canvasAreaObs.current = ro;
      const r = node.getBoundingClientRect();
      // subtract the row's 24px h / 12px v padding to match contentRect
      setCanvasAreaSize({ w: Math.max(r.width - 48, 0), h: Math.max(r.height - 24, 0) });
    }
  }, []);
  const [userId, setUserId] = useState(null);
  const [canvasFormat, setCanvasFormat] = useState("9:16");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  useModalHistory(!!sheetPanel, () => setSheetPanel(null));
  const [camOverlay, setCamOverlay] = useState(null);
  const [libMsg, setLibMsg] = useState(null);
  const [customFonts, setCustomFonts] = useState([]);
  const [fontUploadErr, setFontUploadErr] = useState(null);
  const [showGradient, setShowGradient] = useState(false);

  // Load the user's uploaded fonts (IndexedDB) once, register them for use
  useEffect(() => {
    loadCustomFonts().then(setCustomFonts).catch(() => {});
  }, []);

  const handleFontUpload = useCallback(async (file) => {
    setFontUploadErr(null);
    if (!file) return;
    const okExt = /\.(ttf|otf|woff2?|)$/i.test(file.name) || /font/.test(file.type);
    if (!okExt) { setFontUploadErr("Use a .ttf, .otf or .woff file"); return; }
    if (file.size > 8 * 1024 * 1024) { setFontUploadErr("Font too large (max 8MB)"); return; }
    try {
      const meta = await saveCustomFont(file);
      setCustomFonts((p) => [meta, ...p.filter((f) => f.id !== meta.id)]);
    } catch {
      setFontUploadErr("Couldn't load that font file");
    }
  }, []);

  const removeCustomFont = useCallback(async (id) => {
    await deleteCustomFont(id);
    setCustomFonts((p) => p.filter((f) => f.id !== id));
  }, []);

  // ── Layer editor (shape/image layers per-slide) ──────────────────────────
  const {
    layers,
    selectedIds: layerSelectedIds,
    setLayers,
    addLayer,
    updateLayer,
    commitHistory: commitLayerHistory,
    deleteLayer,
    duplicateLayer,
    reorderLayers,
    shiftZ,
    selectLayer,
    clearSelection: clearLayerSelection,
    undo: undoLayer,
    redo: redoLayer,
    canUndo: canUndoLayer,
    canRedo: canRedoLayer,
  } = useLayerEditor([]);

  // Design library lives in the DB (studio_designs, RLS user-scoped, 5 max)
  // so a salesman's saved designs follow them across devices.
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [designName, setDesignName] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("studio_designs")
        .select("id, name, thumb, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) {
        setSavedDesigns(
          data.map((r) => ({
            id: r.id,
            name: r.name,
            thumb: r.thumb,
            savedAt: new Date(r.created_at).getTime(),
            ...(r.payload || {}),
          })),
        );
      }
    })();
  }, []);
  const [cmdHistory, setCmdHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ttsv3_ai_history") || "[]");
    } catch {
      return [];
    }
  });
  const [suggestions] = useState(() =>
    [...SUGGESTION_POOL].sort(() => Math.random() - 0.5).slice(0, 6),
  );

  // ── Canvas format dimensions ─────────────────────────────────────────────
  const currentFormat =
    FORMATS.find((f) => f.id === canvasFormat) || FORMATS[0];
  const CW = currentFormat.w;
  const CH = currentFormat.h;

  // ── Desktop: fit canvas to measured workspace, accounting for 24px padding each side
  const { displayW, displayH } = computeDisplaySize(
    CW / CH,
    Math.max(desktopWrapperSize.w - 48, 80),
    Math.max(desktopWrapperSize.h - 48, 80),
  );
  // scale factor used by element rendering (CanvasPreview, LayerCanvas, etc.)
  const scale = CW > 0 ? displayW / CW : 0.3;

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const history = useRef([]);
  const historyIdx = useRef(-1);

  // Back gesture: closes the open picker / sheet first, then the studio. Any
  // edit to the generated slides, or typed hook / AI text, asks before closing.
  const initialSlidesJson = useRef(null);
  useModalHistory(true, onClose, {
    isDirty: () =>
      !!aiCmd.trim() ||
      (initialSlidesJson.current !== null && JSON.stringify(slides) !== initialSlidesJson.current),
  });

  function pushHistory(newSlides) {
    const trimmed = history.current.slice(0, historyIdx.current + 1);
    trimmed.push(JSON.parse(JSON.stringify(newSlides)));
    history.current = trimmed.slice(-30);
    historyIdx.current = history.current.length - 1;
  }
  // ONE history for the whole design (STUDIO-UX-2). Layers used to keep their
  // own, behind a second Undo that only the desktop had, so a phone could not
  // undo a shape at all. Layer edits now land in the slides (the effect below)
  // and are recorded here; undo hands the restored slide's layers back to the
  // layer editor.
  const syncingLayers = useRef(true);
  const histTimer = useRef(null);
  function scheduleHistory() {
    clearTimeout(histTimer.current);
    histTimer.current = setTimeout(() => {
      setSlides((ss) => {
        pushHistory(ss);
        return ss;
      });
    }, 400);
  }
  function restoreHistory(idx) {
    const snap = JSON.parse(JSON.stringify(history.current[idx]));
    setSlides(snap);
    syncingLayers.current = true;
    setLayers(snap[Math.min(active, snap.length - 1)]?.layers || []);
  }
  function undo() {
    if (historyIdx.current <= 0) return;
    clearTimeout(histTimer.current);
    historyIdx.current--;
    restoreHistory(historyIdx.current);
  }
  function redo() {
    if (historyIdx.current >= history.current.length - 1) return;
    historyIdx.current++;
    restoreHistory(historyIdx.current);
  }

  // ── Interaction refs ─────────────────────────────────────────────────────
  const dragging = useRef(null);
  const resizing = useRef(null);
  const rotating = useRef(null);
  const pinching = useRef(null);
  const canvasInnerRef = useRef(null);
  const aiInputRef = useRef(null);
  const prevFormatRef = useRef("9:16");

  // ── Derived ──────────────────────────────────────────────────────────────
  const slide = useMemo(() => slides[active] || null, [slides, active]);
  const total = slides.length;
  const rawImages = useMemo(() => {
    const p = parseList(listing?.photos || listing?.images);
    return p.length ? p : listing?.image_url ? [listing.image_url] : [];
  }, [listing]);
  const features = useMemo(
    () =>
      parseList(listing?.features || listing?.extras || listing?.accessories),
    [listing],
  );
  const fontObj = useMemo(
    () => FONTS.find((f) => f.id === font) || FONTS[0],
    [font],
  );
  const selectedEl = useMemo(
    () => slide?.elements?.find((e) => e.id === selectedId) || null,
    [slide, selectedId],
  );
  const aiAtLimit = aiUsage.count >= AI_LIMIT;

  // Sync layer editor when active slide changes (each slide stores its own layers)
  useEffect(() => {
    syncingLayers.current = true;
    setLayers(slides[active]?.layers || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Persist layers back to the slide whenever they change, and record the
  // change in the one history (not when the editor was only loaded from it).
  useEffect(() => {
    setSlides((ss) => ss.map((s, i) => (i === active ? { ...s, layers } : s)));
    if (syncingLayers.current) {
      syncingLayers.current = false;
      return;
    }
    scheduleHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // Issue 1: Lock viewport zoom while studio is open (prevents browser pinch-zoom)
  useEffect(() => {
    const meta = document.querySelector("meta[name=viewport]");
    const original = meta?.getAttribute("content");
    meta?.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
    );
    // Prevent pinch-zoom and page scroll while studio is open
    const blockTouch = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    const blockWheel = (e) => { if (e.ctrlKey) e.preventDefault(); };
    document.addEventListener("touchmove", blockTouch, { passive: false });
    document.addEventListener("wheel", blockWheel, { passive: false });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (original) meta?.setAttribute("content", original);
      document.removeEventListener("touchmove", blockTouch);
      document.removeEventListener("wheel", blockWheel);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      getAIUsage(user.id).then((count) => setAiUsage({ count, loaded: true }));
      supabase
        .from("profiles")
        .select("brand_color,font_choice,watermark_text,logo_url")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setTheme((t) => ({
            ...t,
            ...(data.brand_color ? { accentColor: data.brand_color } : {}),
            ...(data.watermark_text
              ? { watermarkText: data.watermark_text }
              : {}),
            ...(data.logo_url ? { logoUrl: data.logo_url } : {}),
          }));
          if (data.font_choice) setFont(data.font_choice);
        });
    });
  }, []);

  useEffect(() => {
    if (slides.length) return;
    const dealerName = listing?.dealer_name || "";
    const initial = buildDefaultSlides(
      listing,
      rawImages,
      features,
      dealerName,
      listing?.whatsapp_number || "",
    );
    setSlides(initial);
    initialSlidesJson.current = JSON.stringify(initial);
    syncingLayers.current = true;
    // The layer editor is synced from the slide only when `active` changes, and
    // `active` is already 0 when these first slides arrive. Without this, the
    // editor keeps the empty list it mounted with, and the persist effect below
    // then writes that empty list back over slide 1, deleting the dark gradient
    // overlay every template is seeded with.
    setLayers(initial[0]?.layers || []);
    pushHistory(initial);
    ensureFont("dm");
  }, [listing, rawImages, features]);

  // ── Normalize out-of-bounds element positions on each slide change ────────
  useEffect(() => {
    if (!slides.length) return;
    setSlides((ss) =>
      ss.map((s) => ({
        ...s,
        elements: s.elements.map((e) => ({
          ...e,
          x: Math.max(0, Math.min(CW - 40, e.x)),
          y: Math.max(0, Math.min(CH - 40, e.y)),
        })),
      })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CW, CH]);

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Desktop canvas workspace: measure available size via ResizeObserver ───
  useEffect(() => {
    const el = desktopWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDesktopWrapperSize({ w: width, h: height });
    });
    ro.observe(el);
    // Initial measurement
    const r = el.getBoundingClientRect();
    setDesktopWrapperSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  // ── Format change → refit elements + layers into the new aspect ratio ─────
  // Uniform scale + center (via fitCanvasContent) so switching format keeps
  // every element/layer INSIDE the frame and scales fontSize with it — the old
  // per-axis rescale distorted shapes and left text overflowing.
  // Always fit from the layout as it was BEFORE the first switch (`fmtBase`),
  // never from the last fit: fitting a fit shrank the design on every round
  // trip (9:16 -> 1:1 -> 9:16 came back at 56%). Any edit in between makes the
  // current layout the new base.
  const fmtBase = useRef(null);
  useEffect(() => {
    if (prevFormatRef.current === canvasFormat) return;
    const oldFmt = FORMATS.find((f) => f.id === prevFormatRef.current) || FORMATS[0];
    const newFmt = FORMATS.find((f) => f.id === canvasFormat) || FORMATS[0];
    // The active slide's layers live in the layer editor.
    const cur = slides.map((s, i) => (i === active ? { ...s, layers } : s));
    const keyOf = (ss) => JSON.stringify(ss.map((s) => [s.id, s.elements || [], s.layers || []]));
    let base = fmtBase.current;
    if (!base || base.key !== keyOf(cur)) {
      base = { w: oldFmt.w, h: oldFmt.h, byId: new Map(cur.map((s) => [s.id, { elements: s.elements || [], layers: s.layers || [] }])) };
    }
    const next = cur.map((s) => {
      const b = base.byId.get(s.id);
      if (!b) return s;
      const fitted = fitCanvasContent({ elements: b.elements, layers: b.layers, fromW: base.w, fromH: base.h, toW: newFmt.w, toH: newFmt.h });
      return { ...s, elements: fitted.elements, layers: fitted.layers };
    });
    fmtBase.current = { ...base, key: keyOf(next) };
    setSlides(next);
    setLayers(next[active]?.layers || []);
    prevFormatRef.current = canvasFormat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasFormat]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      // Undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Redo
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      const layerId = layerSelectedIds[0];
      if (e.key === "Escape") {
        selectedId || layerId || photoSel ? clearSelectionAll() : onClose();
      }
      if (e.key === "ArrowLeft") setActive((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActive((i) => Math.min(total - 1, i + 1));
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) deleteSelected();
        else if (layerId) removeLayer(layerId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && (selectedId || layerId)) {
        e.preventDefault();
        if (selectedId) duplicateSelected();
        else dupLayer(layerId);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // ── Element helpers ──────────────────────────────────────────────────────
  // Every element write goes through scope.js: This slide edits this object,
  // All slides edits it and its linked copies on every slide (STUDIO-UX-2).
  const allOn = scopeAll && total > 1;

  const updateElement = useCallback(
    (id, patch) => {
      // Clamp position patches so elements can't land outside canvas bounds
      const safePatch = { ...patch };
      if (safePatch.x !== undefined) safePatch.x = Math.max(0, Math.min(CW - 40, safePatch.x));
      if (safePatch.y !== undefined) safePatch.y = Math.max(0, Math.min(CH - 40, safePatch.y));
      setSlides((ss) => {
        const newSlides = patchElements(ss, active, id, safePatch, allOn);
        // Only push history when not actively dragging/resizing/rotating
        if (!dragging.current && !resizing.current && !rotating.current) {
          pushHistory(newSlides);
        }
        return newSlides;
      });
    },
    [active, allOn, CW, CH],
  );

  const updateSelectedElement = useCallback(
    (patch) => {
      if (selectedId) updateElement(selectedId, patch);
    },
    [selectedId, updateElement],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setSlides((ss) => {
      const newSlides = removeElements(ss, active, selectedId, allOn);
      pushHistory(newSlides);
      return newSlides;
    });
    setSelectedId(null);
  }, [selectedId, active, allOn]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId || !slide) return;
    const el = slide.elements.find((e) => e.id === selectedId);
    if (!el) return;
    const link = uid();
    const copyOf = (src) => ({ ...src, id: uid(), x: src.x + 30, y: src.y + 30, locked: false, link });
    const dup = copyOf(el);
    const key = allOn ? linkKey(el) : null;
    setSlides((ss) => {
      const newSlides = ss.map((s, i) => {
        if (i === active) return { ...s, elements: [...s.elements, dup] };
        const src = key && (s.elements || []).find((e) => linkKey(e) === key);
        return src ? { ...s, elements: [...s.elements, copyOf(src)] } : s;
      });
      pushHistory(newSlides);
      return newSlides;
    });
    setSelectedId(dup.id);
  }, [selectedId, slide, active, allOn]);

  const shiftElement = useCallback(
    (id, dir) => {
      setSlides((ss) => {
        const newSlides = shiftElements(ss, active, id, dir, allOn);
        pushHistory(newSlides);
        return newSlides;
      });
    },
    [active, allOn],
  );

  // A new element is always linked; in All slides mode it is added to every
  // slide at once, so the seller can keep editing it everywhere.
  const addElementScoped = useCallback(
    (base) => {
      const link = uid();
      const el = { ...base, id: uid(), link };
      setSlides((ss) => {
        let newSlides = ss.map((s, i) => (i !== active ? s : { ...s, elements: [...s.elements, el] }));
        if (allOn) newSlides = addToOthers(newSlides, active, "elements", () => ({ ...base, id: uid(), link }));
        pushHistory(newSlides);
        return newSlides;
      });
      clearLayerSelection();
      setPhotoSel(false);
      setSelectedId(el.id);
      return el;
    },
    [active, allOn, clearLayerSelection],
  );

  const addTextElement = useCallback(
    () =>
      addElementScoped({
        type: "text",
        content: "New Text",
        x: Math.round(CW * 0.18),
        y: Math.round(CH * 0.31),
        fontSize: 48,
        fontWeight: "700",
        color: "#ffffff",
        rotation: 0,
        opacity: 1,
        align: "left",
        visible: true,
        locked: false,
      }),
    [addElementScoped, CW, CH],
  );

  const addBadgeElement = useCallback(
    () =>
      addElementScoped({
        type: "badge",
        content: "HOT DEAL",
        x: 60,
        y: 200,
        fontSize: 52,
        fontWeight: "700",
        color: "#fff",
        bgColor: theme.accentColor || "#dc2626",
        rotation: 0,
        opacity: 1,
        align: "center",
        visible: true,
        locked: false,
      }),
    [addElementScoped, theme.accentColor],
  );

  // ── Layer helpers (scope-aware) ──────────────────────────────────────────
  // The active slide's layers live in the layer editor; the other slides'
  // linked copies are patched in `slides` directly.
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const patchLayer = useCallback(
    (id, patch, silent = false) => {
      updateLayer(id, patch, silent);
      if (!allOn) return;
      const key = linkKey(layersRef.current.find((l) => l.id === id));
      if (key) setSlides((ss) => patchOtherLayers(ss, active, key, patch));
    },
    [updateLayer, allOn, active],
  );

  const removeLayer = useCallback(
    (id) => {
      const key = allOn ? linkKey(layersRef.current.find((l) => l.id === id)) : null;
      deleteLayer(id);
      if (key) setSlides((ss) => removeOtherLayers(ss, active, key));
    },
    [deleteLayer, allOn, active],
  );

  const addLayerScoped = useCallback(
    (type, overrides = {}) => {
      const link = uid();
      const l = addLayer(type, { ...overrides, link });
      if (allOn) setSlides((ss) => addToOthers(ss, active, "layers", () => makeLayer(type, { ...overrides, link })));
      setSelectedId(null);
      setEditingId(null);
      setPhotoSel(false);
      return l;
    },
    [addLayer, allOn, active],
  );

  const dupLayer = useCallback(
    (id) => {
      const src = layersRef.current.find((l) => l.id === id);
      if (!src) return;
      const link = uid();
      // eslint-disable-next-line no-unused-vars
      const copyOf = ({ id: _id, ...o }) => ({
        ...o,
        x: o.x + 3,
        y: o.y + 3,
        label: `${o.label || o.type} copy`,
        zIndex: (o.zIndex ?? 20) + 1,
        locked: false,
        link,
      });
      addLayer(src.type, copyOf(src));
      const key = allOn ? linkKey(src) : null;
      if (key) {
        setSlides((ss) =>
          ss.map((s, i) => {
            if (i === active) return s;
            const o = (s.layers || []).find((l) => linkKey(l) === key);
            return o ? { ...s, layers: [...s.layers, makeLayer(o.type, copyOf(o))] } : s;
          }),
        );
      }
    },
    [addLayer, allOn, active],
  );

  const toggleLockLayer = useCallback(
    (id) => {
      const l = layersRef.current.find((x) => x.id === id);
      if (l) patchLayer(id, { locked: !l.locked });
    },
    [patchLayer],
  );

  // ── Selection: one thing at a time (element, layer, the photo, or none) ──
  const selectElement = useCallback(
    (id) => {
      setSelectedId(id);
      setEditingId(null);
      clearLayerSelection();
      setPhotoSel(false);
    },
    [clearLayerSelection],
  );
  const selectLayerOnly = useCallback(
    (id) => {
      selectLayer(id);
      setSelectedId(null);
      setEditingId(null);
      setPhotoSel(false);
    },
    [selectLayer],
  );
  const clearSelectionAll = useCallback(() => {
    setSelectedId(null);
    setEditingId(null);
    clearLayerSelection();
    setPhotoSel(false);
  }, [clearLayerSelection]);
  const selectPhoto = useCallback(() => {
    setSelectedId(null);
    setEditingId(null);
    clearLayerSelection();
    setPhotoSel(true);
  }, [clearLayerSelection]);

  // ── Drag / Resize / Rotate ───────────────────────────────────────────────
  const onStartDrag = useCallback(
    (e, id, dragScale) => {
      setSelectedId(id);
      clearLayerSelection();
      setPhotoSel(false);
      const el = slide?.elements?.find((el) => el.id === id);
      if (!el || el.locked) return;
      // Two-finger pinch on element → resize + move simultaneously
      if (e.touches && e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dist = Math.max(1, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        pinching.current = {
          id,
          startMidX: midX,
          startMidY: midY,
          startDist: dist,
          origX: el.x,
          origY: el.y,
          origFontSize: el.fontSize,
          dragScale,
        };
        dragging.current = null;
        e.preventDefault();
        return;
      }
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      dragging.current = {
        id,
        startX: cx,
        startY: cy,
        origX: el.x,
        origY: el.y,
        dragScale,
        moved: false,
      };
      e.preventDefault();
    },
    [slide, clearLayerSelection],
  );

  const onStartResize = useCallback(
    (e, id, handle, dragScale) => {
      const el = slide?.elements?.find((el) => el.id === id);
      if (!el) return;
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      const elDiv = canvasInnerRef.current?.querySelector(`[data-el-id="${id}"]`);
      const r = elDiv?.getBoundingClientRect();
      const centerX = r ? (r.left + r.right) / 2 : cx;
      const centerY = r ? (r.top + r.bottom) / 2 : cy;
      const startDist = Math.max(1, Math.hypot(cx - centerX, cy - centerY));
      resizing.current = {
        id,
        handle,
        startDist,
        centerX,
        centerY,
        origFontSize: el.fontSize,
        dragScale,
      };
      e.preventDefault();
      e.stopPropagation();
    },
    [slide],
  );

  const onStartRotate = useCallback(
    (e, id) => {
      const el = slide?.elements?.find((el) => el.id === id);
      if (!el || !canvasInnerRef.current) return;
      // Use actual rendered element center for accurate rotation pivot
      const elDiv = canvasInnerRef.current.querySelector(
        `[data-el-id="${id}"]`,
      );
      let centerX, centerY;
      if (elDiv) {
        const r = elDiv.getBoundingClientRect();
        centerX = (r.left + r.right) / 2;
        centerY = (r.top + r.bottom) / 2;
      } else {
        const rect = canvasInnerRef.current.getBoundingClientRect();
        centerX = rect.left + el.x * scale;
        centerY = rect.top + el.y * scale;
      }
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      rotating.current = {
        id,
        centerX,
        centerY,
        startAngle: Math.atan2(cy - centerY, cx - centerX) * (180 / Math.PI),
        origRotation: el.rotation || 0,
      };
      e.preventDefault();
      e.stopPropagation();
    },
    [slide, scale],
  );

  useEffect(() => {
    const onMove = (e) => {
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;

      if (pinching.current && e.touches && e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const dist = Math.max(1, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        const { id, startMidX, startMidY, startDist, origX, origY, origFontSize, dragScale } = pinching.current;
        const s = dragScale || scale;
        const ratio = dist / startDist;
        updateElement(id, {
          x: Math.max(0, Math.min(CW - 40, origX + (midX - startMidX) / s)),
          y: Math.max(0, Math.min(CH - 40, origY + (midY - startMidY) / s)),
          fontSize: Math.round(Math.max(16, Math.min(400, origFontSize * ratio))),
        });
        e.preventDefault();
        return;
      }

      if (dragging.current) {
        const { id, startX, startY, origX, origY, dragScale } = dragging.current;
        if (e.touches) e.preventDefault();
        // A tap wobbles a few pixels: only a real move drags the text.
        if (!dragging.current.moved) {
          if (Math.hypot(cx - startX, cy - startY) < DRAG_START_PX) return;
          dragging.current.moved = true;
        }
        const s = dragScale || scale;
        updateElement(id, {
          x: Math.max(0, Math.min(CW - 40, origX + (cx - startX) / s)),
          y: Math.max(0, Math.min(CH - 40, origY + (cy - startY) / s)),
        });
      }
      if (resizing.current) {
        const { id, startDist, centerX, centerY, origFontSize } = resizing.current;
        const newDist = Math.hypot(cx - centerX, cy - centerY);
        const ratio = newDist / startDist;
        updateElement(id, {
          fontSize: Math.round(
            Math.max(16, Math.min(400, origFontSize * ratio)),
          ),
        });
      }
      if (rotating.current) {
        const { id, centerX, centerY, startAngle, origRotation } =
          rotating.current;
        const angle = Math.atan2(cy - centerY, cx - centerX) * (180 / Math.PI);
        updateElement(id, {
          rotation: Math.round((origRotation + angle - startAngle + 360) % 360),
        });
      }
    };

    const onUp = () => {
      const wasDragging = !!(
        dragging.current?.moved ||
        resizing.current ||
        rotating.current ||
        pinching.current
      );
      dragging.current = null;
      resizing.current = null;
      rotating.current = null;
      pinching.current = null;
      // Push history snapshot after drag/resize/rotate ends
      if (wasDragging) {
        setSlides((ss) => {
          pushHistory(ss);
          return [...ss]; // new array ref forces re-render so button states update
        });
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    // A phone can cancel a touch mid-drag (a call, a system gesture); without
    // this the text stayed stuck to the next finger.
    document.addEventListener("touchcancel", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
    };
  }, [scale, updateElement, CW, CH]);

  const onCommitEdit = useCallback(
    (id, value) => {
      updateElement(id, { content: value });
      setEditingId(null);
    },
    [updateElement],
  );

  // ── AI command ───────────────────────────────────────────────────────────
  const runAICommand = useCallback(async () => {
    if (!aiCmd.trim() || applyingCmd || aiAtLimit) return;
    const cmd = aiCmd.trim();
    setApplyingCmd(true);
    setAiCmd("");
    setGenError(null);
    try {
      if (userId) {
        const newCount = await incrementAIUsage(userId);
        setAiUsage((u) => ({ ...u, count: newCount }));
      }
      const result = await applyAICommand(
        cmd,
        slide?.elements || [],
        theme,
        selectedId,
      );
      if (result.elements?.length) {
        setSlides((ss) => {
          const newSlides = ss.map((s, i) =>
            i !== active
              ? s
              : {
                  ...s,
                  elements: s.elements.map((el) => {
                    const changed = result.elements.find((c) => c.id === el.id);
                    return changed ? { ...el, ...changed } : el;
                  }),
                },
          );
          pushHistory(newSlides);
          return newSlides;
        });
        const ids = result.elements.map((e) => e.id);
        setHighlightIds(ids);
        setTimeout(() => setHighlightIds([]), 700);
      }
      if (result.theme) setTheme((t) => ({ ...t, ...result.theme }));
      setCmdHistory((h) => {
        const n = [cmd, ...h.filter((c) => c !== cmd)].slice(0, 5);
        localStorage.setItem("ttsv3_ai_history", JSON.stringify(n));
        return n;
      });
    } catch {
      setGenError("AI command failed. Try again.");
      setTimeout(() => setGenError(null), 4000);
    }
    setApplyingCmd(false);
  }, [aiCmd, applyingCmd, aiAtLimit, userId, slide, theme, selectedId, active]);

  // ── Brand Kit save ───────────────────────────────────────────────────────
  const saveBranding = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        brand_color: theme.accentColor,
        font_choice: font,
        watermark_text: theme.watermarkText,
        logo_url: theme.logoUrl,
      })
      .eq("id", user.id);
    setSavedBrand(true);
    setTimeout(() => setSavedBrand(false), 2500);
  }, [theme, font]);

  // ── Slide management ─────────────────────────────────────────────────────
  const patchSlide = useCallback(
    (patch) => {
      setSlides((ss) =>
        ss.map((s, i) => (i === active ? { ...s, ...patch } : s)),
      );
      scheduleHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active],
  );

  // Photo settings: this slide, or every slide in All slides mode. `fn(slide)`
  // returns the patch so one adjustment changes without wiping the others.
  const patchPhoto = useCallback(
    (fn) => {
      setSlides((ss) => patchPhotos(ss, active, fn, allOn));
      scheduleHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, allOn],
  );

  // ── Pro templates: apply a ready-made design to this slide, or all ─────
  // In All slides mode every slide gets the template built from ITS own data,
  // and the same object on each slide shares a link (`<run>-e<n>`), so later
  // edits in All slides mode reach all of them.
  const applyProTemplate = useCallback(
    (tpl) => {
      (tpl.fonts || []).forEach(ensureFont);
      setTheme((t) => ({ ...t, ...tpl.theme }));
      const images = [...uploadedImages, ...rawImages];
      // Templates are authored at CANVAS_W×CANVAS_H (1080×1920). Fit them into
      // the currently-selected format so they never spill off-frame.
      const build = (s) =>
        fitCanvasContent({
          elements: tpl.buildElements(buildTemplateCtx(listing, s, features, images)),
          layers: tpl.buildLayers ? tpl.buildLayers(buildTemplateCtx(listing, s, features, images)) : [],
          fromW: CANVAS_W,
          fromH: CANVAS_H,
          toW: CW,
          toH: CH,
        });
      const run = uid();
      const elsOf = (f) => f.elements.map((e, j) => ({ ...e, id: uid(), link: `${run}-e${j}` }));
      // The dark gradient overlay sits behind the template's own graphics so
      // the scrim is always present (and always a movable shape).
      const laysOf = (f) => [makeOverlayLayer(), ...f.layers.map((l, j) => makeLayer(l.type, { ...l, link: `${run}-l${j}` }))];
      const mine = build(slide);
      setSlides((ss) =>
        ss.map((s, i) => {
          if (i !== active && !allOn) return s;
          const f = i === active ? mine : build(s);
          const next = {
            ...s,
            template: "minimal", // pro templates draw their own chrome
            carZone: tpl.carZone,
            elements: [...s.elements.filter((e) => e.id === "watermark"), ...elsOf(f)],
          };
          if (i !== active) next.layers = laysOf(f);
          return next;
        }),
      );
      setLayers(laysOf(mine));
      setSelectedId(null);
    },
    [active, allOn, listing, slide, features, setLayers, uploadedImages, rawImages, CW, CH],
  );

  // Shapes are stored as % of width AND % of height — on a 9:16 canvas equal
  // percentages produce a 1:2.7 ellipse, not a circle. Correct the height at
  // creation so new shapes come out pixel-perfect.
  const addShapeAspect = useCallback(
    (type) => {
      const sq = (wPct, ratio = 1) => ({ width: wPct, height: ((wPct / 100) * CW * ratio / CH) * 100 });
      if (type === "gradient")
        return addLayerScoped("rect", {
          label: "Gradient",
          gradient: DARK_SCRIM_GRADIENT,
          x: 0, y: 0, width: 100, height: 100,
          borderWidth: 0, borderRadius: 0,
          zIndex: OVERLAY_Z,
        });
      if (type === "circle") return addLayerScoped("circle", sq(24, 1));
      if (type === "rect") return addLayerScoped("rect", sq(40, 0.62));
      if (type === "triangle") return addLayerScoped("triangle", sq(30, 0.9));
      return addLayerScoped(type);
    },
    [addLayerScoped, CW, CH],
  );

  // ── Camera: snapshot the current design (minus photo) as a ghost overlay ──
  const openCamera = useCallback(async () => {
    try {
      const c = document.createElement("canvas");
      // Include shape/text layers so the ghost matches the real design
      await renderComposite(c, { ...slide, imageUrl: null }, theme, font, CW, CH, layers || []);
      setCamOverlay(c.toDataURL("image/png"));
    } catch {
      setCamOverlay(null);
    }
    setShowCamera(true);
  }, [slide, theme, font, CW, CH, layers]);

  // "Use + shoot": apply the template, then open the camera with a ghost
  // built from the template itself (state hasn't flushed yet, so the ghost
  // can't come from `slide`).
  const openCameraWithTemplate = useCallback(
    async (tpl) => {
      applyProTemplate(tpl);
      try {
        const tctx = buildTemplateCtx(listing, slide, features, [...uploadedImages, ...rawImages]);
        // Match applyProTemplate: fit the authored template into the current format.
        const fitted = fitCanvasContent({
          elements: tpl.buildElements(tctx),
          layers: tpl.buildLayers ? tpl.buildLayers(tctx) : [],
          fromW: CANVAS_W,
          fromH: CANVAS_H,
          toW: CW,
          toH: CH,
        });
        const tmpSlide = {
          ...slide,
          imageUrl: null,
          template: "minimal",
          elements: [
            ...(slide?.elements || []).filter((e) => e.id === "watermark"),
            ...fitted.elements.map((e) => ({ ...e, id: uid() })),
          ],
        };
        const c = document.createElement("canvas");
        const ghostLayers = [
          makeOverlayLayer(),
          ...fitted.layers.map((l) => makeLayer(l.type, l)),
        ];
        await renderComposite(c, tmpSlide, { ...theme, ...tpl.theme }, font, CW, CH, ghostLayers);
        setCamOverlay(c.toDataURL("image/png"));
      } catch {
        setCamOverlay(null);
      }
      setShowCamera(true);
    },
    [applyProTemplate, listing, slide, features, uploadedImages, rawImages, theme, font, CW, CH],
  );

  const handleCameraCapture = useCallback(
    (dataUrl) => {
      setUploadedImages((p) => [dataUrl, ...p]);
      patchSlide({ imageUrl: dataUrl });
    },
    [patchSlide],
  );

  const uploadBgImage = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImages((p) => [reader.result, ...p]);
        patchSlide({ imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    },
    [patchSlide],
  );

  const addSlide = useCallback(() => {
    const s = {
      id: uid(),
      imageUrl: rawImages[0] || null,
      template: "hype",
      carName: `${listing?.brand || ""} ${listing?.model || ""}`.trim(),
      priceStr: listing?.selling_price
        ? "RM " + Number(listing.selling_price).toLocaleString()
        : "",
      priceNum: listing?.selling_price || 0,
      statsLine: "",
      hookText: "",
      features,
      condition: listing?.condition || "",
      dealerName: slide?.dealerName || "",
      whatsapp: slide?.whatsapp || "",
      monthly: calcMonthly(listing?.selling_price),
      elements: buildDefaultElements(listing, theme, slide?.dealerName || ""),
      layers: [makeOverlayLayer()],
      bgAdjust: { brightness: 1, contrast: 1, saturation: 1, warmth: 0, blur: 0, vignette: 0 },
    };
    setSlides((ss) => {
      const newSlides = [...ss, s];
      pushHistory(newSlides);
      return newSlides;
    });
    setTimeout(() => setActive(slides.length), 0);
  }, [slides.length, listing, rawImages, features, slide, theme]);

  const duplicateSlide = useCallback(() => {
    if (!slide) return;
    const dup = {
      ...slide,
      id: uid(),
      elements: slide.elements.map((e) => ({ ...e, id: uid() })),
    };
    setSlides((ss) => [...ss, dup]);
    setTimeout(() => setActive(slides.length), 0);
  }, [slide, slides.length]);

  const removeSlide = useCallback(
    (idx) => {
      if (total <= 1) return;
      setSlides((ss) => {
        const newSlides = ss.filter((_, i) => i !== idx);
        pushHistory(newSlides);
        return newSlides;
      });
      setActive((i) => Math.min(i, total - 2));
      setSelectedId(null);
    },
    [total],
  );

  const moveSlide = useCallback((idx, dir) => {
    const newIdx = idx + dir;
    setSlides((ss) => {
      if (newIdx < 0 || newIdx >= ss.length) return ss;
      const arr = [...ss];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      pushHistory(arr);
      return arr;
    });
    setActive(newIdx);
  }, []);

  const duplicateSlideAt = useCallback((idx) => {
    setSlides((ss) => {
      const src = ss[idx];
      if (!src) return ss;
      const dup = { ...src, id: uid(), elements: (src.elements || []).map((e) => ({ ...e, id: uid() })) };
      const arr = [...ss.slice(0, idx + 1), dup, ...ss.slice(idx + 1)];
      pushHistory(arr);
      return arr;
    });
    setActive(idx + 1);
  }, []);

  // ── Remove Background ────────────────────────────────────────────────────
  // Runs on the phone (src/lib/cutout): the photo is never uploaded, and the
  // car's pixels are the real photo. The tool downloads once (~47 MB).
  // One photo at a time, always this slide only (owner, 2026-10-29): never a
  // batch over every slide, and never a cut-out of a cut-out (each pass loses
  // edge detail), so a slide already cut offers "put it back" instead.
  const removeBg = useCallback(async () => {
    const s = slide;
    if (!s?.imageUrl || s.originalImageUrl) return;
    setRemovingBg(true);
    setRemoveBgError(null);
    setRemoveBgStatus(null);
    try {
      const resultBlob = await cutOutBackground(s.imageUrl, {
        onProgress: (p) => setRemoveBgStatus(p.stage === "download"
          ? `Getting the tool, once only: ${Math.round(p.loaded / 1e6)} of ${Math.round(p.total / 1e6)} MB`
          : "Removing the background..."),
      });
      const resultUrl = URL.createObjectURL(resultBlob);
      setSlides((ss) =>
        ss.map((x) => {
          if (x.id !== s.id || x.originalImageUrl) return x;
          // Premium: land straight on a scene, unless the seller switched it off before.
          const scene = backdrops && x.backdrop == null ? { backdrop: DEFAULT_BACKDROP } : {};
          return { ...x, originalImageUrl: s.imageUrl, imageUrl: resultUrl, ...scene };
        }),
      );
      setCutoutSaved(true);
      scheduleHistory();
    } catch (e) {
      setRemoveBgError(cutoutErrorText(e));
    } finally {
      setRemovingBg(false);
      setRemoveBgStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, backdrops]);

  const restoreBg = useCallback(() => {
    if (!slide?.originalImageUrl) return;
    patchSlide({ imageUrl: slide.originalImageUrl, originalImageUrl: null });
  }, [slide?.originalImageUrl, patchSlide]);

  // ── Export ───────────────────────────────────────────────────────────────
  const exportName = (idx) => {
    const d = (theme.watermarkText || listing?.dealer_name || "XDrive").replace(
      /\s+/g,
      "",
    );
    const c = `${listing?.brand || ""}${listing?.model || ""}`.replace(
      /\s+/g,
      "",
    );
    const dt = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${d}_${c}_${dt}_${String(idx + 1).padStart(2, "0")}.jpg`;
  };

  const toBlob = useCallback(
    async (idx) => {
      await document.fonts.ready;
      const c = document.createElement("canvas");
      await renderComposite(c, slides[idx], theme, font, CW, CH, slides[idx]?.layers || []);
      return new Promise((res) => c.toBlob(res, "image/jpeg", 0.93));
    },
    [slides, theme, font, CW, CH],
  );

  const saveSingle = useCallback(
    async (idx) => {
      setDlIdx(idx);
      const blob = await toBlob(idx);
      const url = URL.createObjectURL(blob);
      if (isIOS()) {
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        const a = document.createElement("a");
        a.download = exportName(idx);
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setDlIdx(null);
    },
    [toBlob],
  );

  const saveAll = useCallback(async () => {
    setDownloading(true);
    if (isIOS()) {
      for (let i = 0; i < total; i++) {
        const blob = await toBlob(i);
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        await new Promise((r) => setTimeout(r, 600));
      }
      setDownloading(false);
      return;
    }
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    for (let i = 0; i < total; i++) zip.file(exportName(i), await toBlob(i));
    const out = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(out);
    const d = (theme.watermarkText || "XDrive").replace(/\s+/g, "");
    const c = `${listing?.brand || ""}${listing?.model || ""}`.replace(
      /\s+/g,
      "",
    );
    const dt = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const a = document.createElement("a");
    a.download = `${d}_${c}_${dt}.zip`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setDownloading(false);
  }, [total, toBlob, theme, listing]);

  // ── Save / load design ───────────────────────────────────────────────────
  const saveDesign = useCallback(async () => {
    setLibMsg(null);
    if (savedDesigns.length >= 5) {
      setLibMsg("Library is full (5 designs max) — delete one first.");
      return;
    }
    // Generate a small thumbnail from the current background canvas
    let thumb = null;
    try {
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 108;
      thumbCanvas.height = 192;
      await renderBackground(thumbCanvas, slide, theme, font, 108, 192);
      thumb = thumbCanvas.toDataURL("image/jpeg", 0.6);
    } catch {}

    const name =
      designName.trim() ||
      `${listing?.brand || "Design"} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const payload = {
      theme: { ...theme },
      font,
      elements: JSON.parse(JSON.stringify(slide?.elements || [])),
      layers: JSON.parse(JSON.stringify(layers || [])),
      format: canvasFormat,
      carZone: slide?.carZone || null,
    };
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) {
      setLibMsg("Sign in to save designs.");
      return;
    }
    const { data, error } = await supabase
      .from("studio_designs")
      .insert({ user_id: user.id, name, thumb, payload })
      .select("id, created_at")
      .single();
    if (error) {
      setLibMsg("Could not save — try again.");
      return;
    }
    setSavedDesigns((p) => [
      { id: data.id, name, thumb, savedAt: new Date(data.created_at).getTime(), ...payload },
      ...p,
    ]);
    setDesignName("");
  }, [slide, theme, font, canvasFormat, savedDesigns, designName, listing, layers]);

  const loadDesign = useCallback((d) => {
    setTheme(d.theme);
    setFont(d.font);
    if (d.format) setCanvasFormat(d.format);
    const run = uid();
    const elsOf = (s) => [
      ...(s.elements || []).filter((e) => e.id === "watermark"),
      ...(d.elements || []).filter((e) => e.id !== "watermark").map((e, j) => ({ ...e, id: uid(), link: `${run}-e${j}` })),
    ];
    const laysOf = () =>
      (d.layers || []).map((l, j) => ({
        ...JSON.parse(JSON.stringify(l)),
        id: uid(),
        link: l.link === "overlay" ? "overlay" : `${run}-l${j}`,
      }));
    setSlides((ss) =>
      ss.map((s, i) => {
        if (i !== active && !allOn) return s;
        const next = { ...s, carZone: d.carZone || s.carZone || null };
        if (d.elements?.length) next.elements = elsOf(s);
        if (i !== active && d.layers) next.layers = laysOf();
        return next;
      }),
    );
    if (d.layers) setLayers(laysOf());
    setSelectedId(null);
  }, [active, allOn, setLayers]);

  const deleteDesign = useCallback(async (id) => {
    setSavedDesigns((p) => p.filter((d) => d.id !== id));
    setLibMsg(null);
    await supabase.from("studio_designs").delete().eq("id", id);
  }, []);

  // ── What is selected (STUDIO-UX-2) ───────────────────────────────────────
  // One thing at a time: a text/badge element, a layer, the slide photo, or
  // nothing (= the slide). Its kind picks the tools shown.
  const selLayer = layers.find((l) => layerSelectedIds.includes(l.id)) || null;
  const selKind = selectedEl
    ? selectedEl.type === "badge" ? "badge" : "text"
    : selLayer
      ? selLayer.type === "image" ? "image" : selLayer.type === "text" ? "text" : "shape"
      : photoSel ? "photo" : "slide";
  // A new selection closes the open tool panel (its tools may not exist for
  // the new thing), except right after Add opened the new text's Edit.
  // Closed a moment LATER, never mid-tap: closing grows the canvas, and a
  // phone sends the tap's click after the finger lifts, so an instant close
  // moved the canvas under the finger and the click picked whatever slid
  // under it (a tap on a text selected the shape behind it).
  // A late close never shuts a panel opened after it was scheduled.
  const keepSheetRef = useRef(false);
  const sheetVer = useRef(0);
  useEffect(() => {
    if (sheetPanel) sheetVer.current++;
  }, [sheetPanel]);
  const closeSheetSoon = useCallback((ms = 350) => {
    const v = sheetVer.current;
    setTimeout(() => {
      if (keepSheetRef.current) {
        keepSheetRef.current = false;
        return;
      }
      if (sheetVer.current === v) setSheetPanel(null);
    }, ms);
  }, []);
  // A press on the phone canvas closes the sheet itself, when it ends.
  const pressingCanvas = useRef(false);
  const sheetH = useRef(0);
  const selIdentity = selectedId || selLayer?.id || (photoSel ? "photo" : "slide");
  useEffect(() => {
    if (!pressingCanvas.current) closeSheetSoon();
    setDeskMode(null);
  }, [selIdentity, closeSheetSoon]);

  if (!slide) return null;

  // ── Tools per kind of selection (STUDIO-UX-2) ────────────────────────────
  // One place, different tools: the phone's bottom bar and the desktop's side
  // panel both show the tools of what is selected. Nothing selected = the
  // slide. Order: the object's own tools first, Arrange (the same for every
  // object) last.
  const TOOLSETS = {
    slide: [
      ["templates", "Templates", LayoutTemplate],
      ["photo", "Photo", ImagePlus],
      ["design", "Design", Palette],
      ["brand", "Brand", Stamp],
      ["ai", "AI", Sparkles],
    ],
    photo: [
      ["replace", "Replace", RefreshCw],
      ["cutout", "Remove BG", Scissors],
      ["adjust", "Adjust", SlidersHorizontal],
      ...(backdrops ? [["backdrop", "Backdrop", Sunrise]] : []),
    ],
    text: [
      ["edit", "Edit", Pencil],
      ["font", "Font", CaseSensitive],
      ["colour", "Colour", Droplet],
      ["style", "Style", Bold],
      ["arrange", "Arrange", Move],
    ],
    badge: [
      ["edit", "Edit", Pencil],
      ["font", "Font", CaseSensitive],
      ["colour", "Colour", Droplet],
      ["shape", "Shape", Square],
      ["arrange", "Arrange", Move],
    ],
    shape: [
      ["fill", "Fill", PaintBucket],
      ["border", "Border", Square],
      ["text", "Text", Type],
      ["effects", "Effects", Wand2],
      ["arrange", "Arrange", Move],
    ],
    image: [
      ["replace", "Replace", RefreshCw],
      ["fit", "Fit", Crop],
      ["effects", "Effects", Wand2],
      ["border", "Border", Square],
      ["arrange", "Arrange", Move],
    ],
  };
  const kindTools = TOOLSETS[selKind];
  const KIND_LABEL = { slide: "Slide", photo: "Photo", text: "Text", badge: "Badge", shape: "Shape", image: "Image" };
  const selObj = selectedEl || selLayer;
  const onlyHere = allOn && selObj && !linkKey(selObj);
  const deskTool =
    (kindTools.find((t) => t[0] === lastTool[selKind] && t[0] !== "photo") || kindTools.find((t) => t[0] !== "photo"))[0];
  const images = [...uploadedImages, ...rawImages];
  const swatches = Array.from(new Set(["#ffffff", "#0b0c0f", theme.accentColor || "#dc2626", "#dc2626", "#e8c15a", "#9aa0aa"].map((c) => c.toLowerCase())));

  // ── This slide | All slides ─────────────────────────────────────────────
  const scopeToggle = () =>
    total > 1 ? (
      <SSeg
        label="Edit this slide or every slide"
        items={[[false, "This slide"], [true, "All slides"]]}
        value={scopeAll}
        onPick={setScopeAll}
      />
    ) : null;
  const scopeNote = () => {
    if (!allOn) return null;
    if (onlyHere) return "This object is only on this slide";
    if (selKind === "slide" || selKind === "photo") return `Changes apply to all ${total} slides`;
    return `Editing it on all ${total} slides`;
  };

  // ── Slide tools ──────────────────────────────────────────────────────────
  const slideTemplates = () => (
    <div>
      {allOn && <SNote>A template goes on all {total} slides, each with its own photo.</SNote>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CAR_TEMPLATES.map((t) => (
          <div key={t.id} style={{ background: C.raised, borderRadius: 14, padding: "12px 14px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{t.name}</p>
            <p style={{ fontSize: 12, color: C.sec, lineHeight: 1.45, margin: "3px 0 10px" }}>{t.tagline}</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => applyProTemplate(t)} style={primaryBtn}>Use template</button>
              {/* The camera only exists on a phone */}
              {isMobile && (
                <button onClick={() => openCameraWithTemplate(t)} style={{ ...tileStyle(), flex: 1, background: C.sel }}>
                  <Camera size={15} /> Use + shoot
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <SLabel>My designs ({savedDesigns.length}/5)</SLabel>
      {libMsg && <SNote>{libMsg}</SNote>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {savedDesigns.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.raised, borderRadius: 12, padding: "6px 6px 6px 8px" }}>
            <div style={{ width: 27, height: 48, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: d.theme?.bgColor || "#060910" }}>
              {d.thumb && <img src={d.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
            <button onClick={() => loadDesign(d)} style={{ ...tileStyle(), height: 36, background: C.sel }}>Apply</button>
            <button aria-label={`Delete ${d.name}`} onClick={() => deleteDesign(d.id)} style={{ ...tileStyle(), height: 36, width: 36, padding: 0, color: C.redText }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {savedDesigns.length < 5 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="Name this design" style={{ ...inputStyle, flex: 1, fontSize: 14 }} />
          <button onClick={saveDesign} style={{ ...tileStyle(), background: C.sel, whiteSpace: "nowrap" }}>Save</button>
        </div>
      )}
    </div>
  );

  const slideDesign = () => (
    <div>
      <SNote>Design settings apply to every slide.</SNote>
      <SLabel style={{ marginTop: 0 }}>Size</SLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
        {FORMATS.map((f) => (
          <button key={f.id} aria-pressed={canvasFormat === f.id} onClick={() => setCanvasFormat(f.id)} style={{ ...tileStyle(canvasFormat === f.id), justifyContent: "flex-start", height: 48 }}>
            <span style={{ fontWeight: 600 }}>{f.id}</span>
            <span style={{ fontSize: 11, color: C.sec }}>{f.label}</span>
          </button>
        ))}
      </div>
      <SLabel>Style</SLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
        {STYLE_PRESETS.map((p) => (
          <button key={p.id} onClick={() => setTheme((t) => ({ ...t, ...p.theme }))} style={{ ...tileStyle(), justifyContent: "flex-start" }}>
            <span style={{ display: "flex", gap: 3 }}>
              {p.dots.map((c, i) => (
                <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: c, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)" }} />
              ))}
            </span>
            {p.label}
          </button>
        ))}
      </div>
      <SLabel>Colours</SLabel>
      <SColorPick label="Accent" value={theme.accentColor} onChange={(v) => setTheme((t) => ({ ...t, accentColor: v }))} presets={["#dc2626", "#c9a84c", "#00d4ff", "#00c853", "#ffffff"]} />
      <SColorPick label="Background" value={theme.bgColor} onChange={(v) => setTheme((t) => ({ ...t, bgColor: v }))} presets={["#0b0c0f", "#0d0d0d", "#020918", "#f0f0f0"]} />
      <SLabel>Font for every text</SLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
        {FONTS.map((f) => (
          <button
            key={f.id}
            aria-pressed={font === f.id}
            onClick={() => {
              setFont(f.id);
              ensureFont(f.id);
            }}
            style={{ ...tileStyle(font === f.id), fontFamily: f.stack, fontSize: 15, justifyContent: "flex-start", overflow: "hidden", whiteSpace: "nowrap" }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <SSwitch label="Accent bar at the top" value={theme.showAccentBar !== false} onChange={(v) => setTheme((t) => ({ ...t, showAccentBar: v }))} />
      </div>
    </div>
  );

  const setWatermark = (patch) => {
    setTheme((t) => ({ ...t, ...(patch.content !== undefined ? { watermarkText: patch.content } : {}), ...(patch.opacity !== undefined ? { watermarkOpacity: patch.opacity } : {}) }));
    setSlides((ss) => ss.map((s) => ({ ...s, elements: s.elements.map((el) => (el.id === "watermark" ? { ...el, ...patch } : el)) })));
  };
  const slideBrand = () => (
    <div>
      <SNote>Brand settings apply to every slide.</SNote>
      <SLabel style={{ marginTop: 0 }}>Logo</SLabel>
      <input value={theme.logoUrl || ""} placeholder="Logo image link (https://)" onChange={(e) => setTheme((t) => ({ ...t, logoUrl: e.target.value || null }))} style={inputStyle} />
      {theme.logoUrl && (
        <div style={{ marginTop: 10 }}>
          <SSlider label="Logo size" value={theme.logoSize || 80} min={40} max={200} step={4} onChange={(v) => setTheme((t) => ({ ...t, logoSize: v }))} fmt={(v) => `${v}px`} />
        </div>
      )}
      <SLabel>Watermark</SLabel>
      <input value={theme.watermarkText || ""} placeholder="Your name or business" onChange={(e) => setWatermark({ content: e.target.value })} style={inputStyle} />
      <div style={{ marginTop: 10 }}>
        <SSlider label="Watermark strength" value={theme.watermarkOpacity ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => setWatermark({ opacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <SLabel>Badges on every slide</SLabel>
      <SSwitch
        label={`Condition (${{ new: "Brand New", recon: "Recon", used: "Used" }[listing?.condition || ""] || "not set"})`}
        value={!!theme.showConditionBadge}
        onChange={(v) => setTheme((t) => ({ ...t, showConditionBadge: v }))}
      />
      <SSwitch label="Hot Deal" value={!!theme.showHotDealBadge} onChange={(v) => setTheme((t) => ({ ...t, showHotDealBadge: v }))} />
      <input value={theme.customBadgeText || ""} placeholder="Your own badge text (empty = none)" onChange={(e) => setTheme((t) => ({ ...t, customBadgeText: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} />
      <div style={{ marginTop: 10 }}>
        <SColorPick label="Badge colour" value={theme.badgeColor || "#dc2626"} onChange={(v) => setTheme((t) => ({ ...t, badgeColor: v }))} presets={["#dc2626", "#0b0c0f", "#e8c15a", "#ffffff"]} />
      </div>
      <button onClick={saveBranding} style={{ ...primaryBtn, width: "100%", marginTop: 6 }}>
        {savedBrand ? "Saved" : "Save as my brand kit"}
      </button>
    </div>
  );

  const aiPct = Math.round((aiUsage.count / AI_LIMIT) * 100);
  const slideAI = () => (
    <div>
      <SNote>Tell it what to change on this slide. {aiUsage.loaded ? `${aiUsage.count} of ${AI_LIMIT} used today.` : ""}</SNote>
      <div style={{ height: 4, borderRadius: 2, background: C.raised, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${Math.min(100, aiPct)}%`, background: aiAtLimit ? C.redText : C.text }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={aiInputRef}
          value={aiCmd}
          onChange={(e) => setAiCmd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runAICommand()}
          disabled={aiAtLimit}
          placeholder="Make the price bigger"
          style={{ ...inputStyle, flex: 1, opacity: aiAtLimit ? 0.4 : 1 }}
        />
        <button onClick={runAICommand} disabled={applyingCmd || !aiCmd.trim() || aiAtLimit} style={{ ...primaryBtn, flex: "0 0 auto", padding: "0 16px", opacity: applyingCmd || !aiCmd.trim() || aiAtLimit ? 0.5 : 1 }}>
          {applyingCmd ? "..." : "Go"}
        </button>
      </div>
      {aiAtLimit && <SNote>Daily limit reached. It resets tomorrow.</SNote>}
      {genError && <p style={{ fontSize: 12, color: C.redText, margin: "8px 0 0" }}>{genError}</p>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {suggestions.map((sg) => (
          <button
            key={sg}
            onClick={() => {
              setAiCmd(sg);
              setTimeout(() => aiInputRef.current?.focus(), 0);
            }}
            style={{ height: 34, padding: "0 12px", borderRadius: 999, border: "none", background: C.raised, color: C.sec, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            {sg}
          </button>
        ))}
      </div>
      {cmdHistory.length > 0 && (
        <>
          <SLabel>Recent</SLabel>
          {cmdHistory.map((c, i) => (
            <button key={i} onClick={() => setAiCmd(c)} style={{ display: "block", width: "100%", textAlign: "left", minHeight: 36, background: "none", border: "none", color: C.sec, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "6px 0" }}>
              {c}
            </button>
          ))}
        </>
      )}
    </div>
  );

  // ── Photo tools ──────────────────────────────────────────────────────────
  const photoReplace = () => (
    <div>
      {allOn && <SNote>A new photo changes this slide only.</SNote>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        {images.map((url, i) => {
          const on = url === slide.imageUrl || url === slide.originalImageUrl;
          return (
            <button
              key={url + i}
              aria-label={`Use photo ${i + 1}`}
              aria-pressed={on}
              onClick={() => patchSlide({ imageUrl: url, originalImageUrl: null })}
              style={{ aspectRatio: "3 / 4", borderRadius: 10, overflow: "hidden", padding: 0, border: "none", cursor: "pointer", boxShadow: on ? `0 0 0 2px ${C.text}` : "none", background: C.raised }}
            >
              <img src={url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <label style={{ ...tileStyle(), flex: 1 }}>
          <Upload size={15} /> Upload
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              uploadBgImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {isMobile && (
          <button onClick={openCamera} style={{ ...tileStyle(), flex: 1 }}>
            <Camera size={15} /> Take photo
          </button>
        )}
      </div>
    </div>
  );

  const cutDoneHere = !!slide.originalImageUrl;
  const photoCutout = () => (
    <div>
      <SNote>
        {cutoutSaved
          ? "Done on your phone, one photo at a time. Your photo is not uploaded."
          : `Done on your phone, one photo at a time. The first time downloads the tool once (${Math.round(CUTOUT_MODEL_BYTES / 1e6)} MB), best on Wi-Fi.`}
      </SNote>
      {allOn && <SNote>This works on this slide's photo only, even in All slides.</SNote>}
      {!slide.imageUrl && <SNote>This slide has no photo yet.</SNote>}
      {slide.imageUrl && !cutDoneHere && (
        <button onClick={removeBg} disabled={removingBg} style={{ ...primaryBtn, width: "100%", opacity: removingBg ? 0.6 : 1 }}>
          <Scissors size={15} /> {removingBg ? "Working..." : "Remove the background"}
        </button>
      )}
      {removingBg && removeBgStatus && <SNote>{removeBgStatus}</SNote>}
      {removeBgError && <p style={{ fontSize: 12, color: C.redText, margin: "8px 0" }}>{removeBgError}</p>}
      {cutDoneHere && !removingBg && (
        <button onClick={restoreBg} style={{ ...tileStyle(), width: "100%" }}>
          <RotateCcw size={15} /> Put the background back
        </button>
      )}
    </div>
  );

  const photoAdjust = () => (
    <div>
      <AdjustStrip
        key={allOn ? "all" : slide.id}
        items={PHOTO_ADJUST}
        values={{ ...DEF_ADJ, ...(slide.bgAdjust || {}) }}
        onChange={(k, v) => patchPhoto((s) => ({ bgAdjust: { ...DEF_ADJ, ...(s.bgAdjust || {}), [k]: v } }))}
        onResetAll={() => patchPhoto(() => ({ bgAdjust: { ...DEF_ADJ } }))}
      />
      <div style={{ marginTop: 14 }}>
        <SSlider
          label="Blurred fill around the photo (every slide)"
          value={theme.blurIntensity ?? 18}
          min={0}
          max={30}
          step={1}
          onChange={(v) => setTheme((t) => ({ ...t, blurIntensity: v }))}
          fmt={(v) => `${v}`}
        />
      </div>
    </div>
  );

  const photoBackdrop = () => {
    if (!slide.originalImageUrl) {
      return (
        <div>
          <SNote>Backdrops go behind the car once its background is removed.</SNote>
          <button onClick={removeBg} disabled={removingBg || !slide.imageUrl} style={{ ...primaryBtn, width: "100%", opacity: removingBg ? 0.6 : 1 }}>
            <Scissors size={15} /> {removingBg ? "Working..." : "Remove the background"}
          </button>
          {removingBg && removeBgStatus && <SNote>{removeBgStatus}</SNote>}
        </div>
      );
    }
    const current = slide.backdrop || "none";
    const fit = { ...DEFAULT_CAR_FIT, ...(slide.carFit || {}) };
    const setFit = (p) => patchPhoto((s) => ({ carFit: { ...DEFAULT_CAR_FIT, ...(s.carFit || {}), ...p } }));
    return (
      <div>
        <SNote>Drawn behind your car. The car photo itself is not changed.</SNote>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <BackdropSwatch id="none" label="None" accent={theme.accentColor} active={current === "none"} onPick={() => patchPhoto(() => ({ backdrop: "none" }))} />
          {BACKDROPS.map((b) => (
            <BackdropSwatch key={b.id} id={b.id} label={b.name} accent={theme.accentColor} active={current === b.id} onPick={() => patchPhoto(() => ({ backdrop: b.id }))} />
          ))}
        </div>
        {current !== "none" && (
          <div style={{ marginTop: 12 }}>
            <SSwitch label="Shadow under the car" value={slide.carShadow !== false} onChange={(v) => patchPhoto(() => ({ carShadow: v }))} />
            <SSlider label="Car size" value={fit.size} min={0.6} max={1.4} step={0.01} onChange={(v) => setFit({ size: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <SSlider label="Car height" value={fit.lift} min={-0.25} max={0.25} step={0.005} onChange={(v) => setFit({ lift: v })} fmt={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`} />
          </div>
        )}
      </div>
    );
  };

  // ── Text / badge tools (elements) ────────────────────────────────────────
  const el = selectedEl;
  const up = updateSelectedElement;
  const elEdit = () => (
    <div>
      <input value={el.content || ""} onChange={(e) => up({ content: e.target.value })} placeholder="Type here" style={{ ...inputStyle, fontSize: 16 }} />
      <SNote>Or double-tap the text on the slide.</SNote>
    </div>
  );
  const elFont = () => (
    <div>
      <SSlider label="Size" value={el.fontSize || 32} min={16} max={200} step={1} onChange={(v) => up({ fontSize: v })} fmt={(v) => `${v}`} />
      <SSeg
        label="Weight"
        items={[["300", "Thin"], ["400", "Regular"], ["600", "Medium"], ["700", "Bold"], ["800", "Black"]]}
        value={String(el.fontWeight || "700")}
        onPick={(w) => up({ fontWeight: w })}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 8px" }}>
        <span style={{ fontSize: 12, color: C.sec }}>Font</span>
        <label style={{ fontSize: 12, color: C.text, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <Upload size={13} /> Upload a font
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/*"
            style={{ display: "none" }}
            onChange={(e) => {
              handleFontUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {fontUploadErr && <p style={{ fontSize: 12, color: C.redText, margin: "0 0 6px" }}>{fontUploadErr}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
        <button aria-pressed={!el.fontFamily} onClick={() => up({ fontFamily: "" })} style={{ ...tileStyle(!el.fontFamily), justifyContent: "flex-start" }}>
          Slide default
        </button>
        {[
          ...customFonts.map((cf) => ({ id: cf.id, label: cf.label, stack: `"${cf.family}", sans-serif`, custom: true })),
          ...FONTS.map((f) => ({ id: f.id, label: f.label, stack: f.stack, custom: false })),
        ].map((f) => {
          const on = el.fontFamily === f.stack;
          return (
            <div key={f.id} style={{ position: "relative" }}>
              <button aria-pressed={on} onClick={() => up({ fontFamily: f.stack })} style={{ ...tileStyle(on), width: "100%", justifyContent: "flex-start", fontFamily: f.stack, fontSize: 15, overflow: "hidden", whiteSpace: "nowrap" }}>
                {f.label}
              </button>
              {f.custom && (
                <button aria-label={`Remove ${f.label}`} onClick={() => removeCustomFont(f.id)} style={{ position: "absolute", top: 2, right: 2, width: 28, height: 28, border: "none", background: "transparent", color: C.muted, cursor: "pointer" }}>
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
  const textColour = () => (
    <div>
      <SSeg
        label="Colour type"
        items={[["solid", "Solid"], ["gradient", "Gradient"]]}
        value={el.gradient ? "gradient" : "solid"}
        onPick={(v) =>
          v === "solid"
            ? up({ gradient: null, color: el.color === "transparent" ? "#ffffff" : el.color || "#ffffff" })
            : up({ gradient: el.gradient || DEFAULT_GRADIENT, bgColor: null })
        }
      />
      <div style={{ marginTop: 12 }}>
        {el.gradient ? (
          <GradientEditor value={el.gradient} onChange={(g) => up({ gradient: g })} />
        ) : (
          <SColorPick value={el.color === "transparent" ? "" : el.color || "#ffffff"} onChange={(v) => up({ color: v })} presets={swatches} />
        )}
      </div>
      <SSwitch
        label="Outline only (see-through letters)"
        value={el.color === "transparent"}
        onChange={(on) =>
          up({
            color: on ? "transparent" : "#ffffff",
            ...(on && !(el.strokeWidth > 0) ? { strokeWidth: 2, strokeColor: el.strokeColor || "#ffffff" } : {}),
          })
        }
      />
      <SLabel>Outline</SLabel>
      <SSlider label="Thickness" value={el.strokeWidth || 0} min={0} max={14} step={0.5} onChange={(v) => up({ strokeWidth: v })} fmt={(v) => `${v}`} />
      {(el.strokeWidth || 0) > 0 && <SColorPick value={el.strokeColor || "#000000"} onChange={(v) => up({ strokeColor: v })} presets={swatches} />}
      <SLabel>Box behind the text</SLabel>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button aria-pressed={!el.bgColor} onClick={() => up({ bgColor: null })} style={{ ...tileStyle(!el.bgColor), height: 36 }}>None</button>
        <div style={{ flex: 1 }}>
          <SColorPick value={el.bgColor || ""} onChange={(v) => up({ bgColor: v })} presets={["#0b0c0f", theme.accentColor || "#dc2626", "#ffffff"]} />
        </div>
      </div>
    </div>
  );
  const textStyle = () => (
    <div>
      <SLabel style={{ marginTop: 0 }}>Align</SLabel>
      <SSeg
        label="Align"
        items={[["left", <AlignLeft key="l" size={16} />], ["center", <AlignCenter key="c" size={16} />], ["right", <AlignRight key="r" size={16} />]]}
        value={el.align || "left"}
        onPick={(a) => up({ align: a })}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 12 }}>
        <button aria-pressed={el.fontStyle === "italic"} onClick={() => up({ fontStyle: el.fontStyle === "italic" ? "normal" : "italic" })} style={{ ...tileStyle(el.fontStyle === "italic"), fontStyle: "italic" }}>
          <Italic size={15} /> Italic
        </button>
        <button aria-pressed={!!el.shadow} onClick={() => up({ shadow: !el.shadow })} style={tileStyle(!!el.shadow)}>
          Shadow
        </button>
      </div>
    </div>
  );
  const badgeColour = () => (
    <div>
      <SColorPick label="Badge" value={el.bgColor || "#dc2626"} onChange={(v) => up({ bgColor: v })} presets={swatches} />
      <SColorPick label="Text" value={el.color || "#ffffff"} onChange={(v) => up({ color: v })} presets={["#ffffff", "#0b0c0f", "#e8c15a"]} />
    </div>
  );
  const badgeShape = () => {
    const r = el.borderRadius ?? 999;
    return (
      <div>
        <SSeg label="Corners" items={[["pill", "Round ends"], ["custom", "Custom"]]} value={r >= 999 ? "pill" : "custom"} onPick={(v) => up({ borderRadius: v === "pill" ? 999 : 12 })} />
        {r < 999 && (
          <div style={{ marginTop: 12 }}>
            <SSlider label="Corner radius" value={Math.min(r, 80)} min={0} max={80} step={1} onChange={(v) => up({ borderRadius: v })} fmt={(v) => `${v}`} />
          </div>
        )}
      </div>
    );
  };
  const elArrange = () => (
    <div>
      <SSlider label="Opacity" value={el.opacity ?? 1} min={0} max={1} step={0.01} onChange={(v) => up({ opacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
      <SSlider label="Rotate" value={((((el.rotation || 0) + 540) % 360) - 180)} min={-180} max={180} step={1} onChange={(v) => up({ rotation: v })} fmt={(v) => `${v}°`} />
      <SLabel>Order (among texts and badges)</SLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        {[["front", "To front"], ["up", "Forward"], ["down", "Back"], ["back", "To back"]].map(([d, l]) => (
          <button key={d} onClick={() => shiftElement(el.id, d)} style={{ ...tileStyle(), padding: 0, fontSize: 12 }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
        <button aria-pressed={!!el.locked} onClick={() => up({ locked: !el.locked })} style={tileStyle(!!el.locked)}>
          {el.locked ? <Lock size={15} /> : <Unlock size={15} />} {el.locked ? "Locked" : "Lock in place"}
        </button>
        <button aria-pressed={el.visible === false} onClick={() => up({ visible: el.visible === false })} style={tileStyle(el.visible === false)}>
          {el.visible === false ? <EyeOff size={15} /> : <Eye size={15} />} {el.visible === false ? "Hidden" : "Hide"}
        </button>
      </div>
    </div>
  );

  // ── Layer tools: the layer panel, one section set per tab ───────────────
  const LAYER_ONLY = {
    text: { edit: ["content"], font: ["font"], colour: ["textColour", "fill"], style: ["textStyle"], arrange: ["arrange"] },
    shape: { fill: ["fill"], border: ["border"], text: ["content", "font", "textColour", "textStyle"], effects: ["effects"], arrange: ["arrange"] },
    image: { replace: ["image"], fit: ["fit"], effects: ["effects"], border: ["border"], arrange: ["arrange"] },
  };
  const layerTool = (tool) => (
    <LayerPropertiesPanel
      layer={selLayer}
      onUpdate={(id, patch) => patchLayer(id, patch)}
      onCommit={commitLayerHistory}
      onZ={(z) => patchLayer(selLayer.id, { zIndex: z })}
      only={LAYER_ONLY[selKind]?.[tool] || ["arrange"]}
    />
  );

  const renderTool = (tool) => {
    if (selKind === "slide") {
      if (tool === "templates") return slideTemplates();
      if (tool === "design") return slideDesign();
      if (tool === "brand") return slideBrand();
      if (tool === "ai") return slideAI();
    }
    if (selKind === "photo") {
      if (tool === "replace") return photoReplace();
      if (tool === "cutout") return photoCutout();
      if (tool === "adjust") return photoAdjust();
      if (tool === "backdrop") return photoBackdrop();
    }
    if (selLayer && !selectedEl) return layerTool(tool);
    if (el) {
      if (tool === "edit") return elEdit();
      if (tool === "font") return elFont();
      if (tool === "arrange") return elArrange();
      if (el.type === "badge") {
        if (tool === "colour") return badgeColour();
        if (tool === "shape") return badgeShape();
      } else {
        if (tool === "colour") return textColour();
        if (tool === "style") return textStyle();
      }
    }
    return null;
  };

  // ── Add + Layers (document level, never tied to a selection) ────────────
  const afterAdd = (openEdit = false) => {
    setDeskMode(null);
    if (openEdit && isMobile) {
      keepSheetRef.current = true;
      setSheetPanel("edit");
    } else {
      setSheetPanel(null);
    }
  };
  const addPanel = () => {
    const tiles = [
      ["Text", Type, () => { addTextElement(); afterAdd(true); }],
      ["Badge", Tag, () => { addBadgeElement(); afterAdd(true); }],
      ["Rectangle", Square, () => { addShapeAspect("rect"); afterAdd(); }],
      ["Circle", Circle, () => { addShapeAspect("circle"); afterAdd(); }],
      ["Triangle", Triangle, () => { addShapeAspect("triangle"); afterAdd(); }],
      ["Dark fade", Layers, () => { addShapeAspect("gradient"); afterAdd(); }],
    ];
    return (
      <div>
        {allOn && <SNote>Adds to all {total} slides.</SNote>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {tiles.map(([label, Icon, fn]) => (
            <button key={label} onClick={fn} style={{ ...tileStyle(), height: 72, flexDirection: "column", gap: 6, fontSize: 12 }}>
              <Icon size={20} /> {label}
            </button>
          ))}
          <label style={{ ...tileStyle(), height: 72, flexDirection: "column", gap: 6, fontSize: 12 }}>
            <ImagePlus size={20} /> Image
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  addLayerScoped("image", { src: URL.createObjectURL(f) });
                  afterAdd();
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  };

  const layersPanel = () => {
    const els = [...(slide.elements || [])].filter((e) => e.id !== "watermark").reverse();
    const lays = [...layers].sort((a, b) => (b.zIndex ?? 20) - (a.zIndex ?? 20));
    const row = (key, Icon, name, on, visible, locked, onPick, onEye, onLock) => (
      <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 12, background: on ? C.sel : "transparent" }}>
        <button onClick={onPick} style={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: visible ? C.text : C.muted, fontSize: 13, cursor: "pointer", textAlign: "left", padding: "0 8px", fontFamily: "inherit" }}>
          <Icon size={15} style={{ flexShrink: 0, color: C.sec }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </button>
        <button aria-label={visible ? "Hide" : "Show"} onClick={onEye} style={{ width: 40, height: 40, border: "none", background: "transparent", color: visible ? C.sec : C.muted, cursor: "pointer" }}>
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button aria-label={locked ? "Unlock" : "Lock"} onClick={onLock} style={{ width: 40, height: 40, border: "none", background: "transparent", color: locked ? C.text : C.muted, cursor: "pointer" }}>
          {locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
      </div>
    );
    return (
      <div>
        <SNote>Top of the list = in front. Locked things can only be picked from here.</SNote>
        {els.map((e) =>
          row(
            e.id,
            e.type === "badge" ? Tag : Type,
            e.content || (e.type === "badge" ? "Badge" : "Text"),
            selectedId === e.id,
            e.visible !== false,
            !!e.locked,
            () => selectElement(e.id),
            () => updateElement(e.id, { visible: e.visible === false }),
            () => updateElement(e.id, { locked: !e.locked }),
          ),
        )}
        {lays.map((l) =>
          row(
            l.id,
            l.type === "image" ? ImagePlus : l.type === "text" ? Type : l.type === "circle" ? Circle : l.type === "triangle" ? Triangle : Square,
            l.label || l.type,
            layerSelectedIds.includes(l.id),
            l.visible !== false,
            !!l.locked,
            () => selectLayerOnly(l.id),
            () => patchLayer(l.id, { visible: l.visible === false }),
            () => patchLayer(l.id, { locked: !l.locked }),
          ),
        )}
        <button onClick={selectPhoto} style={{ ...tileStyle(photoSel), width: "100%", justifyContent: "flex-start", marginTop: 4 }}>
          <ImagePlus size={15} style={{ color: C.sec }} /> Photo (at the back)
        </button>
      </div>
    );
  };

  // The canvas chrome shared by phone and desktop.
  const canvasLayers = (sc) => (
    <>
      <LayerCanvas
        layers={layers}
        selectedIds={layerSelectedIds}
        scale={sc}
        canvasW={CW}
        canvasH={CH}
        onSelectLayer={(id) => selectLayerOnly(id)}
        onClearSelection={clearSelectionAll}
        onUpdateLayer={patchLayer}
        onCommitHistory={commitLayerHistory}
        onDeleteLayer={removeLayer}
        onDuplicateLayer={dupLayer}
        onToggleLockLayer={toggleLockLayer}
      />
      {photoSel && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 3, border: `3px dashed ${C.text}`, borderRadius: 6, pointerEvents: "none", zIndex: 24 }} />
      )}
      <div
        ref={canvasInnerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 25,
          // overflow stays visible so the selection box, rotate handle and
          // mini bar never clip at the canvas edge
          borderRadius: 4,
          pointerEvents: "none",
        }}
      >
        {(slide.elements || [])
          .filter((e) => e.id !== "watermark")
          .map((e) => (
            <div key={e.id} style={{ pointerEvents: "auto" }}>
              {editingId === e.id ? (
                <InlineEditor el={e} scale={sc} onCommit={(v) => onCommitEdit(e.id, v)} onCancel={() => setEditingId(null)} />
              ) : (
                <CanvasElement
                  el={e}
                  scale={sc}
                  highlighted={(highlightIds || []).includes(e.id)}
                  fontStack={fontObj.stack}
                  onSelect={selectElement}
                  onStartDrag={(ev, id) => onStartDrag(ev, id, sc)}
                  onDoubleClick={(id) => setEditingId(id)}
                />
              )}
            </div>
          ))}
        {selectedEl && selectedId && !editingId && !selectedEl.locked && (
          <div style={{ pointerEvents: "auto" }}>
            <SelectionOverlay
              elId={selectedId}
              el={selectedEl}
              canvasInnerRef={canvasInnerRef}
              onStartResize={(ev, id, handle) => onStartResize(ev, id, handle, sc)}
              onStartRotate={onStartRotate}
              onUpdate={updateSelectedElement}
              onDuplicate={duplicateSelected}
              onToggleLock={() => updateSelectedElement({ locked: true })}
              onDelete={deleteSelected}
            />
          </div>
        )}
      </div>
    </>
  );

  const previewProps = {
    slide,
    theme,
    fontStack: fontObj.stack,
    fontId: font,
    selectedId,
    highlightIds,
    aiLoading: applyingCmd,
    canvasW: CW,
    canvasH: CH,
    onSelectElement: selectElement,
    onDeselectAll: clearSelectionAll,
    onStartDrag,
    onStartResize,
    onStartRotate,
    onDoubleClickElement: (id) => setEditingId(id),
    editingId,
    onCommitEdit,
    onCancelEdit: () => setEditingId(null),
    selectedEl,
    onUpdateSelected: updateSelectedElement,
    onDuplicateSelected: duplicateSelected,
    onDeleteSelected: deleteSelected,
  };

  const canUndo = historyIdx.current > 0;
  const canRedo = historyIdx.current < history.current.length - 1;
  const iconBtn = (extra = {}) => ({
    width: 44,
    height: 44,
    border: "none",
    background: "transparent",
    color: C.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    ...extra,
  });

  // The chip that says what is selected (or that nothing is).
  const selChip = (compact) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {selKind === "slide" ? (
        <span style={{ fontSize: compact ? 13 : 15, fontWeight: compact ? 500 : 600, color: compact ? C.sec : C.text, whiteSpace: "nowrap" }}>
          {compact ? "Nothing selected" : `Slide ${active + 1} of ${total}`}
        </span>
      ) : (
        <>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.text, flexShrink: 0 }} />
          <span style={{ fontSize: compact ? 13 : 15, fontWeight: 600, color: C.text }}>{KIND_LABEL[selKind]}</span>
          <span style={{ fontSize: compact ? 13 : 15, color: C.sec }}>selected</span>
        </>
      )}
    </div>
  );

  // ── Phone ──────────────────────────────────────────────────────────────
  if (isMobile) {
    const HEADER_H = 52;
    const STRIP_H = 48;
    const CHIP_H = 44;
    const BAR_H = 76;
    // 16 = the inner wrapper's 8px padding top and bottom / side gutter.
    const { displayW: mobW, displayH: mobH } = computeDisplaySize(
      CW / CH,
      Math.max(80, (mobArea.w || window.innerWidth) - 16),
      Math.max(80, (mobArea.h || window.innerHeight - HEADER_H - STRIP_H - CHIP_H - BAR_H) - 16),
    );
    const mobScale = CW > 0 ? mobW / CW : 0.3;

    const sheetTool = kindTools.find((t) => t[0] === sheetPanel && t[0] !== "photo");
    const sheetOpen = sheetPanel === "add" || sheetPanel === "layers" || !!sheetTool;
    const sheetTitle = sheetPanel === "add" ? "Add" : sheetPanel === "layers" ? "Layers" : sheetTool?.[1];
    const sheetBody = () => (sheetPanel === "add" ? addPanel() : sheetPanel === "layers" ? layersPanel() : sheetTool ? renderTool(sheetTool[0]) : null);
    const onBarTool = (id) => {
      if (selKind === "slide" && id === "photo") {
        selectPhoto();
        setSheetPanel(null);
        return;
      }
      setSheetPanel((p) => (p === id ? null : id));
    };
    const note = sheetPanel === "add" || sheetPanel === "layers" ? null : scopeNote();

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: C.bg,
          color: C.text,
          display: "flex",
          flexDirection: "column",
          fontFamily: STUDIO_FONT,
          overflow: "hidden",
          touchAction: "pan-y",
        }}
        onTouchMove={(e) => {
          if (e.touches.length > 1) e.preventDefault();
        }}
      >
        {showCamera && (
          <CameraCapture
            onClose={() => setShowCamera(false)}
            onCapture={handleCameraCapture}
            carZone={slide?.carZone || { x: 6, y: 30, w: 88, h: 34, hint: "Fill the box with the car" }}
            overlayUrl={camOverlay}
            canvasW={CW}
            canvasH={CH}
          />
        )}

        {/* Header: what never moves */}
        <div style={{ height: HEADER_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 2, padding: "0 6px" }}>
          <button aria-label="Close studio" onClick={onClose} style={iconBtn({ color: C.sec })}><X size={20} /></button>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 600, paddingLeft: 2 }}>Studio</span>
          <button aria-label="Undo" onClick={undo} disabled={!canUndo} style={iconBtn({ color: canUndo ? C.text : "#4b515c" })}><Undo2 size={19} /></button>
          <button aria-label="Redo" onClick={redo} disabled={!canRedo} style={iconBtn({ color: canRedo ? C.text : "#4b515c" })}><Redo2 size={19} /></button>
          <button aria-label="Save this slide" onClick={() => saveSingle(active)} style={iconBtn()}><Download size={19} /></button>
          <button onClick={saveAll} disabled={downloading} style={{ height: 38, padding: "0 16px", marginLeft: 2, border: "none", borderRadius: 999, background: C.red, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {downloading ? "..." : "Export"}
          </button>
        </div>

        {/* Slides + This slide | All slides */}
        <div style={{ height: STRIP_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 10px" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, minWidth: 0, scrollbarWidth: "none" }}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Slide ${i + 1}`}
                aria-current={i === active}
                onClick={() => {
                  setActive(i);
                  clearSelectionAll();
                }}
                style={{ minWidth: 36, height: 36, borderRadius: 10, flexShrink: 0, border: "none", background: i === active ? C.text : C.raised, color: i === active ? C.bg : C.sec, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                {i + 1}
              </button>
            ))}
            <button aria-label="Add slide" onClick={addSlide} style={{ minWidth: 36, height: 36, borderRadius: 10, flexShrink: 0, border: "1px dashed #3a404b", background: "transparent", color: C.sec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={15} />
            </button>
          </div>
          {total > 1 && <div style={{ flexShrink: 0, width: 184 }}>{scopeToggle()}</div>}
        </div>

        {/* What is selected + the Layers list */}
        <div style={{ height: CHIP_H, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", gap: 8 }}>
          <div style={{ height: 34, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 999, background: C.raised, minWidth: 0 }}>{selChip(true)}</div>
          <button onClick={() => setSheetPanel((p) => (p === "layers" ? null : "layers"))} style={{ height: 34, display: "flex", alignItems: "center", gap: 6, padding: "0 12px", border: "none", borderRadius: 999, background: sheetPanel === "layers" ? C.sel : C.raised, color: C.sec, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <Layers size={15} /> Layers
          </button>
        </div>

        {/* Canvas — sized to the measured area, shrinks when the sheet opens.
            A press on it closes the sheet once the press is over. */}
        <div
          ref={mobAreaRef}
          onTouchStartCapture={() => {
            pressingCanvas.current = true;
          }}
          onTouchEndCapture={() => {
            pressingCanvas.current = false;
            if (sheetPanel) closeSheetSoon();
          }}
          onTouchCancelCapture={() => {
            pressingCanvas.current = false;
          }}
          onMouseDownCapture={() => {
            pressingCanvas.current = true;
          }}
          onMouseUpCapture={() => {
            pressingCanvas.current = false;
            if (sheetPanel) closeSheetSoon(60);
          }}
          style={{
            flex: 1,
            minHeight: 0,
            // The canvas is sized to fit (mobArea), so this area never scrolls:
            // a scrollable area here stole every vertical drag of a text.
            overflow: "hidden",
            touchAction: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ margin: "auto", padding: "8px 0", flexShrink: 0, position: "relative" }}>
            <div style={{ position: "relative", width: mobW, height: mobH, flexShrink: 0, borderRadius: 4, boxShadow: "0 4px 24px rgba(0,0,0,0.6)", isolation: "isolate" }}>
              <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 4, zIndex: 0 }}>
                <CanvasPreview {...previewProps} scale={mobScale} canvasW={CW} canvasH={CH} hideInteractive />
              </div>
              {canvasLayers(mobScale)}
            </div>
          </div>
        </div>

        {/* Tool sheet — in flow, the canvas above shrinks to stay visible.
            Selecting another object can leave the sheet on a tool the new
            object does not have: it keeps its height, empty, until it closes,
            so the canvas does not jump under a finger mid-tap. */}
        {sheetPanel && !sheetOpen && <div style={{ flexShrink: 0, height: sheetH.current, background: C.card, borderRadius: "22px 22px 0 0" }} />}
        {sheetOpen && (
          <div ref={(n) => { if (n) sheetH.current = n.offsetHeight; }} style={{ flexShrink: 0, background: C.card, borderRadius: "22px 22px 0 0", boxShadow: "0 -12px 32px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", maxHeight: "46vh" }}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#2a2f38" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", padding: "2px 6px 0 16px", minHeight: 44 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{sheetTitle}</div>
                {note && <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{note}</div>}
              </div>
              <button aria-label="Close panel" onClick={() => setSheetPanel(null)} style={iconBtn({ color: C.sec })}><ChevronDown size={20} /></button>
            </div>
            <div style={{ overflowY: "auto", padding: "4px 16px 16px", WebkitOverflowScrolling: "touch" }}>{sheetBody()}</div>
          </div>
        )}

        {/* The bar: Add (or Done) + the tools of what is selected */}
        <div style={{ height: BAR_H, flexShrink: 0, display: "flex", alignItems: "stretch", padding: "0 4px", borderTop: `1px solid ${C.line}`, background: C.bg }}>
          {selKind === "slide" ? (
            <button onClick={() => setSheetPanel((p) => (p === "add" ? null : "add"))} style={{ width: 62, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", background: "transparent", color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              <span style={{ width: 44, height: 32, borderRadius: 12, background: C.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={20} /></span>
              Add
            </button>
          ) : (
            <button
              onClick={() => {
                clearSelectionAll();
                setSheetPanel(null);
              }}
              style={{ width: 62, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", background: "transparent", color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
            >
              <span style={{ width: 44, height: 32, borderRadius: 12, background: C.raised, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={20} /></span>
              Done
            </button>
          )}
          <div style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "18px 2px" }} />
          {kindTools.map(([id, label, Icon]) => {
            const on = sheetPanel === id;
            return (
              <button
                key={id}
                onClick={() => onBarTool(id)}
                aria-pressed={on}
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", background: "transparent", padding: 0, fontSize: 11, fontWeight: on ? 600 : 500, color: on ? C.text : C.sec, cursor: "pointer", fontFamily: "inherit" }}
              >
                <span style={{ width: 44, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: on ? C.hover : "transparent" }}>
                  <Icon size={20} />
                </span>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Desktop ────────────────────────────────────────────────────────────
  const onDeskTab = (id) => {
    if (selKind === "slide" && id === "photo") {
      selectPhoto();
      return;
    }
    setLastTool((t) => ({ ...t, [selKind]: id }));
  };
  const deskNote = deskMode ? null : scopeNote();
  return (
    <>
      {/* Backdrop dimmer */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.65)" }} />

      <div
        style={{
          position: "fixed",
          inset: 14,
          zIndex: 9999,
          borderRadius: 16,
          overflow: "hidden",
          background: C.bg,
          color: C.text,
          boxShadow: "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          fontFamily: STUDIO_FONT,
        }}
      >
        {/* Header: what never moves */}
        <div style={{ height: 56, flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderBottom: `1px solid ${C.line}` }}>
          <button aria-label="Close studio" onClick={onClose} style={iconBtn({ color: C.sec, width: 40, height: 40 })}><X size={20} /></button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Studio</span>
          <span style={{ fontSize: 13, color: C.muted, marginLeft: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[listing?.year, listing?.brand, listing?.model].filter(Boolean).join(" ")} · {canvasFormat} · {total} slide{total !== 1 ? "s" : ""}
          </span>
          <div style={{ flex: 1 }} />
          <button aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} style={iconBtn({ width: 40, height: 40, color: canUndo ? C.text : "#4b515c" })}><Undo2 size={18} /></button>
          <button aria-label="Redo" title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} style={iconBtn({ width: 40, height: 40, color: canRedo ? C.text : "#4b515c" })}><Redo2 size={18} /></button>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)", margin: "0 6px" }} />
          <button onClick={() => saveSingle(active)} disabled={dlIdx === active} style={{ height: 38, padding: "0 16px", border: "none", borderRadius: 999, background: C.raised, color: C.text, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            <Download size={15} /> Save slide
          </button>
          <button onClick={saveAll} disabled={downloading} style={{ height: 38, padding: "0 18px", border: "none", borderRadius: 999, background: C.red, color: "#fff", fontSize: 14, fontWeight: 600, cursor: downloading ? "wait" : "pointer", fontFamily: "inherit" }}>
            {downloading ? "Exporting..." : "Export all"}
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {/* Rail: Add + Layers, the two things that are never about a selection */}
          <div style={{ width: 76, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 14, borderRight: `1px solid ${C.line}` }}>
            {[
              ["add", "Add", Plus],
              ["layers", "Layers", Layers],
            ].map(([id, label, Icon]) => {
              const on = deskMode === id;
              return (
                <button key={id} aria-pressed={on} onClick={() => setDeskMode((m) => (m === id ? null : id))} style={{ width: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, border: "none", background: "transparent", color: on || id === "add" ? C.text : C.sec, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>
                  <span style={{ width: 44, height: 36, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: id === "add" ? C.red : on ? C.sel : C.raised, color: id === "add" ? "#fff" : "inherit" }}>
                    <Icon size={20} />
                  </span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Inspector: the tools of what is selected, in one place */}
          <div style={{ width: 340, flexShrink: 0, background: C.card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ minHeight: 60, display: "flex", alignItems: "center", gap: 6, padding: "8px 10px 4px 16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {deskMode ? (
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{deskMode === "add" ? "Add" : "Layers"}</span>
                ) : (
                  selChip(false)
                )}
                {deskNote && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{deskNote}</div>}
              </div>
              {!deskMode && selectedEl && (
                <>
                  <button aria-label="Duplicate" title="Duplicate" onClick={duplicateSelected} style={iconBtn({ width: 36, height: 36, background: C.raised, borderRadius: 10 })}><Copy size={16} /></button>
                  <button aria-label="Delete" title="Delete" onClick={deleteSelected} style={iconBtn({ width: 36, height: 36, background: C.raised, borderRadius: 10, color: C.redText })}><Trash2 size={16} /></button>
                </>
              )}
              {!deskMode && !selectedEl && selLayer && (
                <>
                  <button aria-label="Duplicate" title="Duplicate" onClick={() => dupLayer(selLayer.id)} style={iconBtn({ width: 36, height: 36, background: C.raised, borderRadius: 10 })}><Copy size={16} /></button>
                  <button aria-label="Delete" title="Delete" onClick={() => removeLayer(selLayer.id)} style={iconBtn({ width: 36, height: 36, background: C.raised, borderRadius: 10, color: C.redText })}><Trash2 size={16} /></button>
                </>
              )}
              {(deskMode || selKind !== "slide") && (
                <button
                  aria-label={deskMode ? "Close" : "Unselect"}
                  title={deskMode ? "Close" : "Unselect (Esc)"}
                  onClick={() => (deskMode ? setDeskMode(null) : clearSelectionAll())}
                  style={iconBtn({ width: 36, height: 36, color: C.sec })}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {total > 1 && <div style={{ padding: "4px 12px 8px" }}>{scopeToggle()}</div>}
            {!deskMode && (
              <div style={{ display: "flex", gap: 2, padding: "0 8px 10px", borderBottom: `1px solid ${C.line}` }}>
                {kindTools.map(([id, label, Icon]) => {
                  const on = id === deskTool;
                  return (
                    <button
                      key={id}
                      aria-pressed={on}
                      onClick={() => onDeskTab(id)}
                      style={{ flex: 1, minWidth: 0, height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", borderRadius: 12, padding: 0, fontSize: 11, fontWeight: on ? 600 : 500, color: on ? C.text : C.sec, background: on ? C.hover : "transparent", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <Icon size={18} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 20px" }}>
              {deskMode === "add" ? addPanel() : deskMode === "layers" ? layersPanel() : renderTool(deskTool)}
            </div>
          </div>

          {/* Canvas */}
          <div ref={desktopWrapperRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0c0e12", minWidth: 0 }}>
            {(() => {
              const SIDE_W = 44;
              // canvasAreaSize is the measured CONTENT box of the row below
              // (padding already excluded); fall back to the column measurement
              // (minus the row padding) until the row has been measured once.
              const measured = canvasAreaSize.h > 0;
              const availW = Math.max((measured ? canvasAreaSize.w : desktopWrapperSize.w - 48) - SIDE_W, 80);
              const availH = Math.max(measured ? canvasAreaSize.h : desktopWrapperSize.h - 24, 80);
              const { displayW: slideW, displayH: slideH } = computeDisplaySize(CW / CH, availW, availH);
              const slideScale = CW > 0 ? slideW / CW : 0.3;
              const sideBtn = (dis) => ({
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: dis ? "#3a404b" : C.sec,
                cursor: dis ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              });
              return (
                <div ref={measureCanvasArea} style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "12px 24px", minHeight: 0 }}>
                  <div style={{ position: "relative", width: slideW, height: slideH, borderRadius: 8, flexShrink: 0, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", isolation: "isolate" }}>
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 8, zIndex: 0 }}>
                      <CanvasPreview {...previewProps} slide={slide} scale={slideScale} canvasW={CW} canvasH={CH} hideInteractive />
                    </div>
                    {canvasLayers(slideScale)}
                  </div>

                  {/* Slides column: order, copy, delete, move between */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", height: slideH, width: SIDE_W, marginLeft: 8, flexShrink: 0, padding: "4px 0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{active + 1}/{total}</span>
                      {[
                        { icon: <MoveUp size={15} />, fn: () => moveSlide(active, -1), dis: active === 0, title: "Move slide up" },
                        { icon: <MoveDown size={15} />, fn: () => moveSlide(active, 1), dis: active === total - 1, title: "Move slide down" },
                        { icon: <Copy size={15} />, fn: () => duplicateSlideAt(active), dis: false, title: "Duplicate slide" },
                        { icon: <Trash2 size={15} />, fn: () => removeSlide(active), dis: total <= 1, title: "Delete slide" },
                      ].map(({ icon, fn, dis, title }) => (
                        <button key={title} aria-label={title} title={title} onClick={fn} disabled={dis} style={sideBtn(dis)}>{icon}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <button aria-label="Previous slide" onClick={() => { setActive(Math.max(0, active - 1)); clearSelectionAll(); }} disabled={active === 0} style={sideBtn(active === 0)}>
                        <ChevronLeft size={16} style={{ transform: "rotate(90deg)" }} />
                      </button>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        {slides.map((s, i) => (
                          <button
                            key={s.id}
                            aria-label={`Slide ${i + 1}`}
                            onClick={() => { setActive(i); clearSelectionAll(); }}
                            style={{ width: 6, height: i === active ? 18 : 6, borderRadius: 3, border: "none", background: i === active ? C.text : "rgba(255,255,255,0.2)", cursor: "pointer", padding: 0, flexShrink: 0 }}
                          />
                        ))}
                      </div>
                      <button aria-label="Next slide" onClick={() => { setActive(Math.min(total - 1, active + 1)); clearSelectionAll(); }} disabled={active === total - 1} style={sideBtn(active === total - 1)}>
                        <ChevronRight size={16} style={{ transform: "rotate(90deg)" }} />
                      </button>
                      <button aria-label="Add slide" title="Add slide" onClick={addSlide} style={{ ...sideBtn(false), border: "1px dashed #3a404b" }}>
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
