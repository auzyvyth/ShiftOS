/**
 * useSiteProfile — shared hook for public-facing site settings.
 *
 * Reads the dealer's profile from Supabase and exposes the fields
 * that public pages (Header, Footer, page titles, WhatsApp CTAs)
 * need to render dynamically.
 *
 * A module-level cache means the fetch only happens once per page
 * load, regardless of how many components call this hook.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Module-level cache — shared across all hook instances
let _cache = null;
let _promise = null;

function fetchProfile() {
  if (_promise) return _promise;
  _promise = supabase
    .from('profiles')
    .select(
      'site_name, dealership, brand_color, whatsapp_number, ' +
      'social_tiktok, social_instagram, social_facebook, ' +
      'hero_title, hero_subtitle, hero_cta_text, ' +
      'announcement_bar, announcement_bar_enabled, about_text'
    )
    .eq('role', 'dealer')
    .limit(1)
    .single()
    .then(({ data }) => {
      _cache = data || {};
      return _cache;
    })
    .catch(() => {
      _promise = null; // allow retry on error
      return {};
    });
  return _promise;
}

export function useSiteProfile() {
  const [profile, setProfile] = useState(_cache || {});

  useEffect(() => {
    if (_cache) { setProfile(_cache); return; }
    fetchProfile().then(setProfile);
  }, []);

  /** Formatted WhatsApp URL from the dealer's saved number */
  const waUrl = (message = '') => {
    const num = (profile?.whatsapp_number || '').replace(/\D/g, '');
    const full = num.startsWith('60') ? num : num ? `60${num}` : '60174155191';
    return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  };

  /** Display name: site_name > dealership > fallback */
  const siteName = profile?.site_name || profile?.dealership || 'XDrive';

  /** First letter of site name (for logo icon) */
  const siteInitial = siteName.charAt(0).toUpperCase();

  return { profile, siteName, siteInitial, waUrl };
}

/** Call this after saving settings to clear the cache */
export function clearSiteProfileCache() {
  _cache = null;
  _promise = null;
}
