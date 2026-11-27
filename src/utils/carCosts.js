// What a car cost after buying it (COSTS-1, 2026-11-27), in ONE place: `npm run test:carcosts`.
// Rows come from the car_costs table plus the two older tables it replaces (recon_jobs, ad_spend),
// which production still writes until the next release. Every screen that works out a car's profit
// (car panel, Stock tab, Overview / Revenue, reports) reads costs through these rules, so they agree.
// Pure: no React, no Supabase.

export const COST_KINDS = [
  { key: 'recon', label: 'Repair / parts' },
  { key: 'transport', label: 'Transport' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'detailing', label: 'Detailing' },
  { key: 'ads', label: 'Advertising' },
  { key: 'other', label: 'Other' },
];
// Which profit line each kind feeds. RECON_KINDS is mirrored in SQL (compute_stock_unit_gp,
// migration 20261127b): change both or the Accountant's GP and the car panel disagree.
export const RECON_KINDS = ['recon', 'detailing'];
export const AD_KINDS = ['ads'];
export const bucketOf = (kind) => (RECON_KINDS.includes(kind) ? 'recon' : AD_KINDS.includes(kind) ? 'ads' : 'other');

export const COST_STATES = [
  { key: 'estimate', label: 'Estimate', hint: 'Not done yet' },
  { key: 'owed', label: 'Owed', hint: 'Bill received' },
  { key: 'paid', label: 'Paid', hint: 'Money out' },
];

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// One shape for every row, whatever table it came from. `source` says where to delete it.
export function fromLedger(r) {
  return { id: r.id, source: 'car_costs', unitId: r.stock_unit_id, kind: r.kind, label: r.label, payee: r.payee || '',
    amount: n(r.amount), state: r.state, date: r.cost_date || r.created_at, due: r.due_date || null, paidAt: r.paid_at || null };
}
export function fromReconJob(j) {
  return { id: j.id, source: 'recon_jobs', unitId: j.stock_unit_id, kind: 'recon', label: j.title || 'Repair', payee: j.vendor || '',
    amount: n(j.cost), state: j.status === 'done' ? 'paid' : 'estimate', date: j.completed_at || j.created_at, due: null, paidAt: j.completed_at || null };
}
export function fromAdSpend(a) {
  const ch = String(a.channel || '').trim();
  return { id: a.id, source: 'ad_spend', unitId: a.stock_unit_id, kind: 'ads', label: ch ? `Ads, ${ch[0].toUpperCase()}${ch.slice(1)}` : 'Ads', payee: '',
    amount: n(a.amount), state: 'paid', date: a.spent_at || a.created_at, due: null, paidAt: a.spent_at || null };
}

// Rows of one car -> what carPnl() needs. Every state counts: an estimate is a cost the car will
// carry, an owed bill is a cost already incurred. A repair row is a "job" for the recon rule
// (the larger of the intake estimate and the logged repairs, utils/reconCost.js).
export function pnlInputs(rows = []) {
  const reconJobs = []; let adSpend = 0; let otherCosts = 0;
  for (const r of rows) {
    const b = bucketOf(r.kind);
    if (b === 'recon') reconJobs.push({ cost: n(r.amount) });
    else if (b === 'ads') adSpend += n(r.amount);
    else otherCosts += n(r.amount);
  }
  return { reconJobs, adSpend, otherCosts };
}

// Many cars at once (Overview, Stock tab): unitId -> { ads, other }. Repairs reach those screens
// through stock_units.recon_actual, which the DB trigger keeps from both repair sources.
export function totalsByUnit(rows = []) {
  const out = {};
  for (const r of rows) {
    if (!r.unitId) continue;
    const t = out[r.unitId] || (out[r.unitId] = { ads: 0, other: 0 });
    const b = bucketOf(r.kind);
    if (b === 'ads') t.ads += n(r.amount); else if (b === 'other') t.other += n(r.amount);
  }
  return out;
}

export function stateTotals(rows = []) {
  const t = { paid: 0, owed: 0, estimate: 0 };
  for (const r of rows) if (t[r.state] != null) t[r.state] += n(r.amount);
  return t;
}

// The form's check, before anything is sent. Returns { ok, errors, row }.
export function checkCost(f = {}) {
  const errors = {};
  const label = String(f.label || '').trim().replace(/\s+/g, ' ');
  const amount = Number(String(f.amount ?? '').replace(/[^0-9.]/g, ''));
  if (!COST_KINDS.some((k) => k.key === f.kind)) errors.kind = 'Pick what it was for';
  if (!label) errors.label = 'Say what it was';
  if (!(amount > 0)) errors.amount = 'Enter the amount';
  else if (amount >= 10000000) errors.amount = 'That amount is too big';
  if (!COST_STATES.some((s) => s.key === f.state)) errors.state = 'Pick estimate, owed or paid';
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, row: ok ? { kind: f.kind, label: label.slice(0, 80), payee: String(f.payee || '').trim().slice(0, 80) || null,
    amount: Math.round(amount * 100) / 100, state: f.state, due_date: f.state === 'owed' && f.due ? f.due : null } : null };
}

// Owed bills across cars, for "Bills to pay": overdue first (most overdue on top), then by due
// date, bills with no due date last. Days are counted on the Malaysia calendar.
export function billsToPay(rows = [], now = Date.now()) {
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  const dayN = (d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000);
  return rows
    .filter((r) => r.state === 'owed' && r.source === 'car_costs')
    .map((r) => ({ ...r, overdueDays: r.due ? Math.max(0, dayN(today) - dayN(String(r.due).slice(0, 10))) : 0 }))
    .sort((a, b) => (b.overdueDays - a.overdueDays) || ((a.due ? dayN(a.due) : Infinity) - (b.due ? dayN(b.due) : Infinity)));
}
