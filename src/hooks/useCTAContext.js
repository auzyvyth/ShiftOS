import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { setRef } from '../lib/analytics';

function getSubdomain() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  const parts = hostname.split('.');
  return parts.length >= 3 && parts[0] !== 'www' ? parts[0] : null;
}

/**
 * Resolves the WhatsApp CTA context in priority order:
 * 1. ?ref=<salesman_slug>  → salesman contact + ref tracking
 * 2. subdomain             → that dealer's contact
 * 3. none                  → listing-level (caller provides dealer phone)
 *
 * Returns: { type: 'salesman'|'dealer'|'listing'|'loading', profile, ref }
 */
const REF_SESSION_KEY = 'ref_slug';

export function useCTAContext() {
  const [ctx, setCtx] = useState({ type: 'loading', profile: null, ref: null });

  useEffect(() => {
    // URL takes priority; fall back to sessionStorage so ref survives page navigation
    const urlRef = new URLSearchParams(window.location.search).get('ref');
    const ref = urlRef || sessionStorage.getItem(REF_SESSION_KEY);
    const subdomain = getSubdomain();

    async function resolve() {
      // Priority 1: ?ref= salesman
      if (ref) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, whatsapp_number, slug')
          .eq('slug', ref)
          .eq('role', 'salesman')
          .maybeSingle();
        if (data) {
          sessionStorage.setItem(REF_SESSION_KEY, ref); // persist across SPA navigation
          setRef(ref); // also store in analytics sessionStorage key
          setCtx({ type: 'salesman', profile: data, ref });
          return;
        }
        // ref in storage but profile not found — clear stale value
        sessionStorage.removeItem(REF_SESSION_KEY);
      }

      // Priority 2: subdomain dealer
      if (subdomain) {
        const { data } = await supabase
          .from('public_dealer_profiles')
          .select('id, dealership, whatsapp_number, site_name, subdomain')
          .eq('subdomain', subdomain)
          .maybeSingle();
        if (data) {
          setCtx({ type: 'dealer', profile: data, ref: null });
          return;
        }
      }

      // Priority 3: listing-level — caller resolves dealer phone from the listing
      setCtx({ type: 'listing', profile: null, ref: null });
    }

    resolve();
  }, []);

  return ctx;
}

/**
 * Build a wa.me URL from the resolved CTA context.
 * @param {object} ctx        - result of useCTAContext()
 * @param {string|null} dealerPhone - fallback phone for type='listing'
 * @param {string} text       - the message body
 */
export function buildWaUrl(ctx, dealerPhone, text) {
  const clean = (p) => p?.replace(/\D/g, '') || '';

  if (ctx.type === 'salesman' && ctx.profile?.whatsapp_number) {
    const msg = `${text}\n\nvia: ${ctx.ref}`;
    return `https://wa.me/${clean(ctx.profile.whatsapp_number)}?text=${encodeURIComponent(msg)}`;
  }
  if (ctx.type === 'dealer' && ctx.profile?.whatsapp_number) {
    return `https://wa.me/${clean(ctx.profile.whatsapp_number)}?text=${encodeURIComponent(text)}`;
  }
  if (dealerPhone) {
    return `https://wa.me/${clean(dealerPhone)}?text=${encodeURIComponent(text)}`;
  }
  return '#';
}
