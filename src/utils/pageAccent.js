// The colour of a Premium seller's page (/s/:slug).
// PAGE-PRO (2026-11-01) gave the page a curated two-colour gradient. PAGE-COLOR (owner, 2026-11-28):
// "a single colour palette so our premium user can freely choose their hex, and the page will follow,
// darker and lighter shades automatic, if dark then text will automatically be white, vice versa".
// So the seller picks ONE colour (any hex) and everything else is worked out here, in one place:
//   accent   their colour, exactly as picked (never darkened behind their back any more)
//   hover    a shade for hover (darker; LIGHTER when the colour is near-black, or it would not show)
//   press    a deeper shade for a pressed button
//   deep     a dark partner for the hero glow and banner (replaces the old worked-out gradient colour)
//   on       the text colour ON their colour: white when white reads (3:1, bold text), else near-black
//   text     their colour as TEXT on the white page, darkened until it reads (4.5:1)
//   inv      the colour to write on an `on`-coloured chip (a white tile on a red band, a black tile on yellow)
//
// Stored as ONE hex in profiles.brand_color. brand_color has a DATABASE DEFAULT of '#c9a84c' (gold) on
// every row, so gold means "never chose" and reads as Drevo red.
import { hexToRgb } from "./liveAccent.js";

export const PAGE_COLOR_DB_DEFAULT = "#c9a84c";
export const PAGE_COLOR_DEFAULT = "#DC2626"; // Drevo red

// Quick picks in Settings. Any other hex is just as valid: these are shortcuts, not a whitelist.
export const PAGE_COLOR_PRESETS = ["#DC2626", "#E8590C", "#CA8A04", "#15803D", "#0D9488", "#2563EB", "#7C3AED", "#DB2777", "#0F172A"];

const INK = [15, 17, 21];          // #0F1115, the page's near-black
const PAGE_BG = [233, 235, 239];   // #E9EBEF, the Premium page canvas (the harder of page + white card)
const ON_WHITE_MIN = 3;            // white text on the colour: WCAG AA for bold text (buttons are bold)
const TEXT_MIN = 4.5;              // the colour as text on the page: WCAG AA body text

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (rgb) => `#${rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const mix = (rgb, to, t) => rgb.map((c, i) => c + (to[i] - c) * t);
function lum(rgb) {
  const [r, g, b] = rgb.map((c) => { const s = clamp(c) / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// "#abc", "abc", "#AABBCC" -> "#AABBCC", anything else -> null. The hex box in Settings uses this.
export function cleanHex(v) {
  let s = String(v || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toUpperCase()}` : null;
}

// The colour the seller has CHOSEN, or null (never chose / not a real colour).
export function chosenPageColor(profile) {
  const c = String(profile?.brand_color || "").trim();
  if (!hexToRgb(c) || c.toLowerCase() === PAGE_COLOR_DB_DEFAULT) return null;
  return (c.startsWith("#") ? c : `#${c}`).toUpperCase();
}

// Every shade the page needs, from one hex. Junk in = Drevo red out.
export function pagePalette(hex) {
  const base = hexToRgb(cleanHex(hex)) || hexToRgb(PAGE_COLOR_DEFAULT);
  const white = [255, 255, 255];
  const lightText = contrast(base, white) >= ON_WHITE_MIN;
  const on = lightText ? white : INK;
  // A near-black colour cannot get visibly darker, so its hover/press go lighter instead.
  const nearBlack = lum(base) < 0.03;
  const shade = (t) => (nearBlack ? mix(base, white, t * 1.2) : mix(base, [0, 0, 0], t));
  let text = base;
  for (let i = 0; i < 40 && contrast(text, PAGE_BG) < TEXT_MIN; i++) text = mix(text, [0, 0, 0], 0.06);
  // On a white `on`, write the readable text shade; on a near-black `on`, the colour itself (it is light).
  const inv = lightText ? text : base;
  const rgb = base.map(clamp).join(",");
  return {
    accent: toHex(base),
    hover: toHex(shade(0.12)),
    press: toHex(shade(0.22)),
    deep: toHex(nearBlack ? mix(base, white, 0.18) : mix(base, [0, 0, 0], 0.45)),
    on: toHex(on),
    onRgb: on.join(","),
    text: toHex(text),
    inv: toHex(inv),
    rgb,
    lightText,
  };
}

// The page's CSS variables for the .ap root (SalesmanProfilePage). One place, so the page and
// the Settings preview can never disagree.
export function paletteVars(p) {
  return {
    "--ap-a": p.accent, "--ap-a2": p.deep, "--ap-b2": p.hover, "--ap-b3": p.press, "--ap-rgb": p.rgb,
    "--ap-on": p.on, "--ap-on-rgb": p.onRgb, "--ap-t": p.text, "--ap-inv": p.inv,
    "--ap-shadow": p.lightText ? "0 1px 2px rgba(0,0,0,.35), 0 0 14px rgba(0,0,0,.28)" : "none",
  };
}

// Kept for PagePreview (the upsell card): a banner in the colour, fading to its deep shade.
export function gradientTheme(hex) {
  const p = pagePalette(hex);
  return { ...p, dark: p.deep, btnDark: p.hover, css: `linear-gradient(120deg, ${p.accent}, ${p.deep})` };
}

// The palette for the page, or null for a basic (Lite) page, which keeps the standard look.
export function pageAccent(profile) {
  if (!profile || profile.page_basic) return null;
  return pagePalette(chosenPageColor(profile) || PAGE_COLOR_DEFAULT);
}
