// Vercel Edge Function — dynamic sitemap per tenant subdomain

export const config = { runtime: "edge" };

const ROOT_DOMAIN = "xdrive.my";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
function getSubdomain(host) {
  // Strip port if present
  const h = host.split(":")[0];
  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return null;
  if (h.endsWith(`.${ROOT_DOMAIN}`)) {
    return h.slice(0, h.length - ROOT_DOMAIN.length - 1);
  }
  return null;
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSitemap(baseUrl, staticRoutes, carSlugs) {
  const staticUrls = staticRoutes
    .map(
      ({ path, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(baseUrl + path)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join("");

  const carUrls = carSlugs
    .map(
      (slug) => `
  <url>
    <loc>${xmlEscape(baseUrl + "/cars/" + slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${carUrls}
</urlset>`;
}

async function fetchJson(url, key) {
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(req) {
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const subdomain = getSubdomain(host);
  const baseUrl = `https://${host}`;

  const staticRoutes = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/cars", changefreq: "daily", priority: "0.9" },
    { path: "/calculator", changefreq: "monthly", priority: "0.6" },
  ];

  let carSlugs = [];

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (sbUrl && sbKey) {
    try {
      if (subdomain) {
        const profiles = await fetchJson(
          `${sbUrl}/rest/v1/profiles?subdomain=eq.${encodeURIComponent(subdomain)}&select=id&limit=1`,
          sbKey,
        );
        const dealerId = profiles[0]?.id;
        if (dealerId) {
          const cars = await fetchJson(
            `${sbUrl}/rest/v1/car_listings?dealer_id=eq.${encodeURIComponent(dealerId)}&status=eq.active&select=slug&limit=1000`,
            sbKey,
          );
          carSlugs = cars.map((c) => c.slug).filter(Boolean);
        }
      } else {
        const cars = await fetchJson(
          `${sbUrl}/rest/v1/car_listings?status=eq.active&select=slug&limit=5000`,
          sbKey,
        );
        carSlugs = cars.map((c) => c.slug).filter(Boolean);
      }
    } catch (_) {
      // Fall through — return static-only sitemap
    }
  }

  return new Response(buildSitemap(baseUrl, staticRoutes, carSlugs), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
