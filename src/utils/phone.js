// Normalizes any Malaysian phone to +60XXXXXXXXX
export function normalizeMYPhone(raw = '') {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.startsWith('60')) return '+' + digits;
  if (digits.startsWith('0')) return '+6' + digits;
  return '+60' + digits;
}

// For display: +60 12-345 6789
export function formatMYPhone(raw = '') {
  const normalized = normalizeMYPhone(raw);
  const digits = normalized.replace('+60', '');
  if (digits.length === 9)  return `+60 ${digits.slice(0,1)}-${digits.slice(1,5)} ${digits.slice(5)}`;
  if (digits.length === 10) return `+60 ${digits.slice(0,2)}-${digits.slice(2,6)} ${digits.slice(6)}`;
  return normalized;
}
