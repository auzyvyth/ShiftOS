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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!role) { setLoading(false); return; }
    if (isFullAccessRole(role)) { setPermissions({}); setLoading(false); return; }
    if (!dealerId) { setLoading(false); return; }

    setLoading(true);
    supabase
      .from('role_permissions')
      .select('permissions')
      .eq('dealer_id', dealerId)
      .eq('role', role)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPermissions(resolvePermissions(role, data?.permissions));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [role, dealerId]);

  const can = (key) => {
    if (isFullAccessRole(role)) return true;
    return permissions[key] === true;
  };

  return { can, permissions, loading };
}
