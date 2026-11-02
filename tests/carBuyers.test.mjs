// Run: npm run test:carbuyers
// Guards SOLD-1 (src/utils/carBuyers.js): which leads are "car sold to another
// buyer", and who is still open on a car when one buyer wins it.
import { carSoldToOther, openLeadsOnCar, isOpenLead, CAR_SOLD_REASON } from '../src/utils/carBuyers.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (a === e) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };

const sold = { status: 'sold' };
eq(carSoldToOther({ stage: 'new', car_listing_id: 'c1', car_listings: sold }), true, 'open lead on sold car (embedded)');
eq(carSoldToOther({ stage: 'negotiating', car_listing_id: 'c1' }, { c1: sold }), true, 'open lead on sold car (map)');
eq(carSoldToOther({ stage: 'won', car_listing_id: 'c1', car_listings: sold }), false, 'the winner is not "sold to another"');
eq(carSoldToOther({ stage: 'lost', car_listing_id: 'c1', car_listings: sold }), false, 'already lost');
eq(carSoldToOther({ stage: 'new', car_listing_id: 'c1', car_listings: sold, is_deleted: true }), false, 'deleted lead');
eq(carSoldToOther({ stage: 'new', car_listing_id: 'c1', car_listings: { status: 'available' } }), false, 'car still for sale');
eq(carSoldToOther({ stage: 'new', car_listing_id: null }), false, 'no car');
eq(carSoldToOther({ stage: 'new', car_listing_id: 'c9' }, {}), false, 'unknown car');

const leads = [
  { id: 'w', stage: 'negotiating', car_listing_id: 'c1' },
  { id: 'a', stage: 'new', car_listing_id: 'c1' },
  { id: 'b', stage: 'viewing_booked', car_listing_id: 'c1' },
  { id: 'c', stage: 'lost', car_listing_id: 'c1' },
  { id: 'd', stage: 'new', car_listing_id: 'c2' },
];
eq(openLeadsOnCar(leads, 'c1', 'w').map((l) => l.id).join(','), 'a,b', 'others on the car, winner and lost left out');
eq(openLeadsOnCar(leads, null).length, 0, 'no car id');
eq(isOpenLead({ stage: 'closed_won' }), false, 'closed_won is closed');
eq(CAR_SOLD_REASON, 'CarSold', 'reason key is stable (stored in leads.loss_reason)');

if (fails.length) { console.error(fails.join('\n')); console.error(`carBuyers: ${pass} passed, ${fails.length} failed`); process.exit(1); }
console.log(`carBuyers: ${pass} passed, 0 failed`);
