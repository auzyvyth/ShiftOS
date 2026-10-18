// Live presentation: salary guide, flat-rate conversion, after-live report.
// Run: npm run test:live
import { salaryGuide, eirForTenure, liveReport, fmtRate, SALARY_SHARE, maxMonthlyFromPay, budgetMatches, netPrice } from '../src/utils/liveMaths.js';
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

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
