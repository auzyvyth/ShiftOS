import assert from "node:assert/strict";
import { storefrontWhy, storefrontHow, storefrontCta, hasHowItWorks, STOREFRONT_CTA_DEFAULT } from "../src/utils/storefrontCopy.js";

// Nothing written = section hidden, never a default.
assert.equal(storefrontWhy(null, "Acme"), null);
assert.equal(storefrontWhy({ title: "Why us", items: [{ title: " ", desc: "x" }] }, "Acme"), null, "blank boxes from Settings");
assert.equal(storefrontHow(undefined), null);
assert.equal(hasHowItWorks({}), false);
assert.equal(hasHowItWorks(null), false);

// Blanks dropped, the rest kept in order.
const why = storefrontWhy({ title: "", items: [{ title: "Since 1998", desc: "Family run" }, { title: "", desc: "" }, { title: " Warranty ", desc: " 1 year " }] }, "Acme Motors");
assert.equal(why.title, "Why choose Acme Motors", "blank title names the dealer");
assert.deepEqual(why.items, [{ title: "Since 1998", desc: "Family run" }, { title: "Warranty", desc: "1 year" }]);
assert.equal(storefrontWhy({ items: [{ title: "A" }] }, "").title, "Why choose us");
assert.equal(storefrontWhy({ title: " Our promise ", items: [{ title: "A" }] }, "X").title, "Our promise");

const how = storefrontHow({ title: "", steps: [{ title: "Visit" }] });
assert.equal(how.title, "How it works");
assert.equal(hasHowItWorks({ storefront_how: { steps: [{ title: "Visit" }] } }), true);

// CTA: each blank field falls back alone; no first-person words.
assert.deepEqual(storefrontCta(null), STOREFRONT_CTA_DEFAULT);
const cta = storefrontCta({ title: "Drive a SuperCar", subtitle: "", primary_label: " ", secondary_label: "Call" });
assert.equal(cta.title, "Drive a SuperCar");
assert.equal(cta.subtitle, STOREFRONT_CTA_DEFAULT.subtitle);
assert.equal(cta.primary_label, STOREFRONT_CTA_DEFAULT.primary_label);
assert.equal(cta.secondary_label, "Call");
for (const v of Object.values(STOREFRONT_CTA_DEFAULT)) assert.ok(!/\b(I|me|my)\b/.test(v), `dealer team wording: ${v}`);
console.log("storefrontCopy: all passed");
