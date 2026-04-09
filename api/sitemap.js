// Vercel Edge Function — dynamic sitemap per tenant subdomain
export const config = { runtime: "edge" };

const ROOT_DOMAIN = "xdrive.my";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function getSubdomain(host) {
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
  const staticUrls = staticRoutes.map(({ path, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(baseUrl + path)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("");
  const carUrls = carSlugs.map((slug) => `
  <url>
    <loc>${xmlEscape(baseUrl + "/cars/" + slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${carUrls}
</urlset>`;
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

  // DEBUG — return raw Supabase response
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/car_listings?status=eq.active&select=slug&limit=5`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const raw = await res.text();
    return new Response(
      `SUPABASE_URL: ${SUPABASE_URL ? "set" : "missing"}\nSUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? "set" : "missing"}\nSTATUS: ${res.status}\nBODY: ${raw.slice(0, 500)}`,
      { headers: { "Content-Type": "text/plain" } }
    );
  } catch (err) {
    return new Response(`FETCH ERROR: ${err.message}`, {
      headers: { "Content-Type": "text/plain" }
    });
  }
}
