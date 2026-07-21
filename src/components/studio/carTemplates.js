// ─── Pro car-listing templates for TikTok Studio ─────────────────────────────
// 5 ready-made 1080x1920 designs modelled on real Malaysian dealer posts:
//   heroPrice — spec chip strip on top + huge shorthand price ("348K")
//   poster    — launch-poster: big title, letter-spaced subtitle, feature row
//   collage   — multi-photo panels + hero + description + 3-col spec footer
//   monthly   — instalment-first with urgency badges
//   luxury    — serif, thin gold frame, negative space
// Each template mixes zone orientation (full-bleed vertical / horizontal
// band / collage) so they don't all feel the same, and every content-driven
// text is auto-fitted so long car names can never run off the canvas.
//
// carZone is in CANVAS PERCENT and drives the in-editor placeholder and the
// camera overlay guide. `hint` is the photography instruction in the camera.

const W = 1080;
const H = 1920;

// Approximate glyph-width factor per font family (fraction of fontSize)
const FONT_FACTOR = {
  anton: 0.5,
  bebas: 0.45,
  oswald: 0.52,
  dm: 0.56,
  playfair: 0.6,
};

// Shrink fontSize until `text` fits maxWidth. Returns { size, width }.
function fitFont(text, baseSize, maxWidth, factorKey = "dm") {
  const f = FONT_FACTOR[factorKey] ?? 0.55;
  const len = Math.max(1, (text || "").length);
  const size = Math.max(18, Math.min(baseSize, Math.floor(maxWidth / (len * f))));
  return { size, width: len * f * size };
}

// Center a nowrap text element horizontally
function centerX(width) {
  return Math.max(40, Math.round((W - width) / 2));
}

// Letter-spaced subtitle trick (elements have no letterSpacing prop)
function spaced(text) {
  return (text || "").toUpperCase().split("").join(" ").replace(/\s{3}/g, "   ");
}

// "RM 348,000" → "348K", "RM 1,050,000" → "1.05M"
function shortPrice(price) {
  const n = Number(price) || 0;
  if (!n) return "POA";
  if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(n);
}

// Build the text context a template needs from the listing + slide.
export function buildTemplateCtx(listing, slide, features = [], images = []) {
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
  const colour = (listing?.colour || listing?.color || "").toUpperCase();
  const cond = { new: "BRAND NEW", recon: "RECON", used: "USED" }[listing?.condition] || "";
  return {
    carName: [year, brand, model].filter(Boolean).join(" ") || "YOUR CAR",
    carNameFull: [year, brand, model, variant].filter(Boolean).join(" ") || "YOUR CAR",
    brandModel: [brand, model].filter(Boolean).join(" ") || "YOUR CAR",
    year,
    price,
    priceStr,
    priceShort: shortPrice(price),
    monthlyStr,
    statsLine: [year, cond, mileage, trans].filter(Boolean).join("  ·  "),
    specParts: { year, cond, mileage, trans, colour },
    dealerName: slide?.dealerName || "",
    whatsapp: slide?.whatsapp || "",
    topFeatures: features.slice(0, 3),
    images: images.filter(Boolean),
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

// Text layer factory (wraps + supports \n — used for chips, columns, paragraphs)
const tLayer = (o) => ({
  type: "text",
  fill: "transparent",
  fillOpacity: 0,
  borderWidth: 0,
  fontWeight: "700",
  textColor: "#ffffff",
  textAlign: "center",
  textVerticalAlign: "center",
  fontFamily: "DM Sans",
  zIndex: 22,
  ...o,
});

export const CAR_TEMPLATES = [
  // 1 ── HERO PRICE — spec chip strip top + huge shorthand price (full-bleed)
  {
    id: "heroPrice",
    name: "Hero Price",
    tagline: "Spec strip · giant 348K-style price · full-bleed photo",
    preview: { bg: "#0b0f16", accent: "#3aa3ff", style: "strip" },
    fonts: ["anton", "dm", "oswald"],
    theme: { accentColor: "#3aa3ff", bgColor: "#0b0f16", overlayOpacity: 0.3 },
    carZone: { x: 3, y: 30, w: 94, h: 46, hint: "Front 3/4 · car fills the frame, shoot tall" },
    buildElements: (c) => {
      const pill = fitFont(c.carName.toUpperCase(), 30, 560, "oswald");
      return [
        el({ content: (c.dealerName || "YOUR DEALERSHIP").toUpperCase(), x: centerX(c.dealerName.length * 0.56 * 26 || 300), y: 52, fontSize: 26, fontWeight: "600", color: "rgba(255,255,255,0.8)", fontFamily: "'DM Sans',sans-serif" }),
        el({ content: "FROM RM", x: 64, y: 356, fontSize: 40, fontWeight: "600", color: "rgba(255,255,255,0.85)", fontFamily: "'Oswald',sans-serif" }),
        el({ content: c.priceShort, x: 56, y: 400, fontSize: 300, fontFamily: "'Anton',sans-serif", fontWeight: "400", strokeWidth: 4, strokeColor: "rgba(0,0,0,0.55)" }),
        badge({ content: c.carName.toUpperCase(), x: 64, y: 760, fontSize: pill.size, bgColor: "#3aa3ff", color: "#04121f" }),
        badge({ content: c.whatsapp ? `WHATSAPP ${c.whatsapp}` : "DM TO BOOK A VIEWING", x: 64, y: 1730, fontSize: 30, bgColor: "rgba(255,255,255,0.92)", color: "#0b0f16" }),
      ];
    },
    buildLayers: (c) => {
      const cells = [
        c.specParts.year && { v: c.specParts.year, l: "YEAR MADE" },
        c.specParts.colour && { v: c.specParts.colour, l: "COLOUR" },
        c.specParts.mileage && { v: c.specParts.mileage, l: "MILEAGE" },
        c.specParts.cond && { v: c.specParts.cond, l: "CONDITION" },
      ].filter(Boolean).slice(0, 4);
      const stripX = 4, stripW = 92;
      const cellW = stripW / Math.max(1, cells.length);
      return [
        { type: "rect", label: "Spec strip", x: stripX, y: 6.2, width: stripW, height: 6.6, fill: "#0a1119", fillOpacity: 62, borderRadius: 20, borderWidth: 1, borderColor: "#7cc4ff", borderOpacity: 30, zIndex: 20 },
        ...cells.map((cell, i) =>
          tLayer({ label: cell.l, text: `${cell.v}\n${cell.l}`, x: stripX + i * cellW, y: 6.6, width: cellW, height: 5.8, fontSize: 26, zIndex: 22 }),
        ),
      ];
    },
  },

  // 2 ── POSTER — launch poster: title, letter-spaced sub, feature row (band)
  {
    id: "poster",
    name: "Poster",
    tagline: "Launch-poster title · feature icons row",
    preview: { bg: "#05070d", accent: "#8ef04a", style: "poster" },
    fonts: ["anton", "dm", "oswald"],
    theme: { accentColor: "#8ef04a", bgColor: "#05070d", overlayOpacity: 0.5 },
    carZone: { x: 2, y: 33, w: 96, h: 30, hint: "Front hero shot · low angle, car centered" },
    buildElements: (c) => {
      const title = fitFont(c.brandModel.toUpperCase(), 108, 950, "anton");
      const sub = spaced(`${c.year} ${c.specParts.cond || "FOR SALE"}`.trim());
      const subFit = fitFont(sub, 30, 900, "dm");
      return [
        el({ content: (c.dealerName || "YOUR DEALERSHIP").toUpperCase(), x: 56, y: 60, fontSize: 30, fontWeight: "800", color: "#8ef04a", fontFamily: "'Oswald',sans-serif" }),
        badge({ content: "NEW ARRIVAL", x: 800, y: 56, fontSize: 26, bgColor: "rgba(255,255,255,0.1)", color: "#ffffff", borderRadius: 6 }),
        el({ content: c.brandModel.toUpperCase(), x: centerX(title.width), y: 300, fontSize: title.size, fontFamily: "'Anton',sans-serif", fontWeight: "400" }),
        el({ content: sub, x: centerX(subFit.width), y: 320 + title.size * 1.25, fontSize: subFit.size, fontWeight: "400", color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans',sans-serif" }),
        el({ content: c.priceStr, x: 64, y: 1268, fontSize: fitFont(c.priceStr, 96, 640, "anton").size, fontFamily: "'Anton',sans-serif", fontWeight: "400", color: "#8ef04a", strokeWidth: 2, strokeColor: "#03140a" }),
        el({ content: c.monthlyStr ? `or ${c.monthlyStr}/bulan` : "", x: 68, y: 1400, fontSize: 32, fontWeight: "400", color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans',sans-serif" }),
      ];
    },
    buildLayers: (c) => {
      const feats = (c.topFeatures.length ? c.topFeatures : ["Accident Free", "Full Service Record", "1 Owner"]).slice(0, 3);
      const colW = 88 / feats.length;
      return [
        { type: "rect", label: "Divider", x: 6, y: 78.4, width: 88, height: 0.16, fill: "#8ef04a", fillOpacity: 60, zIndex: 20 },
        ...feats.map((f, i) =>
          tLayer({ label: `Feature ${i + 1}`, text: `✦\n${f}`, x: 6 + i * colW, y: 79.6, width: colW, height: 7.2, fontSize: 24, fontWeight: "600", textColor: "rgba(255,255,255,0.85)", zIndex: 22 }),
        ),
        tLayer({ label: "CTA", text: "CONTACT US TODAY", x: 25, y: 88.6, width: 50, height: 3.6, fontSize: 28, fontWeight: "800", textColor: "#05070d", fill: "#8ef04a", fillOpacity: 100, borderRadius: 12, zIndex: 22 }),
      ];
    },
  },

  // 3 ── COLLAGE — photo panels + hero + description + 3-col spec footer
  {
    id: "collage",
    name: "Collage",
    tagline: "Multi-photo panels · spec footer (BMW-poster style)",
    preview: { bg: "#0a1024", accent: "#4a7dff", style: "panels" },
    fonts: ["anton", "dm", "oswald"],
    theme: { accentColor: "#4a7dff", bgColor: "#0a1024", overlayOpacity: 0.45 },
    carZone: { x: 2, y: 27, w: 96, h: 29, hint: "Hero shot · front 3/4, fill the wide band" },
    buildElements: (c) => {
      const title = fitFont(c.brandModel.toUpperCase(), 116, 950, "anton");
      const sub = spaced(c.specParts.cond || c.year || "SHOWROOM");
      const subFit = fitFont(sub, 28, 880, "dm");
      return [
        el({ content: c.brandModel.toUpperCase(), x: centerX(title.width), y: 1108, fontSize: title.size, fontFamily: "'Anton',sans-serif", fontWeight: "400" }),
        el({ content: sub, x: centerX(subFit.width), y: 1128 + title.size * 1.22, fontSize: subFit.size, fontWeight: "400", color: "#7ea2ff", fontFamily: "'DM Sans',sans-serif" }),
      ];
    },
    buildLayers: (c) => {
      const imgs = c.images;
      const panels = imgs.length >= 2
        ? [imgs[1] || imgs[0], imgs[2] || imgs[0], imgs[3] || imgs[1] || imgs[0]]
        : [];
      const desc = c.topFeatures.length
        ? `${c.carNameFull}. ${c.topFeatures.join(" · ")}.`
        : `${c.carNameFull}. Genuine condition, ready to view — message us for the full spec sheet.`;
      const specs = [
        { v: c.specParts.mileage || "—", l: "MILEAGE" },
        { v: c.specParts.trans || "—", l: "TRANSMISSION" },
        { v: c.specParts.year || "—", l: "YEAR" },
      ];
      return [
        ...panels.map((src, i) =>
          ({ type: "image", label: `Panel ${i + 1}`, src, x: 4 + i * 31.4, y: 3.6, width: 29.2, height: 21, objectFit: "cover", borderRadius: 10, borderWidth: 1, borderColor: "#7ea2ff", borderOpacity: 30, zIndex: 20 }),
        ),
        tLayer({ label: "Description", text: desc, x: 9, y: 66.5, width: 82, height: 7.5, fontSize: 25, fontWeight: "400", textColor: "rgba(255,255,255,0.75)", zIndex: 22 }),
        { type: "rect", label: "Divider", x: 8, y: 75.4, width: 84, height: 0.14, fill: "#4a7dff", fillOpacity: 55, zIndex: 20 },
        ...specs.map((s, i) =>
          tLayer({ label: s.l, text: `${s.v}\n${s.l}`, x: 8 + i * 28, y: 76.6, width: 28, height: 6.4, fontSize: 27, zIndex: 22 }),
        ),
        tLayer({ label: "Price", text: c.priceStr, x: 25, y: 86, width: 50, height: 4, fontSize: 44, fontWeight: "800", textColor: "#ffffff", fill: "#4a7dff", fillOpacity: 100, borderRadius: 14, fontFamily: "Oswald", zIndex: 22 }),
      ];
    },
  },

  // 4 ── MONTHLY DEAL — instalment-first, urgency (horizontal band)
  {
    id: "monthlyDeal",
    name: "Monthly Deal",
    tagline: "Instalment-first · urgency",
    preview: { bg: "#021a0d", accent: "#00c853", style: "big-number" },
    fonts: ["anton", "dm", "oswald"],
    theme: { accentColor: "#00c853", bgColor: "#021a0d", overlayOpacity: 0.5 },
    carZone: { x: 4, y: 24, w: 92, h: 33, hint: "Rear 3/4 angle · show the stance" },
    buildElements: (c) => {
      const monthlyTxt = c.monthlyStr ? `${c.monthlyStr}/BLN` : "RM XXX/BLN";
      const m = fitFont(monthlyTxt, 150, 960, "anton");
      const nameFit = fitFont(c.carName, 52, 950, "oswald");
      return [
        badge({ content: "LOW DEPOSIT · FAST LOAN", x: 64, y: 130, fontSize: 30, bgColor: "#00c853", color: "#02180c" }),
        el({ content: "DRIVE IT FROM", x: 68, y: 1180, fontSize: 34, fontWeight: "600", color: "rgba(255,255,255,0.7)", fontFamily: "'Oswald',sans-serif" }),
        el({ content: monthlyTxt, x: 60, y: 1232, fontSize: m.size, color: "#00c853", fontFamily: "'Anton',sans-serif", fontWeight: "400", strokeWidth: 2, strokeColor: "#01230f" }),
        el({ content: `Full price ${c.priceStr}`, x: 68, y: 1250 + m.size * 1.2, fontSize: 32, fontWeight: "400", color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans',sans-serif" }),
        el({ content: c.carName, x: 68, y: 1330 + m.size * 1.2, fontSize: nameFit.size, fontFamily: "'Oswald',sans-serif" }),
        badge({ content: "BULAN INI SAHAJA", x: 68, y: 1700, fontSize: 28, bgColor: "#ffffff", color: "#02180c" }),
      ];
    },
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
    carZone: { x: 8, y: 31, w: 84, h: 31, hint: "Side profile · clean background, golden hour" },
    buildElements: (c) => {
      const nameFit = fitFont(c.carName, 72, 830, "playfair");
      const dn = (c.dealerName || "PRIVATE COLLECTION").toUpperCase();
      const dnFit = fitFont(spaced(dn), 24, 860, "dm");
      return [
        el({ content: spaced(dn), x: centerX(dnFit.width), y: 190, fontSize: dnFit.size, fontWeight: "400", color: "rgba(255,255,255,0.55)", fontFamily: "'DM Sans',sans-serif" }),
        el({ content: c.carName, x: 130, y: 1330, fontSize: nameFit.size, fontFamily: "'Playfair Display',serif", fontWeight: "700" }),
        el({ content: "—", x: 130, y: 1345 + nameFit.size * 1.3, fontSize: 40, fontWeight: "400", color: "#c9a84c" }),
        el({ content: c.priceStr, x: 130, y: 1420 + nameFit.size * 1.3, fontSize: 52, fontWeight: "400", color: "#c9a84c", fontFamily: "'Playfair Display',serif" }),
        el({ content: "Viewing by appointment", x: 132, y: 1520 + nameFit.size * 1.3, fontSize: 28, fontWeight: "400", color: "rgba(255,255,255,0.55)", fontFamily: "'DM Sans',sans-serif", fontStyle: "italic" }),
      ];
    },
    buildLayers: () => [
      { type: "rect", label: "Gold frame", x: 4.5, y: 3.5, width: 91, height: 93, fill: "#000000", fillOpacity: 0, borderWidth: 2, borderColor: "#c9a84c", borderOpacity: 70, zIndex: 16, locked: false },
    ],
  },
];
