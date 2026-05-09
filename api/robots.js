// Vercel Serverless Function — dynamic robots.txt per tenant subdomain

const ROOT_DOMAIN = "xdrive.my";

const INTERNAL_PATHS = [
  "/dashboard",
  "/salesman",
  "/admin",
  "/accounts",
  "/onboarding",
  "/auth",
  "/login",
  "/register",
];

export default function handler(req, res) {
  const host = req.headers.host ?? ROOT_DOMAIN;
  const baseUrl = `https://${host}`;

  const disallowLines = INTERNAL_PATHS.map((p) => `Disallow: ${p}`).join("\n");

  const body = `User-agent: Googlebot
Allow: /
${disallowLines}

User-agent: Bingbot
Allow: /
${disallowLines}

User-agent: *
Allow: /
${disallowLines}

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(body);
}
