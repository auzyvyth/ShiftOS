// npm run test:poster
import assert from 'node:assert/strict';
import { loanPosterNumbers, defaultDeposit, posterChips, posterSubtitle, posterTitle } from '../src/utils/loanPoster.js';
import { monthlyPayment, flatToEir } from '../src/utils/financing.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('EIR rows match the one formula, 9/7/5 order', () => {
  const r = loanPosterNumbers({ price: 199000, deposit: 20000, rate: 6.5, basis: 'eir' });
  assert.equal(r.ok, true);
  assert.equal(r.loan, 179000);
  assert.deepEqual(r.rows.map((x) => x.years), [9, 7, 5]);
  assert.equal(r.rows[1].monthly, Math.round(monthlyPayment(179000, 6.5, 84)));
});

t('flat rate is converted per tenure, not fed in raw', () => {
  const r = loanPosterNumbers({ price: 100000, deposit: 10000, rate: 3, basis: 'flat' });
  // 3% flat over 9y: the old flat instalment is loan*(1+0.03*9)/108
  const flatInstalment = 90000 * (1 + 0.03 * 9) / 108;
  assert.ok(Math.abs(r.rows[0].monthly - flatInstalment) < 2, `${r.rows[0].monthly} vs ${flatInstalment}`);
  assert.equal(r.rows[2].monthly, Math.round(monthlyPayment(90000, flatToEir(3, 60), 60)));
  assert.ok(r.rows[0].monthly > Math.round(monthlyPayment(90000, 3, 108)), 'raw flat would understate');
});

t('missing or impossible numbers mean no poster', () => {
  assert.equal(loanPosterNumbers({ price: 0, deposit: 0, rate: 6 }).error, 'price');
  assert.equal(loanPosterNumbers({ price: 50000, deposit: 50000, rate: 6 }).error, 'deposit');
  assert.equal(loanPosterNumbers({ price: 50000, deposit: 5000, rate: 0 }).error, 'rate');
  assert.equal(loanPosterNumbers({ price: 50000, deposit: 5000, rate: 12, basis: 'flat' }).error, 'rate');
});

t('high value still prints, flagged', () => {
  const r = loanPosterNumbers({ price: 1088000, deposit: 108800, rate: 6.5 });
  assert.equal(r.ok, true);
  assert.equal(r.highValue, true);
});

t('typed strings with RM and commas parse', () => {
  const r = loanPosterNumbers({ price: 'RM 239,800', deposit: '23,980', rate: '6.5' });
  assert.equal(r.loan, 215820);
});

t('defaults and chips', () => {
  assert.equal(defaultDeposit(199000), 19900);
  assert.deepEqual(posterChips({ mileage: 30000, auction_grade: '4.5B' }), ['Mileage 30,000 km', 'Gred 4.5B']);
  assert.deepEqual(posterChips({}), []);
  assert.equal(posterSubtitle({ year: 2022, condition: 'recon' }), 'TAHUN 2022 · RECOND');
  assert.equal(posterTitle({ brand: 'Toyota', model: 'Alphard', variant: '2.5 SC' }), 'TOYOTA ALPHARD 2.5 SC');
});

console.log(`\n${n} passed`);
