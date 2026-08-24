import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Auth guard shared by every /account* page. Not logged in -> /buyer-login.
// A business role (seller/staff) -> their own panel, so no one ends up on two
// dashboards. Buyers stay put.
const SELLER_ROUTES = {
  superadmin: '/dashboard', dealer: '/dashboard', owner: '/dashboard',
  manager: '/manager', salesman: '/salesman', accountant: '/accountant',
  fi_officer: '/fi', admin: '/admin',
};

export function useBuyerGuard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) { navigate('/buyer-login', { replace: true }); return; }
      const { data: prof } = await supabase
        .from('profiles').select('role, full_name, avatar_url, phone')
        .eq('id', data.session.user.id).maybeSingle();
      if (!active) return;
      const sellerRoute = prof?.role && SELLER_ROUTES[prof.role];
      if (sellerRoute) { navigate(sellerRoute, { replace: true }); return; }
      setSession(data.session);
      setProfile(prof || null);
      setChecking(false);
    });
    return () => { active = false; };
  }, [navigate]);

  return { session, profile, setProfile, checking };
}

export default useBuyerGuard;
