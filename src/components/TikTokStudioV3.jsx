import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  X,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  Plus,
  Palette,
  Tag,
  Shield,
  Layers,
  RefreshCw,
  Wand2,
  Save,
  Check,
  Move,
  RotateCcw,
  ZoomIn,
  AlignLeft,
  AlignCenter,
  Type,
  Eye,
  EyeOff,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { supabase } from "../supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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

// ─── JSZip loader ────────────────────────────────────────────────────────────
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
    const p = new Promise((res) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });
    IMG_CACHE.set(url, p);
  }
  return IMG_CACHE.get(url);
}

// ─── Fonts ────────────────────────────────────────────────────────────────────
export const FONTS = [
  {
    id: "dm",
    label: "DM Sans",
    stack: "'DM Sans',sans-serif",
    weights: ["400", "700", "800"],
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    stack: "'Bebas Neue',sans-serif",
    weights: ["400", "400", "400"],
  },
  {
    id: "oswald",
    label: "Oswald",
    stack: "'Oswald',sans-serif",
    weights: ["400", "600", "700"],
  },
  {
    id: "montserrat",
    label: "Montserrat",
    stack: "'Montserrat',sans-serif",
    weights: ["400", "700", "800"],
  },
  {
    id: "anton",
    label: "Anton",
    stack: "'Anton',sans-serif",
    weights: ["400", "400", "400"],
  },
  {
    id: "barlow",
    label: "Barlow Condensed",
    stack: "'Barlow Condensed',sans-serif",
    weights: ["400", "600", "700"],
  },
  {
    id: "russo",
    label: "Russo One",
    stack: "'Russo One',sans-serif",
    weights: ["400", "400", "400"],
  },
  {
    id: "raleway",
    label: "Raleway",
    stack: "'Raleway',sans-serif",
    weights: ["400", "700", "800"],
  },
];
const GFONTS_LOADED = new Set();
function ensureFont(fontId) {
  if (GFONTS_LOADED.has(fontId)) return;
  GFONTS_LOADED.add(fontId);
  const urls = {
    dm: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&display=swap",
    bebas: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
    oswald:
      "https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap",
    montserrat:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap",
    anton: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
    barlow:
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap",
    russo: "https://fonts.googleapis.com/css2?family=Russo+One&display=swap",
    raleway:
      "https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap",
  };
  if (!urls[fontId]) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = urls[fontId];
  document.head.appendChild(l);
}

// ─── Style Presets ────────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  {
    id: "dark-luxury",
    label: "Dark Luxury",
    preview: ["#0d0d0d", "#c9a84c"],
    theme: {
      accentColor: "#c9a84c",
      bgColor: "#0d0d0d",
      overlayOpacity: 0.55,
      textColor: "#ffffff",
      overlayStyle: "dark",
    },
  },
  {
    id: "street-red",
    label: "Street Bold",
    preview: ["#0a0a0a", "#e53935"],
    theme: {
      accentColor: "#e53935",
      bgColor: "#0a0a0a",
      overlayOpacity: 0.45,
      textColor: "#ffffff",
      overlayStyle: "dark",
    },
  },
  {
    id: "neon-blue",
    label: "Neon Blue",
    preview: ["#020918", "#00d4ff"],
    theme: {
      accentColor: "#00d4ff",
      bgColor: "#020918",
      overlayOpacity: 0.5,
      textColor: "#ffffff",
      overlayStyle: "dark",
    },
  },
  {
    id: "clean-white",
    label: "Clean White",
    preview: ["#f5f5f5", "#1a1a1a"],
    theme: {
      accentColor: "#1a1a1a",
      bgColor: "#f0f0f0",
      overlayOpacity: 0.3,
      textColor: "#ffffff",
      overlayStyle: "light",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    preview: ["#021a0d", "#00c853"],
    theme: {
      accentColor: "#00c853",
      bgColor: "#021a0d",
      overlayOpacity: 0.5,
      textColor: "#ffffff",
      overlayStyle: "dark",
    },
  },
  {
    id: "purple-haze",
    label: "Purple Haze",
    preview: ["#0d0520", "#8b5cf6"],
    theme: {
      accentColor: "#8b5cf6",
      bgColor: "#0d0520",
      overlayOpacity: 0.52,
      textColor: "#ffffff",
      overlayStyle: "dark",
    },
  },
];

// ─── Templates ────────────────────────────────────────────────────────────────
export const SLIDE_TEMPLATES = [
  { id: "hype", label: "Hype", desc: "Bold price, full impact", icon: "🔥" },
  {
    id: "hero-hook",
    label: "Hero Hook",
    desc: "Impact opener with hook",
    icon: "⚡",
  },
  {
    id: "specs-breakdown",
    label: "Specs",
    desc: "Features checklist",
    icon: "📋",
  },
  { id: "pricing", label: "Pricing", desc: "Monthly installment", icon: "💰" },
  { id: "cta", label: "CTA", desc: "WhatsApp call-to-action", icon: "📲" },
  { id: "story", label: "Story", desc: "Lifestyle, soft vibe", icon: "✨" },
  { id: "minimal", label: "Minimal", desc: "Clean, just the car", icon: "🖤" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  try {
    const p = JSON.parse(val);
    if (Array.isArray(p)) return p.filter(Boolean);
  } catch (e) {}
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function calcMonthly(price) {
  if (!price) return null;
  const loan = price * 0.9;
  const interest = (3.5 / 100) * loan * 9;
  return Math.round((loan + interest) / (9 * 12));
}

// ─── Default Theme ────────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  accentColor: "#e53935",
  bgColor: "#060910",
  overlayOpacity: 0.45,
  overlayStyle: "dark",
  textColor: "#ffffff",
  headlineSize: 72,
  priceSize: 52,
  statsSize: 32,
  hookSize: 38,
  textAlign: "left",
  textPosition: "bottom",
  watermarkText: "",
  watermarkOpacity: 0.14,
  watermarkPos: "top-right",
  logoUrl: null,
  logoSize: 80,
  showAccentBar: true,
  priceTagStyle: "plain",
  showConditionBadge: false,
  showHotDealBadge: false,
  customBadgeText: "",
  badgeColor: "#e53935",
};

// ─── Build default slides ─────────────────────────────────────────────────────
function buildDefaultSlides(
  listing,
  images,
  features,
  specs,
  dealerName,
  whatsapp,
) {
  const brand = listing?.brand || "",
    model = listing?.model || "",
    variant = listing?.variant || "";
  const year = String(listing?.year || "");
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
  const mileage = listing?.mileage
    ? Number(listing.mileage).toLocaleString() + " km"
    : "";
  const cond = listing?.condition || "";
  const condLabel =
    { new: "Brand New", recon: "Recon", used: "Used" }[cond] || cond;
  const trans = listing?.transmission || "",
    fuel = listing?.fuel_type || listing?.fuel || "";
  const engine = listing?.engine_cc ? listing.engine_cc + "cc" : "";
  const carName =
    `${brand} ${model}${variant ? " " + variant : ""} ${year}`.trim();
  const statsLine = [year, condLabel, mileage].filter(Boolean).join(" · ");
  const monthly = calcMonthly(price);
  const img0 = images[0] || null;
  const fallbackFeatures =
    features.length > 0
      ? features
      : [engine, trans, fuel, mileage, condLabel].filter(Boolean);

  const tplCycle = [
    "hype",
    "story",
    "specs-breakdown",
    "hype",
    "minimal",
    "pricing",
    "hype",
    "story",
    "specs-breakdown",
    "hype",
    "minimal",
  ];
  const base = {
    condition: cond,
    fitMode: "auto",
    enabled: true,
    carName,
    priceStr,
    priceNum: price || 0,
    statsLine,
    monthly,
    features: fallbackFeatures,
    dealerName,
    whatsapp,
  };

  const structured = [
    {
      id: 0,
      index: 0,
      imageUrl: img0,
      template: "hero-hook",
      hookText: `${brand} ${model} — Best Deal In Malaysia 🔥`.trim(),
      ...base,
    },
    {
      id: 1,
      index: 1,
      imageUrl: images[1] || img0,
      template: "specs-breakdown",
      hookText: `Why Choose The ${model}?`,
      ...base,
    },
    {
      id: 2,
      index: 2,
      imageUrl: images[2] || img0,
      template: "pricing",
      hookText: "Monthly Installment",
      ...base,
    },
    {
      id: 3,
      index: 3,
      imageUrl: images[3] || img0,
      template: "cta",
      hookText: "Contact Us Today",
      ...base,
    },
  ];

  const imageSlides = images.slice(0, 11).map((img, i) => ({
    id: i + 4,
    index: i + 4,
    imageUrl: img,
    template: tplCycle[i % tplCycle.length],
    hookText: "",
    ...base,
  }));

  return [...structured, ...imageSlides];
}

// ─── AI Text Generation ───────────────────────────────────────────────────────
async function generateSlideText(listing, language, hookText, slideCount) {
  const price = listing?.selling_price || listing?.price;
  const priceStr = price
    ? "RM " + Number(price).toLocaleString()
    : "Ask for Price";
  const lang =
    language === "bm"
      ? "Bahasa Malaysia (casual dealer tone)"
      : "English (punchy Malaysian car market)";
  const prompt = `Malaysian car dealer TikTok slide copywriter. Write ${slideCount} slides.
CAR: ${listing?.year || ""} ${listing?.brand || ""} ${listing?.model || ""} ${listing?.variant || ""}
Price: ${priceStr} | Mileage: ${listing?.mileage ? Number(listing.mileage).toLocaleString() + " km" : "N/A"}
Condition: ${listing?.condition || ""} | Trans: ${listing?.transmission || ""} | Fuel: ${listing?.fuel_type || listing?.fuel || ""}
Engine: ${listing?.engine_cc ? listing.engine_cc + "cc" : ""} | Location: ${listing?.state || "Malaysia"}
${hookText ? 'Seller hook: "' + hookText + '"' : ""}
Language: ${lang}
Each slide: hookText (punchy, max 6 words, ALL CAPS), carName (full car name), priceStr (price string), statsLine (year · condition · mileage).
Return ONLY valid JSON array: [{"hookText":"...","carName":"...","priceStr":"...","statsLine":"..."},...]`;

  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  let text = Array.isArray(data?.content)
    ? data.content.map((b) => b.text || "").join("")
    : data?.completion || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── AI Canvas Command ────────────────────────────────────────────────────────
async function applyAICommand(command, currentSlide, currentTheme) {
  const prompt = `You are a design AI for a TikTok car listing slide editor. Apply the user's command to the slide JSON.

CURRENT SLIDE STATE:
${JSON.stringify({ slide: currentSlide, theme: currentTheme }, null, 2)}

USER COMMAND: "${command}"

Apply the command and return ONLY a valid JSON object with two keys:
- "slide": updated slide fields (only fields that changed)
- "theme": updated theme fields (only fields that changed)

Examples of commands and what to change:
- "make price bigger" → theme.priceSize increases by 10-16
- "move hook to bottom" → slide.hookPosition = "bottom"
- "change accent to blue" → theme.accentColor = "#2196f3"
- "make it minimal" → apply minimal template changes
- "price red" → theme.priceColor = "#e53935"
- "bigger headline" → theme.headlineSize increases
- "center text" → theme.textAlign = "center"
- "make hook smaller" → theme.hookSize decreases
- "remove hook" → slide.hookText = ""
- "add hot deal badge" → theme.showHotDealBadge = true

Return ONLY the JSON, no explanation.`;

  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  let text = Array.isArray(data?.content)
    ? data.content.map((b) => b.text || "").join("")
    : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── Canvas Export Renderer ───────────────────────────────────────────────────
async function renderToCanvas(canvas, slide, theme, fontId = "dm") {
  const ctx = canvas.getContext("2d");
  const W = canvas.width,
    H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const fontDef = FONTS.find((f) => f.id === fontId) || FONTS[0];
  const stack = fontDef.stack;
  const img = await loadImage(slide.imageUrl);
  const logoImg = theme.logoUrl ? await loadImage(theme.logoUrl) : null;
  const acc = theme.accentColor || "#e53935";
  const pad = Math.round((64 * W) / 1080);

  // Background
  ctx.fillStyle = theme.bgColor || "#060910";
  ctx.fillRect(0, 0, W, H);

  if (img) {
    // Blurred BG
    ctx.save();
    try {
      ctx.filter = "blur(18px) brightness(0.4)";
    } catch (e) {}
    const sc = Math.max(W / img.width, H / img.height);
    ctx.drawImage(
      img,
      (W - img.width * sc) / 2,
      (H - img.height * sc) / 2,
      img.width * sc,
      img.height * sc,
    );
    ctx.restore();
    // Car image fitted to full width
    const fitH = img.height * (W / img.width);
    ctx.globalAlpha = 0.92;
    ctx.drawImage(img, 0, (H - fitH) / 2, W, fitH);
    ctx.globalAlpha = 1;
  }

  // Overlay gradient
  const ov = ctx.createLinearGradient(0, 0, 0, H);
  ov.addColorStop(0, "rgba(6,9,16,0.95)");
  ov.addColorStop(0.28, "rgba(6,9,16,0.08)");
  ov.addColorStop(0.52, "rgba(6,9,16,0.05)");
  ov.addColorStop(0.66, "rgba(6,9,16,0.82)");
  ov.addColorStop(1, "rgba(6,9,16,1)");
  ctx.fillStyle = ov;
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  if (theme.showAccentBar !== false) {
    ctx.fillStyle = acc;
    ctx.fillRect(0, 0, W, Math.round((6 * H) / 1920));
  }

  function draw(text, x, y, weight, size, colour, maxW, align = "left") {
    if (!text) return;
    ctx.save();
    ctx.font = `${weight} ${size}px ${stack}`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    while (ctx.measureText(text).width > maxW && size > 14) {
      size -= 2;
      ctx.font = `${weight} ${size}px ${stack}`;
    }
    ctx.lineWidth = Math.max(size * 0.07, 2.5);
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  const tpl = slide.template || "hype";
  const isCenter = theme.textAlign === "center";
  const xBase = isCenter ? W / 2 : pad;
  const align = isCenter ? "center" : "left";
  const maxW = isCenter ? W * 0.9 : W - pad * 2;

  // Hook text
  if (slide.hookText) {
    const hSz = Math.round(((theme.hookSize || 38) * W) / 1080);
    const hookY = Math.round(H * 0.07);
    draw(
      slide.hookText.toUpperCase(),
      W / 2,
      hookY,
      "800",
      hSz,
      "#fff",
      W * 0.85,
      "center",
    );
    ctx.save();
    ctx.font = `800 ${hSz}px ${stack}`;
    const hw = Math.min(
      ctx.measureText(slide.hookText.toUpperCase()).width,
      W * 0.85,
    );
    ctx.fillStyle = acc;
    ctx.fillRect((W - hw) / 2, hookY + hSz + 6, hw, 4);
    ctx.restore();
  }

  // Watermark
  if (theme.watermarkText) {
    ctx.save();
    ctx.font = `600 ${Math.round((26 * W) / 1080)}px ${stack}`;
    ctx.fillStyle = `rgba(255,255,255,${theme.watermarkOpacity || 0.14})`;
    const iR = (theme.watermarkPos || "top-right").includes("right");
    const iB = (theme.watermarkPos || "top-right").includes("bottom");
    ctx.textAlign = iR ? "right" : "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      theme.watermarkText.toUpperCase(),
      iR ? W - Math.round((52 * W) / 1080) : Math.round((52 * W) / 1080),
      iB ? H - Math.round((80 * H) / 1920) : Math.round((52 * H) / 1920),
    );
    ctx.restore();
  }

  // Logo
  if (logoImg) {
    const maxLH = Math.round(((theme.logoSize || 80) * H) / 1920);
    const lScale = maxLH / logoImg.height,
      lw = logoImg.width * lScale,
      lh = logoImg.height * lScale;
    const iR = (theme.watermarkPos || "top-right").includes("right");
    const iB = (theme.watermarkPos || "top-right").includes("bottom");
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      logoImg,
      iR ? W - Math.round((48 * W) / 1080) - lw : Math.round((48 * W) / 1080),
      iB ? H - Math.round((60 * H) / 1920) - lh : Math.round((40 * H) / 1920),
      lw,
      lh,
    );
    ctx.restore();
  }

  // Badges
  if (theme.showConditionBadge && slide.condition) {
    const badgeTxt =
      { new: "BRAND NEW", recon: "RECON", used: "USED" }[slide.condition] ||
      slide.condition.toUpperCase();
    const bSz = Math.round((24 * W) / 1080),
      bPad = Math.round((20 * W) / 1080);
    ctx.save();
    ctx.font = `800 ${bSz}px ${stack}`;
    const bw = ctx.measureText(badgeTxt).width + bPad * 2;
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.roundRect(pad, Math.round(H * 0.55), bw, bSz + bPad, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(badgeTxt, pad + bPad, Math.round(H * 0.55) + bPad / 2);
    ctx.restore();
  }
  if (theme.showHotDealBadge) {
    const bSz = Math.round((24 * W) / 1080),
      bPad = Math.round((20 * W) / 1080);
    ctx.save();
    ctx.font = `800 ${bSz}px ${stack}`;
    const bTxt = "🔥 HOT DEAL";
    const bw = ctx.measureText(bTxt).width + bPad * 2;
    ctx.fillStyle = "#ff6b00";
    ctx.beginPath();
    ctx.roundRect(
      pad + (theme.showConditionBadge ? 200 : 0),
      Math.round(H * 0.55),
      bw,
      bSz + bPad,
      6,
    );
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      bTxt,
      pad + (theme.showConditionBadge ? 200 : 0) + bPad,
      Math.round(H * 0.55) + bPad / 2,
    );
    ctx.restore();
  }
  if (theme.customBadgeText) {
    const bSz = Math.round((24 * W) / 1080),
      bPad = Math.round((20 * W) / 1080);
    ctx.save();
    ctx.font = `800 ${bSz}px ${stack}`;
    const bw =
      ctx.measureText(theme.customBadgeText.toUpperCase()).width + bPad * 2;
    ctx.fillStyle = theme.badgeColor || acc;
    ctx.beginPath();
    ctx.roundRect(W - pad - bw, Math.round(H * 0.55), bw, bSz + bPad, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      theme.customBadgeText.toUpperCase(),
      W - pad - bw + bPad,
      Math.round(H * 0.55) + bPad / 2,
    );
    ctx.restore();
  }

  const hSz = Math.round(((theme.headlineSize || 72) * W) / 1080);
  const pSz = Math.round(((theme.priceSize || 52) * W) / 1080);
  const sSz = Math.round(((theme.statsSize || 32) * W) / 1080);

  if (tpl === "specs-breakdown") {
    const feats = Array.isArray(slide.features)
      ? slide.features.slice(0, 6)
      : [];
    draw(
      slide.carName || "",
      xBase,
      H * 0.62,
      "800",
      Math.round((52 * W) / 1080),
      "#fff",
      maxW,
      align,
    );
    ctx.save();
    ctx.fillStyle = acc;
    ctx.fillRect(
      isCenter ? (W - 100) / 2 : pad,
      H * 0.62 + Math.round((52 * W) / 1080) + 10,
      100,
      3,
    );
    ctx.restore();
    const fSz = Math.round((34 * W) / 1080),
      fGap = Math.round(fSz * 1.65);
    let fy = H * 0.62 + Math.round((52 * W) / 1080) + 32;
    for (let i = 0; i < feats.length && fy < H * 0.93; i++) {
      ctx.save();
      ctx.fillStyle = acc + "33";
      ctx.beginPath();
      ctx.arc(pad + fSz * 0.5, fy + fSz * 0.5, fSz * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acc;
      ctx.font = `700 ${Math.round(fSz * 0.55)}px ${stack}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", pad + fSz * 0.5, fy + fSz * 0.5);
      ctx.restore();
      draw(
        feats[i],
        pad + fSz * 1.3,
        fy,
        "600",
        fSz,
        "rgba(255,255,255,0.88)",
        W - pad * 2 - fSz * 1.4,
      );
      fy += fGap;
    }
  } else if (tpl === "pricing") {
    const monthly = slide.monthly || calcMonthly(slide.priceNum);
    const mStr = monthly
      ? `RM ${Number(monthly).toLocaleString()}`
      : slide.priceStr || "";
    draw(
      "MONTHLY PAYMENT",
      W / 2,
      H * 0.4,
      "700",
      Math.round((28 * W) / 1080),
      acc,
      W * 0.9,
      "center",
    );
    draw(
      mStr,
      W / 2,
      H * 0.48,
      "800",
      Math.round((100 * W) / 1080),
      "#fff",
      W * 0.9,
      "center",
    );
    draw(
      "/month",
      W / 2,
      H * 0.48 + Math.round((100 * W) / 1080) + 10,
      "400",
      Math.round((28 * W) / 1080),
      "rgba(255,255,255,0.4)",
      W * 0.5,
      "center",
    );
    const bxY = H * 0.72,
      bxH = H * 0.18;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(pad, bxY, W - pad * 2, bxH, 14);
    ctx.fill();
    ctx.restore();
    const downStr = slide.priceNum
      ? "RM " + Number(slide.priceNum * 0.1).toLocaleString()
      : "";
    [
      { l: "Full Price", v: slide.priceStr || "" },
      { l: "Down Payment (10%)", v: downStr },
      { l: "Rate / Tenure", v: "3.5% / 9 Years" },
    ].forEach(({ l, v }, i) => {
      const ly = bxY + 40 + i * (Math.round((28 * W) / 1080) + 18);
      draw(
        l,
        pad + 40,
        ly,
        "600",
        Math.round((28 * W) / 1080),
        "rgba(255,255,255,0.38)",
        W / 2 - pad,
      );
      draw(
        v,
        W - pad - 40,
        ly,
        "700",
        Math.round((28 * W) / 1080),
        "rgba(255,255,255,0.78)",
        W / 2 - pad,
        "right",
      );
    });
  } else if (tpl === "cta") {
    const dnSz = Math.round((52 * W) / 1080);
    draw(
      slide.dealerName || theme.watermarkText || "",
      W / 2,
      H * 0.66,
      "800",
      dnSz,
      "#fff",
      W - pad * 2,
      "center",
    );
    draw(
      slide.carName || "",
      W / 2,
      H * 0.66 + dnSz + 16,
      "600",
      Math.round((36 * W) / 1080),
      "rgba(255,255,255,0.5)",
      W - pad * 2,
      "center",
    );
    const waY = H * 0.79,
      waH = Math.round((80 * H) / 1920);
    ctx.save();
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.roundRect(pad, waY, W - pad * 2, waH, waH / 2);
    ctx.fill();
    ctx.restore();
    const waStr = slide.whatsapp
      ? `📲 WhatsApp: ${slide.whatsapp}`
      : "📲 WhatsApp Us";
    draw(
      waStr,
      W / 2,
      waY + waH / 2 - Math.round((36 * W) / 1080) / 2,
      "800",
      Math.round((36 * W) / 1080),
      "#fff",
      W - pad * 2 - 60,
      "center",
    );
    draw(
      "DM for Test Drive · Best Price Guaranteed",
      W / 2,
      H * 0.88,
      "600",
      Math.round((26 * W) / 1080),
      "rgba(255,255,255,0.25)",
      W - pad * 2,
      "center",
    );
  } else if (tpl === "minimal") {
    draw(slide.carName || "", xBase, H * 0.8, "800", hSz, "#fff", maxW, align);
    draw(
      slide.priceStr || "",
      xBase,
      H * 0.8 + hSz + 8,
      "700",
      pSz,
      acc,
      maxW,
      align,
    );
  } else if (tpl === "story") {
    // Softer vibe
    const storySz = Math.round((58 * W) / 1080);
    draw(
      slide.carName || "",
      xBase,
      H * 0.74,
      "800",
      storySz,
      "#fff",
      maxW,
      align,
    );
    draw(
      slide.priceStr || "",
      xBase,
      H * 0.74 + storySz + 12,
      "600",
      Math.round((42 * W) / 1080),
      theme.priceColor || acc,
      maxW,
      align,
    );
    draw(
      slide.statsLine || "",
      xBase,
      H * 0.74 + storySz + Math.round((42 * W) / 1080) + 24,
      "400",
      Math.round((30 * W) / 1080),
      "rgba(255,255,255,0.55)",
      maxW,
      align,
    );
  } else {
    // hype / hero-hook / default
    const bY = H * 0.74;
    draw(slide.carName || "", xBase, bY, "800", hSz, "#fff", maxW, align);
    draw(
      slide.priceStr || "",
      xBase,
      bY + hSz + 10,
      "700",
      pSz,
      theme.priceColor || acc,
      maxW,
      align,
    );
    draw(
      slide.statsLine || "",
      xBase,
      bY + hSz + pSz + 22,
      "600",
      sSz,
      "rgba(255,255,255,0.65)",
      maxW,
      align,
    );
  }

  // Slide number
  ctx.save();
  ctx.font = `700 ${Math.round((22 * W) / 1080)}px ${stack}`;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    String((slide.index ?? 0) + 1).padStart(2, "0"),
    W - Math.round((48 * W) / 1080),
    H - Math.round((48 * H) / 1920),
  );
  ctx.restore();
}

// ─── Slide Preview (HTML - live preview) ─────────────────────────────────────
function SlidePreview({ slide, theme, fontId = "dm", animKey }) {
  const outerRef = useRef(null);
  const [scale, setScale] = useState(0);
  const acc = theme.accentColor || "#e53935";
  const tpl = slide.template || "hype";
  const monthly = slide.monthly || calcMonthly(slide.priceNum);
  const mStr = monthly
    ? `RM ${Number(monthly).toLocaleString()}`
    : slide.priceStr || "";
  const feats = Array.isArray(slide.features) ? slide.features.slice(0, 6) : [];
  const fontDef = FONTS.find((f) => f.id === fontId) || FONTS[0];
  const fontStack = fontDef.stack;
  const isCenter = theme.textAlign === "center";
  const pad = 64;

  useEffect(() => {
    if (!outerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setScale(Math.min(width / CANVAS_W, height / CANVAS_H));
    });
    obs.observe(outerRef.current);
    return () => obs.disconnect();
  }, []);

  const textX = isCenter ? CANVAS_W / 2 : pad;
  const textAlign = isCenter ? "center" : "left";

  const hSz = theme.headlineSize || 72;
  const pSz = theme.priceSize || 52;
  const sSz = theme.statsSize || 32;
  const hookSz = theme.hookSize || 38;

  let bottomContent;
  if (tpl === "specs-breakdown") {
    bottomContent = (
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: pad,
          right: pad,
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 8,
            textAlign,
          }}
        >
          {slide.carName || ""}
        </div>
        <div
          style={{
            width: 100,
            height: 3,
            background: acc,
            marginBottom: 28,
            marginLeft: isCenter ? "auto" : 0,
            marginRight: isCenter ? "auto" : 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {feats.map((f, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 22 }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: acc + "33",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: acc, fontSize: 20, fontWeight: 700 }}>
                  ✓
                </span>
              </div>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                {f}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (tpl === "pricing") {
    const downStr = slide.priceNum
      ? "RM " + Number(slide.priceNum * 0.1).toLocaleString()
      : "";
    bottomContent = (
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: pad,
          right: pad,
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: acc,
            letterSpacing: "0.14em",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          MONTHLY PAYMENT
        </div>
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {mStr}
        </div>
        <div
          style={{
            fontSize: 30,
            color: "rgba(255,255,255,0.35)",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          /month
        </div>
        <div
          style={{
            background: "rgba(0,0,0,0.45)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "36px 48px",
          }}
        >
          {[
            { l: "Full Price", v: slide.priceStr || "" },
            { l: "Down Payment (10%)", v: downStr },
            { l: "Rate / Tenure", v: "3.5% / 9 Years" },
          ].map(({ l, v }, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "16px 0",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  color: "rgba(255,255,255,0.38)",
                  fontWeight: 600,
                }}
              >
                {l}
              </span>
              <span
                style={{
                  fontSize: 28,
                  color: "rgba(255,255,255,0.78)",
                  fontWeight: 700,
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (tpl === "cta") {
    bottomContent = (
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: pad,
          right: pad,
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          {slide.dealerName || theme.watermarkText || ""}
        </div>
        <div
          style={{
            fontSize: 36,
            color: "rgba(255,255,255,0.45)",
            textAlign: "center",
            marginBottom: 44,
          }}
        >
          {slide.carName || ""}
        </div>
        <div
          style={{
            background: acc,
            borderRadius: 999,
            padding: "44px 60px",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#fff", fontSize: 42, fontWeight: 800 }}>
            📲 {slide.whatsapp || "WhatsApp Us"}
          </span>
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 26,
            color: "rgba(255,255,255,0.2)",
          }}
        >
          DM for Test Drive · Best Price Guaranteed
        </div>
      </div>
    );
  } else if (tpl === "minimal") {
    bottomContent = (
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: isCenter ? 0 : pad,
          right: isCenter ? 0 : pad,
          width: isCenter ? "100%" : undefined,
          zIndex: 5,
          textAlign,
        }}
      >
        <div
          style={{
            fontSize: hSz,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 10,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.carName || ""}
        </div>
        <div
          style={{
            fontSize: pSz,
            fontWeight: 700,
            color: theme.priceColor || acc,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.priceStr || ""}
        </div>
      </div>
    );
  } else if (tpl === "story") {
    bottomContent = (
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: isCenter ? 0 : pad,
          right: isCenter ? 0 : pad,
          width: isCenter ? "100%" : undefined,
          zIndex: 5,
          textAlign,
        }}
      >
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 12,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.carName || ""}
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            color: theme.priceColor || acc,
            marginBottom: 12,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.priceStr || ""}
        </div>
        <div
          style={{
            fontSize: 30,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 400,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.statsLine || ""}
        </div>
      </div>
    );
  } else {
    // hype / hero-hook / default
    bottomContent = (
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: isCenter ? 0 : pad,
          right: isCenter ? 0 : pad,
          width: isCenter ? "100%" : undefined,
          zIndex: 5,
          textAlign,
        }}
      >
        <div
          style={{
            fontSize: hSz,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 12,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.carName || ""}
        </div>
        <div
          style={{
            fontSize: pSz,
            fontWeight: 700,
            color: theme.priceColor || acc,
            marginBottom: 12,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {slide.priceStr || ""}
        </div>
        <div
          style={{
            fontSize: sSz,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 600,
            padding: isCenter ? "0 64px" : 0,
          }}
        >
          {(slide.statsLine || "")
            .split(" · ")
            .filter(Boolean)
            .map((s, i) => (
              <span key={i}>
                {i > 0 && (
                  <span
                    style={{ color: "rgba(255,255,255,0.2)", margin: "0 8px" }}
                  >
                    ·
                  </span>
                )}
                {s}
              </span>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        background: "#060910",
        fontFamily: fontStack,
      }}
    >
      {scale > 0 && (
        <div
          key={animKey}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            overflow: "hidden",
            background: theme.bgColor || "#060910",
          }}
        >
          {/* BG blur */}
          {slide.imageUrl && (
            <img
              src={slide.imageUrl}
              alt=""
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: CANVAS_W,
                height: CANVAS_H,
                objectFit: "cover",
                filter: "blur(18px) brightness(0.4)",
                transform: "scale(1.06)",
                transformOrigin: "center",
              }}
            />
          )}
          {/* Car image */}
          {slide.imageUrl && (
            <img
              src={slide.imageUrl}
              alt=""
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                width: CANVAS_W,
                height: "auto",
                objectFit: "contain",
                opacity: 0.92,
                zIndex: 1,
              }}
            />
          )}
          {/* Gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom,rgba(6,9,16,0.95) 0%,rgba(6,9,16,0.08) 28%,rgba(6,9,16,0.05) 52%,rgba(6,9,16,0.82) 66%,#060910 100%)",
              zIndex: 2,
            }}
          />
          {/* Accent bar */}
          {theme.showAccentBar !== false && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: acc,
                zIndex: 10,
              }}
            />
          )}
          {/* Badges */}
          {(theme.showConditionBadge ||
            theme.showHotDealBadge ||
            theme.customBadgeText) && (
            <div
              style={{
                position: "absolute",
                top: CANVAS_H * 0.55,
                left: pad,
                right: pad,
                display: "flex",
                gap: 16,
                zIndex: 6,
              }}
            >
              {theme.showConditionBadge && slide.condition && (
                <div
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: acc,
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: "0.08em",
                  }}
                >
                  {{ new: "BRAND NEW", recon: "RECON", used: "USED" }[
                    slide.condition
                  ] || slide.condition.toUpperCase()}
                </div>
              )}
              {theme.showHotDealBadge && (
                <div
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: "#ff6b00",
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  🔥 HOT DEAL
                </div>
              )}
              {theme.customBadgeText && (
                <div
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: theme.badgeColor || acc,
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#fff",
                    marginLeft: "auto",
                  }}
                >
                  {theme.customBadgeText.toUpperCase()}
                </div>
              )}
            </div>
          )}
          {/* Hook */}
          {slide.hookText && (
            <div
              style={{
                position: "absolute",
                top: 150,
                left: 0,
                right: 0,
                textAlign: "center",
                padding: "0 80px",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: hookSz,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  lineHeight: 1.25,
                }}
              >
                {slide.hookText}
              </div>
              <div
                style={{
                  width: 120,
                  height: 4,
                  background: acc,
                  margin: "12px auto 0",
                }}
              />
            </div>
          )}
          {/* Bottom content */}
          {bottomContent}
          {/* Watermark */}
          {theme.watermarkText && (
            <div
              style={{
                position: "absolute",
                top: (theme.watermarkPos || "top-right").includes("bottom")
                  ? undefined
                  : 52,
                bottom: (theme.watermarkPos || "top-right").includes("bottom")
                  ? 80
                  : undefined,
                right: (theme.watermarkPos || "top-right").includes("right")
                  ? 52
                  : undefined,
                left: (theme.watermarkPos || "top-right").includes("right")
                  ? undefined
                  : 52,
                fontSize: 26,
                fontWeight: 700,
                color: `rgba(255,255,255,${theme.watermarkOpacity || 0.14})`,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                zIndex: 5,
              }}
            >
              {theme.watermarkText}
            </div>
          )}
          {/* Logo */}
          {theme.logoUrl && (
            <img
              src={theme.logoUrl}
              alt=""
              style={{
                position: "absolute",
                top: (theme.watermarkPos || "top-right").includes("bottom")
                  ? undefined
                  : 40,
                bottom: (theme.watermarkPos || "top-right").includes("bottom")
                  ? 60
                  : undefined,
                right: (theme.watermarkPos || "top-right").includes("right")
                  ? 52
                  : undefined,
                left: (theme.watermarkPos || "top-right").includes("right")
                  ? undefined
                  : 52,
                height: theme.logoSize || 80,
                objectFit: "contain",
                opacity: 0.85,
                zIndex: 5,
              }}
            />
          )}
          {/* Slide number */}
          <div
            style={{
              position: "absolute",
              bottom: 48,
              right: 48,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,0.18)",
              zIndex: 5,
            }}
          >
            {String((slide.index ?? 0) + 1).padStart(2, "0")}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────
const Thumb = React.memo(function Thumb({
  slide,
  fontId,
  theme,
  isActive,
  index,
  onClick,
  onDelete,
  showDelete,
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        flexShrink: 0,
        cursor: "pointer",
        width: 52,
        height: 92,
        borderRadius: 8,
        border: isActive
          ? "2px solid #e53935"
          : "2px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        transition: "all 0.15s",
        transform: isActive ? "scale(1.07)" : "scale(1)",
        opacity: slide.enabled === false ? 0.3 : 1,
        boxShadow: isActive ? "0 0 12px rgba(229,57,53,0.4)" : "none",
      }}
    >
      <SlidePreview slide={slide} theme={theme} fontId={fontId} />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0,0,0,0.65)",
          fontSize: 8,
          fontWeight: 700,
          color: isActive ? "#ff6b6b" : "rgba(255,255,255,0.4)",
          textAlign: "center",
          padding: "2px 0",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {index + 1}
      </div>
      {showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.9)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            opacity: 0,
            transition: "opacity 0.15s",
          }}
          className="thumb-del"
        >
          <X size={8} />
        </button>
      )}
    </div>
  );
});

// ─── Image Picker ─────────────────────────────────────────────────────────────
function ImagePicker({ images, current, onSelect, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.96)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        borderRadius: 4,
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
            color: "rgba(255,255,255,0.5)",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={12} />
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
                current === url ? "2px solid #e53935" : "2px solid transparent",
              transition: "border-color 0.15s",
            }}
          >
            <img
              src={url}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {current === url && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(229,57,53,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={20} color="#fff" />
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
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
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
            border: "none",
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
function SliderRow({ label, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "monospace",
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
        style={{ width: "100%", accentColor: "#e53935", height: 4 }}
      />
    </div>
  );
}
function PillRow({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            border: `1px solid ${value === o.value ? "#e53935" : "rgba(255,255,255,0.08)"}`,
            background:
              value === o.value ? "rgba(229,57,53,0.15)" : "transparent",
            color: value === o.value ? "#e53935" : "rgba(255,255,255,0.35)",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.12s",
          }}
        >
          {o.label}
        </button>
      ))}
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
          background: value ? "#e53935" : "rgba(255,255,255,0.08)",
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
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
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
        color: "rgba(255,255,255,0.18)",
        margin: "20px 0 10px",
        paddingBottom: 6,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {label}
    </p>
  );
}
function Input({ value, onChange, placeholder, big, onFocus, onBlur }) {
  const s = {
    width: "100%",
    padding: big ? "11px 14px" : "9px 13px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#fff",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: big ? 14 : 12,
    fontWeight: big ? 700 : 400,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={s}
      onFocus={(e) => {
        e.target.style.borderColor = "rgba(229,57,53,0.5)";
        onFocus && onFocus(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(255,255,255,0.08)";
        onBlur && onBlur(e);
      }}
    />
  );
}
function Label({ children }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.28)",
        display: "block",
        marginBottom: 5,
      }}
    >
      {children}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TikTokStudioV3({ listing, onClose }) {
  const rawImages = (listing?.images || []).filter(Boolean);
  const dealership = listing?.dealership_name || "";

  // State
  const [slides, setSlides] = useState(() =>
    buildDefaultSlides(listing, rawImages, [], [], dealership, ""),
  );
  const [active, setActive] = useState(0);
  const [font, setFont] = useState("dm");
  const [theme, setTheme] = useState(() => ({
    ...DEFAULT_THEME,
    watermarkText: dealership,
  }));
  const [lang, setLang] = useState("en");
  const [hookInput, setHookInput] = useState("");
  const [aiCmd, setAiCmd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applyingCmd, setApplyingCmd] = useState(false);
  const [genError, setGenError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [dlIdx, setDlIdx] = useState(null);
  const [activeTab, setActiveTab] = useState("slide");
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const [savedBrand, setSavedBrand] = useState(false);
  const [features, setFeatures] = useState([]);
  const [imagePageStart, setImagePageStart] = useState(11);
  const [cmdHistory, setCmdHistory] = useState([]);

  const filmRef = useRef(null);
  const logoInputRef = useRef(null);
  const aiInputRef = useRef(null);

  const slide = slides[active] || slides[0] || {};
  const total = slides.length;

  const patchTheme = useCallback(
    (key, val) => setTheme((t) => ({ ...t, [key]: val })),
    [],
  );
  const patch = useCallback(
    (field, value) =>
      setSlides((prev) =>
        prev.map((s, i) => (i === active ? { ...s, [field]: value } : s)),
      ),
    [active],
  );
  const patchMulti = useCallback(
    (obj) =>
      setSlides((prev) =>
        prev.map((s, i) => (i === active ? { ...s, ...obj } : s)),
      ),
    [active],
  );

  // Load features from DB
  useEffect(() => {
    if (!listing?.id) return;
    supabase
      .from("car_listings")
      .select("features,specs")
      .eq("id", listing.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const f = parseList(data.features);
        setFeatures(f);
        setSlides((prev) =>
          prev.map((sl) => ({
            ...sl,
            features: f.length > 0 ? f : sl.features,
          })),
        );
      });
  }, [listing?.id]);

  // Load branding from profile
  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select(
            "brand_color,font_choice,watermark_text,logo_url,dealership_name,whatsapp_number",
          )
          .eq("id", user.id)
          .single();
        if (!data) return;
        const dn = data.dealership_name || dealership,
          wa = data.whatsapp_number || "";
        setTheme((t) => ({
          ...t,
          accentColor: data.brand_color || t.accentColor,
          badgeColor: data.brand_color || t.badgeColor,
          watermarkText: data.watermark_text || dn || t.watermarkText,
          logoUrl: data.logo_url || t.logoUrl,
        }));
        if (data.font_choice) setFont(data.font_choice);
        setSlides((prev) =>
          prev.map((sl) => ({ ...sl, dealerName: dn, whatsapp: wa })),
        );
      } catch (e) {
        console.error(e);
      } finally {
        setProfileLoading(false);
      }
    }
    load();
    FONTS.forEach((f) => ensureFont(f.id));
  }, []);

  // Scroll film strip to active
  useEffect(() => {
    const el = filmRef.current;
    if (!el) return;
    const thumb = el.children[active];
    if (thumb)
      thumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    setAnimKey((k) => k + 1);
  }, [active]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setActive((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActive((i) => Math.min(total - 1, i + 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, total]);

  const saveBranding = useCallback(async () => {
    try {
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
    } catch (e) {
      console.error(e);
    }
  }, [theme, font]);

  const applyPreset = useCallback((preset) => {
    setTheme((t) => ({ ...t, ...preset.theme }));
  }, []);

  const addSlide = useCallback(() => {
    const price = listing?.selling_price || listing?.price;
    const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
    const n = {
      id: Date.now(),
      index: slides.length,
      imageUrl: rawImages[0] || null,
      condition: listing?.condition || "",
      template: "hype",
      fitMode: "auto",
      enabled: true,
      carName: `${listing?.brand || ""} ${listing?.model || ""}`.trim(),
      priceStr,
      bottomLeft: priceStr,
      priceNum: price || 0,
      statsLine: "",
      monthly: calcMonthly(price),
      hookText: "",
      features,
      dealerName: slide.dealerName || "",
      whatsapp: slide.whatsapp || "",
    };
    setSlides((prev) => [...prev, n]);
    setTimeout(() => setActive(slides.length), 0);
  }, [slides.length, listing, rawImages, features, slide]);

  const duplicateSlide = useCallback(() => {
    const dup = { ...slide, id: Date.now(), index: slides.length };
    setSlides((prev) => [...prev, dup]);
    setTimeout(() => setActive(slides.length), 0);
  }, [slide, slides.length]);

  const removeSlide = useCallback(
    (idx) => {
      if (total <= 1) return;
      setSlides((prev) =>
        prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, index: i })),
      );
      setActive((i) => Math.min(i, total - 2));
    },
    [total],
  );

  const addMoreImages = useCallback(() => {
    const next = rawImages.slice(imagePageStart, imagePageStart + 10);
    if (!next.length) return;
    const price = listing?.selling_price || listing?.price;
    const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
    const cond = listing?.condition || "";
    const condLabel =
      { new: "Brand New", recon: "Recon", used: "Used" }[cond] || cond;
    const mileage = listing?.mileage
      ? Number(listing.mileage).toLocaleString() + " km"
      : "";
    const carName =
      `${listing?.brand || ""} ${listing?.model || ""}${listing?.variant ? " " + listing.variant : ""} ${listing?.year || ""}`.trim();
    const statsLine = [String(listing?.year || ""), condLabel, mileage]
      .filter(Boolean)
      .join(" · ");
    const tplCycle = ["hype", "story", "specs-breakdown", "minimal", "hype"];
    const newSlides = next.map((img, i) => ({
      id: Date.now() + i,
      index: slides.length + i,
      imageUrl: img,
      condition: cond,
      template: tplCycle[i % tplCycle.length],
      fitMode: "auto",
      enabled: true,
      carName,
      priceStr,
      priceNum: price || 0,
      statsLine,
      monthly: calcMonthly(price),
      hookText: "",
      features,
      dealerName: slide.dealerName || "",
      whatsapp: slide.whatsapp || "",
    }));
    setSlides((prev) => [
      ...prev,
      ...newSlides.map((s, i) => ({ ...s, index: prev.length + i })),
    ]);
    setImagePageStart((p) => p + 10);
  }, [rawImages, imagePageStart, slides.length, listing, features, slide]);

  const generateText = useCallback(async () => {
    setGenerating(true);
    setGenError("");
    try {
      const results = await generateSlideText(listing, lang, hookInput, total);
      setSlides((prev) =>
        prev.map((s, i) => (results[i] ? { ...s, ...results[i] } : s)),
      );
    } catch {
      setGenError("AI failed — try again or edit manually.");
    }
    setGenerating(false);
  }, [listing, lang, hookInput, total]);

  const runAICommand = useCallback(async () => {
    if (!aiCmd.trim()) return;
    setApplyingCmd(true);
    const cmd = aiCmd.trim();
    setCmdHistory((h) => [cmd, ...h.slice(0, 4)]);
    setAiCmd("");
    try {
      const result = await applyAICommand(cmd, slide, theme);
      if (result.slide) patchMulti(result.slide);
      if (result.theme) setTheme((t) => ({ ...t, ...result.theme }));
    } catch {
      setGenError("Command failed — try again.");
    }
    setApplyingCmd(false);
  }, [aiCmd, slide, theme, patchMulti]);

  // Export
  const exportName = (idx) => {
    const d = (theme.watermarkText || "XDrive").replace(/\s+/g, "");
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
      c.width = CANVAS_W;
      c.height = CANVAS_H;
      await renderToCanvas(c, { ...slides[idx], index: idx }, theme, font);
      return new Promise((res) => c.toBlob(res, "image/jpeg", 0.93));
    },
    [slides, theme, font],
  );

  const saveSingle = useCallback(
    async (idx) => {
      setDlIdx(idx);
      const blob = await toBlob(idx),
        url = URL.createObjectURL(blob);
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
    const d = (theme.watermarkText || "XDrive").replace(/\s+/g, "");
    const c = `${listing?.brand || ""}${listing?.model || ""}`.replace(
      /\s+/g,
      "",
    );
    const dt = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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
    try {
      const JSZip = await loadJSZip(),
        zip = new JSZip(),
        folder = zip.folder(`${d}_${c}_${dt}`);
      for (let i = 0; i < total; i++)
        folder.file(exportName(i), await toBlob(i));
      const zb = await zip.generateAsync({ type: "blob" }),
        url = URL.createObjectURL(zb);
      const a = document.createElement("a");
      a.download = `${d}_${c}_${dt}.zip`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      for (let i = 0; i < total; i++) {
        await saveSingle(i);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    setDownloading(false);
  }, [total, theme, listing, toBlob, saveSingle]);

  // ─── Tab Panels ────────────────────────────────────────────────────────────

  const SlidePanel = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      {showImagePicker && rawImages.length > 0 && (
        <ImagePicker
          images={rawImages}
          current={slide.imageUrl}
          onSelect={(url) => patch("imageUrl", url)}
          onClose={() => setShowImagePicker(false)}
        />
      )}

      {/* Image controls */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {rawImages.length > 0 && (
          <button
            onClick={() => setShowImagePicker(true)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "9px 0",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <ImageIcon size={12} /> Change Photo
          </button>
        )}
        <label
          style={{
            flex: rawImages.length > 0 ? 0 : 1,
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "9px 11px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.4)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          Upload{" "}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files[0]) {
                const r = new FileReader();
                r.onload = (ev) => patch("imageUrl", ev.target.result);
                r.readAsDataURL(e.target.files[0]);
              }
            }}
          />
        </label>
        <button
          onClick={duplicateSlide}
          style={{
            padding: "9px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          <Copy size={11} />
        </button>
        {total > 1 && (
          <button
            onClick={() => removeSlide(active)}
            style={{
              padding: "9px 10px",
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)",
              color: "#f87171",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Template picker */}
      <SectionHead label="Template" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        {SLIDE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => patch("template", tpl.id)}
            style={{
              padding: "8px 10px",
              borderRadius: 9,
              border: `1px solid ${slide.template === tpl.id ? "#e53935" : "rgba(255,255,255,0.07)"}`,
              background:
                slide.template === tpl.id
                  ? "rgba(229,57,53,0.1)"
                  : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              transition: "all 0.12s",
            }}
          >
            <p
              style={{
                color:
                  slide.template === tpl.id
                    ? "#e53935"
                    : "rgba(255,255,255,0.65)",
                fontSize: 11,
                fontWeight: 700,
                margin: "0 0 2px",
              }}
            >
              {tpl.icon} {tpl.label}
            </p>
            <p
              style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, margin: 0 }}
            >
              {tpl.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Content */}
      <SectionHead label="Content" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <Label>Hook Line</Label>
          <Input
            value={slide.hookText || ""}
            onChange={(e) => patch("hookText", e.target.value)}
            placeholder="e.g. CLEANEST M4 IN MALAYSIA 🔥"
          />
        </div>
        <div>
          <Label>Car Name</Label>
          <Input
            value={slide.carName || ""}
            onChange={(e) => patch("carName", e.target.value)}
            placeholder="BMW M4 Competition 2023"
            big
          />
        </div>
        <div>
          <Label>Price</Label>
          <Input
            value={slide.priceStr || ""}
            onChange={(e) => patch("priceStr", e.target.value)}
            placeholder="RM 278,000"
          />
        </div>
        <div>
          <Label>Stats Line</Label>
          <Input
            value={slide.statsLine || ""}
            onChange={(e) => patch("statsLine", e.target.value)}
            placeholder="2023 · Recon · 10,000 km"
          />
        </div>
      </div>

      <Toggle
        value={slide.enabled !== false}
        onChange={(v) => patch("enabled", v)}
        label="Include in export"
      />
    </div>
  );

  const DesignPanel = () => (
    <div>
      {/* Style presets */}
      <SectionHead label="Style Presets" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 6,
          marginBottom: 4,
        }}
      >
        {STYLE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            style={{
              padding: "10px 6px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "center",
              transition: "all 0.12s",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 4,
                justifyContent: "center",
                marginBottom: 6,
              }}
            >
              {p.preview.map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: c,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                display: "block",
              }}
            >
              {p.label}
            </span>
          </button>
        ))}
      </div>

      <SectionHead label="Colors" />
      <ColorRow
        label="Accent / Primary"
        value={theme.accentColor}
        onChange={(v) => patchTheme("accentColor", v)}
      />
      <ColorRow
        label="Background"
        value={theme.bgColor}
        onChange={(v) => patchTheme("bgColor", v)}
      />
      <ColorRow
        label="Price color"
        value={theme.priceColor || theme.accentColor}
        onChange={(v) => patchTheme("priceColor", v)}
      />

      <SectionHead label="Typography" />
      <div style={{ marginBottom: 12 }}>
        <Label>Font</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                ensureFont(f.id);
                setFont(f.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 13px",
                borderRadius: 9,
                cursor: "pointer",
                width: "100%",
                border: `1px solid ${font === f.id ? "#e53935" : "rgba(255,255,255,0.07)"}`,
                background:
                  font === f.id
                    ? "rgba(229,57,53,0.08)"
                    : "rgba(255,255,255,0.02)",
                fontFamily: f.stack,
                transition: "all 0.12s",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: font === f.id ? "#e53935" : "rgba(255,255,255,0.65)",
                  fontWeight: 600,
                }}
              >
                {f.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.18)",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Aa Bb
              </span>
            </button>
          ))}
        </div>
      </div>

      <SectionHead label="Text Size" />
      <SliderRow
        label="Headline"
        value={theme.headlineSize}
        min={48}
        max={160}
        step={4}
        onChange={(v) => patchTheme("headlineSize", v)}
      />
      <SliderRow
        label="Price"
        value={theme.priceSize}
        min={32}
        max={120}
        step={4}
        onChange={(v) => patchTheme("priceSize", v)}
      />
      <SliderRow
        label="Stats"
        value={theme.statsSize}
        min={20}
        max={64}
        step={2}
        onChange={(v) => patchTheme("statsSize", v)}
      />
      <SliderRow
        label="Hook"
        value={theme.hookSize}
        min={24}
        max={72}
        step={2}
        onChange={(v) => patchTheme("hookSize", v)}
      />

      <SectionHead label="Layout" />
      <div style={{ marginBottom: 12 }}>
        <Label>Text Align</Label>
        <PillRow
          options={[
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
          ]}
          value={theme.textAlign}
          onChange={(v) => patchTheme("textAlign", v)}
        />
      </div>
      <SliderRow
        label="Overlay opacity"
        value={theme.overlayOpacity}
        min={0}
        max={0.9}
        step={0.05}
        onChange={(v) => patchTheme("overlayOpacity", v)}
        fmt={(v) => Math.round(v * 100) + "%"}
      />
      <Toggle
        value={theme.showAccentBar !== false}
        onChange={(v) => patchTheme("showAccentBar", v)}
        label="Show accent bar (top)"
      />
    </div>
  );

  const BrandPanel = () => (
    <div>
      {profileLoading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            background: "rgba(229,57,53,0.06)",
            borderRadius: 8,
            marginBottom: 14,
            border: "1px solid rgba(229,57,53,0.12)",
          }}
        >
          <Loader2
            size={12}
            style={{ animation: "spin 1s linear infinite", color: "#e53935" }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            Loading your branding…
          </span>
        </div>
      )}

      <SectionHead label="Watermark" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <div>
          <Label>Dealership name</Label>
          <Input
            value={theme.watermarkText}
            onChange={(e) => patchTheme("watermarkText", e.target.value)}
            placeholder="Your dealership name"
          />
        </div>
        <div>
          <Label>Position</Label>
          <PillRow
            options={[
              { label: "↗ Top R", value: "top-right" },
              { label: "↖ Top L", value: "top-left" },
              { label: "↘ Bot R", value: "bottom-right" },
              { label: "↙ Bot L", value: "bottom-left" },
            ]}
            value={theme.watermarkPos}
            onChange={(v) => patchTheme("watermarkPos", v)}
          />
        </div>
        <SliderRow
          label="Opacity"
          value={theme.watermarkOpacity}
          min={0.04}
          max={0.6}
          step={0.02}
          onChange={(v) => patchTheme("watermarkOpacity", v)}
          fmt={(v) => Math.round(v * 100) + "%"}
        />
      </div>

      <SectionHead label="Logo" />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = (ev) => patchTheme("logoUrl", ev.target.result);
            r.readAsDataURL(e.target.files[0]);
          }
        }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => logoInputRef.current?.click()}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <ImageIcon size={12} />
          {theme.logoUrl ? "Swap Logo" : "Upload Logo"}
        </button>
        {theme.logoUrl && (
          <button
            onClick={() => patchTheme("logoUrl", null)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.15)",
              background: "rgba(239,68,68,0.05)",
              color: "#f87171",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Remove
          </button>
        )}
      </div>
      {theme.logoUrl && (
        <>
          <div
            style={{
              padding: 10,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <img
              src={theme.logoUrl}
              alt="logo"
              style={{ height: 32, objectFit: "contain", borderRadius: 4 }}
            />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              Shows on all slides
            </span>
          </div>
          <SliderRow
            label="Logo size"
            value={theme.logoSize || 80}
            min={40}
            max={180}
            step={10}
            onChange={(v) => patchTheme("logoSize", v)}
          />
        </>
      )}

      <SectionHead label="Save Brand Kit" />
      <button
        onClick={saveBranding}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 10,
          border: `1px solid ${savedBrand ? "rgba(34,197,94,0.4)" : "rgba(229,57,53,0.25)"}`,
          background: savedBrand
            ? "rgba(34,197,94,0.08)"
            : "rgba(229,57,53,0.06)",
          color: savedBrand ? "#4ade80" : "#e53935",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.2s",
        }}
      >
        {savedBrand ? (
          <>
            <Check size={13} /> Saved!
          </>
        ) : (
          <>
            <Save size={13} /> Save as Brand Kit
          </>
        )}
      </button>
      <p
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.15)",
          marginTop: 6,
          textAlign: "center",
        }}
      >
        Saves colour, font, watermark & logo across all dealers
      </p>
    </div>
  );

  const BadgesPanel = () => (
    <div>
      <SectionHead label="Price Tag" />
      <div style={{ marginBottom: 14 }}>
        <PillRow
          options={[
            { label: "Plain", value: "plain" },
            { label: "Pill", value: "pill" },
            { label: "Boxed", value: "boxed" },
          ]}
          value={theme.priceTagStyle}
          onChange={(v) => patchTheme("priceTagStyle", v)}
        />
      </div>

      <SectionHead label="Auto Badges" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Toggle
          value={theme.showConditionBadge}
          onChange={(v) => patchTheme("showConditionBadge", v)}
          label={`Condition badge (${slide.condition?.toUpperCase() || "AUTO"})`}
        />
        <Toggle
          value={theme.showHotDealBadge}
          onChange={(v) => patchTheme("showHotDealBadge", v)}
          label="🔥 Hot Deal badge"
        />
      </div>

      <SectionHead label="Custom Badge" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <Label>Badge text</Label>
          <Input
            value={theme.customBadgeText}
            onChange={(e) => patchTheme("customBadgeText", e.target.value)}
            placeholder="e.g. NEGOTIABLE"
          />
        </div>
        <ColorRow
          label="Badge colour"
          value={theme.badgeColor}
          onChange={(v) => patchTheme("badgeColor", v)}
        />
      </div>
    </div>
  );

  const AIPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* AI Canvas Command */}
      <div
        style={{
          background: "rgba(229,57,53,0.05)",
          border: "1px solid rgba(229,57,53,0.15)",
          borderRadius: 12,
          padding: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <Wand2 size={13} color="#e53935" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#e53935",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            AI Canvas Edit
          </span>
        </div>
        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            marginBottom: 10,
          }}
        >
          Type what you want changed — AI applies it instantly
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            ref={aiInputRef}
            value={aiCmd}
            onChange={(e) => setAiCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAICommand()}
            placeholder="e.g. make price bigger, change accent to blue..."
            style={{
              flex: 1,
              padding: "10px 13px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(229,57,53,0.25)",
              borderRadius: 9,
              color: "#fff",
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12,
              outline: "none",
            }}
          />
          <button
            onClick={runAICommand}
            disabled={applyingCmd || !aiCmd.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 9,
              border: "none",
              background: applyingCmd ? "rgba(229,57,53,0.4)" : "#e53935",
              color: "#fff",
              cursor: applyingCmd ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {applyingCmd ? (
              <Loader2
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Zap size={14} />
            )}
          </button>
        </div>
        {/* Suggestions */}
        <div
          style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}
        >
          {[
            "make price bigger",
            "center all text",
            "add hot deal badge",
            "make minimal",
            "blue accent",
          ].map((s) => (
            <button
              key={s}
              onClick={() => {
                setAiCmd(s);
                setTimeout(() => aiInputRef.current?.focus(), 0);
              }}
              style={{
                padding: "4px 9px",
                borderRadius: 999,
                border: "1px solid rgba(229,57,53,0.2)",
                background: "transparent",
                color: "rgba(229,57,53,0.6)",
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
        {cmdHistory.length > 0 && (
          <div
            style={{
              marginTop: 10,
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
                  padding: "4px 0",
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ↩ {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text generation */}
      <SectionHead label="Generate All Slide Text" />
      <div style={{ display: "flex", gap: 6 }}>
        {["en", "bm"].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: 10,
              cursor: "pointer",
              border: `1px solid ${lang === l ? "#e53935" : "rgba(255,255,255,0.08)"}`,
              background:
                lang === l ? "rgba(229,57,53,0.1)" : "rgba(255,255,255,0.02)",
              color: lang === l ? "#e53935" : "rgba(255,255,255,0.35)",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            {l === "en" ? "🇬🇧 English" : "🇲🇾 Bahasa"}
          </button>
        ))}
      </div>
      <Input
        value={hookInput}
        onChange={(e) => setHookInput(e.target.value)}
        placeholder={`Hook — e.g. Cleanest ${listing?.brand || "car"} in Malaysia`}
      />
      <button
        onClick={generateText}
        disabled={generating}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "12px",
          borderRadius: 10,
          border: "none",
          background: "#e53935",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          cursor: generating ? "default" : "pointer",
          opacity: generating ? 0.6 : 1,
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        {generating ? (
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <Sparkles size={13} />
        )}
        {generating
          ? `Writing ${total} slides…`
          : `Generate All ${total} Slides`}
      </button>
      {genError && (
        <p
          style={{
            fontSize: 11,
            color: "#fbbf24",
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.12)",
            borderRadius: 8,
            padding: "8px 12px",
            margin: 0,
          }}
        >
          {genError}
        </p>
      )}
    </div>
  );

  const tabPanel = () => {
    if (activeTab === "slide") return <SlidePanel />;
    if (activeTab === "design") return <DesignPanel />;
    if (activeTab === "brand") return <BrandPanel />;
    if (activeTab === "badges") return <BadgesPanel />;
    if (activeTab === "ai") return <AIPanel />;
  };

  const TABS = [
    { id: "slide", label: "Slide", icon: <Layers size={11} /> },
    { id: "design", label: "Design", icon: <Palette size={11} /> },
    { id: "brand", label: "Brand", icon: <Shield size={11} /> },
    { id: "badges", label: "Badges", icon: <Tag size={11} /> },
    { id: "ai", label: "AI", icon: <Wand2 size={11} /> },
  ];

  const remainingImages =
    rawImages.length > imagePageStart ? rawImages.length - imagePageStart : 0;

  const FilmStrip = ({ horizontal }) => (
    <div
      ref={horizontal ? filmRef : null}
      style={
        horizontal
          ? {
              flexShrink: 0,
              display: "flex",
              gap: 7,
              overflowX: "auto",
              padding: "8px 12px",
              background: "#060610",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              scrollbarWidth: "none",
              alignItems: "center",
            }
          : {
              display: "flex",
              flexDirection: "column",
              gap: 7,
              overflow: "auto",
              flex: 1,
              scrollbarWidth: "none",
            }
      }
    >
      {!horizontal && (
        <div
          ref={filmRef}
          style={{ display: "flex", flexDirection: "column", gap: 7 }}
        >
          {slides.map((s, i) => (
            <Thumb
              key={s.id ?? i}
              slide={s}
              theme={theme}
              fontId={font}
              isActive={i === active}
              index={i}
              onClick={() => setActive(i)}
              onDelete={() => removeSlide(i)}
              showDelete={total > 1}
            />
          ))}
        </div>
      )}
      {horizontal &&
        slides.map((s, i) => (
          <Thumb
            key={s.id ?? i}
            slide={s}
            theme={theme}
            fontId={font}
            isActive={i === active}
            index={i}
            onClick={() => setActive(i)}
            onDelete={() => removeSlide(i)}
            showDelete={total > 1}
          />
        ))}
      {remainingImages > 0 && (
        <button
          onClick={addMoreImages}
          style={{
            flexShrink: 0,
            width: 52,
            height: 92,
            borderRadius: 8,
            border: "2px dashed rgba(229,57,53,0.35)",
            background: "rgba(229,57,53,0.04)",
            color: "#e53935",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <Plus size={13} />
          <span style={{ fontSize: 7, fontWeight: 700 }}>
            +{remainingImages}
          </span>
        </button>
      )}
      <button
        onClick={addSlide}
        style={{
          flexShrink: 0,
          width: 52,
          height: 92,
          borderRadius: 8,
          border: "2px dashed rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.015)",
          color: "rgba(255,255,255,0.25)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus size={15} />
      </button>
    </div>
  );

  const PreviewPane = () => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#070711",
        gap: 12,
        padding: "20px",
        position: "relative",
      }}
    >
      <div
        style={{
          aspectRatio: "9/16",
          height: "min(calc(100dvh - 180px), 540px)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}
      >
        <SlidePreview
          slide={{ ...slide, index: active }}
          theme={theme}
          fontId={font}
          animKey={`${active}-${animKey}`}
        />
      </div>
      <button
        onClick={() => setActive((i) => Math.max(0, i - 1))}
        disabled={active === 0}
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: active === 0 ? 0.1 : 0.7,
          backdropFilter: "blur(8px)",
        }}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => setActive((i) => Math.min(total - 1, i + 1))}
        disabled={active === total - 1}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: active === total - 1 ? 0.1 : 0.7,
          backdropFilter: "blur(8px)",
        }}
      >
        <ChevronRight size={16} />
      </button>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.2)",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {active + 1} / {total} ·{" "}
        {SLIDE_TEMPLATES.find((t) => t.id === slide.template)?.label || "Hype"}{" "}
        · ← →
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes tgIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .tg * { box-sizing: border-box; }
        .tg ::-webkit-scrollbar { display: none; }
        .tg-d { display: none !important; }
        .tg-m { display: flex !important; }
        @media (min-width: 768px) { .tg-d { display: flex !important; } .tg-m { display: none !important; } }
        .thumb-wrap:hover .thumb-del { opacity: 1 !important; }
        input[type=range] { height: 3px; border-radius: 2px; }
      `}</style>

      <div
        className="tg"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "rgba(0,0,0,0.92)",
          backdropFilter: "blur(16px)",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {/* ── DESKTOP ────────────────────────────────────────────────────── */}
        <div
          className="tg-d"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            inset: 0,
            flexDirection: "column",
            background: "#08080f",
            animation: "tgIn 0.22s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              height: 52,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "#0b0b15",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#e53935",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.77 0 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.12 8.72 6.34 6.34 0 0 0 11.65-3.42V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
                </svg>
              </div>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
                Content Studio V3
              </span>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
                {listing?.brand} {listing?.model} · {total} slides
              </span>
            </div>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.15)",
                  marginRight: 4,
                }}
              >
                ← → to navigate
              </span>
              <button
                onClick={() => saveSingle(active)}
                disabled={dlIdx === active}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 13px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: dlIdx === active ? 0.5 : 1,
                }}
              >
                {dlIdx === active ? (
                  <Loader2
                    size={12}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Download size={12} />
                )}{" "}
                This slide
              </button>
              <button
                onClick={saveAll}
                disabled={downloading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#e53935",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: downloading ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: downloading ? 0.6 : 1,
                }}
              >
                {downloading ? (
                  <Loader2
                    size={12}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Download size={12} />
                )}
                {downloading
                  ? "Packing…"
                  : isIOS()
                    ? `Save All (${total})`
                    : `Export ZIP (${total})`}
              </button>
              <button
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* Film strip - vertical left */}
            <div
              style={{
                width: 78,
                background: "#06060f",
                borderRight: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                flexDirection: "column",
                padding: "12px 13px",
                overflowY: "auto",
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.15)",
                  marginBottom: 10,
                  marginTop: 0,
                }}
              >
                Slides
              </p>
              <FilmStrip horizontal={false} />
            </div>

            {/* Preview */}
            <PreviewPane />

            {/* Right panel */}
            <div
              style={{
                width: 310,
                background: "#0b0b15",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 2,
                  padding: "10px 10px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                {TABS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 7,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        activeTab === id
                          ? "rgba(229,57,53,0.12)"
                          : "rgba(255,255,255,0.02)",
                      border: `1px solid ${activeTab === id ? "rgba(229,57,53,0.35)" : "rgba(255,255,255,0.06)"}`,
                      color:
                        activeTab === id ? "#e53935" : "rgba(255,255,255,0.35)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.12s",
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
                {tabPanel()}
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE ─────────────────────────────────────────────────────── */}
        <div
          className="tg-m"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            inset: 0,
            flexDirection: "column",
            background: "#08080f",
            animation: "tgIn 0.22s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "#0b0b15",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={15} />
            </button>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>
              {active + 1}/{total} · {listing?.brand} {listing?.model}
            </span>
            <button
              onClick={saveAll}
              disabled={downloading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                background: "#e53935",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: downloading ? 0.6 : 1,
              }}
            >
              {downloading ? (
                <Loader2
                  size={11}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Download size={11} />
              )}
              {downloading ? "…" : isIOS() ? "Save" : "ZIP"}
            </button>
          </div>

          {/* Preview */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#060610",
              padding: "12px 16px",
              position: "relative",
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 140,
                  height: 249,
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow:
                    "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <SlidePreview
                  slide={{ ...slide, index: active }}
                  theme={theme}
                  fontId={font}
                  animKey={`m-${active}-${animKey}`}
                />
              </div>
              <button
                onClick={() => saveSingle(active)}
                disabled={dlIdx === active}
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 6,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.75)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {dlIdx === active ? (
                  <Loader2
                    size={10}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Download size={10} />
                )}
              </button>
            </div>
            <button
              onClick={() => setActive((i) => Math.max(0, i - 1))}
              disabled={active === 0}
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: active === 0 ? 0.1 : 0.7,
              }}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => setActive((i) => Math.min(total - 1, i + 1))}
              disabled={active === total - 1}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: active === total - 1 ? 0.1 : 0.7,
              }}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Horizontal film strip */}
          <FilmStrip horizontal={true} />

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "#0b0b15",
              flexShrink: 0,
              overflowX: "auto",
            }}
          >
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  flex: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderBottom:
                    activeTab === id
                      ? "2px solid #e53935"
                      : "2px solid transparent",
                  color:
                    activeTab === id ? "#e53935" : "rgba(255,255,255,0.25)",
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  {icon}
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Panel */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 14px",
              overscrollBehavior: "contain",
            }}
          >
            {tabPanel()}
          </div>
        </div>
      </div>
    </>
  );
}
