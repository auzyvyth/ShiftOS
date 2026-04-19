// Vercel Edge Function — OG meta tag handler for xdrive / XDrive

export const config = { runtime: "edge" };

const SITE_URL = "https://xdrive.my";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;
const SITE_TITLE = "XDrive · XDrive Malaysia";
const SITE_DESCRIPTION =
  "Browse quality used cars on XDrive — Malaysia's trusted car marketplace.";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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

  const carMatch = pathname.match(/^\/cars\/([^/]+)\/?$/);
  if (carMatch) {
    const slug = decodeURIComponent(carMatch[1]);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/car_listings?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=brand,model,variant,year,selling_price,mileage,colour,images,city,state,transmission,fuel_type&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    const rows = await res.json();
    const car = rows?.[0];

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

// api/og.js — Extended with Schema.org JSON-LD injection
// Handles: OG meta tags (existing) + Car schema for AI search (new)

const SITE_URL = 'https://xdrive.my'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

const BOT_AGENTS = /bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot|applebot|duckduckbot|perplexitybot|chatgpt|claudebot|gptbot/i

function isBot(ua) {
  return BOT_AGENTS.test(ua)
}

async function getListingData(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/car_listings?slug=eq.${slug}&select=brand,model,variant,year,selling_price,mileage,colour,transmission,fuel_type,body_type,engine_cc,images,status,city,state,slug,condition,is_recon,auction_grade,dealer_id`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  )
  const [car] = await res.json()
  return car ?? null
}

async function getDealerData(dealerId) {
  if (!dealerId) return null
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${dealerId}&select=dealership,subdomain,whatsapp_number,city,state`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  )
  const [dealer] = await res.json()
  return dealer ?? null
}

function buildCarSchema(car, dealer) {
  const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(' ')
  const dealerUrl = dealer?.subdomain
    ? `https://${dealer.subdomain}.xdrive.my`
    : SITE_URL

  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name,
    brand: { '@type': 'Brand', name: car.brand },
    model: car.model,
    vehicleModelDate: String(car.year ?? ''),
    vehicleConfiguration: car.variant ?? undefined,
    bodyType: car.body_type ?? undefined,
    vehicleTransmission: car.transmission ?? undefined,
    fuelType: car.fuel_type ?? undefined,
    color: car.colour ?? undefined,
    driveWheelConfiguration: undefined,
    mileageFromOdometer: car.mileage
      ? { '@type': 'QuantitativeValue', value: car.mileage, unitCode: 'KMT' }
      : undefined,
    engineDisplacement: car.engine_cc
      ? { '@type': 'QuantitativeValue', value: car.engine_cc, unitCode: 'CMQ' }
      : undefined,
    image: car.images?.length ? car.images : undefined,
    url: `${SITE_URL}/cars/${car.slug}`,
    offers: {
      '@type': 'Offer',
      price: car.selling_price,
      priceCurrency: 'MYR',
      availability:
        car.status === 'available'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      itemCondition: car.is_recon
        ? 'https://schema.org/RefurbishedCondition'
        : 'https://schema.org/UsedCondition',
      seller: dealer
        ? {
            '@type': 'AutoDealer',
            name: dealer.dealership ?? 'xdrive.my',
            url: dealerUrl,
            telephone: dealer.whatsapp_number ?? undefined,
            address: {
              '@type': 'PostalAddress',
              addressLocality: dealer.city ?? car.city ?? undefined,
              addressRegion: dealer.state ?? car.state ?? undefined,
              addressCountry: 'MY',
            },
          }
        : { '@type': 'AutoDealer', name: 'xdrive.my', url: SITE_URL },
    },
    auctionGrade: car.auction_grade ?? undefined,
  }
}

function buildHtml(car, dealer) {
  const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(' ')
  const price = `RM ${Number(car.selling_price).toLocaleString('en-MY')}`
  const image = car.images?.[0] ?? `${SITE_URL}/og-default.jpg`
  const url = `${SITE_URL}/cars/${car.slug}`
  const location = [car.city, car.state].filter(Boolean).join(', ') || 'Malaysia'
  const mileage = car.mileage ? `${car.mileage.toLocaleString()} km` : ''
  const description = [price, mileage, car.transmission, car.fuel_type, location]
    .filter(Boolean)
    .join(' · ')

  const schema = buildCarSchema(car, dealer)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${name} | xdrive.my</title>
  <meta name="description" content="${description}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${name}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="xdrive.my" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${name}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />

  <!-- Schema.org Car JSON-LD (feeds AI search: Perplexity, ChatGPT, Google AI) -->
  <script type="application/ld+json">
    ${JSON.stringify(schema, null, 2)}
  </script>
</head>
<body>
  <script>window.location.href = "${url}";</script>
</body>
</html>`
}

export default async function handler(req) {
  const url = new URL(req.url)
  const pathname = url.pathname
  const ua = req.headers.get('user-agent') || ''

  // Real users — redirect straight to SPA
  if (!isBot(ua)) {
    return new Response(null, {
      status: 302,
      headers: { Location: SITE_URL + pathname + url.search },
    })
  }

  const listingMatch = pathname.match(/^\/cars\/(.+)$/)
  if (!listingMatch) {
    // Fallback homepage meta
    return new Response(
      `<!DOCTYPE html><html><head>
        <title>xdrive.my — Used Cars in Malaysia</title>
        <meta property="og:title" content="xdrive.my" />
        <meta property="og:description" content="Browse verified used cars from trusted dealers across Malaysia." />
        <meta property="og:image" content="${SITE_URL}/og-default.jpg" />
      </head><body><script>window.location.href="${SITE_URL}";</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const slug = listingMatch[1]
  const car = await getListingData(slug)
  if (!car) return new Response('Not found', { status: 404 })

  const dealer = await getDealerData(car.dealer_id)
  const html = buildHtml(car, dealer)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

export const config = { runtime: 'edge' }
