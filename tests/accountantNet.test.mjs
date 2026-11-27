// Run: npm run test:accountantnet. Guards the Accountant overview's profit, the commission rule and
// the recon rule (JS must equal the DB's stock_recon_effective = greatest(estimate, actual)).
import { rowGross, overviewTotals } from '../src/utils/accountantNet.js';
import { suggestCommission, describeCommissionRule, DEFAULT_COMMISSION } from '../src/utils/commission.js';
import { effectiveRecon } from '../src/utils/reconCost.js';

let pass = 0; const fails = [];
const eq = (a, e, label) => { if (a === e) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };

// --- GP is always AFTER commission; net = GP - expenses (commission is NOT taken off twice) ---
const sold = { sold: 60000, purchase: 50000, recon: 2000, services: 500, commission: 1000 };
eq(rowGross({ ...sold, unitGp: null }), 6500, 'fallback GP subtracts commission, like the DB trigger');
eq(rowGross({ ...sold, unitGp: 6500 }), 6500, 'stored GP (already after commission) is used as is');
eq(rowGross({ ...sold, unitGp: 0 }), 0, 'a stored GP of 0 is a real 0, not "missing"');
eq(rowGross({ sold: 60000, purchase: 50000 }), 10000, 'missing costs count as 0');
const t = overviewTotals([{ sold_price: 60000, gross_profit: 6500 }, { sold_price: 40000, gross_profit: -500 }], 1500);
eq(t.gross, 6000, 'gross adds up');
eq(t.net, 4500, 'net = GP - expenses, commission is already inside GP');
eq(Math.round(t.margin * 10), 60, 'margin on revenue');
eq(overviewTotals([], 300).net, -300, 'no sales: expenses alone are a loss');
eq(overviewTotals([], 0).margin, 0, 'no revenue, no divide by zero');
eq(overviewTotals([{ sold_price: 'x', gross_profit: null }], 'y').net, 0, 'junk values are 0, never NaN');

// --- Commission rule ---
eq(DEFAULT_COMMISSION.type, 'percent_gross', 'default = % of margin');
eq(suggestCommission(null, { sell: 60000, cost: 50000 }), 1000, 'default 10% of RM10,000 margin');
eq(suggestCommission({ type: 'percent_gross', value: 10 }, { sell: 60000, cost: 52500 }), 750, 'rounded to RM50');
eq(suggestCommission({ type: 'percent_gross', value: 10 }, { sell: 50000, cost: 52000 }), null, 'sold below cost: no commission suggested');
eq(suggestCommission({ type: 'percent_gross', value: 10 }, { sell: 60000 }), null, 'margin rule with no cost: leave the field alone');
eq(suggestCommission({ type: 'percent_sale', value: 1 }, { sell: 60000 }), 600, '1% of sale price');
eq(suggestCommission({ type: 'percent_sale', value: 1 }, {}), null, 'no price');
eq(suggestCommission({ type: 'flat', value: 500 }, {}), 500, 'flat is paid as typed');
eq(suggestCommission({ type: 'flat', value: 0 }, {}), null, 'zero rule suggests nothing');
eq(describeCommissionRule({ type: 'flat', value: 500 }), 'flat rate', 'words: flat');
eq(describeCommissionRule(null), '10% of margin', 'words: default');

// --- Recon: one rule, same as the DB function greatest(coalesce(est,0), coalesce(actual,0)) ---
eq(effectiveRecon(2500, [{ cost: 800 }]), 2500, 'a smaller job never lowers the estimate');
eq(effectiveRecon(2000, [{ cost: 1500 }, { cost: 1000 }]), 2500, 'jobs add up, bigger than the estimate wins');
eq(effectiveRecon(null, [{ cost: 900 }]), 900, 'no estimate: the jobs');
eq(effectiveRecon(1200, []), 1200, 'no jobs: the estimate');
eq(effectiveRecon(undefined, undefined), 0, 'nothing at all');
eq(effectiveRecon('1500', [{ cost: '200' }]), 1500, 'numbers typed as text');

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`accountantNet: ${pass} checks passed`);
