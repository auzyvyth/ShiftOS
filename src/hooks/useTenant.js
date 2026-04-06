import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const MARKETPLACE_DOMAIN = 'xdrive.my';
export const DASHBOARD_DOMAIN = 'shiftos.com';

export function getSubdomain() {
  const hostname = window.location.hostname;
  // localhost testing: ?tenant=demo in URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('tenant')) return params.get('tenant');
  const parts = hostname.split('.');
  if (parts.length <= 2) return null; // xdrive.my or localhost = no subdomain
  return parts[0]; // rasniaga.xdrive.my → 'rasniaga'
}

export default function useTenant() {
  const [tenant, setTenant] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      const subdomain = getSubdomain();
      if (!subdomain) {
        setTenant(null); // main domain, show all
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, dealership, site_name, subdomain, avatar_url, site_logo_url, whatsapp_number')
        .eq('subdomain', subdomain)
        .maybeSingle();
      setTenant(data || null);
      setLoading(false);
    }
    resolve();
  }, []);

  return { tenant, loading };
}
