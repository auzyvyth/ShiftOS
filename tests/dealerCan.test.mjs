// Run: npm run test:dealercan. The database's switch defaults (dealer_cap_default in the
// dealer_can migration) must equal CAPABILITIES in src/lib/permissions.js, or a role sees one
// thing on screen and gets another from the database.
import fs from 'fs';
import { CAPABILITIES, tabCapability, TAB_NEEDS_MONEY, resolvePermissions } from '../src/lib/permissions.js';

const fails = [];
let pass = 0;
const eq = (a, e, label) => { if (a === e) pass++; else fails.push(`${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`); };

const sql = fs.readFileSync(new URL('../supabase/migrations/20261114c_dealer_can.sql', import.meta.url), 'utf8');
const db = new Map([...sql.matchAll(/\('([a-z_]+)', '([a-z_]+)', (true|false)\)/g)].map((m) => [`${m[1]}:${m[2]}`, m[3] === 'true']));
const js = new Map();
for (const c of CAPABILITIES) for (const r of c.roles) js.set(`${r}:${c.key}`, c.default);
eq(db.size, js.size, 'same number of defaults');
for (const [k, v] of js) eq(db.get(k), v, `default ${k}`);

// Tabs: every gated dashboard tab names a switch that exists for managers.
const mgr = resolvePermissions('manager', null);
for (const [tab, sub] of [['crm'], ['hp'], ['listings'], ['stock'], ['handover'], ['storefront'], ['ai_manager'], ['team'], ['analytics', 'revenue'], ['analytics', 'performance'], ['analytics', 'listings']]) {
  const cap = tabCapability(tab, sub);
  eq(typeof mgr[cap], 'boolean', `manager switch for ${tab}${sub ? ' > ' + sub : ''}`);
}
eq(tabCapability('overview'), null, 'Overview is never switched off');
eq(TAB_NEEDS_MONEY.tab_stock, 'view_cost', 'Stock & costs needs view_cost');
eq(TAB_NEEDS_MONEY.tab_revenue, 'view_gross', 'Revenue needs view_gross');
eq(CAPABILITIES.find((c) => c.key === 'add_staff')?.roles.join(), 'manager', 'only a manager can be given "add staff"');
eq(CAPABILITIES.find((c) => c.key === 'add_staff')?.default, false, '"add staff" starts off');
eq(resolvePermissions('manager', { tab_stock: false }).tab_stock, false, 'a stored switch wins over the default');

if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log(`dealerCan: ${pass} checks passed`);
