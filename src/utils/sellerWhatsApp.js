// CDP-3: the ONE way a public page links a buyer to a seller's WhatsApp.
// The number is never in the page: the link goes to /api/wa, which looks it up
// server side for this one car or seller (rate-limited per IP) and redirects to
// wa.me. A plain link, so it opens straight from the tap, popup-blocker safe.
//
//   car    - the listing the buyer is asking about (preferred: the server picks
//            the rep responsible for it, the same way the lead is attributed)
//   slug   - a rep the buyer chose or arrived through (?ref=, "Chat with X")
//   seller - a seller id, for buttons not about one car
//
// A dealer's OWN storefront still links wa.me directly from its own number
// (get_dealer_profile_by_subdomain); that is the site's contact by design.
import { apiUrl } from './apiUrl';

export function sellerWaUrl({ car, slug, seller, text } = {}) {
  if (!car && !slug && !seller) return null;
  const q = new URLSearchParams();
  if (car) q.set('car', car);
  if (slug) q.set('slug', slug);
  if (seller) q.set('seller', seller);
  if (text) q.set('text', text);
  return apiUrl(`/api/wa?${q.toString()}`);
}

// Does this public profile row have a number to reach? Reads the has_* flags
// the RPCs return; falls back to the raw column so the page keeps working on a
// database that has not had the number-stripping migration yet.
export const hasWhatsApp = (p) => !!(p && (p.has_whatsapp ?? p.whatsapp_number));
export const hasPhone = (p) => !!(p && (p.has_phone ?? p.phone));
