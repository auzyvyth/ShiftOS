import useTenant from './useTenant';

export function useSiteProfile() {
  const { tenant } = useTenant();

  const siteName = tenant?.site_name || tenant?.dealership || 'XDrive';

  const waUrl = tenant?.whatsapp_number
    ? (msg) => `https://wa.me/${tenant.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
    : (msg) => `https://wa.me/?text=${encodeURIComponent(msg)}`;

  const siteInitial = siteName.charAt(0).toUpperCase();

  return { siteName, siteInitial, waUrl };
}

/** No-op kept for import compatibility */
export function clearSiteProfileCache() {}
