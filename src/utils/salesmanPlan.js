/**
 * isPremiumSalesman(profile) MUST mirror the DB's is_salesman_premium()
 * (never drift) — same rule as getDealerIdFromProfile / get_my_dealer_id().
 *
 * Why this exists: every surface used to ask `profile.plan === 'salesman_full'`,
 * and `plan` is a column the salesman can write to their OWN profiles row. The
 * escalation trigger deliberately allows a salesman to move their plan between
 * 'salesman_lite' and 'salesman_full' (that is how the upgrade screen works), so
 * one line in the browser console handed a Lite user the whole paid tier. The
 * DB gate now requires a signal the user cannot write; the UI has to ask the
 * same question or the two disagree and a self-flipper lands on a Premium panel
 * where every feature is refused by RLS.
 *
 * Pinned against self-service edits by prevent_profile_privilege_escalation:
 *   dealer_id       - tenant moves are blocked outright
 *   plan_expires_at - reset to its old value on any user update
 *   payment_status  - reset to its old value / NULL on any user update
 */
export function isPremiumSalesman(profile) {
  if (!profile) return false;
  if (profile.role !== 'salesman') return false;
  if (profile.is_active === false) return false;
  if (profile.plan !== 'salesman_full') return false;

  // Granted by their dealer — no expiry, revoked when they are unlinked.
  if (profile.dealer_id) return true;
  // Self-paid and still inside the paid window.
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) > new Date()) return true;
  // Self-paid or comped, confirmed off-platform.
  return profile.payment_status === 'received';
}

/** A salesman who is not Premium is Lite — there is no third tier. */
export function isLiteSalesman(profile) {
  return profile?.role === 'salesman' && !isPremiumSalesman(profile);
}
