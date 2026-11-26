import assert from "node:assert/strict";
import { newModelCopy, modelDisplayName, aliasOf } from "../src/utils/newCars.js";

const rows = [{ brand: "Jaecoo", model: "Omoda C9", variant: "2.0T 2WD", price_peninsular: "168800", is_active: true }];

// Omoda models filed under Jaecoo keep their own name: nobody searches "Jaecoo Omoda C9".
assert.equal(modelDisplayName("Jaecoo", "Omoda C9"), "Omoda C9");
assert.equal(modelDisplayName("Jaecoo", "Omoda C9 PHEV"), "Omoda C9 PHEV");
assert.equal(modelDisplayName("Jaecoo", "J7"), "Jaecoo J7");
assert.equal(modelDisplayName("Honda", "City"), "Honda City");
assert.equal(aliasOf("Jaecoo", "J7"), null);
assert.equal(aliasOf("Honda", "Omoda C9"), null);

const c9 = newModelCopy("Jaecoo", "Omoda C9", rows);
assert.equal(c9.title, "New Omoda C9 price in Malaysia | Drevo");
assert.equal(c9.h1, "New Omoda C9");
assert.ok(c9.intro.startsWith("Omoda and Jaecoo are sold together in Malaysia (Omoda | Jaecoo)."));
assert.ok(c9.description.includes("RM"));

const j7 = newModelCopy("Jaecoo", "J7", rows);
assert.equal(j7.title, "New Jaecoo J7 price in Malaysia | Drevo");
assert.ok(!j7.intro.includes("Omoda"));

// Other brands are unchanged.
assert.equal(newModelCopy("Honda", "City", rows).title, "New Honda City price in Malaysia | Drevo");
console.log("newCarCopy ok");
