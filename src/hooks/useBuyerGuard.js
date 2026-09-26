import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { routeForProfile, ROUTE_PROFILE_COLUMNS } from './useRoleRedirect';

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
        // dealer_id + plan so a standalone salesman who lands here is sent to
        // their own panel directly, not via /salesman and a second redirect.
        // account_status + deleted_at drive AccountPage's restore-my-account
        // gate (MOBILE-7) — without them here it can never fire.
        .from('profiles').select(`${ROUTE_PROFILE_COLUMNS}, full_name, avatar_url, phone, account_status, deleted_at`)
        .eq('id', data.session.user.id).maybeSingle();
      if (!active) return;
      const home = routeForProfile(prof);
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
