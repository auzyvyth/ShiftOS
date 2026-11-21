import useTenant from './useTenant';

// No-op: useTenant fetches fresh on every mount, no cache to clear.
export function clearSiteProfileCache() {}

// Pure: the site-profile values for a tenant row. The hook reads the tenant from the hostname; the
// dashboard's header preview (SectionPreview.jsx) passes the dealer's row in directly.
export function siteProfileFrom(tenant) {
  const siteName = tenant?.site_name || tenant?.dealership || 'Drevo';
  const siteInitial = siteName.charAt(0).toUpperCase();
  const siteLogoUrl = tenant?.site_logo_url || '';
  const isVerified = !!tenant?.is_verified;

  const waUrl = (msg) => {
    const phone = tenant?.whatsapp_number
      ? tenant.whatsapp_number.replace(/\D/g, '')
      : '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return { siteName, siteInitial, siteLogoUrl, isVerified, waUrl, profile: tenant };
}

export function useSiteProfile() {
  const { tenant } = useTenant();
  return siteProfileFrom(tenant);
}
