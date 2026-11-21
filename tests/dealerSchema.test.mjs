import assert from "node:assert/strict";
import { dealerSchema } from "../src/utils/dealerSchema.js";

const url = "https://acme.drevo.my";
assert.equal(dealerSchema(null, url), null);
assert.equal(dealerSchema({ dealership: "  " }, url), null, "no name = no schema");

const full = dealerSchema({
  site_name: "Acme Auto", dealership: "Acme Sdn Bhd", phone: "012-345 6789",
  email: "a@b.c", business_hours: "Mon-Sat 9-6",
  location: "12 Jalan Satu", city: "Shah Alam", state: "Selangor",
  site_logo_url: "https://cdn.example/logo.png", about_text: "x".repeat(400),
  social_facebook: "https://facebook.com/acme", social_instagram: "acme", social_tiktok: "",
}, url);
assert.equal(full["@type"], "AutoDealer");
assert.equal(full.name, "Acme Auto", "site name wins");
assert.equal(full.url, url);
assert.equal(full["@id"], `${url}/#dealer`);
assert.equal(full.telephone, "012-345 6789");
assert.equal(full.address.streetAddress, "12 Jalan Satu");
assert.equal(full.address.addressCountry, "MY");
assert.ok(full.hasMap.includes("Shah%20Alam"));
assert.deepEqual(full.sameAs, ["https://facebook.com/acme"], "only real URLs");
assert.equal(full.description.length, 300, "about text capped");
assert.equal(full.email, undefined, "never email");
assert.equal(full.openingHours, undefined, "free-text hours never go in");
assert.equal(full.aggregateRating, undefined, "never a rating");

const bare = dealerSchema({ dealership: "Bare Motors" }, url);
assert.equal(bare.name, "Bare Motors");
for (const k of ["address", "telephone", "logo", "sameAs", "description", "hasMap"]) assert.equal(bare[k], undefined, k);
console.log("dealerSchema: all passed");
