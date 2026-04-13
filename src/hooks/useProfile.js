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
        .select('id, role, dealer_id, dealership, site_name')
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
 * - manager / admin  → profile.dealer_id  (they belong to a dealer)
 * - superadmin / dealer / owner → profile.id  (they ARE the dealer)
 */
export function getDealerIdFromProfile(profile) {
  if (!profile) return null;
  if (profile.role === 'manager' || profile.role === 'admin') {
    return profile.dealer_id;
  }
  return profile.id;
}
