import assert from "node:assert/strict";
import { tidyVariant, cardTitle, cardPlace, isTitleRepeat } from "../src/utils/cardTitle.js";

// Repeat of the model name dropped, all-lower re-cased.
assert.equal(tidyVariant("golf gti 2.0 se", "Golf"), "GTI 2.0 SE");
// ALL CAPS re-cased, codes kept upper, hyphen parts handled.
assert.equal(tidyVariant("FL5 TYPE-R 2.0L HATCHBACK", "Civic"), "FL5 Type-R 2.0L Hatchback");
assert.equal(tidyVariant("GR RZ HIGH", "Yaris"), "GR RZ High");
assert.equal(tidyVariant("STRIPES G TURBO", "Move Canbus"), "Stripes G Turbo");
// Mixed case typed with care is left alone.
assert.equal(tidyVariant("sDrive20i M Sport", "Z4"), "sDrive20i M Sport");
assert.equal(tidyVariant("Executive Lounge", "Vellfire"), "Executive Lounge");
// Litre suffix upper case.
assert.equal(tidyVariant("2.5l z", "Alphard"), "2.5L Z");
// Never empties a variant that IS the model word only.
assert.equal(tidyVariant("Golf", "Golf"), "Golf");
assert.equal(tidyVariant("", "Golf"), "");
assert.equal(tidyVariant(null, null), "");

assert.deepEqual(cardTitle({ year: 2012, brand: "Volkswagen", model: "Golf", variant: "golf gti 2.0 se" }),
  { name: "2012 Volkswagen Golf", variant: "GTI 2.0 SE" });
assert.deepEqual(cardTitle({}), { name: "Car", variant: "" });

assert.equal(cardPlace({ city: "Jalan Semarak" }), "Kuala Lumpur");
assert.equal(cardPlace({ city: "wilayah persekutuan" }), "Kuala Lumpur");
assert.equal(cardPlace({ city: "johor bahru" }), "Johor Bahru");
assert.equal(cardPlace({ city: "", state: "Selangor" }), "Selangor");
assert.equal(cardPlace({}), "");

const vell = { year: 2023, brand: "Toyota", model: "Vellfire", variant: "2.5 Executive Lounge", fuel_type: "Hybrid" };
assert.equal(isTitleRepeat("TOYOTA VELLFIRE 2.5L HYBRID EXECUTIVE LOUNGE 2023", vell), true);
assert.equal(isTitleRepeat("", vell), true);
assert.equal(isTitleRepeat("TOYOTA VELLFIRE 2.5L HYBRID EXECUTIVE LOUNGE 2023", { year: 2023, brand: "Toyota", model: "Vellfire", variant: "Executive Lounge", fuel_type: "Petrol", engine_cc: 2493 }), true);
assert.equal(isTitleRepeat("One owner, full Toyota service record", vell), false);

console.log("cardTitle: all passed");
