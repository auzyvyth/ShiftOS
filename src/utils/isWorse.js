// When a dealer number turns RED (owner, 2026-11-16: "negative or low numbers do not communicate").
// ONE rule for Overview and Revenue: below zero, or lower than the same point of the period before
// (the comparison the screen already prints). "Low" on its own has no honest line: RM 20k is a lot for
// one dealer and little for another, so there is no fixed threshold. Only for numbers where MORE is
// better (sales, gross, cars sold, add-ons); never for a cost (commission, overhead, money tied up).
// npm run test:isworse
export function isWorse(value, before) {
  if (value == null || value === '') return false;
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  if (v < 0) return true;
  if (before == null || before === '') return false;
  const b = Number(before);
  return Number.isFinite(b) && b > 0 && v < b;
}
