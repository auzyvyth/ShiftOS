import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function useSubscription() {
  const [status, setStatus] = useState(null);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      let { data } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, role, dealer_id')
        .eq('id', user.id)
        .maybeSingle();
      // Staff linked to a dealer (manager, admin, accountant, F&I, linked salesman)
      // have no subscription of their own: they follow the dealership's. Without
      // this every one of them read "expired" and hit the pay wall.
      if (data?.dealer_id && data.role !== 'dealer' && data.role !== 'owner' && data.role !== 'superadmin') {
        const { data: parent } = await supabase
          .from('profiles')
          .select('subscription_status, trial_ends_at')
          .eq('id', data.dealer_id)
          .maybeSingle();
        // Cannot read the dealership: do not lock paying staff out on a failed read.
        data = parent ? { ...parent, role: data.role } : { ...data, subscription_status: 'active' };
      }
      setTrialEndsAt(data?.trial_ends_at || null);
      if (data?.role === 'superadmin') { setStatus('active'); setLoading(false); return; }
      if (data?.subscription_status === 'active') { setStatus('active'); setLoading(false); return; }
      if (data?.subscription_status === 'trial' && new Date(data.trial_ends_at) > new Date()) { setStatus('trial'); setLoading(false); return; }
      setStatus('expired');
      setLoading(false);
    }
    check();
  }, []);

  return { status, trialEndsAt, loading };
}
