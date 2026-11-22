// The link-preview picture of a dealer's storefront (<sub>.drevo.my), drawn by
// api/dealer-card.js. ONE place builds its URL, shared by the crawler page
// (api/og.js) and the SPA (HomePage.jsx). `v` changes with anything the card
// draws from the profile, so an edit is a new URL to WhatsApp (it caches
// previews per exact URL for days). The photo and car count are not in it;
// the image itself is re-made at most a day later.
export function dealerCardVersion(d) {
  const key = [d?.site_name, d?.dealership, d?.site_logo_url, d?.logo_url, d?.city, d?.state, d?.brand_color, d?.is_verified]
    .map((v) => String(v ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function dealerShareImage(d, siteUrl) {
  if (!d?.subdomain || !/^[a-z0-9-]{1,63}$/.test(d.subdomain)) return null;
  return `${siteUrl}/api/dealer-card?sub=${encodeURIComponent(d.subdomain)}&v=${dealerCardVersion(d)}`;
}
