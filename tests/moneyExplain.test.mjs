// Run: npm run test:moneyexplain
// Guards the Overview drill-down (src/utils/moneyExplain.js): every breakdown starts from the SAME rows
// as the number that opened it, and every list of shares adds up to exactly 100.0.
import { ownerMoney, mergeCars, periodWindow } from '../src/utils/ownerMoney.js';
import { explain, shares } from '../src/utils/moneyExplain.js';
import { carPnl } from '../src/utils/carPnl.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (JSON.stringify(a) === JSON.stringify(e)) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };
const near = (a, e, label) => { if (Math.abs(a - e) < 0.05) pass++; else fails.push(`${label}: got ${a}, want ${e}`); };

const NOW = Date.UTC(2026, 10, 12, 4);         // Thursday 12 Nov 2026, noon in Malaysia
const day = (d) => new Date(NOW - d * 86400000).toISOString();
const cfg = { floor_plan_rate: 7.3, monthly_overhead: 30000, avg_fleet_size: 50 };

const listings = [
  { id: 'a', status: 'sold', brand: 'Toyota', model: 'Alphard', year: 2021, selling_price: 120000, sold_price: 118000, sold_at: day(1), created_at: day(40), commission_amount: 1000 },
  { id: 'b', status: 'sold', brand: 'Honda', model: 'Civic', year: 2019, selling_price: 90000, sold_price: 90000, sold_at: day(2), created_at: day(30) },
  { id: 'c', status: 'available', brand: 'Toyota', model: 'Vellfire', year: 2020, selling_price: 100000, created_at: day(70) },
  { id: 'd', status: 'available', brand: 'Perodua', model: 'Myvi', year: 2022, selling_price: 50000, created_at: day(10) },
  { id: 'e', status: 'sold', brand: 'Toyota', model: 'Harrier', year: 2025, selling_price: 80000, sold_price: 80000, sold_at: day(20), created_at: day(60) }, // last month
  { id: 'f', status: 'sold', brand: 'Honda', model: 'City', year: 2018, selling_price: 40000, sold_price: 40000, sold_at: day(366), created_at: day(420) }, // 11 Nov last year, a real sale
];
const units = [
  { id: 'ua', listing_id: 'a', purchase_price: 100000, recon_cost: 2000, created_at: day(40) },
  { id: 'ub', listing_id: 'b', purchase_price: 80000, created_at: day(30) },
  { id: 'uc', listing_id: 'c', purchase_price: 90000, recon_cost: 1000, created_at: day(70) },
  { id: 'ud', listing_id: 'd', purchase_price: 52000, created_at: day(10) },
  { id: 'ue', listing_id: 'e', purchase_price: 70000, created_at: day(60) },
  { id: 'uf', listing_id: 'f', purchase_price: 30000, created_at: day(420) },
];
const ctx = {
  cfg, ads: { ua: 300 }, handover: { a: 130 },
  addons: {
    a: { rev: 2500, cost: 1000, items: [{ name: 'Window tint', rev: 800, cost: 300 }, { name: 'Warranty', rev: 1200, cost: 500 }, { name: 'Coating', rev: 500, cost: 200 }] },
    b: { rev: 1000, cost: 400, items: [{ name: 'Warranty', rev: 1000, cost: 400 }] },
  },
  broker: { b: { amount: 800, items: [{ name: 'Auzyvyth', amount: 800, paid: false }] } },
};
const m = ownerMoney(mergeCars(listings, units), ctx, NOW);
const sumPct = (sec) => Math.round(sec.rows.reduce((s, r) => s + (r.pct || 0), 0) * 10) / 10;

// ── shares always add to 100.0 ──
eq(Math.round(shares([1, 1, 1]).reduce((s, v) => s + v, 0) * 10) / 10, 100, 'three equal shares add to 100');
eq(Math.round(shares([333, 333, 334, 1]).reduce((s, v) => s + v, 0) * 10) / 10, 100, 'awkward shares add to 100');
eq(shares([5, 0]), [100, 0], 'one row is 100');
eq(shares([0, 0]), [0, 0], 'nothing is zero, not NaN');

// ── periods ──
const wk = periodWindow('week', NOW);
eq(new Date(wk.start + 8 * 3600000).toISOString().slice(0, 10), '2026-11-09', 'the week starts on Monday, Malaysia time');
eq(m.periods.week.cur.units, 2, 'cars sold this week: a (1 day ago) and b (2 days ago)');
eq(m.periods.month.cur.units, 2, 'cars sold this month');
eq(m.periods.month.cur === m.month, true, 'the month view is the old month figure');
eq(m.periods.year.cur.units, 3, 'this year: a, b and e');
eq(m.periods.year.lastYear, null, 'the year view has no separate last-year figure');
eq(m.periods.month.lastYear?.units, 1, 'last year is shown only because a car really sold in that month');
eq(m.periods.week.lastYear?.units, 1, 'the same week last year also had that real sale');
// Without it, no baseline is invented: a new dealer sees no last-year figure at all.
const fresh = ownerMoney(mergeCars(listings.filter((l) => l.id !== 'f'), units), ctx, NOW);
eq([fresh.periods.week.lastYear, fresh.periods.month.lastYear, fresh.periods.year.lastYear], [null, null, null], 'no last-year sales means no last-year figure');
eq(m.periods.week.series.length, 8, 'eight weeks for the week chart');
eq(m.periods.year.series.length, 12, 'twelve months for the year chart');
eq(m.periods.month.series[5].gross, m.month.gross, 'month chart ends on this month');

// ── broker commission is INSIDE the engine ──
const plain = carPnl({ purchase: 80000, asking: 90000, soldPrice: 90000, isSold: true, startDate: day(30), soldDate: day(2), cfg }, NOW);
const withBroker = carPnl({ purchase: 80000, asking: 90000, soldPrice: 90000, isSold: true, startDate: day(30), soldDate: day(2), cfg, brokerCommission: 800 }, NOW);
eq(Math.round(plain.net - withBroker.net), 800, 'a broker commission of 800 lowers the car profit by 800');
eq(withBroker.commissionParts, { team: 0, broker: 800 }, 'the commission line says how it splits');
eq(withBroker.lines.filter((l) => l.key === 'commission').length, 1, 'one commission line, not two');
eq(m.month.commission, 1000 + 800, 'commission this month = salesmen + broker');
eq(m.month.brokerCommission, 800, 'broker part of it');
eq(m.month.brokerSold, 1, 'one car sold through a broker');

// ── every breakdown starts at the number that opened it and adds to 100 ──
const keys = ['sales', 'units', 'addons', 'gross', 'commission', 'net', 'overhead', 'tied', 'avgdays', 'holding', 'over60', 'nocost', 'stock_brand', 'spend:holding', 'spend:commission'];
for (const k of keys) {
  const d = explain(m, 'month', k);
  eq(typeof d.title, 'string', `${k}: has a title`);
  for (const sec of d.sections) {
    const all = sec.rows.every((r) => r.pct != null);
    if (all && sec.rows.length && !(k === 'gross' && sec.heading === 'By car')) eq(sumPct(sec), 100, `${k} / ${sec.heading} adds to 100`);
  }
}
const sales = explain(m, 'month', 'sales');
eq(sales.total, 118000 + 90000, 'sales total = month revenue');
eq(sales.sections[0].rows[0].label, '2021 Toyota Alphard', 'biggest sale first');
eq(sales.sections[0].rows[1].sub, 'Sold through Auzyvyth', 'a broker sale says who sold it');

const addons = explain(m, 'month', 'addons');
eq(addons.total, 3500, 'add-ons total = add-on revenue');
eq(addons.sections[0].rows.map((r) => r.label), ['Warranty', 'Window tint', 'Coating'], 'top add-on first');
eq(addons.sections[0].rows[0].value, 2200, 'warranty counts across both cars');
eq(addons.sections[0].rows[0].pct, 62.9, 'warranty share');
eq(sumPct(addons.sections[0]), 100, 'add-on shares add to 100');

const comm = explain(m, 'month', 'commission');
eq(comm.total, 1800, 'commission total');
eq(comm.sections[0].rows.map((r) => r.label), ['Your salesmen', 'Auzyvyth'], 'who it goes to');
eq(comm.sections[0].rows[1].sub.includes('still owed'), true, 'a broker row says what is still owed');

const unitsX = explain(m, 'month', 'units');
eq(unitsX.total, 2, 'cars sold total');
eq(unitsX.sections[0].rows.map((r) => r.label), ['Auzyvyth', 'Your team and direct sales'], 'cars sold by whom');

const gross = explain(m, 'month', 'gross');
eq(gross.total, m.month.gross, 'gross total = month gross');
const last = gross.sections[0].rows[gross.sections[0].rows.length - 1];
eq(last.label, 'Gross profit', 'the waterfall ends on the gross profit');
eq(gross.sections[0].rows.some((r) => r.label === 'Commission'), true, 'commission is a cost line in the waterfall');

const net = explain(m, 'month', 'net');
eq(net.total, m.netAfterOverhead, 'after overhead total');
eq(explain(m, 'month', 'tied').total, m.stock.atCost, 'money tied up total');
eq(explain(m, 'week', 'units').total, 2, 'week view works');
eq(explain(m, 'year', 'sales').total, m.periods.year.cur.revenue, 'year view works');
eq(explain(m, 'month', 'nothing_here').empty, true, 'an unknown key is empty, not a crash');

if (fails.length) { console.error(`FAIL ${fails.length}\n` + fails.join('\n')); process.exit(1); }
console.log(`moneyExplain: ${pass} passed`);
