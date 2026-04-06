import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function useSubscription() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, role')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.role === 'superadmin') { setStatus('active'); setLoading(false); return; }
      if (data?.subscription_status === 'active') { setStatus('active'); setLoading(false); return; }
      if (data?.subscription_status === 'trial' && new Date(data.trial_ends_at) > new Date()) { setStatus('trial'); setLoading(false); return; }
      setStatus('expired');
      setLoading(false);
    }
    check();
  }, []);

  return { status, loading };
}
