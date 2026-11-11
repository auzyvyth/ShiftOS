// Vercel Serverless Function — dynamic robots.txt per tenant subdomain

import { ROOT_DOMAIN, storefrontSubdomain } from "../src/config/site.js";

const INTERNAL_PATHS = [
  "/dashboard",
  "/salesman",
  "/manager",
  "/accountant",
  // "$" = exactly /fi. A bare "/fi" is a prefix and also blocked /find-me.
  "/fi$",
  "/fi/",
  "/admin",
  "/accounts",
  "/platform",
  "/onboarding",
  "/auth",
  "/api/wa",
];

// AI search / answer crawlers, named so they are allowed on purpose, not only by
// falling through to "*". Same private paths stay closed to them.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended"];

export default function handler(req, res) {
  const host = (req.headers.host ?? ROOT_DOMAIN).split(":")[0];
  // The canonical domain, whichever of ours was asked (see api/sitemap.js).
  const sub = storefrontSubdomain(host);
  const baseUrl = sub ? `https://${sub}.${ROOT_DOMAIN}` : `https://${ROOT_DOMAIN}`;

  const disallowLines = INTERNAL_PATHS.map((p) => `Disallow: ${p}`).join("\n");

  const aiBlocks = AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /\n${disallowLines}\n`).join("\n");

  const body = `User-agent: Googlebot
Allow: /
${disallowLines}

User-agent: Bingbot
Allow: /
${disallowLines}

${aiBlocks}
User-agent: *
${disallowLines}

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(body);
}
