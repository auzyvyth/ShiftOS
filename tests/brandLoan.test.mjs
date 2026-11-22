import assert from "node:assert/strict";
import { loanModels, loanCopy, loanMonthly, loanRate, loanPath, loanBrandFromSlug } from "../src/utils/brandLoan.js";
import { monthlyPayment } from "../src/utils/financing.js";

const rows = [
  { brand: "Perodua", model: "Myvi", variant: "1.5 AV", price_peninsular: "59900", is_active: true },
  { brand: "Perodua", model: "Myvi", variant: "1.3 G", price_peninsular: "46500", is_active: true },
  { brand: "Perodua", model: "Axia", variant: "E", price_peninsular: "22000", is_active: true },
  { brand: "Perodua", model: "Axia", variant: "Old", price_peninsular: "20000", is_active: false },
  { brand: "Perodua", model: "QV-E", variant: "X", price_peninsular: null, is_active: true },
  { brand: "Proton", model: "Saga", variant: "S", price_peninsular: "38990", is_active: true },
];
const m = loanModels("Perodua", rows);
assert.deepEqual(m.map((x) => x.model), ["Axia", "Myvi"], "cheapest first, other brands, inactive and unpriced out");
assert.equal(m[1].variants[0].variant, "1.3 G");
assert.equal(m[0].path, "/new-cars/perodua/axia");
assert.equal(loanRate("Perodua"), 4.8);
assert.equal(loanRate("Toyota"), 6.5);
assert.equal(loanMonthly(22000, { years: 9, rate: 4.8 }), Math.round(monthlyPayment(19800, 4.8, 108)));
assert.equal(loanMonthly(22000, { depositPct: 100, rate: 4.8 }), 0);
assert.equal(loanMonthly(null, { rate: 4.8 }), null);
assert.equal(loanPath("BYD"), "/kalkulator-loan/byd");
assert.equal(loanBrandFromSlug("perodua"), "Perodua");
assert.equal(loanBrandFromSlug("ford"), null);
const c = loanCopy("Perodua", m, new Date("2026-11-22"));
assert.match(c.title, /Kalkulator Loan Perodua 2026/);
assert.match(c.intro, new RegExp(`RM ${loanMonthly(22000, { years: 9, rate: 4.8 })}`));
assert.ok(c.faqs.length >= 5 && c.faqs.every((f) => f.q && f.a));
assert.ok(!/undefined|NaN/.test(JSON.stringify(c)));
assert.ok(!/undefined|NaN/.test(JSON.stringify(loanCopy("Honda", []))));
console.log("brandLoan: ok");
