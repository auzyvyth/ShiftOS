import { supabase } from '../supabaseClient';
import { useState, useEffect } from 'react';

const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

export const MARKETPLACE_FALLBACK = {
  brand_tagline:        "Malaysia's first fully-verified car marketplace. Every car. Every budget. Every dealer — certified.",
  support_email:        'hello@xdrive.my',
  support_whatsapp:     '60174155191',
  support_phone:        '+60 17-415 5191',
  social_instagram:     'https://instagram.com/xdrive.my',
  social_facebook:      'https://facebook.com/xdrive.my',
  social_tiktok:        null,
  trust_badges: [
    { text: 'Every listing verified' },
    { text: 'Full ownership docs' },
    { text: 'Certified dealers only' },
    { text: 'Zero phantom listings' },
  ],
  footer_copyright:     '© {year} XDrive Malaysia Sdn Bhd. All rights reserved.',
  shiftos_band_enabled: true,
  announcement_enabled: false,
  announcement_text:    null,
  announcement_link:    null,
};

// Module-level cache — shared across all hook instances for the page session lifetime
let _cache   = null;
let _promise = null;

export function invalidateMarketplaceSettingsCache() {
  _cache   = null;
  _promise = null;
}

export default function useMarketplaceSettings() {
  const [settings, setSettings] = useState(_cache);
  const [loading,  setLoading]  = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setSettings(_cache);
      setLoading(false);
      return;
    }
    if (!_promise) {
      _promise = supabase
        .from('marketplace_settings')
        .select('*')
        .eq('id', SINGLETON_ID)
        .maybeSingle()
        .then(({ data }) => {
          _cache = data || MARKETPLACE_FALLBACK;
          return _cache;
        });
    }
    _promise.then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const copyright = (settings?.footer_copyright || MARKETPLACE_FALLBACK.footer_copyright)
    .replace('{year}', new Date().getFullYear());

  return { settings: settings || MARKETPLACE_FALLBACK, loading, copyright };
}
