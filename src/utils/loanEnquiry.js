// "Check my loan" on a dealer's own site (STOREFRONT-1, 2026-11-20).
// The buyer answers a few questions; the page lists what commonly gets a car loan
// declined and what to sort first, then sends the answers to the dealer as a lead.
//
// ONE set of rules for the sheet (LoanCheckSheet.jsx) and the server (api/enquiry.js),
// on the salesman's Loan check engine (loanReadiness.js), so the dealer reads the
// same verdict their own team would. Plain data: api/ runs it too.
//
// Legal lines (checked 2026-11-20): never "pre-approval", an approval or a chance
// (only the bank decides; CPA 1999 s.10). No IC, no payslip, no credit report: a
// dealer cannot pull CCRIS and does not need these to call back (PDPA: collect only
// what the purpose needs). The Consumer Credit Act 2025 licenses lenders and the
// Schedule 3 services (debt collection, repossession, counselling, crowdlending);
// passing a buyer's enquiry to the dealer is none of those.
import { assessReadiness, isSalaried } from './loanReadiness.js';
import { carLabel, maxTenureYears, maxMonthlyFromPay } from './liveMaths.js';
import { monthlyPayment } from './financing.js';
import { pageRate } from './pageBudget.js';

export const PAY_MIN = 500;
export const PAY_MAX = 200000;
export const LOAN_DEPOSITS = [0, 10, 20, 30];
export const LOAN_YEARS = [5, 7, 9];

// What the buyer is asked, in screen order. A shorter list than the salesman's:
// no guarantor (the dealer asks that on the call).
export const LOAN_QUESTIONS = [
  { key: 'earn', label: 'How do you earn?', options: { salary: 'Salary', commission: 'Commission', business: 'Own business', gig: 'Grab / delivery' } },
  { key: 'job', label: 'How long in this job or business?', options: { lt3: 'Under 3 months', '3to6': '3 to 6 months', '6to12': '6 to 12 months', gt12: 'Over a year' } },
  { key: 'confirmed', label: 'Confirmed, or still on probation?', options: { confirmed: 'Confirmed', probation: 'On probation' }, only: isSalaried },
  { key: 'late', label: 'Late on any loan, card or PTPTN in the last 12 months?', options: { none: 'No', some: 'Once or twice', many: '3+ months, or a legal letter', unsure: 'Not sure' } },
  { key: 'ccris', label: 'Have you looked at your own CCRIS and CTOS?', options: { clean: 'Yes, clean', issue: 'Yes, something there', notyet: 'Not yet' } },
  { key: 'history', label: 'Any loan or credit card before this one?', options: { yes: 'Yes', none: 'No, first loan' } },
];

const asked = (a) => LOAN_QUESTIONS.filter((q) => !q.only || q.only(a));
const money = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

// -> { ok, answers, errors }. `answers` is cleaned: only known keys and values.
export function checkLoanEnquiry(input = {}) {
  const errors = {};
  const out = {};
  for (const q of asked(input)) {
    const v = input?.[q.key];
    if (Object.prototype.hasOwnProperty.call(q.options, v)) out[q.key] = v;
    else errors[q.key] = 'Pick one';
  }
  const pay = money(input?.pay);
  if (!Number.isFinite(pay) || pay < PAY_MIN || pay > PAY_MAX) errors.pay = 'Your take-home pay each month';
  else out.pay = pay;
  const commitRaw = String(input?.commit ?? '').trim();
  const commit = commitRaw === '' ? 0 : money(commitRaw);
  if (!Number.isFinite(commit) || commit < 0 || commit > PAY_MAX) errors.commit = 'Check this amount';
  else out.commit = commit;
  out.dep = LOAN_DEPOSITS.includes(Number(input?.dep)) ? Number(input.dep) : 10;
  out.years = LOAN_YEARS.includes(Number(input?.years)) ? Number(input.years) : 7;
  return { ok: Object.keys(errors).length === 0, answers: out, errors };
}

// A dealer car as the loan check sees it. ONE helper for the sheet and the server,
// so both price it at the same rate (the page's default, pageBudget.js) and cap the
// term by the car's age the same way. null = no price, nothing to work out.
export function toLoanCar(row, nowYear) {
  const price = Number(row?.selling_price) || 0;
  if (!row || price <= 0 || row.is_model_card) return null;
  return { id: row.id, label: carLabel(row), price, eir: pageRate(row), maxYears: Math.max(1, maxTenureYears(row, nowYear)) };
}

const termFor = (answers, car) => Math.min(Number(answers?.years) || 7, car?.maxYears || 99);

// The buyer's result, in the buyer's own voice. `car` = toLoanCar(...) or null.
export function loanResult(answers, car) {
  const r = assessReadiness({ ...answers, price: car?.price || 0, eir: car?.eir || 0, years: termFor(answers, car) });
  // Without a car there is no instalment, so the pay flags are the only ones left out.
  const flags = car ? r.flags : r.flags.filter((f) => !f.key.startsWith('dsr'));
  const red = flags.some((f) => f.tone === 'red');
  const fix = flags.filter((f) => f.tone !== 'info').length;
  return { ...r, flags, outcome: red ? 'hold' : fix ? 'fix' : 'ready', fixCount: fix };
}

const rm = (n) => `RM ${Math.round(Number(n) || 0).toLocaleString('en-MY')}`;

export const OUTCOME_COPY = {
  ready: 'Nothing we can see blocking it',
  fix: (n) => `${n} thing${n === 1 ? '' : 's'} to sort before you apply`,
  hold: 'Best to wait before applying',
};
export const LOAN_DISCLAIMER = 'This is not an approval. It lists what commonly gets a car loan declined, so you can sort it first. The bank makes the decision.';

// Buyer-voice wording for each flag from assessReadiness. A new flag key there
// needs a line here, or the buyer sees nothing for it.
export const FLAG_COPY = {
  lateMany: { title: () => 'Late 3+ months, or a legal letter', fix: () => 'Most banks decline this today. Clear or restructure the arrears first, then apply once your record shows clean months.' },
  lateSome: { title: () => 'Late once or twice this year', fix: () => 'Bring every account up to date now. Recent months count most.' },
  lateUnsure: { title: () => 'Not sure about your payment record', fix: () => 'Check your CCRIS first (free at eccris.bnm.gov.my), so nothing surprises you at the bank.' },
  ccrisNotYet: { title: () => 'CCRIS and CTOS not checked', fix: () => 'CCRIS is free at eccris.bnm.gov.my (Bank Negara) and takes about 5 minutes.' },
  ccrisIssue: { title: () => 'Something on your CCRIS or CTOS', fix: () => 'A wrong CTOS entry can be disputed with CTOS. Real arrears are best paid first.' },
  thinFile: { title: () => 'First loan, no credit history', fix: () => 'The bank has nothing to read yet. A guarantor or a bigger deposit helps, and 6 months of bank statements show steady pay.' },
  thinGuarantor: { title: () => 'First loan', fix: () => 'A guarantor carries it. The dealer will tell you what they need.' },
  newJob: { title: () => 'Under 3 months in this job', fix: () => 'Often declined for too few payslips. Bring your offer letter, or wait until you have 3 payslips.' },
  probation: { title: () => 'Still on probation', fix: () => 'Bring your offer letter and a letter from HR. Some banks wait for confirmation.' },
  gig: { title: () => 'Grab / delivery income', fix: () => '6 months of bank statements showing the payouts, plus the earnings statement from the app.' },
  business: { title: () => 'Own business', fix: () => 'SSM, Form B with the LHDN receipt, and 6 months of bank statements.' },
  dsrHeavy: { title: (p) => `Loans would take ${p.pct}% of your pay`, fix: (p) => `A deposit of about ${rm(p.deposit)} brings it to a level most banks accept, or look at a cheaper car.` },
  dsrMaxed: { title: (p) => `Loans would take ${p.pct}% of your pay`, fix: () => 'Your other loans already use most of your pay. A guarantor, or clearing a loan first.' },
  dsrTight: { title: (p) => `${p.pct}% of your pay goes to loans`, fix: () => 'Inside most banks’ range, but tight. A bigger deposit or a longer term eases it.' },
};

// No car picked: the dealer's cars whose instalment fits the 35% comfort rule
// (the Live presenter's and the page budget finder's one rule), dearest first.
export function carsThatFit(rows, answers, max = 4, nowYear) {
  const cap = maxMonthlyFromPay(answers?.pay, answers?.commit);
  if (!cap) return [];
  return (rows || [])
    .map((row) => toLoanCar(row, nowYear))
    .filter(Boolean)
    .map((car) => {
      const dep = Math.round((car.price * (Number(answers.dep) || 0)) / 100);
      return { car, monthly: monthlyPayment(car.price - dep, car.eir, termFor(answers, car) * 12) };
    })
    .filter((x) => x.monthly > 0 && x.monthly <= cap)
    .sort((x, y) => y.car.price - x.car.price)
    .slice(0, max);
}

// The lead note the dealer reads (the enquiry_to_lead trigger copies it onto the
// lead). Built on the SERVER from the checked answers, never from text the browser
// sends, so a note is always the answers and nothing else.
export function loanEnquiryNote(answers, car) {
  const a = answers;
  const r = loanResult(a, car);
  const opt = (key) => LOAN_QUESTIONS.find((q) => q.key === key)?.options[a[key]];
  const lines = [
    car ? `Loan check: ${car.label} (${rm(car.price)}), ${a.dep}% down, ${termFor(a, car)} years` : `Loan check: no car picked yet, ${a.dep}% down, ${a.years} years`,
    `Take-home ${rm(a.pay)}, paying ${rm(a.commit)} a month on other loans`,
    `${opt('earn')}, ${String(opt('job')).toLowerCase()} in the job${a.confirmed ? `, ${String(opt('confirmed')).toLowerCase()}` : ''}`,
    `Late payments: ${opt('late')}. Checked CCRIS: ${opt('ccris')}. Loan before: ${opt('history')}`,
    `Shown: ${typeof OUTCOME_COPY[r.outcome] === 'function' ? OUTCOME_COPY[r.outcome](r.fixCount) : OUTCOME_COPY[r.outcome]}`,
  ];
  const titles = r.flags.map((f) => FLAG_COPY[f.key]?.title(f.params)).filter(Boolean);
  if (titles.length) lines.push(`To sort: ${titles.join('; ')}`);
  return lines.join('\n');
}

// What the buyer sends on WhatsApp. Their pay is NOT in it: the dealer has it in
// the lead, and a chat screenshot should not carry it.
export function loanEnquiryWhatsApp(car, siteName) {
  const hi = siteName ? `Hi ${siteName}` : 'Hi';
  return car
    ? `${hi}, I did the loan check on your site for the ${car.label}. Can you help me with the next step?`
    : `${hi}, I did the loan check on your site. Can you help me find a car that fits?`;
}
