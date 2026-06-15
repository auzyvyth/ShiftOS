// Cost-of-ownership estimates for the Malaysian market.
// Formulas mirror the vetted ones in LeadDrawer (JPJ road tax + PIAM insurance
// tariff) so figures stay consistent across the app. Kept dependency-free so
// the public ComparePage can use them without pulling extra weight.

// ─── Road tax (JPJ, private saloon, Peninsular Malaysia) ─────────────────────
export function calcRoadTaxEst(cc) {
  const c = parseFloat(cc);
  if (!c || c <= 0) return null;
  if (c <= 1000) return 20;
  if (c <= 1200) return 55;
  if (c <= 1400) return 70;
  if (c <= 1600) return 90;
  if (c <= 1800) return Math.round(200 + (c - 1600) * 0.40);
  if (c <= 2000) return Math.round(280 + (c - 1800) * 1.00);
  if (c <= 2500) return Math.round(480 + (c - 2000) * 2.00);
  if (c <= 3000) return Math.round(1480 + (c - 2500) * 3.00);
  return Math.round(2980 + (c - 3000) * 4.00);
}

// ─── Comprehensive insurance (PIAM tariff, West Malaysia, saloon, 0% NCD) ────
// Returns the rounded annual premium (net + SST + stamp duty) for a given
// sum insured (we use the asking price as a proxy for market value).
export function calcInsuranceAnnual(sum) {
  if (!sum || sum <= 0) return null;
  let gross = 26;
  const tiers = [
    { cap: 15000, rate: 0.01615 },
    { cap: 25000, rate: 0.01400 },
    { cap: 50000, rate: 0.01295 },
    { cap: Infinity, rate: 0.01220 },
  ];
  let rem = Math.max(0, sum - 1000);
  for (const { cap, rate } of tiers) {
    if (rem <= 0) break;
    gross += Math.min(rem, cap) * rate;
    rem -= cap;
  }
  const sst = gross * 0.08;
  return Math.round(gross + sst + 10);
}

// ─── Annual fuel cost ────────────────────────────────────────────────────────
// Uses real fuel_consumption (L/100km) when present; otherwise estimates from
// engine displacement. Assumes 15 000 km/year. Returns { rm, estimated }.
const FUEL_PRICE = { petrol: 2.05, ron95: 2.05, ron97: 3.47, diesel: 2.15, hybrid: 2.05 };
const ANNUAL_KM = 15000;

export function estAnnualFuel(car) {
  const ft = String(car.fuel_type || '').toLowerCase();
  if (ft.includes('electric') || ft === 'ev') return null; // not comparable to fuel
  const price = FUEL_PRICE[ft] || FUEL_PRICE.petrol;
  let l100 = parseFloat(car.fuel_consumption);
  let estimated = false;
  if (!l100 || l100 <= 0) {
    const cc = parseFloat(car.engine_cc);
    if (!cc || cc <= 0) return null;
    l100 = cc / 180; // rough heuristic: ~7.2 L/100km for a 1300cc car
    estimated = true;
  }
  const rm = Math.round((l100 / 100) * ANNUAL_KM * price);
  return { rm, estimated };
}

// ─── Combined yearly running cost (road tax + insurance + fuel) ──────────────
export function estRunningCost(car) {
  const tax = calcRoadTaxEst(car.engine_cc) || 0;
  const ins = calcInsuranceAnnual(car.selling_price) || 0;
  const fuel = estAnnualFuel(car);
  if (!tax && !ins && !fuel) return null;
  return tax + ins + (fuel?.rm || 0);
}
