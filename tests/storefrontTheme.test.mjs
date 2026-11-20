// A dealer's free colour picks (STOREFRONT-2 stage 4): whatever is picked, the page reads.
import assert from "node:assert/strict";
import {
  cleanTheme, themeOf, themeParam, draftTheme, resolveTheme, themeVars, themeCss, contrast,
  DEFAULT_BG, DEFAULT_CARD, TEXT_MIN, CARD_STEP, ACCENT_STEP,
} from "../src/utils/storefrontTheme.js";
import { defaultLayout, toSaved, isDefaultLayout, draftParam, fromDraftParam, cleanLayout, draftFont } from "../src/utils/storefrontLayout.js";

// ── Cleaning ──
for (const bad of [undefined, null, "x", 5, [], {}, { bg: "red" }, { bg: "#fff" }, { bg: "#12345" }, { card: "#GGGGGG" }, { accent: 7 }]) {
  assert.equal(cleanTheme(bad), null, `junk ${JSON.stringify(bad)} = no theme`);
}
assert.deepEqual(cleanTheme({ bg: "f5efe3", card: "#ffffff", accent: "#15803d", evil: "#000000" }), { bg: "#F5EFE3", card: "#FFFFFF", accent: "#15803D" });
assert.deepEqual(cleanTheme({ bg: "#123456", card: "nope" }), { bg: "#123456" }, "a bad key is dropped, the rest kept");
assert.equal(cleanTheme({ bg: DEFAULT_BG }), null, "today's background = default, not saved");
assert.equal(cleanTheme({ bg: DEFAULT_BG, card: DEFAULT_CARD }), null, "today's colours = default");
assert.deepEqual(cleanTheme({ bg: "#FFFFFF", card: DEFAULT_CARD }), { bg: "#FFFFFF", card: DEFAULT_CARD }, "today's card on another background is a real pick");
assert.equal(themeOf({ v: 1, sections: [], theme: { accent: "#15803D" } }).accent, "#15803D");
assert.equal(themeOf({ v: 2, theme: { accent: "#15803D" } }), null, "other layout version ignored");
assert.equal(themeOf(null), null);

// ── No theme = nothing written: the page is byte-identical to before ──
assert.equal(resolveTheme(null), null);
assert.equal(themeVars({}), null);
assert.equal(themeCss(undefined), "");
assert.equal(themeCss({ bg: DEFAULT_BG }), "", "picking today's background back writes nothing");

// ── Saving + preview link ──
assert.ok(!("theme" in toSaved(defaultLayout())), "no look = as before");
assert.ok(!("theme" in toSaved(defaultLayout(), { theme: {} })));
assert.ok(!("theme" in toSaved(defaultLayout(), { theme: { bg: "junk" } })));
assert.deepEqual(toSaved(defaultLayout(), { theme: { bg: "#0b1f44", accent: "#15803d" } }).theme, { bg: "#0B1F44", accent: "#15803D" });
assert.deepEqual(cleanLayout(toSaved(defaultLayout(), { theme: { bg: "#0b1f44" } })), defaultLayout(), "sections unaffected by the theme key");
assert.ok(isDefaultLayout(defaultLayout(), { theme: null }));
assert.ok(!isDefaultLayout(defaultLayout(), { theme: { accent: "#15803D" } }), "a colour change is not the default");
assert.equal(draftParam(defaultLayout()), draftParam(defaultLayout(), { theme: {} }), "no theme = the old link");
const tp = draftParam(defaultLayout(), { font: "bold", theme: { bg: "#F5EFE3", accent: "#15803D" } });
assert.deepEqual(draftTheme(tp), { bg: "#F5EFE3", accent: "#15803D" });
assert.equal(draftFont(tp), "bold", "font and theme ride together");
assert.deepEqual(fromDraftParam(tp), defaultLayout(), "the theme part is not a section");
assert.equal(themeParam({ card: "#ffffff" }), "theme.-.ffffff.-");
assert.equal(draftTheme("hero.a,theme.zzzzzz.-.-"), null, "a hand-made bad colour is ignored");
assert.equal(draftTheme("hero.a"), null);
assert.equal(draftTheme(null), null);

// ── The guarantee, on fixed hard cases and on many random picks ──
function check(theme, label) {
  const r = resolveTheme(theme);
  assert.ok(r, label);
  const surfaces = [r.bg, r.bg2, r.card];
  for (const s of surfaces) {
    assert.ok(contrast(r.text, s) >= TEXT_MIN, `${label}: text on ${s} ${contrast(r.text, s).toFixed(2)}`);
    assert.ok(contrast(r.muted, s) >= TEXT_MIN, `${label}: muted on ${s} ${contrast(r.muted, s).toFixed(2)}`);
    assert.ok(contrast(r.muted, s) >= 3, `${label}: muted >= 3`);
    assert.ok(contrast(r.accentText, s) >= TEXT_MIN, `${label}: accent as text on ${s}`);
    assert.ok(contrast(r.waText, s) >= TEXT_MIN, `${label}: WhatsApp green as text on ${s}`);
    assert.ok(contrast(r.badText, s) >= TEXT_MIN, `${label}: error red as text on ${s}`);
  }
  assert.ok(contrast(r.onAccent, r.accent) >= TEXT_MIN, `${label}: white on accent ${contrast(r.onAccent, r.accent).toFixed(2)}`);
  assert.ok(contrast(r.card, r.bg) >= CARD_STEP - 1e-9, `${label}: card apart from page ${contrast(r.card, r.bg).toFixed(3)}`);
  assert.ok(contrast(r.accent, r.bg) >= ACCENT_STEP, `${label}: accent apart from page ${contrast(r.accent, r.bg).toFixed(2)}`);
  assert.ok(contrast(r.onAccent, r.accentHover) >= TEXT_MIN, `${label}: white on the hover accent`);
  for (const k of ["bg", "bg2", "card", "text", "muted", "accent", "accentText", "accentHover", "waText"]) assert.match(r[k], /^#[0-9A-F]{6}$/, `${label} ${k}`);
  return r;
}

const cream = check({ bg: "#F5EFE3" }, "cream");
assert.equal(cream.dark, false, "cream = dark text");
assert.equal(cream.bg, "#F5EFE3", "the background pick is never changed");
check({ bg: "#0B1F44", card: "#132B5C" }, "navy");
const red = check({ bg: "#E11D1D", card: "#E52222", accent: "#E11D1D" }, "red on red");
assert.ok(red.adjusted.card, "a card the same as the page is moved, and the editor is told");
assert.ok(red.adjusted.accent, "an accent the same as the page is moved");
check({ accent: "#22C55E" }, "green accent only");
check({ accent: "#FFFF00" }, "yellow accent (white cannot read on it as picked)");
check({ bg: "#FFFFFF", card: "#FFFFFF" }, "white on white");
check({ bg: "#000000", card: "#000000", accent: "#000000" }, "all black");
check({ bg: "#767676", card: "#777777", accent: "#787878" }, "mid grey: the hardest case");
check({ bg: "#FFFFFF", card: "#000000" }, "black card on white page");
check({ bg: "#000000", card: "#FFFFFF" }, "white card on black page");
const g = check({ accent: "#15803D" }, "forest");
assert.equal(g.adjusted.accent, false, "a good accent is kept as picked");
assert.equal(resolveTheme({ bg: "#0B1F44" }, "#15803D").accent, "#15803D", "no accent picked = the brand colour passed in");

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const hex = () => `#${Math.floor(rand() * 0xffffff).toString(16).padStart(6, "0")}`;
for (let i = 0; i < 3000; i++) {
  const theme = {};
  if (rand() < 0.8) theme.bg = hex();
  if (rand() < 0.7) theme.card = rand() < 0.3 && theme.bg ? theme.bg : hex();
  if (rand() < 0.7) theme.accent = rand() < 0.2 && theme.bg ? theme.bg : hex();
  if (!cleanTheme(theme)) continue;
  check(theme, `random ${JSON.stringify(theme)}`);
}

// ── The style sheet ──
const css = themeCss({ bg: "#F5EFE3", accent: "#15803D" });
assert.match(css, /^:root\{--sf-bg:#F5EFE3;/);
assert.ok(css.includes("html body{background:#F5EFE3 !important"), "the page ground follows the theme");
assert.ok(!/[<>]/.test(css), "nothing that could close the style tag");
for (const k of ["--sf-bg", "--sf-bg2", "--sf-card", "--sf-border", "--sf-text", "--sf-muted", "--sf-accent", "--sf-on-accent", "--sf-accent-text"]) {
  assert.ok(k in themeVars({ bg: "#0B1F44" }), `${k} set`);
}
const accOnly = themeVars({ accent: "#15803D" });
assert.ok(!("--sf-bg" in accOnly) && !("--sf-card" in accOnly), "accent only = the page's own greys stay");
assert.equal(accOnly["--sf-accent"], "#15803D");
assert.ok(!themeCss({ accent: "#15803D" }).includes("html body"), "accent only = page ground untouched");
console.log("storefrontTheme: all passed");
