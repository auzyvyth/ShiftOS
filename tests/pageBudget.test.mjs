// Premium page budget finder. Run: npm run test:pagebudget
import { pageBudget, budgetMessage, pageRate } from '../src/utils/pageBudget.js';
import { budgetMatches } from '../src/utils/liveMaths.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const proton = (model, price) => ({ id: model, year: 2026, brand: 'Proton', model, condition: 'new', selling_price: price });
const cars = [proton('Saga', 38990), proton('X50', 89800), proton('X70', 106800), proton('S70', 59800)];

const r = pageBudget(cars, { mode: 'monthly', amount: 900, depositPct: 0.1, nowYear: 2026 });
is('fits dearest first', r.fits.map((x) => x.car.model), ['S70', 'Saga']);
is('#N is the page position', r.fits.map((x) => x.n), [4, 1]);
is('just above with a top-up', r.above.map((x) => x.car.model), ['X50', 'X70']);
is('top-up is extra deposit, rounded to RM100', r.above[0].topUp % 100, 0);
is('Saga monthly at 4.8% over 9y, 10% down', Math.round(r.fits[1].monthly), 401);
is('new Proton rate', pageRate(cars[0]), 4.8);
is('used Proton is not on the local rate', pageRate({ ...cars[0], condition: 'used' }) === 4.8, false);

const pay = pageBudget(cars, { mode: 'pay', amount: 4000, depositPct: 0.1, nowYear: 2026 });
is('take-home pay uses the 35% rule', pay.maxMonthly, 1400);

is('no budget, nothing listed', pageBudget(cars, { amount: '' }).fits, []);
is('cars over RM300k count too', pageBudget([proton('Big', 400000)], { amount: 99999 }).fits.length, 1);

const old = { id: 'o', year: 2013, brand: 'Honda', model: 'City', condition: 'used', selling_price: 30000 };
const o = pageBudget([old], { amount: 2000, depositPct: 0, nowYear: 2026 });
is('a 13-year-old car gets its shorter tenure', o.fits[0]?.years, 2);

const fixed = budgetMatches(cars, { maxMonthly: 900, deposit: 5000, years: 9, rate: 4.8, basis: 'eir' });
is('Live presenter fixed deposit unchanged', fixed.fits.length > 0, true);

is('message carries the buyer\'s choices',
  budgetMessage({ firstName: 'Yazeed', car: cars[1], mode: 'monthly', amount: 900, depositPct: 0.1 }),
  'Hi Yazeed, I saw the 2026 Proton X50 (RM 89,800) on your page.\nMy budget is about RM 900 a month, with a 10% deposit.\nCan we work something out?');

console.log(`pageBudget: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
