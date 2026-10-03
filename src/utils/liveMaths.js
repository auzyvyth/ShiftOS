// Live presentation (LivePresenter.jsx) — the numbers and wording that are
// not plain loan maths. The loan maths itself stays in financing.js.
//
// Pure: no React, no Supabase (tests/liveMaths.test.mjs).

import { flatToEir } from './financing.js';

// "Take-home pay needed" rule: the instalment as a share of net monthly pay.
// It is a rule of thumb shown WITH its rule, never an approval — the bank
// decides on its own debt-service test (owner's call, 2026-10-03).
export const SALARY_SHARE = 0.35;

// Net pay at which `monthly` is SALARY_SHARE of it, rounded UP to RM100 so the
// guide never sounds more precise (or more lenient) than it is.
export function salaryGuide(monthly) {
  const m = Number(monthly);
  if (!Number.isFinite(m) || m <= 0) return null;
  // Round to sen first: 700 / 0.35 is 2000.0000000000002 in floating point.
  const net = Math.round((m / SALARY_SHARE) * 100) / 100;
  return Math.ceil(net / 100) * 100;
}

// Salesmen read promo rates off brochures, and those are FLAT. A flat rate
// fed into the reducing-balance formula understates the instalment, so a flat
// number is converted per tenure (the same flat rate is a different EIR at 5
// and at 9 years).
export function eirForTenure(rate, basis, years) {
  const r = Math.max(0, Number(rate) || 0);
  return basis === 'flat' ? flatToEir(r, years * 12) : r;
}

export const fmtRate = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return String(v);
};

// The after-live summary, from the seller's own analytics rows in the live
// window. Counts only — the report can still be on screen during a stream, so
// it never names a buyer.
//   events: [{ event_type, session_id, car_id }]
//   listings: the presenter's array (#N = index + 1)
export function liveReport({ events, newLeads, listings, startedAt, endedAt }) {
  const rows = Array.isArray(events) ? events : [];
  const sessions = new Set();
  let carTaps = 0;
  let whatsappTaps = 0;
  const tapsByCar = new Map();
  for (const e of rows) {
    if (e.event_type === 'minipage_view') {
      if (e.session_id) sessions.add(e.session_id);
    } else if (e.event_type === 'minipage_card_click') {
      carTaps += 1;
      if (e.car_id) tapsByCar.set(e.car_id, (tapsByCar.get(e.car_id) || 0) + 1);
    } else if (e.event_type === 'whatsapp_click') {
      whatsappTaps += 1;
    }
  }
  let topCar = null;
  for (const [carId, taps] of tapsByCar) {
    const idx = (listings || []).findIndex((c) => c.id === carId);
    if (idx < 0) continue;
    if (!topCar || taps > topCar.taps) {
      const c = listings[idx];
      topCar = { n: idx + 1, name: [c.year, c.brand, c.model].filter(Boolean).join(' '), taps };
    }
  }
  const minutes = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000));
  return {
    minutes,
    visitors: sessions.size,
    carTaps,
    whatsappTaps,
    newLeads: Number.isFinite(newLeads) ? newLeads : null,
    topCar: topCar && topCar.taps >= 2 ? topCar : null,
  };
}
