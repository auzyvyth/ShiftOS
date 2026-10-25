// Loan check (IDEA-23, 2026-10-25): what to fix BEFORE any bank sees the file.
//
// A Proton SA told the owner the real pain: the buyer goes to 4-5 banks, every
// one declines, then the salesman chases more documents. The reasons (CTOS,
// CCRIS, no bank record, late payments, a new job) were knowable in the first
// two minutes. This turns those minutes into a list of gaps and their fixes.
//
// Never an approval and never a score: the bank decides. Every number is
// arithmetic on what the salesman typed, on the app's one loan formula
// (financing.js) and the Live presenter's DSR bands (liveMaths.js).
// Wording lives in src/components/loans/loanCheckCopy.js; this file returns keys.
// Run: npm run test:loancheck

import { monthlyPayment } from './financing.js';
import { DSR_TIGHT, SALARY_SHARE, dsrOf, tightCapFromPay, depositToFit, carLabel } from './liveMaths.js';

// Every answer, with the option keys the screen offers. Order = screen order.
// Credit record comes first: it is what gets most files declined (the SA's answer).
export const QUESTIONS = {
  credit: [
    { key: 'late', options: ['none', 'some', 'many', 'unsure'] },
    { key: 'ccris', options: ['clean', 'issue', 'notyet'] },
    { key: 'history', options: ['yes', 'none'] },
    { key: 'guarantor', options: ['yes', 'maybe', 'no'] },
  ],
  income: [
    { key: 'earn', options: ['salary', 'commission', 'business', 'gig'] },
    { key: 'job', options: ['lt3', '3to6', '6to12', 'gt12'] },
    { key: 'confirmed', options: ['confirmed', 'probation'], only: (a) => isSalaried(a) },
  ],
};

export const DEPOSIT_OPTIONS = [0, 10, 20, 30];
export const YEAR_OPTIONS = [5, 7, 9];

export const isSalaried = (a) => a?.earn === 'salary' || a?.earn === 'commission';

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// A question the buyer has not answered counts as "not known", which is itself
// a gap: the screen only lets the salesman move on, it never guesses.
export function unanswered(answers, step) {
  return QUESTIONS[step]
    .filter((q) => !q.only || q.only(answers))
    .filter((q) => !answers?.[q.key])
    .map((q) => q.key);
}

// The whole result. `answers` = the question keys above plus
// pay, commit, price, dep (%), years, eir. `listings` = the seller's own cars,
// for "your cars that fit this pay".
export function assessReadiness(answers = {}, { listings = [] } = {}) {
  const a = answers;
  const price = num(a.price);
  const net = num(a.pay);
  const commit = num(a.commit);
  const eir = num(a.eir);
  const years = Number(a.years) || 7;
  const depPct = Number(a.dep) || 0;
  const months = years * 12;

  const deposit = Math.round((price * depPct) / 100);
  const loan = Math.max(0, price - deposit);
  const monthly = monthlyPayment(loan, eir, months);
  const dsr = dsrOf(monthly, commit, net);
  const band = dsr == null ? null : dsr <= SALARY_SHARE ? 'comfortable' : dsr <= DSR_TIGHT ? 'tight' : 'heavy';
  const cap = tightCapFromPay(net, commit);
  const depositNeeded = band === 'heavy' && cap > 0 ? depositToFit({ price, cap, eir, years }) : null;

  // tone: red = do not apply yet, amber = fix first, info = know this, nothing to fix.
  const flags = [];
  const add = (key, tone, params = {}) => flags.push({ key, tone, params });
  if (a.late === 'many') add('lateMany', 'red');
  if (a.late === 'some') add('lateSome', 'amber');
  if (a.late === 'unsure') add('lateUnsure', 'amber');
  if (a.ccris === 'notyet') add('ccrisNotYet', 'amber');
  if (a.ccris === 'issue') add('ccrisIssue', 'amber');
  if (a.history === 'none') add(a.guarantor === 'yes' ? 'thinGuarantor' : 'thinFile', a.guarantor === 'yes' ? 'info' : 'amber');
  if (a.job === 'lt3') add('newJob', 'amber');
  else if (isSalaried(a) && a.confirmed === 'probation') add('probation', 'amber');
  if (a.earn === 'gig') add('gig', 'info');
  if (a.earn === 'business') add('business', 'info');
  if (band === 'heavy') {
    const pct = Math.round(dsr * 100);
    if (depositNeeded != null && depositNeeded < price) add('dsrHeavy', 'amber', { pct, deposit: depositNeeded });
    else add('dsrMaxed', 'red', { pct });
  } else if (band === 'tight') {
    add('dsrTight', 'info', { pct: Math.round(dsr * 100) });
  }

  const red = flags.filter((f) => f.tone === 'red').length;
  const amber = flags.filter((f) => f.tone === 'amber').length;
  const outcome = red ? 'hold' : amber ? 'fix' : 'ready';

  // Cheaper cars from the seller's own stock that keep the DSR at or under 60%,
  // same deposit %, years and rate. Only offered when this car is too heavy.
  const fitCars = band === 'heavy' && cap > 0
    ? (listings || [])
      .filter((c) => c && c.status !== 'sold' && c.status !== 'archived' && !c.is_model_card)
      .map((c) => {
        const p = Number(c.selling_price) || 0;
        const m = monthlyPayment(p - Math.round((p * depPct) / 100), eir, months);
        return { id: c.id, label: carLabel(c), price: p, monthly: m };
      })
      .filter((c) => c.price > 0 && c.price < price && c.monthly <= cap)
      .sort((x, y) => y.price - x.price)
      .slice(0, 4)
    : [];

  return { price, deposit, loan, monthly, years, eir, dsr, band, depositNeeded, flags, outcome, fixCount: amber + red, fitCars };
}

// What the buyer brings, built from the answers so the hard-case papers are
// asked for once, up front. Keys; labels in loanCheckCopy.js (docs.*).
export function docsFor(a = {}, result = assessReadiness(a)) {
  const docs = ['ic'];
  if (isSalaried(a)) docs.push('payslips', 'epf');
  if (a.earn === 'business') docs.push('ssm', 'formB');
  if (a.earn === 'gig') docs.push('gigStatement');
  const sixMonths = !isSalaried(a) || a.earn === 'commission' || a.history === 'none';
  docs.push(sixMonths ? 'bank6' : 'bank3');
  if (isSalaried(a) && (a.job === 'lt3' || a.confirmed === 'probation')) docs.push('offerLetter');
  const weak = a.history === 'none' || a.late === 'some' || a.late === 'many' || a.job === 'lt3' || result.band === 'heavy';
  if (a.guarantor && a.guarantor !== 'no' && weak) docs.push('guarantor');
  if (a.ccris !== 'clean') docs.push('ccrisReport');
  return docs;
}

