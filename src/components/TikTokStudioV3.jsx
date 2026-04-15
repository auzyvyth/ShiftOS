import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../supabaseClient";
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
  Sliders,
  Palette,
  Type,
  Star,
  Zap,
  BookMarked,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  MoveUp,
  MoveDown,
  RotateCcw,
  FlipHorizontal,
  SlidersHorizontal,
  Sparkles,
  Film,
  LayoutTemplate,
  Brush,
  Tag,
  Library,
  Smartphone,
  Monitor,
} from "lucide-react";
import { useLayerEditor } from "../hooks/useLayerEditor";
import LayerCanvas, {
  LayerToolbar,
  LayerStack,
  LayerPropertiesPanel,
  renderLayersToCanvas,
} from "./studio/LayerCanvas";

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const AI_LIMIT = 100;

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
function calcMonthly(price) {
  if (!price) return null;
  const loan = price * 0.9;
  return Math.round((loan + (3.5 / 100) * loan * 9) / (9 * 12));
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
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = url;
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

// ─── Templates ────────────────────────────────────────────────────────────────
const SLIDE_TEMPLATES = [
  { id: "hype", label: "Hype", icon: "🔥" },
  { id: "hero-hook", label: "Hook", icon: "⚡" },
  { id: "pricing", label: "Pricing", icon: "💰" },
  { id: "cta", label: "CTA", icon: "📲" },
  { id: "story", label: "Story", icon: "✨" },
  { id: "minimal", label: "Minimal", icon: "🖤" },
];

// ─── Default Theme ────────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  accentColor: "#dc2626",
  bgColor: "#060910",
  overlayOpacity: 0.45,
  overlayStyle: "dark",
  overlayGradient: "standard",
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
  const brand = listing?.brand || "";
  const model = listing?.model || "";
  const variant = listing?.variant || "";
  const year = String(listing?.year || "");
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
  const mileage = listing?.mileage
    ? Number(listing.mileage).toLocaleString() + " km"
    : "";
  const trans = listing?.transmission || "";
  const fuel = listing?.fuel_type || listing?.fuel || "";
  const acc = theme?.accentColor || "#dc2626";
  return [
    {
      id: "hook",
      type: "text",
      content: "POV: You just found your dream car 🚗",
      x: 540,
      y: 110,
      fontSize: 38,
      fontWeight: "600",
      color: "#ffffff",
      rotation: 0,
      opacity: 0.92,
      align: "center",
      visible: true,
      locked: false,
    },
    {
      id: "headline",
      type: "text",
      content:
        [`${year} ${brand} ${model}`, variant]
          .filter(Boolean)
          .join(" ")
          .trim() || "Your Car",
      x: 60,
      y: 1480,
      fontSize: 72,
      fontWeight: "800",
      color: "#ffffff",
      rotation: 0,
      opacity: 1,
      align: "left",
      visible: true,
      locked: false,
    },
    {
      id: "price",
      type: "text",
      content: priceStr || "Price on Request",
      x: 60,
      y: 1590,
      fontSize: 52,
      fontWeight: "700",
      color: acc,
      rotation: 0,
      opacity: 1,
      align: "left",
      visible: true,
      locked: false,
    },
    {
      id: "stats",
      type: "text",
      content: [mileage, trans, fuel].filter(Boolean).join(" · ") || "",
      x: 60,
      y: 1665,
      fontSize: 30,
      fontWeight: "400",
      color: "rgba(255,255,255,0.65)",
      rotation: 0,
      opacity: 1,
      align: "left",
      visible: true,
      locked: false,
    },
    {
      id: "watermark",
      type: "text",
      content: dealerName || "XDrive",
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
  });

  if (!images.length) return [makeSlide(null, "hype")];
  const tpls = ["hype", "story", "pricing", "cta", "minimal", "hype", "hype"];
  return images.slice(0, 7).map((img, i) => makeSlide(img, tpls[i] || "hype"));
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
  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
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

// ─── AI: generate slide copy ──────────────────────────────────────────────────
async function generateSlidesCopy(listing, slideCount, language, hookText) {
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "N/A";
  const lang =
    language === "bm"
      ? "Bahasa Malaysia (casual dealer tone)"
      : "English (punchy Malaysian car market)";
  const prompt = `Malaysian car dealer TikTok copywriter. Write ${slideCount} slides.
CAR: ${listing?.year || ""} ${listing?.brand || ""} ${listing?.model || ""} ${listing?.variant || ""}
Price: ${priceStr} | Mileage: ${listing?.mileage ? Number(listing.mileage).toLocaleString() + " km" : "N/A"}
Condition: ${listing?.condition || ""} | Trans: ${listing?.transmission || ""} | Fuel: ${listing?.fuel_type || ""}
${hookText ? 'Hook: "' + hookText + '"' : ""} | Language: ${lang}
Return ONLY JSON array: [{"hookText":"max 6 words ALL CAPS","headline":"full car title"}]`;
  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("API error");
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
  ctx.fillStyle = theme.bgColor || "#060910";
  ctx.fillRect(0, 0, W, H);

  // ── Car photo ────────────────────────────────────────────────────────────
  if (slide.imageUrl) {
    const img = await loadImage(slide.imageUrl);
    if (img) {
      // Blurred background — cover fill (no black bars)
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

      // Main image — cover fill so photo always fills the entire frame
      ctx.save();
      const ar = img.naturalWidth / img.naturalHeight;
      const car = W / H;
      let dw, dh, dx, dy;
      if (ar > car) {
        dh = H;
        dw = H * ar;
        dx = (W - dw) / 2;
        dy = 0;
      } else {
        dw = W;
        dh = W / ar;
        dx = 0;
        dy = (H - dh) / 2;
      }
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    }
  }

  // ── Gradient overlay ─────────────────────────────────────────────────────
  const overlayGrad = theme.overlayGradient || "standard";
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
  if (theme.watermarkText) {
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
  // Step 1: background (image, gradient, chrome)
  await renderBackground(canvas, slide, theme, fontId, CW, CH);

  // Step 2: text / badge elements on top
  const ctx = canvas.getContext("2d");
  const W = CW;
  const H = CH;
  const fontObj = FONTS.find((f) => f.id === fontId) || FONTS[0];
  const fstack = fontObj.stack.replace(/'/g, "");

  for (const el of slide.elements || []) {
    if (!el.visible) continue;
    if (el.id === "watermark") continue; // already in renderBackground

    if (el.type === "badge") {
      const pad = 16;
      ctx.font = `${el.fontWeight || "700"} ${el.fontSize || 28}px ${fstack}`;
      const tw = ctx.measureText(el.content || "").width;
      const bw = tw + pad * 2;
      const bh = (el.fontSize || 28) + pad;
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      ctx.translate(el.x, el.y);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = el.bgColor || el.color || "#dc2626";
      ctx.beginPath();
      ctx.roundRect(-pad, -(el.fontSize || 28) * 0.8, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(el.content || "", 0, -(el.fontSize || 28) * 0.8 + pad * 0.4);
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = el.color || "#fff";
    ctx.font = `${el.fontStyle === "italic" ? "italic " : ""}${el.fontWeight || "400"} ${el.fontSize || 32}px ${fstack}`;
    if (el.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
    }
    ctx.textAlign = el.align || "left";
    ctx.textBaseline = "top";
    ctx.fillText(el.content || "", 0, 0);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
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
    animation: highlighted ? "ttsv3-highlight 0.6s ease" : "none",
  };

  const handlers = {
    onClick: (e) => {
      e.stopPropagation();
      onSelect(el.id);
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
    onDoubleClick: () => !el.locked && onDoubleClick(el.id),
  };

  if (el.type === "badge") {
    return (
      <div
        data-el-id={el.id}
        style={{
          ...sharedStyle,
          background: el.bgColor || el.color || "#dc2626",
          color: "#fff",
          fontSize: el.fontSize * scale,
          fontWeight: el.fontWeight,
          fontFamily: fontStack,
          padding: `${6 * scale}px ${14 * scale}px`,
          borderRadius: 999,
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

  return (
    <div
      data-el-id={el.id}
      style={{
        ...sharedStyle,
        fontSize: el.fontSize * scale,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle || "normal",
        color: el.color,
        textAlign: el.align,
        fontFamily: fontStack,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        zIndex: 10,
        textShadow: el.shadow
          ? "0 2px 8px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.9)"
          : "none",
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
  const H = 8; // handle square size
  const HALF = H / 2;

  const handleBase = {
    position: "absolute",
    width: H,
    height: H,
    background: "#ffffff",
    border: "1.5px solid #2563eb",
    borderRadius: 2,
    boxSizing: "border-box",
    boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
    pointerEvents: "all",
    zIndex: 3,
  };

  const corners = [
    { pos: "nw", style: { top: -HALF, left: -HALF, cursor: "nw-resize" } },
    { pos: "ne", style: { top: -HALF, right: -HALF, cursor: "ne-resize" } },
    { pos: "sw", style: { bottom: -HALF, left: -HALF, cursor: "sw-resize" } },
    { pos: "se", style: { bottom: -HALF, right: -HALF, cursor: "se-resize" } },
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

      {/* Corner resize handles */}
      {corners.map(({ pos, style }) => (
        <div
          key={pos}
          style={{ ...handleBase, ...style }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartResize(e, elId, pos);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onStartResize(e, elId, pos);
          }}
        />
      ))}

      {/* Rotate handle — above top-center */}
      <div
        style={{
          position: "absolute",
          top: -(30 + HALF),
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "all",
          cursor: "grab",
          gap: 0,
          zIndex: 4,
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
          }}
        >
          ↻
        </div>
      </div>

      {/* Floating mini toolbar — above the rotate handle */}
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: 38,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pointerEvents: "all",
          background: "rgba(10,13,20,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 9,
          padding: "3px 5px",
          boxShadow: "0 6px 24px rgba(0,0,0,0.55)",
          whiteSpace: "nowrap",
          zIndex: 5,
        }}
      >
        {/* Bold */}
        <MiniBtn
          active={el?.fontWeight >= "700"}
          onClick={() =>
            onUpdate({ fontWeight: el?.fontWeight >= "700" ? "400" : "700" })
          }
          title="Bold"
        >
          <b>B</b>
        </MiniBtn>
        {/* Italic */}
        <MiniBtn
          active={el?.fontStyle === "italic"}
          onClick={() =>
            onUpdate({
              fontStyle: el?.fontStyle === "italic" ? "normal" : "italic",
            })
          }
          title="Italic"
        >
          <i>I</i>
        </MiniBtn>
        <MiniSep />
        {/* Align */}
        {[
          ["left", "◀"],
          ["center", "■"],
          ["right", "▶"],
        ].map(([a, icon]) => (
          <MiniBtn
            key={a}
            active={el?.align === a}
            onClick={() => onUpdate({ align: a })}
            title={`Align ${a}`}
          >
            <span style={{ fontSize: 8 }}>{icon}</span>
          </MiniBtn>
        ))}
        <MiniSep />
        {/* Color swatch */}
        <label title="Color" style={{ display: "flex", cursor: "pointer" }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: el?.color || "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              overflow: "hidden",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <input
              type="color"
              value={el?.color || "#ffffff"}
              onChange={(e) => onUpdate({ color: e.target.value })}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        </label>
        <MiniSep />
        {/* Duplicate */}
        <MiniBtn onClick={onDuplicate} title="Duplicate">
          ⧉
        </MiniBtn>
        {/* Delete */}
        <MiniBtn danger onClick={onDelete} title="Delete">
          ✕
        </MiniBtn>
      </div>
    </div>
  );
}

function MiniBtn({ children, onClick, active, danger, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        border: "none",
        borderRadius: 5,
        cursor: "pointer",
        background: active
          ? "rgba(37,99,235,0.2)"
          : danger
            ? "rgba(37,99,235,0.08)"
            : "transparent",
        color: danger
          ? "#f87171"
          : active
            ? "#60a5fa"
            : "rgba(255,255,255,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
function MiniSep() {
  return (
    <div
      style={{
        width: 1,
        height: 14,
        background: "rgba(255,255,255,0.1)",
        margin: "0 1px",
      }}
    />
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
  ]);

  return (
    <div
      ref={combinedRef}
      onClick={onDeselectAll}
      onTouchEnd={e => {
        // Issue 5: Tap on empty canvas background deselects layers on mobile
        if (e.target === e.currentTarget || e.target.tagName === 'CANVAS') {
          onDeselectAll();
        }
      }}
      style={{
        position: "relative",
        width: W,
        height: H,
        overflow: "hidden",
        borderRadius: 4,
        userSelect: "none",
        flexShrink: 0,
        background: "#0a0d14",
        isolation: "isolate",   // Issue 3: explicit stacking context for z-order
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
        }}
      />

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

      {/* ── Interactive text / badge elements layer ── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
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
    </div>
  );
}

// ─── FilmThumb ────────────────────────────────────────────────────────────────
const FilmThumb = React.memo(function FilmThumb({
  slide,
  idx,
  active,
  onSelect,
  onDelete,
}) {
  return (
    <div
      onClick={() => onSelect(idx)}
      style={{
        position: "relative",
        width: 44,
        height: 78,
        flexShrink: 0,
        borderRadius: 5,
        overflow: "hidden",
        cursor: "pointer",
        background: "#1e2130",
        border: `2px solid ${active ? "#2563eb" : "rgba(255,255,255,0.1)"}`,
        transition: "border-color 0.15s",
      }}
    >
      {slide.imageUrl && (
        <img
          src={slide.imageUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.65,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          bottom: 2,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 8,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {idx + 1}
      </div>
      {active && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(idx);
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.9)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 8,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
});

// ─── ImagePicker ──────────────────────────────────────────────────────────────
function ImagePicker({ images, current, onSelect, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.97)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Choose Photo · {images.length} available
        </span>
        <button
          onClick={onClose}
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 10,
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6,
        }}
      >
        {images.map((url, i) => (
          <div
            key={i}
            onClick={() => {
              onSelect(url);
              onClose();
            }}
            style={{
              position: "relative",
              aspectRatio: "4/3",
              borderRadius: 8,
              overflow: "hidden",
              cursor: "pointer",
              border:
                current === url ? "2px solid #2563eb" : "2px solid transparent",
            }}
          >
            <img
              src={url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {current === url && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(220,38,38,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  color: "#fff",
                }}
              >
                ✓
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
function ColorRow({ label, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "monospace",
          }}
        >
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            cursor: "pointer",
            padding: 2,
            background: "transparent",
          }}
        />
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 0.01, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.9)",
            fontWeight: 600,
          }}
        >
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#2563eb" }}
      />
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
      }}
    >
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: value ? "#2563eb" : "rgba(255,255,255,0.12)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        {label}
      </span>
    </label>
  );
}

function SectionHead({ label }) {
  return (
    <p
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.3)",
        margin: "18px 0 9px",
        paddingBottom: 6,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {label}
    </p>
  );
}

function PInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        color: "rgba(255,255,255,0.9)",
        fontFamily: "'DM Sans',sans-serif",
        fontSize: 12,
        outline: "none",
        boxSizing: "border-box",
      }}
      onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TikTokStudioV3({ listing, onClose }) {
  // ── State ────────────────────────────────────────────────────────────────
  const [slides, setSlides] = useState([]);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("slide");
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
  const [language, setLanguage] = useState("en");
  const [hookText, setHookText] = useState("");
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scale, setScale] = useState(0.3);
  const [isMobile, setIsMobile] = useState(false);
  const [userId, setUserId] = useState(null);
  const [canvasFormat, setCanvasFormat] = useState("9:16");
  const [uploadedImages, setUploadedImages] = useState([]);

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

  const [savedDesigns, setSavedDesigns] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ttsv3_designs") || "[]");
    } catch {
      return [];
    }
  });
  const [designName, setDesignName] = useState("");
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

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const history = useRef([]);
  const historyIdx = useRef(-1);

  function pushHistory(newSlides) {
    const trimmed = history.current.slice(0, historyIdx.current + 1);
    trimmed.push(JSON.parse(JSON.stringify(newSlides)));
    history.current = trimmed.slice(-30);
    historyIdx.current = history.current.length - 1;
  }
  function undo() {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    setSlides(JSON.parse(JSON.stringify(history.current[historyIdx.current])));
  }
  function redo() {
    if (historyIdx.current >= history.current.length - 1) return;
    historyIdx.current++;
    setSlides(JSON.parse(JSON.stringify(history.current[historyIdx.current])));
  }

  // ── Interaction refs ─────────────────────────────────────────────────────
  const dragging = useRef(null);
  const resizing = useRef(null);
  const rotating = useRef(null);
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
    setLayers(slides[active]?.layers || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Persist layers back to the slide whenever they change
  useEffect(() => {
    setSlides((ss) => ss.map((s, i) => (i === active ? { ...s, layers } : s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // Issue 1: Lock viewport zoom while studio is open (prevents browser pinch-zoom)
  useEffect(() => {
    const meta = document.querySelector('meta[name=viewport]');
    const original = meta?.getAttribute('content');
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    return () => { if (original) meta?.setAttribute('content', original); };
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
    pushHistory(initial);
    ensureFont("dm");
  }, [listing, rawImages, features]);

  // ── Scale (uses CW/CH) ───────────────────────────────────────────────────
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setIsMobile(vw < 768);
      if (vw < 768) {
        setScale(Math.min(((vw - 20) * 0.9) / CW, (vh - 210) / CH, 1));
      } else {
        // popup inset(28) + icon(54) + panel(280) + side-padding(56)
        const usableW = vw - 28 - 54 - 280 - 56;
        // popup inset(28) + header(48) + filmstrip(102) + top+bottom padding(52)
        const usableH = vh - 28 - 48 - 102 - 52;
        setScale(
          Math.min(
            Math.max(usableW, 100) / CW,
            Math.max(usableH, 100) / CH,
            0.98,
          ),
        );
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [CW, CH]);

  // ── Format change → rescale element positions ────────────────────────────
  useEffect(() => {
    if (prevFormatRef.current === canvasFormat) return;
    const oldFmt = FORMATS.find((f) => f.id === prevFormatRef.current);
    const newFmt = FORMATS.find((f) => f.id === canvasFormat);
    const oldCW = oldFmt?.w || CANVAS_W;
    const oldCH = oldFmt?.h || CANVAS_H;
    const newCW = newFmt?.w || CANVAS_W;
    const newCH = newFmt?.h || CANVAS_H;
    setSlides((ss) => {
      const newSlides = ss.map((s) => ({
        ...s,
        elements: s.elements.map((el) => ({
          ...el,
          x: Math.round(el.x * (newCW / oldCW)),
          y: Math.round(el.y * (newCH / oldCH)),
        })),
      }));
      return newSlides;
    });
    prevFormatRef.current = canvasFormat;
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

      if (e.key === "Escape") {
        selectedId ? setSelectedId(null) : onClose();
      }
      if (e.key === "ArrowLeft") setActive((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActive((i) => Math.min(total - 1, i + 1));
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId)
        deleteSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedId) {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, total, selectedId]);

  // ── Element helpers ──────────────────────────────────────────────────────
  const updateElement = useCallback(
    (id, patch) => {
      setSlides((ss) => {
        const newSlides = ss.map((s, i) =>
          i !== active
            ? s
            : {
                ...s,
                elements: s.elements.map((e) =>
                  e.id === id ? { ...e, ...patch } : e,
                ),
              },
        );
        // Only push history when not actively dragging/resizing/rotating
        if (!dragging.current && !resizing.current && !rotating.current) {
          pushHistory(newSlides);
        }
        return newSlides;
      });
    },
    [active],
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
      const newSlides = ss.map((s, i) =>
        i !== active
          ? s
          : { ...s, elements: s.elements.filter((e) => e.id !== selectedId) },
      );
      pushHistory(newSlides);
      return newSlides;
    });
    setSelectedId(null);
  }, [selectedId, active]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId || !slide) return;
    const el = slide.elements.find((e) => e.id === selectedId);
    if (!el) return;
    const dup = { ...el, id: uid(), x: el.x + 30, y: el.y + 30, locked: false };
    setSlides((ss) => {
      const newSlides = ss.map((s, i) =>
        i !== active ? s : { ...s, elements: [...s.elements, dup] },
      );
      pushHistory(newSlides);
      return newSlides;
    });
    setSelectedId(dup.id);
  }, [selectedId, slide, active]);

  const addTextElement = useCallback(() => {
    const el = {
      id: uid(),
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
    };
    setSlides((ss) => {
      const newSlides = ss.map((s, i) =>
        i !== active ? s : { ...s, elements: [...s.elements, el] },
      );
      pushHistory(newSlides);
      return newSlides;
    });
    setSelectedId(el.id);
  }, [active, CW, CH]);

  const addBadgeElement = useCallback(() => {
    const el = {
      id: uid(),
      type: "badge",
      content: "HOT DEAL",
      x: 60,
      y: 200,
      fontSize: 28,
      fontWeight: "700",
      color: "#fff",
      bgColor: theme.accentColor || "#dc2626",
      rotation: 0,
      opacity: 1,
      align: "center",
      visible: true,
      locked: false,
    };
    setSlides((ss) => {
      const newSlides = ss.map((s, i) =>
        i !== active ? s : { ...s, elements: [...s.elements, el] },
      );
      pushHistory(newSlides);
      return newSlides;
    });
    setSelectedId(el.id);
  }, [active, theme.accentColor]);

  // ── Drag / Resize / Rotate ───────────────────────────────────────────────
  const onStartDrag = useCallback(
    (e, id) => {
      setSelectedId(id);
      const el = slide?.elements?.find((el) => el.id === id);
      if (!el || el.locked) return;
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      dragging.current = {
        id,
        startX: cx,
        startY: cy,
        origX: el.x,
        origY: el.y,
      };
      e.preventDefault();
    },
    [slide],
  );

  const onStartResize = useCallback(
    (e, id, handle) => {
      const el = slide?.elements?.find((el) => el.id === id);
      if (!el) return;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      resizing.current = { id, handle, startY: cy, origFontSize: el.fontSize };
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

      if (dragging.current) {
        const { id, startX, startY, origX, origY } = dragging.current;
        updateElement(id, {
          x: Math.max(0, Math.min(CW, origX + (cx - startX) / scale)),
          y: Math.max(0, Math.min(CH, origY + (cy - startY) / scale)),
        });
      }
      if (resizing.current) {
        const { id, startY, origFontSize } = resizing.current;
        updateElement(id, {
          fontSize: Math.round(
            Math.max(
              16,
              Math.min(200, origFontSize + ((cy - startY) / scale) * 0.5),
            ),
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
        dragging.current ||
        resizing.current ||
        rotating.current
      );
      dragging.current = null;
      resizing.current = null;
      rotating.current = null;
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
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
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
    },
    [active],
  );

  const applyTemplateContent = useCallback(
    (templateId) => {
      const brand = listing?.brand || "";
      const model = listing?.model || "";
      const variant = listing?.variant || "";
      const year = String(listing?.year || "");
      const price = listing?.selling_price || listing?.price;
      const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
      const monthly = calcMonthly(price);
      const monthlyStr = monthly ? `RM ${monthly.toLocaleString()}/mo` : "";
      const mileage = listing?.mileage
        ? Number(listing.mileage).toLocaleString() + " km"
        : "";
      const trans = listing?.transmission || "";
      const fuel = listing?.fuel_type || listing?.fuel || "";
      const cond = listing?.condition || "";
      const condLabel =
        { new: "Brand New", recon: "Recon", used: "Used" }[cond] || cond;
      const whatsapp = slide?.whatsapp || listing?.whatsapp_number || "";
      const featureList = features.slice(0, 3).join(", ");

      const contentMap = {
        hype: {
          hook: "POV: You just found your dream car 🚗",
          headline:
            [`${year} ${brand} ${model}`, variant]
              .filter(Boolean)
              .join(" ")
              .trim() || "Your Car",
          price: priceStr || "Price on Request",
          stats: [mileage, trans, fuel].filter(Boolean).join(" · "),
        },
        "hero-hook": {
          hook: `This ${brand} ${model} will CHANGE your life 🔥`,
          headline:
            [`${year} ${brand} ${model}`, variant]
              .filter(Boolean)
              .join(" ")
              .trim() || "Your Car",
          price: priceStr || "Price on Request",
          stats: [condLabel, mileage].filter(Boolean).join(" · "),
        },

        pricing: {
          hook: `Best deal in Malaysia 💰`,
          headline: priceStr || "Price on Request",
          price: monthlyStr ? `As low as ${monthlyStr}` : priceStr,
          stats: `${condLabel} · ${mileage}`.replace(/^·\s*|·\s*$/, "").trim(),
        },
        cta: {
          hook: `DM us now! Limited unit 📲`,
          headline:
            [`${year} ${brand} ${model}`].join(" ").trim() || "Your Car",
          price: priceStr || "Price on Request",
          stats: whatsapp ? `WhatsApp: ${whatsapp}` : "Contact us today",
        },
        story: {
          hook: `${condLabel ? condLabel + " · " : ""}${year} ${brand} ${model} ✨`,
          headline:
            [`${year} ${brand} ${model}`, variant]
              .filter(Boolean)
              .join(" ")
              .trim() || "Your Car",
          price: priceStr || "Price on Request",
          stats: [mileage, trans, fuel].filter(Boolean).join(" · "),
        },
        minimal: {
          hook: `${brand} ${model}`,
          headline:
            [`${year} ${brand} ${model}`, variant]
              .filter(Boolean)
              .join(" ")
              .trim() || "Your Car",
          price: priceStr || "Price on Request",
          stats: "",
        },
      };

      const c = contentMap[templateId];
      if (!c) return;

      setSlides((ss) =>
        ss.map((s, i) =>
          i !== active
            ? s
            : {
                ...s,
                template: templateId,
                elements: s.elements.map((el) => {
                  if (el.id === "hook") return { ...el, content: c.hook };
                  if (el.id === "headline")
                    return { ...el, content: c.headline };
                  if (el.id === "price") return { ...el, content: c.price };
                  if (el.id === "stats") return { ...el, content: c.stats };
                  return el;
                }),
              },
        ),
      );
    },
    [active, listing, slide, features],
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
      const c = document.createElement("canvas");
      await renderToCanvas(c, slides[idx], theme, font, CW, CH);
      await renderLayersToCanvas(c, slides[idx]?.layers || [], CW, CH);
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
    const entry = {
      id: uid(),
      name,
      thumb,
      theme: { ...theme },
      font,
      elements: JSON.parse(JSON.stringify(slide?.elements || [])),
      format: canvasFormat,
      savedAt: Date.now(),
    };
    const updated = [entry, ...savedDesigns].slice(0, 24);
    setSavedDesigns(updated);
    localStorage.setItem("ttsv3_designs", JSON.stringify(updated));
    setDesignName("");
  }, [slide, theme, font, canvasFormat, savedDesigns, designName, listing]);

  const loadDesign = useCallback((d) => {
    setTheme(d.theme);
    setFont(d.font);
    if (d.format) setCanvasFormat(d.format);
    if (d.elements?.length) {
      setSlides((ss) =>
        ss.map((s) => ({
          ...s,
          elements: d.elements.map((e) => ({ ...e, id: uid() })),
        })),
      );
    }
    setActiveTab("slide");
  }, []);

  const deleteDesign = useCallback(
    (id) => {
      const updated = savedDesigns.filter((d) => d.id !== id);
      setSavedDesigns(updated);
      localStorage.setItem("ttsv3_designs", JSON.stringify(updated));
    },
    [savedDesigns],
  );

  if (!slide) return null;

  // ── Tab panels ────────────────────────────────────────────────────────────

  // ── Element Properties Panel ─────────────────────────────────────────────
  const ElPropsPanel = () => {
    if (!selectedEl) return null;
    return (
      <div
        style={{
          background: "rgba(220,38,38,0.05)",
          border: "1px solid rgba(220,38,38,0.15)",
          borderRadius: 10,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#60a5fa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            ✎ {selectedEl.id}
          </span>
          <button
            onClick={() => setSelectedId(null)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content input */}
        <PInput
          value={selectedEl.content || ""}
          placeholder="Text content"
          onChange={(e) => updateSelectedElement({ content: e.target.value })}
        />

        {/* Font size */}
        <SliderRow
          label="Font Size"
          value={selectedEl.fontSize || 32}
          min={16}
          max={200}
          step={1}
          onChange={(v) => updateSelectedElement({ fontSize: v })}
          fmt={(v) => `${v}px`}
        />

        {/* Opacity */}
        <SliderRow
          label="Opacity"
          value={selectedEl.opacity ?? 1}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateSelectedElement({ opacity: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />

        {/* Rotation */}
        <SliderRow
          label="Rotation"
          value={selectedEl.rotation || 0}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => updateSelectedElement({ rotation: v })}
          fmt={(v) => `${v}°`}
        />

        {/* Color */}
        <ColorRow
          label="Color"
          value={selectedEl.color || "#ffffff"}
          onChange={(v) => updateSelectedElement({ color: v })}
        />

        {/* X / Y */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                marginBottom: 3,
              }}
            >
              X
            </p>
            <input
              type="number"
              value={Math.round(selectedEl.x)}
              onChange={(e) =>
                updateSelectedElement({ x: Number(e.target.value) })
              }
              style={{
                width: "100%",
                padding: "6px 8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 7,
                color: "#fff",
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 11,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                marginBottom: 3,
              }}
            >
              Y
            </p>
            <input
              type="number"
              value={Math.round(selectedEl.y)}
              onChange={(e) =>
                updateSelectedElement({ y: Number(e.target.value) })
              }
              style={{
                width: "100%",
                padding: "6px 8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 7,
                color: "#fff",
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 11,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Font weight */}
        <div
          style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}
        >
          {[
            { w: "300", label: "Thin" },
            { w: "400", label: "Reg" },
            { w: "600", label: "Med" },
            { w: "700", label: "Bold" },
            { w: "800", label: "Black" },
          ].map(({ w, label }) => (
            <button
              key={w}
              onClick={() => updateSelectedElement({ fontWeight: w })}
              style={{
                flex: 1,
                padding: "5px 3px",
                borderRadius: 6,
                border: `1px solid ${selectedEl.fontWeight === w ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                background:
                  selectedEl.fontWeight === w
                    ? "rgba(37,99,235,0.1)"
                    : "transparent",
                color: "rgba(255,255,255,0.6)",
                fontSize: 9,
                cursor: "pointer",
                fontWeight: w,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Align */}
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {["left", "center", "right"].map((a) => (
            <button
              key={a}
              onClick={() => updateSelectedElement({ align: a })}
              style={{
                flex: 1,
                padding: "5px 4px",
                borderRadius: 6,
                border: `1px solid ${selectedEl.align === a ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                background:
                  selectedEl.align === a
                    ? "rgba(37,99,235,0.1)"
                    : "transparent",
                color: "rgba(255,255,255,0.6)",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              {a === "left" ? "◀" : a === "center" ? "■" : "▶"}
            </button>
          ))}
        </div>
        {/* Italic + Shadow toggles */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            onClick={() =>
              updateSelectedElement({
                fontStyle:
                  selectedEl.fontStyle === "italic" ? "normal" : "italic",
              })
            }
            style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 6,
              border: `1px solid ${selectedEl.fontStyle === "italic" ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
              background:
                selectedEl.fontStyle === "italic"
                  ? "rgba(37,99,235,0.1)"
                  : "transparent",
              color:
                selectedEl.fontStyle === "italic"
                  ? "#60a5fa"
                  : "rgba(255,255,255,0.5)",
              fontSize: 11,
              cursor: "pointer",
              fontStyle: "italic",
            }}
          >
            Italic
          </button>
          <button
            onClick={() =>
              updateSelectedElement({ shadow: !selectedEl.shadow })
            }
            style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 6,
              border: `1px solid ${selectedEl.shadow ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
              background: selectedEl.shadow
                ? "rgba(37,99,235,0.1)"
                : "transparent",
              color: selectedEl.shadow ? "#60a5fa" : "rgba(255,255,255,0.5)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Shadow
          </button>
        </div>
      </div>
    );
  };

  // ── SlidePanel ───────────────────────────────────────────────────────────
  const SlidePanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Element properties — shown when an element is selected */}
      {ElPropsPanel()}

      <SectionHead label="Image" />
      <button
        onClick={() => setShowImagePicker(true)}
        style={{
          width: "100%",
          padding: "9px 0",
          borderRadius: 10,
          border: "1px dashed rgba(255,255,255,0.14)",
          background: "transparent",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        📷 Change photo
      </button>

      <SectionHead label="Template" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 5,
        }}
      >
        {SLIDE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => applyTemplateContent(t.id)}
            style={{
              padding: "7px 4px",
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${
                slide.template === t.id
                  ? "rgba(37,99,235,0.5)"
                  : "rgba(255,255,255,0.07)"
              }`,
              background:
                slide.template === t.id ? "rgba(37,99,235,0.1)" : "transparent",
              color:
                slide.template === t.id ? "#60a5fa" : "rgba(255,255,255,0.45)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span style={{ fontSize: 9 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <SectionHead label="Elements" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {slide.elements.map((el) => (
          <div
            key={el.id}
            onClick={() => setSelectedId(el.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              borderRadius: 8,
              cursor: "pointer",
              background:
                selectedId === el.id
                  ? "rgba(37,99,235,0.08)"
                  : "rgba(255,255,255,0.025)",
              border: `1px solid ${
                selectedId === el.id
                  ? "rgba(37,99,235,0.28)"
                  : "rgba(255,255,255,0.05)"
              }`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.65)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {el.type === "badge" ? "🏷 " : ""}
              {el.content || "(empty)"}
            </span>
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateElement(el.id, { visible: !el.visible });
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: el.visible
                    ? "rgba(255,255,255,0.45)"
                    : "rgba(255,255,255,0.2)",
                }}
              >
                {el.visible ? "👁" : "○"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateElement(el.id, { locked: !el.locked });
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: el.locked ? "#3b82f6" : "rgba(255,255,255,0.25)",
                }}
              >
                {el.locked ? "🔒" : "🔓"}
              </button>
            </div>
          </div>
        ))}

        {/* Add element buttons */}
        <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
          <button
            onClick={addTextElement}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: "1px dashed rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(255,255,255,0.28)",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            + Add text
          </button>
          <button
            onClick={addBadgeElement}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: "1px dashed rgba(37,99,235,0.2)",
              background: "transparent",
              color: "rgba(37,99,235,0.5)",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            + Add badge
          </button>
        </div>
      </div>
    </div>
  );

  // ── DesignPanel ──────────────────────────────────────────────────────────
  const DesignPanel = () => (
    <div>
      {/* Canvas Format — at TOP of DesignPanel */}
      <SectionHead label="Canvas Format" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 5,
          marginBottom: 14,
        }}
      >
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setCanvasFormat(f.id)}
            style={{
              padding: "8px 6px",
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${
                canvasFormat === f.id
                  ? "rgba(37,99,235,0.5)"
                  : "rgba(255,255,255,0.07)"
              }`,
              background:
                canvasFormat === f.id
                  ? "rgba(37,99,235,0.1)"
                  : "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 14 }}>{f.icon}</span>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color:
                    canvasFormat === f.id
                      ? "#dc2626"
                      : "rgba(255,255,255,0.55)",
                }}
              >
                {f.id}
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
                {f.label}
              </div>
            </div>
          </button>
        ))}
      </div>

      <SectionHead label="Style Preset" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {STYLE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setTheme((t) => ({ ...t, ...p.theme }))}
            style={{
              padding: "7px 6px",
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <div style={{ display: "flex", gap: 3 }}>
              {p.dots.map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: c,
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>
              {p.label}
            </span>
          </button>
        ))}
      </div>

      <SectionHead label="Colors" />
      <ColorRow
        label="Accent"
        value={theme.accentColor}
        onChange={(v) => setTheme((t) => ({ ...t, accentColor: v }))}
      />
      <ColorRow
        label="Background"
        value={theme.bgColor}
        onChange={(v) => setTheme((t) => ({ ...t, bgColor: v }))}
      />

      <SectionHead label="Font" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {FONTS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFont(f.id);
              ensureFont(f.id);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              textAlign: "left",
              cursor: "pointer",
              border: `1px solid ${
                font === f.id
                  ? "rgba(220,38,38,0.45)"
                  : "rgba(255,255,255,0.06)"
              }`,
              background:
                font === f.id ? "rgba(220,38,38,0.07)" : "transparent",
              color: "rgba(255,255,255,0.7)",
              fontFamily: f.stack,
              fontSize: 13,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SectionHead label="Overlay" />
      <SliderRow
        label="Opacity"
        value={theme.overlayOpacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setTheme((t) => ({ ...t, overlayOpacity: v }))}
        fmt={(v) => `${Math.round(v * 100)}%`}
      />
      <SliderRow
        label="Blur intensity"
        value={theme.blurIntensity ?? 18}
        min={0}
        max={30}
        step={1}
        onChange={(v) => setTheme((t) => ({ ...t, blurIntensity: v }))}
        fmt={(v) => `${v}px`}
      />

      <SectionHead label="Overlay style" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 4,
          marginBottom: 12,
        }}
      >
        {[
          {
            id: "standard",
            label: "Auto",
            grad: "linear-gradient(to bottom,rgba(6,9,16,0.95) 0%,rgba(6,9,16,0.05) 40%,rgba(6,9,16,0.9) 100%)",
          },
          {
            id: "top",
            label: "Top",
            grad: "linear-gradient(to bottom,rgba(6,9,16,0.98) 0%,rgba(6,9,16,0.02) 60%)",
          },
          {
            id: "bottom",
            label: "Bottom",
            grad: "linear-gradient(to top,rgba(6,9,16,0.98) 0%,rgba(6,9,16,0.02) 60%)",
          },
          { id: "none", label: "None", grad: "none" },
        ].map((g) => {
          const active2 = (theme.overlayGradient || "standard") === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setTheme((t) => ({ ...t, overlayGradient: g.id }))}
              style={{
                padding: "8px 4px",
                borderRadius: 7,
                cursor: "pointer",
                fontSize: 9,
                border: `1px solid ${
                  active2 ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.07)"
                }`,
                background: active2 ? "rgba(37,99,235,0.08)" : "transparent",
                color: active2 ? "#dc2626" : "rgba(255,255,255,0.4)",
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <SectionHead label="Options" />
      <Toggle
        value={theme.showAccentBar !== false}
        onChange={(v) => setTheme((t) => ({ ...t, showAccentBar: v }))}
        label="Top accent bar"
      />
    </div>
  );

  // ── BrandPanel ───────────────────────────────────────────────────────────
  const BrandPanel = () => (
    <div>
      <SectionHead label="Watermark" />
      <PInput
        value={theme.watermarkText}
        placeholder="Your brand name"
        onChange={(e) => {
          const text = e.target.value;
          setTheme((t) => ({ ...t, watermarkText: text }));
          setSlides((ss) =>
            ss.map((s) => ({
              ...s,
              elements: s.elements.map((el) =>
                el.id === "watermark" ? { ...el, content: text } : el,
              ),
            })),
          );
        }}
      />
      <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
        {["top-right", "top-left", "bottom-right", "bottom-left"].map((p) => (
          <button
            key={p}
            onClick={() => setTheme((t) => ({ ...t, watermarkPos: p }))}
            style={{
              flex: 1,
              padding: "5px 2px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 8,
              border: `1px solid ${
                theme.watermarkPos === p
                  ? "rgba(220,38,38,0.4)"
                  : "rgba(255,255,255,0.08)"
              }`,
              background:
                theme.watermarkPos === p
                  ? "rgba(37,99,235,0.08)"
                  : "transparent",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {p.replace("-", "\n")}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <SliderRow
          label="Watermark opacity"
          value={theme.watermarkOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => {
            setTheme((t) => ({ ...t, watermarkOpacity: v }));
            setSlides((ss) =>
              ss.map((s) => ({
                ...s,
                elements: s.elements.map((el) =>
                  el.id === "watermark" ? { ...el, opacity: v } : el,
                ),
              })),
            );
          }}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
      </div>

      <SectionHead label="Logo" />
      <PInput
        value={theme.logoUrl || ""}
        placeholder="Logo image URL"
        onChange={(e) =>
          setTheme((t) => ({ ...t, logoUrl: e.target.value || null }))
        }
      />
      {theme.logoUrl && (
        <div style={{ marginTop: 10 }}>
          <SliderRow
            label="Logo size"
            value={theme.logoSize || 80}
            min={40}
            max={200}
            step={4}
            onChange={(v) => setTheme((t) => ({ ...t, logoSize: v }))}
            fmt={(v) => `${v}px`}
          />
        </div>
      )}
      <button
        onClick={saveBranding}
        style={{
          width: "100%",
          padding: "11px 0",
          marginTop: 12,
          borderRadius: 10,
          border: "none",
          background: savedBrand
            ? "rgba(34,197,94,0.85)"
            : "rgba(220,38,38,0.85)",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          fontSize: 13,
          transition: "background 0.3s",
        }}
      >
        {savedBrand ? "✓ Saved!" : "Save Brand Kit"}
      </button>
    </div>
  );

  // ── BadgesPanel ──────────────────────────────────────────────────────────
  const BadgesPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="Badges" />
      <Toggle
        value={theme.showConditionBadge}
        onChange={(v) => setTheme((t) => ({ ...t, showConditionBadge: v }))}
        label={`Condition (${
          { new: "Brand New", recon: "Recon", used: "Used" }[
            listing?.condition || ""
          ] || "N/A"
        })`}
      />
      <Toggle
        value={theme.showHotDealBadge}
        onChange={(v) => setTheme((t) => ({ ...t, showHotDealBadge: v }))}
        label="🔥 Hot Deal badge"
      />
      <SectionHead label="Custom badge" />
      <PInput
        value={theme.customBadgeText}
        placeholder="Badge text (empty = hidden)"
        onChange={(e) =>
          setTheme((t) => ({ ...t, customBadgeText: e.target.value }))
        }
      />
      <ColorRow
        label="Badge color"
        value={theme.badgeColor || "#dc2626"}
        onChange={(v) => setTheme((t) => ({ ...t, badgeColor: v }))}
      />
    </div>
  );

  // ── AIPanel ──────────────────────────────────────────────────────────────
  const aiPct = Math.round((aiUsage.count / AI_LIMIT) * 100);
  const aiNear = aiUsage.count >= 90;

  const AIPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Usage meter */}
      <div
        style={{
          background: "rgba(220,38,38,0.05)",
          border: "1px solid rgba(220,38,38,0.15)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#60a5fa",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            ✦ AI Canvas Edit
          </span>
          <span
            style={{
              fontSize: 11,
              color: aiNear ? "#f97316" : "rgba(255,255,255,0.35)",
            }}
          >
            {aiUsage.loaded ? `${aiUsage.count}/${AI_LIMIT} today` : "…"}
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, aiPct)}%`,
              borderRadius: 2,
              background: aiAtLimit
                ? "#ef4444"
                : aiNear
                  ? "#f97316"
                  : "#dc2626",
              transition: "width 0.3s",
            }}
          />
        </div>
        {aiNear && !aiAtLimit && (
          <p style={{ fontSize: 10, color: "#f97316", marginTop: 5 }}>
            Almost at daily limit
          </p>
        )}
        {aiAtLimit && (
          <p style={{ fontSize: 10, color: "#ef4444", marginTop: 5 }}>
            Daily limit reached. Resets tomorrow.
          </p>
        )}
      </div>

      {/* Command input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={aiInputRef}
          value={aiCmd}
          onChange={(e) => setAiCmd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runAICommand()}
          disabled={aiAtLimit}
          placeholder="e.g. make price bigger, red accent…"
          style={{
            flex: 1,
            padding: "10px 13px",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(220,38,38,0.22)",
            borderRadius: 9,
            color: "#fff",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 12,
            outline: "none",
            opacity: aiAtLimit ? 0.4 : 1,
          }}
        />
        <button
          onClick={runAICommand}
          disabled={applyingCmd || !aiCmd.trim() || aiAtLimit}
          style={{
            padding: "10px 14px",
            borderRadius: 9,
            border: "none",
            background: applyingCmd ? "rgba(220,38,38,0.45)" : "#dc2626",
            color: "#fff",
            cursor: applyingCmd || aiAtLimit ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {applyingCmd ? (
            <div
              style={{
                width: 14,
                height: 14,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTop: "2px solid #fff",
                borderRadius: "50%",
                animation: "ttsv3-spin 0.8s linear infinite",
              }}
            />
          ) : (
            "⚡"
          )}
        </button>
      </div>
      {genError && <p style={{ fontSize: 11, color: "#f87171" }}>{genError}</p>}

      {/* Suggestion chips */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => {
              setAiCmd(s);
              setTimeout(() => aiInputRef.current?.focus(), 0);
            }}
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              border: "1px solid rgba(37,99,235,0.2)",
              background: "transparent",
              color: "rgba(220,38,38,0.65)",
              fontSize: 9,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Command history */}
      {cmdHistory.length > 0 && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: 8,
          }}
        >
          <p
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.2)",
              marginBottom: 5,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Recent
          </p>
          {cmdHistory.map((c, i) => (
            <button
              key={i}
              onClick={() => setAiCmd(c)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 0",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.32)",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                borderBottom:
                  i < cmdHistory.length - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : "none",
              }}
            >
              ↺ {c}
            </button>
          ))}
        </div>
      )}

      {/* Generate slide copy */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: 14,
        }}
      >
        <SectionHead label="Generate slide text" />
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["en", "bm"].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                border: `1px solid ${
                  language === l
                    ? "rgba(220,38,38,0.4)"
                    : "rgba(255,255,255,0.07)"
                }`,
                background:
                  language === l ? "rgba(37,99,235,0.1)" : "transparent",
                color: language === l ? "#dc2626" : "rgba(255,255,255,0.35)",
              }}
            >
              {l === "en" ? "English" : "Bahasa M"}
            </button>
          ))}
        </div>
        <PInput
          value={hookText}
          placeholder="Your hook idea (optional)"
          onChange={(e) => setHookText(e.target.value)}
        />
        <button
          onClick={async () => {
            setApplyingCmd(true);
            setGenError(null);
            try {
              const res = await generateSlidesCopy(
                listing,
                total,
                language,
                hookText,
              );
              if (Array.isArray(res)) {
                setSlides((ss) => {
                  const newSlides = ss.map((s, i) => {
                    const d = res[i];
                    if (!d) return s;
                    return {
                      ...s,
                      elements: s.elements.map((el) =>
                        el.id === "hook"
                          ? { ...el, content: d.hookText || el.content }
                          : el.id === "headline"
                            ? { ...el, content: d.headline || el.content }
                            : el,
                      ),
                    };
                  });
                  pushHistory(newSlides);
                  return newSlides;
                });
              }
            } catch {
              setGenError("Generation failed.");
              setTimeout(() => setGenError(null), 4000);
            }
            setApplyingCmd(false);
          }}
          style={{
            width: "100%",
            padding: "10px 0",
            marginTop: 8,
            borderRadius: 9,
            border: "none",
            background: "rgba(37,99,235,0.85)",
            color: "#fff",
            fontWeight: 700,
            cursor: applyingCmd ? "wait" : "pointer",
            fontSize: 12,
          }}
        >
          {applyingCmd ? "Generating…" : "Generate All Slides"}
        </button>
      </div>
    </div>
  );

  // ── Tab bar + routing ────────────────────────────────────────────────────
  const TABS = [
    { id: "slide", label: "Slides", icon: <LayoutTemplate size={16} /> },
    { id: "design", label: "Design", icon: <Palette size={16} /> },
    { id: "brand", label: "Brand", icon: <Brush size={16} /> },
    { id: "badges", label: "Badges", icon: <Tag size={16} /> },
    { id: "layers", label: "Layers", icon: <Layers size={16} /> },
    { id: "ai", label: "AI", icon: <Zap size={16} /> },
    { id: "library", label: "Library", icon: <Library size={16} /> },
  ];

  // ── Library Panel ────────────────────────────────────────────────────────
  const LibraryPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHead label="Save current design" />
      <input
        value={designName}
        onChange={(e) => setDesignName(e.target.value)}
        placeholder="Name this design (optional)"
        style={{
          width: "100%",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          color: "#fff",
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 12,
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(220,38,38,0.45)")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
      />
      <button
        onClick={saveDesign}
        style={{
          width: "100%",
          padding: "10px 0",
          borderRadius: 9,
          border: "none",
          background: "#2563eb",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        💾 Save theme + layout
      </button>

      {savedDesigns.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 0",
            color: "rgba(255,255,255,0.2)",
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗂</div>
          No saved designs yet
        </div>
      ) : (
        <>
          <SectionHead
            label={`${savedDesigns.length} saved design${savedDesigns.length !== 1 ? "s" : ""}`}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {savedDesigns.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
                onClick={() => loadDesign(d)}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 32,
                    height: 57,
                    borderRadius: 4,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: d.theme?.bgColor || "#060910",
                    position: "relative",
                  }}
                >
                  {d.thumb && (
                    <img
                      src={d.thumb}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                  {/* Accent color dot */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 2,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: d.theme?.accentColor || "#dc2626",
                    }}
                  />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.8)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: 2,
                    }}
                  >
                    {d.name}
                  </p>
                  <p
                    style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {new Date(d.savedAt).toLocaleDateString()} ·{" "}
                    {d.elements?.length || 0} elements ·{" "}
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: d.theme?.accentColor || "#dc2626",
                        verticalAlign: "middle",
                      }}
                    />
                  </p>
                </div>

                {/* Apply + delete */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadDesign(d);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid rgba(37,99,235,0.3)",
                      background: "rgba(37,99,235,0.1)",
                      color: "#60a5fa",
                      cursor: "pointer",
                      fontSize: 9,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDesign(d.id);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "transparent",
                      color: "rgba(255,255,255,0.25)",
                      cursor: "pointer",
                      fontSize: 9,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const LayersPanel = () => (
    <LayerPropertiesPanel
      layer={layers.find((l) => layerSelectedIds.includes(l.id)) || null}
      onUpdate={(id, patch) => updateLayer(id, patch)}
      onCommit={commitLayerHistory}
      onDelete={deleteLayer}
      onDuplicate={duplicateLayer}
    />
  );

  const renderTab = () => {
    if (activeTab === "slide") return SlidePanel();
    if (activeTab === "design") return DesignPanel();
    if (activeTab === "brand") return BrandPanel();
    if (activeTab === "badges") return BadgesPanel();
    if (activeTab === "layers") return LayersPanel();
    if (activeTab === "ai") return AIPanel();
    if (activeTab === "library") return LibraryPanel();
  };

  // tabBar used only in mobile sidebar
  const tabBar = (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
        background: "#1e2130",
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          style={{
            flex: 1,
            padding: "8px 2px",
            border: "none",
            fontFamily: "'DM Sans',sans-serif",
            borderBottom: `2px solid ${activeTab === t.id ? "#2563eb" : "transparent"}`,
            background: "transparent",
            color: activeTab === t.id ? "#60a5fa" : "rgba(255,255,255,0.35)",
            cursor: "pointer",
            fontSize: 9,
            fontWeight: 600,
            transition: "all 0.15s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );

  // ── Shared CanvasPreview props ───────────────────────────────────────────
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
    onSelectElement: (id) => {
      setSelectedId(id);
      setEditingId(null);
    },
    onDeselectAll: () => {
      setSelectedId(null);
      setEditingId(null);
      clearLayerSelection();
    },
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
    innerRef: canvasInnerRef,
  };

  // ── Mobile layout ────────────────────────────────────────────────────────
  if (isMobile) {
    const mobScale = Math.min(
      ((window.innerWidth - 20) * 0.9) / CW,
      (window.innerHeight - 100 - 150) / CH, // extra 40px for shape toolbar
    );
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#131620",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 46,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
            background: "#1e2130",
          }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue',sans-serif",
              fontSize: 18,
              letterSpacing: "0.05em",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            TT STUDIO V3
          </span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {[
              {
                fn: undo,
                dis: historyIdx.current <= 0,
                icon: <Undo2 size={12} />,
              },
              {
                fn: redo,
                dis: historyIdx.current >= history.current.length - 1,
                icon: <Redo2 size={12} />,
              },
            ].map(({ fn, dis, icon }, i) => (
              <button
                key={i}
                onClick={fn}
                disabled={dis}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: dis
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.6)",
                  cursor: dis ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {icon}
              </button>
            ))}
            <button
              onClick={() => saveSingle(active)}
              style={{
                padding: "5px 10px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Download size={11} /> Save
            </button>
            <button
              onClick={saveAll}
              disabled={downloading}
              style={{
                padding: "5px 12px",
                borderRadius: 7,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {downloading ? "…" : "Export"}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Film strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            overflowX: "auto",
            flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#141a28",
          }}
        >
          {slides.map((s, i) => (
            <FilmThumb
              key={s.id}
              slide={s}
              idx={i}
              active={i === active}
              onSelect={(i) => {
                setActive(i);
                setSelectedId(null);
              }}
              onDelete={removeSlide}
            />
          ))}
          <button
            onClick={addSlide}
            style={{
              width: 36,
              height: 64,
              flexShrink: 0,
              borderRadius: 6,
              border: "1px dashed rgba(37,99,235,0.4)",
              background: "transparent",
              color: "#3b82f6",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Mobile shape toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "#1a2035",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          <span
            style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              flexShrink: 0,
            }}
          >
            Add:
          </span>
          {[
            [
              "▭",
              "Rect",
              () => {
                addLayer("rect");
                setActiveTab("layers");
              },
            ],
            [
              "◯",
              "Circle",
              () => {
                addLayer("circle");
                setActiveTab("layers");
              },
            ],
            [
              "△",
              "Triangle",
              () => {
                addLayer("triangle");
                setActiveTab("layers");
              },
            ],
            [
              "T",
              "Text",
              () => {
                addLayer("text");
                setActiveTab("layers");
              },
            ],
          ].map(([icon, lbl, fn]) => (
            <button
              key={lbl}
              onClick={fn}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "4px 9px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "rgba(255,255,255,0.65)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {icon} {lbl}
            </button>
          ))}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "4px 9px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "rgba(255,255,255,0.65)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            🖼 Image
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  addLayer("image", { src: URL.createObjectURL(f) });
                  setActiveTab("layers");
                }
                e.target.value = "";
              }}
            />
          </label>
          <div style={{ flex: 1 }} />
          {layers.length > 0 && (
            <button
              onClick={() => {
                setSidebarOpen(true);
                setActiveTab("layers");
              }}
              style={{
                padding: "4px 9px",
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 6,
                color: "#60a5fa",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {layers.length} layer{layers.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Canvas preview area — full width, dominant */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {showImagePicker ? (
            <div
              style={{
                position: "relative",
                width: CW * mobScale,
                height: CH * mobScale,
              }}
            >
              <ImagePicker
                images={rawImages}
                current={slide.imageUrl}
                onSelect={(url) => patchSlide({ imageUrl: url })}
                onClose={() => setShowImagePicker(false)}
              />
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                width: CW * mobScale,
                height: CH * mobScale,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: 4,
                boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                isolation: "isolate",
              }}
            >
              <CanvasPreview
                {...previewProps}
                scale={mobScale}
                canvasW={CW}
                canvasH={CH}
              />
              <LayerCanvas
                layers={layers}
                selectedIds={layerSelectedIds}
                scale={mobScale}
                canvasW={CW}
                canvasH={CH}
                onSelectLayer={(id) => {
                  selectLayer(id);
                  setSidebarOpen(true);
                  setActiveTab("layers");
                }}
                onClearSelection={clearLayerSelection}
                onUpdateLayer={updateLayer}
                onCommitHistory={commitLayerHistory}
                onDeleteLayer={deleteLayer}
              />
            </div>
          )}

          {/* Sidebar toggle button — floats over canvas */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 30,
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(13,17,23,0.9)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>

          {/* Prev/Next slide */}
          {active > 0 && (
            <button
              onClick={() => setActive((i) => i - 1)}
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.6)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                zIndex: 20,
              }}
            >
              ‹
            </button>
          )}
          {active < total - 1 && (
            <button
              onClick={() => setActive((i) => i + 1)}
              style={{
                position: "absolute",
                right: sidebarOpen ? 280 : 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.6)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                zIndex: 20,
              }}
            >
              ›
            </button>
          )}

          {/* SIDEBAR */}
          {sidebarOpen && (
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: 270,
                background: "#1e2130",
                borderLeft: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                flexDirection: "column",
                zIndex: 25,
                overflowY: "hidden",
                transition: "transform 0.2s ease",
              }}
            >
              {tabBar}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                {renderTab()}
              </div>
            </div>
          )}
        </div>

        {/* AI bar — always at bottom */}
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "#1e2130",
            display: "flex",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <input
            value={aiCmd}
            onChange={(e) => setAiCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAICommand()}
            disabled={aiAtLimit}
            placeholder="AI: make price bigger, red accent…"
            style={{
              flex: 1,
              padding: "9px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12,
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#2563eb";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          />
          <button
            onClick={runAICommand}
            disabled={applyingCmd || !aiCmd.trim() || aiAtLimit}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {applyingCmd ? "…" : "⚡"}
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop layout — Canva-style ─────────────────────────────────────────
  return (
    <>
      {/* Backdrop dimmer */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.65)",
        }}
      />

      {/* Main popup — almost full page, Canva-style */}
      <div
        style={{
          position: "fixed",
          inset: 14,
          zIndex: 9999,
          borderRadius: 16,
          overflow: "hidden",
          background: "#131620",
          boxShadow:
            "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {/* ── TOP HEADER ─────────────────────────────────────────── */}
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
            background: "#1e2130",
          }}
        >
          {/* Left: logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 19,
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              TIKTOK STUDIO
            </span>
            <span
              style={{
                fontSize: 8,
                background: "#2563eb",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              V3
            </span>
            <span
              style={{
                fontSize: 9,
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.4)",
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {currentFormat.icon} {canvasFormat} · {total} slide
              {total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Center: undo/redo */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[
              {
                fn: undo,
                dis: historyIdx.current <= 0,
                icon: <Undo2 size={14} />,
                title: "Undo (Ctrl+Z)",
              },
              {
                fn: redo,
                dis: historyIdx.current >= history.current.length - 1,
                icon: <Redo2 size={14} />,
                title: "Redo (Ctrl+Y)",
              },
            ].map(({ fn, dis, icon, title }) => (
              <button
                key={title}
                onClick={fn}
                disabled={dis}
                title={title}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: dis
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.65)",
                  cursor: dis ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!dis)
                    e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Right: actions */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => saveSingle(active)}
              disabled={dlIdx === active}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
            >
              <Download size={13} /> Save slide
            </button>
            <button
              onClick={saveAll}
              disabled={downloading}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                cursor: downloading ? "wait" : "pointer",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Download size={13} /> {downloading ? "Exporting…" : "Export all"}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────── */}
        <div
          style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
        >
          {/* ── LEFT ICON STRIP (54px) ───────────────────────────── */}
          <div
            style={{
              width: 54,
              background: "#1e2130",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 8,
              gap: 2,
              flexShrink: 0,
              zIndex: 2,
            }}
          >
            {TABS.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  title={t.label}
                  style={{
                    width: 46,
                    height: 52,
                    borderRadius: 10,
                    border: "none",
                    background: isActive ? "#1a2a4a" : "transparent",
                    color: isActive ? "#60a5fa" : "rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    position: "relative",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        left: -4,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: 24,
                        borderRadius: "0 3px 3px 0",
                        background: "#2563eb",
                      }}
                    />
                  )}
                  <span style={{ lineHeight: 1 }}>{t.icon}</span>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── LEFT PANEL (280px) ───────────────────────────────── */}
          <div
            style={{
              width: 280,
              background: "#1e2130",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* Panel header */}
            <div
              style={{
                height: 40,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.25)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {TABS.find((t) => t.id === activeTab)?.label}
              </span>
            </div>
            {/* Panel content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {renderTab()}
            </div>
          </div>

          {/* ── LAYER TOOLBAR (44px vertical strip) ─────────────── */}
          <LayerToolbar
            canUndo={canUndoLayer}
            canRedo={canRedoLayer}
            onUndo={undoLayer}
            onRedo={redoLayer}
            onAddShape={(type) => {
              addLayer(type);
              setActiveTab("layers");
            }}
            onAddImage={(src) => {
              addLayer("image", { src });
              setActiveTab("layers");
            }}
          />

          {/* ── CANVAS CENTER AREA ───────────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#1a1d27",
              minWidth: 0,
            }}
          >
            {/* Canvas workspace */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                padding: "24px",
              }}
            >
              {showImagePicker ? (
                <div
                  style={{
                    position: "relative",
                    width: CW * scale,
                    height: CH * scale,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <ImagePicker
                    images={rawImages}
                    current={slide.imageUrl}
                    onSelect={(url) => patchSlide({ imageUrl: url })}
                    onClose={() => setShowImagePicker(false)}
                  />
                </div>
              ) : (
                <div
                  style={{
                    boxShadow:
                      "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
                    borderRadius: 4,
                    flexShrink: 0,
                    lineHeight: 0,
                    position: "relative",
                    overflow: "hidden",
                    isolation: "isolate",   // Issue 3: stacking context for z-order
                    width: CW * scale,
                    height: CH * scale,
                  }}
                >
                  <CanvasPreview
                    {...previewProps}
                    scale={scale}
                    canvasW={CW}
                    canvasH={CH}
                  />
                  <LayerCanvas
                    layers={layers}
                    selectedIds={layerSelectedIds}
                    scale={scale}
                    canvasW={CW}
                    canvasH={CH}
                    onSelectLayer={(id, multi) => {
                      selectLayer(id, multi);
                      setActiveTab("layers");
                    }}
                    onClearSelection={clearLayerSelection}
                    onUpdateLayer={updateLayer}
                    onCommitHistory={commitLayerHistory}
                    onDeleteLayer={deleteLayer}
                  />
                </div>
              )}

              {/* Slide nav arrows */}
              {active > 0 && (
                <button
                  onClick={() => setActive((i) => i - 1)}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(13,17,23,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 5,
                  }}
                >
                  ‹
                </button>
              )}
              {active < total - 1 && (
                <button
                  onClick={() => setActive((i) => i + 1)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(13,17,23,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 5,
                  }}
                >
                  ›
                </button>
              )}

              {/* Slide counter */}
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.25)",
                  background: "rgba(0,0,0,0.4)",
                  padding: "3px 10px",
                  borderRadius: 999,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                {active + 1} / {total}
              </div>
            </div>

            {/* ── LAYER STACK (above film strip) ───────────────── */}
            <LayerStack
              layers={layers}
              selectedIds={layerSelectedIds}
              onSelectLayer={selectLayer}
              onUpdateLayer={updateLayer}
              onDeleteLayer={deleteLayer}
              onDuplicateLayer={duplicateLayer}
              onShiftZ={shiftZ}
            />

            {/* ── FILM STRIP (bottom) ──────────────────────────── */}
            <div
              style={{
                height: 102,
                background: "#141a28",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 16px",
                overflowX: "auto",
                flexShrink: 0,
              }}
            >
              {slides.map((s, i) => (
                <FilmThumb
                  key={s.id}
                  slide={s}
                  idx={i}
                  active={i === active}
                  onSelect={(i) => {
                    setActive(i);
                    setSelectedId(null);
                  }}
                  onDelete={removeSlide}
                />
              ))}
              {/* Duplicate current */}
              <button
                onClick={duplicateSlide}
                title="Duplicate slide"
                style={{
                  width: 44,
                  height: 78,
                  flexShrink: 0,
                  borderRadius: 5,
                  border: "1px dashed rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <Copy size={14} />
                <span style={{ fontSize: 7 }}>DUP</span>
              </button>
              {/* Add new slide */}
              <button
                onClick={addSlide}
                title="Add slide"
                style={{
                  width: 44,
                  height: 78,
                  flexShrink: 0,
                  borderRadius: 5,
                  border: "1px dashed rgba(37,99,235,0.4)",
                  background: "transparent",
                  color: "#3b82f6",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
