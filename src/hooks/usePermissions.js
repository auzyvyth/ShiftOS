import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { isFullAccessRole, resolvePermissions } from '../lib/permissions';

// usePermissions(profile) — resolves the current user's capability map for their
// role within their dealership and exposes a `can(key)` helper.
//
// - Owner/dealer/superadmin: can() is always true (full access, not configurable).
// - Other roles: merges the dealer's stored role_permissions row over the
//   per-role defaults from lib/permissions.js.
export function usePermissions(profile) {
  const role = profile?.role || null;
  // Staff (salesman/manager/admin/accountant/fi_officer) belong to a parent
  // dealer via profile.dealer_id; owners have no dealer_id and use their own id.
  // The role_permissions row is always keyed by the owner's profile id.
  const dealerId = profile?.dealer_id || profile?.id || null;
  const [permissions, setPermissions] = useState({});
  // Which role + dealer the stored map belongs to. `loading` stays true until it matches the
  // current profile: on a cold load the profile arrives after the first (null) pass, and a
  // dashboard that read "not loading, nothing allowed" in between bounced deep links to Overview.
  const [loadedFor, setLoadedFor] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${role}:${dealerId}`;
    if (!role || isFullAccessRole(role) || !dealerId) { setPermissions({}); setLoadedFor(key); return; }

    supabase
      .from('role_permissions')
      .select('permissions')
      .eq('dealer_id', dealerId)
      .eq('role', role)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // A failed read allows NOTHING beyond Overview. Falling back to the defaults re-opened
        // every tab and money figure the owner had switched off.
        setPermissions(error ? {} : resolvePermissions(role, data?.permissions));
        setLoadedFor(key);
      });

    return () => { cancelled = true; };
  }, [role, dealerId]);

  const can = (key) => {
    if (isFullAccessRole(role)) return true;
    return permissions[key] === true;
  };

  const loading = loadedFor !== `${role}:${dealerId}`;
  return { can, permissions, loading };
}
