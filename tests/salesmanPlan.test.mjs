// Guards isPremiumSalesman against drifting from the DB's is_salesman_premium().
// The two must answer identically for the same row — see src/utils/salesmanPlan.js.
import { isPremiumSalesman, isLiteSalesman } from '../src/utils/salesmanPlan.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (got === want) { pass++; console.log('ok  ', name); }
  else { fail++; console.log('FAIL', name, '- got', got, 'want', want); }
};

const future = new Date(Date.now() + 30 * 864e5).toISOString();
const past   = new Date(Date.now() - 30 * 864e5).toISOString();
const base   = { role: 'salesman', is_active: true, plan: 'salesman_full',
                 dealer_id: null, plan_expires_at: null, payment_status: null };

// The bug this file exists for: a Lite user flipping their own plan column.
is('self-flipped plan with no payment is NOT premium',
   isPremiumSalesman({ ...base, payment_status: 'pending' }), false);
is('self-flipped plan with nothing set is NOT premium',
   isPremiumSalesman(base), false);

is('dealer-granted (linked) is premium',
   isPremiumSalesman({ ...base, dealer_id: 'd1' }), true);
is('self-paid inside the window is premium',
   isPremiumSalesman({ ...base, plan_expires_at: future }), true);
is('self-paid past the window is NOT premium',
   isPremiumSalesman({ ...base, plan_expires_at: past }), false);
is('comped (payment_status received) is premium',
   isPremiumSalesman({ ...base, payment_status: 'received' }), true);

is('lite plan is never premium',
   isPremiumSalesman({ ...base, plan: 'salesman_lite', payment_status: 'received' }), false);
is('suspended account is never premium',
   isPremiumSalesman({ ...base, is_active: false, payment_status: 'received' }), false);
is('a dealer is not a premium salesman',
   isPremiumSalesman({ ...base, role: 'dealer', payment_status: 'received' }), false);
is('null profile is not premium', isPremiumSalesman(null), false);

is('a salesman who is not premium is lite',
   isLiteSalesman({ ...base, payment_status: 'pending' }), true);
is('a premium salesman is not lite',
   isLiteSalesman({ ...base, payment_status: 'received' }), false);
is('a dealer is neither', isLiteSalesman({ ...base, role: 'dealer' }), false);

console.log(`\nsalesmanPlan: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
