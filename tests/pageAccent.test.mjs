import assert from "node:assert/strict";
import { pageAccent, chosenPageColor, gradientTheme, gradientFor, partnerColor, PAGE_GRADIENTS, PAGE_COLOR_DEFAULT } from "../src/utils/pageAccent.js";
import { contrastWithWhite, hexToRgb } from "../src/utils/liveAccent.js";

assert.equal(pageAccent({ page_basic: true, brand_color: "#2563EB" }), null, "Lite: no theme, even with a colour");
assert.equal(pageAccent(null), null);
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#c9a84c" }), gradientTheme(PAGE_COLOR_DEFAULT), "DB default gold = never chose = Drevo");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#C9A84C" }), gradientTheme(PAGE_COLOR_DEFAULT), "case-insensitive");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "junk" }), gradientTheme(PAGE_COLOR_DEFAULT));
assert.equal(chosenPageColor({ brand_color: "#c9a84c" }), null);
assert.equal(chosenPageColor({ brand_color: "#15803d" }), "#15803D");

// A preset is found again by its first colour (what is saved), any case.
assert.deepEqual(gradientFor("#0d9488"), { from: "#0D9488", to: "#1E40AF" });
assert.equal(new Set(PAGE_GRADIENTS.map((g) => g.from)).size, PAGE_GRADIENTS.length, "first colours unique");
assert.ok(!PAGE_GRADIENTS.some((g) => g.from.toLowerCase() === "#c9a84c"), "no preset is the 'never chose' gold");

// A custom pick gets a worked-out partner: a real colour, different, never junk.
const p = partnerColor("#00A3FF");
assert.ok(hexToRgb(p) && p !== "#00A3FF");
assert.ok(hexToRgb(partnerColor("#808080")), "grey works");

// Every end, preset or custom, carries white text (3:1, bold).
for (const hex of [...PAGE_GRADIENTS.map((g) => g.from), "#FFFF00", "#00FFFF", "#FFC0CB", "#FFFFFF", "#000000"]) {
  const t = gradientTheme(hex);
  for (const end of [t.accent, t.dark]) assert.ok(contrastWithWhite(hexToRgb(end)) >= 3, `${hex} -> ${end} readable`);
}
console.log("pageAccent: all passed");
