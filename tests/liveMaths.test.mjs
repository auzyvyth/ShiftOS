// Live presentation: salary guide, flat-rate conversion, after-live report.
// Run: npm run test:live
import { salaryGuide, eirForTenure, liveReport, fmtRate, SALARY_SHARE } from '../src/utils/liveMaths.js';
import { monthlyPayment } from '../src/utils/financing.js';

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

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
