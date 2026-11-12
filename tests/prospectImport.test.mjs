// Prospect paste import (src/utils/prospectImport.js). Run: npm run test:prospects
import assert from "node:assert/strict";
import { cleanProfileUrl, parseProspectLine, parseProspectPaste, sourceFromUrl, MAX_PASTE } from "../src/utils/prospectImport.js";

// Same cleaning as SQL prospect_clean_url (migration 20261104a).
assert.equal(cleanProfileUrl("https://www.facebook.com/ali.proton?mibextid=abc"), "facebook.com/ali.proton");
assert.equal(cleanProfileUrl("https://m.facebook.com/ali.proton/"), "facebook.com/ali.proton");
assert.equal(cleanProfileUrl("https://www.facebook.com/ali.proton/?x=1"), "facebook.com/ali.proton");
assert.equal(cleanProfileUrl("https://www.facebook.com/profile.php?id=1000123&mibextid=x"), "facebook.com/profile.php?id=1000123");
assert.equal(cleanProfileUrl("https://m.facebook.com/profile.php?ref=a&id=55"), "facebook.com/profile.php?id=55");
assert.equal(cleanProfileUrl("https://www.tiktok.com/@SA_Perodua/live?lang=en"), "tiktok.com/@sa_perodua");
assert.equal(cleanProfileUrl("vt.tiktok.com/ZS123/"), "vt.tiktok.com/zs123");
assert.equal(cleanProfileUrl("   "), null);

assert.equal(sourceFromUrl("facebook.com/ali"), "facebook");
assert.equal(sourceFromUrl("tiktok.com/@a"), "tiktok");
assert.equal(sourceFromUrl("instagram.com/a"), "social");

// Columns in any order; link and phone found by shape.
const a = parseProspectLine("Ali Rahman\thttps://www.facebook.com/ali.proton\tProton\tShah Alam");
assert.deepEqual(a, { name: "Ali Rahman", profile_url: "facebook.com/ali.proton", phone: null, brand: "Proton", area: "Shah Alam", notes: null });
const b = parseProspectLine("Siti, Perodua, 012-345 6789, Kajang, does lives at 9pm");
assert.equal(b.phone, "60123456789");
assert.equal(b.brand, "Perodua");
assert.equal(b.area, "Kajang");
assert.equal(b.notes, "does lives at 9pm");

// Paste: header skipped, dupes against the list and inside the paste, DNC named.
const existing = [
  { id: "1", name: "Old Ali", profile_url: "facebook.com/ali.proton", phone: null, do_not_contact: false },
  { id: "2", name: "Stop Guy", profile_url: "tiktok.com/@stopme", phone: null, do_not_contact: true },
];
const paste = [
  "Name\tLink\tBrand\tArea",
  "Ali\thttps://m.facebook.com/ali.proton/\tProton\tShah Alam",
  "Stop\thttps://www.tiktok.com/@StopMe/live\tPerodua",
  "New One\thttps://www.tiktok.com/@newone\tPerodua\tIpoh",
  "New One again\ttiktok.com/@newone/\tPerodua",
  "\thttps://facebook.com/noname",
  "No link\tProton\tKL",
].join("\n");
const r = parseProspectPaste(paste, existing);
assert.equal(r.rows.length, 1);
assert.equal(r.rows[0].name, "New One");
assert.equal(r.rows[0].source, "tiktok");
assert.equal(r.rows[0].kind, "salesman");
assert.deepEqual(r.skipped.map((s) => s.reason), [
  "Already on the list (Old Ali)",
  "Asked not to be contacted",
  "Twice in this paste (New One)",
  "No name",
  "No profile link or number",
]);

// Cap per paste.
const many = Array.from({ length: MAX_PASTE + 3 }, (_, i) => `P${i}\tfacebook.com/p${i}`).join("\n");
const m = parseProspectPaste(many, []);
assert.equal(m.rows.length, MAX_PASTE);
assert.equal(m.skipped.length, 3);

console.log("prospectImport: all good");
