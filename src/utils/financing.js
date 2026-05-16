// Standard Malaysian car loan estimate used across the app.
// Parameters: 90% loan ratio · 3.5% flat p.a. · 7-year tenure
// Returns the rounded monthly instalment, or null for missing/invalid price.
export const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  return Math.round((price * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12));
};
