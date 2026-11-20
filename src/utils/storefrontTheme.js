// A dealer's own colours for their whole site (<sub>.drevo.my), STOREFRONT-2 stage 4.
// The owner chose FREE colour pickers (Background, Cards, Accent) over curated sets, so this
// file is the safety net: whatever three colours a dealer picks, the page stays readable.
//
// Saved as `theme: { bg, card, accent }` on the same `profiles.storefront_layout` jsonb as the
// layout and the font (storefrontLayout.js toSaved). Each key is optional and a 6-digit hex.
// The live DB check (`storefront_layout_ok`) reads only v + sections, so no migration.
// Nothing saved = no theme = the page draws exactly as before: every colour on the dealer site
// is written `var(--sf-x, <the old value>)`, and the variables below are set ONLY when a theme
// exists (themeCss returns "" otherwise).
//
// What is worked out, never picked (so a pick cannot make the site unreadable):
//   text   black or white family, from the background's lightness; >= 4.5:1 on bg, bg2, card
//   muted  softer text, still >= 4.5:1 on every surface (the brief asked >= 3; body copy uses it)
//   card   nudged until text reads on it AND it stays visibly apart from the background
//   accent darkened until white text on it reads (>= 4.5:1), and moved off the background
//          when the two are too close (a red button on a red page)
//   accentText  the accent as a readable word on the page (eyebrows), >= 4.5:1
// `adjusted` says which picks were changed, so the editor can tell the dealer.
// Pure functions, no DOM. `npm run test:storefronttheme`.
import { accentTheme, hexToRgb } from "./liveAccent.js";

export const THEME_KEYS = ["bg", "card", "accent"];
export const DEFAULT_BG = "#0C0C0E";   // secA, the page ground today
export const DEFAULT_CARD = "#111113"; // glassCard / skeleton today
export const TEXT_MIN = 4.5;           // WCAG AA, normal text
export const CARD_STEP = 1.06;         // card vs background, so cards never melt into the page
export const ACCENT_STEP = 1.5;        // accent fill vs background, so a button keeps its shape

const LIGHT_TEXT = [240, 240, 240];    // #F0F0F0, today's heading colour
const DARK_TEXT = [17, 17, 20];        // #111114
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

// A valid 6-digit hex (with or without #) -> "#RRGGBB", else null. 3-digit and named colours
// are refused on purpose: the saved value must be one exact colour.
const cleanHex = (v) => (typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v.trim())
  ? `#${v.trim().replace("#", "").toUpperCase()}` : null);

// Saved/typed theme -> { bg?, card?, accent? } with only valid keys, or null for "no theme".
// A background equal to today's, or a card equal to today's on today's background, is the
// default and is not kept, so picking the old colours back = nothing saved.
export function cleanTheme(theme) {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) return null;
  const out = {};
  for (const k of THEME_KEYS) {
    const h = cleanHex(theme[k]);
    if (h) out[k] = h;
  }
  if (out.bg === DEFAULT_BG) delete out.bg;
  if (out.card === DEFAULT_CARD && !out.bg) delete out.card;
  return Object.keys(out).length ? out : null;
}

// The theme saved on a layout ({ v: 1, sections, font?, theme? }), or null.
export const themeOf = (saved) => (saved && typeof saved === "object" && saved.v === 1 ? cleanTheme(saved.theme) : null);

// Preview link part: "theme.<bg>.<card>.<accent>", "-" for an unset key. Read by draftTheme.
export function themeParam(theme) {
  const t = cleanTheme(theme);
  if (!t) return null;
  return `theme.${THEME_KEYS.map((k) => (t[k] ? t[k].slice(1).toLowerCase() : "-")).join(".")}`;
}
export function draftTheme(param) {
  if (typeof param !== "string" || !param || param.length > 400) return null;
  const part = param.split(",").find((p) => p.startsWith("theme."));
  if (!part) return null;
  const [, ...vals] = part.split(".");
  return cleanTheme(Object.fromEntries(THEME_KEYS.map((k, i) => [k, vals[i] && vals[i] !== "-" ? vals[i] : null])));
}

const okOn = (fg, surfaces, min) => surfaces.every((s) => contrast(fg, s) >= min);

// Step `from` toward `to` in small steps until test() passes; null if it never does.
function stepUntil(from, to, test, step = 0.02, max = 1) {
  for (let t = step; t <= max + 1e-9; t += step) {
    const c = mix(from, to, t);
    if (test(c)) return c;
  }
  return null;
}

// theme (cleaned or raw) + the accent to use when none is picked (the dealer's brand colour,
// shared.js accentOf) -> every colour of the page, as hex, plus what was adjusted. null = no theme.
export function resolveTheme(theme, fallbackAccent = "#DC2626") {
  const t = cleanTheme(theme);
  if (!t) return null;
  const bg = hexToRgb(t.bg || DEFAULT_BG);

  // Text: the family that contrasts more with the page, softened like today's #F0F0F0 when
  // that still reads, else pushed toward pure white/black (which always passes 4.58:1).
  const lightText = contrast(WHITE, bg) >= contrast(BLACK, bg); // true = a dark page
  const pure = lightText ? WHITE : BLACK;
  let text = lightText ? LIGHT_TEXT : DARK_TEXT;
  if (contrast(text, bg) < TEXT_MIN) text = stepUntil(text, pure, (c) => contrast(c, bg) >= TEXT_MIN) || pure;

  // The alternate section ground: a hair toward the text, or away from it if that would fail.
  const bg2 = [mix(bg, text, 0.025), mix(bg, lightText ? BLACK : WHITE, 0.025)].find((c) => contrast(text, c) >= TEXT_MIN) || bg;

  // Card: the pick, or worked out (dark page = a touch lighter, like today; light page = toward
  // white). Then: text must read on it, and it must stand apart from the page.
  const cardOk = (c) => contrast(text, c) >= TEXT_MIN && contrast(c, bg) >= CARD_STEP;
  const picked = t.card ? hexToRgb(t.card) : null;
  let card = picked || (lightText ? mix(bg, WHITE, 0.04) : mix(bg, WHITE, 0.7));
  if (!cardOk(card)) {
    // Toward the page first (fixes "text cannot read on the card"), then away from the page in
    // either direction, preferring the side the pick (or the derived card) was already on.
    const side = lum(card) >= lum(bg) ? WHITE : BLACK;
    const other = side === WHITE ? BLACK : WHITE;
    const towardBg = stepUntil(card, bg, (c) => contrast(text, c) >= TEXT_MIN, 0.05) || bg;
    card = cardOk(towardBg) ? towardBg
      : stepUntil(bg, side, cardOk, 0.01, 0.5) || stepUntil(bg, other, cardOk, 0.01, 0.5) || towardBg;
  }

  const surfaces = [bg, bg2, card];
  // Muted: today's 62% white over the page, moved toward the text until it reads everywhere.
  let muted = text;
  for (let s = 0.38; s > 0; s -= 0.02) {
    const m = mix(text, bg, s);
    if (okOn(m, surfaces, TEXT_MIN)) { muted = m; break; }
  }

  // Accent: the live presenter's helper (white text reads), then darker until white text reads
  // at 4.5:1 (buttons are 14px), then off the page when the two are too close.
  let accent = hexToRgb(accentTheme(t.accent || fallbackAccent).accent);
  if (contrast(WHITE, accent) < TEXT_MIN) accent = stepUntil(accent, BLACK, (c) => contrast(WHITE, c) >= TEXT_MIN) || BLACK;
  if (contrast(accent, bg) < ACCENT_STEP) {
    const okAcc = (c) => contrast(WHITE, c) >= TEXT_MIN && contrast(c, bg) >= ACCENT_STEP;
    accent = (lum(bg) >= 0.06 ? stepUntil(accent, BLACK, okAcc) : stepUntil(accent, WHITE, okAcc))
      || stepUntil(accent, BLACK, okAcc) || accent;
  }
  // The accent as a word on the page: moved toward the text until it reads on every surface.
  const accentText = okOn(accent, surfaces, TEXT_MIN) ? accent
    : stepUntil(accent, text, (c) => okOn(c, surfaces, TEXT_MIN), 0.04) || text;

  // WhatsApp green as a word (the outline WhatsApp button): moved toward the text until it reads.
  const green = [74, 222, 128]; // #4ADE80, today's
  const waText = okOn(green, surfaces, TEXT_MIN) ? green
    : stepUntil(green, text, (c) => okOn(c, surfaces, TEXT_MIN), 0.04) || text;

  // Error red as a word (form messages in the trade-in / loan pop-ups), same way.
  const red = [248, 113, 113]; // #F87171, today's
  const badText = okOn(red, surfaces, TEXT_MIN) ? red
    : stepUntil(red, text, (c) => okOn(c, surfaces, TEXT_MIN), 0.04) || text;

  const accentPick = t.accent ? t.accent : null;
  return {
    bg: toHex(bg), bg2: toHex(bg2), card: toHex(card), text: toHex(text), muted: toHex(muted),
    border: `rgba(${text.join(",")},${lightText ? 0.1 : 0.14})`,
    accent: toHex(accent), onAccent: "#FFFFFF", accentText: toHex(accentText), accentRgb: accent.join(","),
    accentHover: toHex(mix(accent, BLACK, 0.16)), waText: toHex(waText), badText: toHex(badText),
    dark: lightText,
    adjusted: {
      card: !!picked && toHex(card) !== t.card,
      accent: !!accentPick && toHex(accent) !== accentPick,
    },
  };
}

// The CSS variables, as an object (tests, the editor's swatches). An accent-only theme sets
// only the accent variables: the page's own surfaces (several greys and alphas today) stay
// exactly as they are rather than being replaced by four worked-out colours.
export function themeVars(theme, fallbackAccent) {
  const t = cleanTheme(theme);
  const r = resolveTheme(t, fallbackAccent);
  if (!r) return null;
  const accent = {
    "--sf-accent": r.accent, "--sf-theme-accent": r.accent, "--sf-on-accent": r.onAccent, "--sf-accent-text": r.accentText,
    "--sf-accent-rgb": r.accentRgb, "--sf-accent-hover": r.accentHover,
  };
  if (!t.bg && !t.card) return accent;
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
