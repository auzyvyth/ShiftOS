import assert from "node:assert/strict";
import { hubModels, hubGroups, hubFaqs, hubCopy, hubJsonLd, hubPath, brandKeywords } from "../src/utils/brandHub.js";

const r = (model, variant, price, o = {}) => ({ brand: "Jaecoo", model, variant, price_peninsular: String(price), is_active: true, body_type: "SUV", fuel_type: "Petrol", specs: {}, ...o });
const rows = [
  r("J5", "1.5T", 108000), r("J5 EV", "EV", 118800, { fuel_type: "Electric" }),
  r("J7", "2WD", 138800), r("J7", "AWD", 148800),
  r("J7 PHEV", "SHS", 158800, { fuel_type: "Plug-in hybrid" }),
  r("J8", "6-seat", 198800, { specs: { seats: 6 } }), r("J8", "7-seat", 205000, { specs: { seats: 7 } }),
  r("Omoda C9", "2WD", 168800),
  r("Gone", "x", 50000, { is_active: false }), r("NoPrice", "x", null),
];
const media = { J5: ["https://drevo.my/new-cars/jaecoo/j5.webp"] };
const ms = hubModels("Jaecoo", rows, media);

assert.deepEqual(ms.map((m) => m.model), ["J5", "J5 EV", "J7", "J7 PHEV", "Omoda C9", "J8"]); // cheapest first, no inactive / unpriced
assert.equal(ms[0].photo, media.J5[0]);
assert.equal(ms[1].photo, null);
assert.equal(ms.find((m) => m.model === "J7").to, 148800);
assert.equal(ms.find((m) => m.model === "Omoda C9").name, "Omoda C9");
assert.equal(ms.find((m) => m.model === "J8").seats, 7);
assert.equal(hubPath("Jaecoo"), "/new-cars/jaecoo");

const g = hubGroups("Jaecoo", ms).map((x) => x.key);
assert.ok(g.includes("hybrid") && g.includes("electric") && g.includes("seven-seater"));
assert.ok(!g.some((k) => k.startsWith("body-")), "one body type = same as the full list, no section");
assert.ok(!g.includes("under-50000"), "empty band is not shown");
assert.deepEqual(g.filter((k) => k.startsWith("under-")), ["under-150000"], "no band that repeats the whole list");
assert.equal(hubGroups("Jaecoo", ms).find((x) => x.key === "seven-seater").ms.length, 1);

const faqs = hubFaqs("Jaecoo", ms, new Date("2026-11-25"));
assert.ok(faqs[0].a.includes("RM 108,000") && faqs[0].a.includes("RM 205,000"));
assert.ok(faqs.some((f) => /hybrid or electric/.test(f.q)));
assert.ok(faqs.some((f) => /monthly instalment/.test(f.q) && f.a.includes("estimate")));
assert.ok(!faqs.some((f) => /rebate|promo|discount/i.test(f.q + f.a)), "no invented offers");

const c = hubCopy("Jaecoo", ms, new Date("2026-11-25"));
assert.equal(c.title, "Jaecoo Price List Malaysia 2026 | 6 New Models | Drevo");
assert.ok(c.intro.includes("Omoda | Jaecoo"));
assert.ok(c.malay.text.includes("RM 108,000"));
assert.ok(c.description.length <= 200);

const ld = hubJsonLd("Jaecoo", ms, faqs, "https://drevo.my");
assert.equal(ld[0]["@type"], "ItemList");
assert.equal(ld[0].itemListElement[0].image, media.J5[0]);
assert.equal(ld[0].itemListElement[1].image, undefined);

const kw = brandKeywords("Jaecoo", ms, 2026);
assert.ok(kw.length >= 40, `got ${kw.length}`);
assert.ok(kw.includes("jaecoo price malaysia 2026") && kw.includes("omoda c9 price malaysia") && kw.includes("harga kereta jaecoo"));
assert.equal(new Set(kw).size, kw.length);

// A brand with one body type and no EV / hybrid / 7-seater gets no empty sections.
const plain = hubModels("Perodua", [{ brand: "Perodua", model: "Axia", variant: "G", price_peninsular: "33900", is_active: true, body_type: "Hatchback", fuel_type: "Petrol", specs: {} }]);
assert.deepEqual(hubGroups("Perodua", plain).map((x) => x.key), [], "one model, one body: nothing but the list");
console.log("brandHub ok");
