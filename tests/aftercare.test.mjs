// Run: npm run test:aftercare
//
// Guards the after-sale read (src/utils/aftercare.js) that the Sold tab, the
// aftercare plans component and the "This week" list share. The schedule test
// is the one that matters: if visit due dates drift, the seller calls a buyer
// for an oil change months early or late.
import { nextVisitDue, aftercareSummary, renewalSummary, buildComingUp } from '../src/utils/aftercare.js';

let pass = 0;
const fails = [];
const eq = (a, b, label) => (a === b ? pass++ : fails.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`));
const now = new Date('2026-10-12T00:00:00Z');
const iso = (d) => new Date(now.getTime() + d * 86400000).toISOString().slice(0, 10);

// Schedule: 2 visits over 12 months = one every 6 months, from the sale date.
const plan = { sold_at: '2026-01-10', total_visits: 2, used_visits: 0, valid_months: 12, expires_at: '2027-01-10' };
eq(nextVisitDue(plan), '2026-07-10', 'first visit at 6 months');
eq(nextVisitDue({ ...plan, used_visits: 1 }), '2027-01-10', 'second visit at 12 months');
eq(nextVisitDue({ ...plan, used_visits: 2 }), null, 'fully used has no next visit');
eq(nextVisitDue({ ...plan, total_visits: 1, valid_months: 24, expires_at: '2026-06-01' }), '2026-06-01', 'never past the plan end');

// Aftercare summary.
eq(aftercareSummary([]).key, 'none', 'no plans');
eq(aftercareSummary([{ ...plan, used_visits: 2 }], now).key, 'done', 'all used');
eq(aftercareSummary([plan], now).key, 'due', 'overdue visit is due');
eq(aftercareSummary([{ ...plan, sold_at: '2026-04-20', expires_at: '2027-04-20' }], now).key, 'soon', 'visit inside 14 days');
eq(aftercareSummary([{ ...plan, sold_at: '2026-10-01', expires_at: '2027-10-01' }], now).key, 'active', 'far visit');

// Renewals: soonest of the two wins; missing is its own state.
eq(renewalSummary({}, now).key, 'missing', 'no dates');
eq(renewalSummary({ insurance_expiry: iso(-3), road_tax_expiry: iso(200) }, now).key, 'overdue', 'overdue wins');
eq(renewalSummary({ insurance_expiry: iso(20) }, now).key, 'due', 'due in 20d');
eq(renewalSummary({ insurance_expiry: iso(20) }, now).missing, 1, 'one date missing');

// Coming up: one row per buyer, overdue renewal outranks an open handover.
const customers = [
  { id: 'c1', lead_id: 'l1', name: 'A', insurance_expiry: iso(-2) },
  { id: 'c2', lead_id: 'l2', name: 'B' },
  { id: 'c3', lead_id: 'l3', name: 'C', road_tax_expiry: iso(300) },
];
const statusForLead = (id) => (id === 'l3' ? { done: true } : { done: false, progress: 50, next: { label: 'JPJ' } });
const list = buildComingUp({
  customers, handoverDeals: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }], statusForLead,
  packagesByCustomer: { c2: [{ ...plan, sold_at: '2026-04-20', expires_at: '2027-04-20', package_name: 'Oil change' }] }, now,
});
eq(list.length, 2, 'finished handover with nothing due drops out');
eq(list[0].kind, 'renewal', 'overdue renewal first');
eq(list[0].also?.[0]?.kind, 'handover', 'handover rides along on the same buyer');
eq(list[1].kind, 'handover', 'open handover before a service visit');
eq(list[1].also?.[0]?.kind, 'service', 'service visit rides along');

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`aftercare: ${pass} passed`);
