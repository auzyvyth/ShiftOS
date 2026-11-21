// A dealer's own choice of how their site (<sub>.drevo.my) is laid out: which sections show,
// in what order, and which version of each (STOREFRONT-2 stage 2, docs/STOREFRONT_PLAN.md).
// ONE set of rules for the page (HomePage.jsx), the editor (dashboard Storefront > Layout),
// the header/footer links and the database check (`storefront_layout_ok` in migration
// 20261120a, `npm run test:storefrontlayout` checks both list the same sections).
//
// Saved on `profiles.storefront_layout` as { v: 1, sections: [{ id, on, variant }], font?, theme?,
// heroBg?, header? }. `font`, `theme` and the look options (OPTIONS below) are top-level keys,
// left out when they are the default (theme rules: storefrontTheme.js). The DB check reads only
// v + sections, so the extra keys needed no migration (checked against the live function 2026-11-20).
// Whatever is saved, `cleanLayout` turns it into a complete, valid layout, so a bad or old
// saved value can never break the page: unknown ids are dropped, missing ones come back
// in their usual place, the top banner stays first and Get in touch stays last.
// Plain data; the only import is the theme cleaner.
import { cleanTheme, themeParam } from "./storefrontTheme.js";

export const LAYOUT_VERSION = 1;
export const VARIANTS = ["a", "b", "c"]; // the plan's hard cap: 3 versions per section

// ── The database gate (stage 4 phase B) ─────────────────────────────────────
// The live `storefront_layout_ok` (migration 20261120a) REFUSES a section id it does not list,
// so a save holding "brands", "browse" or "sold" would fail until migration
// 20261121a_storefront_phase_b.sql (QUEUED, not applied) adds them and the recent-sales lookup.
// While this is false those three sections do not exist anywhere: not in SECTIONS, not in the
// editor, not saved, not drawn, and the page never calls get_dealer_recent_sales.
// FLIP TO true the night 20261121a is applied (after midnight, nobody live), in the same release.
export const DB_PHASE_B = false;
// Unit tests load a second copy of this file with the gate open (globalThis.__SF_PHASE_B_TEST);
// the app never sets it.
const PHASE_B_OPEN = DB_PHASE_B || globalThis.__SF_PHASE_B_TEST === true;
export const PHASE_B_IDS = ["brands", "browse", "sold"];

// ── The database gate (stage 4 phase C) ─────────────────────────────────────
// "Happy customers" (the dealer's handover photos) needs migration
// 20261121b_storefront_delivery_gallery.sql (QUEUED, not applied): the storefront_deliveries
// table, its upload folder rules, get_dealer_deliveries and the layout check learning
// "deliveries". 20261121b lists the phase B ids too, so phase C only opens once phase B is open.
// While closed: no section, nothing saved, no get_dealer_deliveries call, and the dashboard's
// Storefront > Delivery photos pill does not exist.
// FLIP TO true the night 20261121b is applied (with DB_PHASE_B), in the same release.
export const DB_PHASE_C = false;
const PHASE_C_OPEN = (DB_PHASE_C && PHASE_B_OPEN) || globalThis.__SF_PHASE_C_TEST === true;
export const PHASE_C_IDS = ["deliveries"];
// The dashboard asks this before showing the upload panel (same gate, one place).
export const DELIVERIES_OPEN = PHASE_C_OPEN;

// Default order = the page as it was before layouts existed (phase B sections slot in where
// a buyer would look for them: brands under the strip, the browse bar just above the cars,
// recently sold after the reviews; phase C: Happy customers right after Recently sold).
// pin: "first" / "last" = cannot move. locked = always on (the page needs it to sell).
// shows: when the section appears at all, whatever the layout says (the editor says so).
const ALL_SECTIONS = [
  { id: "hero", label: "Top banner", pin: "first", locked: true, shows: "Always" },
  { id: "strip", label: "Stock count and quick buttons", shows: "Always" },
  { id: "brands", label: "Brands you stock", shows: "When your cars for sale are of at least 2 brands" },
  { id: "video", label: "Your video", shows: "When a video is switched on in Settings" },
  { id: "hot_deals", label: "Hot deals", shows: "When a car is priced at least 3% under its original price" },
  { id: "browse", label: "Browse bar", shows: "When you have a car for sale (brand, model, price and body type picked from your cars)" },
  { id: "cars", label: "Your cars", locked: true, shows: "Always" },
  { id: "about", label: "About us", shows: "When you wrote About text in Settings" },
  { id: "reviews", label: "Buyer reviews", shows: "Always (asks buyers to leave the first one)" },
  { id: "sold", label: "Recently sold", shows: "When you sold a car in the last 12 months (car and month only, never the price or the buyer)" },
  { id: "deliveries", label: "Happy customers", shows: "When you added a delivery photo in Storefront > Delivery photos (car and month only, every photo with the buyer's consent)" },
  { id: "why", label: "Why choose us", shows: "When you wrote at least one reason in Settings" },
  { id: "stats", label: "By the numbers", shows: "When at least one number is above zero" },
  { id: "how", label: "How it works", shows: "When you wrote at least one step in Settings" },
  { id: "testimonials", label: "Testimonials", shows: "When you typed a testimonial in Settings" },
  { id: "calculator", label: "Loan calculator", shows: "Always" },
  { id: "contact", label: "Get in touch", pin: "last", locked: true, shows: "Always" },
];
const CLOSED_IDS = [...(PHASE_B_OPEN ? [] : PHASE_B_IDS), ...(PHASE_C_OPEN ? [] : PHASE_C_IDS)];
export const SECTIONS = ALL_SECTIONS.filter((s) => !CLOSED_IDS.includes(s.id));

const BY_ID = Object.fromEntries(SECTIONS.map((s, i) => [s.id, { ...s, index: i }]));
export const sectionInfo = (id) => BY_ID[id] || null;

export const defaultLayout = () => SECTIONS.map((s) => ({ id: s.id, on: true, variant: "a" }));

// available: { [id]: ["a", ...] } = the versions the page can draw today. A saved
// version that does not exist (yet, or any more) falls back to "a". Leave it out only
// where nothing is drawn (saving, comparing): then every valid letter is kept as chosen.
export function cleanLayout(saved, available) {
  const rows = saved && typeof saved === "object" && saved.v === LAYOUT_VERSION && Array.isArray(saved.sections)
    ? saved.sections
    : [];
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const info = r && typeof r === "object" ? BY_ID[r.id] : null;
    if (!info || seen.has(info.id)) continue;
    seen.add(info.id);
    // Without a list of what exists (saving, comparing), any valid letter is kept; the page
    // passes its real list, so a version it cannot draw falls back to "a" there.
    const can = available ? available[info.id] || ["a"] : VARIANTS;
    out.push({
      id: info.id,
      on: info.locked ? true : r.on !== false,
      variant: VARIANTS.includes(r.variant) && can.includes(r.variant) ? r.variant : "a",
    });
  }
  // A section the saved layout does not know (added after it was saved) goes back in
  // after the nearest section that comes before it in the default order.
  for (const s of SECTIONS) {
    if (seen.has(s.id)) continue;
    let at = 0;
    for (let i = BY_ID[s.id].index - 1; i >= 0; i--) {
      const k = out.findIndex((r) => r.id === SECTIONS[i].id);
      if (k !== -1) { at = k + 1; break; }
    }
    out.splice(at, 0, { id: s.id, on: true, variant: "a" });
  }
  const first = out.filter((r) => BY_ID[r.id].pin === "first");
  const last = out.filter((r) => BY_ID[r.id].pin === "last");
  return [...first, ...out.filter((r) => !BY_ID[r.id].pin), ...last];
}

// What gets saved. Always a full, cleaned list, so the database check sees one shape.
// look = { font, theme, ...OPTIONS } (stage 4); a default or unknown font, an empty theme and
// a default option are not saved.
export const toSaved = (layout, look = {}) => {
  const out = {
    v: LAYOUT_VERSION,
    sections: cleanLayout({ v: LAYOUT_VERSION, sections: layout }).map(({ id, on, variant }) => ({ id, on, variant })),
  };
  const font = validFont(look.font);
  if (font !== DEFAULT_FONT) out.font = font;
  const theme = cleanTheme(look.theme);
  if (theme) out.theme = theme;
  for (const k of OPTION_IDS) {
    const v = validOption(k, look[k]);
    if (v !== OPTIONS[k].def) out[k] = v;
  }
  return out;
};

export const isDefaultLayout = (layout, look = {}) =>
  validFont(look.font) === DEFAULT_FONT && !cleanTheme(look.theme) &&
  OPTION_IDS.every((k) => validOption(k, look[k]) === OPTIONS[k].def) &&
  JSON.stringify(cleanLayout({ v: LAYOUT_VERSION, sections: layout })) === JSON.stringify(defaultLayout());

export const sectionOn = (savedOrLayout, id) => {
  const layout = Array.isArray(savedOrLayout) ? savedOrLayout : cleanLayout(savedOrLayout);
  return !!layout.find((r) => r.id === id)?.on;
};

// Move a section up (-1) or down (+1). Pinned sections never move and nothing passes them.
export function moveSection(layout, id, dir) {
  const i = layout.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layout.length) return layout;
  if (BY_ID[layout[i].id].pin || BY_ID[layout[j].id].pin) return layout;
  const next = layout.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const toggleSection = (layout, id) =>
  layout.map((r) => (r.id === id && !BY_ID[id]?.locked ? { ...r, on: !r.on } : r));

// Pick a version for one section. Only a version the page can draw (available) is taken;
// anything else leaves the layout as it was.
export const setVariant = (layout, id, variant, available) =>
  VARIANTS.includes(variant) && (available?.[id] || ["a"]).includes(variant)
    ? layout.map((r) => (r.id === id ? { ...r, variant } : r))
    : layout;

// The "See it on my site" link carries an unsaved layout as one short, readable value:
// "hero.a,strip.a,-video.a,..." (a leading "-" = off). Read back through cleanLayout, so a
// hand-made link can only reorder or hide the dealer's own sections, never add anything,
// and never hide the cars or the contact section.
// A picked font rides along as one more part, "font.<id>" (no section is called "font", so
// cleanLayout drops it and draftFont reads it). Colours the same way: "theme.<bg>.<card>.<accent>"
// (storefrontTheme.js themeParam / draftTheme). A look option: "opt.<key>.<value>" (draftOptions).
export const draftParam = (layout, look = {}) => {
  const parts = layout.map((r) => `${r.on ? "" : "-"}${r.id}.${r.variant}`);
  const font = validFont(look.font);
  if (font !== DEFAULT_FONT) parts.push(`font.${font}`);
  const theme = themeParam(look.theme);
  if (theme) parts.push(theme);
  for (const k of OPTION_IDS) {
    const v = validOption(k, look[k]);
    if (v !== OPTIONS[k].def) parts.push(`opt.${k}.${v}`);
  }
  return parts.join(",");
};

export function fromDraftParam(param, available) {
  if (typeof param !== "string" || !param || param.length > 400) return null;
  const sections = param.split(",").map((part) => {
    const off = part.startsWith("-");
    const [id, variant] = (off ? part.slice(1) : part).split(".");
    return { id, variant, on: !off };
  });
  return cleanLayout({ v: LAYOUT_VERSION, sections }, available);
}

export function draftFont(param) {
  if (typeof param !== "string" || !param || param.length > 400) return DEFAULT_FONT;
  const part = param.split(",").find((p) => p.startsWith("font."));
  return validFont(part ? part.slice(5) : null);
}

// ── Fonts (stage 4) ──────────────────────────────────────────────────────────
// Four curated heading fonts. The body text stays Outfit in all four, so walking from the
// dealer's home page into /cars or a car (which do not read the layout) never changes the
// typeface of what a buyer reads; only the home page's headings change. The page sets these
// as CSS variables (fontCss); every heading falls back to the Modern values, so Modern
// writes nothing and the page is exactly as before. `sheet` = the Google Fonts family to
// load, only for the dealer who picked it (Outfit and Bebas Neue already load on every page).
export const DEFAULT_FONT = "modern";
export const FONTS = {
  modern: { name: "Modern", note: "Clean, rounded headings (Outfit, the usual look).",
    head: "'Outfit', sans-serif", weight: 700, track: "-0.025em" },
  bold: { name: "Bold", note: "Tall capital-letter headings (Bebas Neue).",
    head: "'Bebas Neue', sans-serif", weight: 400, upper: true, track: "0.02em", scale: 1.3 },
  classic: { name: "Classic", note: "Serif headings, like a printed brochure (Playfair Display).",
    head: "'Playfair Display', serif", weight: 700, track: "-0.01em", sheet: "Playfair+Display:wght@600;700" },
  sharp: { name: "Sharp", note: "Squared, technical headings (Space Grotesk).",
    head: "'Space Grotesk', sans-serif", weight: 700, track: "-0.03em", sheet: "Space+Grotesk:wght@500;700" },
};
export const FONT_IDS = Object.keys(FONTS);
const validFont = (id) => (typeof id === "string" && Object.hasOwn(FONTS, id) ? id : DEFAULT_FONT);

// The saved font, or the default for nothing saved / junk / a font that no longer exists.
export const cleanFont = (saved) =>
  validFont(saved && typeof saved === "object" && saved.v === LAYOUT_VERSION ? saved.font : null);

// The CSS variables for a font, "" for the default (the fallbacks in the page's CSS).
export function fontCss(id) {
  const font = validFont(id);
  if (font === DEFAULT_FONT) return "";
  const f = FONTS[font];
  return `:root{--sf-font-head:${f.head};--sf-head-weight:${f.weight};--sf-head-case:${f.upper ? "uppercase" : "none"};` +
    `--sf-head-track:${f.track};--sf-head-scale:${f.scale || 1}}`;
}

// The stylesheet to load for a font, or null when it is already on every page.
export const fontSheet = (id) => {
  const sheet = FONTS[validFont(id)].sheet;
  return sheet ? `https://fonts.googleapis.com/css2?family=${sheet}&display=swap` : null;
};

// ── Look options (stage 4, phase A) ──────────────────────────────────────────
// Small switches beside the sections, each a top-level key on the saved layout, each with a
// fixed list of values and a default that is never written (so an untouched site saves nothing
// new and draws exactly as before). A new option = one line here + its reader; cleaning,
// saving, comparing and the preview link follow by themselves.
//   heroBg: what fills top banner C "Full screen": "cars" = a wall of the dealer's newest cars
//           (the old "Showroom wall", so a saved C keeps its look), "photo" = one full-width photo.
//   header: "classic" = the usual bar; "showroom" = a thin info bar on top (address, hours,
//           phone, socials) and Browse Cars as the one filled accent item (Header.jsx). Every
//           page of the dealer's site reads it, so the header is the same on /cars.
export const OPTIONS = {
  heroBg: { values: ["cars", "photo"], def: "cars" },
  header: { values: ["classic", "showroom"], def: "classic" },
};
export const OPTION_IDS = Object.keys(OPTIONS);
const validOption = (k, v) => (OPTIONS[k].values.includes(v) ? v : OPTIONS[k].def);
export const defaultOptions = () => Object.fromEntries(OPTION_IDS.map((k) => [k, OPTIONS[k].def]));

// The saved options, every key present, junk and unknown values back to the default.
export function cleanOptions(saved) {
  const ok = saved && typeof saved === "object" && saved.v === LAYOUT_VERSION;
  return Object.fromEntries(OPTION_IDS.map((k) => [k, validOption(k, ok ? saved[k] : null)]));
}

// The options carried by a preview link ("opt.<key>.<value>" parts), every key present.
export function draftOptions(param) {
  const out = defaultOptions();
  if (typeof param !== "string" || !param || param.length > 400) return out;
  for (const part of param.split(",")) {
    const [tag, k, v] = part.split(".");
    if (tag === "opt" && Object.hasOwn(OPTIONS, k)) out[k] = validOption(k, v);
  }
  return out;
}

// ── Presets and Shuffle (stage 4) ────────────────────────────────────────────
// A preset is a named look: a fixed version for each section that has versions, a font, the
// look options (OPTIONS) and, optionally, a theme mode. Picking one changes only those; the
// dealer's order, on/off and accent colour stay. Sections a preset does not name go back to
// "a", options it does not name go back to their default. A preset WITHOUT a `mode` leaves the
// dealer's Dark/Light pick alone (the four older looks work on either theme); one WITH a mode
// sets it. Not saved by name: the editor works out which preset (if any) the current choice
// matches (presetOf), so it can never go stale.
export const PRESETS = [
  { id: "original", name: "Original", note: "The usual Drevo dealer site.", font: "modern",
    variants: {} },
  { id: "showroom", name: "Showroom", note: "A wall of your cars up top, bold capital headings.", font: "bold",
    variants: { hero: "c", about: "b", reviews: "c", why: "c", stats: "b", how: "c" } },
  { id: "boutique", name: "Boutique", note: "Your slides, then your newest car shown large; serif headings.", font: "classic",
    variants: { hero: "a", cars: "c", about: "c", reviews: "c", why: "b", stats: "b", how: "b" } },
  { id: "quick", name: "Quick browse", note: "Search first and a swipe row of cars: a short page.", font: "sharp",
    variants: { hero: "b", cars: "b", about: "c", reviews: "b", why: "c", stats: "c", how: "c" } },
  // Phase A (owner's reference, 2026-11-20): light grey page, white cards, dark bands, a
  // full-screen photo up top under the info-bar header.
  { id: "showroom_light", name: "Showroom Light", note: "Light page, info bar on top, one big photo, the calculator on the page.",
    font: "modern", mode: "light", options: { header: "showroom", heroBg: "photo" },
    variants: { hero: "c", about: "b", reviews: "c", stats: "b", how: "c", calculator: "b" } },
];
const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

const canDraw = (available, id, v) => VARIANTS.includes(v) && (available?.[id] || ["a"]).includes(v);

// -> { layout, font, options, mode }. mode = "dark" | "light", or null = leave the theme as is.
// An unknown preset leaves layout and font as they were (options null, mode null).
export function applyPreset(layout, presetId, available, font = DEFAULT_FONT) {
  const p = Object.hasOwn(PRESET_BY_ID, presetId) ? PRESET_BY_ID[presetId] : null;
  if (!p) return { layout, font: validFont(font), options: null, mode: null };
  const opts = defaultOptions();
  for (const k of OPTION_IDS) opts[k] = validOption(k, p.options?.[k]);
  return {
    layout: layout.map((r) => {
      const want = p.variants[r.id] || "a";
      return { ...r, variant: canDraw(available, r.id, want) ? want : "a" };
    }),
    font: p.font,
    options: opts,
    mode: p.mode || null,
  };
}

// The preset the current choice matches exactly, or null (a mix of the dealer's own).
// look = { options, mode }: the current look options (default when left out) and theme mode
// ("dark" when left out). A preset with no mode matches on either theme.
export function presetOf(layout, font, available, look = {}) {
  const f = validFont(font);
  const opts = { ...defaultOptions(), ...(look.options || {}) };
  const mode = look.mode || "dark";
  for (const p of PRESETS) {
    const { layout: l, font: pf, options: po } = applyPreset(layout, p.id, available);
    if (pf === f && l.every((r, i) => r.variant === layout[i].variant) &&
      OPTION_IDS.every((k) => po[k] === validOption(k, opts[k])) && (!p.mode || p.mode === mode)) return p.id;
  }
  return null;
}

// Shuffle: a random version of every section that has more than one, and a random font.
// Order and on/off stay. Always returns a look different from the one passed in (when any
// choice exists). rand is injectable for tests.
export function shuffleLook(layout, font, available, rand = Math.random) {
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const from = validFont(font);
  const same = (l, f) => f === from && l.every((r, i) => r.variant === layout[i].variant);
  let out = { layout, font: from };
  for (let tries = 0; tries < 8 && same(out.layout, out.font); tries++) {
    out = {
      layout: layout.map((r) => {
        const can = (available?.[r.id] || ["a"]).filter((v) => VARIANTS.includes(v));
        return can.length > 1 ? { ...r, variant: pick(can) } : r;
      }),
      font: pick(FONT_IDS),
    };
  }
  // Eight unlucky draws in a row: move to the next font so the tap always changes something.
  if (same(out.layout, out.font)) out.font = FONT_IDS[(FONT_IDS.indexOf(from) + 1) % FONT_IDS.length];
  return out;
}
