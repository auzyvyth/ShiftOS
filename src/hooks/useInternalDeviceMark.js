import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { isInternalDevice, markInternalDevice } from '../utils/internalTraffic';

/*
 * Mounted once in App.jsx. When a seller / staff / superadmin account is signed
 * in, flag this device as internal so its page views stop counting in
 * analytics (src/utils/internalTraffic.js). One role read per page load, and
 * only until the flag is set — after that it is a no-op.
 */
export function useInternalDeviceMark() {
  useEffect(() => {
    let cancelled = false;

    const check = async (user) => {
      if (cancelled || !user?.id || user.is_anonymous || isInternalDevice()) return;
      const { data } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!cancelled && data?.role && data.role !== 'buyer') markInternalDevice();
    };

    supabase.auth.getSession().then(({ data }) => check(data?.session?.user));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') check(session?.user);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);
}

export default useInternalDeviceMark;
