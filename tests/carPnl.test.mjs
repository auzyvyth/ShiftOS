// Run: npm run test:carpnl. Guards src/utils/carPnl.js, the ONE profit maths for a car.
import { carPnl, holdingPerDay, daysHeld } from '../src/utils/carPnl.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (a === e) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };
const NOW = Date.UTC(2026, 10, 12);
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

// Holding: interest AND overhead, not one or the other.
const h = holdingPerDay(100000, { floor_plan_rate: 7.3, monthly_overhead: 30000, avg_fleet_size: 50 });
eq(Math.round(h.interest), 20, 'interest 100k at 7.3%/yr = RM20/day');
eq(Math.round(h.overhead), 20, 'overhead 30k/50 cars/30 days = RM20/day');
eq(Math.round(h.total), 40, 'both add up');
eq(holdingPerDay(0, {}).total, 0, 'no settings, no holding');
eq(daysHeld(ago(10), null, NOW), 10, '10 days on the lot');
eq(daysHeld(null, null, NOW), null, 'unknown start');
eq(daysHeld(ago(30), ago(5), NOW), 25, 'clock stops at the sale');

const cfg = { floor_plan_rate: 7.3, monthly_overhead: 30000, avg_fleet_size: 50, runner_fee: 150, admin_fee: 200, warranty_reserve_pct: 2 };
const base = { purchase: 100000, reconEstimate: 2000, reconJobs: [], asking: 120000, startDate: ago(10), engineCc: 1500, cfg };

// Unsold: transfer is an estimate (100 + 30 + runner 150 + road tax 1500cc).
const u = carPnl(base, NOW);
eq(u.days, 10, 'days counted from the start');
eq(u.holding, 400, 'RM40/day x 10 days');
eq(u.transferIsEstimate, true, 'unsold = transfer estimated');
eq(u.lines.find((l) => l.key === 'transfer').val, 100 + 30 + 150 + 90, 'transfer estimate includes runner and road tax');
eq(u.lines.find((l) => l.key === 'admin').val, 200, 'admin fee counted');
eq(u.lines.find((l) => l.key === 'warranty').val, 0, 'no warranty months = no reserve');
eq(u.net, 120000 - (100000 + 2000 + 400 + 370 + 200), 'net if sold at asking today');
eq(u.daysUntilZero, Math.floor(u.net / 40), 'profit eaten in net / per-day days');
eq(u.projections[0].net, u.net - 1200, '30 more days costs RM1,200');

// Tomorrow costs more than today: the meter moves.
eq(carPnl(base, NOW + 86400000).net, u.net - 40, 'one more day = RM40 less');

// Break-even really is zero profit.
const be = carPnl({ ...base, asking: u.breakeven }, NOW);
eq(Math.abs(be.net) <= 1, true, 'asking = break-even gives ~0 net');

// Warranty reserve follows the price, and break-even accounts for it.
const w = carPnl({ ...base, warrantyMonths: 12 }, NOW);
eq(w.lines.find((l) => l.key === 'warranty').val, 2400, '2% of RM120k');
eq(Math.abs(carPnl({ ...base, warrantyMonths: 12, asking: w.breakeven }, NOW).net) <= 1, true, 'break-even with a warranty reserve');

// Recon: the larger of estimate and logged jobs (one rule).
eq(carPnl({ ...base, reconJobs: [{ cost: 3000 }] }, NOW).lines.find((l) => l.key === 'recon').val, 3000, 'jobs over estimate win');
eq(carPnl({ ...base, reconJobs: [{ cost: 500 }] }, NOW).lines.find((l) => l.key === 'recon').val, 2000, 'a job never lowers recon');

// Sold: real price, real handover costs, clock stopped, no projections.
const s = carPnl({ ...base, isSold: true, soldPrice: 118000, soldDate: ago(4), handoverCost: 190, adSpend: 300, addonRevenue: 1500, addonCost: 600 }, NOW);
eq(s.revenue, 118000, 'sold price, not asking');
eq(s.days, 6, 'held 6 days until the sale');
eq(s.transferIsEstimate, false, 'handover cost replaces the estimate');
eq(s.back, 900, 'add-ons net');
eq(s.breakeven, null, 'no break-even once sold');
eq(s.projections.length, 0, 'no projections once sold');
eq(s.net, 118000 - (100000 + 2000 + 240 + 300 + 190 + 200) + 900, 'sold net');

// Unknown start date: no holding, says so.
const nd = carPnl({ ...base, startDate: null }, NOW);
eq(nd.holding, 0, 'unknown start = no holding counted');
eq(nd.startKnown, false, 'flagged');

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`carPnl: ${pass} checks passed`);
