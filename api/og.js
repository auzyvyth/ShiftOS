// Vercel Edge Function — OG meta tag handler for Drevo / XDrive
// REMINDER: Add public/og-default.jpg (1200×630) as the default OG image asset.

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const SITE_URL = "https://xdrive.my";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;
const SITE_TITLE = "Drevo · XDrive Malaysia";
const SITE_DESCRIPTION =
  "Browse quality used cars on XDrive — Malaysia's trusted car marketplace.";

const BOT_PATTERNS = [
  "googlebot",
  "bingbot",
  "facebookexternalhit",
  "whatsapp",
  "telegrambot",
  "twitterbot",
  "discordbot",
  "linkedinbot",
  "slurp",
  "duckduckbot",
  "yandex",
];

function isBot(userAgent = "") {
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((p) => ua.includes(p));
}

function formatPrice(price) {
  if (!price) return "";
  return Number(price).toLocaleString("en-MY");
}

function buildHtml({ title, description, image, canonicalUrl }) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="XDrive" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
</head>
<body>
  <script>window.location.href = ${JSON.stringify(canonicalUrl)};</script>
</body>
</html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const { pathname, search } = url;
  const userAgent = req.headers.get("user-agent") ?? "";
  const canonicalUrl = `${SITE_URL}${pathname}${search}`;

  if (!isBot(userAgent)) {
    return new Response(null, {
      status: 302,
      headers: { Location: canonicalUrl },
    });
  }

  const carMatch = pathname.match(/^\/cars\/([^/]+)\/?$/);
  if (carMatch) {
    const slug = decodeURIComponent(carMatch[1]);

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    );

    const { data: car } = await supabase
      .from("car_listings")
      .select(
        "brand, model, variant, year, selling_price, mileage, colour, images, city, state, transmission, fuel_type",
      )
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (car) {
      const title = `${car.year} ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""} – RM ${formatPrice(car.selling_price)}`;
      const parts = [
        car.mileage ? `${Number(car.mileage).toLocaleString()}km` : null,
        car.transmission,
        car.fuel_type,
        car.colour,
        [car.city, car.state].filter(Boolean).join(", "),
      ].filter(Boolean);
      const description = parts.join(" · ");
      const image =
        Array.isArray(car.images) && car.images[0]
          ? car.images[0]
          : DEFAULT_OG_IMAGE;

      return new Response(
        buildHtml({ title, description, image, canonicalUrl }),
        {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        },
      );
    }
  }

  return new Response(
    buildHtml({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      image: DEFAULT_OG_IMAGE,
      canonicalUrl,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
