import assert from "node:assert/strict";
import { pageAccent, chosenPageColor, PAGE_COLOR_DEFAULT } from "../src/utils/pageAccent.js";
import { accentTheme } from "../src/utils/liveAccent.js";

assert.equal(pageAccent({ page_basic: true, brand_color: "#1D4ED8" }), null, "Lite: no theme, even with a colour");
assert.equal(pageAccent(null), null);
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#c9a84c" }), accentTheme(PAGE_COLOR_DEFAULT), "DB default gold = never chose = red");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#C9A84C" }), accentTheme(PAGE_COLOR_DEFAULT), "case-insensitive");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "#1D4ED8" }), accentTheme("#1D4ED8"), "a real pick");
assert.deepEqual(pageAccent({ page_basic: false, brand_color: "junk" }), accentTheme(PAGE_COLOR_DEFAULT));
assert.equal(chosenPageColor({ brand_color: "#c9a84c" }), null);
assert.equal(chosenPageColor({ brand_color: "#15803D" }), "#15803D");
// A too-light pick is darkened for white text.
assert.notEqual(pageAccent({ page_basic: false, brand_color: "#00ffff" }).accent, "#00FFFF");
console.log("pageAccent: all passed");
