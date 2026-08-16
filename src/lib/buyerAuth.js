import { supabase } from '../supabaseClient';

// Buyer vs seller is stored as profiles.role. A buyer gets a lightweight profiles
// row with role='buyer'; sellers have a business role (dealer/salesman/…). These
// helpers let the login + OAuth-callback flows tag and materialise buyer accounts
// so the post-auth router can tell an intentional buyer from a half-finished seller.

const INTENT_KEY = 'auth_intent';
const CONSENT_KEY = 'auth_pdpa_consent';

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

// PDPA consent has to survive the OAuth/magic-link round trip: the user ticks the
// box on our page, then leaves for Google and comes back to /auth/callback, where
// the profile row is actually created. Same read-and-clear shape as the intent flag.
// Only ever set this from a surface that genuinely showed the consent text.
export function markBuyerConsent() {
  try { sessionStorage.setItem(CONSENT_KEY, '1'); } catch { /* ignore */ }
}

export function consumeBuyerConsent() {
  try {
    const v = sessionStorage.getItem(CONSENT_KEY);
    if (v) sessionStorage.removeItem(CONSENT_KEY);
    return v === '1';
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

// Pull the display name + avatar Google (or any OAuth provider) hands back on
// the auth user's metadata, so a buyer's profile carries their real name instead
// of just an email. Returns only the keys that actually have a value.
function identityFromMeta(user) {
  const m = user?.user_metadata || {};
  const out = {};
  const name = (m.full_name || m.name || '').toString().trim();
  const avatar = (m.avatar_url || m.picture || '').toString().trim();
  if (name) out.full_name = name.slice(0, 100);
  if (avatar) out.avatar_url = avatar;
  return out;
}

// PDPA 2010 requires the consent to be recorded, not just collected. The buyer auth
// page has always required a consent tick before signup, but nothing wrote it to the
// profile, so every buyer account read as "no consent given" and there was no evidence
// we could show. Pass { consent: true } ONLY from a path where the user actually
// agreed — never default it on, or the column becomes a fabricated compliance record.
function consentPatch(consent) {
  return consent ? { pdpa_consent: true, pdpa_consent_at: new Date().toISOString() } : {};
}

export async function ensureBuyerProfile(user, { consent = false } = {}) {
  if (!user?.id) return null;
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role, subdomain, onboarding_complete, full_name, avatar_url, pdpa_consent')
    .eq('id', user.id)
    .maybeSingle();

  const identity = identityFromMeta(user);

  if (!existing) {
    await supabase.from('profiles').insert({
      id: user.id, email: user.email, role: 'buyer', is_active: true,
      ...identity, ...consentPatch(consent),
    });
    return 'buyer';
  }

  const isUnonboardedStub =
    existing.role !== 'buyer' &&
    !existing.subdomain &&
    existing.onboarding_complete !== true &&
    ['dealer', 'owner', 'salesman'].includes(existing.role || 'dealer');

  if (isUnonboardedStub) {
    // Correct the trigger's default stub to a buyer, and seed name/avatar while
    // we're here — but never clobber a value the row already carries.
    const patch = { role: 'buyer', is_active: true, ...consentPatch(consent) };
    if (identity.full_name && !existing.full_name) patch.full_name = identity.full_name;
    if (identity.avatar_url && !existing.avatar_url) patch.avatar_url = identity.avatar_url;
    await supabase.from('profiles').update(patch).eq('id', user.id);
    return 'buyer';
  }

  // Real buyer row already exists: backfill name/avatar for buyers who signed in
  // before we captured it, filling only the columns that are still empty.
  if (existing.role === 'buyer') {
    const patch = {};
    if (identity.full_name && !existing.full_name) patch.full_name = identity.full_name;
    if (identity.avatar_url && !existing.avatar_url) patch.avatar_url = identity.avatar_url;
    // Record consent for a buyer who signed up before we captured it, the first time
    // they come back through a surface that asks. Never overwrite an existing yes.
    if (consent && !existing.pdpa_consent) Object.assign(patch, consentPatch(true));
    if (Object.keys(patch).length) await supabase.from('profiles').update(patch).eq('id', user.id);
  }

  return existing.role || null;
}
