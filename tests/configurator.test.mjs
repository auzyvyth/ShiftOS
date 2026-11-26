import { groupBrands, fromPrice, variantLine, stageTag, orderSpecs } from '../src/utils/configurator.js';
let pass = 0, fail = 0;
const is = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; if (!ok) console.log('FAIL', name, JSON.stringify(got), '!=', JSON.stringify(want)); };

const card = (id, brand, model, price) => ({ id, brand, model, selling_price: price, is_model_card: true });
const cars = [card('a', 'Proton', 'X50', 89800), { id: 'u', brand: 'Lexus', model: 'IS', is_model_card: false }, card('b', 'Honda', 'HR-V', 115900), card('c', 'proton', 'Saga', 38990)];
is('brands keep the seller order, one per brand, used cars left out', groupBrands(cars).map((b) => [b.brand, b.models.map((m) => m.id)]), [['Proton', ['a', 'c']], ['Honda', ['b']]]);
is('no model cards = no brands', groupBrands([{ id: 'x', brand: 'Toyota', is_model_card: false }]), []);
is('from price = cheapest variant', fromPrice(card('a', 'P', 'X', 99999), { variants: [{ price: 101800 }, { price: 89800 }] }), 89800);
is('from price falls back to the card', fromPrice(card('a', 'P', 'X', 89800), null), 89800);
is('no price = null, never 0', fromPrice({ selling_price: 0 }, { variants: [{ price: null }] }), null);

const vs = [
  { model_id: '1', variant: 'S', price: 115900, specs: { engine_cc: 1498 }, fuel_type: 'Petrol' },
  { model_id: '2', variant: 'Turbo E', price: 130900, specs: { engine_cc: 1498, power_ps: 182 }, fuel_type: 'Petrol' },
  { model_id: '3', variant: 'e:HEV RS', price: 143900, specs: { engine_cc: 1498 }, fuel_type: 'Hybrid' },
];
is('petrol rows are not labelled petrol', variantLine(vs, vs[0]), '');
is('a fuel only one variant has is named', variantLine(vs, vs[2]), 'Hybrid');
const eq = [
  { model_id: '1', variant: 'Standard', price: 1, specs: { airbags: 2, safety: ['ABS'], features: [] } },
  { model_id: '2', variant: 'Premium', price: 2, specs: { airbags: 6, safety: ['ABS', 'Reverse camera'], features: ['8-inch touchscreen'] } },
];
is('what a variant adds over the one below', variantLine(eq, eq[1]), 'Reverse camera · 8-inch touchscreen');
is('stage tag from the row', stageTag({ body_type: 'SUV', fuel_type: 'Petrol' }), 'SUV · Petrol');
is('stage tag falls back to the card info', stageTag(null, { body_type: 'Sedan' }), 'Sedan');

is('engine first, fuel later', orderSpecs([['Fuel', 'Petrol'], ['Body', 'SUV'], ['Engine', '1.5L'], ['Power', '121 PS']]).map((r) => r[0]), ['Engine', 'Power', 'Fuel', 'Body']);

console.log(`configurator: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
