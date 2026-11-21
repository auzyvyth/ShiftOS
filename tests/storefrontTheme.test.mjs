// A dealer's site theme (STOREFRONT-2 stage 4): Dark or Light, plus one optional accent.
// Whatever accent is picked, every word reads and every card has a visible edge.
import assert from "node:assert/strict";
import {
  cleanTheme, modeOf, themeOf, themeParam, draftTheme, resolveTheme, themeVars, themeCss, contrast,
  LIGHT, TEXT_MIN, BORDER_STEP,
} from "../src/utils/storefrontTheme.js";
import { defaultLayout, toSaved, isDefaultLayout, draftParam, fromDraftParam, cleanLayout, draftFont } from "../src/utils/storefrontLayout.js";

// ── Cleaning ──
for (const bad of [undefined, null, "x", 5, [], {}, { mode: "pink" }, { mode: "dark" }, { accent: "red" }, { accent: "#fff" }, { card: "#FFFFFF" }]) {
  assert.equal(cleanTheme(bad), null, `junk or default ${JSON.stringify(bad)} = no theme`);
}
assert.deepEqual(cleanTheme({ mode: "light" }), { mode: "light" });
assert.deepEqual(cleanTheme({ mode: "dark", accent: "15803d" }), { accent: "#15803D" }, "dark is the default, not written");
assert.deepEqual(cleanTheme({ mode: "light", accent: "#15803d", evil: 1 }), { mode: "light", accent: "#15803D" });
// An older free-picker save (staging, 2026-11-20): a light background reads as Light, the rest as Dark.
assert.deepEqual(cleanTheme({ bg: "#F5EFE3", card: "#FFFFFF" }), { mode: "light" });
assert.equal(cleanTheme({ bg: "#E11D1D", card: "#E52222" }), null, "an old red page = back to Dark");
assert.deepEqual(cleanTheme({ bg: "#0B1F44", accent: "#2563EB" }), { accent: "#2563EB" });
assert.equal(modeOf(null), "dark");
assert.equal(modeOf({ mode: "light" }), "light");
assert.equal(themeOf({ v: 1, sections: [], theme: { mode: "light" } }).mode, "light");
assert.equal(themeOf({ v: 2, theme: { mode: "light" } }), null, "other layout version ignored");
assert.equal(themeOf(null), null);

// ── No theme = nothing written: the page is byte-identical to before ──
assert.equal(resolveTheme(null), null);
assert.equal(themeVars({}), null);
assert.equal(themeCss(undefined), "");
assert.equal(themeCss({ mode: "dark" }), "", "choosing Dark back writes nothing");

// ── Saving + preview link ──
assert.ok(!("theme" in toSaved(defaultLayout())), "no look = as before");
assert.ok(!("theme" in toSaved(defaultLayout(), { theme: { mode: "dark" } })));
assert.deepEqual(toSaved(defaultLayout(), { theme: { mode: "light", accent: "#15803d" } }).theme, { mode: "light", accent: "#15803D" });
assert.deepEqual(cleanLayout(toSaved(defaultLayout(), { theme: { mode: "light" } })), defaultLayout(), "sections unaffected");
assert.ok(isDefaultLayout(defaultLayout(), { theme: null }));
assert.ok(!isDefaultLayout(defaultLayout(), { theme: { mode: "light" } }), "Light is not the default");
assert.equal(draftParam(defaultLayout()), draftParam(defaultLayout(), { theme: {} }), "no theme = the old link");
const tp = draftParam(defaultLayout(), { font: "bold", theme: { mode: "light", accent: "#15803D" } });
assert.deepEqual(draftTheme(tp), { mode: "light", accent: "#15803D" });
assert.equal(draftFont(tp), "bold", "font and theme ride together");
assert.deepEqual(fromDraftParam(tp), defaultLayout(), "the theme part is not a section");
assert.equal(themeParam({ mode: "light" }), "theme.light.-");
assert.equal(themeParam({ accent: "#2563EB" }), "theme.dark.2563eb");
assert.deepEqual(draftTheme("hero.a,theme.dark.2563eb"), { accent: "#2563EB" });
assert.equal(draftTheme("hero.a,theme.pink.zzzzzz"), null, "a hand-made bad link is ignored");
assert.equal(draftTheme("hero.a"), null);
assert.equal(draftTheme(null), null);

// ── The Light palette itself ──
const surfaces = [LIGHT.bg, LIGHT.bg2, LIGHT.card];
for (const s of surfaces) {
  for (const k of ["text", "muted", "waText", "badText"]) {
    assert.ok(contrast(LIGHT[k], s) >= TEXT_MIN, `light ${k} on ${s}: ${contrast(LIGHT[k], s).toFixed(2)}`);
  }
}
assert.ok(contrast(LIGHT.border, LIGHT.card) >= BORDER_STEP, `card border visible: ${contrast(LIGHT.border, LIGHT.card).toFixed(2)}`);
assert.ok(contrast(LIGHT.border, LIGHT.bg) >= 1.15, "border visible on the page too");
assert.ok(contrast(LIGHT.text, LIGHT.muted) >= 1.8, "muted text is visibly softer than the main text");

// ── Any accent, both themes ──
function check(theme, label) {
  const r = resolveTheme(theme);
  assert.ok(r, label);
  assert.ok(contrast(r.onAccent, r.accent) >= TEXT_MIN, `${label}: white on accent ${contrast(r.onAccent, r.accent).toFixed(2)}`);
  assert.ok(contrast(r.onAccent, r.accentHover) >= TEXT_MIN, `${label}: white on the hover accent`);
  const on = r.mode === "light" ? surfaces : ["#0C0C0E", "#0F0F11", "#111113"];
  for (const s of on) assert.ok(contrast(r.accentText, s) >= TEXT_MIN, `${label}: accent as a word on ${s}`);
  for (const k of ["accent", "accentText", "accentHover"]) assert.match(r[k], /^#[0-9A-F]{6}$/, `${label} ${k}`);
  return r;
}
const light = check({ mode: "light" }, "light, brand red");
assert.equal(light.bg, LIGHT.bg);
assert.equal(light.dark, false);
check({ mode: "light", accent: "#FFFF00" }, "light, yellow accent");
check({ accent: "#FFFF00" }, "dark, yellow accent");
check({ mode: "light", accent: "#000000" }, "light, black accent");
check({ accent: "#000000" }, "dark, black accent: as a word it is moved toward white");
const g = check({ accent: "#15803D" }, "forest");
assert.equal(g.adjusted.accent, false, "a good accent is kept as picked");
assert.ok(check({ accent: "#FFFF00" }).adjusted.accent, "a yellow accent is darkened, and the editor is told");
assert.equal(resolveTheme({ mode: "light" }, "#15803D").accent, "#15803D", "no accent picked = the brand colour passed in");

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const hex = () => `#${Math.floor(rand() * 0xffffff).toString(16).padStart(6, "0")}`;
for (let i = 0; i < 2000; i++) {
  const theme = { accent: hex() };
  if (rand() < 0.5) theme.mode = "light";
  check(theme, `random ${JSON.stringify(theme)}`);
}

// ── The style sheet ──
const css = themeCss({ mode: "light", accent: "#15803D" });
assert.match(css, /^:root\{--sf-bg:#F3F5F9;/);
assert.ok(css.includes("html body{background:#F3F5F9 !important"), "the page ground follows the theme");
assert.ok(!/[<>]/.test(css), "nothing that could close the style tag");
for (const k of ["--sf-bg", "--sf-bg2", "--sf-card", "--sf-border", "--sf-text", "--sf-muted", "--sf-accent", "--sf-on-accent", "--sf-accent-text"]) {
  assert.ok(k in themeVars({ mode: "light" }), `${k} set`);
}
const accOnly = themeVars({ accent: "#15803D" });
assert.ok(!("--sf-bg" in accOnly) && !("--sf-card" in accOnly), "Dark + accent = the page's own greys stay");
assert.equal(accOnly["--sf-accent"], "#15803D");
assert.ok(!themeCss({ accent: "#15803D" }).includes("html body"), "Dark + accent = page ground untouched");
console.log("storefrontTheme: all passed");

// ── Dark bands on Light (phase A): the footer and About B keep today's dark look ──
import { bandVars, BAND_RESET, BAND_TEXT } from "../src/utils/storefrontTheme.js";
assert.equal(bandVars(null), null, "no theme = no band rule");
assert.equal(bandVars({ accent: "#2563EB" }), null, "Dark theme = no band rule");
assert.ok(!themeCss({ accent: "#2563EB" }).includes(".sf-band"), "Dark + accent writes no band rule");
assert.ok(themeCss({ mode: "light" }, "#DC2626").includes(".sf-band{"), "Light writes the band rule");
for (const acc of ["#DC2626", "#FACC15", "#1E3A8A", "#16A34A", "#000000", "#FFFFFF"]) {
  const b = bandVars({ mode: "light", accent: acc === "#FFFFFF" ? undefined : acc }, "#DC2626");
  for (const k of BAND_RESET) assert.equal(b[k], "initial", `${k} falls back to the old dark value inside a band`);
  for (const sfc of ["#0C0C0E", "#0F0F11", "#111113", "#09090B"]) {
    assert.ok(contrast(b["--sf-accent-text"], sfc) >= TEXT_MIN, `band accent word ${acc} reads on ${sfc}`);
    assert.ok(contrast(BAND_TEXT, sfc) >= TEXT_MIN, "band text reads");
  }
}
assert.ok(bandVars({ mode: "light" }), "Light with no accent and no fallback still works");
console.log("storefrontTheme bands: all passed");
