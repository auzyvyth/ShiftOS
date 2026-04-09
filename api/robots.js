// Vercel Edge Function — dynamic robots.txt per tenant subdomain

export const config = { runtime: "edge" };

const ROOT_DOMAIN = "xdrive.my";

const INTERNAL_PATHS = [
  "/dashboard",
  "/salesman",
  "/admin",
  "/accounts",
  "/onboarding",
  "/auth",
];

export default async function handler(req) {
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const baseUrl = `https://${host}`;

  const disallowLines = INTERNAL_PATHS.map((p) => `Disallow: ${p}`).join("\n");

  const body = `User-agent: Googlebot
Allow: /
${disallowLines}

User-agent: Bingbot
Allow: /
${disallowLines}

User-agent: *
${disallowLines}

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
