// Model picker facts + the "Not sure which model?" helper. Run: npm run test:modelpick
import { specStrip, modelNote, helperModels, monthlyBands, recommend, pickFacts } from '../src/utils/modelPick.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

is('petrol strip', specStrip({ fuel_type: 'Petrol', specs: { engine: 'i-GT', engine_cc: 1496, power_ps: 120, torque_nm: 150, seats: 5 } }),
  [{ label: 'Engine', value: 'i-GT 1,496 cc' }, { label: 'Power', value: '120 PS' }, { label: 'Torque', value: '150 Nm' }, { label: 'Seats', value: '5' }]);
is('ev strip', specStrip({ fuel_type: 'Electric', specs: { range_km: 325, battery_kwh: 40.16, power_ps: 114, seats: 5 } }).map((x) => x.label), ['Range', 'Battery', 'Power', 'Seats']);
is('missing specs are skipped, never invented', specStrip({ specs: { seats: 7 } }), [{ label: 'Seats', value: '7' }]);
is('empty', specStrip(null), []);

const site = { notes: [{ model: 'Saga', text: 'Best first car' }, { model: 'Proton X50', text: 'Family pick' }] };
is('note by model', modelNote(site, { brand: 'Proton', model: 'Saga' }), 'Best first car');
is('note by brand + model, any case', modelNote(site, { brand: 'proton', model: 'x 50' }), 'Family pick');
is('no note', modelNote(site, { brand: 'Proton', model: 'S70' }), '');

const cars = [
  { id: 'a', brand: 'Proton', model: 'Saga', year: 2026, selling_price: 38990, is_model_card: true },
  { id: 'b', brand: 'Proton', model: 'S70', year: 2026, selling_price: 56800, is_model_card: true },
  { id: 'c', brand: 'Proton', model: 'X50', year: 2026, selling_price: 89800, is_model_card: true },
  { id: 'd', brand: 'Proton', model: 'X90', year: 2026, selling_price: 99800, is_model_card: true },
  { id: 'e', brand: 'Proton', model: 'e.MAS 7', year: 2026, selling_price: 105800, is_model_card: true },
];
const v = (price, body, fuel, specs) => ({ price, body_type: body, fuel_type: fuel, specs });
const infos = {
  a: { variants: [v(38990, 'Sedan', 'Petrol', { seats: 5, power_ps: 94, fuel_kml: 16 })] },
  b: { variants: [v(56800, 'Sedan', 'Petrol', { seats: 5, power_ps: 150, fuel_kml: 14 })] },
  c: { variants: [v(89800, 'SUV', 'Petrol', { seats: 5, power_ps: 150 }), v(103800, 'SUV', 'Petrol', { seats: 5, power_ps: 177 })] },
  d: { variants: [v(99800, 'SUV', 'Petrol', { seats: 7, power_ps: 177 })] },
  e: { variants: [v(105800, 'SUV', 'Electric', { seats: 5, power_ps: 215, range_km: 345 })] },
};
const models = helperModels(cars, infos);
is('one row per priced model', models.length, 5);
is('from is the cheapest variant, power the highest', [models[2].from, models[2].power], [89800, 177]);
is('electric flagged', models[4].electric, true);
const bands = monthlyBands(models);
is('three bands, last is open ended', [bands.length, bands[2].max], [3, Infinity]);
is('band labels are in RM', bands[0].label.startsWith('Under RM'), true);
is('too few models = no budget question', monthlyBands(models.slice(0, 2)), null);

is('big family needs 6+ seats', recommend(models, { people: 'big', use: 'city', budget: 'high' }, bands).pick.id, 'd');
is('no 6-seater = honest none', recommend(models.filter((m) => m.id !== 'd'), { people: 'big', use: 'city' }, bands).none, true);
is('first car = cheapest', recommend(models, { people: 'solo', use: 'first', budget: 'low' }, bands).pick.id, 'a');
is('long trips = most power inside the band', recommend(models, { people: 'family', use: 'long', budget: 'high' }, bands).pick.id, 'e');
is('around town prefers electric / economy', recommend(models, { people: 'family', use: 'city', budget: 'high' }, bands).pick.id, 'e');
const tight = recommend(models, { people: 'big', use: 'first', budget: 'low' }, bands);
is('nothing in budget = relaxed, flagged', [tight.pick.id, tight.relaxed], ['d', true]);
is('facts quote data only', pickFacts(models[3]), ['SUV', '7 seats', 'up to 177 PS']);
is('no bands = budget ignored', recommend(models, { people: 'solo', use: 'first' }, null).pick.id, 'a');

console.log(`modelPick: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
