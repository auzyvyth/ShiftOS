// Loan check (IDEA-23): gaps before a bank sees the file.
// Run: npm run test:loancheck
import { assessReadiness, docsFor, unanswered } from '../src/utils/loanReadiness.js';
import { monthlyPayment } from '../src/utils/financing.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const keys = (r) => r.flags.map((f) => f.key);

const clean = { late: 'none', ccris: 'clean', history: 'yes', guarantor: 'no', earn: 'salary', job: 'gt12', confirmed: 'confirmed',
  pay: '6000', commit: '500', price: '89800', dep: 10, years: 7, eir: 4.8 };

// The instalment is the app's one formula, never a copy.
const r0 = assessReadiness(clean);
is('monthly = financing.js', r0.monthly.toFixed(2), monthlyPayment(89800 - 8980, 4.8, 84).toFixed(2));
is('clean buyer: ready', r0.outcome, 'ready');
is('clean buyer: nothing to fix', r0.fixCount, 0);
is('clean buyer: comfortable band', r0.band, 'comfortable');

// Ashraf's reasons come out as gaps.
const hafiz = { ...clean, late: 'some', ccris: 'notyet', job: '3to6', confirmed: 'probation', pay: '3800', commit: '900' };
const r1 = assessReadiness(hafiz);
is('example: three things to fix', keys(r1), ['lateSome', 'ccrisNotYet', 'probation', 'dsrTight']);
is('example: fix, not hold', r1.outcome, 'fix');
is('example: tight counts as info, not a fix', r1.fixCount, 3);

is('3+ months late: hold', assessReadiness({ ...clean, late: 'many' }).outcome, 'hold');
is('first loan, no guarantor: a gap', keys(assessReadiness({ ...clean, history: 'none' })), ['thinFile']);
is('first loan with guarantor: info only', assessReadiness({ ...clean, history: 'none', guarantor: 'yes' }).outcome, 'ready');
is('new job beats probation (one flag)', keys(assessReadiness({ ...clean, job: 'lt3', confirmed: 'probation' })), ['newJob']);
is('own business: probation never asked', keys(assessReadiness({ ...clean, earn: 'business', confirmed: 'probation' })), ['business']);

// Heavy commitments: the deposit that brings it to 60%, and cheaper own cars.
const heavy = { ...clean, pay: '3000', commit: '1200' };
const r2 = assessReadiness(heavy, { listings: [
  { id: 'a', year: 2021, brand: 'Proton', model: 'Saga', selling_price: 36800, status: 'available' },
  { id: 'b', year: 2022, brand: 'Perodua', model: 'Myvi', selling_price: 52800, status: 'available' },
  { id: 'c', year: 2022, brand: 'Proton', model: 'Persona', selling_price: 41800, status: 'sold' },
  { id: 'd', year: 2024, brand: 'Proton', model: 'X50', selling_price: 30000, is_model_card: true },
] });
is('heavy: band', r2.band, 'heavy');
is('heavy: flag carries the deposit', r2.flags[0].key, 'dsrHeavy');
const capped = monthlyPayment(89800 - r2.depositNeeded, 4.8, 84) + 1200;
is('heavy: that deposit lands at or under 60%', capped <= 3000 * 0.6 + 0.01, true);
is('heavy: own cars that fit, dearest first, no sold, no model card', r2.fitCars.map((c) => c.id), ['a']);
is('loans already over 60% with no car: hold', assessReadiness({ ...clean, pay: '3000', commit: '1900' }).outcome, 'hold');
is('no pay typed: no DSR, no guess', assessReadiness({ ...clean, pay: '' }).band, null);

// Documents follow the buyer.
is('salary docs', docsFor(clean), ['ic', 'payslips', 'epf', 'bank3']);
is('example docs', docsFor(hafiz), ['ic', 'payslips', 'epf', 'bank3', 'offerLetter', 'ccrisReport']);
is('gig docs', docsFor({ ...clean, earn: 'gig' }), ['ic', 'gigStatement', 'bank6']);
is('first loan + maybe guarantor', docsFor({ ...clean, history: 'none', guarantor: 'maybe' }), ['ic', 'payslips', 'epf', 'bank6', 'guarantor']);
is('clean record: guarantor not asked for', docsFor({ ...clean, guarantor: 'yes' }).includes('guarantor'), false);

is('unanswered: blank credit step', unanswered({}, 'credit'), ['late', 'ccris', 'history', 'guarantor']);
is('unanswered: probation skipped for business', unanswered({ earn: 'business', job: 'gt12' }, 'income'), []);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
