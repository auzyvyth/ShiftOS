// The colours of a Premium seller's page (/s/:slug), PAGE-PRO, 2026-11-01.
// Owner: Lite and Premium pages looked the same, so Premium was "glowed up"
// (Lite unchanged). Then (same day): "let the user set the colours, a tasteful
// gradient". So the page wears a GRADIENT of two colours.
//
// Tasteful = curated. A free pick of two colours gives clashing pairs (green to
// pink), so the seller picks one of PAGE_GRADIENTS (neighbouring hues, close in
// lightness), or "Custom": they pick ONE colour and the partner is worked out
// from it (a small hue turn, a little deeper), which can never clash.
//
// Stored as ONE hex in profiles.brand_color (the gradient's first colour; a
// preset is found again by it). brand_color stays a plain hex because the TikTok
// Studio reads and writes the same column as the seller's brand colour.
//
// brand_color has a DATABASE DEFAULT of '#c9a84c' (gold) on every row and
// nothing on the seller side ever set it. So gold means "never chose" and reads
// as Drevo red; otherwise every Premium page would turn gold overnight.
// Both ends go through accentTheme (the Live presenter's helper), which darkens
// a colour until white text on it stays readable.
import { accentTheme, hexToRgb } from "./liveAccent.js";

export const PAGE_COLOR_DB_DEFAULT = "#c9a84c";
export const PAGE_COLOR_DEFAULT = "#DC2626"; // Drevo red

// [first, second, name]. First colours are unique: they are what is saved.
export const PAGE_GRADIENTS = [
  { from: "#DC2626", to: "#9F1239", name: "Drevo" },
  { from: "#E8590C", to: "#C2185B", name: "Sunset" },
  { from: "#B45309", to: "#7C2D12", name: "Bronze" },
  { from: "#15803D", to: "#0F766E", name: "Forest" },
  { from: "#0D9488", to: "#1E40AF", name: "Lagoon" },
  { from: "#2563EB", to: "#4338CA", name: "Ocean" },
  { from: "#7C3AED", to: "#BE185D", name: "Orchid" },
  { from: "#334155", to: "#0B1120", name: "Midnight" },
];
// Kept for older imports: the first colour of each gradient.
export const PAGE_COLOR_PRESETS = PAGE_GRADIENTS.map((g) => g.from);

// The colour the seller has CHOSEN, or null (never chose / not a real colour).
export function chosenPageColor(profile) {
  const c = String(profile?.brand_color || "").trim();
  if (!hexToRgb(c) || c.toLowerCase() === PAGE_COLOR_DB_DEFAULT) return null;
  return (c.startsWith("#") ? c : `#${c}`).toUpperCase();
}

export function findGradient(hex) {
  const h = String(hex || "").toUpperCase();
  return PAGE_GRADIENTS.find((g) => g.from === h) || null;
}

// RGB <-> HSL, enough to turn a hue.
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// A custom pick's partner: 28 degrees round the colour wheel, a little deeper.
// A grey stays grey (no hue to turn), it only deepens.
export function partnerColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return PAGE_GRADIENTS[0].to;
  const [h, s, l] = rgbToHsl(rgb);
  if (s < 0.12) return hslToHex([h, s, Math.max(0.06, l * 0.55)]);
  return hslToHex([(h + 332) % 360, Math.min(1, s * 1.05), Math.max(0.12, l * 0.8)]);
}

// The two ends of a pick: a preset's own pair, else the worked-out partner.
export function gradientFor(hex) {
  const g = findGradient(hex);
  return g ? { from: g.from, to: g.to } : { from: String(hex).toUpperCase(), to: partnerColor(hex) };
}

// Readable gradient for any pick: { accent, dark, rgb, css }.
// `accent` = first end, `dark` = second end (names kept from the one-colour
// version, which the page's CSS variables still use).
export function gradientTheme(hex) {
  const { from, to } = gradientFor(hexToRgb(hex) ? hex : PAGE_COLOR_DEFAULT);
  const a = accentTheme(from);
  const b = accentTheme(to);
  return { accent: a.accent, dark: b.accent, rgb: a.rgb, css: `linear-gradient(120deg, ${a.accent}, ${b.accent})` };
}

// The theme for the page, or null for a basic (Lite) page, which keeps the
// standard look.
export function pageAccent(profile) {
  if (!profile || profile.page_basic) return null;
  return gradientTheme(chosenPageColor(profile) || PAGE_COLOR_DEFAULT);
}
