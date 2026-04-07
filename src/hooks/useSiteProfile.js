import useTenant from './useTenant';

// No-op: useTenant fetches fresh on every mount, no cache to clear.
export function clearSiteProfileCache() {}

export function useSiteProfile() {
  const { tenant } = useTenant();

  const siteName = tenant?.site_name || tenant?.dealership || 'XDrive';

  const waUrl = (msg) => {
    const phone = tenant?.whatsapp_number
      ? tenant.whatsapp_number.replace(/\D/g, '')
      : '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return { siteName, waUrl };
}
