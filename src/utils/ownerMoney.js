// The owner's money picture (owner, 2026-11-12: "money first, tell the owner everything about the
// money and revenue"). Every figure is a SUM of carPnl() over the dealer's cars, so Overview equals
// the cars underneath it (CLAUDE.md "Dealer numbers", ARCHITECTURE.md section 8). Pure: no React,
// no Supabase. `npm run test:ownermoney`.
//
// A car with no buy price is LEFT OUT of every profit total and counted instead (audit #2: 100 of
// 142 stock cars had none, and a 0 cost reads as a free car). Revenue still counts it.
// Not here on purpose: cash in the bank, bills, receivables. Nothing records them yet.
//
// PERIODS (owner, 2026-11-15): the same per-car rows are totalled over any window (this week, this
// month, this year, and the same window one period back / one year back) by `totalsIn`. The weekly,
// monthly and yearly views are NOT three formulas: they are one function over three date windows.
// Nothing is invented: a window with no sales is zero, and "last year" is only shown when a car was
// actually sold in it (Drevo is new, most dealers have none).
//
// BROKER-2: what an outside broker is owed on a sold car is part of that car's one commission line
// (carPnl `brokerCommission`), so it is inside cars sold, sales, commission and gross, never beside them.
import { carPnl, AGEING_DAYS } from './carPnl.js';

const DAY = 86400000;
const MY_OFFSET = 8 * 3600000; // Malaysia time, for week / month / year boundaries
export const monthKey = (d) => (d ? new Date(new Date(d).getTime() + MY_OFFSET).toISOString().slice(0, 7) : null);
export const dayKey = (d) => (d ? new Date(new Date(d).getTime() + MY_OFFSET).toISOString().slice(0, 10) : null);
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const UNSOLD = ['available', 'reserved', 'unpublished', 'pending_approval', 'in_stock'];
const COST_KEYS = ['recon', 'holding', 'ads', 'other', 'commission', 'transfer', 'admin', 'warranty', 'services'];

// One row per car: the listing and its stock record joined. A stock record with NO listing
// (bought, not listed yet) still counts. A stock record whose listing is not in `listings` does
// NOT: the loader leaves archived (deleted) cars out, and their stock records used to come back
// as unsold stock (18 live, 2026-11-14), inflating "money tied up".
export function mergeCars(listings = [], units = []) {
  const byListing = new Map();
  for (const u of units) if (u.listing_id && !byListing.has(u.listing_id)) byListing.set(u.listing_id, u);
  const rows = listings.map((l) => ({ listing: l, unit: byListing.get(l.id) || null }));
  for (const u of units) if (!u.listing_id) rows.push({ listing: null, unit: u });
  return rows;
}

export function carRow({ listing, unit }, ctx = {}, now = Date.now()) {
  const l = listing || {};
  const u = unit || {};
  const status = l.id ? l.status : (u.status === 'sold' ? 'sold' : 'in_stock');
  const isSold = status === 'sold';
  const listingId = l.id || u.listing_id;
  const tasks = ctx.handover?.[listingId];
  const addons = ctx.addons?.[listingId] || { rev: 0, cost: 0 };
  const broker = ctx.broker?.[listingId] || null;
  const p = carPnl({
    purchase: u.purchase_price,
    reconEstimate: u.recon_cost,
    reconJobs: n(u.recon_actual) > 0 ? [{ cost: u.recon_actual }] : [],
    servicesCost: l.included_services_cost,
    commission: l.commission_amount,
    brokerCommission: broker?.amount,
    handoverCost: tasks == null ? null : tasks,
    adSpend: ctx.ads?.[u.id] || 0,
    otherCosts: ctx.other?.[u.id] || 0,
    addonRevenue: addons.rev, addonCost: addons.cost,
    asking: n(l.selling_price) || n(u.asking_price),
    soldPrice: n(l.sold_price) || n(u.sold_price),
    isSold,
    startDate: u.purchase_date || u.created_at || l.created_at,
    soldDate: l.sold_at || u.sold_date,
    engineCc: l.engine_cc || u.engine_cc,
    warrantyMonths: l.warranty_months,
    cfg: ctx.cfg || {},
  }, now);
  const title = [l.year || u.year, l.brand || u.brand, l.model || u.model, l.variant].filter(Boolean).join(' ') || 'Car';
  const soldRaw = isSold ? (l.sold_at || u.sold_date) : null;
  const soldAt = soldRaw ? new Date(soldRaw).getTime() : null;
  return {
    id: listingId || u.id, title, status, isSold,
    // Who sold it (car_listings.assigned_to; the won trigger sets it to the closer). Team's per-salesman profit.
    sellerId: l.assigned_to || null,
    brand: String(l.brand || u.brand || '').trim() || 'Other',
    soldAt: Number.isFinite(soldAt) ? soldAt : null,
    soldMonth: isSold ? monthKey(soldRaw) : null,
    soldDay: isSold ? dayKey(soldRaw) : null,
    costMissing: !(n(u.purchase_price) > 0),
    cost: n(u.purchase_price) + (p.lines.find((x) => x.key === 'recon')?.val || 0),
    addonRevenue: n(addons.rev),
    addonItems: addons.items || [],
    teamCommission: n(l.commission_amount),
    brokerCommission: n(broker?.amount),
    brokerItems: broker?.items || [],
    p,
  };
}

// ── date windows (Malaysia time) ─────────────────────────────────────────────
const localParts = (ms) => {
  const d = new Date(ms + MY_OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: (d.getUTCDay() + 6) % 7 }; // dow: Monday = 0
};
const at = (y, m, d) => Date.UTC(y, m, d) - MY_OFFSET; // local midnight, as ms (Date.UTC rolls over months and years)

export const PERIOD_TEXT = {
  week:  { name: 'this week',  thenName: 'last week',  vs: 'vs same day last week' },
  month: { name: 'this month', thenName: 'last month', vs: 'vs this day last month' },
  year:  { name: 'this year',  thenName: 'last year',  vs: 'vs this time last year' },
};

/**
 * The window "so far" for a period, and the like-for-like windows to compare it with.
 * Windows are [from, to) in ms. The previous period is cut at the same DAY of the period (this
 * Wednesday against last Wednesday), so a half-finished month is never set against a whole one.
 */
export function periodWindow(kind, now = Date.now()) {
  const p = localParts(now);
  let start; let prevStart; let lyStart;
  if (kind === 'week') { start = at(p.y, p.m, p.d - p.dow); prevStart = start - 7 * DAY; lyStart = start - 364 * DAY; }
  else if (kind === 'year') { start = at(p.y, 0, 1); prevStart = at(p.y - 1, 0, 1); lyStart = prevStart; }
  else { start = at(p.y, p.m, 1); prevStart = at(p.y, p.m - 1, 1); lyStart = at(p.y - 1, p.m, 1); }
  const sameDays = (Math.floor((now - start) / DAY) + 1) * DAY;
  return {
    kind, start,
    cur: [start, now + 1],
    prev: [prevStart, Math.min(start, prevStart + sameDays)],
    prevFull: [prevStart, start],
    lastYear: [lyStart, lyStart + sameDays],
  };
}

// RM of the monthly overhead (Settings > Costs) counted to today, for each period.
function overheadFor(kind, now, cfg) {
  const monthly = n(cfg?.monthly_overhead);
  if (!monthly) return 0;
  const p = localParts(now);
  if (kind === 'week') return Math.round((monthly * 12 / 365) * (p.dow + 1));
  if (kind === 'year') {
    const doy = Math.floor((at(p.y, p.m, p.d) - at(p.y, 0, 1)) / DAY) + 1;
    const diy = (Date.UTC(p.y + 1, 0, 1) - Date.UTC(p.y, 0, 1)) / DAY;
    return Math.round((monthly * 12 * doy) / diy);
  }
  const dim = new Date(Date.UTC(p.y, p.m + 1, 0)).getUTCDate();
  return Math.round((monthly * p.d) / dim);
}

// Everything sold inside one window, summed from the same per-car rows.
function totalsIn(rows, w) {
  const sold = rows.filter((r) => r.isSold && r.soldAt != null && r.soldAt >= w[0] && r.soldAt < w[1]);
  const costed = sold.filter((r) => !r.costMissing);
  const line = (r, k) => r.p.lines.find((x) => x.key === k)?.val || 0;
  const t = {
    units: sold.length,
    soldIds: sold.map((r) => r.id),
    rowsSold: sold,
    // Add-on and F&I money on the cars sold in this window, all of them (revenue is never left out).
    addonRevenue: sold.reduce((s, r) => s + r.addonRevenue, 0),
    revenue: sold.reduce((s, r) => s + r.p.revenue, 0),
    gross: costed.reduce((s, r) => s + r.p.net, 0),
    carsGross: costed.reduce((s, r) => s + r.p.front, 0),
    addonsGross: costed.reduce((s, r) => s + r.p.back, 0),
    costedRevenue: costed.reduce((s, r) => s + r.p.revenue, 0),
    leftOut: sold.length - costed.length,
    // Commission on EVERY car sold (what is owed does not wait for a buy price): the team's plus the brokers'.
    commission: sold.reduce((s, r) => s + line(r, 'commission'), 0),
    teamCommission: sold.reduce((s, r) => s + r.teamCommission, 0),
    brokerCommission: sold.reduce((s, r) => s + r.brokerCommission, 0),
    brokerSold: sold.filter((r) => r.brokerCommission > 0 || r.brokerItems.length > 0).length,
    spend: COST_KEYS
      .map((k) => ({ key: k, val: costed.reduce((s, r) => s + line(r, k), 0) }))
      .filter((x) => x.val > 0),
  };
  t.margin = t.costedRevenue > 0 ? (t.gross / t.costedRevenue) * 100 : null;
  return t;
}

/**
 * @param cars    rows from mergeCars()
 * @param ctx     { ads: {unitId: RM}, handover: {listingId: RM}, addons: {listingId: {rev, cost, items}},
 *                  broker: {listingId: {amount, items}}, cfg }
 * @param now     ms
 */
/**
 * Per salesman, the cars they sold in [from, to): { [sellerId]: { units, gross, leftOut } }.
 * The SAME totals as Overview (totalsIn over carPnl rows), only grouped, so a salesman's profit
 * can never be a second formula. Cars with no seller are left out (they are nobody's sale).
 */
export function sellerTotals(rows = [], from, to) {
  const by = {};
  for (const r of rows) if (r.sellerId) (by[r.sellerId] || (by[r.sellerId] = [])).push(r);
  const out = {};
  for (const [id, list] of Object.entries(by)) {
    const t = totalsIn(list, [from, to]);
    if (t.units) out[id] = { units: t.units, gross: t.gross, leftOut: t.leftOut };
  }
  return out;
}

export function ownerMoney(cars = [], ctx = {}, now = Date.now()) {
  const rows = cars.map((c) => carRow(c, ctx, now));
  const thisMonth = monthKey(now);

  const mw = periodWindow('month', now);
  const month = totalsIn(rows, mw.cur);
  const prev = totalsIn(rows, mw.prevFull);
  // Last month up to the same day: the fair "vs last month" while this month is still running
  // (a whole last month against 12 days of this one reads as a crash every month).
  const prevToDate = totalsIn(rows, mw.prev);

  // Overhead from Settings > Costs, counted to today (it is a monthly bill, not per car).
  const overheadToDate = overheadFor('month', now, ctx.cfg);

  const p0 = localParts(now);
  const monthSeries = (count) => {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const from = at(p0.y, p0.m - i, 1);
      const to = at(p0.y, p0.m - i + 1, 1);
      const t = new Date(Date.UTC(p0.y, p0.m - i, 15));
      const m = i === 0 ? month : totalsIn(rows, [from, to]);
      out.push({ key: t.toISOString().slice(0, 7), label: t.toLocaleString('en-MY', { month: 'short', timeZone: 'UTC' }), revenue: m.revenue, gross: m.gross, units: m.units });
    }
    return out;
  };
  const weekSeries = (count) => {
    const ws = periodWindow('week', now).start;
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const from = ws - i * 7 * DAY;
      const w = totalsIn(rows, [from, i === 0 ? now + 1 : from + 7 * DAY]);
      out.push({ key: String(from), label: new Date(from + MY_OFFSET).toLocaleString('en-MY', { day: 'numeric', month: 'short', timeZone: 'UTC' }), revenue: w.revenue, gross: w.gross, units: w.units });
    }
    return out;
  };
  const months = monthSeries(6);

  const periods = {};
  for (const kind of ['week', 'month', 'year']) {
    const w = periodWindow(kind, now);
    const cur = kind === 'month' ? month : totalsIn(rows, w.cur);
    const before = kind === 'month' ? prevToDate : totalsIn(rows, w.prev);
    // Only a REAL last year is shown: a car sold in that window. Never a made-up zero baseline.
    const ly = kind === 'year' ? null : totalsIn(rows, w.lastYear);
    const overhead = kind === 'month' ? overheadToDate : overheadFor(kind, now, ctx.cfg);
    periods[kind] = {
      kind, window: w, cur, before,
      lastYear: ly && ly.units > 0 ? ly : null,
      overhead, net: cur.gross - overhead,
      series: kind === 'week' ? weekSeries(8) : kind === 'month' ? months : monthSeries(12),
    };
  }

  // Last 30 days, one row per Malaysia day (oldest first): sales revenue, for the Overview chart.
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(now - i * DAY);
    daily.push({ day: key, revenue: rows.filter((r) => r.soldDay === key).reduce((s, r) => s + r.p.revenue, 0) });
  }

  // Stock = money tied up right now.
  const stock = rows.filter((r) => !r.isSold && UNSOLD.includes(r.status));
  const costedStock = stock.filter((r) => !r.costMissing);
  const withDays = stock.filter((r) => r.p.days != null);
  const stuck = stock.map((r) => ({
    id: r.id, title: r.title, days: r.p.days, asking: r.p.revenue || null, cost: r.costMissing ? null : r.cost,
    net: r.costMissing ? null : r.p.net, perDay: r.p.perDay.total,
    flag: r.costMissing ? 'no_cost' : !(r.p.revenue > 0) ? 'no_price' : r.p.net < 0 ? 'losing' : (r.p.days || 0) > AGEING_DAYS ? 'ageing' : 'ok',
  })).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return {
    month, prev, prevToDate, months, daily, overheadToDate, periods, rows,
    netAfterOverhead: month.gross - overheadToDate,
    cfg: ctx.cfg || {},
    stock: {
      count: stock.length,
      atCost: costedStock.reduce((s, r) => s + r.cost, 0),
      asking: stock.reduce((s, r) => s + r.p.revenue, 0),
      perDay: Math.round(stock.reduce((s, r) => s + r.p.perDay.total, 0)),
      avgDays: withDays.length ? Math.round(withDays.reduce((s, r) => s + r.p.days, 0) / withDays.length) : null,
      over60: stock.filter((r) => (r.p.days || 0) > AGEING_DAYS).length,
      losing: costedStock.filter((r) => r.p.revenue > 0 && r.p.net < 0).length,
      noCost: stock.length - costedStock.length,
      rows: stock,
    },
    stuck,
  };
}
