// Loan maths — reducing balance / EIR (Hire-Purchase (Amendment) Act 2026).
// Run: npm run test:financing
import {
  monthlyPayment, loanTotals, amortize, principalForPayment, monthsForPayment,
  flatToEir, calcMonthly, DEFAULT_EIR, HIGH_VALUE_THRESHOLD,
} from '../src/utils/financing.js';

let pass = 0, fail = 0;
const near = (name, got, want, tol = 0.01) => {
  if (Math.abs(got - want) <= tol) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${got} want ${want}`); }
};
const is = (name, got, want) => {
  if (got === want) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

// The owner's quote: RM 274,500 over 84 months.
near('3.5% EIR instalment', monthlyPayment(274500, 3.5, 84), 3689.24);
const t = loanTotals(274500, 3.5, 84);
near('3.5% EIR total interest', t.totalInterest, 35396.1, 0.5);

// The trap: 3.5% FLAT is ~6.44% EIR, and that EIR reproduces the flat instalment.
const flatMonthly = (274500 + 274500 * 0.035 * 7) / 84; // 4068.49
near('3.5% flat -> EIR', flatToEir(3.5, 84), 6.44, 0.01);
near('flat-equivalent EIR gives the flat instalment', monthlyPayment(274500, flatToEir(3.5, 84), 84), flatMonthly, 0.05);

// Default estimate stays honest: close to the old flat figure, never ~9% under it.
const oldFlat = Math.round((100000 * 0.9 * (1 + 0.035 * 7)) / 84); // 1334
const nowEst = calcMonthly(100000);
is('default is an EIR', DEFAULT_EIR, 6.5);
is('estimate within 1% of the old flat figure', Math.abs(nowEst - oldFlat) / oldFlat < 0.01, true);
is('no estimate above the threshold', calcMonthly(HIGH_VALUE_THRESHOLD + 1), null);
is('no estimate without a price', calcMonthly(0), null);

// Schedule: interest falls, principal rises, balance reaches zero, sums match.
const rows = amortize(274500, 6.5, 84);
is('schedule length', rows.length, 84);
is('interest falls', rows[0].interest > rows[83].interest, true);
is('principal rises', rows[0].principal < rows[83].principal, true);
near('balance ends at zero', rows[83].balance, 0);
near('schedule interest = totals', rows.reduce((s, r) => s + r.interest, 0), loanTotals(274500, 6.5, 84).totalInterest, 0.05);
near('first month interest = balance x rate/12', rows[0].interest, 274500 * 0.065 / 12);

// Inverses used by the Loan Desk's "what brings it under the ceiling".
const m = monthlyPayment(200000, 6, 60);
near('principalForPayment inverts monthlyPayment', principalForPayment(m, 6, 60), 200000, 0.01);
near('monthsForPayment inverts monthlyPayment', monthsForPayment(200000, 6, m), 60, 0.001);
is('unreachable instalment -> null', monthsForPayment(200000, 6, 900), null);

// Zero rate falls back to plain division, never NaN.
near('0% instalment', monthlyPayment(12000, 0, 12), 1000);
is('bad input -> 0', monthlyPayment(0, 6, 84), 0);

console.log(`financing: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
