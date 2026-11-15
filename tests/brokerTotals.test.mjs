// Run: npm run test:brokertotals
// Guards BROKER-2 (src/utils/brokerTotals.js): Overview's broker numbers are the SUM of the per-broker rows.
import { brokerTotals } from '../src/utils/brokerTotals.js';

let pass = 0;
const fails = [];
const eq = (a, e, label) => { if (JSON.stringify(a) === JSON.stringify(e)) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };
const row = (o) => ({ status: 'active', cars_on_page: 0, buyers: 0, sold: 0, owed: 0, holding: 0, to_approve: 0, paid: 0, ...o });

const t = brokerTotals([
  row({ cars_on_page: 2, buyers: 3, sold: 1, owed: 800, holding: 1, to_approve: 1 }),
  row({ cars_on_page: 5 }),
  row({ status: 'paused', buyers: 1 }),
  row({ status: 'revoked', sold: 2, owed: 1200, paid: 600, buyers: 4 }),
  row({ status: 'requested', buyers: 9, owed: 999 }),
  row({ status: 'declined', buyers: 9, owed: 999 }),
]);
eq(t.connected, 2, 'two active brokers');
eq(t.paused, 1, 'one paused');
eq(t.carsOnPages, 7, 'cars on pages are summed');
eq(t.buyers, 8, 'buyers: working + revoked, never requested / declined');
eq(t.sold, 3, 'sold');
eq(t.owed, 2000, 'owed: a revoked broker is still owed');
eq(t.paid, 600, 'paid');
eq(t.holding, 1, 'holding');
eq(t.toApprove, 1, 'sales waiting for the dealer');
eq(t.complete, true, 'rows carry the new columns');
eq(t.any, true, 'has brokers');

eq(brokerTotals([]).any, false, 'no brokers');
eq(brokerTotals(undefined).owed, 0, 'undefined rows');
eq(brokerTotals([{ status: 'requested', buyers: 5 }]).any, false, 'a request alone is not a broker');

// Before migration 20261116a: the old rows have no holding / to_approve / paid.
const old = brokerTotals([{ status: 'active', cars_on_page: 2, buyers: 1, sold: 0, owed: 0 }]);
eq(old.complete, false, 'old rows are flagged incomplete');
eq(old.toApprove, 0, 'missing columns add as zero');
eq(old.carsOnPages, 2, 'old columns still count');

if (fails.length) { console.error(`FAIL ${fails.length}\n` + fails.join('\n')); process.exit(1); }
console.log(`brokerTotals: ${pass} passed`);
