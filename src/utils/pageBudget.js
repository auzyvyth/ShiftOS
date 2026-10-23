// "What fits your budget?" on a Premium seller's page (BUDGET-1, 2026-10-23).
// The SAME engine as the Live presenter's Budget tab (liveMaths.budgetMatches),
// so a buyer on the page and a viewer on the live get the same monthly for the
// same car. Pure: no React, no Supabase. `npm run test:pagebudget`.
//
// Defaults, not seller settings (owner, 2026-10-23): the seller's own rates live
// on their device (Live), which a buyer's browser cannot read. New Proton and
// Perodua at 4.8% EIR, every other car at DEFAULT_EIR, reducing balance.
import { budgetMatches, maxMonthlyFromPay, tenuresFor, isLocalNew, LOCAL_NEW_EIR, SALARY_SHARE, carLabel } from './liveMaths.js';
import { DEFAULT_EIR, RATE_BASIS, HIGH_VALUE_THRESHOLD } from './financing.js';

export const PAGE_TENURES = [5, 7, 9];
export const PAGE_DEPOSITS = [0, 0.1, 0.2];
export const MONTHLY_PRESETS = [700, 900, 1200];
export const PAY_PRESETS = [3000, 4000, 5000];
export const salaryPct = Math.round(SALARY_SHARE * 100);

export const pageRate = (car) => (isLocalNew(car) ? LOCAL_NEW_EIR : DEFAULT_EIR);

// cars: the page's `listings` array; #N = position in it, the same number the
// cards and the live use. Cars above RM300k are left out: their card already
// says "financing on request" (calcMonthly), and the page must not disagree.
export function pageBudget(cars, { mode = 'monthly', amount, depositPct = 0.1, nowYear } = {}) {
  const maxMonthly = mode === 'pay' ? maxMonthlyFromPay(amount) : Math.floor(Number(amount) || 0);
  if (!maxMonthly || maxMonthly <= 0) return { maxMonthly: null, fits: [], above: [] };
  const priced = (cars || [])
    .map((c, i) => ({ ...c, _n: i + 1 }))
    .filter((c) => {
      const p = Number(c.selling_price) || 0;
      return p > 0 && p <= HIGH_VALUE_THRESHOLD;
    });
  const { fits, above } = budgetMatches(priced, {
    maxMonthly,
    depositFor: (_car, price) => Math.round(price * (Number(depositPct) || 0)),
    years: Math.max(...PAGE_TENURES),
    yearsFor: (c) => Math.max(0, ...tenuresFor(PAGE_TENURES, c, nowYear)),
    rateOf: (c) => ({ rate: pageRate(c), basis: RATE_BASIS }),
  });
  return { maxMonthly, fits, above };
}

const rm = (v) => `RM ${Math.round(Number(v) || 0).toLocaleString('en-MY')}`;

// The WhatsApp text a tap sends. Facts the BUYER chose, nothing promised: no
// approval, no rate, no instalment quoted back as an offer.
export function budgetMessage({ firstName, car, mode, amount, depositPct }) {
  const name = carLabel(car);
  const price = Number(car?.selling_price) || 0;
  const budget = mode === 'pay'
    ? `My take-home pay is about ${rm(amount)} a month`
    : `My budget is about ${rm(amount)} a month`;
  const pct = Math.round((Number(depositPct) || 0) * 100);
  const dep = pct > 0 ? `, with a ${pct}% deposit` : ', with no deposit';
  return `Hi ${firstName}, I saw the ${name}${price ? ` (${rm(price)})` : ''} on your page.\n${budget}${dep}.\nCan we work something out?`;
}
