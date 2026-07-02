// Mask a Malaysian IC (NRIC) for glanceable read-only displays. Shows the
// birthdate portion (YYMMDD) and hides the place-of-birth + serial (the
// identifying part): 901231-••-••••
//
// Use ONLY for at-a-glance summaries. Edit forms and legal documents (sales
// agreements etc.) intentionally keep the full IC — the owning tenant needs it
// for paperwork, and RLS already restricts who can read it at all.
export function maskIC(ic) {
  const d = String(ic || '').replace(/\D/g, '');
  if (d.length < 12) return ic || '';
  return `${d.slice(0, 6)}-••-••••`;
}
