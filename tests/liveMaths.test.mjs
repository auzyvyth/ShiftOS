// Live presentation: salary guide, flat-rate conversion, after-live report.
// Run: npm run test:live
import { salaryGuide, eirForTenure, liveReport, fmtRate, SALARY_SHARE, maxMonthlyFromPay, budgetMatches, budgetAll, netPrice, carLabel,
  maxTenureYears, tenuresFor, rebatesForMonth, myMonth, monthEnd, clampRateInput, depositToFit, rateWarning, eirCap, isLocalNew, LOCAL_NEW_EIR,
  dsrOf, DSR_TIGHT, tightCapFromPay, priceForMonthly, shortVariantNames, variantExtras } from '../src/utils/liveMaths.js';
import { monthlyPayment } from '../src/utils/financing.js';
import { motorPremium, insuranceRegion, NCD_TIERS, ncdLabel } from '../src/utils/motorInsurance.js';
import { accentTheme, hexToRgb, contrastWithWhite, ACCENT_PRESETS, DEFAULT_ACCENT } from '../src/utils/liveAccent.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

is('salary: share is 35%', SALARY_SHARE, 0.35);
is('salary: 711.51 rounds up to 2,100', salaryGuide(711.51), 2100);
is('salary: exact hundred stays', salaryGuide(700), 2000);
is('salary: zero is null', salaryGuide(0), null);
is('salary: junk is null', salaryGuide('x'), null);

// The screenshot: RM62,000, 2.66% flat, 9 years = RM711.51 a month.
const eir9 = eirForTenure(2.66, 'flat', 9);
is('flat: converts to ~4.91% EIR at 9 yrs', fmtRate(Math.round(eir9 * 100) / 100), '4.91');
is('flat: same instalment as the flat quote', monthlyPayment(62000, eir9, 108).toFixed(2), '711.51');
is('flat: differs by tenure', eirForTenure(2.66, 'flat', 5) !== eir9, true);
is('eir: passes through', eirForTenure(6.5, 'eir', 7), 6.5);
is('eir: negative clamps to 0', eirForTenure(-1, 'eir', 7), 0);

const listings = [{ id: 'a', year: 2021, brand: 'Honda', model: 'City' }, { id: 'b', year: 2019, brand: 'Proton', model: 'X70' }];
const r = liveReport({
  events: [
    { event_type: 'minipage_view', session_id: 's1' },
    { event_type: 'minipage_view', session_id: 's1' },
    { event_type: 'minipage_view', session_id: 's2' },
    { event_type: 'minipage_card_click', car_id: 'b' },
    { event_type: 'minipage_card_click', car_id: 'b' },
    { event_type: 'minipage_card_click', car_id: 'a' },
    { event_type: 'minipage_card_click', car_id: 'gone' },
    { event_type: 'whatsapp_click' },
  ],
  newLeads: 2, listings,
  startedAt: '2026-10-03T12:00:00Z', endedAt: '2026-10-03T12:47:10Z',
});
is('report: distinct visitors', r.visitors, 2);
is('report: car taps', r.carTaps, 4);
is('report: whatsapp taps', r.whatsappTaps, 1);
is('report: minutes', r.minutes, 47);
is('report: top car is #2', r.topCar, { n: 2, name: '2019 Proton X70', taps: 2 });
is('report: leads', r.newLeads, 2);
is('report: failed leads read is null', liveReport({ events: [], newLeads: undefined, listings, startedAt: 0, endedAt: 0 }).newLeads, null);
is('report: one tap is not a "most tapped"', liveReport({ events: [{ event_type: 'minipage_card_click', car_id: 'a' }], listings, startedAt: 0, endedAt: 0 }).topCar, null);
is('report: bio visits count TikTok + Instagram sessions once', liveReport({ events: [
  { event_type: 'minipage_view', session_id: 's1', metadata: { channel: 'tiktok' } },
  { event_type: 'minipage_view', session_id: 's1', metadata: { channel: 'tiktok' } },
  { event_type: 'minipage_view', session_id: 's2', metadata: { channel: 'instagram' } },
  { event_type: 'minipage_view', session_id: 's3', metadata: { channel: 'whatsapp' } },
  { event_type: 'minipage_view', session_id: 's4' },
], listings, startedAt: 0, endedAt: 0 }).fromBio, 2);

// Budget mode: the 35% rule backwards.
is('budget: RM3,500 pay -> RM1,225', maxMonthlyFromPay(3500), 1225);
is('budget: rounds down', maxMonthlyFromPay(3333), 1166);
is('budget: zero pay is null', maxMonthlyFromPay(0), null);
is('budget: and forwards again stays under the pay', salaryGuide(maxMonthlyFromPay(3500)) <= 3500, true);

const cars = [
  { id: 'myvi', selling_price: 56000 },
  { id: 'x70', selling_price: 90000 },
  { id: 'nop', selling_price: 0 },
  { id: 'city', selling_price: 75000 },
  { id: 'cheap', selling_price: 4000 },
];
const at = (p, d) => monthlyPayment(p - d, 3, 108);
const b = budgetMatches(cars, { maxMonthly: Math.ceil(at(75000, 5000)), deposit: 5000, years: 9, rate: 3, basis: 'eir' });
is('budget: fits dearest first, keeps #n', b.fits.map((x) => x.n), [4, 1]);
is('budget: fit monthly is the table formula', b.fits[1].monthly, at(56000, 5000));
is('budget: over-budget car listed above', b.above.map((x) => x.n), [2]);
is('budget: unpriced and deposit-covered cars left out', [...b.fits, ...b.above].some((x) => x.n === 3 || x.n === 5), false);
is('budget: no budget, no results', budgetMatches(cars, { maxMonthly: 0, years: 7, rate: 3, basis: 'eir' }), { fits: [], above: [] });
const flat = budgetMatches(cars, { maxMonthly: 100000, deposit: 0, years: 7, rate: 2.5, basis: 'flat' });
is('budget: flat rate converted like the table', flat.fits.find((x) => x.n === 1).monthly, monthlyPayment(56000, eirForTenure(2.5, 'flat', 7), 84));
const near = (p) => monthlyPayment(p, 3, 84);
const many = [{ selling_price: 50000 }, { selling_price: 51000 }, { selling_price: 52000 }, { selling_price: 200000 }];
const m2 = budgetMatches(many, { maxMonthly: near(49000), years: 7, rate: 3, basis: 'eir' });
is('budget: at most two just-over cars, cheapest first', m2.above.map((x) => x.n), [1, 2]);
is('budget: a car far over budget is not "just above"', budgetMatches(many, { maxMonthly: near(100000), years: 7, rate: 3, basis: 'eir' }).above.length, 0);

// A model card expanded per variant (presenter budgetCars): one row per car, named.
const card = [55000, 62000, 70000].map((p, k) => ({ id: 'x50', _n: 2, _variantId: `v${k}`, variant: `V${k}`, selling_price: p }));
const cb = budgetMatches([{ id: 'saga', selling_price: 40000 }, ...card], { maxMonthly: near(63000), years: 7, rate: 3, basis: 'eir' });
is('budget: model card keeps ONE fit, its dearest variant', cb.fits.map((x) => [x.n, x.car.variant]), [[2, 'V1'], [1, undefined]]);
is('budget: a car that fits is not also "just above"', cb.above.length, 0);
const cu = budgetMatches(card, { maxMonthly: near(52000), years: 7, rate: 3, basis: 'eir' });
is('budget: no variant fits -> its cheapest is just above, once', cu.above.map((x) => x.car.variant), ['V0']);
is('label: names the variant', carLabel({ year: 2022, brand: 'Lexus', model: 'IS', variant: '300 F Sport' }), '2022 Lexus IS 300 F Sport');
is('label: no variant, no gap', carLabel({ year: 2025, brand: 'Honda', model: 'Civic' }), '2025 Honda Civic');

is('rebate: net is price minus rebate', netPrice({ id: 'a', selling_price: 75000 }, { a: '3000' }), { price: 75000, rebate: 3000, net: 72000 });
is('rebate: none typed', netPrice({ id: 'a', selling_price: 75000 }, {}).net, 75000);
is('rebate: capped at the price', netPrice({ id: 'a', selling_price: 5000 }, { a: 9000 }).net, 0);
const rb = budgetMatches([{ id: 'a', selling_price: 75000 }], { maxMonthly: 100000, deposit: 5000, years: 7, rate: 3, basis: 'eir', rebates: { a: 3000 } });
is('rebate: budget uses the net price', rb.fits[0].monthly, monthlyPayment(67000, 3, 84));

// Accent colour: every result must carry white text, at the light end too.
const readable = (hex) => contrastWithWhite(hexToRgb(accentTheme(hex).light)) >= 3;
is('accent: every preset is readable', ACCENT_PRESETS.every(readable), true);
is('accent: default red is unchanged', accentTheme(DEFAULT_ACCENT).accent, DEFAULT_ACCENT);
is('accent: yellow is darkened until readable', readable('#FFEB3B') && accentTheme('#FFEB3B').accent !== '#FFEB3B', true);
is('accent: white is darkened until readable', readable('#FFFFFF'), true);
is('accent: junk falls back to the default', accentTheme('nope').accent, DEFAULT_ACCENT);


// Insurance (motorInsurance.js), checked against a seller's live Excel:
// Proton X50 1.5T (1477cc), RM89,800, 0% NCD -> sheet said RM2,869.
const x50 = motorPremium({ sumInsured: 89800, cc: 1477, ncd: 0, region: 'west' });
is('ins: X50 tariff 305.50 + 89 x 26', x50.gross, 2620);
is('ins: X50 total with SST + stamp', x50.total, 2840);
is('ins: breakdown adds up to the total', x50.gross - x50.ncdOff + x50.sst + x50.stampDuty, x50.total);
is('ins: within 2% of the seller sheet', Math.abs(x50.total - 2869) / 2869 < 0.02, true);
is('ins: 55% NCD', motorPremium({ sumInsured: 89800, cc: 1477, ncd: 55 }).total, 1283);
is('ins: East Malaysia is cheaper', motorPremium({ sumInsured: 89800, cc: 1477, region: 'east' }).total < x50.total, true);
is('ins: no cc (EV) is null, never a guess', motorPremium({ sumInsured: 120000, cc: null }), null);
is('ins: no price is null', motorPremium({ sumInsured: 0, cc: 1500 }), null);
is('ins: unknown NCD falls back to 0', motorPremium({ sumInsured: 89800, cc: 1477, ncd: 12 }).total, 2840);
is('ins: region Sabah', insuranceRegion('Kota Kinabalu, Sabah'), 'east');
is('ins: region Labuan', insuranceRegion('Labuan'), 'east');
is('ins: region Selangor', insuranceRegion('Selangor'), 'west');
is('ins: NCD tiers', NCD_TIERS, [0, 25, 30, 38.33, 45, 55]);
is('ins: 38.33 label', ncdLabel(38.33), '38⅓%');

// The seller's whole sheet: (89,800 + 2,869 - 8,000) at 2.4% flat, 9 yrs = RM953.33.
is('ins: sheet monthly matches through EIR', monthlyPayment(89800 + 2869 - 8000, eirForTenure(2.4, 'flat', 9), 108).toFixed(2), '953.31');

// Budget adds the same insurance the Cars screen does.
const bl = [{ id: 'x', selling_price: 89800, engine_cc: 1477 }];
const noIns = budgetMatches(bl, { maxMonthly: 5000, years: 9, rate: 4, basis: 'eir' }).fits[0].monthly;
const withIns = budgetMatches(bl, { maxMonthly: 5000, years: 9, rate: 4, basis: 'eir', extraFor: () => 2839 }).fits[0].monthly;
is('budget: insurance raises the monthly', withIns > noIns, true);
is('budget: by exactly the financed insurance', withIns.toFixed(2), monthlyPayment(89800 + 2839, 4, 108).toFixed(2));

// Tenure by car age: about 15 years old at the end of the loan.
is('tenure: new car keeps 9', maxTenureYears({ condition: 'new', year: 2010 }, 2026), 9);
is('tenure: no year keeps 9', maxTenureYears({}, 2026), 9);
is('tenure: 2024 used keeps 9', maxTenureYears({ year: 2024 }, 2026), 9);
is('tenure: 2017 used max 6', maxTenureYears({ year: 2017 }, 2026), 6);
is('tenure: 2017 offers 5 only', tenuresFor([5, 7, 9], { year: 2017 }, 2026), [5]);
is('tenure: 2014 offers its own 3', tenuresFor([5, 7, 9], { year: 2014 }, 2026), [3]);
is('tenure: 2010 is too old', tenuresFor([5, 7, 9], { year: 2010 }, 2026), []);
const old = [{ id: 'o', selling_price: 40000, year: 2017 }];
const ob = budgetMatches(old, { maxMonthly: 5000, years: 9, rate: 5, basis: 'eir', yearsFor: (c) => maxTenureYears(c, 2026) });
is('budget: an old car is priced at its own limit', ob.fits[0].years, 6);
is('budget: a car too old for a loan is left out', budgetMatches([{ id: 'z', selling_price: 9000, year: 2008 }], { maxMonthly: 5000, years: 7, rate: 5, basis: 'eir', yearsFor: (c) => maxTenureYears(c, 2026) }).fits.length, 0);

// Deposit to fit: rounded up to RM100, so the monthly lands at or under the target.
const dep = depositToFit({ price: 80000, cap: 1000, eir: 6.5, years: 7 });
is('fit: deposit is a round hundred', dep % 100, 0);
is('fit: monthly at or under the target', monthlyPayment(80000 - dep, 6.5, 84) <= 1000, true);
is('fit: RM100 less would miss it', monthlyPayment(80000 - dep + 100, 6.5, 84) > 1000, true);
is('fit: already under target needs none', depositToFit({ price: 30000, cap: 2000, eir: 6.5, years: 7 }), 0);
is('fit: insurance counts', depositToFit({ price: 80000, extra: 3000, cap: 1000, eir: 6.5, years: 7 }) > dep, true);
const near1 = monthlyPayment(70000, 3, 84) * 0.9;
const ab = budgetMatches([{ id: 'u', selling_price: 70000 }], { maxMonthly: near1, years: 7, rate: 3, basis: 'eir' });
is('budget: just-above row says the extra deposit', ab.above[0].topUp > 0 && ab.above[0].topUp % 100 === 0, true);
is('budget: that deposit makes it fit', monthlyPayment(70000 - ab.above[0].topUp, 3, 84) <= near1, true);

// Rate sanity.
is('rate: 2.88 on EIR looks flat', rateWarning(2.88, 'eir', 7), 'looksFlat');
is('rate: 2.88 flat is fine', rateWarning(2.88, 'flat', 7), null);
is('rate: 6.5 EIR fine', rateWarning(6.5, 'eir', 9), null);
is('rate: caps', [eirCap(5), eirCap(7)], [17, 16]);
is('rate: 16.5 over 7 yrs is above cap', rateWarning(16.5, 'eir', 7), 'aboveCap');
is('rate: 16.5 over 5 yrs is legal', rateWarning(16.5, 'eir', 5), null);
is('rate: empty is no warning', rateWarning('', 'eir', 7), null);

// Rebate per MODEL: one box covers every variant of a card.
const rbs = { m: 2000 };
is('rebate: covers a variant', netPrice({ id: 'm', _variantId: 'v2', selling_price: 45000 }, rbs).net, 43000);
is('rebate: covers the other variant too', netPrice({ id: 'm', _variantId: 'v1', selling_price: 40000 }, rbs).net, 38000);
const rvb = budgetMatches([
  { id: 'm', _n: 1, _variantId: 'v1', variant: 'Standard', selling_price: 40000 },
  { id: 'm', _n: 1, _variantId: 'v2', variant: 'Executive', selling_price: 45000 },
], { maxMonthly: 100000, years: 7, rate: 6.5, basis: 'eir', rebates: { m: 5000 } });
is('rebate: Budget takes it off every variant', rvb.fits[0].options.map((o) => o.price), [35000, 40000]);

// The rate box stops at the legal ceiling; partial input passes through.
is('clamp: 65 becomes 17', clampRateInput('65'), '17');
is('clamp: 6.5 untouched', clampRateInput('6.5'), '6.5');
is('clamp: partial "6." untouched', clampRateInput('6.'), '6.');
is('clamp: empty untouched', clampRateInput(''), '');

// Saved rebates last the month, Malaysia time.
is('month: MYT, not UTC', myMonth('2026-10-31T17:00:00Z'), '2026-11');
is('month: same month', myMonth('2026-10-31T15:59:00Z'), '2026-10');
is('month end: October', monthEnd('2026-10').toISOString().slice(0, 10), '2026-10-31');
is('month end: February', monthEnd('2028-02').toISOString().slice(0, 10), '2028-02-29');
is('saved: this month kept', rebatesForMonth({ month: '2026-10', rebates: { a: '3000', b: 0, c: 'x' } }, '2026-10'), { a: '3000' });
is('saved: last month dropped', rebatesForMonth({ month: '2026-09', rebates: { a: '3000' } }, '2026-10'), {});
is('saved: junk is empty', [rebatesForMonth(null, '2026-10'), rebatesForMonth({ month: '2026-10' }, '2026-10')], [{}, {}]);

// Variant options on a model card's Budget row.
const vcard = [
  { id: 'm', _n: 1, _variantId: 'v1', variant: 'Standard', selling_price: 40000 },
  { id: 'm', _n: 1, _variantId: 'v2', variant: 'Executive', selling_price: 45000 },
  { id: 'm', _n: 1, _variantId: 'v3', variant: 'Premium', selling_price: 60000 },
];
const vb = budgetMatches(vcard, { maxMonthly: monthlyPayment(46000, 6.5, 84), years: 7, rate: 6.5, basis: 'eir' });
is('options: row is the dearest that fits', vb.fits[0].car._variantId, 'v2');
is('options: every variant, cheapest first', vb.fits[0].options.map((o) => o.car._variantId), ['v1', 'v2', 'v3']);
is('options: fits flags', vb.fits[0].options.map((o) => o.fits), [true, true, false]);
is('options: a plain car has none', budgetMatches([{ id: 'p', selling_price: 30000 }], { maxMonthly: 5000, years: 7, rate: 6.5, basis: 'eir' }).fits[0].options, undefined);

// New Proton / Perodua start on their own rate; used ones and other brands do not.
is('local: new Proton', isLocalNew({ brand: 'Proton', condition: 'new' }), true);
is('local: new PERODUA', isLocalNew({ brand: ' PERODUA ', condition: 'new' }), true);
is('local: used Proton', isLocalNew({ brand: 'Proton', condition: 'used' }), false);
is('local: new Toyota', isLocalNew({ brand: 'Toyota', condition: 'new' }), false);
is('local: default rate', LOCAL_NEW_EIR, 4.8);
// Budget prices each car on its own rate when rateOf is given.
const twoCars = [{ id: 'a', brand: 'Proton', condition: 'new', selling_price: 80000 }, { id: 'b', brand: 'Honda', condition: 'used', selling_price: 80000 }];
const rbLocal = budgetMatches(twoCars, { maxMonthly: 5000, years: 7, rate: 6.5, basis: 'eir',
  rateOf: (c) => (isLocalNew(c) ? { rate: 4.8, basis: 'eir' } : { rate: 6.5, basis: 'eir' }) });
const mOf = (id) => rbLocal.fits.find((r) => r.car.id === id).monthly;
is('budget rateOf: Proton at 4.8', Math.round(mOf('a')), Math.round(monthlyPayment(80000, 4.8, 84)));
is('budget rateOf: Honda at 6.5', Math.round(mOf('b')), Math.round(monthlyPayment(80000, 6.5, 84)));

// All cars grid (budgetAll): every car once, with a verdict, same numbers as the list.
const all = budgetAll(cars, { maxMonthly: Math.ceil(at(75000, 5000)), deposit: 5000, years: 9, rate: 3, basis: 'eir' });
is('all: every priced car once, fits first', all.map((x) => [x.n, x.status]), [[4, 'fit'], [1, 'fit'], [2, 'near']]);
is('all: same monthly as the list', all[0].monthly, b.fits[0].monthly);
is('all: a near car has the list\'s top-up', all[2].topUp, b.above[0].topUp);
const allNear = budgetAll(many, { maxMonthly: near(49000), years: 7, rate: 3, basis: 'eir' });
is('all: near cars carry their top-up, over ones do not', allNear.map((x) => [x.n, x.status, x.topUp > 0 || x.topUp]), [[1, 'near', true], [2, 'near', true], [3, 'near', true], [4, 'over', null]]);
is('all: near top-up matches the list', allNear[0].topUp, budgetMatches(many, { maxMonthly: near(49000), years: 7, rate: 3, basis: 'eir' }).above[0].topUp);
const allCard = budgetAll([{ id: 'saga', selling_price: 40000 }, ...card], { maxMonthly: near(63000), years: 7, rate: 3, basis: 'eir' });
is('all: model card once, its dearest variant that fits', allCard.map((x) => [x.n, x.car.variant, x.status]), [[2, 'V1', 'fit'], [1, undefined, 'fit']]);
const allCardNo = budgetAll(card, { maxMonthly: near(30000), years: 7, rate: 3, basis: 'eir' });
is('all: no variant fits -> cheapest variant shown', allCardNo.map((x) => [x.car.variant, x.status]), [['V0', 'over']]);
is('all: no budget, no tiles', budgetAll(cars, { maxMonthly: 0, years: 7, rate: 3, basis: 'eir' }), []);

// DSR in Budget (pay mode): commitments come off the same 35%, bands at 35% / 60%.
is('dsr: commitments come off the 35%', maxMonthlyFromPay(3500, 600), 625);
is('dsr: no commitments = the old rule', maxMonthlyFromPay(3500, 0), maxMonthlyFromPay(3500));
is('dsr: commitments over 35% leave 0, not negative', maxMonthlyFromPay(3000, 2000), 0);
is('dsr: ratio includes the car', Math.round(dsrOf(625, 600, 3500) * 100), 35);
is('dsr: no pay, no ratio', dsrOf(500, 0, 0), null);
is('dsr: tight line is 60% minus commitments', tightCapFromPay(3500, 600), 3500 * DSR_TIGHT - 600);
const dCars = [{ id: 'a', selling_price: 30000 }, { id: 'b', selling_price: 60000 }, { id: 'c', selling_price: 150000 }];
const dOpts = { maxMonthly: maxMonthlyFromPay(3500, 600), nearCap: tightCapFromPay(3500, 600), years: 7, rate: 6.5, basis: 'eir', tenureOptions: [5, 7, 9] };
const dAll = budgetAll(dCars, dOpts);
is('dsr: bands come from the 35% and 60% lines', dAll.map((x) => [x.n, x.status]), [[1, 'fit'], [2, 'near'], [3, 'over']]);
is('dsr: every verdict agrees with its own ratio', dAll.every((x) => {
  const r = dsrOf(x.monthly, 600, 3500);
  return x.status === 'fit' ? r <= SALARY_SHARE + 1e-9 : x.status === 'near' ? r > SALARY_SHARE && r <= DSR_TIGHT + 1e-9 : r > DSR_TIGHT;
}), true);
is('dsr: list "just above" uses the same 60% line', budgetMatches(dCars, dOpts).above.map((x) => x.n), [2]);
const zero = budgetAll(dCars, { ...dOpts, maxMonthly: maxMonthlyFromPay(3000, 1100), nearCap: tightCapFromPay(3000, 1100) });
is('dsr: nothing comfortable left still gives verdicts', zero.length, 3);
is('dsr: ... and none of them fit', zero.some((x) => x.status === 'fit'), false);
// fitYears: the shortest longer tenure that brings a car under the budget.
const fy = budgetAll([{ id: 'f', selling_price: 50000 }], { maxMonthly: monthlyPayment(50000, 6.5, 108) + 1, years: 7, rate: 6.5, basis: 'eir', tenureOptions: [5, 7, 9] });
is('fit years: 9 years fits a car 7 years does not', [fy[0].status, fy[0].fitYears], ['near', 9]);
is('fit years: a fitting car has none', budgetAll([{ id: 'g', selling_price: 10000 }], { maxMonthly: 5000, years: 7, rate: 6.5, basis: 'eir', tenureOptions: [5, 7, 9] })[0].fitYears, null);
is('fit years: never past the car\'s own limit', budgetAll([{ id: 'h', selling_price: 50000, year: 2016 }], { maxMonthly: monthlyPayment(50000, 6.5, 108) + 1, years: 7, rate: 6.5, basis: 'eir', tenureOptions: [5, 7, 9], yearsFor: (c) => maxTenureYears(c, 2026) })[0].fitYears, null);
// The car price a monthly buys, forwards again.
const pf = priceForMonthly({ monthly: 800, eir: 6.5, years: 7, deposit: 5000 });
is('car budget: its loan repays at no more than the monthly', monthlyPayment(pf - 5000, 6.5, 84) <= 800, true);
is('car budget: rounded down to RM10', pf % 10, 0);
is('car budget: zero monthly is null', priceForMonthly({ monthly: 0, eir: 6.5, years: 7 }), null);

is('variants: shared first word dropped', shortVariantNames(['1.3 Standard MT', '1.3 Standard AT', '1.3 Premium S AT', '1.3 MC2 AT']), ['Standard MT', 'Standard AT', 'Premium S AT', 'MC2 AT']);
is('variants: nothing shared, unchanged', shortVariantNames(['1.5 V', '1.5T Exec']), ['1.5 V', '1.5T Exec']);
is('variants: never empties a name', shortVariantNames(['1.3 MT', '1.3 MT']), ['MT', 'MT']);
is('variants: one name, unchanged', shortVariantNames(['1.3 Standard MT']), ['1.3 Standard MT']);

// variantExtras: what a variant adds over the next cheaper one, additions only.
const vLite = { model_id: 'l', variant: '1.5TD Lite', price: 123800, specs: { seats: 7, airbags: 6,
  safety: ['Cruise control', 'Reverse camera', 'Rear parking sensors'],
  features: ['LED headlamps', '12.3-inch touchscreen, wireless Apple CarPlay'] } };
const vPrime = { model_id: 'p', variant: '1.5TD Prime', price: 131800, specs: { seats: 7, airbags: 6,
  safety: ['360-degree camera', 'Parking sensors (2 front, 4 rear)'],
  features: ['LED headlamps', 'Auto wipers', '12.3-inch touchscreen, wireless Apple CarPlay', 'Full digital instrument cluster'] } };
const vX = { model_id: 'x', variant: '1.5TD Prime X', price: 139800, specs: { seats: 6, airbags: 6,
  safety: ['360-degree camera'], features: ['Auto wipers', 'Ventilated front seats'] } };
const vv = [vX, vLite, vPrime];
const ex = variantExtras(vv, vPrime);
is('extras: over the next cheaper variant', ex.over, '1.5TD Lite');
is('extras: additions, short labels, nothing it shares', ex.items, ['360 camera', 'Parking sensors', 'Auto wipers', 'Full digital instrument cluster']);
is('extras: never a removal (Prime has no cruise control listed)', ex.items.includes('Cruise control'), false);
is('extras: a seat change is its own field, not a +', variantExtras(vv, vX).seats, 6);
is('extras: cheapest gets headline items', variantExtras(vv, vLite), { over: null, seats: null, items: ['6 airbags', 'Reverse camera', '12.3-inch touchscreen'] });
is('extras: unknown variant is empty', variantExtras(vv, { model_id: 'z', specs: {} }), { over: null, seats: null, items: [] });
is('extras: capped', variantExtras(vv, vPrime, 2).items.length, 2);
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
