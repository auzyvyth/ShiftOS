// Canonical Malaysian phone form — digits only with leading country code 60,
// no plus. Mirror of the DB normalize_my_phone() so frontend dedup queries match
// what the leads_normalize_phone trigger stores.
//   0112345678 / +60112345678 / 60112345678  ->  60112345678
export function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('60')) return d;
  if (d.startsWith('0')) return '60' + d.slice(1);
  return '60' + d;
}
