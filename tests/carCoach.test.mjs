// Run: npm run test:coach
//
// Guards the per-car next step (src/utils/carCoach.js) Lite and Premium both
// show. The silent rule is the owner's ("no viewers more than 2 days") and the
// dashboard's share tour hangs off it, so it gets the most cases.
import { carNextStep, daysSinceLastView, pickSilentCar, carListingScore } from '../src/utils/carCoach.js';

let pass = 0;
const fails = [];
const eq = (a, b, label) => (JSON.stringify(a) === JSON.stringify(b) ? pass++ : fails.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`));

const now = new Date('2026-10-31T06:00:00Z');
const ago = (d) => new Date(now.getTime() - d * 86400000).toISOString();
const car = (o = {}) => ({ id: 'c1', status: 'available', images: ['1', '2', '3', '4', '5'], selling_price: 50000, created_at: ago(10), ...o });
const days = (...n) => ({ daily: n, views: n.reduce((a, b) => a + b, 0) });

eq(daysSinceLastView([0, 0, 0, 0, 1, 0, 0]), 2, 'last view two days ago');
eq(daysSinceLastView([0, 0, 0, 0, 0, 0, 3]), 0, 'viewed today');
eq(daysSinceLastView([0, 0, 0, 0, 0, 0, 0]), null, 'no view this week');

eq(carNextStep(car({ status: 'sold' }), {}), null, 'sold car says nothing');
eq(carNextStep(car({ status: 'pending_approval' }), {}), null, 'pending car says nothing');
eq(carNextStep(car(), days(0, 0, 0, 0, 0, 0, 0), { unanswered: 2 }, now).kind, 'question', 'a waiting buyer beats everything');
eq(carNextStep(car({ images: ['1', '2'] }), {}, {}, now), { kind: 'photos', need: 3, action: 'edit' }, 'needs 3 more photos');
eq(carNextStep(car({ images: ['1'], new_car_model_id: 'm' }), days(0, 0, 0, 0, 0, 0, 2), {}, now).kind, 'low', 'model card never asked for photos');
eq(carNextStep(car({ selling_price: null }), {}, {}, now).kind, 'price', 'no price');

// The owner's rule: listed 2+ days, no views for 2+ days.
eq(carNextStep(car(), days(0, 0, 0, 0, 1, 0, 0), {}, now), { kind: 'silent', days: 2, capped: false, action: 'tour' }, 'two silent days');
eq(carNextStep(car(), days(0, 0, 0, 0, 0, 1, 0), {}, now).kind, 'low', 'one silent day is not silent yet');
eq(carNextStep(car({ created_at: ago(4) }), days(0, 0, 0, 0, 0, 0, 0), {}, now), { kind: 'silent', days: 4, capped: false, action: 'tour' }, 'never viewed, counted from the day listed');
eq(carNextStep(car({ created_at: ago(30) }), days(0, 0, 0, 0, 0, 0, 0), {}, now), { kind: 'silent', days: 7, capped: true, action: 'tour' }, 'capped at 7 days');
eq(carNextStep(car({ created_at: ago(1) }), days(0, 0, 0, 0, 0, 0, 0), {}, now).kind, 'fresh', 'new car: share it');
eq(carNextStep(car(), { ...days(0, 0, 0, 0, 0, 0, 1), enquiries: 2 }, {}, now).kind, 'working', 'buyers messaging');
eq(carNextStep(car(), { daily: [3, 3, 3, 3, 3, 3, 3], views: 25 }, {}, now).kind, 'no_taps', 'looked, nobody messaged');
eq(carNextStep(car(), days(1, 0, 0, 1, 0, 1, 1), { likes: 3 }, now).kind, 'saved', 'saved but nobody messaged');
eq(carNextStep(car(), days(5, 5, 0, 0, 1, 0, 1), {}, now), null, 'enough traffic, nothing to say');

const cars = [car({ id: 'a' }), car({ id: 'b' }), car({ id: 'c' })];
const stats = { a: days(0, 0, 0, 0, 1, 0, 0), b: days(0, 0, 0, 0, 0, 0, 0), c: days(0, 0, 0, 0, 0, 0, 5) };
const pick = pickSilentCar(cars, stats, () => ({}), now);
eq([pick.car.id, pick.count], ['b', 2], 'dashboard picks the longest silent car');
eq(pickSilentCar([car({ id: 'c' })], stats, () => ({}), now), null, 'nothing silent, no card');

eq(carListingScore(car({ mileage: 1, colour: 'x', variant: 'v', state: 's', condition: 'used' })).pct, 100, 'complete car');
eq(carListingScore(car({ images: ['1', '2', '3'] })).missing[0], { pts: 25, ok: false, key: 'photos', n: 2 }, 'score asks for 5 photos, not 3');

if (fails.length) {
  console.error(`carCoach: ${fails.length} failed, ${pass} passed`);
  fails.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log(`carCoach: ${pass} passed`);
