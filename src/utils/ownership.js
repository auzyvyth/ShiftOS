// Cost-of-ownership estimates for the Malaysian market.
// Formulas mirror the vetted ones in LeadDrawer (JPJ road tax + PIAM insurance
// tariff) so figures stay consistent across the app. Kept light so the public
// ComparePage can use them without pulling extra weight.

import { motorPremium, insuranceRegion } from './motorInsurance.js';

// Round raw CC to the nearest 100 before any calculation.
// Manufacturers often declare 1998cc, 2494cc etc. for a "2.0L" or "2.5L" engine
// — the difference is a production tolerance, not a meaningfully different car.
// Without rounding, 1998cc and 2000cc yield different road-tax figures (RM478 vs
// RM480) which confuses buyers comparing essentially identical models.
function normaliseCC(cc) {
  const raw = parseFloat(cc);
  if (!raw || raw <= 0) return null;
  return Math.round(raw / 100) * 100;
}

// ─── Road tax (JPJ, private saloon, Peninsular Malaysia) ─────────────────────
export function calcRoadTaxEst(cc) {
  const c = normaliseCC(cc);
  if (!c) return null;
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

// ─── Comprehensive insurance (former motor tariff, 0% NCD) ───────────────────
// The one formula, src/utils/motorInsurance.js (by engine cc + value, East
// Malaysia rates for Sabah/Sarawak/Labuan). The copy that lived here had no cc
// and gave about half the tariff figure. No cc = null, never a guess.
export function calcInsuranceAnnual(sum, cc, state) {
  const est = motorPremium({ sumInsured: sum, cc, ncd: 0, region: insuranceRegion(state) });
  return est ? est.total : null;
}

// ─── Annual fuel cost ────────────────────────────────────────────────────────
// Uses real fuel_consumption (L/100km) when present; otherwise estimates from
// engine displacement (normalised to nearest 100cc). Assumes 15 000 km/year.
const FUEL_PRICE = { petrol: 2.05, ron95: 2.05, ron97: 3.47, diesel: 2.15, hybrid: 2.05 };
const ANNUAL_KM = 15000;

export function estAnnualFuel(car) {
  const ft = String(car.fuel_type || '').toLowerCase();
  if (ft.includes('electric') || ft === 'ev') return null;
  const price = FUEL_PRICE[ft] || FUEL_PRICE.petrol;
  let l100 = parseFloat(car.fuel_consumption);
  let estimated = false;
  if (!l100 || l100 <= 0) {
    const c = normaliseCC(car.engine_cc);
    if (!c) return null;
    l100 = c / 180; // rough heuristic: ~7.2 L/100km for a 1300cc car
    estimated = true;
  }
  const rm = Math.round((l100 / 100) * ANNUAL_KM * price);
  return { rm, estimated };
}

// ─── Combined yearly running cost (road tax + insurance + fuel) ──────────────
export function estRunningCost(car) {
  const tax = calcRoadTaxEst(car.engine_cc) || 0;
  const ins = calcInsuranceAnnual(car.selling_price, car.engine_cc, car.state) || 0;
  const fuel = estAnnualFuel(car);
  if (!tax && !ins && !fuel) return null;
  return tax + ins + (fuel?.rm || 0);
}
