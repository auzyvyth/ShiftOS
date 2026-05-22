// api/sitemap.js — Vercel Edge Function, dynamic sitemap per tenant
export const config = { runtime: "edge" };

const ROOT_DOMAIN = "xdrive.my";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service key, not anon

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

function buildSitemap(baseUrl, staticRoutes, cars, isSubdomain) {
  const today = new Date().toISOString().split("T")[0];
  const carBase = isSubdomain ? "/cars/" : "/showroom/";

  const staticUrls = staticRoutes
    .map(
      ({ path, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(baseUrl + path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join("");

  const carUrls = cars
    .map(({ slug, brand, model, year, updated_at, images }) => {
      const lastmod = updated_at
        ? new Date(updated_at).toISOString().split("T")[0]
        : today;
      const title = xmlEscape([year, brand, model].filter(Boolean).join(" "));
      const imageTag = images?.[0]
        ? `
    <image:image>
      <image:loc>${xmlEscape(images[0])}</image:loc>
      <image:title>${title}</image:title>
    </image:image>`
        : "";
      return `
  <url>
    <loc>${xmlEscape(baseUrl + carBase + slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${staticUrls}${carUrls}
</urlset>`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(req) {
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const subdomain = getSubdomain(host);
  const baseUrl = `https://${host}`;

  const staticRoutes = subdomain
    ? [
        { path: "/",            changefreq: "daily",   priority: "1.0" },
        { path: "/cars",        changefreq: "daily",   priority: "0.9" },
        { path: "/calculator",  changefreq: "monthly", priority: "0.6" },
      ]
    : [
        { path: "/",            changefreq: "daily",   priority: "1.0" },
        { path: "/showroom",    changefreq: "daily",   priority: "0.9" },
        { path: "/calculator",  changefreq: "monthly", priority: "0.6" },
      ];

  let cars = [];

  try {
    // Columns needed: slug, brand, model, year, updated_at, images
    const select = "slug,brand,model,year,updated_at,images";

    if (subdomain) {
      // Tenant subdomain — only their listings
      const profiles = await fetchJson(
        `${SUPABASE_URL}/rest/v1/profiles?subdomain=eq.${encodeURIComponent(subdomain)}&select=id&limit=1`,
      );
      const dealerId = profiles[0]?.id;
      if (dealerId) {
        cars = await fetchJson(
          `${SUPABASE_URL}/rest/v1/car_listings?dealer_id=eq.${encodeURIComponent(dealerId)}&status=eq.available&select=${select}&limit=1000`,
        );
      }
    } else {
      // Root domain — all available listings across all dealers
      cars = await fetchJson(
        `${SUPABASE_URL}/rest/v1/car_listings?status=eq.available&select=${select}&order=updated_at.desc&limit=5000`,
      );
    }
  } catch (_) {}

  // Filter out any rows with no slug
  cars = cars.filter((c) => c.slug);

  return new Response(buildSitemap(baseUrl, staticRoutes, cars, !!subdomain), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
