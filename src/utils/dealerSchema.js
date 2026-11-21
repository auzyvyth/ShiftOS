// AutoDealer structured data for a dealer's own site (<sub>.drevo.my), STOREFRONT-1.
// ONE builder, shared by the page (HomePage.jsx) and the crawler copy (api/og.js),
// so Google reads the same facts either way. Plain data, no imports: og.js runs on the edge.
//
// Only facts the dealer typed into Settings go in. Never a rating (no real review
// count to back it), never opening hours (business_hours is free text and
// schema.org wants a fixed format: a wrong one is worse than none), never email
// (scrapers). The phone is fine here: it is already printed on the dealer's own
// site, the one exception to CDP-3.

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const isUrl = (v) => /^https?:\/\/\S+$/i.test(clean(v));

export function dealerSchema(dealer, url) {
  if (!dealer || !url) return null;
  const name = clean(dealer.site_name) || clean(dealer.dealership);
  if (!name) return null;

  const street = clean(dealer.location);
  const city = clean(dealer.city);
  const region = clean(dealer.state);
  const address = street || city || region
    ? {
        "@type": "PostalAddress",
        ...(street && { streetAddress: street }),
        ...(city && { addressLocality: city }),
        ...(region && { addressRegion: region }),
        addressCountry: "MY",
      }
    : undefined;

  const sameAs = [dealer.social_facebook, dealer.social_instagram, dealer.social_tiktok]
    .filter(isUrl)
    .map(clean);
  const logo = isUrl(dealer.site_logo_url) ? clean(dealer.site_logo_url) : "";
  const about = clean(dealer.about_text);
  const phone = clean(dealer.phone);

  const ld = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${url}/#dealer`,
    name,
    url,
    areaServed: "MY",
  };
  if (logo) { ld.logo = logo; ld.image = logo; }
  if (about) ld.description = about.length > 300 ? `${about.slice(0, 297).trimEnd()}...` : about;
  if (phone) ld.telephone = phone;
  if (address) {
    ld.address = address;
    ld.hasMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([street, city, region].filter(Boolean).join(", "))}`;
  }
  if (sameAs.length) ld.sameAs = sameAs;
  return ld;
}
