// api/sitemap.js — Vercel Edge Function, dynamic sitemap per tenant
export const config = { runtime: "edge" };

const ROOT_DOMAIN = "xdrive.my";
// VITE_ prefix is browser-only. Edge functions use non-prefixed env vars.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSubdomain(host) {
  const h = host.split(":")[0];
  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return null;
  if (h.endsWith(`.${ROOT_DOMAIN}`)) return h.slice(0, -(ROOT_DOMAIN.length + 1));
  return null;
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSitemap(baseUrl, staticRoutes, cars, salesmen = []) {
  const today = new Date().toISOString().split("T")[0];

  const staticUrls = staticRoutes
    .map(({ path, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(baseUrl + path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`)
    .join("");

  const carUrls = cars
    .map(({ slug, brand, model, variant, year, selling_price, city, state, updated_at, images }) => {
      const lastmod = updated_at ? new Date(updated_at).toISOString().split("T")[0] : today;
      const title = xmlEscape([year, brand, model, variant].filter(Boolean).join(" "));
      const location = [city, state].filter(Boolean).join(", ") || "Malaysia";
      const priceStr = selling_price ? `RM ${Number(selling_price).toLocaleString("en-MY")}` : "";
      const caption = xmlEscape([priceStr, location].filter(Boolean).join(" · "));
      const imageTag = images?.[0]
        ? `
    <image:image>
      <image:loc>${xmlEscape(images[0])}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
    </image:image>`
        : "";
      return `
  <url>
    <loc>${xmlEscape(baseUrl + "/cars/" + slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
    })
    .join("");

  const salesmanUrls = salesmen
    .map(({ slug }) => `
  <url>
    <loc>${xmlEscape(baseUrl + "/s/" + slug)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${staticUrls}${carUrls}${salesmanUrls}
</urlset>`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(req) {
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const subdomain = getSubdomain(host);
  const baseUrl = `https://${host}`;

  // /compare only on root marketplace — not relevant on dealer storefronts
  const staticRoutes = subdomain
    ? [
        { path: "/", changefreq: "daily", priority: "1.0" },
        { path: "/cars", changefreq: "daily", priority: "0.9" },
        { path: "/calculator", changefreq: "monthly", priority: "0.6" },
      ]
    : [
        { path: "/", changefreq: "daily", priority: "1.0" },
        { path: "/cars", changefreq: "daily", priority: "0.9" },
        { path: "/calculator", changefreq: "monthly", priority: "0.6" },
        { path: "/compare", changefreq: "monthly", priority: "0.5" },
      ];

  const carSelect = "slug,brand,model,variant,year,selling_price,city,state,updated_at,images";
  let cars = [];
  let salesmen = [];

  try {
    if (subdomain) {
      // Tenant subdomain — only this dealer's listings
      const profiles = await fetchJson(
        `${SUPABASE_URL}/rest/v1/profiles?subdomain=eq.${encodeURIComponent(subdomain)}&select=id&limit=1`,
      );
      const dealerId = profiles[0]?.id;
      if (dealerId) {
        cars = await fetchJson(
          `${SUPABASE_URL}/rest/v1/car_listings?dealer_id=eq.${encodeURIComponent(dealerId)}&status=in.(available,reserved)&select=${carSelect}&order=updated_at.desc&limit=1000`,
        );
      }
    } else {
      // Root domain — all public listings + salesman profile pages
      const [carsData, salesmenData] = await Promise.all([
        fetchJson(
          `${SUPABASE_URL}/rest/v1/car_listings?status=in.(available,reserved)&select=${carSelect}&order=updated_at.desc&limit=5000`,
        ),
        fetchJson(
          `${SUPABASE_URL}/rest/v1/profiles?role=eq.salesman&slug=not.is.null&is_active=not.is.false&select=slug&limit=2000`,
        ),
      ]);
      cars = carsData;
      salesmen = salesmenData.filter((s) => s.slug);
    }
  } catch (err) {
    console.error("[sitemap] fetch failed:", err.message);
  }

  cars = cars.filter((c) => c.slug);

  return new Response(buildSitemap(baseUrl, staticRoutes, cars, salesmen), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
