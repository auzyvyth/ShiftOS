// Vercel Edge Function — OG meta tag handler for XDrive

export const config = { runtime: "edge" };

const SITE_URL = "https://xdrive.my";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const BOT_AGENTS =
  /bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot|applebot|duckduckbot|perplexitybot|chatgpt|claudebot|gptbot/i;

function isBot(ua) {
  return BOT_AGENTS.test(ua);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function getListingData(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/car_listings?slug=eq.${encodeURIComponent(slug)}&select=brand,model,variant,year,selling_price,mileage,colour,transmission,fuel_type,body_type,engine_cc,images,status,city,state,slug,is_recon,auction_grade,dealer_id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const [car] = await res.json();
  return car ?? null;
}

async function getDealerData(dealerId) {
  if (!dealerId) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${dealerId}&select=dealership,subdomain,whatsapp_number,city,state&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const [dealer] = await res.json();
  return dealer ?? null;
}

function buildCarSchema(car, dealer) {
  const name = [car.year, car.brand, car.model, car.variant]
    .filter(Boolean)
    .join(" ");
  const dealerUrl = dealer?.subdomain
    ? `https://${dealer.subdomain}.xdrive.my`
    : SITE_URL;

  return JSON.parse(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Car",
      name,
      brand: { "@type": "Brand", name: car.brand },
      model: car.model,
      vehicleModelDate: String(car.year ?? ""),
      vehicleConfiguration: car.variant ?? undefined,
      bodyType: car.body_type ?? undefined,
      vehicleTransmission: car.transmission ?? undefined,
      fuelType: car.fuel_type ?? undefined,
      color: car.colour ?? undefined,
      mileageFromOdometer: car.mileage
        ? { "@type": "QuantitativeValue", value: car.mileage, unitCode: "KMT" }
        : undefined,
      engineDisplacement: car.engine_cc
        ? {
            "@type": "QuantitativeValue",
            value: car.engine_cc,
            unitCode: "CMQ",
          }
        : undefined,
      image: car.images?.length ? car.images : undefined,
      url: `${SITE_URL}/cars/${car.slug}`,
      offers: {
        "@type": "Offer",
        price: car.selling_price,
        priceCurrency: "MYR",
        availability:
          car.status === "available"
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
        itemCondition: car.is_recon
          ? "https://schema.org/RefurbishedCondition"
          : "https://schema.org/UsedCondition",
        seller: dealer
          ? {
              "@type": "AutoDealer",
              name: dealer.dealership ?? "xdrive.my",
              url: dealerUrl,
              telephone: dealer.whatsapp_number ?? undefined,
              address: {
                "@type": "PostalAddress",
                addressLocality: dealer.city ?? car.city ?? undefined,
                addressRegion: dealer.state ?? car.state ?? undefined,
                addressCountry: "MY",
              },
            }
          : { "@type": "AutoDealer", name: "xdrive.my", url: SITE_URL },
      },
    }),
  );
}

function buildCarHtml(car, dealer, pathname) {
  const name = [car.year, car.brand, car.model, car.variant]
    .filter(Boolean)
    .join(" ");
  const price = `RM ${Number(car.selling_price).toLocaleString("en-MY")}`;
  const image = car.images?.[0] ?? `${SITE_URL}/og-default.jpg`;
  const url = `${SITE_URL}${pathname}`;
  const location =
    [car.city, car.state].filter(Boolean).join(", ") || "Malaysia";
  const mileage = car.mileage
    ? `${Number(car.mileage).toLocaleString()} km`
    : "";
  const description = [
    price,
    mileage,
    car.colour,
    car.transmission,
    car.fuel_type,
    location,
  ]
    .filter(Boolean)
    .join(" · ");
  const schema = buildCarSchema(car, dealer);

  const priceFormatted = `RM ${Number(car.selling_price).toLocaleString("en-MY")}`;
  const specs = [
    car.variant,
    car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
    car.colour,
    car.transmission,
    car.fuel_type,
    car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : null,
  ].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(name)} — ${esc(priceFormatted)} | xdrive.my</title>
  <meta name="description" content="${esc(name)} for ${esc(priceFormatted)}. ${esc(specs)}. Located in ${esc(location)}. Browse on xdrive.my." />

  <!-- Open Graph (Facebook, WhatsApp, Telegram, iMessage) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="xdrive.my" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:title" content="${esc(name)} — ${esc(priceFormatted)}" />
  <meta property="og:description" content="${esc(specs)} · ${esc(location)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(name)}" />
  <meta property="og:locale" content="en_MY" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(name)} — ${esc(priceFormatted)}" />
  <meta name="twitter:description" content="${esc(specs)} · ${esc(location)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <meta name="twitter:image:alt" content="${esc(name)}" />

  <link rel="canonical" href="${esc(url)}" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <main>
    <h1>${esc(name)}</h1>
    <p><strong>${esc(priceFormatted)}</strong></p>
    ${image ? `<img src="${esc(image)}" alt="${esc(name)}" width="1200" height="630" />` : ""}
    <p>${esc(description)}</p>
    <ul>
      ${[
        ["Year", car.year],
        ["Brand", car.brand],
        ["Model", car.model],
        ["Variant", car.variant],
        ["Mileage", car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null],
        ["Transmission", car.transmission],
        ["Fuel", car.fuel_type],
        ["Body", car.body_type],
        ["Colour", car.colour],
        ["Engine", car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : null],
        ["Condition", car.is_recon ? `Recon${car.auction_grade ? ` (grade ${car.auction_grade})` : ""}` : "Used"],
        ["Location", location],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`)
        .join("\n      ")}
    </ul>
    ${dealer?.dealership ? `<p>Sold by ${esc(dealer.dealership)}.</p>` : ""}
    <p><a href="${SITE_URL}/showroom">Browse more used cars on xdrive.my</a></p>
  </main>
</body>
</html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const pathname = url.searchParams.get("path") || url.pathname;
  const ua = req.headers.get("user-agent") ?? "";

  if (!isBot(ua)) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${SITE_URL}${pathname}` },
    });
  }

  const carMatch = pathname.match(/^\/(?:cars|showroom)\/([^/]+)\/?$/);
  if (!carMatch) {
    // Non-car path (home, showroom index, articles, storefronts). Serve real,
    // crawlable content + internal links and a path-correct canonical — an empty
    // body here is what makes Google flag these as Soft 404 / not indexed.
    const canonical = `${SITE_URL}${pathname === "/" ? "" : pathname}`;
    const desc = "Browse verified used cars for sale in Malaysia from trusted dealers on xdrive.my — best prices, easy financing, quality-checked listings.";
    return new Response(
      `<!DOCTYPE html><html lang="en"><head>
  <meta charset="utf-8" />
  <title>XDrive — Quality Used Cars in Malaysia</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="xdrive.my" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:title" content="XDrive — Quality Used Cars in Malaysia" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${SITE_URL}/og-default.jpg" />
</head><body>
  <main>
    <h1>Quality used cars in Malaysia</h1>
    <p>${esc(desc)}</p>
    <ul>
      <li><a href="${SITE_URL}/showroom">Browse all used cars</a></li>
      <li><a href="${SITE_URL}/calculator">Car loan calculator</a></li>
    </ul>
  </main>
</body></html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  }

  const slug = decodeURIComponent(carMatch[1]);
  const car = await getListingData(slug);
  if (!car) return new Response("Not found", { status: 404 });

  const dealer = await getDealerData(car.dealer_id);
  return new Response(buildCarHtml(car, dealer, pathname), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
