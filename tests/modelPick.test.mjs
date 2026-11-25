// Model picker facts + the "Not sure which model?" helper. Run: npm run test:modelpick
import { specStrip, modelNote, helperModels, monthlyBands, buildQuestions, recommend, pickFacts } from '../src/utils/modelPick.js';

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

// Questions come from the lineup
const qs = buildQuestions(models, bands);
is('questions asked', qs.map((q) => q.id), ['body', 'people', 'fuel', 'priority', 'budget']);
is('shapes are the lineup\'s own', qs[0].options.map((o) => o.label), ['Sedan', 'SUV']);
is('fuel options only what exists', qs[2].options.map((o) => o.id), ['petrol', 'electric']);
is('big family offered because a 7-seater exists', qs[1].options.map((o) => o.id), ['solo', 'family', 'big']);
is('no 6-seater = no big-family option', buildQuestions(models.filter((m) => m.id !== 'd'), bands)[1].options.map((o) => o.id), ['solo', 'family']);
is('one shape + one fuel = those questions are skipped', buildQuestions(models.filter((m) => m.id === 'a' || m.id === 'b'), null).map((q) => q.id), ['people', 'priority']);
const noData = helperModels(cars, { a: { variants: [v(38990, 'Sedan', 'Petrol', {})] }, b: { variants: [v(56800, 'Sedan', 'Petrol', {})] }, c: { variants: [v(89800, 'Sedan', 'Petrol', {})] } }).slice(0, 3);
is('priority with no running/power data is only price = not asked', buildQuestions(noData, null).some((q) => q.id === 'priority'), false);

// Recommending
is('big family needs 6+ seats', recommend(models, { people: 'big' }, bands).pick.id, 'd');
is('shape is a rule', recommend(models, { body: 'sedan', priority: 'power' }, bands).pick.id, 'b');
is('fuel is a rule', recommend(models, { fuel: 'electric' }, bands).pick.id, 'e');
is('lowest price', recommend(models, { priority: 'price' }, bands).pick.id, 'a');
is('power orders what is left', recommend(models, { body: 'suv', priority: 'power' }, bands).pick.id, 'e');
is('running cost: electric / economy first', recommend(models, { priority: 'running' }, bands).pick.id, 'e');
is('refines with each answer', recommend(models, { people: 'family' }, bands).pick.id, 'a');
const none = recommend(models, { body: 'sedan', fuel: 'electric' }, bands);
is('no match names what to change', [none.none, none.fixes], [true, ['body', 'fuel']]);
is('no 6-seater = honest none', recommend(models.filter((m) => m.id !== 'd'), { people: 'big' }, bands).none, true);
const tight = recommend(models, { people: 'big', budget: 'low' }, bands);
is('nothing in budget = relaxed, flagged', [tight.pick.id, tight.relaxed], ['d', true]);
is('an unknown seat count never rules a car out for a family', recommend(helperModels([cars[0]], { a: { variants: [v(38990, 'Sedan', 'Petrol', {})] } }), { people: 'family' }, null).pick.id, 'a');
is('unknown seats: an MPV still counts as big', recommend(helperModels([{ ...cars[0], id: 'm' }], { m: { variants: [v(80000, 'MPV', 'Petrol', {})] } }), { people: 'big' }, null).pick.id, 'm');
is('facts quote data only', pickFacts(models[3]), ['SUV', '7 seats', 'up to 177 PS']);
is('no bands = budget ignored', recommend(models, { priority: 'price', budget: 'low' }, null).pick.id, 'a');

console.log(`modelPick: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
