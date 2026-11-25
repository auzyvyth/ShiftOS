// Premium page sections: rules + cleaning. Run: npm run test:pagesite
import { cleanSite, noteProblem, promoProblem, deliveryProblem, activePromos, untilLabel, promoLine, deliveryLine, visibleSections, SITE_SECTIONS, PROMO_MAX } from '../src/utils/pageSite.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const T = '2026-11-25';

is('garbage cleans to the default', cleanSite('x'), cleanSite(null));
is('default order has every section', cleanSite(null).order, SITE_SECTIONS);
is('a new section is appended, never lost', cleanSite({ order: ['delivery', 'promos'] }).order, ['delivery', 'promos', 'models', 'cars', 'calculator']);
is('unknown + duplicate ids dropped', cleanSite({ order: ['x', 'cars', 'cars'], off: ['nope', 'promos', 'promos'] }).off, ['promos']);
is('promo without an end date is dropped', cleanSite({ promos: [{ model: 'Camry', text: 'rebate' }] }).promos, []);
is('promo kept, price rounded', cleanSite({ promos: [{ model: ' Camry  2.5V ', text: 'free tint', until: '2026-12-01', price: '120000.4' }] }).promos,
  [{ model: 'Camry 2.5V', text: 'free tint', until: '2026-12-01', price: 120000 }]);
is('promo count capped', cleanSite({ promos: Array.from({ length: 30 }, (_, i) => ({ model: `M${i}`, until: '2026-12-01' })) }).promos.length, PROMO_MAX);
is('delivery needs km', cleanSite({ delivery: { items: [{ town: 'Marang' }, { town: 'Dungun', km: 60, min: 55 }] } }).delivery.items, [{ town: 'Dungun', km: 60, min: 55 }]);

is('ok promo', promoProblem({ model: 'Vios', until: '2026-11-30' }, T), '');
is('past date refused', promoProblem({ model: 'Vios', until: '2026-11-24' }, T), 'That date has passed.');
is('today is allowed', promoProblem({ model: 'Vios', until: T }, T), '');
is('too far out refused', promoProblem({ model: 'Vios', until: '2027-06-01' }, T).includes('120 days'), true);
is('phone number refused', promoProblem({ model: 'Vios', text: 'call 012 345 6789', until: '2026-11-30' }, T), "Don't type a phone number here.");
is('no model refused', promoProblem({ model: ' ', until: '2026-11-30' }, T), 'Type the model.');
is('delivery ok', deliveryProblem({ town: 'Marang', km: 38, min: 45 }), '');
is('delivery km 0 refused', deliveryProblem({ town: 'Marang', km: 0 }).includes('km'), true);

is('notes: blank + duplicate (any case) dropped', cleanSite({ notes: [{ model: 'Saga', text: 'First car pick' }, { model: 'saga', text: 'again' }, { model: 'X50', text: ' ' }] }).notes, [{ model: 'Saga', text: 'First car pick' }]);
is('note needs text', noteProblem({ model: 'Saga', text: '' }), 'Write your note.');
is('note phone number refused', noteProblem({ model: 'Saga', text: 'call 0123456789' }), "Don't type a phone number here.");
is('note ok', noteProblem({ model: 'Saga', text: 'Good for a first car' }), '');

const site = cleanSite({ promos: [
  { model: 'Hilux', until: '2026-12-05' }, { model: 'Yaris', until: '2026-11-30' }, { model: 'Old', until: '2026-11-01' }, { model: 'Camry', until: '2026-11-30' },
] });
is('expired promo hidden, soonest first, ties by model', activePromos(site, T).map((p) => p.model), ['Camry', 'Yaris', 'Hilux']);
is('ends today', untilLabel('2026-11-25', T), 'Ends today');
is('ends tomorrow', untilLabel('2026-11-26', T), 'Ends tomorrow');
is('ends date', untilLabel('2026-11-30', T), 'Ends 30 Nov');
is('promo line', promoLine({ model: 'Yaris', text: 'free tint', price: 91300 }), 'Yaris · free tint · from RM 91,300');
is('delivery line minutes', deliveryLine({ km: 38, min: 45 }), '38 km · about 45 min');
is('delivery line hours', deliveryLine({ km: 210, min: 150 }), '210 km · about 2 h 30 min');
is('delivery line no minutes', deliveryLine({ km: 12 }), '12 km');

const full = cleanSite({ promos: [{ model: 'Yaris', until: '2026-11-30' }], delivery: { items: [{ town: 'Marang', km: 38 }] }, off: ['delivery'], order: ['cars', 'promos'] });
is('visible: order kept, off + empty removed', visibleSections(full, { cars: true, calculator: true, models: false }, T), ['cars', 'promos', 'calculator']);
is('visible: nothing filled', visibleSections(null, {}, T), []);

console.log(`pageSite: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
