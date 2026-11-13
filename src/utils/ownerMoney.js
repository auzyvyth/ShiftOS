// The owner's money picture (owner, 2026-11-12: "money first, tell the owner everything about the
// money and revenue"). Every figure is a SUM of carPnl() over the dealer's cars, so Overview equals
// the cars underneath it (CLAUDE.md "Dealer numbers", ARCHITECTURE.md section 8). Pure: no React,
// no Supabase. `npm run test:ownermoney`.
//
// A car with no buy price is LEFT OUT of every profit total and counted instead (audit #2: 100 of
// 142 stock cars had none, and a 0 cost reads as a free car). Revenue still counts it.
// Not here on purpose: cash in the bank, bills, receivables. Nothing records them yet.
import { carPnl } from './carPnl.js';

const MY_OFFSET = 8 * 3600000; // Malaysia time, for month boundaries
export const monthKey = (d) => (d ? new Date(new Date(d).getTime() + MY_OFFSET).toISOString().slice(0, 7) : null);
export const dayKey = (d) => (d ? new Date(new Date(d).getTime() + MY_OFFSET).toISOString().slice(0, 10) : null);
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const UNSOLD = ['available', 'reserved', 'unpublished', 'pending_approval', 'in_stock'];

// One row per car: the listing and its stock record joined (a stock record with no listing still counts).
export function mergeCars(listings = [], units = []) {
  const byListing = new Map();
  for (const u of units) if (u.listing_id && !byListing.has(u.listing_id)) byListing.set(u.listing_id, u);
  const rows = listings.map((l) => ({ listing: l, unit: byListing.get(l.id) || null }));
  const seen = new Set(listings.map((l) => l.id));
  for (const u of units) if (!u.listing_id || !seen.has(u.listing_id)) rows.push({ listing: null, unit: u });
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
  const p = carPnl({
    purchase: u.purchase_price,
    reconEstimate: u.recon_cost,
    reconJobs: n(u.recon_actual) > 0 ? [{ cost: u.recon_actual }] : [],
    servicesCost: l.included_services_cost,
    commission: l.commission_amount,
    handoverCost: tasks == null ? null : tasks,
    adSpend: ctx.ads?.[u.id] || 0,
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
  return {
    id: listingId || u.id, title, status, isSold,
    soldMonth: isSold ? monthKey(l.sold_at || u.sold_date) : null,
    soldDay: isSold ? dayKey(l.sold_at || u.sold_date) : null,
    costMissing: !(n(u.purchase_price) > 0),
    cost: n(u.purchase_price) + (p.lines.find((x) => x.key === 'recon')?.val || 0),
    p,
  };
}

/**
 * @param cars    rows from mergeCars()
 * @param ctx     { ads: {unitId: RM}, handover: {listingId: RM}, addons: {listingId: {rev, cost}}, cfg }
 * @param now     ms
 */
export function ownerMoney(cars = [], ctx = {}, now = Date.now()) {
  const rows = cars.map((c) => carRow(c, ctx, now));
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(new Date(now + MY_OFFSET).toISOString().slice(0, 7) + '-01T00:00:00Z').getTime() - MY_OFFSET - 1);

  // uptoDay: count only sales up to this day of the month (same-days comparison).
  const monthTotals = (key, uptoDay = 31) => {
    const sold = rows.filter((r) => r.isSold && r.soldMonth === key && Number(r.soldDay?.slice(8, 10)) <= uptoDay);
    const costed = sold.filter((r) => !r.costMissing);
    return {
      units: sold.length,
      revenue: sold.reduce((s, r) => s + r.p.revenue, 0),
      gross: costed.reduce((s, r) => s + r.p.net, 0),
      carsGross: costed.reduce((s, r) => s + r.p.front, 0),
      addonsGross: costed.reduce((s, r) => s + r.p.back, 0),
      costedRevenue: costed.reduce((s, r) => s + r.p.revenue, 0),
      leftOut: sold.length - costed.length,
      spend: ['recon', 'holding', 'ads', 'commission', 'transfer', 'admin', 'warranty', 'services']
        .map((k) => ({ key: k, val: costed.reduce((s, r) => s + (r.p.lines.find((x) => x.key === k)?.val || 0), 0) }))
        .filter((x) => x.val > 0),
    };
  };
  const month = monthTotals(thisMonth);
  const prev = monthTotals(lastMonth);
  month.margin = month.costedRevenue > 0 ? (month.gross / month.costedRevenue) * 100 : null;

  // Overhead from Settings > Costs, counted to today (it is a monthly bill, not per car).
  const d = new Date(now + MY_OFFSET);
  const dayOfMonth = d.getUTCDate();
  // Last month up to the same day: the fair "vs last month" while this month is still running
  // (a whole last month against 12 days of this one reads as a crash every month).
  const prevToDate = monthTotals(lastMonth, dayOfMonth);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const overheadToDate = Math.round((n(ctx.cfg?.monthly_overhead) * dayOfMonth) / daysInMonth);

  // Last 6 months, oldest first, for the revenue vs gross chart.
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15));
    const key = t.toISOString().slice(0, 7);
    const m = i === 0 ? month : monthTotals(key);
    months.push({ key, label: t.toLocaleString('en-MY', { month: 'short', timeZone: 'UTC' }), revenue: m.revenue, gross: m.gross });
  }

  // Last 30 days, one row per Malaysia day (oldest first): sales revenue, for the Overview chart.
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(now - i * 86400000);
    daily.push({ day: key, revenue: rows.filter((r) => r.soldDay === key).reduce((s, r) => s + r.p.revenue, 0) });
  }

  // Stock = money tied up right now.
  const stock = rows.filter((r) => !r.isSold && UNSOLD.includes(r.status));
  const costedStock = stock.filter((r) => !r.costMissing);
  const withDays = stock.filter((r) => r.p.days != null);
  const stuck = stock.map((r) => ({
    id: r.id, title: r.title, days: r.p.days, cost: r.costMissing ? null : r.cost,
    net: r.costMissing ? null : r.p.net, perDay: r.p.perDay.total,
    flag: r.costMissing ? 'no_cost' : !(r.p.revenue > 0) ? 'no_price' : r.p.net < 0 ? 'losing' : (r.p.days || 0) > 60 ? 'ageing' : 'ok',
  })).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return {
    month, prev, prevToDate, months, daily, overheadToDate,
    netAfterOverhead: month.gross - overheadToDate,
    stock: {
      count: stock.length,
      atCost: costedStock.reduce((s, r) => s + r.cost, 0),
      asking: stock.reduce((s, r) => s + r.p.revenue, 0),
      perDay: Math.round(stock.reduce((s, r) => s + r.p.perDay.total, 0)),
      avgDays: withDays.length ? Math.round(withDays.reduce((s, r) => s + r.p.days, 0) / withDays.length) : null,
      over60: stock.filter((r) => (r.p.days || 0) > 60).length,
      losing: costedStock.filter((r) => r.p.revenue > 0 && r.p.net < 0).length,
      noCost: stock.length - costedStock.length,
    },
    stuck,
  };
}
