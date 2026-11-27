// Run: npm run test:carcosts. The cost list's rules, and that the SQL repair kinds match.
import fs from 'fs';
import { billsToPay, bucketOf, RECON_KINDS, fromLedger, fromReconJob, fromAdSpend, pnlInputs, totalsByUnit, stateTotals, checkCost } from '../src/utils/carCosts.js';
import { carPnl } from '../src/utils/carPnl.js';

let pass = 0; const fails = [];
const eq = (a, e, label) => { const A = JSON.stringify(a), E = JSON.stringify(e); if (A === E) pass++; else fails.push(`${label}: got ${A}, want ${E}`); };

eq([bucketOf('recon'), bucketOf('detailing'), bucketOf('ads'), bucketOf('transport'), bucketOf('inspection'), bucketOf('other'), bucketOf('x')],
  ['recon', 'recon', 'ads', 'other', 'other', 'other', 'other'], 'buckets');

const rows = [
  fromLedger({ id: 1, stock_unit_id: 'u1', kind: 'recon', label: 'Tyres', amount: '1280', state: 'owed', due_date: '2026-12-10' }),
  fromLedger({ id: 2, stock_unit_id: 'u1', kind: 'transport', label: 'Tow', amount: 350, state: 'paid' }),
  fromLedger({ id: 3, stock_unit_id: 'u1', kind: 'detailing', label: 'Polish', amount: 250, state: 'estimate' }),
  fromReconJob({ id: 4, stock_unit_id: 'u1', title: 'Aircond', cost: 1200, status: 'done', completed_at: '2026-11-20' }),
  fromReconJob({ id: 5, stock_unit_id: 'u2', title: 'Paint', cost: 900, status: 'pending' }),
  fromAdSpend({ id: 6, stock_unit_id: 'u1', channel: 'facebook', amount: 120 }),
];
eq([rows[3].state, rows[4].state, rows[5].state, rows[5].label], ['paid', 'estimate', 'paid', 'Ads, Facebook'], 'old rows map in');
const u1 = rows.filter((r) => r.unitId === 'u1');
eq(pnlInputs(u1), { reconJobs: [{ cost: 1280 }, { cost: 250 }, { cost: 1200 }], adSpend: 120, otherCosts: 350 }, 'carPnl inputs');
eq(totalsByUnit(rows), { u1: { ads: 120, other: 350 }, u2: { ads: 0, other: 0 } }, 'per-car totals for the many-car screens');
eq(stateTotals(u1), { paid: 1670, owed: 1280, estimate: 250 }, 'paid / owed / estimated');

// The profit counts every row once, in the right line.
const NOW = Date.UTC(2026, 10, 27);
const p = carPnl({ purchase: 50000, reconEstimate: 1000, asking: 60000, startDate: null, cfg: {}, ...pnlInputs(u1) }, NOW);
const line = (k) => p.lines.find((l) => l.key === k)?.val;
eq([line('recon'), line('ads'), line('other')], [2730, 120, 350], 'recon = max(estimate, repairs), ads, other');
eq(p.costTotal, 50000 + 2730 + 120 + 350 + 130 + 0, 'total includes the other costs (+ transfer estimate)');
eq(carPnl({ purchase: 1, asking: 2, cfg: {} }, NOW).lines.find((l) => l.key === 'other')?.val, 0, 'no rows, other line is 0');

eq(checkCost({ kind: 'recon', label: '  4  tyres ', amount: 'RM 1,280', state: 'owed', due: '2026-12-10' }).row,
  { kind: 'recon', label: '4 tyres', payee: null, amount: 1280, state: 'owed', due_date: '2026-12-10' }, 'form cleans the input');
eq(checkCost({ kind: 'recon', label: 'x', amount: 5, state: 'paid', due: '2026-12-10' }).row.due_date, null, 'a due date only on an owed bill');
eq(Object.keys(checkCost({ kind: 'nope', label: '', amount: 0, state: 'x' }).errors).sort(), ['amount', 'kind', 'label', 'state'], 'every error named');

// Bills to pay: owed only, overdue first, then by due date, no date last; Malaysia calendar.
const T = Date.UTC(2026, 10, 27, 17, 0); // 28 Nov 01:00 in Malaysia
const bills = billsToPay([
  { id: 'a', source: 'car_costs', state: 'owed', due: '2026-12-10', amount: 1 },
  { id: 'b', source: 'car_costs', state: 'owed', due: null, amount: 1 },
  { id: 'c', source: 'car_costs', state: 'owed', due: '2026-11-20', amount: 1 },
  { id: 'd', source: 'car_costs', state: 'paid', due: null, amount: 1 },
  { id: 'e', source: 'car_costs', state: 'owed', due: '2026-11-27', amount: 1 },
  { id: 'f', source: 'recon_jobs', state: 'owed', amount: 1 },
], T);
eq(bills.map((x) => x.id), ['c', 'e', 'a', 'b'], 'order: most overdue, overdue, by due date, no date');
eq(bills.map((x) => x.overdueDays), [8, 1, 0, 0], 'days overdue on the Malaysia date');

const sql = fs.readFileSync(new URL('../supabase/migrations/20261127b_car_costs.sql', import.meta.url), 'utf8');
eq(sql.includes(`c.kind in (${RECON_KINDS.map((k) => `'${k}'`).join(', ')})`), true, 'SQL repair kinds = RECON_KINDS');

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`carCosts: ${pass} checks passed`);
