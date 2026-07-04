// Standard Malaysian car loan estimate used across the app.
// Parameters: 90% loan ratio · 3.5% flat p.a. · 7-year tenure
// Returns the rounded monthly instalment, or null for missing/invalid price.
// Above HIGH_VALUE_THRESHOLD, banks underwrite case-by-case (lower margin,
// shorter tenure, sometimes full settlement) — the flat formula's output is
// not a real estimate at that tier, so callers get null and show a
// "financing available on request" style message instead.
export const HIGH_VALUE_THRESHOLD = 300000;

export const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  if (price > HIGH_VALUE_THRESHOLD) return null;
  return Math.round((price * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12));
};
