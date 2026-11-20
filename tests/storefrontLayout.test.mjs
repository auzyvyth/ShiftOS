import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SECTIONS, VARIANTS, defaultLayout, cleanLayout, toSaved, isDefaultLayout, sectionOn,
  moveSection, toggleSection, draftParam, fromDraftParam, setVariant,
} from "../src/utils/storefrontLayout.js";

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

// The database check lists exactly the same sections and versions (migration 20261120a).
const sql = readFileSync(new URL("../supabase/migrations/20261120a_analytics_event_types.sql", import.meta.url), "utf8");
const fn = sql.slice(sql.indexOf("function public.storefront_layout_ok"), sql.indexOf("alter table public.profiles add column if not exists storefront_layout"));
const list = (after) => [...fn.slice(fn.indexOf(after) + after.length).split(")")[0].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
assert.deepEqual(list("s->>'id', '') not in (").sort(), SECTIONS.map((x) => x.id).sort(), "SQL section list = JS");
assert.deepEqual(list("s->>'variant', '') not in (").sort(), [...VARIANTS].sort(), "SQL versions = JS");
console.log("storefrontLayout: all passed");
