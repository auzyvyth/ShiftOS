import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

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
        .select('id, role, dealer_id, dealership, site_name, full_name, avatar_url, slug, subdomain, whatsapp_number, brand_color, site_logo_url, subscription_status, state, city')
        .eq('id', session.user.id)
        .maybeSingle();
      setProfile(data || null);
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
  return profile.dealer_id || profile.id;
}
