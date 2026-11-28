import assert from "node:assert/strict";
import { pageAccent, chosenPageColor, pagePalette, paletteVars, cleanHex, contrast, PAGE_COLOR_PRESETS, PAGE_COLOR_DEFAULT } from "../src/utils/pageAccent.js";
import { hexToRgb } from "../src/utils/liveAccent.js";

const rgb = (h) => hexToRgb(h);
const PAGE = [233, 235, 239];

// Who gets a theme
assert.equal(pageAccent({ page_basic: true, brand_color: "#2563EB" }), null, "Lite: no theme, even with a colour");
assert.equal(pageAccent(null), null);
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#c9a84c" }), pagePalette(PAGE_COLOR_DEFAULT), "DB default gold = never chose = Drevo");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#C9A84C" }), pagePalette(PAGE_COLOR_DEFAULT), "case-insensitive");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "junk" }), pagePalette(PAGE_COLOR_DEFAULT));
assert.equal(chosenPageColor({ brand_color: "#c9a84c" }), null);
assert.equal(chosenPageColor({ brand_color: "#15803d" }), "#15803D");

// The hex box
assert.equal(cleanHex("1e40af"), "#1E40AF");
assert.equal(cleanHex(" #abc "), "#AABBCC");
assert.equal(cleanHex("#12345"), null);
assert.equal(cleanHex("red"), null);
assert.equal(cleanHex("#1e40af; background:url(x)"), null, "nothing but a colour gets through");
assert.ok(!PAGE_COLOR_PRESETS.some((h) => h.toLowerCase() === "#c9a84c"), "no quick pick is the 'never chose' gold");

// The seller's colour is used exactly as picked (it used to be darkened for white text)
assert.equal(pagePalette("#96D35F").accent, "#96D35F");
assert.equal(pagePalette("#FACC15").accent, "#FACC15");

// Dark colour = white words, light colour = dark words
assert.equal(pagePalette("#DC2626").on, "#FFFFFF");
assert.equal(pagePalette("#0F172A").on, "#FFFFFF");
assert.equal(pagePalette("#FACC15").on, "#0F1115", "yellow gets dark words");
assert.equal(pagePalette("#96D35F").on, "#0F1115", "a real seller's light green gets dark words");
assert.equal(pagePalette("#FFFFFF").on, "#0F1115");

const SAMPLE = [...PAGE_COLOR_PRESETS, "#96D35F", "#FACC15", "#00FFFF", "#FFC0CB", "#FFFFFF", "#000000", "#808080", "#E8590C", "#0B1120", "#22C55E", "#0EA5E9"];
for (const hex of SAMPLE) {
  const p = pagePalette(hex);
  // Words on the colour always read (bold text: 3:1); dark words on a light colour read even better.
  assert.ok(contrast(rgb(p.accent), rgb(p.on)) >= 3, `${hex}: words on it read (${contrast(rgb(p.accent), rgb(p.on)).toFixed(2)})`);
  // The tile written on the 'on' colour (a white tile on red, a black tile on yellow) reads too.
  assert.ok(contrast(rgb(p.on), rgb(p.inv)) >= 3, `${hex}: inverse tile reads`);
  // The colour as text on the page reads (4.5:1).
  assert.ok(contrast(rgb(p.text), PAGE) >= 4.5, `${hex}: text on the page reads`);
  // Hover and press are real shades, different from the colour and from each other.
  assert.notEqual(p.hover, p.accent, `${hex}: hover differs`);
  assert.notEqual(p.press, p.hover, `${hex}: press differs`);
  for (const k of ["accent", "hover", "press", "deep", "on", "text", "inv"]) assert.ok(rgb(p[k]), `${hex}: ${k} is a hex`);
  // Every CSS variable is filled (no undefined reaching the page)
  for (const [k, v] of Object.entries(paletteVars(p))) assert.ok(v && !String(v).includes("undefined"), `${hex}: ${k}`);
}

// A near-black colour gets LIGHTER on hover, or the hover would not show
const blk = pagePalette("#000000");
assert.ok(contrast(rgb(blk.hover), [0, 0, 0]) > 1.1, "black hover is visibly lighter");
console.log("pageAccent: all passed");
