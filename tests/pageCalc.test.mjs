// Premium page calculator. Run: npm run test:pagecalc
import { pageCalc, fitYears, calcYears, calcMessage } from '../src/utils/pageCalc.js';
import { pageBudget } from '../src/utils/pageBudget.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const saga = { id: 's', year: 2026, brand: 'Proton', model: 'Saga', condition: 'new', selling_price: 38990 };
const c = pageCalc(saga, { depositPct: 0.1, years: 9, nowYear: 2026 });
is('same monthly as the budget finder (Saga, 10% down, 9y, 4.8%)', Math.round(c.monthly), 401);
is('deposit is the % of price', c.deposit, 3899);
is('loan = price - deposit', c.loan, 35091);
is('new Proton rate', c.rate, 4.8);
is('total interest is positive', c.totalInterest > 0, true);

// Agrees with the finder row for the same car.
const row = pageBudget([saga], { amount: 900, depositPct: 0.1, nowYear: 2026 }).fits[0];
is('calculator and finder agree', Math.round(row.monthly), Math.round(c.monthly));

const old = { id: 'o', year: 2013, brand: 'Honda', model: 'City', condition: 'used', selling_price: 30000 };
is('older car gets a shorter limit', calcYears(old, 2026), [2]);
is('a picked year the car cannot have snaps to its longest', fitYears(old, 9, 2026), 2);
const ancient = { ...old, year: 2005 };
is('too old for a bank loan = no calculation', pageCalc(ancient, { nowYear: 2026 }), null);

is('no price = no calculation', pageCalc({ ...saga, selling_price: 0 }), null);
is('deposit is capped at 50%', pageCalc(saga, { depositPct: 0.9, years: 7, nowYear: 2026 }).deposit, Math.round(38990 * 0.5));
is('negative deposit is 0', pageCalc(saga, { depositPct: -1, years: 7, nowYear: 2026 }).deposit, 0);
is('model card says "from"', pageCalc({ ...saga, is_model_card: true }, { nowYear: 2026 }).from, true);

const msg = calcMessage({ firstName: 'Fedaus', car: saga, depositPct: 0.1, years: 7 });
is('message names the car', msg.includes('2026 Proton Saga'), true);
is('message promises nothing', /approv|guarantee|rate|RM\s?\d+\s*(a|per)\s*month/i.test(msg), false);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
