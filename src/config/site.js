// The site's domain, in ONE place (BRAND-1, 2026-10-16).
// The brand is moving from xdrive.my to drevo.my. Every check of "is this our
// own site?" and every storefront host goes through here, so switch day is a
// change to this file, not a hunt through the code: a missed hostname check
// is a broken sign-in (captcha, post-login redirect) that only shows in prod.
// Plain data + pure functions, no imports: api/og.js, api/sitemap.js and
// api/robots.js run on the edge and import this file too.
//
// Switch day: ROOT_DOMAIN = "drevo.my", and keep "xdrive.my" in OWN_DOMAINS for
// as long as the old domain redirects, so referrers and old links still count
// as our own.

export const ROOT_DOMAIN = "xdrive.my";
export const SITE_URL = `https://${ROOT_DOMAIN}`;

// Every domain we serve (or redirect) from. ROOT_DOMAIN first.
export const OWN_DOMAINS = [ROOT_DOMAIN];

function clean(hostname) {
  return String(hostname || "").toLowerCase();
}

// True on any of our domains or one of their subdomains (www, dealer
// storefronts). False on localhost, Vercel previews and everything else.
export function isOwnHost(hostname) {
  const h = clean(hostname);
  return OWN_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

// The dealer storefront label in "<sub>.<domain>", or null for the bare domain,
// www, a nested name, or a host that is not ours.
export function storefrontSubdomain(hostname) {
  const h = clean(hostname);
  for (const d of OWN_DOMAINS) {
    if (h === d || h === `www.${d}`) return null;
    if (h.endsWith(`.${d}`)) {
      const sub = h.slice(0, -(d.length + 1));
      return sub && !sub.includes(".") ? sub : null;
    }
  }
  return null;
}

// Does a referrer URL (or bare host) point at one of our own pages?
export function isOwnUrl(url) {
  if (!url) return false;
  try {
    return isOwnHost(new URL(url).hostname);
  } catch {
    return isOwnHost(url);
  }
}
