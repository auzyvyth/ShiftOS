// A dealer's own choice of how their site (<sub>.drevo.my) is laid out: which sections show,
// in what order, and which version of each (STOREFRONT-2 stage 2, docs/STOREFRONT_PLAN.md).
// ONE set of rules for the page (HomePage.jsx), the editor (dashboard Storefront > Layout),
// the header/footer links and the database check (`storefront_layout_ok` in migration
// 20261120a, `npm run test:storefrontlayout` checks both list the same sections).
//
// Saved on `profiles.storefront_layout` as { v: 1, sections: [{ id, on, variant }] }.
// Whatever is saved, `cleanLayout` turns it into a complete, valid layout, so a bad or old
// saved value can never break the page: unknown ids are dropped, missing ones come back
// in their usual place, the top banner stays first and Get in touch stays last.
// Plain data, no imports.

export const LAYOUT_VERSION = 1;
export const VARIANTS = ["a", "b", "c"]; // the plan's hard cap: 3 versions per section

// Default order = the page as it was before layouts existed.
// pin: "first" / "last" = cannot move. locked = always on (the page needs it to sell).
// shows: when the section appears at all, whatever the layout says (the editor says so).
export const SECTIONS = [
  { id: "hero", label: "Top banner", pin: "first", locked: true, shows: "Always" },
  { id: "strip", label: "Stock count and quick buttons", shows: "Always" },
  { id: "video", label: "Your video", shows: "When a video is switched on in Settings" },
  { id: "hot_deals", label: "Hot deals", shows: "When a car is priced at least 3% under its original price" },
  { id: "cars", label: "Your cars", locked: true, shows: "Always" },
  { id: "about", label: "About us", shows: "When you wrote About text in Settings" },
  { id: "reviews", label: "Buyer reviews", shows: "Always (asks buyers to leave the first one)" },
  { id: "why", label: "Why choose us", shows: "When you wrote at least one reason in Settings" },
  { id: "stats", label: "By the numbers", shows: "When at least one number is above zero" },
  { id: "how", label: "How it works", shows: "When you wrote at least one step in Settings" },
  { id: "testimonials", label: "Testimonials", shows: "When you typed a testimonial in Settings" },
  { id: "calculator", label: "Loan calculator link", shows: "Always" },
  { id: "contact", label: "Get in touch", pin: "last", locked: true, shows: "Always" },
];

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
export const toSaved = (layout) => ({
  v: LAYOUT_VERSION,
  sections: cleanLayout({ v: LAYOUT_VERSION, sections: layout }).map(({ id, on, variant }) => ({ id, on, variant })),
});

export const isDefaultLayout = (layout) =>
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
export const draftParam = (layout) =>
  layout.map((r) => `${r.on ? "" : "-"}${r.id}.${r.variant}`).join(",");

export function fromDraftParam(param, available) {
  if (typeof param !== "string" || !param || param.length > 400) return null;
  const sections = param.split(",").map((part) => {
    const off = part.startsWith("-");
    const [id, variant] = (off ? part.slice(1) : part).split(".");
    return { id, variant, on: !off };
  });
  return cleanLayout({ v: LAYOUT_VERSION, sections }, available);
}
