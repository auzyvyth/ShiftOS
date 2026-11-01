import assert from "node:assert/strict";
import { aboutPayload, aboutForm, aboutFacts, hasPhoneLikeNumber } from "../src/utils/agentAbout.js";

assert.deepEqual(aboutPayload({ years: "", languages: [], areas: " ", promise: "" }),
  { years_selling: null, languages: null, areas_covered: null, my_promise: null }, "all empty = nulls");
assert.deepEqual(aboutPayload({ years: "7", languages: ["ms", "en", "ms", "xx"], areas: "Klang Valley", promise: "I answer within the hour" }),
  { years_selling: 7, languages: ["ms", "en"], areas_covered: "Klang Valley", my_promise: "I answer within the hour" }, "dedupe + unknown language dropped");
assert.deepEqual(aboutPayload({ years: "61" }), { error: "years" });
assert.deepEqual(aboutPayload({ years: "2.5" }), { error: "years" });
assert.deepEqual(aboutPayload({ promise: "WhatsApp me 012-345 6789" }), { error: "promise" }, "spaced phone number refused");
assert.deepEqual(aboutPayload({ areas: "Call 0123456789" }), { error: "areas" });
assert.equal(hasPhoneLikeNumber("Since 2015, 300 cars"), false, "years and counts are fine");
assert.equal(aboutPayload({ promise: "x".repeat(200) }).my_promise.length, 160, "cut to the limit");

assert.deepEqual(aboutForm({ years_selling: 0, languages: ["en"], areas_covered: null, my_promise: "Hi" }),
  { years: "0", languages: ["en"], areas: "", promise: "Hi" });
assert.deepEqual(aboutForm(null), { years: "", languages: [], areas: "", promise: "" });

assert.deepEqual(aboutFacts({ years_selling: 1, languages: ["ms", "zh"], areas_covered: "Johor" }).map((f) => f.text),
  ["1 year selling cars", "Speaks Bahasa Melayu, Mandarin", "Covers Johor"]);
assert.deepEqual(aboutFacts({ years_selling: 0 }), [], "0 years is not shown");
assert.deepEqual(aboutFacts(null), []);
console.log("agentAbout: all passed");
