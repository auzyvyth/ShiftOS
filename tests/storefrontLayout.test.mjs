import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SECTIONS, VARIANTS, defaultLayout, cleanLayout, toSaved, isDefaultLayout, sectionOn,
  moveSection, toggleSection, draftParam, fromDraftParam, setVariant,
  DEFAULT_FONT, FONTS, FONT_IDS, cleanFont, fontCss, fontSheet, draftFont,
  PRESETS, applyPreset, presetOf, shuffleLook,
  OPTIONS, OPTION_IDS, defaultOptions, cleanOptions, draftOptions,
  DB_PHASE_B, PHASE_B_IDS, DB_PHASE_C, PHASE_C_IDS, DELIVERIES_OPEN,
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
const beforeVideo = SECTIONS[SECTIONS.findIndex((x) => x.id === "video") - 1].id; // strip, or brands once phase B is on
assert.equal(ids(c).indexOf("video"), ids(c).indexOf(beforeVideo) + 1, "a missing section returns after its default neighbour");

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
assert.equal(cleanOptions({ v: 1, sections: [], header: "centred" }).header, "centred", "the centred header is saved");
assert.equal(defaultOptions().footer, "classic", "the usual footer unless picked");
assert.equal(cleanOptions({ v: 1, sections: [], footer: "contact" }).footer, "contact");
assert.equal(cleanOptions({ v: 1, sections: [], footer: "huge" }).footer, "classic", "an unknown footer goes back to the usual one");
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
assert.equal(PRESETS.length, 5, "five named looks");
for (const p of PRESETS) {
  assert.ok(FONTS[p.font], `${p.id} font exists`);
  for (const [id, v] of Object.entries(p.variants)) assert.ok(AV[id]?.includes(v), `${p.id}: ${id}.${v} is a version the page can draw`);
  const { layout: pl, font: pf, options: po, mode: pm } = applyPreset(defaultLayout(), p.id, AV);
  assert.equal(pf, p.font);
  for (const [k, v] of Object.entries(p.options || {})) assert.ok(OPTIONS[k]?.values.includes(v), `${p.id}: option ${k}=${v} exists`);
  assert.ok(!p.mode || ["dark", "light"].includes(p.mode), `${p.id} mode`);
  assert.equal(presetOf(pl, pf, AV, { options: po, mode: pm || "dark" }), p.id, `${p.id} is recognised after picking it`);
  if (!p.mode) assert.equal(presetOf(pl, pf, AV, { options: po, mode: "light" }), p.id, `${p.id} matches on Light too`);
}
// Showroom Light: theme light, showroom header, full-screen photo banner, inline calculator.
const sl = applyPreset(defaultLayout(), "showroom_light", AV);
assert.equal(sl.mode, "light");
assert.deepEqual(sl.options, { ...defaultOptions(), header: "showroom", heroBg: "photo" });
assert.equal(sl.layout.find((r) => r.id === "hero").variant, "c");
assert.equal(sl.layout.find((r) => r.id === "calculator").variant, "b");
assert.equal(presetOf(sl.layout, sl.font, AV, { options: sl.options, mode: "dark" }), null, "Showroom Light on the Dark theme = your own mix");
assert.equal(presetOf(sl.layout, sl.font, AV), null, "without its options it is not Showroom Light");
// Picking an older look after Showroom Light puts the options back to default, theme untouched.
const back = applyPreset(sl.layout, "original", AV);
assert.deepEqual(back.options, defaultOptions());
assert.equal(back.mode, null, "an older look leaves the theme alone");
assert.equal(applyPreset(defaultLayout(), "nope", AV).options, null);
// The saved shape of Showroom Light: theme + options as top-level keys, read back the same.
const slSaved = toSaved(sl.layout, { font: sl.font, theme: { mode: sl.mode }, ...sl.options });
assert.equal(slSaved.header, "showroom");
assert.equal(slSaved.heroBg, "photo");
assert.deepEqual(slSaved.theme, { mode: "light" });
assert.deepEqual(cleanOptions(slSaved), sl.options);
assert.deepEqual(draftOptions(draftParam(sl.layout, { font: sl.font, theme: { mode: "light" }, ...sl.options })), sl.options);
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
assert.deepEqual(AV.calculator, ["a", "b"], "calculator has the Inline version");
// The inline calculator uses the ONE loan formula (financing.js), EIR only, never a flat rate.
const inline = readFileSync(new URL("../src/components/storefront/sections/CalculatorInline.jsx", import.meta.url), "utf8");
assert.match(inline, /import \{[^}]*monthlyPayment[^}]*\} from "..\/..\/..\/utils\/financing"/, "inline calculator uses financing.js");
assert.ok(!/flatToEir|Math\.pow/.test(inline), "no flat rate and no second formula in the inline calculator");
assert.match(inline, /bank decides/i, "the fine print says the bank decides");

// The database check lists exactly the same sections and versions. Live today: migration
// 20261120a. Phase B (QUEUED): 20261121a adds brands / browse / sold. The gate DB_PHASE_B picks
// which one the app must match, so the app can never save an id the live check refuses.
const sqlOf = (file, end) => {
  const sql = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
  const from = sql.indexOf("function public.storefront_layout_ok");
  return sql.slice(from, end ? sql.indexOf(end, from) : sql.indexOf("$$;", sql.indexOf("$$", from) + 2));
};
const listIn = (fn, after) => [...fn.slice(fn.indexOf(after) + after.length).split(")")[0].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const fnLive = sqlOf("20261120a_analytics_event_types.sql", "alter table public.profiles add column if not exists storefront_layout");
const fnB = sqlOf("20261121a_storefront_phase_b.sql");
const fnC = sqlOf("20261121b_storefront_delivery_gallery.sql");
const fn = DB_PHASE_C && DB_PHASE_B ? fnC : DB_PHASE_B ? fnB : fnLive;
assert.ok(!DB_PHASE_C || DB_PHASE_B, "phase C needs phase B: 20261121b lists the phase B ids, so both gates open together");
const list = (after) => listIn(fn, after);
assert.deepEqual(list("s->>'id', '') not in (").sort(), SECTIONS.map((x) => x.id).sort(), "SQL section list = JS");
assert.deepEqual(list("s->>'variant', '') not in (").sort(), [...VARIANTS].sort(), "SQL versions = JS");
if (!DB_PHASE_B) {
  for (const id of PHASE_B_IDS) assert.ok(!SECTIONS.some((x) => x.id === id), `gate closed: ${id} does not exist yet`);
  assert.equal(SECTIONS.length, 13, "gate closed: the same 13 sections as the live check");
}
if (!DB_PHASE_C) {
  for (const id of PHASE_C_IDS) assert.ok(!SECTIONS.some((x) => x.id === id), `gate C closed: ${id} does not exist yet`);
  assert.equal(DELIVERIES_OPEN, false, "gate C closed: no upload panel in the dashboard");
}

// ── Stage 4 phase B, gate OPEN: a second copy of the rules, as they will be after 20261121a ──
globalThis.__SF_PHASE_B_TEST = true;
globalThis.__SF_PHASE_C_TEST = false; // phase B only, even when the real gate C is open
const B = await import("../src/utils/storefrontLayout.js?phaseB");
delete globalThis.__SF_PHASE_B_TEST;
delete globalThis.__SF_PHASE_C_TEST;
const bIds = B.SECTIONS.map((x) => x.id);
assert.deepEqual(listIn(fnB, "s->>'id', '') not in (").sort(), [...bIds].sort(), "20261121a lists every section the open gate has");
assert.deepEqual(listIn(fnB, "s->>'variant', '') not in (").sort(), [...VARIANTS].sort(), "20261121a versions = JS");
for (const id of PHASE_B_IDS) assert.ok(bIds.includes(id), `gate open: ${id} exists`);
for (const id of PHASE_C_IDS) assert.ok(!bIds.includes(id), `phase B open, C closed: ${id} still absent`);
assert.ok(bIds.length <= 20, "the DB caps a layout at 20 sections");
assert.equal(bIds.indexOf("brands"), bIds.indexOf("strip") + 1, "brands right under the strip");
assert.equal(bIds.indexOf("browse"), bIds.indexOf("cars") - 1, "browse bar just above the cars");
assert.equal(bIds.indexOf("sold"), bIds.indexOf("reviews") + 1, "recently sold after the reviews");
assert.deepEqual(bIds.filter((id) => !PHASE_B_IDS.includes(id)), SECTIONS.map((x) => x.id).filter((id) => !PHASE_B_IDS.includes(id) && !PHASE_C_IDS.includes(id)), "the old sections keep their order");
// A layout saved before the flip (13 sections) gets the three new ones, switched on, in place.
const oldSaved = toSaved(moveSection(toggleSection(defaultLayout(), "why"), "about", -1));
const opened = B.cleanLayout(oldSaved);
assert.equal(opened.length, bIds.length);
for (const id of PHASE_B_IDS) assert.ok(B.sectionOn(opened, id), `${id} comes back on`);
assert.equal(opened.find((r) => r.id === "why").on, false, "the dealer's own off survives the flip");
assert.equal(opened.map((r) => r.id).indexOf("brands"), opened.map((r) => r.id).indexOf("strip") + 1);
// Saving, switching off and the preview link work for the new ids; the closed gate drops them.
const bOff = B.toggleSection(B.defaultLayout(), "sold");
assert.equal(B.sectionOn(bOff, "sold"), false);
assert.deepEqual(B.fromDraftParam(B.draftParam(bOff)), bOff, "preview link carries the new sections");
const bSaved = B.toSaved(bOff);
assert.equal(bSaved.sections.length, bIds.length);
if (!DB_PHASE_B) {
  assert.equal(cleanLayout(bSaved).length, SECTIONS.length, "closed gate: a saved phase-B id is dropped, never drawn");
  assert.ok(!draftParam(cleanLayout(bSaved)).match(/brands|browse|sold/), "closed gate: the preview link never carries them");
}
assert.ok(B.isDefaultLayout(B.defaultLayout()));
// The check reads only v + sections, so the stage-4 `font` key needs no migration. If someone
// tightens the check to list allowed keys, `font` must be in it or every font save fails.
assert.ok(!/jsonb_object_keys\(p\)/.test(fn) || fn.includes("'font'"), "DB check must allow the font key");

// ── Stage 4 phase C, both gates OPEN: the rules as they will be after 20261121b ──
globalThis.__SF_PHASE_B_TEST = true;
globalThis.__SF_PHASE_C_TEST = true;
const C = await import("../src/utils/storefrontLayout.js?phaseC");
delete globalThis.__SF_PHASE_B_TEST;
delete globalThis.__SF_PHASE_C_TEST;
const cIds = C.SECTIONS.map((x) => x.id);
assert.deepEqual(listIn(fnC, "s->>'id', '') not in (").sort(), [...cIds].sort(), "20261121b lists every section both open gates have");
assert.deepEqual(listIn(fnC, "s->>'variant', '') not in (").sort(), [...VARIANTS].sort(), "20261121b versions = JS");
assert.ok(C.DELIVERIES_OPEN, "gate C open: the upload panel shows");
assert.ok(cIds.length <= 20, "the DB caps a layout at 20 sections");
assert.equal(cIds.indexOf("deliveries"), cIds.indexOf("sold") + 1, "Happy customers right after Recently sold");
assert.deepEqual(cIds.filter((id) => id !== "deliveries"), bIds, "phase B order kept");
for (const id of [...PHASE_B_IDS, ...PHASE_C_IDS]) assert.ok(cIds.includes(id), `both open: ${id} exists`);
// A layout saved under phase B gets "deliveries", on, in place; the dealer's offs survive.
const bLayout = B.toSaved(B.toggleSection(B.defaultLayout(), "brands"));
const cOpened = C.cleanLayout(bLayout);
assert.equal(cOpened.length, cIds.length);
assert.ok(C.sectionOn(cOpened, "deliveries"), "deliveries comes back on");
assert.equal(C.sectionOn(cOpened, "brands"), false, "phase B off survives the phase C flip");
const cOff = C.toggleSection(C.defaultLayout(), "deliveries");
assert.deepEqual(C.fromDraftParam(C.draftParam(cOff)), cOff, "preview link carries deliveries");
if (!DB_PHASE_C) {
  assert.ok(!cleanLayout(C.toSaved(cOff)).some((r) => r.id === "deliveries"), "closed gate: a saved deliveries id is dropped, never drawn");
  assert.ok(!draftParam(cleanLayout(C.toSaved(cOff))).includes("deliveries"), "closed gate: the preview link never carries it");
}
assert.deepEqual(AV.deliveries, ["a"], "Happy customers has one version");
for (const k of ["theme", ...OPTION_IDS]) assert.ok(!/jsonb_object_keys\(p\)/.test(fn) || fn.includes(`'${k}'`), `DB check must allow the ${k} key`);
console.log("storefrontLayout: all passed");
