import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function DealerSlugRedirect() {
  const { dealerSlug } = useParams();

  useEffect(() => {
    const redirect = async () => {
      // Look up dealer by subdomain
      const { data } = await supabase
        .from('profiles')
        .select('subdomain')
        .eq('subdomain', dealerSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (data?.subdomain) {
        // Redirect to subdomain
        window.location.href = `https://${data.subdomain}.xdrive.my`;
      } else {
        // Not found — go home
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
