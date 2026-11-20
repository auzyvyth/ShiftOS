// A dealer's site colours (<sub>.drevo.my), STOREFRONT-2 stage 4.
// Owner, 2026-11-20: TWO themes only, Dark and Light ("they won't know how to mix and match").
// Free background/card pickers were tried the same day and dropped: a red or blue page came out
// as one solid slab with no edges. Each theme is a fixed, designed palette; the dealer picks the
// theme and, optionally, ONE accent colour (buttons, lines), which is made readable here.
//
// Saved as `theme: { mode?: "light", accent?: "#RRGGBB" }` on the same `profiles.storefront_layout`
// jsonb as the layout and the font (storefrontLayout.js toSaved). Dark is the default and is not
// written. The live DB check (`storefront_layout_ok`) reads only v + sections, so no migration.
// Nothing saved = no theme = the page draws exactly as before: every colour on the dealer site
// is written `var(--sf-x, <the old value>)`, and the variables below are set ONLY when a theme
// exists (themeCss returns "" otherwise). Dark + an accent sets only the accent variables.
//
// Readability rules (tested, `npm run test:storefronttheme`):
//   text and muted text  >= 4.5:1 on the page, the alternate band and the cards
//   cards                stand apart from the page by a SOLID border (>= BORDER_STEP vs the card)
//   accent               darkened until white text on it reads (>= 4.5:1)
//   accent as a word     >= 4.5:1 on every surface
// Pure functions, no DOM.
import { accentTheme, hexToRgb } from "./liveAccent.js";

export const MODES = ["dark", "light"];
export const DEFAULT_MODE = "dark";
export const TEXT_MIN = 4.5;     // WCAG AA, normal text
export const BORDER_STEP = 1.25; // card border vs the card, so every card has a visible edge

// The Light theme: a soft grey page with white cards on a solid border (the dealer-site
// reference the owner shared, 2026-11-20). Fixed values, no picking.
export const LIGHT = {
  bg: "#F3F5F9",     // the page
  bg2: "#FFFFFF",    // alternate section band
  card: "#FFFFFF",
  border: "#D5DAE3", // solid, never a white-alpha line (that vanished on a light page)
  text: "#111827",
  muted: "#4B5563",
  waText: "#15803D", // WhatsApp green as a word
  badText: "#B91C1C", // error red as a word
};

// Today's dark surfaces (shared.js secA / secB, the card), for the accent-as-a-word check.
const DARK_SURFACES = ["#0C0C0E", "#0F0F11", "#111113"];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (rgb) => `#${rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const mix = (a, b, t) => a.map((c, i) => clamp(c + (b[i] - c) * t));
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const x = typeof a === "string" ? hexToRgb(a) : a;
  const y = typeof b === "string" ? hexToRgb(b) : b;
  const l1 = lum(x), l2 = lum(y);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// A valid 6-digit hex (with or without #) -> "#RRGGBB", else null.
const cleanHex = (v) => (typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v.trim())
  ? `#${v.trim().replace("#", "").toUpperCase()}` : null);

// Saved/typed theme -> { mode?: "light", accent? } or null for "no theme" (= today's dark site).
// An older save from the free pickers ({ bg, card, accent }, staging only) is read as Light
// when its background was light, else Dark; its card colour is dropped.
export function cleanTheme(theme) {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) return null;
  const out = {};
  let mode = MODES.includes(theme.mode) ? theme.mode : null;
  if (!mode) {
    const bg = cleanHex(theme.bg);
    if (bg && lum(hexToRgb(bg)) > 0.5) mode = "light";
  }
  if (mode === "light") out.mode = "light";
  const accent = cleanHex(theme.accent);
  if (accent) out.accent = accent;
  return Object.keys(out).length ? out : null;
}

export const modeOf = (theme) => cleanTheme(theme)?.mode || DEFAULT_MODE;

// The theme saved on a layout ({ v: 1, sections, font?, theme? }), or null.
export const themeOf = (saved) => (saved && typeof saved === "object" && saved.v === 1 ? cleanTheme(saved.theme) : null);

// Preview link part: "theme.<mode>.<accent|->". Read by draftTheme.
export function themeParam(theme) {
  const t = cleanTheme(theme);
  if (!t) return null;
  return `theme.${t.mode || DEFAULT_MODE}.${t.accent ? t.accent.slice(1).toLowerCase() : "-"}`;
}
export function draftTheme(param) {
  if (typeof param !== "string" || !param || param.length > 400) return null;
  const part = param.split(",").find((p) => p.startsWith("theme."));
  if (!part) return null;
  const [, mode, accent] = part.split(".");
  return cleanTheme({ mode, accent: accent && accent !== "-" ? accent : null });
}

// Step `from` toward `to` until test() passes; null if it never does.
function stepUntil(from, to, test, step = 0.02) {
  for (let t = step; t <= 1 + 1e-9; t += step) {
    const c = mix(from, to, t);
    if (test(c)) return c;
  }
  return null;
}

// theme + the accent to use when none is picked (the dealer's brand colour, shared.js accentOf)
// -> every colour of the page, as hex, plus whether the accent pick was adjusted. null = no theme.
export function resolveTheme(theme, fallbackAccent = "#DC2626") {
  const t = cleanTheme(theme);
  if (!t) return null;
  const light = t.mode === "light";

  // Accent: the live presenter's helper, then darker until white text on it reads at 4.5:1
  // (buttons are 14px). On the light page that also makes it readable as a word on white.
  let accent = hexToRgb(accentTheme(t.accent || fallbackAccent).accent);
  if (contrast(WHITE, accent) < TEXT_MIN) accent = stepUntil(accent, BLACK, (c) => contrast(WHITE, c) >= TEXT_MIN) || BLACK;

  const base = {
    accent: toHex(accent), onAccent: "#FFFFFF", accentRgb: accent.join(","),
    accentHover: toHex(mix(accent, BLACK, 0.16)), dark: !light, mode: light ? "light" : "dark",
    adjusted: { accent: !!t.accent && toHex(accent) !== t.accent },
  };
  // The accent as a word (eyebrows, prices): moved toward the theme's text until it reads on
  // every surface. Dark = today's surfaces, which stay untouched.
  const surfaces = (light ? [LIGHT.bg, LIGHT.bg2, LIGHT.card] : DARK_SURFACES).map(hexToRgb);
  const textRgb = light ? hexToRgb(LIGHT.text) : WHITE;
  const ok = (c) => surfaces.every((s) => contrast(c, s) >= TEXT_MIN);
  const accentText = toHex(ok(accent) ? accent : stepUntil(accent, textRgb, ok, 0.04) || textRgb);
  if (!light) return { ...base, accentText };
  return { ...base, ...LIGHT, accentText };
}

// The CSS variables, as an object (tests, the editor). Dark sets only the accent variables, so
// a dark site with a picked accent keeps today's surfaces exactly.
export function themeVars(theme, fallbackAccent) {
  const r = resolveTheme(theme, fallbackAccent);
  if (!r) return null;
  const accent = {
    "--sf-accent": r.accent, "--sf-theme-accent": r.accent, "--sf-on-accent": r.onAccent,
    "--sf-accent-rgb": r.accentRgb, "--sf-accent-hover": r.accentHover, "--sf-accent-text": r.accentText,
  };
  if (r.mode !== "light") return accent;
  return {
    "--sf-bg": r.bg, "--sf-bg2": r.bg2, "--sf-card": r.card, "--sf-border": r.border,
    "--sf-text": r.text, "--sf-muted": r.muted, "--sf-wa-text": r.waText, "--sf-bad": r.badText,
    // The car card price (marketplace crimson gradient) as one readable solid colour.
    "--sf-price": r.accentText, ...accent,
  };
}

// ... and as one style sheet for the page: the variables on :root (so pop-ups portalled to
// <body> read them too) and the page ground. "" = no theme = nothing written.
export function themeCss(theme, fallbackAccent) {
  const v = themeVars(theme, fallbackAccent);
  if (!v) return "";
  const vars = `:root{${Object.entries(v).map(([k, val]) => `${k}:${val}`).join(";")}}`;
  return v["--sf-bg"] ? `${vars}html body{background:${v["--sf-bg"]} !important;color:${v["--sf-text"]}}` : vars;
}
