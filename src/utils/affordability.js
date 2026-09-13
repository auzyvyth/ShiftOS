// "Can I afford this car?" — pure math only, no I/O, so it can be unit tested
// and reused by any surface without dragging in React.
//
// The monthly installment itself is NOT computed here — callers pass it in
// from `calcMonthly` (financing.js), the one canonical loan estimate already
// shown next to every price on CarDetailPage. A second loan formula here
// would repeat the exact drift AUDIT_DEALER_DASHBOARD.md's L8 already
// documents (two calculators disagreeing on one deal).
//
// DSR (debt-service ratio) bands below are a common rule-of-thumb malaysian
// buyers use to gut-check themselves — NOT a bank's real approval threshold,
// which varies by bank and income bracket. Never render this as "approved" /
// "rejected" (same AI-trust-boundary rule as everywhere else on the
// platform): it's an estimate the buyer still confirms with the seller.
export const DSR_BANDS = [
  { max: 40, key: 'comfortable', label: 'Looks comfortable', color: '#16a34a' },
  { max: 60, key: 'manageable', label: 'Manageable, but tight', color: '#d97706' },
  { max: Infinity, key: 'stretched', label: 'Likely to strain your budget', color: '#dc2626' },
];

export function affordabilityBand(dsrPct) {
  return DSR_BANDS.find(b => dsrPct <= b.max) || DSR_BANDS[DSR_BANDS.length - 1];
}

// netIncome / existingCommitments / monthlyInstallment are all monthly RM
// figures. existingCommitments is the caller's job to total up (basic: one
// number typed in; detailed: sum of the category breakdown) — this function
// only takes the final total so it doesn't care which mode produced it.
export function computeAffordability({ netIncome, existingCommitments = 0, monthlyInstallment }) {
  const income = Number(netIncome) || 0;
  const commitments = Math.max(0, Number(existingCommitments) || 0);
  const installment = Number(monthlyInstallment) || 0;
  if (income <= 0 || installment <= 0) return null;

  const totalCommitments = commitments + installment;
  const dsrPct = (totalCommitments / income) * 100;

  return {
    dsrPct: Math.round(dsrPct * 10) / 10,
    disposable: Math.round(income - totalCommitments),
    band: affordabilityBand(dsrPct),
  };
}
