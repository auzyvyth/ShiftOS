// Style constants shared by the dealer site sections (STOREFRONT-2 stage 1, moved out of
// HomePage.jsx unchanged). Plain data, no React.
import { chosenPageColor, PAGE_COLOR_DEFAULT } from "../../../utils/pageAccent";
import { accentTheme } from "../../../utils/liveAccent";

// The ONE accent of a section's versions B and C (STOREFRONT-2 stage 4): the dealer's brand
// colour (Settings), or Drevo red when they never chose one (the database default gold
// means "never chose", pageAccent.js). Darkened until white text on it reads (accentTheme),
// so versions use it as a FILL or a line with white on top, never as text on the dark page
// (a dark brand colour would vanish there). Set as --sf-accent on the section.
// A whole-site colour theme (storefrontTheme.js) wins: HomePage sets --sf-theme-accent only
// when the dealer picked colours, so with no theme this is the brand colour as before.
export const accentOf = (tenant) => `var(--sf-theme-accent, ${accentTheme(chosenPageColor(tenant) || PAGE_COLOR_DEFAULT).accent})`;

// One colour of the dealer's theme, written so that NO theme = the exact old value:
// sv("text", "#F0F0F0") -> "var(--sf-text, #F0F0F0)". The variables are set on :root by
// HomePage (storefrontTheme.js themeCss) only when the dealer picked colours.
// Names: bg, bg2, card, border, text, muted, accent, on-accent, accent-text, accent-hover,
// wa-text. sa(alpha, "220,38,38") = the accent at an alpha, old rgb as the fallback.
export const sv = (name, old) => `var(--sf-${name}, ${old})`;
export const sa = (alpha, oldRgb) => `rgba(var(--sf-accent-rgb, ${oldRgb}), ${alpha})`;

export const wrap = { maxWidth: "1280px", margin: "0 auto", padding: "0 20px" };
export const secA = { background: sv("bg", "#0C0C0E") };
export const secB = { background: sv("bg2", "#0F0F11") };
export const secLight = {
  background: sv("bg2", "#0F0F11"),
  borderTop: `1px solid ${sv("border", "rgba(255,255,255,0.05)")}`,
  borderBottom: `1px solid ${sv("border", "rgba(255,255,255,0.05)")}`,
};

export const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: sv("accent", "#DC2626"),
  border: `1px solid ${sv("accent", "#DC2626")}`,
  color: sv("on-accent", "white"),
  fontWeight: "600",
  fontSize: "14px",
  padding: "13px 28px",
  borderRadius: "4px",
  textDecoration: "none",
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: "0.02em",
  transition: "all 0.2s ease",
  position: "relative",
  overflow: "hidden",
};
export const waBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "transparent",
  border: "1px solid rgba(37,211,102,0.3)",
  color: sv("wa-text", "#4ade80"),
  fontWeight: "600",
  fontSize: "14px",
  padding: "13px 28px",
  borderRadius: "4px",
  textDecoration: "none",
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: "0.02em",
  transition: "all 0.25s ease",
};
export const glassCard = {
  background: sv("card", "#111113"),
  border: `1px solid ${sv("border", "rgba(255,255,255,0.07)")}`,
  borderRadius: "6px",
};

// Dark-surface theme tokens for ReviewsSection on the dealer storefront.
export const DARK_REVIEW_TH = {
  text: sv("text", "#e8edf5"), textSec: sv("muted", "rgba(255,255,255,0.62)"), textMuted: sv("muted", "rgba(255,255,255,0.42)"),
  border: sv("border", "rgba(255,255,255,0.08)"), borderSec: sv("border", "rgba(255,255,255,0.05)"),
  card: sv("card", "rgba(255,255,255,0.03)"), inputBg: sv("card", "rgba(255,255,255,0.05)"),
};

export const BODY_TYPES = ["Sedan", "SUV", "Hatchback", "MPV", "Pickup", "Coupe"];
