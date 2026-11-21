// Delivery photos ("Happy customers", STOREFRONT-2 stage 4 phase C): the words under a photo.
// The browser rules (src/utils/deliveryCaption.js) and the database CHECKs (migration 20261121b)
// must say the same, or the panel lets a dealer type something the save then refuses.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAPTION_MAX, CAR_NAME_MAX, DELIVERY_CAP, SITE_SHOWS, hasNumberRun, cleanCaption, cleanCarName,
  textProblem, monthValue, monthLabel, deliveryCards, deliveryFolder, deliveryPathOf,
} from "../src/utils/deliveryCaption.js";

// Phone and IC numbers, however they are typed, are refused; short numbers (year, cc) are fine.
for (const bad of ["0123456789", "012-345 6789", "+60 12-345 6789", "(012) 345.6789", "900101-14-5678", "Call 0123456"]) {
  assert.ok(hasNumberRun(bad), `refused: ${bad}`);
  assert.ok(textProblem(bad), `problem shown: ${bad}`);
}
for (const ok of ["Honda City 1.5 V 2020", "Myvi 1.5 AV", "Congrats Encik A!", "BMW 320i 2019 2.0", "X50 1.5T"]) {
  assert.ok(!hasNumberRun(ok), `kept: ${ok}`);
  assert.equal(textProblem(ok), "", `no problem: ${ok}`);
}
assert.equal(cleanCaption("  Drive   safe \n"), "Drive safe");
assert.equal(cleanCaption("a".repeat(80)).length, CAPTION_MAX);
assert.equal(cleanCarName("b".repeat(100)).length, CAR_NAME_MAX);
assert.match(textProblem("a".repeat(61)), /60/);
assert.ok(textProblem("", { required: true }), "the car is required");
assert.equal(textProblem(""), "", "an empty caption is fine");

// Months: first of the month, never the future, never before 2000.
const now = new Date(2026, 10, 21);
assert.equal(monthValue("2026-11", now), "2026-11-01");
assert.equal(monthValue("2026-10-15", now), "2026-10-01");
assert.equal(monthValue("2026-12", now), null, "next month refused");
assert.equal(monthValue("1999-12", now), null);
assert.equal(monthValue("2026-13", now), null);
assert.equal(monthValue("", now), null);
assert.equal(monthLabel("2026-11-01"), "Nov 2026");
assert.equal(monthLabel("junk"), "");

// The site re-applies the rules: a bad row never prints a number, a row without an https photo is dropped.
const cards = deliveryCards([
  { photo_url: "https://x/a.jpg", car_name: "Honda City", caption: "Call 0123456789", delivered_month: "2026-10-01" },
  { photo_url: "http://x/b.jpg", car_name: "Myvi", caption: null, delivered_month: "2026-09-01" },
  { photo_url: null, car_name: "Vios" },
  null,
]);
assert.equal(cards.length, 1);
assert.deepEqual(cards[0], { photo: "https://x/a.jpg", name: "Honda City", caption: "", when: "Oct 2026" });
assert.equal(deliveryCards(Array.from({ length: 40 }, () => ({ photo_url: "https://x/a.jpg", car_name: "A" }))).length, SITE_SHOWS);
assert.deepEqual(deliveryCards(undefined), []);

// Storage path: deliveries/<dealer>/..., and only this dealer's folder is read back.
const D = "11111111-2222-3333-4444-555555555555";
assert.equal(deliveryFolder(D), `deliveries/${D}`);
assert.equal(deliveryPathOf(`https://p.supabase.co/storage/v1/object/public/car-images/deliveries/${D}/x%20y.jpg?t=1`, D), `deliveries/${D}/x y.jpg`);
assert.equal(deliveryPathOf("https://p.supabase.co/storage/v1/object/public/car-images/deliveries/other/x.jpg", D), null);

// The database says the same.
const sql = readFileSync(new URL("../supabase/migrations/20261121b_storefront_delivery_gallery.sql", import.meta.url), "utf8");
assert.match(sql, new RegExp(`length\\(caption\\) <= ${CAPTION_MAX}`), "caption cap = JS");
assert.match(sql, new RegExp(`between 1 and ${CAR_NAME_MAX}`), "car name cap = JS");
assert.match(sql, new RegExp(`>= ${DELIVERY_CAP} then`), "photo cap = JS");
assert.match(sql, new RegExp(`limit ${SITE_SHOWS};`), "site shows = JS");
assert.equal((sql.match(/regexp_replace\((caption|car_name), '\[\[:space:\]\(\)\.\+-\]', '', 'g'\) !~ '\[0-9\]\{7,\}'/g) || []).length, 2,
  "both columns strip the same separators (space ( ) . + -) and refuse a 7+ digit run, like hasNumberRun");
assert.match(sql, /'\/storage\/v1\/object\/public\/car-images\/deliveries\/' \|\| dealer_id::text/, "photo must sit in deliveryFolder");
assert.match(sql, /consent_how in \('written', 'whatsapp'\)/);
assert.ok(!/buyer_name|phone|plate|ic_number/i.test(sql.split("create table if not exists public.storefront_deliveries")[1].split(");")[0]),
  "no buyer name, phone, IC or plate column");
console.log("deliveryCaption: all passed");
