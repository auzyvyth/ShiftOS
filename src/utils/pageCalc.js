// "Kira ansuran" on a Premium seller's page: ONE car, the buyer's own deposit
// and years, the monthly. Same engine and same default rates as the budget
// finder (pageBudget.js), so the two never disagree. Pure: no React, no
// Supabase. `npm run test:pagecalc`.
//
// An estimate, never an approval: the bank sets its own rate and decides the
// loan. Rates are the page's defaults, not the seller's private ones.
import { loanTotals } from './financing.js';
import { tenuresFor, carLabel } from './liveMaths.js';
import { PAGE_TENURES, PAGE_DEPOSITS, pageRate } from './pageBudget.js';

export { PAGE_DEPOSITS, pageRate };

// Years offered for this car (older cars get a shorter limit; [] = no bank loan).
export const calcYears = (car, nowYear) => tenuresFor(PAGE_TENURES, car, nowYear);

// Keep a picked year only if the car allows it, else the longest it allows.
export function fitYears(car, years, nowYear) {
  const ok = calcYears(car, nowYear);
  if (!ok.length) return null;
  return ok.includes(years) ? years : Math.max(...ok);
}

// depositPct 0..0.5. A car with no price has no calculation (null), never a guess.
export function pageCalc(car, { depositPct = 0.1, years = 7, nowYear } = {}) {
  const price = Number(car?.selling_price) || 0;
  if (price <= 0) return null;
  const y = fitYears(car, years, nowYear);
  if (!y) return null;
  const pct = Math.min(0.5, Math.max(0, Number(depositPct) || 0));
  const deposit = Math.round(price * pct);
  const loan = Math.max(0, price - deposit);
  const rate = pageRate(car);
  const { monthly, totalRepayment, totalInterest } = loanTotals(loan, rate, y * 12);
  return { price, deposit, loan, years: y, rate, monthly, totalRepayment, totalInterest, from: !!car.is_model_card };
}

const rm = (v) => `RM ${Math.round(Number(v) || 0).toLocaleString('en-MY')}`;

// The WhatsApp text a tap sends: what the BUYER picked, nothing promised.
export function calcMessage({ firstName, car, depositPct, years }) {
  const price = Number(car?.selling_price) || 0;
  const pct = Math.round((Number(depositPct) || 0) * 100);
  const dep = pct > 0 ? `${pct}% deposit` : 'no deposit';
  return `Hi ${firstName}, I saw the ${carLabel(car)}${price ? ` (${rm(price)})` : ''} on your page.\nI am looking at ${dep} over ${years} years.\nCan you tell me more?`;
}
