// Car loan maths — the ONE implementation. Every instalment, total interest and
// repayment table in the app comes from here; do not write a second formula.
//
// Why reducing balance: the Hire-Purchase (Amendment) Act 2026 (in force
// 1 June 2026) abolished the flat rate and the Rule of 78 for new hire-purchase
// agreements. Interest is charged only on what is still owed, and lenders must
// quote the EIR (effective interest rate, the true yearly cost). Banks have
// until 31 March 2027 to switch systems. Full notes: TODO.md HP-EIR.
//
// Every rate here is an EIR, % per year, charged monthly (rate / 12 per month).
// A flat rate is NOT an EIR: 3.5% flat over 7 years is about 6.44% EIR. Putting
// a flat number into these functions understates the instalment by ~9%, which
// is a buyer-facing number wrong in the buyer's favour. Use flatToEir() first.

// Default estimate for a used / recon car. 6.5% EIR is what the old 3.5% flat
// default works out to over 7 years (6.44%), so buyers see the same honest
// instalment as before the law changed, now computed the lawful way.
export const DEFAULT_EIR = 6.5;
export const DEFAULT_LOAN_RATIO = 0.9;
export const DEFAULT_TENURE_YEARS = 7;
// Hire Purchase Act caps consumer vehicle loans at 9 years.
export const MAX_TENURE_YEARS = 9;
// Above this, banks underwrite case-by-case (lower margin, shorter tenure,
// sometimes full settlement), so a formula estimate is not a real estimate —
// callers get null and show a "financing on request" message instead.
export const HIGH_VALUE_THRESHOLD = 300000;

// Indicative bank rates as EIR, for the Loan Desk / loan form comparison. These
// were flat promo rates (3.20%..3.60%) converted with flatToEir at 7 years.
// They move — the rate stays editable per attempt and is never a quote.
export const BANK_RATES = [
  { name: "Public Bank",      rate: 5.92, islamic: false },
  { name: "CIMB Bank",        rate: 6.01, islamic: false },
  { name: "Maybank",          rate: 6.10, islamic: false },
  { name: "RHB Bank",         rate: 6.44, islamic: false },
  { name: "Hong Leong Bank",  rate: 6.44, islamic: false },
  { name: "Affin Bank",       rate: 6.44, islamic: false },
  { name: "Bank Muamalat",    rate: 6.61, islamic: true  },
  { name: "Bank Islam",       rate: 6.61, islamic: true  },
];

// Stamped on anything SAVED with a rate (deal sheets, documents, loan
// attempts) so a record made before the switch keeps saying "flat" and is
// never silently re-read as an EIR. Absent = saved the old way = flat.
export const RATE_BASIS = 'eir';
export const rateLabel = (basis) => (basis === RATE_BASIS ? 'EIR' : 'flat');

const monthlyRate = (eirPct) => (Number(eirPct) || 0) / 100 / 12;

// Instalment for a reducing-balance loan: P * r(1+r)^n / ((1+r)^n - 1).
export function monthlyPayment(principal, eirPct, months) {
  const P = Number(principal) || 0;
  const n = Math.round(Number(months) || 0);
  if (P <= 0 || n <= 0) return 0;
  const r = monthlyRate(eirPct);
  if (r <= 0) return P / n;
  const g = Math.pow(1 + r, n);
  return (P * r * g) / (g - 1);
}

export function loanTotals(principal, eirPct, months) {
  const monthly = monthlyPayment(principal, eirPct, months);
  const totalRepayment = monthly * Math.round(Number(months) || 0);
  return {
    monthly,
    totalRepayment,
    totalInterest: Math.max(0, totalRepayment - (Number(principal) || 0)),
  };
}

// Month-by-month schedule: interest falls and principal rises each month,
// because interest is only charged on the balance still owed.
export function amortize(principal, eirPct, months) {
  const n = Math.round(Number(months) || 0);
  const pay = monthlyPayment(principal, eirPct, n);
  const r = monthlyRate(eirPct);
  const rows = [];
  let balance = Number(principal) || 0;
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const principalPart = i === n ? balance : pay - interest;
    balance = Math.max(0, balance - principalPart);
    rows.push({ month: i, payment: principalPart + interest, principal: principalPart, interest, balance });
  }
  return rows;
}

// Largest loan a target instalment can carry at this rate and tenure.
export function principalForPayment(monthly, eirPct, months) {
  const M = Number(monthly) || 0;
  const n = Math.round(Number(months) || 0);
  if (M <= 0 || n <= 0) return 0;
  const r = monthlyRate(eirPct);
  if (r <= 0) return M * n;
  return (M * (1 - Math.pow(1 + r, -n))) / r;
}

// Months needed to bring an instalment down to `monthly`. null when no tenure
// can reach it (the first month's interest alone already exceeds the target).
export function monthsForPayment(principal, eirPct, monthly) {
  const P = Number(principal) || 0;
  const M = Number(monthly) || 0;
  if (P <= 0 || M <= 0) return null;
  const r = monthlyRate(eirPct);
  if (r <= 0) return P / M;
  if (M <= P * r) return null;
  return -Math.log(1 - (P * r) / M) / Math.log(1 + r);
}

// A flat rate quoted over `months`, expressed as the EIR that gives the same
// instalment. For a bank quote issued the old way (allowed until 31 Mar 2027)
// and for labelling deal sheets saved before the switch.
export function flatToEir(flatPct, months) {
  const f = (Number(flatPct) || 0) / 100;
  const n = Math.round(Number(months) || 0);
  if (f <= 0 || n <= 0) return 0;
  const target = n / (1 + f * (n / 12)); // annuity factor the flat instalment implies
  let lo = 1e-9, hi = 0.1;               // monthly rate bounds (0% .. 120% a year)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const annuity = (1 - Math.pow(1 + mid, -n)) / mid;
    if (annuity > target) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 1200;
}

// The one-line estimate shown next to a price across the marketplace and CRM:
// 90% loan, 7 years, DEFAULT_EIR. Rounded RM, or null when there is no honest
// estimate (missing price, or above HIGH_VALUE_THRESHOLD).
export const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  if (price > HIGH_VALUE_THRESHOLD) return null;
  return Math.round(monthlyPayment(price * DEFAULT_LOAN_RATIO, DEFAULT_EIR, DEFAULT_TENURE_YEARS * 12));
};
