// THE profit and loss of one car (owner, 2026-11-12: "everything needs to be counted right after
// the car is added, day by day"). Before this file the same maths lived in FIVE places
// (OwnerCarPanel, StockTab's P&L modal, the Stock row, Reports' RevenueBreakdown, AddCarForm's
// intake estimate) and they disagreed: some ignored recon jobs, none counted the runner / admin
// fees or the warranty reserve the dealer sets in Settings > Costs, and an unsold car showed no
// transfer cost at all, so its profit was overstated. Every screen calls carPnl() now.
// Pure, no imports from React or Supabase: `npm run test:carpnl`.
//
// The clock starts the day the car is added (purchase date if typed, else the day the stock
// record was made, else the listing) and stops on the sale date. Holding cost accrues daily:
//   floor-plan interest on the buy price  +  a share of the monthly overhead per car.
// (It used to be one OR the other; a financed car on a lot with rent pays both.)
// Before the sale the transfer costs are an ESTIMATE (JPJ + Puspakom B5 + runner + road tax by cc);
// once the handover checklist exists its real step costs replace the estimate.
import { effectiveRecon } from './reconCost.js';
import { estimateRoadTax } from './roadTax.js';

export const JPJ_TRANSFER_FEE = 100;   // official, = postSaleSteps jpj_transfer
export const PUSPAKOM_B5_FEE = 30;     // official, = postSaleSteps puspakom_b5
const DAY_MS = 86400000;
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// RM per day this car costs just by standing on the lot.
export function holdingPerDay(purchase, cfg = {}) {
  const rate = n(cfg.floor_plan_rate);
  const interest = rate > 0 && n(purchase) > 0 ? (n(purchase) * rate) / 100 / 365 : 0;
  const overhead = n(cfg.monthly_overhead) > 0 ? n(cfg.monthly_overhead) / Math.max(1, n(cfg.avg_fleet_size) || 20) / 30 : 0;
  return { interest, overhead, total: interest + overhead };
}

// Whole days between the start and the sale (or `now`). null when the start is unknown.
export function daysHeld(start, end, now = Date.now()) {
  if (!start) return null;
  const s = new Date(start).getTime();
  if (!Number.isFinite(s)) return null;
  const e = end ? new Date(end).getTime() : now;
  return Math.max(0, Math.floor(((Number.isFinite(e) ? e : now) - s) / DAY_MS));
}

/**
 * @param {object} i
 *  purchase, reconEstimate, reconJobs[{cost}], servicesCost, commission,
 *  handoverCost  number = the real handover step costs (deal won); null/undefined = not sold yet, estimate it
 *  adSpend, addonRevenue, addonCost, asking, soldPrice, isSold,
 *  startDate, soldDate, engineCc, warrantyMonths, cfg (dealer_cost_settings row)
 * @param {number} now  ms, for tests
 */
export function carPnl(i = {}, now = Date.now()) {
  const cfg = i.cfg || {};
  const purchase = n(i.purchase);
  const recon = effectiveRecon(i.reconEstimate, i.reconJobs || []);
  const isSold = !!i.isSold;
  const revenue = isSold ? (n(i.soldPrice) || n(i.asking)) : n(i.asking);

  const days = daysHeld(i.startDate, isSold ? i.soldDate : null, now);
  const perDay = holdingPerDay(purchase, cfg);
  const holding = Math.round(perDay.total * (days || 0));

  const hasHandover = i.handoverCost !== null && i.handoverCost !== undefined;
  const roadTax = estimateRoadTax(i.engineCc) || 0;
  const transferEst = JPJ_TRANSFER_FEE + PUSPAKOM_B5_FEE + n(cfg.runner_fee) + roadTax;
  const transfer = hasHandover ? n(i.handoverCost) : transferEst;
  const warrantyPct = n(i.warrantyMonths) > 0 ? n(cfg.warranty_reserve_pct) : 0;
  const warranty = Math.round((revenue * warrantyPct) / 100);

  const lines = [
    { key: 'purchase', label: 'Buy price', val: purchase, kind: 'actual' },
    { key: 'recon', label: 'Recon', val: recon, kind: 'actual' },
    { key: 'holding', label: days == null ? 'Holding' : `Holding, ${days} day${days === 1 ? '' : 's'}`, val: holding, kind: 'accruing' },
    { key: 'ads', label: 'Advertising', val: n(i.adSpend), kind: 'actual' },
    { key: 'services', label: 'Included services', val: n(i.servicesCost), kind: 'actual' },
    { key: 'commission', label: 'Commission', val: n(i.commission), kind: 'actual' },
    { key: 'transfer', label: hasHandover ? 'Transfer and handover' : 'Transfer, JPJ, B5, road tax', val: transfer, kind: hasHandover ? 'actual' : 'estimate' },
    { key: 'admin', label: 'Admin and documents', val: n(cfg.admin_fee), kind: 'actual' },
    { key: 'warranty', label: 'Warranty reserve', val: warranty, kind: 'estimate' },
  ];
  const costTotal = lines.reduce((s, l) => s + l.val, 0);
  const front = revenue - costTotal;
  const back = n(i.addonRevenue) - n(i.addonCost);
  const net = front + back;
  const margin = revenue > 0 ? (net / revenue) * 100 : null;

  // Unsold only: the price at which the car makes zero TODAY, and how many more days on the
  // lot until today's profit is eaten by holding cost.
  const fixed = costTotal - warranty;
  const breakeven = isSold ? null : Math.round((fixed - back) / (1 - warrantyPct / 100));
  const daysUntilZero = !isSold && net > 0 && perDay.total > 0 ? Math.floor(net / perDay.total) : null;
  const projections = isSold ? [] : [30, 60, 90].map((d) => ({ days: d, net: Math.round(net - perDay.total * d) }));

  return {
    revenue, lines, costTotal, front, back, net, margin, isSold,
    days, perDay, holding, transfer, transferIsEstimate: !hasHandover,
    breakeven, daysUntilZero, projections, startKnown: days != null,
  };
}
