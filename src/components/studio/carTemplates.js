// ─── Pro car-listing templates for TikTok Studio ─────────────────────────────
// 5 ready-made 1080x1920 designs following pro car-sale post conventions:
// hook zone top ~12%, car photo band in the middle third, info/price block
// in the lower third, CTA near (but not inside) the TikTok UI safe area.
// Every template is fully editable after applying — elements are plain
// studio text/badge elements, decorations are plain layers.
//
// carZone is in CANVAS PERCENT (x/y/w/h of 1080x1920) and drives both the
// in-editor "YOUR CAR HERE" placeholder and the camera overlay guide.
// `hint` is the photography angle instruction shown inside the camera.

const W = 1080;
const H = 1920;

// Build the text context a template needs from the listing + slide.
export function buildTemplateCtx(listing, slide, features = []) {
  const brand = listing?.brand || "";
  const model = listing?.model || "";
  const variant = listing?.variant || "";
  const year = String(listing?.year || "");
  const price = listing?.selling_price || listing?.price || 0;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "PRICE ON REQUEST";
  const monthly = slide?.monthly || 0;
  const monthlyStr = monthly ? "RM " + Number(monthly).toLocaleString() : "";
  const mileage = listing?.mileage ? Number(listing.mileage).toLocaleString() + " KM" : "";
  const trans = (listing?.transmission || "").toUpperCase();
  const cond = { new: "BRAND NEW", recon: "RECON", used: "USED" }[listing?.condition] || "";
  return {
    carName: [year, brand, model].filter(Boolean).join(" ") || "YOUR CAR",
    carNameFull: [year, brand, model, variant].filter(Boolean).join(" ") || "YOUR CAR",
    brandModel: [brand, model].filter(Boolean).join(" ") || "YOUR CAR",
    year,
    priceStr,
    monthlyStr,
    statsLine: [year, cond, mileage, trans].filter(Boolean).join("  ·  "),
    specParts: { year, cond, mileage, trans },
    dealerName: slide?.dealerName || "",
    whatsapp: slide?.whatsapp || "",
    topFeatures: features.slice(0, 3),
  };
}

const el = (o) => ({
  type: "text",
  rotation: 0,
  opacity: 1,
  align: "left",
  visible: true,
  locked: false,
  fontWeight: "700",
  color: "#ffffff",
  shadow: true,
  ...o,
});
const badge = (o) => ({ ...el(o), type: "badge", shadow: false });

export const CAR_TEMPLATES = [
  // 1 ── SHOWROOM — clean dealer look, price-forward, gold on black
  {
    id: "showroom",
    name: "Showroom",
    tagline: "Clean · price-forward · gold accent",
    preview: { bg: "#0d0d0d", accent: "#c9a84c", style: "bars-bottom" },
    fonts: ["bebas", "anton", "dm"],
    theme: { accentColor: "#c9a84c", bgColor: "#0d0d0d", overlayOpacity: 0.5 },
    carZone: { x: 4, y: 27, w: 92, h: 34, hint: "Side profile · camera at door-handle height" },
    buildElements: (c) => [
      el({ content: c.dealerName || "YOUR DEALERSHIP", x: W / 2 - 200, y: 130, fontSize: 30, fontWeight: "600", color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans',sans-serif" }),
      el({ content: c.carName, x: 72, y: 1270, fontSize: 92, fontFamily: "'Bebas Neue',sans-serif", fontWeight: "400" }),
      el({ content: c.statsLine, x: 76, y: 1390, fontSize: 30, fontWeight: "400", color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans',sans-serif" }),
      el({ content: c.priceStr, x: 72, y: 1460, fontSize: 118, color: "#c9a84c", fontFamily: "'Anton',sans-serif", fontWeight: "400" }),
      badge({ content: c.whatsapp ? `WhatsApp ${c.whatsapp}` : "WhatsApp us today", x: 76, y: 1650, fontSize: 30, bgColor: "#c9a84c", color: "#111" }),
    ],
    buildLayers: () => [
      { type: "rect", label: "Accent rule", x: 7, y: 64.5, width: 22, height: 0.35, fill: "#c9a84c", fillOpacity: 100, zIndex: 12 },
    ],
  },

  // 2 ── JUST ARRIVED — hype drop, diagonal ribbon, bold red
  {
    id: "justArrived",
    name: "Just Arrived",
    tagline: "Hype drop · diagonal ribbon · bold red",
    preview: { bg: "#0a0a0a", accent: "#e53935", style: "ribbon" },
    fonts: ["anton", "oswald", "dm"],
    theme: { accentColor: "#e53935", bgColor: "#0a0a0a", overlayOpacity: 0.45 },
    carZone: { x: 4, y: 29, w: 92, h: 35, hint: "Front 3/4 angle · phone low, at bumper level" },
    buildElements: (c) => [
      el({ content: c.carNameFull.toUpperCase(), x: 72, y: 250, fontSize: 72, fontFamily: "'Anton',sans-serif", fontWeight: "400", strokeWidth: 0, }),
      el({ content: c.statsLine, x: 76, y: 356, fontSize: 30, fontWeight: "600", color: "rgba(255,255,255,0.8)", fontFamily: "'Oswald',sans-serif" }),
      el({ content: c.priceStr, x: 72, y: 1330, fontSize: 132, fontFamily: "'Anton',sans-serif", fontWeight: "400", strokeWidth: 3, strokeColor: "#000000" }),
      badge({ content: "VIEW TODAY · DM NOW", x: 76, y: 1530, fontSize: 34, bgColor: "#e53935" }),
      el({ content: c.dealerName, x: 76, y: 1650, fontSize: 28, fontWeight: "400", color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans',sans-serif" }),
    ],
    buildLayers: () => [
      { type: "rect", label: "Ribbon", x: -8, y: 6.2, width: 52, height: 3.4, rotation: -7, fill: "#e53935", fillOpacity: 100, zIndex: 14, text: "JUST ARRIVED", fontSize: 40, fontWeight: "800", textColor: "#ffffff", fontFamily: "Oswald" },
    ],
  },

  // 3 ── SPEC SHEET — info panel over glass card, straight facts
  {
    id: "specSheet",
    name: "Spec Sheet",
    tagline: "Glass info card · straight facts",
    preview: { bg: "#0b1220", accent: "#00d4ff", style: "card" },
    fonts: ["oswald", "dm"],
    theme: { accentColor: "#00d4ff", bgColor: "#0b1220", overlayOpacity: 0.4 },
    carZone: { x: 4, y: 22, w: 92, h: 38, hint: "Straight-on front · centered, headlights on" },
    buildElements: (c) => [
      el({ content: c.carNameFull.toUpperCase(), x: 96, y: 1310, fontSize: 62, fontFamily: "'Oswald',sans-serif" }),
      el({ content: [c.specParts.year, c.specParts.cond].filter(Boolean).join("  ·  "), x: 100, y: 1408, fontSize: 32, fontWeight: "400", color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans',sans-serif" }),
      el({ content: [c.specParts.mileage, c.specParts.trans].filter(Boolean).join("  ·  "), x: 100, y: 1462, fontSize: 32, fontWeight: "400", color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans',sans-serif" }),
      el({ content: c.priceStr, x: 96, y: 1530, fontSize: 96, color: "#00d4ff", fontFamily: "'Oswald',sans-serif" }),
      badge({ content: "FULL SPEC IN COMMENTS ↓", x: 100, y: 1680, fontSize: 28, bgColor: "rgba(0,212,255,0.9)", color: "#04222b" }),
    ],
    buildLayers: () => [
      { type: "rect", label: "Glass card", x: 5.5, y: 66, width: 89, height: 26, fill: "#050b14", fillOpacity: 68, borderRadius: 24, borderWidth: 1, borderColor: "#00d4ff", borderOpacity: 35, zIndex: 8 },
    ],
  },

  // 4 ── MONTHLY DEAL — instalment-first, urgency
  {
    id: "monthlyDeal",
    name: "Monthly Deal",
    tagline: "Instalment-first · urgency",
    preview: { bg: "#021a0d", accent: "#00c853", style: "big-number" },
    fonts: ["anton", "dm", "oswald"],
    theme: { accentColor: "#00c853", bgColor: "#021a0d", overlayOpacity: 0.5 },
    carZone: { x: 4, y: 25, w: 92, h: 34, hint: "Rear 3/4 angle · show the stance" },
    buildElements: (c) => [
      badge({ content: "LOW DEPOSIT · FAST LOAN", x: 72, y: 170, fontSize: 30, bgColor: "#00c853", color: "#02180c" }),
      el({ content: "DRIVE IT FROM", x: 76, y: 1230, fontSize: 34, fontWeight: "600", color: "rgba(255,255,255,0.7)", fontFamily: "'Oswald',sans-serif" }),
      el({ content: c.monthlyStr ? `${c.monthlyStr}/BULAN` : "RM XXX/BULAN", x: 72, y: 1290, fontSize: 128, color: "#00c853", fontFamily: "'Anton',sans-serif", fontWeight: "400", strokeWidth: 2, strokeColor: "#01230f" }),
      el({ content: `Full price ${c.priceStr}`, x: 76, y: 1480, fontSize: 32, fontWeight: "400", color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans',sans-serif" }),
      el({ content: c.carName, x: 76, y: 1560, fontSize: 48, fontFamily: "'Oswald',sans-serif" }),
      badge({ content: "BULAN INI SAHAJA", x: 76, y: 1670, fontSize: 28, bgColor: "#ffffff", color: "#02180c" }),
    ],
    buildLayers: () => [],
  },

  // 5 ── LUXURY — minimal serif, thin gold frame, negative space
  {
    id: "luxury",
    name: "Luxury",
    tagline: "Minimal serif · gold frame",
    preview: { bg: "#0d0d0d", accent: "#c9a84c", style: "frame" },
    fonts: ["playfair", "dm"],
    theme: { accentColor: "#c9a84c", bgColor: "#0d0d0d", overlayOpacity: 0.35 },
    carZone: { x: 8, y: 30, w: 84, h: 33, hint: "Side profile · clean background, golden hour" },
    buildElements: (c) => [
      el({ content: (c.dealerName || "PRIVATE COLLECTION").toUpperCase(), x: W / 2 - 190, y: 190, fontSize: 26, fontWeight: "400", color: "rgba(255,255,255,0.55)", fontFamily: "'DM Sans',sans-serif" }),
      el({ content: c.carName, x: 130, y: 1330, fontSize: 74, fontFamily: "'Playfair Display',serif", fontWeight: "700" }),
      el({ content: "—", x: 130, y: 1450, fontSize: 40, fontWeight: "400", color: "#c9a84c" }),
      el({ content: c.priceStr, x: 130, y: 1530, fontSize: 52, fontWeight: "400", color: "#c9a84c", fontFamily: "'Playfair Display',serif" }),
      el({ content: "Viewing by appointment", x: 132, y: 1630, fontSize: 28, fontWeight: "400", color: "rgba(255,255,255,0.55)", fontFamily: "'DM Sans',sans-serif", fontStyle: "italic" }),
    ],
    buildLayers: () => [
      { type: "rect", label: "Gold frame", x: 4.5, y: 3.5, width: 91, height: 93, fill: "#000000", fillOpacity: 0, borderWidth: 2, borderColor: "#c9a84c", borderOpacity: 70, zIndex: 16, locked: false },
    ],
  },
];
