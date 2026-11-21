import assert from "node:assert/strict";
import { checkTradeIn, tradeInNote, tradeInWhatsApp } from "../src/utils/tradeIn.js";

const now = new Date("2026-11-20");
const ok = checkTradeIn({ brand: "  Perodua ", model: "Myvi  1.5", year: "2018", mileage: "85,000" }, now);
assert.ok(ok.ok);
assert.deepEqual(ok.car, { brand: "Perodua", model: "Myvi 1.5", year: 2018, mileage: 85000 });
assert.equal(tradeInNote(ok.car), "Trade-in: 2018 Perodua Myvi 1.5, about 85,000 km");
assert.equal(tradeInWhatsApp(ok.car, "Acme Motors"),
  "Hi Acme Motors, I'd like to trade in my 2018 Perodua Myvi 1.5, about 85,000 km. Can you let me know what you could offer?");

const noKm = checkTradeIn({ brand: "Proton", model: "Saga", year: 2012, mileage: "" }, now);
assert.ok(noKm.ok, "mileage optional");
assert.equal(noKm.car.mileage, null);
assert.equal(tradeInNote(noKm.car), "Trade-in: 2012 Proton Saga");
assert.equal(tradeInWhatsApp(noKm.car, ""), "Hi, I'd like to trade in my 2012 Proton Saga. Can you let me know what you could offer?");

const bad = checkTradeIn({ brand: "", model: " ", year: 1975, mileage: "9999999" }, now);
assert.equal(bad.ok, false);
assert.deepEqual(Object.keys(bad.errors).sort(), ["brand", "mileage", "model", "year"]);
assert.equal(checkTradeIn({ brand: "a", model: "b", year: 2028 }, now).errors.year, "Pick the year", "no future cars");
assert.equal(checkTradeIn({ brand: "x".repeat(80), model: "b", year: 2020 }, now).car.brand.length, 40, "capped");
assert.ok(!/RM|offer of|worth/i.test(tradeInNote(ok.car)), "never a price");
console.log("tradeIn: all passed");
