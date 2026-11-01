// The colour of a Premium seller's page (/s/:slug), PAGE-PRO, 2026-11-01.
// Owner: Lite and Premium pages looked the same, so Premium was "glowed up"
// (Lite unchanged). The seller picks the colour in Premium Settings; it lives in
// profiles.brand_color, which get_salesman_by_slug already returns.
//
// brand_color has a DATABASE DEFAULT of '#c9a84c' (gold) on every row, buyers
// and staff included, and nothing on the seller side ever set it. So gold means
// "never chose" and reads as Drevo red; otherwise every Premium page would turn
// gold overnight. accentTheme (the Live presenter's helper) darkens a pick until
// white text on it stays readable.
import { accentTheme, hexToRgb } from "./liveAccent.js";

export const PAGE_COLOR_DB_DEFAULT = "#c9a84c";
export const PAGE_COLOR_DEFAULT = "#DC2626"; // Drevo red
export const PAGE_COLOR_PRESETS = ["#DC2626", "#C2410C", "#15803D", "#0F766E", "#1D4ED8", "#7C3AED", "#DB2777", "#1F2937"];

// The colour the seller has CHOSEN, or null (never chose / not a real colour).
export function chosenPageColor(profile) {
  const c = String(profile?.brand_color || "").trim();
  if (!hexToRgb(c) || c.toLowerCase() === PAGE_COLOR_DB_DEFAULT) return null;
  return c.startsWith("#") ? c : `#${c}`;
}

// The theme for the page, or null for a basic (Lite) page, which keeps the
// standard look.
export function pageAccent(profile) {
  if (!profile || profile.page_basic) return null;
  return accentTheme(chosenPageColor(profile) || PAGE_COLOR_DEFAULT);
}
