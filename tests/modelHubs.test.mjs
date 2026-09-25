// Run: npm run test:hubs
//
// Brand/model hub pages (/used-cars/...). Rows below are shaped like
// public_car_listings, including the pre-cleanup spellings that were live
// until 2026-09-25 ("ALPHARD 2.5L", "Rx350", "992 GT3"), so a regression in
// grouping shows up as a split hub here before it shows up on Google.
import { buildHubs, findHub, hubCopy, hubPath, hubSlug, hubCarFilter, hubCrumbs } from '../src/utils/modelHubs.js';

let pass = 0;
const fails = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++;
  else fails.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else fails.push(label); }

const R = (brand, model, status, selling_price, year, state = 'Kuala Lumpur') => ({ brand, model, status, selling_price, year, state });
const rows = [
  R('Toyota', 'Alphard', 'available', 287000, 2024),
  R('Toyota', 'ALPHARD 2.5L', 'available', 193000, 2021, 'Selangor'),
  R('Toyota', 'Alphard', 'reserved', 295000, 2025),
  R('Toyota', 'Alphard', 'sold', 280000, 2024),
  R('Toyota', 'Harrier', 'available', 182000, 2025),
  R('Lexus', 'Rx350', 'available', 305000, 2023),
  R('Lexus', 'RX', 'available', 310000, 2023),
  R('Porsche', '992 GT3', 'sold', 1190000, 2022),   // sold only -> no hub
  R('Daihatsu', 'Move Canbus', 'available', 110000, 2025),
  R('Toyota', 'Alphard', 'unpublished', 1, 2020),     // not live, not sold: ignored in counts
];

// ── slugs / paths ──
eq(hubSlug('Mercedes-Benz'), 'mercedes-benz', 'brand slug keeps hyphen');
eq(hubSlug('Move Canbus'), 'move-canbus', 'model slug');
eq(hubSlug('Rolls Royce'), 'rolls-royce', 'space to hyphen');
eq(hubPath('Toyota', 'Alphard'), '/used-cars/toyota/alphard', 'model path');
eq(hubPath('Toyota'), '/used-cars/toyota', 'brand path');
eq(hubPath(), '/used-cars', 'index path');

// ── grouping ──
const hubs = buildHubs(rows);
const { brand: toyota, model: alphard } = findHub(hubs, 'toyota', 'alphard');
ok(toyota && alphard, 'toyota/alphard hub exists');
eq(alphard.count, 3, 'legacy "ALPHARD 2.5L" joins the Alphard hub (available + reserved)');
eq(alphard.sold, 1, 'sold counted separately');
eq([alphard.minPrice, alphard.maxPrice], [193000, 295000], 'price range from live cars only');
eq([alphard.minYear, alphard.maxYear], [2021, 2025], 'year range');
eq(alphard.states, ['Kuala Lumpur', 'Selangor'], 'states, sorted and unique');
eq(alphard.pairs.length, 2, 'both stored spellings kept for the fetch filter');
eq(findHub(hubs, 'lexus', 'rx').model?.count, 2, '"Rx350" and "RX" are one RX hub');
eq(findHub(hubs, 'porsche').brand, null, 'brand with only sold cars gets no hub (dead end)');
eq(hubs[0].slug, 'toyota', 'brands ordered by live count');
eq(toyota.models.map((m) => m.slug), ['alphard', 'harrier'], 'models ordered by live count');
eq(findHub(hubs, 'toyota', 'nope').model, null, 'unknown model slug resolves to null');

// ── fetch filter ──
const f = hubCarFilter(toyota, alphard);
ok(f.includes('and(brand.eq."Toyota",model.eq."Alphard")') && f.includes('model.eq."ALPHARD 2.5L"'), 'filter selects every spelling');
ok(!/model\.eq\."Harrier"/.test(f), 'model filter does not pull sibling models');
ok(/Harrier/.test(hubCarFilter(toyota)), 'brand filter covers all its models');
eq(hubCarFilter({ models: [{ pairs: [{ brand: 'A"b', model: 'c,d' }] }] }), 'and(brand.eq."Ab",model.eq."c,d")', 'quotes stripped inside values');

// ── copy: every number comes from the data ──
const c = hubCopy(toyota, alphard);
eq(c.h1, 'Used Toyota Alphard for sale', 'h1');
ok(c.title.startsWith('Used Toyota Alphard for Sale in Malaysia'), 'title');
ok(c.intro.includes('3 Toyota Alphard cars') && c.intro.includes('RM 193,000 to RM 295,000'), 'intro quotes real count + range');
ok(c.faqs[0].a.includes('asking prices'), 'price FAQ says asking price, not a promise');
ok(c.faqs.some((q) => q.a.includes('1 Toyota Alphard has been sold')), 'sold FAQ uses real count');
ok(!/\d+(\.\d+)?%/.test(JSON.stringify(c)), 'no percentages / rates anywhere in the copy');
const bc = hubCopy(toyota);
ok(bc.faqs.some((q) => q.a.startsWith('Alphard (3), Harrier (1)')), 'brand FAQ lists models with counts');
eq(hubCrumbs(toyota, alphard).map((x) => x.path), ['/', '/used-cars', '/used-cars/toyota', '/used-cars/toyota/alphard'], 'breadcrumb trail');

console.log(`modelHubs: ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((x) => `  FAIL ${x}`).join('\n')); process.exit(1); }
