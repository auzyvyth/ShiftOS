// Derive date of birth / age from a Malaysian MyKad (IC) number.
//
// The first 6 digits of a MyKad are the birth date in YYMMDD form, so for any
// account that already gives us an IC (dealer, salesman) we can verify age
// WITHOUT collecting a separate date-of-birth field — collecting it twice would
// be redundant data under PDPA 2010's data-minimisation expectation. Buyers,
// who have no IC, are handled with an explicit 18+ confirmation instead.
//
// MyKad does not encode the century. We pivot on the current two-digit year:
// a YY at or below it is treated as 2000s, otherwise 1900s. That is correct for
// anyone old enough to legally hold an IC, which is all we need for an 18+ gate.

export function dobFromIC(ic) {
  const d = String(ic || '').replace(/\D/g, '');
  if (d.length < 6) return null;
  const yy = +d.slice(0, 2);
  const mm = +d.slice(2, 4);
  const dd = +d.slice(4, 6);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const now = new Date();
  const pivot = now.getFullYear() % 100;
  const year = yy <= pivot ? 2000 + yy : 1900 + yy;
  const dob = new Date(year, mm - 1, dd);
  // Reject impossible dates (e.g. 31 Feb rolls into March) and future births.
  if (dob.getMonth() !== mm - 1 || dob.getDate() !== dd || dob > now) return null;
  return dob;
}

export function ageFromIC(ic) {
  const dob = dobFromIC(ic);
  if (!dob) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

// true / false when the IC yields a valid DOB, null when age can't be derived
// (too short / malformed) — callers decide how to treat an indeterminate IC.
export function isAdultFromIC(ic, min = 18) {
  const age = ageFromIC(ic);
  return age == null ? null : age >= min;
}
