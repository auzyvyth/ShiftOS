// The link-preview pictures (og:image) for Drevo's main pages, ONE list shared by
// the SPA (Helmet) and the crawler pages (api/og.js). Built by tools/og/compose.mjs
// from the real app components; a dealer storefront has its own per-dealer card
// (src/utils/dealerShareImage.js), an agent page its own (agentShareImage).
// A changed picture = a NEW filename (WhatsApp and Facebook cache per URL).
import { SITE_URL } from "./site.js";

export const OG_IMAGES = {
  marketplace: `${SITE_URL}/og-marketplace.jpg`, // buyers: home, showroom, hubs, guides, articles
  dealers: `${SITE_URL}/og-dealers.jpg`,         // DrevoOS, the dealer software (/shiftos)
  salesmen: `${SITE_URL}/og-salesmen.jpg`,       // seller CRM + Live calculator (/for-salesmen, /plans)
};
