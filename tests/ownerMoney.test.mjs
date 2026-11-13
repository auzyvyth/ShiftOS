// Run: npm run test:ownermoney. The owner's money totals must equal the sum of the cars.
import { ownerMoney, mergeCars, monthKey } from '../src/utils/ownerMoney.js';
import { carPnl } from '../src/utils/carPnl.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (a === e) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };
const NOW = Date.UTC(2026, 10, 12, 4); // 12 Nov 2026, noon in Malaysia
const day = (d) => new Date(NOW - d * 86400000).toISOString();
const cfg = { floor_plan_rate: 7.3, monthly_overhead: 30000, avg_fleet_size: 50 };

const listings = [
  { id: 'a', status: 'sold', selling_price: 120000, sold_price: 118000, sold_at: day(2), created_at: day(40), commission_amount: 1000 },
  { id: 'b', status: 'sold', selling_price: 90000, sold_price: 90000, sold_at: day(3), created_at: day(30) },          // no buy price
  { id: 'c', status: 'available', selling_price: 100000, created_at: day(70) },
  { id: 'd', status: 'available', selling_price: 50000, created_at: day(10) },                                          // losing
  { id: 'e', status: 'sold', selling_price: 80000, sold_price: 80000, sold_at: day(20), created_at: day(60) },         // last month
];
const units = [
  { id: 'ua', listing_id: 'a', purchase_price: 100000, recon_cost: 2000, created_at: day(40) },
  { id: 'ub', listing_id: 'b', purchase_price: 0, created_at: day(30) },
  { id: 'uc', listing_id: 'c', purchase_price: 90000, recon_cost: 1000, created_at: day(70) },
  { id: 'ud', listing_id: 'd', purchase_price: 52000, created_at: day(10) },
  { id: 'ue', listing_id: 'e', purchase_price: 70000, created_at: day(60) },
  { id: 'uz', listing_id: null, purchase_price: 30000, created_at: day(5), status: 'in_stock', brand: 'Perodua', model: 'Myvi' },
];
const ctx = { cfg, ads: { ua: 300 }, handover: { a: 130 }, addons: { a: { rev: 1500, cost: 600 } } };
const cars = mergeCars(listings, units);
eq(cars.length, 6, 'stock record without a listing still counts');
const m = ownerMoney(cars, ctx, NOW);

eq(monthKey(NOW), '2026-11', 'month key in Malaysia time');
eq(m.month.units, 2, 'two sold this month');
eq(m.month.revenue, 118000 + 90000, 'revenue counts every sold car');
eq(m.month.leftOut, 1, 'car with no buy price left out of profit');
const aNet = carPnl({ purchase: 100000, reconEstimate: 2000, commission: 1000, handoverCost: 130, adSpend: 300, addonRevenue: 1500, addonCost: 600,
  asking: 120000, soldPrice: 118000, isSold: true, startDate: day(40), soldDate: day(2), cfg }, NOW).net;
eq(m.month.gross, aNet, 'month gross = the sum of the costed cars');
eq(m.month.addonsGross, 900, 'add-ons net');
eq(m.prev.units, 1, 'sold 20 days ago = last month');
eq(m.stuck.find((x) => x.id === 'uz').flag, 'no_price', 'no asking price is not "losing"');
eq(m.months.length, 6, 'six months for the chart');
eq(m.months[5].gross, m.month.gross, 'chart this month = snapshot');
eq(m.overheadToDate, Math.round(30000 * 12 / 30), 'overhead counted to today');
eq(m.netAfterOverhead, m.month.gross - m.overheadToDate, 'net after overhead');
eq(m.stock.count, 3, 'three cars in stock (c, d and the unlisted one)');
eq(m.stock.over60, 1, 'one over 60 days');
eq(m.stock.losing, 1, 'one losing money at its asking price');
eq(m.stuck[0].id, 'c', 'oldest first');
eq(m.stuck[0].flag, 'ageing', 'flagged ageing');
eq(m.stuck.find((x) => x.id === 'd').flag, 'losing', 'flagged losing');
eq(m.stock.atCost, 90000 + 1000 + 52000 + 30000, 'money tied up at cost');

// Daily series (Overview's 30-day chart) sums the same rows as the month.
eq(m.daily.length, 30, 'thirty days for the chart');
eq(m.daily[29].day, '2026-11-12', 'last day is today, Malaysia time');
eq(m.daily.find((x) => x.day === '2026-11-10').revenue, 118000, 'car a on its sale day');
eq(m.daily.reduce((s, x) => s + x.revenue, 0), 118000 + 90000 + 80000, 'chart total = every car sold in 30 days');
eq(m.prevToDate.units, 0, 'last month up to the 12th: car e sold on 23 Oct is not counted');
eq(m.prev.units, 1, 'whole last month still has car e');
if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`ownerMoney: ${pass} checks passed`);
