// The dealer's commission rule, in ONE place. It was worked out three times
// (CarForm, AddCarForm, Salesmanpanel) with different defaults and rounding,
// and CarForm only offered it behind an "Apply" link nobody pressed — 18 of 25
// sold cars ended up at RM0. Every form now auto-fills from this and the field
// stays editable.
//
// profiles.commission_config = { type: 'flat' | 'percent_sale' | 'percent_gross', value }
// A dealer who never saved one gets the same default Settings shows.
export const DEFAULT_COMMISSION = { type: 'percent_gross', value: 10 };

const n = (v) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : null;
};

// Rounded to RM50 for percentages; a flat rate is paid as typed.
// Returns null when the rule needs a number we don't have (no price, or a
// margin rule with no cost) — the caller leaves the field alone then.
export function suggestCommission(cfg, { sell, cost } = {}) {
  const rule = cfg && cfg.type ? cfg : DEFAULT_COMMISSION;
  const value = n(rule.value);
  if (!value || value <= 0) return null;
  const price = n(sell);
  if (rule.type === 'flat') return Math.round(value);
  if (rule.type === 'percent_sale') {
    return price ? Math.round((price * value) / 100 / 50) * 50 : null;
  }
  const base = n(cost);
  if (!price || base == null || price <= base) return null;
  return Math.round(((price - base) * value) / 100 / 50) * 50;
}

export function describeCommissionRule(cfg) {
  const rule = cfg && cfg.type ? cfg : DEFAULT_COMMISSION;
  if (rule.type === 'flat') return 'flat rate';
  if (rule.type === 'percent_sale') return `${rule.value}% of sale price`;
  return `${rule.value}% of margin`;
}
