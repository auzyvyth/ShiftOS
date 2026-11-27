// The Accountant overview's profit maths, in ONE place (DMS P0, 2026-11-27: `npm run test:accountantnet`).
// Found by writing the test: Net Profit was GP - expenses - COMMISSION PAID, but a sold car's stored
// `stock_units.gross_profit` (DB trigger compute_stock_unit_gp) is ALREADY after the car's commission,
// so every paid commission was taken off twice. The fallback and the cell edit also left commission out,
// so one month could mix three different "GP" meanings. Now: gross profit is always AFTER commission,
// and net profit = gross profit - expenses. (This is the sale-time GP; carPnl() is the full per-car
// engine with holding, transfer and warranty. The two are not the same number: see DEALER_NUMBERS_AUDIT.)
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// unitGp = stock_units.gross_profit (null for a unit not synced yet). Else worked out the same way as the DB.
export function rowGross({ unitGp, sold, purchase, recon, services, commission }) {
  if (unitGp != null && Number.isFinite(Number(unitGp))) return Number(unitGp);
  return n(sold) - n(purchase) - n(recon) - n(services) - n(commission);
}

export function overviewTotals(rows, expenses) {
  const revenue = rows.reduce((s, r) => s + n(r.sold_price), 0);
  const gross = rows.reduce((s, r) => s + n(r.gross_profit), 0);
  const exp = n(expenses);
  return { revenue, gross, expenses: exp, net: gross - exp, margin: revenue > 0 ? (gross / revenue) * 100 : 0 };
}
