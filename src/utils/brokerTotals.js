// The dealer's broker numbers, summed for Overview (BROKER-2, owner 2026-11-15: "go straight into
// Overview as totals"). ONE leaf per broker: the row dealer_my_brokers() returns (every figure counted
// in the database, once). This file only ADDS the rows up, the same commit-tree rule as the money
// numbers (docs/ARCHITECTURE.md section 8). Pure: `npm run test:brokertotals`.
//
// holding / to_approve / paid arrive with migration 20261116a. Until it is applied the rows lack them
// and `complete` is false: the screen then leaves those out instead of showing a false 0.
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function brokerTotals(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  // "Requested" and "declined" are not working brokers yet. Revoked ones still count: commission
  // owed to a broker stays owed after they leave.
  const working = list.filter((b) => ['active', 'paused', 'revoked'].includes(b.status));
  const sum = (k) => working.reduce((t, b) => t + num(b[k]), 0);
  return {
    any: list.some((b) => b.status === 'active' || b.status === 'paused'),
    connected: list.filter((b) => b.status === 'active').length,
    paused: list.filter((b) => b.status === 'paused').length,
    carsOnPages: sum('cars_on_page'),
    buyers: sum('buyers'),
    sold: sum('sold'),
    owed: sum('owed'),
    holding: sum('holding'),
    toApprove: sum('to_approve'),
    paid: sum('paid'),
    complete: working.every((b) => 'to_approve' in b && 'holding' in b && 'paid' in b),
  };
}
