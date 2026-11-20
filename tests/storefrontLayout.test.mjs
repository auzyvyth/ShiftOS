import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SECTIONS, VARIANTS, defaultLayout, cleanLayout, toSaved, isDefaultLayout, sectionOn,
  moveSection, toggleSection, draftParam, fromDraftParam, setVariant,
  DEFAULT_FONT, FONTS, FONT_IDS, cleanFont, fontCss, fontSheet, draftFont,
  PRESETS, applyPreset, presetOf, shuffleLook,
  OPTIONS, OPTION_IDS, defaultOptions, cleanOptions, draftOptions,
} from "../src/utils/storefrontLayout.js";
import { AVAILABLE_VERSIONS, VERSION_INFO, VERSION_OPTIONS } from "../src/components/storefront/sections/versions.js";

const ids = (l) => l.map((r) => r.id);
const DEFAULT = ids(defaultLayout());

// Nothing saved, junk, or an old version = the page as it always was.
for (const bad of [undefined, null, "x", 5, [], {}, { v: 2, sections: [] }, { v: 1, sections: "no" }]) {
  assert.deepEqual(cleanLayout(bad), defaultLayout(), `junk ${JSON.stringify(bad)}`);
}

// A saved order is kept; unknown ids and repeats dropped; missing ones come back in place.
const saved = { v: 1, sections: [
  { id: "hero", on: true, variant: "a" }, { id: "cars", on: true, variant: "a" }, { id: "evil", on: true, variant: "a" },
  { id: "strip", on: false, variant: "a" }, { id: "cars", on: false, variant: "a" }, { id: "contact", on: true, variant: "a" },
] };
const c = cleanLayout(saved);
assert.equal(c.length, SECTIONS.length, "always every section");
assert.deepEqual(ids(c).filter((id) => ["hero", "cars", "strip", "contact"].includes(id)), ["hero", "cars", "strip", "contact"], "dealer order kept");
assert.equal(ids(c).indexOf("about"), ids(c).indexOf("cars") + 1, "a missing section returns after its nearest default neighbour that is present");
assert.equal(c.find((r) => r.id === "strip").on, false, "off kept");
assert.equal(c.find((r) => r.id === "cars").on, true, "cars can never be switched off");
assert.equal(ids(c).indexOf("video"), ids(c).indexOf("strip") + 1, "a missing section returns after its default neighbour");

// Pins: the banner first and Get in touch last, whatever was saved.
const flipped = cleanLayout({ v: 1, sections: [{ id: "contact", on: false }, { id: "about", on: true }, { id: "hero", on: false }] });
assert.equal(flipped[0].id, "hero");
assert.equal(flipped.at(-1).id, "contact");
assert.ok(flipped[0].on && flipped.at(-1).on, "locked sections stay on");

// Versions: only ones the page can draw; anything else falls back to "a".
assert.equal(cleanLayout({ v: 1, sections: [{ id: "about", on: true, variant: "b" }] }, { about: ["a"] }).find((r) => r.id === "about").variant, "a");
assert.equal(cleanLayout({ v: 1, sections: [{ id: "about", on: true, variant: "b" }] }).find((r) => r.id === "about").variant, "b", "no list = keep the chosen letter (saving)");
assert.equal(cleanLayout({ v: 1, sections: [{ id: "about", on: true, variant: "b" }] }, { about: ["a", "b"] }).find((r) => r.id === "about").variant, "b");
assert.equal(cleanLayout({ v: 1, sections: [{ id: "about", on: true, variant: "q" }] }, { about: ["a", "q"] }).find((r) => r.id === "about").variant, "a", "never past the 3-version cap");

// Moving: pinned sections never move and nothing jumps over them.
let l = defaultLayout();
assert.deepEqual(moveSection(l, "hero", 1), l);
assert.deepEqual(moveSection(l, "strip", -1), l, "nothing passes the banner");
assert.deepEqual(moveSection(l, "calculator", 1), l, "nothing passes Get in touch");
l = moveSection(l, "about", -1);
assert.equal(ids(l).indexOf("about"), DEFAULT.indexOf("about") - 1);
assert.deepEqual(toggleSection(defaultLayout(), "cars"), defaultLayout(), "cars cannot be toggled");
assert.equal(sectionOn(toggleSection(defaultLayout(), "how"), "how"), false);
assert.equal(sectionOn(null, "how"), true, "nothing saved = shown");

// Versions: only one the page can draw is taken.
const av = { hero: ["a", "b", "c"], cars: ["a", "b", "c"] };
const withB = setVariant(defaultLayout(), "hero", "b", av);
assert.equal(withB.find((r) => r.id === "hero").variant, "b");
assert.deepEqual(setVariant(defaultLayout(), "about", "b", av), defaultLayout(), "about has no version b");
assert.deepEqual(setVariant(defaultLayout(), "hero", "z", av), defaultLayout(), "unknown letter ignored");
assert.equal(fromDraftParam(draftParam(withB), av).find((r) => r.id === "hero").variant, "b", "preview link carries the version");
assert.equal(cleanLayout(toSaved(withB), av).find((r) => r.id === "hero").variant, "b", "saved version survives the cleaner");
assert.ok(!isDefaultLayout(withB), "a version change is not the default layout");

// Saved shape + default check.
const s = toSaved(l);
assert.equal(s.v, 1);
assert.equal(s.sections.length, SECTIONS.length);
assert.ok(isDefaultLayout(defaultLayout()));
assert.ok(!isDefaultLayout(l));

// The preview link: round trip, and a hand-made link can only hide/reorder, never add.
const off = toggleSection(l, "stats");
assert.deepEqual(fromDraftParam(draftParam(off)), off);
const hacked = fromDraftParam("-contact.a,-cars.a,<script>.a,why.z");
assert.equal(hacked.length, SECTIONS.length);
assert.ok(sectionOn(hacked, "cars") && sectionOn(hacked, "contact"), "a link cannot hide the cars or contact");
assert.equal(fromDraftParam("x".repeat(500)), null, "long junk ignored");
assert.equal(fromDraftParam(""), null);

// ── Stage 4: fonts ──
assert.equal(FONT_IDS.length, 4, "four curated fonts");
assert.equal(cleanFont(null), DEFAULT_FONT);
assert.equal(cleanFont({ v: 1, sections: [], font: "classic" }), "classic");
for (const bad of ["comic", "constructor", "__proto__", 5, null]) assert.equal(cleanFont({ v: 1, sections: [], font: bad }), DEFAULT_FONT, `junk font ${bad}`);
assert.equal(cleanFont({ v: 2, font: "bold" }), DEFAULT_FONT, "old/other version ignored");
assert.equal(fontCss(DEFAULT_FONT), "", "the default writes nothing: the page is exactly as before");
assert.equal(fontCss("nope"), "");
for (const id of FONT_IDS.filter((x) => x !== DEFAULT_FONT)) {
  assert.match(fontCss(id), /^:root\{--sf-font-head:[^;{}<>]+;/, `${id} css`);
  assert.ok(!/system-ui/.test(FONTS[id].head), "no hardcoded system-ui");
}
assert.equal(fontSheet("modern"), null, "Outfit already loads");
assert.equal(fontSheet("bold"), null, "Bebas Neue already loads");
assert.match(fontSheet("classic"), /^https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair/);
// Saved: the font rides along, the default is not written; extra key never breaks the cleaner.
assert.equal(toSaved(defaultLayout(), { font: "bold" }).font, "bold");
assert.ok(!("font" in toSaved(defaultLayout(), { font: DEFAULT_FONT })), "default font not saved");
assert.ok(!("font" in toSaved(defaultLayout(), { font: "junk" })));
assert.ok(!("font" in toSaved(defaultLayout())), "no look = as before");
assert.ok(!isDefaultLayout(defaultLayout(), { font: "classic" }), "a font change is not the default");
assert.ok(isDefaultLayout(defaultLayout(), { font: DEFAULT_FONT }));
assert.deepEqual(cleanLayout(toSaved(defaultLayout(), { font: "bold" })), defaultLayout(), "sections unaffected by the font key");
// Preview link carries the font; the old link format still reads.
const fp = draftParam(defaultLayout(), { font: "sharp" });
assert.equal(draftFont(fp), "sharp");
assert.deepEqual(fromDraftParam(fp), defaultLayout(), "the font part is not a section");
assert.equal(draftFont(draftParam(defaultLayout())), DEFAULT_FONT);
assert.equal(draftFont("hero.a,font.evil"), DEFAULT_FONT);

// ── Stage 4 phase A: look options (top-level keys, defaults never saved) ──
assert.deepEqual(cleanOptions(null), defaultOptions(), "nothing saved = defaults");
assert.equal(defaultOptions().heroBg, "cars", "banner C defaults to the cars wall, so a saved C keeps its look");
assert.equal(defaultOptions().header, "classic", "the usual header unless picked");
assert.equal(cleanOptions({ v: 1, sections: [], header: "showroom" }).header, "showroom");
assert.equal(cleanOptions({ v: 1, sections: [], heroBg: "photo" }).heroBg, "photo");
for (const bad of ["video", "__proto__", 5, null, { x: 1 }]) assert.equal(cleanOptions({ v: 1, sections: [], heroBg: bad }).heroBg, "cars", `junk heroBg ${bad}`);
assert.equal(cleanOptions({ v: 2, heroBg: "photo" }).heroBg, "cars", "other version ignored");
for (const k of OPTION_IDS) {
  assert.ok(OPTIONS[k].values.includes(OPTIONS[k].def), `${k} default is one of its values`);
  for (const v of OPTIONS[k].values) {
    const look = { [k]: v };
    const saved = toSaved(defaultLayout(), look);
    if (v === OPTIONS[k].def) {
      assert.ok(!(k in saved), `${k} default not saved`);
      assert.ok(isDefaultLayout(defaultLayout(), look), `${k} default = the default layout`);
    } else {
      assert.equal(saved[k], v, `${k}=${v} saved`);
      assert.ok(!isDefaultLayout(defaultLayout(), look), `${k}=${v} is not the default`);
    }
    assert.equal(cleanOptions(saved)[k], v, `${k}=${v} survives saving`);
    const param = draftParam(defaultLayout(), look);
    assert.equal(draftOptions(param)[k], v, `${k}=${v} rides the preview link`);
    assert.deepEqual(fromDraftParam(param), defaultLayout(), `${k} part is not a section`);
  }
  assert.ok(!(k in toSaved(defaultLayout(), { [k]: "junk" })), `junk ${k} not saved`);
}
assert.ok(!draftParam(defaultLayout()).includes("opt."), "an untouched layout's link carries no option");
assert.deepEqual(draftOptions("hero.c,opt.heroBg.evil,opt.nope.x"), defaultOptions(), "a hand-made link cannot set junk");
assert.deepEqual(cleanLayout(toSaved(defaultLayout(), { heroBg: "photo" })), defaultLayout(), "sections unaffected by option keys");
// The editor's option switches name only real options and values, under versions that exist.
for (const [id, byV] of Object.entries(VERSION_OPTIONS)) for (const [v, o] of Object.entries(byV)) {
  assert.ok(AVAILABLE_VERSIONS[id]?.includes(v), `${id}.${v} exists`);
  assert.deepEqual(Object.keys(o.values).sort(), [...OPTIONS[o.option].values].sort(), `${id}.${v} switch lists every ${o.option}`);
}

// ── Stage 4: presets ──
const AV = AVAILABLE_VERSIONS;
assert.equal(PRESETS.length, 4, "four named looks");
for (const p of PRESETS) {
  assert.ok(FONTS[p.font], `${p.id} font exists`);
  for (const [id, v] of Object.entries(p.variants)) assert.ok(AV[id]?.includes(v), `${p.id}: ${id}.${v} is a version the page can draw`);
  const { layout: pl, font: pf } = applyPreset(defaultLayout(), p.id, AV);
  assert.equal(pf, p.font);
  assert.equal(presetOf(pl, pf, AV), p.id, `${p.id} is recognised after picking it`);
}
assert.equal(presetOf(defaultLayout(), DEFAULT_FONT, AV), "original", "the usual page = Original");
const mine = applyPreset(defaultLayout(), "showroom", AV);
assert.equal(presetOf(setVariant(mine.layout, "about", "c", AV), mine.font, AV), null, "one change = your own mix");
assert.equal(presetOf(mine.layout, "classic", AV), null, "a different font = your own mix");
// A preset keeps the dealer's order and on/off.
const custom = toggleSection(moveSection(defaultLayout(), "why", -1), "stats");
const afterPreset = applyPreset(custom, "boutique", AV).layout;
assert.deepEqual(afterPreset.map((r) => [r.id, r.on]), custom.map((r) => [r.id, r.on]), "order and on/off kept");
assert.deepEqual(applyPreset(custom, "nope", AV).layout, custom, "unknown preset changes nothing");
assert.equal(applyPreset(defaultLayout(), "showroom", { hero: ["a"] }).layout.find((r) => r.id === "hero").variant, "a", "a version the page cannot draw falls back");

// ── Stage 4: Shuffle ──
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let look = { layout: custom, font: DEFAULT_FONT };
for (let i = 0; i < 50; i++) {
  const next = shuffleLook(look.layout, look.font, AV, rand);
  assert.ok(next.font !== look.font || next.layout.some((r, k) => r.variant !== look.layout[k].variant), "Shuffle always changes something");
  assert.deepEqual(next.layout.map((r) => [r.id, r.on]), custom.map((r) => [r.id, r.on]), "Shuffle keeps order and on/off");
  for (const r of next.layout) assert.ok((AV[r.id] || ["a"]).includes(r.variant), `Shuffle picks only drawable versions (${r.id}.${r.variant})`);
  assert.ok(FONTS[next.font]);
  look = next;
}
const stuck = shuffleLook(defaultLayout(), "modern", AV, () => 0); // always the first choice = "a" + modern
assert.notEqual(stuck.font, "modern", "even an unlucky draw changes the look");

// Every section with versions has a name for each; the editor list and the page agree.
for (const [id, v] of Object.entries(VERSION_INFO)) assert.deepEqual(AV[id], Object.keys(v), `${id} versions`);
for (const id of ["about", "why", "stats", "how", "reviews"]) assert.deepEqual(AV[id], ["a", "b", "c"], `${id} has B and C`);

// The database check lists exactly the same sections and versions (migration 20261120a).
const sql = readFileSync(new URL("../supabase/migrations/20261120a_analytics_event_types.sql", import.meta.url), "utf8");
const fn = sql.slice(sql.indexOf("function public.storefront_layout_ok"), sql.indexOf("alter table public.profiles add column if not exists storefront_layout"));
const list = (after) => [...fn.slice(fn.indexOf(after) + after.length).split(")")[0].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
assert.deepEqual(list("s->>'id', '') not in (").sort(), SECTIONS.map((x) => x.id).sort(), "SQL section list = JS");
assert.deepEqual(list("s->>'variant', '') not in (").sort(), [...VARIANTS].sort(), "SQL versions = JS");
// The check reads only v + sections, so the stage-4 `font` key needs no migration. If someone
// tightens the check to list allowed keys, `font` must be in it or every font save fails.
assert.ok(!/jsonb_object_keys\(p\)/.test(fn) || fn.includes("'font'"), "DB check must allow the font key");
for (const k of ["theme", ...OPTION_IDS]) assert.ok(!/jsonb_object_keys\(p\)/.test(fn) || fn.includes(`'${k}'`), `DB check must allow the ${k} key`);
console.log("storefrontLayout: all passed");
