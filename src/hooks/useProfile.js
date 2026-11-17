import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { setErrorContext } from '../utils/logError';

/**
 * Returns the logged-in user's profile row from the `profiles` table.
 * Usage: const { profile, loading } = useProfile();
 */
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id, role, dealer_id, dealership, site_name, full_name, avatar_url, slug, subdomain, whatsapp_number, brand_color, site_logo_url, subscription_status, state, city, plan, is_active, plan_expires_at, payment_status, seller_type, new_car_brand')
        .eq('id', session.user.id)
        .maybeSingle();
      setProfile(data || null);
      // Attribute any uncaught client errors to this user/role/dealer.
      if (data) setErrorContext({ userId: data.id, role: data.role, dealerId: getDealerIdFromProfile(data) });
      setLoading(false);
    })();
  }, []);

  return { profile, loading };
}

/**
 * Derives the correct dealer_id from a profile object.
 * MUST stay in lockstep with the DB function get_my_dealer_id() — any drift
 * means the frontend scopes queries to a different id than RLS expects, which
 * silently empties reads and rejects writes. The DB rule is:
 *   - dealer / superadmin / owner          → id        (they ARE the dealer)
 *   - salesman with NO dealer (Lite)        → id        (owns itself)
 *   - everyone else (linked salesman,
 *     manager, admin)                       → dealer_id (they belong to a dealer)
 */
export function getDealerIdFromProfile(profile) {
  if (!profile) return null;
  if (['dealer', 'superadmin', 'owner'].includes(profile.role)) return profile.id;
  // Linked salesman / manager / admin belong to a dealer; an unlinked salesman
  // (Salesman Lite) has dealer_id = null and owns itself.
  if (!profile.dealer_id) return profile.id;
  // A linked staff member who is switched off (or deleted) belongs to no dealer: the
  // same rule as get_my_dealer_id() (migration 20261117a). A profile loaded without
  // these columns reads as active, as before.
  if (isStaffSwitchedOff(profile)) return null;
  return profile.dealer_id;
}

// Linked staff (salesman / manager / admin / accountant / F&I under a dealer) that the
// owner switched off, the platform suspended (is_active false) or that was deleted.
// Dealers, owners and standalone sellers are never "staff".
export function isStaffSwitchedOff(profile) {
  if (!profile || !profile.dealer_id) return false;
  if (['dealer', 'superadmin', 'owner'].includes(profile.role)) return false;
  return profile.is_active === false || profile.account_status === 'deleted';
}
