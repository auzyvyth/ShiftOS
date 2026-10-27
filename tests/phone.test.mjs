// One Malaysian phone rule (src/lib/phone.js). Run: npm run test:phone
import assert from "node:assert/strict";
import { toLocalDigits, toPlus60, isValidMyPhone, normalizePhone, formatMyPhone } from "../src/lib/phone.js";

// Typing the whole number into a box that already shows +60 counts it once.
for (const raw of ["0123456789", "+60123456789", "60123456789", "+60 12-345 6789", "0060123456789", "123456789"]) {
  assert.equal(toLocalDigits(raw), "123456789", raw);
  assert.equal(toPlus60(raw), "+60123456789", raw);
  assert.equal(normalizePhone(raw), "60123456789", raw);
}
// Extra digits are cut at the longest real number, never saved.
assert.equal(toLocalDigits("01234567891234"), "1234567891");
assert.equal(toPlus60(""), "");
assert.equal(toPlus60("+60"), "");

// Mobile: 01X + 7 digits, 011 / 015 + 8.
assert.ok(isValidMyPhone("0123456789"));
assert.ok(isValidMyPhone("01112345678"));
assert.ok(isValidMyPhone("01546001234"));
assert.ok(!isValidMyPhone("012345678"), "012 one short");
assert.ok(!isValidMyPhone("01234567890"), "012 one extra");
assert.ok(!isValidMyPhone("0111234567"), "011 one short");
// Landlines: 03 + 8, 04-07/09 + 7, Sabah/Sarawak 08X + 6.
assert.ok(isValidMyPhone("0312345678"));
assert.ok(isValidMyPhone("042345678"));
assert.ok(isValidMyPhone("088123456"));
assert.ok(!isValidMyPhone("0312345678", { mobileOnly: true }), "WhatsApp must be mobile");
// Junk.
assert.ok(!isValidMyPhone(""));
assert.ok(!isValidMyPhone("1212112"));
assert.ok(!isValidMyPhone("6591234567"), "Singapore is not accepted");

assert.equal(formatMyPhone("0123456789"), "+60 12-345 6789");
assert.equal(formatMyPhone("01112345678"), "+60 11-1234 5678");
assert.equal(formatMyPhone("0312345678"), "+60 3-1234 5678");
console.log("phone: all passed");
