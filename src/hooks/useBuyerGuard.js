import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { routeForRole } from './useRoleRedirect';

// Auth guard shared by every /account* page. Not logged in -> /login (the one
// sign-in door; it routes by role afterwards, so a buyer still lands back here).
// A business role (seller/staff) -> their own panel, so no one ends up on two
// dashboards. Buyers stay put.
//
// This used to keep its own SELLER_ROUTES map — a seventh hand-written copy,
// which had the same drift as the rest (superadmin -> /dashboard instead of
// /platform). It now asks the shared map, and "stays put" simply means the map
// already points this role at /account.

export function useBuyerGuard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) { navigate('/login', { replace: true }); return; }
      const { data: prof } = await supabase
        .from('profiles').select('role, full_name, avatar_url, phone')
        .eq('id', data.session.user.id).maybeSingle();
      if (!active) return;
      const home = routeForRole(prof?.role);
      if (home !== '/account') { navigate(home, { replace: true }); return; }
      setSession(data.session);
      setProfile(prof || null);
      setChecking(false);
    });
    return () => { active = false; };
  }, [navigate]);

  return { session, profile, setProfile, checking };
}

export default useBuyerGuard;
