import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getStorefrontUrl } from '../hooks/useTenant';
import NotFoundPage from './NotFoundPage';

export default function DealerSlugRedirect() {
  const { dealerSlug } = useParams();
  // 'checking' while we look the slug up; 'notfound' renders the 404 page so a
  // typo'd URL (e.g. /asdf) shows a real Page Not Found instead of silently
  // bouncing to the marketplace.
  const [state, setState] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    const redirect = async () => {
      let sub = null;
      try {
        // Look up dealer by subdomain
        const { data } = await supabase
          .from('public_dealer_profiles')
          .select('subdomain')
          .eq('subdomain', dealerSlug)
          .maybeSingle();
        sub = data?.subdomain || null;
      } catch (e) {
        sub = null;
      }
      if (cancelled) return;
      // Validate subdomain is alphanumeric/hyphens only before using in URL
      if (sub && /^[a-z0-9-]{1,63}$/.test(sub)) {
        window.location.href = getStorefrontUrl(sub);
      } else {
        setState('notfound');
      }
    };
    redirect();
    return () => { cancelled = true; };
  }, [dealerSlug]);

  if (state === 'notfound') return <NotFoundPage />;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  );
}
