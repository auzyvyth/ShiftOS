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
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      if (subdomain) {
        const profiles = await fetchJson(
          `${SUPABASE_URL}/rest/v1/profiles?subdomain=eq.${encodeURIComponent(subdomain)}&select=id&limit=1`,
          SUPABASE_ANON_KEY,
        );
        const dealerId = profiles[0]?.id;
        if (dealerId) {
          const cars = await fetchJson(
            `${SUPABASE_URL}/rest/v1/car_listings?dealer_id=eq.${encodeURIComponent(dealerId)}&status=eq.active&select=slug&limit=1000`,
            SUPABASE_ANON_KEY,
          );
          carSlugs = cars.map((c) => c.slug).filter(Boolean);
        }
      } else {
        const cars = await fetchJson(
          `${SUPABASE_URL}/rest/v1/car_listings?status=eq.active&select=slug&limit=5000`,
          SUPABASE_ANON_KEY,
        );
        carSlugs = cars.map((c) => c.slug).filter(Boolean);
      }
    } catch (_) {}
  }
  return new Response(buildSitemap(baseUrl, staticRoutes, carSlugs), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
