// Guards the platform console's single account-state answer. Each case is a
// real row shape that the console once mislabelled.
// Run with: npm run test:accountstate
import { accessState, reviewState, billingState, headlineState, isPlatformAccount, matchesStatusFilter } from '../src/utils/accountState.js';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const D = 86400000;
let fail = 0;
const check = (name, got, want) => {
  if (got !== want) { console.log('FAIL', name, '-> got', JSON.stringify(got), 'want', JSON.stringify(want)); fail++; }
  else console.log('ok  ', name);
};

const premiumSignup = { role: 'salesman', dealer_id: null, plan: 'salesman_full', approval_status: 'pending', is_active: true,
  onboarding_complete: true, subscription_status: 'trial',
  premium_trial_started_at: new Date(NOW - 0.2 * D).toISOString(), plan_expires_at: new Date(NOW + 29.8 * D).toISOString() };
check('pending premium signup is IN, not locked out', accessState(premiumSignup, NOW).id, 'in');
check('pending premium signup waits on ID check', reviewState(premiumSignup).id, 'pending');
check('pending premium signup is on its free month', billingState(premiumSignup, NOW).id, 'free_month');
check('free month is not revenue', billingState(premiumSignup, NOW).paying, false);

const paidPremium = { ...premiumSignup, approval_status: 'approved', plan_expires_at: new Date(NOW + 58 * D).toISOString() };
check('a logged payment beyond the free month reads paid', billingState(paidPremium, NOW).id, 'paid');

const lapsed = { ...premiumSignup, plan_expires_at: new Date(NOW - 3 * D).toISOString() };
check('Premium past its date is lapsed', billingState(lapsed, NOW).id, 'lapsed');

const liteExpired = { role: 'salesman', dealer_id: null, plan: 'salesman_lite', subscription_status: 'expired', is_active: true, onboarding_complete: true, approval_status: 'approved' };
check('free Lite is never "Expired"', billingState(liteExpired, NOW).id, 'lite');

const ghostOff = { role: 'dealer', plan: 'dealer_pro', is_active: false, suspended_at: null, approval_status: 'approved', subscription_status: 'active', payment_status: null, onboarding_complete: true };
check('is_active=false with no suspension is "off", not Active', accessState(ghostOff, NOW).id, 'off');
check('headline shows the access problem first', headlineState(ghostOff, NOW).id, 'off');
check('dealer marked active with no payment is unconfirmed', billingState(ghostOff, NOW).id, 'unconfirmed');
check('unconfirmed is not revenue', billingState(ghostOff, NOW).paying, false);

const suspended = { ...ghostOff, suspended_at: new Date(NOW).toISOString() };
check('suspended needs suspended_at', accessState(suspended, NOW).id, 'suspended');

const platform = { role: 'dealer', plan: 'superadmin', is_active: true, onboarding_complete: true, subscription_status: 'active', payment_status: 'received' };
check('platform account is not a customer', isPlatformAccount(platform), true);
check('platform account is not revenue', billingState(platform, NOW).paying, false);

const unfinished = { role: 'dealer', plan: null, is_active: false, approval_status: 'pending', onboarding_complete: false };
check('unfinished signup is not in the review queue', reviewState(unfinished), null);
check('unfinished signup reads unfinished', accessState(unfinished, NOW).id, 'unfinished');

const linked = { role: 'salesman', dealer_id: 'x', approval_status: 'approved', is_active: true, onboarding_complete: true };
check('linked salesman has no review', reviewState(linked), null);
check('linked salesman billed via dealer', billingState(linked, NOW).id, 'via_dealer');

check('filter: review catches the pending premium signup', matchesStatusFilter(premiumSignup, 'review', NOW), true);
check('filter: off catches the ghost-off dealer', matchesStatusFilter(ghostOff, 'off', NOW), true);
check('filter: money catches unconfirmed', matchesStatusFilter(ghostOff, 'money', NOW), true);

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nall passed');
