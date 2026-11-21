import assert from "node:assert/strict";
import { stockBrands, stockBodyTypes, stockModels, stockPriceSteps, browseHref, soldCards, MIN_BRANDS } from "../src/utils/storefrontStock.js";

const STEPS = [{ value: "", label: "Any" }, ...[20, 30, 50, 80, 100, 200].map((k) => ({ value: String(k * 1000), label: `RM ${k}k` }))];
const rows = [
  { brand: "Toyota", model: "ALPHARD 2.5L", body_type: "MPV", selling_price: 180000 },
  { brand: "Toyota", model: "Alphard", body_type: "MPV", selling_price: 150000 },
  { brand: "Toyota", model: "Vios", body_type: "Sedan", selling_price: 45000 },
  { brand: " Honda ", model: "City", body_type: "Sedan", selling_price: 52000 },
  { brand: "Weirdbrand", model: "X", body_type: "Spaceship", selling_price: 25000 },
  { brand: null, model: null, body_type: null, selling_price: null },
  null,
];

assert.equal(MIN_BRANDS, 2);
assert.deepEqual(stockBrands(rows), [{ name: "Toyota", count: 3 }, { name: "Honda", count: 1 }], "most first, trimmed, off-whitelist dropped");
assert.deepEqual(stockBrands(null), []);
assert.deepEqual(stockBodyTypes(rows), [{ name: "MPV", count: 2 }, { name: "Sedan", count: 2 }], "only /cars body types");
assert.deepEqual(stockModels(rows, "Toyota"), ["Alphard", "Vios"], "spellings grouped by catalogue name");
assert.deepEqual(stockModels(rows, "Honda"), ["City"]);
assert.deepEqual(stockModels(rows, "Weirdbrand"), [], "a brand /cars cannot filter gets no models");
assert.deepEqual(stockModels(rows, null), []);

// Price steps: every option shows a car; the top one shows them all. Cheapest 25k (the
// off-whitelist car still counts for price: it is on /cars unfiltered by brand).
assert.deepEqual(stockPriceSteps(rows, STEPS).map((s) => s.value), ["30000", "50000", "80000", "100000", "200000"]);
assert.deepEqual(stockPriceSteps([{ selling_price: 999999 }], STEPS).map((s) => s.value), [], "nothing buys it: no option");
assert.deepEqual(stockPriceSteps([], STEPS), []);
assert.deepEqual(stockPriceSteps([{ selling_price: 45000 }], STEPS).map((s) => s.value), ["50000"]);

// Links carry only real options.
assert.equal(browseHref("/cars", {}, rows, STEPS), "/cars");
assert.equal(browseHref("/cars", { brand: "Toyota", model: "Alphard", maxPrice: "200000" }, rows, STEPS), "/cars?brand=Toyota&model=Alphard&max_price=200000");
assert.equal(browseHref("/cars", { brand: "BMW", model: "X5" }, rows, STEPS), "/cars", "a brand not in stock is dropped with its model");
assert.equal(browseHref("/cars", { brand: "Honda", model: "Alphard" }, rows, STEPS), "/cars?brand=Honda", "a model of another brand is dropped");
assert.equal(browseHref("/cars", { maxPrice: "12345" }, rows, STEPS), "/cars", "not a /cars price step");
assert.equal(browseHref("/cars", { bodyType: "SUV" }, rows, STEPS), "/cars", "no SUV in stock");
assert.equal(browseHref("/cars", { bodyType: "MPV" }, rows, STEPS), "/cars?body_type=MPV");
assert.equal(browseHref("/cars", { brand: "Land Rover" }, [{ brand: "Land Rover" }, { brand: "Toyota" }], STEPS), "/cars?brand=Land+Rover", "encoded");

// Recently sold: car + month only, never anything else.
const sold = soldCards([
  { brand: "Honda", model: "City", variant: "1.5 V", year: 2019, photo: "p.jpg", sold_month: "2026-03-01", selling_price: 50000, buyer: "x" },
  { brand: "Proton", model: "X50", variant: null, year: 2022, photo: null, sold_month: "2025-12-01" },
  { brand: "Proton", model: "X50", year: 2022, sold_month: "junk" },
  { brand: "", model: "", sold_month: "2026-01-01" },
]);
assert.deepEqual(sold, [
  { name: "2019 Honda City 1.5 V", when: "Sold in March 2026", photo: "p.jpg" },
  { name: "2022 Proton X50", when: "Sold in December 2025", photo: null },
]);
for (const c of sold) assert.deepEqual(Object.keys(c).sort(), ["name", "photo", "when"], "no price, no buyer ever reaches the card");
assert.deepEqual(soldCards(undefined), []);
console.log("storefrontStock: all passed");
