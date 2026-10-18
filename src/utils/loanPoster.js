// Loan poster (POSTER-1, 2026-10-16) — the numbers and words on the "Kiraan
// Loan" poster a seller sends to buyers. The loan maths itself stays in
// financing.js; this file only decides what goes on the poster.
//
// Pure: no React, no canvas, no Supabase (tests/loanPoster.test.mjs).
//
// Rules:
// - One rate, three tenures (9/7/5). A FLAT rate is converted per tenure with
//   eirForTenure, never fed straight into the reducing-balance formula.
// - A missing or impossible number means NO poster (error), never a guess.
// - No "full loan" line and no insurance folded into the loan: banks lend up
//   to ~90%, and a no-deposit figure on a poster is how prices get inflated on
//   paper. The seller types the deposit they actually mean.
// - Above HIGH_VALUE_THRESHOLD the table still prints, with the "bank decides
//   case by case" line (same call as the live presenter).

import { HIGH_VALUE_THRESHOLD, monthlyPayment } from './financing.js';
import { eirForTenure } from './liveMaths.js';

export const POSTER_TENURES = [9, 7, 5];
export const LITE_POSTERS_PER_MONTH = 10; // must match claim_loan_poster()

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Deposit default: 10% of the price, rounded to the nearest RM100.
export function defaultDeposit(price) {
  const p = num(price);
  return p > 0 ? Math.round((p * 0.1) / 100) * 100 : 0;
}

// { ok, error?, price, deposit, loan, rate, basis, highValue, rows[] }
// rows: [{ years, monthly }] in POSTER_TENURES order, monthly rounded to RM.
export function loanPosterNumbers({ price, deposit, rate, basis = 'eir' }) {
  const p = num(price);
  const d = num(deposit);
  const r = num(rate);
  const b = basis === 'flat' ? 'flat' : 'eir';
  const base = { price: p, deposit: d, loan: Math.max(0, p - d), rate: r, basis: b, rows: [] };
  if (p <= 0) return { ...base, ok: false, error: 'price' };
  if (d >= p) return { ...base, ok: false, error: 'deposit' };
  if (r <= 0 || r > (b === 'flat' ? 10 : 20)) return { ...base, ok: false, error: 'rate' };
  const loan = p - d;
  const rows = POSTER_TENURES.map((years) => ({
    years,
    monthly: Math.round(monthlyPayment(loan, eirForTenure(r, b, years), years * 12)),
  }));
  return { ...base, ok: true, loan, rows, highValue: p > HIGH_VALUE_THRESHOLD };
}

export const fmtRM = (n) => Math.round(Number(n) || 0).toLocaleString('en-MY');

export const fmtPct = (n) => {
  const v = Number(n) || 0;
  return `${v.toFixed(2)}%`;
};

// Every word printed on the poster, both languages. A new string goes in BOTH.
export const POSTER_COPY = {
  ms: {
    kicker: 'ANGGARAN ANSURAN',
    year: 'TAHUN',
    cond: { recon: 'RECOND', used: 'TERPAKAI', new: 'BARU' },
    mileage: 'Mileage',
    grade: 'Gred',
    interior: 'Interior',
    price: 'Harga kereta',
    deposit: 'Deposit',
    loan: 'Jumlah loan',
    rate: (basis) => `Kadar faedah (${basis === 'flat' ? 'flat' : 'EIR'})`,
    tenure: 'TAHUN',
    perMonth: '/bln',
    contact: 'HUBUNGI SAYA',
    advisor: 'Penasihat jualan',
    noPhoto: 'Tiada gambar',
    disclaimer: 'Anggaran sahaja. Kelulusan, kadar dan jumlah loan ditentukan oleh bank.',
    highValue: 'Kereta melebihi RM300k: bank menilai setiap kes. Anggaran sahaja.',
    preview: 'PRATONTON',
  },
  en: {
    kicker: 'INSTALMENT ESTIMATE',
    year: 'YEAR',
    cond: { recon: 'RECOND', used: 'USED', new: 'NEW' },
    mileage: 'Mileage',
    grade: 'Grade',
    interior: 'Interior',
    price: 'Car price',
    deposit: 'Deposit',
    loan: 'Loan amount',
    rate: (basis) => `Interest rate (${basis === 'flat' ? 'flat' : 'EIR'})`,
    tenure: 'YEARS',
    perMonth: '/mo',
    contact: 'CONTACT ME',
    advisor: 'Sales advisor',
    noPhoto: 'No photo',
    disclaimer: 'Estimate only. Approval, rate and loan amount are decided by the bank.',
    highValue: 'Cars above RM300k: banks decide case by case. Estimate only.',
    preview: 'PREVIEW',
  },
};

// The spec chips under the photo. Only facts the listing holds; empty ones drop.
export function posterChips(car, lang = 'ms') {
  const c = POSTER_COPY[lang] || POSTER_COPY.ms;
  const out = [];
  const km = num(car?.mileage);
  if (km > 0) out.push(`${c.mileage} ${fmtRM(km)} km`);
  if (car?.auction_grade) out.push(`${c.grade} ${String(car.auction_grade).trim()}`);
  if (car?.interior_grade) out.push(`${c.interior} ${String(car.interior_grade).trim()}`);
  return out;
}

export function posterTitle(car) {
  return [car?.brand, car?.model, car?.variant].filter(Boolean).join(' ').trim().toUpperCase() || 'CAR';
}

export function posterSubtitle(car, lang = 'ms') {
  const c = POSTER_COPY[lang] || POSTER_COPY.ms;
  const parts = [];
  if (car?.year) parts.push(`${c.year} ${car.year}`);
  const cond = String(car?.condition || '').toLowerCase();
  if (c.cond[cond]) parts.push(c.cond[cond]);
  return parts.join(' · ');
}

// What the sheet tells the seller when the poster cannot be made.
export const POSTER_ERRORS = {
  price: 'Enter the car price.',
  deposit: 'The deposit must be less than the price.',
  rate: 'Enter an interest rate (EIR up to 20%, flat up to 10%).',
};
