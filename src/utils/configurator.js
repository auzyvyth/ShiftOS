// The vehicle configurator on a Premium advisor page (CONFIG-1, owner 2026-11-26: "feel like a
// manufacturer's official configurator"). Pure rules only, shared by the component and its test
// (`npm run test:configurator`). Every fact comes from the seller's model cards and the brand price
// list (new_car_models via get_new_car_variants_batch): nothing here is typed or guessed.
import { variantExtras } from './liveMaths.js';

const n = (v) => Number(v).toLocaleString('en-MY');

// The seller's model cards grouped by brand, in the order the seller arranged their cars
// (the first card of a brand decides where the brand sits). Brand names are compared without
// case so "JAECOO" and "Jaecoo" are one brand.
export function groupBrands(cars) {
  const out = [];
  const at = new Map();
  for (const c of cars || []) {
    if (!c?.is_model_card || !c.brand) continue;
    const key = String(c.brand).trim().toLowerCase();
    if (!at.has(key)) { at.set(key, out.length); out.push({ brand: String(c.brand).trim(), models: [] }); }
    out[at.get(key)].models.push(c);
  }
  return out;
}

// The lowest priced variant's price, else the card's own "from" price, else null.
export function fromPrice(car, info) {
  const vs = (info?.variants || []).map((v) => Number(v.price)).filter((p) => p > 0);
  if (vs.length) return Math.min(...vs);
  const p = Number(car?.selling_price);
  return p > 0 ? p : null;
}

// One short line that tells a variant apart from the one below it in price: what the spec sheet
// says it adds, else the engine or power where those differ. '' when the data says nothing.
export function variantLine(variants, v) {
  const ex = variantExtras(variants, v, 2);
  if (ex.items.length) return ex.items.join(' · ');
  if (ex.seats) return `${ex.seats} seats`;
  const s = v?.specs || {};
  const others = (variants || []).filter((x) => x.model_id !== v?.model_id);
  const differs = (k) => s[k] != null && others.some((x) => x?.specs?.[k] != null && x.specs[k] !== s[k]);
  const bits = [];
  if (differs('engine_cc')) bits.push(`${n(s.engine_cc)} cc`);
  if (differs('power_ps')) bits.push(`${s.power_ps} PS`);
  if (differs('range_km')) bits.push(`${n(s.range_km)} km range`);
  // Fuel only names the odd one out (the one hybrid among petrol rows), never every row.
  if (!bits.length && v?.fuel_type && others.length && others.every((x) => x.fuel_type && x.fuel_type !== v.fuel_type)) bits.push(v.fuel_type);
  return bits.join(' · ');
}

// What the stage says above the car: category and fuel, from the row.
export function stageTag(v, raw) {
  return [v?.body_type || raw?.body_type, v?.fuel_type || raw?.fuel_type].filter(Boolean).join(' · ');
}

// The spec rows in the order a buyer reads them: what moves the car first, then the rest.
const ORDER = ['Engine', 'Power', 'Torque', 'Gearbox', 'Drive', 'Fuel', 'Seats', 'Economy', 'Range', 'Battery', 'Charging', '0-100 km/h', 'Airbags', 'Boot'];
export function orderSpecs(rows) {
  const rank = (k) => { const i = ORDER.indexOf(k); return i < 0 ? ORDER.length : i; };
  return (rows || []).map((r, i) => [r, i]).sort((a, b) => rank(a[0][0]) - rank(b[0][0]) || a[1] - b[1]).map(([r]) => r);
}
