// Why a bank turned a loan down. ONE list, read by HP Board and the dealer LeadDrawer.
// They each had their own copy and disagreed (LeadDrawer saved 'dsr', 'valuation_gap',
// 'margin'; HP Board saved 'dsr_exceeded', 'income_insufficient', 'age_limit'), so a
// reason picked on one screen showed as a raw code on the other.
export const REJECTION_CATEGORIES = [
  { value: 'dsr',                 label: 'DSR too high' },
  { value: 'ccris_issue',         label: 'CCRIS / blacklist' },
  { value: 'income_insufficient', label: 'Income too low' },
  { value: 'employment_type',     label: 'Employment type' },
  { value: 'age_limit',           label: 'Age limit' },
  { value: 'vehicle_age',         label: 'Car too old' },
  { value: 'valuation_gap',       label: 'Valuation gap' },
  { value: 'margin',              label: 'Margin / LTV' },
  { value: 'other',               label: 'Other' },
];

// Old or short codes saved before the lists were merged.
const ALIASES = { dsr_exceeded: 'dsr', ccris: 'ccris_issue' };

export function rejectionLabel(code) {
  if (!code) return null;
  const key = ALIASES[code] || code;
  return REJECTION_CATEGORIES.find(c => c.value === key)?.label ?? 'Other';
}
