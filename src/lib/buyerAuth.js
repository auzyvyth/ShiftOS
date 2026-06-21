import { supabase } from '../supabaseClient';

// Buyer vs seller is stored as profiles.role. A buyer gets a lightweight profiles
// row with role='buyer'; sellers have a business role (dealer/salesman/…). These
// helpers let the login + OAuth-callback flows tag and materialise buyer accounts
// so the post-auth router can tell an intentional buyer from a half-finished seller.

const INTENT_KEY = 'auth_intent';

export function markBuyerIntent() {
  try { sessionStorage.setItem(INTENT_KEY, 'buyer'); } catch { /* ignore */ }
}

// Read-and-clear. Returns true if the pending auth was started as a buyer.
export function consumeBuyerIntent() {
  try {
    const v = sessionStorage.getItem(INTENT_KEY);
    if (v) sessionStorage.removeItem(INTENT_KEY);
    return v === 'buyer';
  } catch { return false; }
}

// Ensure the signed-in user has a buyer profile. Used by every buyer entry
// (buyer login/signup + OAuth callback). Three cases:
//   1. No profile row     -> create one with role='buyer'.
//   2. A fresh dealer stub -> the handle_new_user trigger stamps role='dealer' by
//      default; if this account was never actually set up as a dealer (no
//      subdomain, onboarding not complete) and the user came through a buyer
//      entry, correct it to 'buyer' so a shopper can never reach a dealer panel.
//   3. A real, set-up account -> never touched (returns its existing role).
// RLS (users_upsert_own_profile_no_escalation) allows a user to set their own
// role to anything except 'superadmin', so this self-correction is permitted.
// Returns the effective role.
export async function ensureBuyerProfile(user) {
  if (!user?.id) return null;
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role, subdomain, onboarding_complete')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from('profiles').insert({ id: user.id, email: user.email, role: 'buyer', is_active: true });
    return 'buyer';
  }

  const isUnonboardedStub =
    existing.role !== 'buyer' &&
    !existing.subdomain &&
    existing.onboarding_complete !== true &&
    ['dealer', 'owner', 'salesman'].includes(existing.role || 'dealer');

  if (isUnonboardedStub) {
    await supabase.from('profiles').update({ role: 'buyer', is_active: true }).eq('id', user.id);
    return 'buyer';
  }

  return existing.role || null;
}
