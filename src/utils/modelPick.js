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
// A fact the spec sheets do not hold is null, never a guess (seats are blank for every
// Toyota and Honda row today), and a question is only asked when the data can answer it.
const bodyKey = (b) => String(b || '').trim().toLowerCase();
export function helperModels(cars, infos) {
  const out = [];
  for (const car of cars || []) {
    const vs = (infos?.[car.id]?.variants || []).filter((v) => num(v.price));
    const from = vs.length ? Math.min(...vs.map((v) => Number(v.price))) : num(car.selling_price);
    if (!from) continue;
    const top = (key) => vs.reduce((m, v) => Math.max(m, num(v.specs?.[key]) || 0), 0) || null;
    const fuels = vs.map((v) => String(v.fuel_type || '')).join(' ');
    const first = vs[0] || {};
    const calc = pageCalc({ ...car, selling_price: from }, { depositPct: 0.1, years: 7 });
    out.push({
      id: car.id, name: [car.brand, car.model].filter(Boolean).join(' '), from, monthly: calc?.monthly || null,
      seats: top('seats'), power: top('power_ps'), kml: top('fuel_kml'), range: top('range_km'),
      body: first.body_type || null,
      electric: /electric/i.test(fuels), hybrid: /hybrid/i.test(fuels),
    });
  }
  return out;
}

const isBig = (m) => (m.seats ? m.seats >= 6 : /mpv|van/i.test(m.body || ''));
const fuelOf = (m) => (m.electric ? 'electric' : m.hybrid ? 'hybrid' : 'petrol');

// Three monthly bands from the advisor's OWN models (a Perodua advisor and a
// Toyota advisor need different edges): edges at the thirds of their monthly
// instalments, rounded to RM50. Fewer than 3 priced models, or all in one
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

// The questions THIS advisor's lineup can answer, in the order they are asked.
// Each: { id, label (small caps), q, options: [{ id, label }] }. A question is left out
// when it would not tell the models apart or the data to answer it is missing.
export function buildQuestions(models, bands) {
  const qs = [];
  const bodies = [...new Set(models.map((m) => bodyKey(m.body)).filter(Boolean))];
  if (bodies.length >= 2) {
    const nice = (k) => models.find((m) => bodyKey(m.body) === k).body;
    qs.push({ id: 'body', label: 'Shape', q: 'What kind of car do you picture?', options: bodies.map((k) => ({ id: k, label: nice(k) })) });
  }
  const people = [{ id: 'solo', label: 'Just me, or two of us' }, { id: 'family', label: 'A family of 4 or 5' }];
  if (models.some(isBig)) people.push({ id: 'big', label: 'A big family, 6 or 7' });
  qs.push({ id: 'people', label: 'People', q: 'Who is usually in the car?', options: people });
  const fuels = [...new Set(models.map(fuelOf))];
  if (fuels.length >= 2) {
    const L = { petrol: 'Petrol is fine', hybrid: 'Hybrid, to save on fuel', electric: 'Electric, I can charge at home' };
    qs.push({ id: 'fuel', label: 'Fuel', q: 'What would you like under the bonnet?', options: ['petrol', 'hybrid', 'electric'].filter((k) => fuels.includes(k)).map((k) => ({ id: k, label: L[k] })) });
  }
  const pri = [{ id: 'price', label: 'The lowest price' }];
  const half = Math.ceil(models.length / 2);
  if (models.some((m) => m.electric || m.hybrid) || models.filter((m) => m.kml).length >= half) pri.push({ id: 'running', label: 'Low running cost' });
  if (models.filter((m) => m.power).length >= half) pri.push({ id: 'power', label: 'Power on the road' });
  if (pri.length >= 2) qs.push({ id: 'priority', label: 'Matters most', q: 'What matters most to you?', options: pri });
  if (bands) qs.push({ id: 'budget', label: 'Budget', q: 'Your monthly budget?', options: bands });
  return qs;
}

const ORDER = {
  price: (a, b) => a.from - b.from,
  running: (a, b) => (Number(b.electric || b.hybrid) - Number(a.electric || a.hybrid)) || ((b.kml || 0) - (a.kml || 0)) || (a.from - b.from),
  power: (a, b) => ((b.power || 0) - (a.power || 0)) || ((b.range || 0) - (a.range || 0)) || (a.from - b.from),
};

// Models that pass the HARD answers: shape, fuel and people. A seat count the sheet
// does not hold never rules a model out for a family of 4 or 5; 6 or 7 people needs
// 6+ seats on the sheet or an MPV body.
function passes(m, a) {
  if (a.body && bodyKey(m.body) !== a.body) return false;
  if (a.fuel && fuelOf(m) !== a.fuel) return false;
  if (a.people === 'big' && !isBig(m)) return false;
  if (a.people === 'family' && m.seats && m.seats < 5) return false;
  return true;
}

// answers = { body, people, fuel, priority, budget }, any of them may be missing (the
// pick refines as the buyer answers). Returns { pick, others, relaxed } or { none, fixes }.
//  - shape / fuel / people are rules; the budget band is a rule on the monthly estimate:
//    if nothing fits it we say so and show the cheapest of the rest (relaxed = true).
//  - the priority only ORDERS what is left.
//  - nothing matches = `fixes`: the answers that, changed, would give a result.
export function recommend(models, answers, bands) {
  const a = answers || {};
  let pool = models.filter((m) => passes(m, a));
  if (!pool.length) {
    const fixes = ['body', 'fuel', 'people'].filter((k) => a[k] && models.some((m) => passes(m, { ...a, [k]: undefined })));
    return { none: true, fixes };
  }
  const band = bands?.find((b) => b.id === a.budget);
  let relaxed = false;
  if (band) {
    const prev = bands[bands.indexOf(band) - 1];
    const inBand = pool.filter((m) => m.monthly && m.monthly <= band.max && (!prev || m.monthly > prev.max));
    if (inBand.length) pool = inBand;
    else {
      const under = pool.filter((m) => m.monthly && m.monthly <= band.max);
      pool = under.length ? under : [...pool].sort((x, y) => (x.monthly || 1e12) - (y.monthly || 1e12)).slice(0, 1);
      relaxed = true;
    }
  }
  const sorted = [...pool].sort(ORDER[a.priority] || ORDER.price);
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
