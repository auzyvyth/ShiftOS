// api/sitemap.js — Vercel Edge Function, dynamic sitemap per tenant
export const config = { runtime: "edge" };

const ROOT_DOMAIN = "xdrive.my";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Read the public_car_listings VIEW (granted to anon) with the anon key — the
// same source the marketplace uses. The base car_listings table is NOT granted
// to anon, and SUPABASE_SERVICE_KEY was unset/invalid in the deploy env, so the
// old service-key query silently returned zero cars and every listing URL was
// missing from the sitemap.
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

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

function buildSitemap(baseUrl, staticRoutes, cars, isSubdomain, agents = []) {
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
      // Expose up to 15 photos per car (was only the first) so Google Images can
      // discover the whole gallery. Google now only reads image:loc, but title is
      // kept as a harmless hint.
      const imageTag = (Array.isArray(images) ? images : [])
        .filter(Boolean)
        .slice(0, 15)
        .map(
          (img) => `
    <image:image>
      <image:loc>${xmlEscape(img)}</image:loc>
      <image:title>${title}</image:title>
    </image:image>`,
        )
        .join("");
      return `
  <url>
    <loc>${xmlEscape(baseUrl + carBase + slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
    })
    .join("");

  // Salesman mini-pages (/s/:slug). Root domain only — an agent page is a
  // marketplace-wide address, not a tenant's. These are the pages Salesman Lite
  // is sold on, so they need to be discoverable rather than link-only.
  const agentUrls = isSubdomain
    ? ""
    : agents
        .map(({ slug, lastmod }) => {
          const mod = lastmod
            ? new Date(lastmod).toISOString().split("T")[0]
            : today;
          return `
  <url>
    <loc>${xmlEscape(baseUrl + "/s/" + slug)}</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        })
        .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${staticUrls}${carUrls}${agentUrls}
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

function buildSitemapIndex(locs, lastmod) {
  const entries = locs
    .map(
      (loc) => `
  <sitemap>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</sitemapindex>`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const isMain = url.searchParams.get("main") === "1";
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const subdomain = getSubdomain(host);
  const baseUrl = `https://${host}`;

  // Root host → serve a sitemap INDEX that points Google at the root content
  // sitemap (/sitemap-main.xml) PLUS every tenant subdomain's own sitemap. The
  // root sitemap/site never linked to the subdomains, so a dealer storefront
  // like sentimas.xdrive.my had no discovery path and stayed unindexed. The
  // actual root URL list lives at /sitemap-main.xml (?main=1) below.
  if (!subdomain && !isMain) {
    // Anon has no SELECT on profiles, so reading it directly returned zero rows
    // and this index only ever listed /sitemap-main.xml — no storefront was
    // discoverable, which is the very thing the comment above describes fixing.
    // Goes through the SECURITY DEFINER helper instead.
    let subs = [];
    try {
      subs = await fetchJson(
        `${SUPABASE_URL}/rest/v1/rpc/get_subdomain_dealer_ids`,
      );
    } catch (_) {}
    const today = new Date().toISOString().split("T")[0];
    const locs = [
      `https://${ROOT_DOMAIN}/sitemap-main.xml`,
      ...subs
        .map((s) => (s.subdomain || "").trim())
        .filter(Boolean)
        .map((sd) => `https://${sd}.${ROOT_DOMAIN}/sitemap.xml`),
    ];
    return new Response(buildSitemapIndex(locs, today), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  const staticRoutes = subdomain
    ? [
        { path: "/",            changefreq: "daily",   priority: "1.0" },
        { path: "/cars",        changefreq: "daily",   priority: "0.9" },
        { path: "/calculator",  changefreq: "monthly", priority: "0.6" },
      ]
    : [
        { path: "/",             changefreq: "daily",   priority: "1.0" },
        { path: "/showroom",     changefreq: "daily",   priority: "0.9" },
        { path: "/shiftos",      changefreq: "weekly",  priority: "0.9" },
        { path: "/for-salesmen", changefreq: "weekly",  priority: "0.8" },
        { path: "/compare",      changefreq: "weekly",  priority: "0.6" },
        { path: "/guides",       changefreq: "weekly",  priority: "0.6" },
        { path: "/articles",     changefreq: "weekly",  priority: "0.7" },
        { path: "/articles/apa-itu-dms-dealer-kereta",                      changefreq: "monthly", priority: "0.7" },
        { path: "/articles/cara-urus-stok-kereta-terpakai-sistem-digital", changefreq: "monthly", priority: "0.7" },
        { path: "/articles/app-terbaik-dealer-kereta-terpakai-malaysia",   changefreq: "monthly", priority: "0.7" },
        { path: "/articles/cara-kira-komisen-salesman-kereta",             changefreq: "monthly", priority: "0.7" },
        { path: "/articles/cara-buat-sales-agreement-kereta-terpakai",     changefreq: "monthly", priority: "0.7" },
        { path: "/articles/apa-itu-puspakom-b5-b7",                        changefreq: "monthly", priority: "0.6" },
        { path: "/articles/cara-pindah-milik-kereta-mysikap",             changefreq: "monthly", priority: "0.6" },
        { path: "/articles/beza-kereta-recon-dan-terpakai",               changefreq: "monthly", priority: "0.6" },
        { path: "/calculator",  changefreq: "monthly", priority: "0.6" },
      ];

  let cars = [];

  try {
    // public_car_listings has no updated_at; alias created_at so lastmod works.
    const select = "slug,brand,model,year,updated_at:created_at,images";

    if (subdomain) {
      // Tenant subdomain — only their listings. Resolved via the existing
      // anon-executable RPC; the direct profiles read this replaced returned
      // nothing under the anon key, so every tenant sitemap was empty.
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_dealer_id_by_subdomain?p_subdomain=${encodeURIComponent(subdomain)}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      const dealerId = await res.json().catch(() => null);
      if (dealerId && typeof dealerId === "string") {
        cars = await fetchJson(
          `${SUPABASE_URL}/rest/v1/public_car_listings?dealer_id=eq.${encodeURIComponent(dealerId)}&status=eq.available&select=${select}&limit=1000`,
        );
      }
    } else {
      // Root domain — only listings whose dealer has NO subdomain of their own.
      // Dealers with a subdomain canonicalize to their own site (see
      // CarDetailPage.jsx), so including them here would create duplicate
      // canonical URLs.
      //
      // This runs on the ANON key, and anon has no SELECT policy on profiles —
      // a direct `profiles?subdomain=not.is.null` read silently returned zero
      // rows, so the exclusion never actually applied. Both profile lookups go
      // through SECURITY DEFINER RPCs that expose only these columns.
      let subdomainDealerIds = [];
      try {
        const subDealers = await fetchJson(
          `${SUPABASE_URL}/rest/v1/rpc/get_subdomain_dealer_ids`,
        );
        subdomainDealerIds = subDealers.map((d) => d.id).filter(Boolean);
      } catch (_) {}
      const excludeFilter =
        subdomainDealerIds.length > 0
          ? `&dealer_id=not.in.(${subdomainDealerIds.join(",")})`
          : "";
      cars = await fetchJson(
        `${SUPABASE_URL}/rest/v1/public_car_listings?status=eq.available&select=${select}${excludeFilter}&order=created_at.desc&limit=5000`,
      );
    }
  } catch (_) {}

  // Salesman mini-pages — root domain only.
  let agents = [];
  if (!subdomain) {
    try {
      agents = await fetchJson(
        `${SUPABASE_URL}/rest/v1/rpc/get_public_agent_slugs`,
      );
    } catch (_) {}
  }
  agents = agents.filter((a) => a.slug);

  // Filter out any rows with no slug
  cars = cars.filter((c) => c.slug);

  return new Response(buildSitemap(baseUrl, staticRoutes, cars, !!subdomain, agents), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
