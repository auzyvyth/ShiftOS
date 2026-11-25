// "Pick your model" on a new-car advisor's page (PAGE-SITE 2): the facts under a
// picked variant, and the "Not sure which model?" helper. Pure: no React, no
// Supabase. `npm run test:modelpick`.
//
// Every figure comes from new_car_models (brand list price for the seller's zone,
// spec sheet per variant) through the variants the car page already loads. Nothing
// is invented: a spec the sheet did not state is simply not shown. The helper
// never says "best" and never approves anything: it points at a model to look at
// first, quotes the facts behind it, and the money line is the page's usual
// estimate (10% deposit, 7 years, the bank decides).
import { pageCalc } from './pageCalc.js';

const n = (v) => Number(v).toLocaleString('en-MY');
const num = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : null; };
const rm = (v) => `RM ${Math.round(Number(v) || 0).toLocaleString('en-MY')}`;

// Up to four quick facts under the photo, for the picked variant: [{ label, value }].
// Petrol / hybrid: Engine, Power, Torque, Seats. Electric: Range, Battery, Power, Seats.
export function specStrip(variant) {
  const s = variant?.specs || {};
  const ev = /electric|ev/i.test(String(variant?.fuel_type || '')) || (!s.engine_cc && !s.engine && (s.battery_kwh || s.range_km));
  const engine = s.engine_cc ? `${s.engine ? `${s.engine} ` : ''}${n(s.engine_cc)} cc` : s.engine || null;
  const rows = ev
    ? [['Range', s.range_km ? `${n(s.range_km)} km` : null], ['Battery', s.battery_kwh ? `${s.battery_kwh} kWh` : null],
       ['Power', s.power_ps ? `${s.power_ps} PS` : null], ['Seats', s.seats ? `${s.seats}` : null]]
    : [['Engine', engine], ['Power', s.power_ps ? `${s.power_ps} PS` : null],
       ['Torque', s.torque_nm ? `${s.torque_nm} Nm` : null], ['Seats', s.seats ? `${s.seats}` : null]];
  return rows.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
}

// The seller's own note for a model (page_site.notes), matched on the model name
// with or without the brand, ignoring case and spacing. '' when none.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function modelNote(site, car) {
  const keys = [norm(car?.model), norm(`${car?.brand || ''} ${car?.model || ''}`)].filter(Boolean);
  const hit = (site?.notes || []).find((x) => keys.includes(norm(x.model)));
  return hit?.text || '';
}

// One row per model card for the helper, from its variants (cheapest first):
// the facts it can be judged on. `variants` are get_new_car_variants_batch rows.
export function helperModels(cars, infos) {
  const out = [];
  for (const car of cars || []) {
    const vs = (infos?.[car.id]?.variants || []).filter((v) => num(v.price));
    const from = vs.length ? Math.min(...vs.map((v) => Number(v.price))) : num(car.selling_price);
    if (!from) continue;
    const seats = vs.reduce((m, v) => Math.max(m, num(v.specs?.seats) || 0), 0) || null;
    const power = vs.reduce((m, v) => Math.max(m, num(v.specs?.power_ps) || 0), 0) || null;
    const kml = vs.reduce((m, v) => Math.max(m, num(v.specs?.fuel_kml) || 0), 0) || null;
    const range = vs.reduce((m, v) => Math.max(m, num(v.specs?.range_km) || 0), 0) || null;
    const fuels = vs.map((v) => String(v.fuel_type || '')).join(' ');
    const first = vs[0] || {};
    const calc = pageCalc({ ...car, selling_price: from }, { depositPct: 0.1, years: 7 });
    out.push({
      id: car.id, name: [car.brand, car.model].filter(Boolean).join(' '), from, monthly: calc?.monthly || null,
      seats, power, kml, range, body: first.body_type || null,
      electric: /electric/i.test(fuels), hybrid: /hybrid/i.test(fuels),
    });
  }
  return out;
}

// Three monthly bands from the advisor's OWN models (a Perodua advisor and a
// Toyota advisor need different edges): edges at the thirds of their monthly
// instalments, rounded to RM50. Fewer than 3 distinct priced models, or all in one
// RM100 slice = null (the budget question is not worth asking).
export function monthlyBands(models) {
  const m = models.map((x) => x.monthly).filter(Boolean).sort((a, b) => a - b);
  if (m.length < 3 || m[m.length - 1] - m[0] < 100) return null;
  const r50 = (v) => Math.round(v / 50) * 50;
  const e1 = r50(m[Math.floor((m.length - 1) / 3)] + 25);
  const e2 = r50(m[Math.floor(((m.length - 1) * 2) / 3)] + 25);
  if (e2 <= e1) return null;
  return [
    { id: 'low', label: `Under ${rm(e1)}`, max: e1 },
    { id: 'mid', label: `${rm(e1)} to ${rm(e2)}`, max: e2 },
    { id: 'high', label: `Over ${rm(e2)}`, max: Infinity },
  ];
}

export const PEOPLE = [
  { id: 'solo', label: 'Just me or two of us' },
  { id: 'family', label: 'Family of 4 or 5' },
  { id: 'big', label: 'Big family, 6 or 7' },
];
export const USES = [
  { id: 'city', label: 'Daily work and around town' },
  { id: 'long', label: 'Long trips and balik kampung' },
  { id: 'first', label: 'First car, keep it cheap' },
];

// answers = { people, use, budget }. Returns { pick, others, relaxed } or { none: true }.
//  - Seats are a rule: 6 or 7 people needs 6+ seats, a family of 4 or 5 needs 5+.
//  - The budget band is a rule on the monthly estimate; if nothing fits, we say so and
//    show the cheapest that meets the seats rule (relaxed = true), never a silent miss.
//  - Use only ORDERS what is left: around town = hybrid / electric / best economy first;
//    long trips = most power first; first car = lowest price first.
export function recommend(models, answers, bands) {
  const need = answers.people === 'big' ? 6 : answers.people === 'family' ? 5 : 0;
  let pool = models.filter((m) => !need || (m.seats && m.seats >= need));
  if (!pool.length) return { none: true, reason: 'seats' };
  const band = bands?.find((b) => b.id === answers.budget);
  let relaxed = false;
  if (band) {
    const prev = bands[bands.indexOf(band) - 1];
    const inBand = pool.filter((m) => m.monthly && m.monthly <= band.max && (!prev || m.monthly > prev.max));
    if (inBand.length) pool = inBand;
    else {
      const under = pool.filter((m) => m.monthly && m.monthly <= band.max);
      pool = under.length ? under : [...pool].sort((a, b) => (a.monthly || 1e12) - (b.monthly || 1e12)).slice(0, 1);
      relaxed = true;
    }
  }
  const by = {
    city: (a, b) => (Number(b.electric || b.hybrid) - Number(a.electric || a.hybrid)) || ((b.kml || 0) - (a.kml || 0)) || (a.from - b.from),
    long: (a, b) => ((b.power || 0) - (a.power || 0)) || ((b.range || 0) - (a.range || 0)) || (a.from - b.from),
    first: (a, b) => a.from - b.from,
  }[answers.use] || ((a, b) => a.from - b.from);
  const sorted = [...pool].sort(by);
  return { pick: sorted[0], others: sorted.slice(1, 3), relaxed };
}

// The facts behind a pick, as short phrases (only what the data holds).
export function pickFacts(m) {
  return [
    m.body || null,
    m.seats ? `${m.seats} seats` : null,
    m.electric ? 'Electric' : m.hybrid ? 'Hybrid' : null,
    m.power ? `up to ${m.power} PS` : null,
    m.range ? `up to ${n(m.range)} km range` : null,
    m.kml ? `${m.kml} km/L` : null,
  ].filter(Boolean);
}
export { rm as modelRm };
