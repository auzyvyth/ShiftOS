// Live presentation (LivePresenter.jsx) — the numbers and wording that are
// not plain loan maths. The loan maths itself stays in financing.js.
//
// Pure: no React, no Supabase (tests/liveMaths.test.mjs).

import { flatToEir, monthlyPayment, principalForPayment, MAX_TENURE_YEARS } from './financing.js';

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

// Budget mode, the reverse question ("gaji RM3,500, boleh ambil kereta apa?"):
// the same 35% rule run backwards. Rounded DOWN to the ringgit so the budget
// never reads more generous than the rule.
export function maxMonthlyFromPay(net) {
  const n = Number(net);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(Math.round(n * SALARY_SHARE * 100) / 100);
}

// Which of the seller's cars fit a monthly budget, with one deposit (RM) and
// one tenure for all of them. Same formula and rate as the table, so tapping a
// result opens a card that shows the same number.
//   fits:  within budget, dearest first (the most car for the money)
//   above: up to two just over it (within ABOVE_MARGIN), cheapest monthly
//          first ("add a bit more deposit and #5 is yours"). A car at three
//          times the budget is not "just above", it is noise.
// n is the presenter's #number (index + 1). Unpriced cars and cars the deposit
// already covers are left out: neither is a financing question.
export const ABOVE_MARGIN = 0.25;

// Banks lend on a used car only until it is about 15 years old at the end of
// the loan (BSN states it outright; other banks cut tenure by car age the same
// way). A 9-year row on a 2014 car is a monthly no bank will give, so the
// presenter only offers tenures that fit. New cars are not capped.
// Bank policy, not law: the note on screen says "usually".
export const MAX_CAR_AGE_AT_END = 15;
export function maxTenureYears(car, nowYear = new Date().getFullYear()) {
  const y = Number(car?.year);
  if (car?.condition === 'new' || !Number.isFinite(y) || y < 1950) return MAX_TENURE_YEARS;
  return Math.max(0, Math.min(MAX_TENURE_YEARS, MAX_CAR_AGE_AT_END - Math.max(0, nowYear - y)));
}

// The tenures to offer for a car: the standard ones that fit its age, or its
// own shorter limit when none of them do. [] = too old for a bank loan.
export function tenuresFor(standard, car, nowYear) {
  const max = maxTenureYears(car, nowYear);
  const ok = standard.filter((y) => y <= max);
  return ok.length ? ok : (max >= 1 ? [max] : []);
}

// Deposit needed to bring the instalment down to `cap` ("nak bayar RM1,000
// sebulan, deposit berapa?"). Rounded UP to RM100 so the monthly it gives is
// never above the target. 0 = no deposit needed.
export function depositToFit({ price, extra = 0, cap, eir, years }) {
  const total = (Number(price) || 0) + (Number(extra) || 0);
  const c = Number(cap);
  if (total <= 0 || !Number.isFinite(c) || c <= 0) return null;
  const need = total - principalForPayment(c, eir, years * 12);
  return need <= 0 ? 0 : Math.min(total, Math.ceil(need / 100) * 100);
}

// A typed rate that is probably a mistake. 'looksFlat': under 4% "EIR" is a
// brochure flat rate typed on the wrong switch, which understates every
// monthly ~9% in the buyer's favour (HP-EIR). 'aboveCap': over the Hire-
// Purchase Act cap (17% EIR up to 5 years, 16% over 5; TODO.md HP-EIR).
export const LOOKS_FLAT_BELOW = 4;
export const eirCap = (years) => (years <= 5 ? 17 : 16);
// The rate box stops at the legal ceiling (owner, 2026-10-22): nothing above
// 17% EIR can be a real HP loan, so a bigger number is a typo (65 for 6.5)
// that would put a scary monthly on stream. A flat rate is always lower than
// its EIR, so the same ceiling holds for a flat input. Partial input ("6.")
// passes through untouched so typing a decimal still works.
export const RATE_MAX = 17;
export const clampRateInput = (v) => (v !== '' && Number(v) > RATE_MAX ? String(RATE_MAX) : v);
export function rateWarning(rate, basis, years) {
  const r = Number(rate) || 0;
  if (r <= 0) return null;
  if (basis !== 'flat' && r < LOOKS_FLAT_BELOW) return 'looksFlat';
  if (eirForTenure(r, basis, years) > eirCap(years)) return 'aboveCap';
  return null;
}

// What the buyer actually pays for the car: asking price minus the rebate the
// seller typed for it on this live. A rebate is money off the price, nothing
// else: never a deposit, never shown as a crossed-out "was" price.
//   rebates: { [listingId]: number | string } — presenter state, never saved
// Keyed by the listing, so a new-car model card's rebate covers EVERY variant:
// brands run one promo per model, and the seller types it once (owner,
// 2026-10-22). Budget's variant rows carry the card's id, so they share it.
export function netPrice(car, rebates) {
  const price = Number(car?.selling_price) || 0;
  const rebate = Math.min(price, Math.max(0, Number(rebates?.[car?.id]) || 0));
  return { price, rebate, net: price - rebate };
}

// extraFor(car, price): anything financed on top of the price, i.e. the
// insurance the Cars screen adds, so a car opened from here shows the same
// monthly. Deposit is never charged against it.
// The name a viewer hears: year, brand, model AND variant. "2022 Lexus IS"
// is three different cars at three prices; the variant is the detail that
// tells them which one this is (owner, 2026-10-21).
export const carLabel = (c) => [c?.year, c?.brand, c?.model, c?.variant].filter(Boolean).join(' ');

// A new-car model card can arrive here once per variant (the presenter expands
// it, each copy carrying `_n`, the card's #N). One car keeps ONE row per list:
// the dearest variant that fits, and under "just above" only a car with no
// variant that fits, at its cheapest, so one model never fills both slots.
// yearsFor(car): the car's own tenure limit (tenuresFor); a car is priced at
// the budget's tenure or its limit, whichever is shorter, and the row says so.
// Rows under "just above" carry topUp: the extra deposit that makes them fit.
// A model card's row also carries `options`: every priced variant, cheapest
// first, each with `fits`, so the Budget row can show which variants this
// budget buys and let the seller switch between them (owner, 2026-10-22).
export function budgetMatches(listings, { maxMonthly, deposit = 0, years, rate, basis, rebates, extraFor, yearsFor }) {
  const cap = Number(maxMonthly);
  if (!Number.isFinite(cap) || cap <= 0) return { fits: [], above: [] };
  const down = Math.max(0, Number(deposit) || 0);
  const fits = [];
  const above = [];
  const byN = new Map();
  (listings || []).forEach((car, i) => {
    const { net: price } = netPrice(car, rebates);
    if (price <= 0 || down >= price) return;
    const extra = Math.max(0, Number(extraFor?.(car, price)) || 0);
    const limit = yearsFor ? yearsFor(car) : years;
    const y = Math.min(years, limit || 0);
    if (y < 1) return;
    const eir = eirForTenure(rate, basis, y);
    const monthly = monthlyPayment(price + extra - down, eir, y * 12);
    const row = { n: car._n ?? i + 1, car, price, monthly, years: y };
    if (car._variantId) {
      if (!byN.has(row.n)) byN.set(row.n, []);
      byN.get(row.n).push({ ...row, fits: monthly <= cap });
    }
    if (monthly <= cap) fits.push(row);
    else if (monthly <= cap * (1 + ABOVE_MARGIN)) {
      const need = depositToFit({ price, extra, cap, eir, years: y });
      above.push({ ...row, topUp: need == null ? null : Math.max(0, need - down) });
    }
  });
  fits.sort((a, b) => b.price - a.price);
  above.sort((a, b) => a.monthly - b.monthly);
  const once = (rows, skip = new Set()) => rows.filter((r) => !skip.has(r.n) && (skip.add(r.n), true));
  const fitOnce = once(fits);
  const withOptions = (r) => {
    const opts = byN.get(r.n);
    return opts && opts.length > 1 ? { ...r, options: [...opts].sort((a, b) => a.price - b.price) } : r;
  };
  return {
    fits: fitOnce.map(withOptions),
    above: once(above, new Set(fitOnce.map((r) => r.n))).slice(0, 2).map(withOptions),
  };
}

// Saved rebates (every car, liveCopy.js) last until the month ends, Malaysia
// time: promos run by the month, and a rebate that quietly outlived its promo
// would put a wrong price on stream.
export const myMonth = (d = new Date()) => new Date(new Date(d).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 7);
// The last day of a 'YYYY-MM' month, as a UTC date (format it with timeZone UTC).
export function monthEnd(month) {
  const [y, m] = String(month).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0));
}
export function rebatesForMonth(saved, month = myMonth()) {
  if (!saved || saved.month !== month || typeof saved.rebates !== 'object' || !saved.rebates) return {};
  const out = {};
  for (const [id, v] of Object.entries(saved.rebates)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[id] = String(n);
  }
  return out;
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
      topCar = { n: idx + 1, name: carLabel(c), taps };
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
