import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function DealerSlugRedirect() {
  const { dealerSlug } = useParams();

  useEffect(() => {
    const redirect = async () => {
      // Look up dealer by subdomain
      const { data } = await supabase
        .from('public_dealer_profiles')
        .select('subdomain')
        .eq('subdomain', dealerSlug)
        .maybeSingle();

      const sub = data?.subdomain;
      // Validate subdomain is alphanumeric/hyphens only before using in URL
      if (sub && /^[a-z0-9-]{1,63}$/.test(sub)) {
        window.location.href = `https://${sub}.xdrive.my`;
      } else {
        window.location.href = 'https://xdrive.my';
      }
    };
    redirect();
  }, [dealerSlug]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Redirecting...</p>
    </div>
  );
}
