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

// Create a buyer profile row if the user has none. Never overwrites an existing
// profile, so a seller who happens to come through a buyer entry keeps their role.
// Returns the effective role ('buyer' when freshly created, else the existing role).
export async function ensureBuyerProfile(user) {
  if (!user?.id) return null;
  const { data: existing } = await supabase
    .from('profiles').select('id, role').eq('id', user.id).maybeSingle();
  if (existing) return existing.role || null;
  await supabase.from('profiles').insert({ id: user.id, email: user.email, role: 'buyer' });
  return 'buyer';
}
