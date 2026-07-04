// Vercel Edge Function — crawler prerender for XDrive (bots are routed here by
// vercel.json). It must return REAL, UNIQUE, content-rich HTML per route, or
// Google flags pages as Soft 404 / Duplicate / "not indexed". Three kinds of
// output: (1) car detail pages, (2) listing index pages (with live car links so
// crawlers discover sublinks), (3) static content pages (/shiftos, articles,
// etc.) with route-specific meta + schema mirroring the SPA's Helmet.

export const config = { runtime: "edge" };

const SITE_URL = "https://xdrive.my";
const ROOT_DOMAIN = "xdrive.my";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// MUST recognise every UA that vercel.json rewrites here. If vercel routes an
// agent to /api/og but this regex misses it, the !isBot branch below 302s the
// request back to the same path, vercel re-routes it, and it loops forever —
// which is exactly how Google-InspectionTool (URL Inspection / Request Indexing)
// and googleother got stuck, making GSC reject indexing during live testing.
const BOT_AGENTS =
  /bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|googlebot|google-inspectiontool|inspectiontool|googleother|bingbot|applebot|duckduckbot|perplexitybot|chatgpt|claudebot|gptbot|anthropic-ai|cohere-ai|ia_archiver/i;

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

function getSubdomain(host) {
  const h = (host || "").split(":")[0];
  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return null;
  if (h.endsWith(`.${ROOT_DOMAIN}`)) return h.slice(0, h.length - ROOT_DOMAIN.length - 1);
  return null;
}

const sbHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

async function sbFetch(path) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Query the public_car_listings VIEW: the anon key has no grant on the base
// car_listings table, so hitting it here returned nothing and every car page
// 404'd for crawlers. The view exposes the same columns and is granted to anon.
async function getListingData(slug) {
  const [car] = await sbFetch(
    `public_car_listings?slug=eq.${encodeURIComponent(slug)}&select=brand,model,variant,year,selling_price,mileage,colour,transmission,fuel_type,body_type,engine_cc,images,status,city,state,slug,is_recon,auction_grade,dealer_id&limit=1`,
  );
  return car ?? null;
}

async function getDealerData(dealerId) {
  if (!dealerId) return null;
  const [dealer] = await sbFetch(
    `profiles?id=eq.${dealerId}&select=dealership,subdomain,whatsapp_number,city,state&limit=1`,
  );
  return dealer ?? null;
}

async function getDealerBySubdomain(subdomain) {
  if (!subdomain) return null;
  const [dealer] = await sbFetch(
    `profiles?subdomain=eq.${encodeURIComponent(subdomain)}&select=id,dealership,site_name,subdomain,city,state&limit=1`,
  );
  return dealer ?? null;
}

async function getRecentListings(dealerId, limit = 48) {
  const filter = dealerId ? `&dealer_id=eq.${dealerId}` : "";
  return sbFetch(
    `public_car_listings?status=eq.available${filter}&select=slug,brand,model,variant,year,selling_price,mileage,state&order=created_at.desc&limit=${limit}`,
  );
}

// ── HTML shell ────────────────────────────────────────────────────────────────
function htmlShell({ lang = "en", title, description, canonical, image = `${SITE_URL}/og-default.jpg`, robots, jsonLd = [], body }) {
  const ld = jsonLd
    .filter(Boolean)
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join("\n  ");
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${robots ? `<meta name="robots" content="${esc(robots)}" />` : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`}
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="xdrive.my" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  ${ld}
</head>
<body>
${body}
</body>
</html>`;
}

// ── Car detail ────────────────────────────────────────────────────────────────
function buildCarSchema(car, dealer, canonicalUrl) {
  const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
  const dealerUrl = dealer?.subdomain ? `https://${dealer.subdomain}.${ROOT_DOMAIN}` : SITE_URL;
  return JSON.parse(JSON.stringify({
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
    mileageFromOdometer: car.mileage ? { "@type": "QuantitativeValue", value: car.mileage, unitCode: "KMT" } : undefined,
    engineDisplacement: car.engine_cc ? { "@type": "QuantitativeValue", value: car.engine_cc, unitCode: "CMQ" } : undefined,
    image: car.images?.length ? car.images : undefined,
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      price: car.selling_price,
      priceCurrency: "MYR",
      availability: car.status === "available" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      itemCondition: car.is_recon ? "https://schema.org/RefurbishedCondition" : "https://schema.org/UsedCondition",
      seller: dealer
        ? {
            "@type": "AutoDealer",
            name: dealer.dealership ?? "xdrive.my",
            url: dealerUrl,
            telephone: dealer.whatsapp_number ?? undefined,
            address: { "@type": "PostalAddress", addressLocality: dealer.city ?? car.city ?? undefined, addressRegion: dealer.state ?? car.state ?? undefined, addressCountry: "MY" },
          }
        : { "@type": "AutoDealer", name: "xdrive.my", url: SITE_URL },
    },
  }));
}

function buildCarHtml(car, dealer, canonical, baseUrl, carBase) {
  const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
  const priceFormatted = `RM ${Number(car.selling_price).toLocaleString("en-MY")}`;
  const image = car.images?.[0] ?? `${SITE_URL}/og-default.jpg`;
  const location = [car.city, car.state].filter(Boolean).join(", ") || "Malaysia";
  const specs = [
    car.variant,
    car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
    car.colour, car.transmission, car.fuel_type,
    car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : null,
  ].filter(Boolean).join(" · ");
  const rows = [
    ["Year", car.year], ["Brand", car.brand], ["Model", car.model], ["Variant", car.variant],
    ["Mileage", car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null],
    ["Transmission", car.transmission], ["Fuel", car.fuel_type], ["Body", car.body_type],
    ["Colour", car.colour], ["Engine", car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : null],
    ["Condition", car.is_recon ? `Recon${car.auction_grade ? ` (grade ${car.auction_grade})` : ""}` : "Used"],
    ["Location", location],
  ].filter(([, v]) => v).map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("\n      ");
  const body = `  <main>
    <h1>${esc(name)}</h1>
    <p><strong>${esc(priceFormatted)}</strong></p>
    ${image ? `<img src="${esc(image)}" alt="${esc(name)}" width="1200" height="630" />` : ""}
    <p>${esc([priceFormatted, specs, location].filter(Boolean).join(" · "))}</p>
    <ul>
      ${rows}
    </ul>
    ${dealer?.dealership ? `<p>Sold by ${esc(dealer.dealership)}.</p>` : ""}
    <p><a href="${baseUrl}${carBase}">Browse more used cars on xdrive.my</a></p>
  </main>`;
  return htmlShell({
    title: `${name} — ${priceFormatted} | xdrive.my`,
    description: `${name} for ${priceFormatted}. ${specs}. Located in ${location}. Browse on xdrive.my.`,
    canonical, image,
    jsonLd: [buildCarSchema(car, dealer, canonical)],
    body,
  });
}

// ── Listing index pages ───────────────────────────────────────────────────────
function buildListingHtml({ title, description, h1, intro, cars, canonical, baseUrl, carBase }) {
  const items = cars.map((c) => {
    const name = [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ");
    const price = c.selling_price ? `RM ${Number(c.selling_price).toLocaleString("en-MY")}` : "";
    const loc = c.state ? ` · ${c.state}` : "";
    return `<li><a href="${baseUrl}${carBase}${esc(c.slug)}">${esc(name)} — ${esc(price)}${esc(loc)}</a></li>`;
  }).join("\n      ");
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: cars.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${baseUrl}${carBase}${c.slug}`,
      name: [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" "),
    })),
  };
  const body = `  <main>
    <h1>${esc(h1)}</h1>
    <p>${esc(intro)}</p>
    <h2>Latest listings</h2>
    <ul>
      ${items || "<li>New listings coming soon.</li>"}
    </ul>
  </main>`;
  return htmlShell({ title, description, canonical, jsonLd: [itemList], body });
}

// ── Static content pages (mirror SPA Helmet) ──────────────────────────────────
const SHIFTOS_DESC = "ShiftOS ialah software dealer kereta Malaysia & used car DMS untuk urus stok kereta terpakai, lead CRM, rekod jualan dan komisen salesman. Sistem urus stok kereta terpakai untuk dealer & salesman — mula percuma.";

const SHIFTOS_FAQS = [
  { q: "Apa itu ShiftOS?", a: "ShiftOS ialah sistem urus stok kereta terpakai (used car DMS Malaysia) yang direka khas untuk dealer kereta di Malaysia. Ia satu app urus stok kereta dan app untuk dealer kereta terpakai yang menggabungkan CRM lead, rekod jualan, komisen salesman dan analitik keuntungan." },
  { q: "Berapa harga ShiftOS?", a: "Harga ShiftOS bermula RM0 untuk Salesman Lite (percuma) dan RM50/bulan untuk Salesman Premium. Untuk dealer: Dealer Starter RM299/bulan, Dealer Growth RM599/bulan dan Dealer Pro RM1,199/bulan. Ia software dealer kereta murah berbanding kos rekod manual." },
  { q: "Adakah ShiftOS sesuai untuk dealer kecil?", a: "Ya. ShiftOS sesuai untuk dealer kereta terpakai kecil dan besar. Dealer kecil boleh mula dengan Dealer Starter RM299/bulan, manakala salesman individu boleh guna Salesman Lite percuma — app salesman kereta Malaysia untuk urus listing, lead dan komisen sendiri." },
  { q: "Boleh ke guna ShiftOS dengan Mudah dan Carlist?", a: "Boleh. ShiftOS melengkapkan Mudah dan Carlist, bukan menggantikannya. Anda urus stok, lead dan jualan dalam ShiftOS dan masih boleh iklan di Mudah atau Carlist. Setiap dealer juga dapat storefront XDrive sendiri." },
  { q: "What is the best app for Malaysian used car dealers?", a: "ShiftOS is a purpose-built used car dealer software Malaysia — combining car inventory management Malaysia, a car dealer CRM Malaysia, salesman commission tracking, F&I and revenue analytics, designed for local workflows." },
  { q: "Is there a DMS for used car dealers in Malaysia?", a: "Yes. ShiftOS is a used car DMS Malaysia (dealer management system) and car dealer management app Malaysia built for independent dealers, replacing spreadsheets with one system for stock, leads, sales and reporting." },
];

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ShiftOS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}/shiftos`,
  description: "ShiftOS is a used car dealer software Malaysia (used car DMS) for inventory management, leads CRM, sales records, salesman commission tracking and profit analytics. Built for Malaysian used car dealers.",
  inLanguage: ["ms-MY", "en-MY"],
  offers: [
    { "@type": "Offer", name: "Salesman Lite", price: "0", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Salesman Premium", price: "50", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Dealer Starter", price: "299", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Dealer Growth", price: "599", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Dealer Pro", price: "1199", priceCurrency: "MYR" },
  ],
  publisher: { "@type": "Organization", name: "XDrive", url: SITE_URL },
};

// Article meta (mirrors src/pages/articles/*). FAQs power FAQPage rich results
// + AI answer extraction; keep in sync with the article components.
const ARTICLES = {
  "apa-itu-dms-dealer-kereta": {
    lang: "ms",
    title: "Apa Itu Dealer Management System (DMS) Dan Kenapa Dealer Kereta Perlu Guna",
    description: "Penjelasan lengkap apa itu DMS untuk kereta, kenapa dealer kereta terpakai Malaysia perlu guna, dan beza DMS dengan platform iklan seperti Mudah & Carlist.",
    h1: "Apa Itu Dealer Management System (DMS)?",
    intro: "Dealer Management System (DMS) ialah sistem jualan kereta Malaysia yang menyatukan semua operasi dealer dalam satu platform — urus stok, lead CRM, jualan, komisen salesman, dokumen dan laporan keuntungan. Untuk dealer kereta terpakai, DMS menggantikan Excel dan WhatsApp dengan satu sumber data tunggal.",
    faqs: [
      { q: "Apa itu Dealer Management System (DMS)?", a: "DMS ialah sistem jualan kereta Malaysia yang menyatukan urus stok, lead CRM, jualan, komisen, dokumen dan laporan keuntungan dalam satu platform untuk dealer kereta terpakai." },
      { q: "Kenapa dealer kereta perlu guna DMS?", a: "Ia menjimatkan masa, mengurangkan kesilapan kiraan, mengesan stok lama, dan memaparkan keuntungan sebenar setiap unit — sukar dicapai dengan rekod manual." },
      { q: "Apa beza DMS dengan Mudah atau Carlist?", a: "Mudah dan Carlist ialah platform iklan untuk dapatkan pembeli. DMS pula software dealer kereta Malaysia untuk urus operasi dalaman. Kedua-duanya boleh digunakan serentak." },
    ],
  },
  "cara-urus-stok-kereta-terpakai-sistem-digital": {
    lang: "ms",
    title: "Cara Urus Stok Kereta Terpakai Dengan Sistem Digital (2026)",
    description: "Tinggalkan Excel & WhatsApp. Panduan cara urus stok kereta terpakai Malaysia guna app urus stok kereta — pantau kos, umur stok dan keuntungan automatik.",
    h1: "Cara Urus Stok Kereta Terpakai Dengan Sistem Digital",
    intro: "Cara terbaik urus stok kereta terpakai hari ini ialah guna sistem digital — app urus stok kereta yang merekod setiap unit, dari kos beli sehingga harga jual, dan mengira keuntungan serta umur stok secara automatik.",
    faqs: [
      { q: "Apa cara terbaik urus stok kereta terpakai untuk dealer?", a: "Guna sistem urus stok kereta terpakai (app urus stok kereta) yang merekod kos beli, recon, harga jual dan umur stok di satu tempat, dengan kiraan keuntungan automatik." },
      { q: "Adakah perlu bayar mahal untuk app urus stok kereta?", a: "Tidak. Ada software dealer kereta murah seperti ShiftOS bermula RM299/bulan, dan pelan percuma untuk salesman individu." },
    ],
  },
  "app-terbaik-dealer-kereta-terpakai-malaysia": {
    lang: "ms",
    title: "App Terbaik Untuk Dealer Kereta Terpakai Di Malaysia 2025",
    description: "Bandingkan app terbaik dan software dealer kereta Malaysia untuk dealer kereta terpakai — ciri, harga dan kelebihan setiap pilihan.",
    h1: "App Terbaik Untuk Dealer Kereta Terpakai 2025",
    intro: "App terbaik untuk dealer kereta terpakai di Malaysia ialah sistem yang dibina khas untuk operasi dealer tempatan — bukan sekadar platform iklan. Pilihan terbaik 2025 ialah ShiftOS, used car dealer software Malaysia yang menggabungkan urus stok, lead CRM, komisen dan analitik.",
    faqs: [
      { q: "Apa app terbaik untuk dealer kereta terpakai di Malaysia?", a: "ShiftOS — ia dibina khas untuk pasaran tempatan dan merangkumi urus stok, lead CRM, komisen salesman, dokumen dan analitik keuntungan dalam satu app." },
      { q: "Ada tak software dealer kereta murah untuk dealer kecil?", a: "Ada. ShiftOS bermula RM299/bulan untuk Dealer Starter dan ada pelan percuma untuk salesman individu (app salesman kereta Malaysia)." },
    ],
  },
  "cara-kira-komisen-salesman-kereta": {
    lang: "ms",
    title: "Cara Kira Komisen Salesman Kereta Dengan Betul (2026)",
    description: "Formula komisen salesman kereta, kesilapan biasa yang menghakis margin, dan cara buat rekod komisen salesmen kereta secara automatik.",
    h1: "Cara Kira Komisen Salesman Kereta Dengan Betul",
    intro: "Cara paling betul kira komisen salesman kereta ialah berdasarkan untung kasar (gross profit) setiap unit, bukan harga jual semata-mata — kerana harga jual tidak ambil kira kos recon, komisen dan handover.",
    faqs: [
      { q: "Macam mana cara kira komisen salesman kereta?", a: "Biasanya (1) peratusan dari untung kasar unit, (2) jumlah tetap setiap unit, atau (3) peratusan dari harga jual. Cara paling adil ialah berdasarkan untung kasar." },
      { q: "Boleh ke automasikan rekod komisen salesman?", a: "Boleh. App salesmen kereta seperti ShiftOS kira komisen automatik setiap deal ditutup (salesman commission tracking), menghapuskan kiraan manual dan pertikaian." },
    ],
  },
  "cara-buat-sales-agreement-kereta-terpakai": {
    lang: "ms",
    title: "Cara Buat Sales Agreement Kereta Terpakai Malaysia (2026)",
    description: "Apa yang wajib ada dalam sales agreement kereta terpakai, contoh klausa, dan cara automasikan dokumen jualan guna software rekod jualan kereta.",
    h1: "Cara Buat Sales Agreement Kereta Terpakai",
    intro: "Sales agreement kereta terpakai ialah dokumen bertulis yang merekod butiran jualan antara dealer dan pembeli — maklumat kereta, harga, deposit, baki bayaran dan syarat — untuk melindungi kedua-dua pihak.",
    faqs: [
      { q: "Apa yang wajib ada dalam sales agreement kereta?", a: "Butiran pembeli & penjual, maklumat kenderaan (jenama, model, tahun, plat, VIN), harga jual, deposit, baki bayaran, tarikh serahan, dan syarat pindah milik serta keadaan kereta." },
      { q: "Boleh ke automasikan pembuatan sales agreement?", a: "Boleh. Software rekod jualan kereta seperti ShiftOS menjana sales agreement dan invois automatik dari rekod jualan." },
    ],
  },
  "apa-itu-puspakom-b5-b7": {
    lang: "ms",
    title: "Apa Itu Puspakom B5 & B7? Panduan Penuh untuk Dealer & Pembeli (2026)",
    description: "Fahami perbezaan pemeriksaan Puspakom B5 dan B7, berapa kos sebenar, bila wajib dibuat, dan apa yang berlaku jika gagal.",
    h1: "Apa Itu Puspakom B5 & B7?",
    intro: "Puspakom B5 dan B7 ialah pemeriksaan kenderaan yang diperlukan semasa proses pindah milik dan pembiayaan kereta di Malaysia. B5 untuk pindah milik, B7 untuk kenderaan yang masih ada pinjaman (HP).",
  },
  "cara-pindah-milik-kereta-mysikap": {
    lang: "ms",
    title: "Cara Pindah Milik Kereta Online Guna MySikap 2026 — Panduan Lengkap",
    description: "Panduan langkah demi langkah cara buat pindah milik kereta secara online menggunakan sistem MySikap JPJ 2026. Dokumen diperlukan, kos, dan tips.",
    h1: "Cara Pindah Milik Kereta Guna MySikap",
    intro: "MySikap ialah sistem dalam talian JPJ untuk urusan kenderaan termasuk pindah milik. Panduan ini menerangkan langkah, dokumen diperlukan, dan kos untuk pindah milik kereta secara online.",
  },
  "beza-kereta-recon-dan-terpakai": {
    lang: "ms",
    title: "Beza Kereta Recon & Terpakai — Mana Lebih Berbaloi? (2026)",
    description: "Apa beza kereta recon dan kereta terpakai di Malaysia? Panduan lengkap tentang kelebihan, kelemahan, kos tersembunyi, dan mana yang lebih berbaloi.",
    h1: "Beza Kereta Recon & Terpakai",
    intro: "Kereta recon diimport dari luar negara (biasanya Jepun) dalam keadaan terpakai, manakala kereta terpakai tempatan pernah dimiliki dan digunakan di Malaysia. Setiap satu ada kelebihan dan kos tersembunyi tersendiri.",
  },
};

function buildArticleHtml(slug, canonical) {
  const a = ARTICLES[slug];
  const faqHtml = a.faqs
    ? `<h2>Soalan Lazim (FAQ)</h2>${a.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}`
    : "";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.description,
      author: { "@type": "Organization", name: "XDrive Malaysia" },
      publisher: { "@type": "Organization", name: "XDrive Malaysia", url: SITE_URL },
      url: canonical,
      inLanguage: a.lang || "ms",
    },
  ];
  if (a.faqs) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  const body = `  <main>
    <article>
      <h1>${esc(a.h1)}</h1>
      <p>${esc(a.intro)}</p>
      ${faqHtml}
      <p><a href="${SITE_URL}/articles/${esc(slug)}">Baca panduan penuh di xdrive.my</a> · <a href="${SITE_URL}/shiftos">Cuba ShiftOS</a></p>
    </article>
  </main>`;
  return htmlShell({ lang: a.lang || "ms", title: `${a.title} · XDrive`, description: a.description, canonical, jsonLd, body });
}

// Static non-listing, non-article pages.
const STATIC_PAGES = {
  "/shiftos": () => {
    const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: SHIFTOS_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
    const body = `  <main>
    <h1>Software dealer kereta Malaysia (Used Car DMS)</h1>
    <p>${esc(SHIFTOS_DESC)}</p>
    <h2>Soalan Lazim (FAQ)</h2>
    ${SHIFTOS_FAQS.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n    ")}
    <p><a href="${SITE_URL}/shiftos">Mula guna ShiftOS</a></p>
  </main>`;
    return htmlShell({
      lang: "ms",
      title: "ShiftOS — Software Dealer Kereta Malaysia | Used Car DMS & Sistem Urus Stok Kereta",
      description: SHIFTOS_DESC,
      canonical: `${SITE_URL}/shiftos`,
      jsonLd: [SOFTWARE_LD, faqLd],
      body,
    });
  },
  "/compare": () => htmlShell({
    title: "Compare Cars Side by Side | XDrive",
    description: "Free car comparison tool. Compare up to 4 used cars side by side — price, monthly instalment, mileage, year, running costs and an overall value score on XDrive.",
    canonical: `${SITE_URL}/compare`,
    body: `  <main>
    <h1>Compare cars side by side</h1>
    <p>Pick up to 4 used cars and weigh them up on price, mileage, year, running costs and our value score — all on one screen.</p>
    <p><a href="${SITE_URL}/showroom">Browse cars to compare</a></p>
  </main>`,
  }),
  "/calculator": () => htmlShell({
    title: "Car Loan Calculator Malaysia | XDrive",
    description: "Free car loan calculator for Malaysia. Estimate your monthly instalment, interest and total cost for any used car price, down payment and tenure.",
    canonical: `${SITE_URL}/calculator`,
    body: `  <main>
    <h1>Car loan calculator Malaysia</h1>
    <p>Estimate your monthly car loan instalment by price, down payment, interest rate and tenure before you buy a used car.</p>
    <p><a href="${SITE_URL}/showroom">Browse used cars</a></p>
  </main>`,
  }),
  "/articles": () => {
    const links = Object.entries(ARTICLES)
      .map(([slug, a]) => `<li><a href="${SITE_URL}/articles/${esc(slug)}">${esc(a.title)}</a></li>`)
      .join("\n      ");
    return htmlShell({
      lang: "ms",
      title: "Panduan Kereta Malaysia — XDrive",
      description: "Koleksi panduan lengkap untuk pembeli dan penjual kereta di Malaysia — pindah milik, Puspakom, urus stok dealer, komisen salesman dan lebih banyak lagi.",
      canonical: `${SITE_URL}/articles`,
      body: `  <main>
    <h1>Panduan & Artikel Kereta</h1>
    <p>Panduan lengkap dalam Bahasa Malaysia untuk pembeli dan dealer kereta terpakai.</p>
    <ul>
      ${links}
    </ul>
  </main>`,
    });
  },
  "/saved": () => htmlShell({ title: "Saved Cars | XDrive", description: "Your saved used car listings on XDrive.", canonical: `${SITE_URL}/saved`, robots: "noindex, follow", body: "  <main><h1>Saved cars</h1></main>" }),
  "/account": () => htmlShell({ title: "My Account | XDrive", description: "Your XDrive account.", canonical: `${SITE_URL}/account`, robots: "noindex, follow", body: "  <main><h1>My account</h1></main>" }),
};

export default async function handler(req) {
  const url = new URL(req.url);
  const pathname = (url.searchParams.get("path") || url.pathname).replace(/\/+$/, "") || "/";
  const ua = req.headers.get("user-agent") ?? "";
  const host = req.headers.get("host") ?? ROOT_DOMAIN;
  const subdomain = getSubdomain(host);
  const baseUrl = `https://${host}`;
  const carBase = subdomain ? "/cars/" : "/showroom/";

  if (!isBot(ua)) {
    return new Response(null, { status: 302, headers: { Location: `${baseUrl}${pathname}` } });
  }

  const html = (h, status = 200, cache = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400") =>
    new Response(h, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache } });

  // 1. Car detail
  const carMatch = pathname.match(/^\/(?:cars|showroom)\/([^/]+)$/);
  if (carMatch) {
    const car = await getListingData(decodeURIComponent(carMatch[1]));
    if (!car) return new Response("Not found", { status: 404 });
    const dealer = await getDealerData(car.dealer_id);
    return html(buildCarHtml(car, dealer, `${baseUrl}${pathname}`, baseUrl, carBase));
  }

  // 2. Article pages
  const articleMatch = pathname.match(/^\/articles\/([^/]+)$/);
  if (articleMatch && ARTICLES[articleMatch[1]]) {
    return html(buildArticleHtml(articleMatch[1], `${SITE_URL}/articles/${articleMatch[1]}`));
  }

  // 3. Static content pages
  if (STATIC_PAGES[pathname]) {
    return html(STATIC_PAGES[pathname]());
  }

  // 4. Listing index pages (root home/marketplace/showroom/cars, or tenant home/cars)
  const rootListing = !subdomain && (pathname === "/" || pathname === "/marketplace" || pathname === "/showroom" || pathname === "/cars");
  const tenantListing = subdomain && (pathname === "/" || pathname === "/cars");
  if (rootListing || tenantListing) {
    const dealer = subdomain ? await getDealerBySubdomain(subdomain) : null;
    const cars = await getRecentListings(dealer?.id, 48);
    if (subdomain) {
      const name = dealer?.site_name || dealer?.dealership || subdomain;
      return html(buildListingHtml({
        title: `${name} — Used Cars for Sale | xdrive.my`,
        description: `Browse used cars for sale from ${name} on xdrive.my. Quality-checked listings, best prices and easy financing.`,
        h1: `Used cars from ${name}`,
        intro: `Browse the latest used cars for sale from ${name}.`,
        cars, canonical: `${baseUrl}${pathname === "/" ? "" : pathname}`, baseUrl, carBase,
      }));
    }
    const META = {
      "/": { title: "XDrive — Buy & Sell Used Cars in Malaysia", h1: "Buy & sell used cars in Malaysia", desc: "Browse verified used cars for sale in Malaysia from trusted dealers on XDrive — best prices, easy financing and quality-checked listings." },
      "/marketplace": { title: "Used Car Marketplace Malaysia — Browse & Compare | XDrive", h1: "Used car marketplace Malaysia", desc: "Malaysia's used car marketplace — browse, filter and compare thousands of quality-checked used cars from trusted dealers on XDrive." },
      "/showroom": { title: "Showroom — All Used Cars for Sale in Malaysia | XDrive", h1: "Used car showroom", desc: "Browse every used car for sale on XDrive — filter by brand, price, year, mileage and location across Malaysia." },
      "/cars": { title: "Showroom — All Used Cars for Sale in Malaysia | XDrive", h1: "Used car showroom", desc: "Browse every used car for sale on XDrive — filter by brand, price, year, mileage and location across Malaysia." },
    };
    const m = META[pathname];
    // /cars on root canonicalises to /showroom (same page); others self-canonical.
    const canonical = pathname === "/cars" ? `${SITE_URL}/showroom` : `${SITE_URL}${pathname === "/" ? "" : pathname}`;
    return html(buildListingHtml({ title: m.title, description: m.desc, h1: m.h1, intro: m.desc, cars, canonical, baseUrl, carBase }));
  }

  // 5. Fallback (unknown / dealer slug landing) — unique-ish, indexable.
  return html(htmlShell({
    title: "XDrive — Quality Used Cars in Malaysia",
    description: "Browse verified used cars for sale in Malaysia from trusted dealers on xdrive.my.",
    canonical: `${baseUrl}${pathname === "/" ? "" : pathname}`,
    body: `  <main>
    <h1>Quality used cars in Malaysia</h1>
    <p>Browse verified used cars for sale in Malaysia from trusted dealers on xdrive.my.</p>
    <ul>
      <li><a href="${SITE_URL}/showroom">Browse all used cars</a></li>
      <li><a href="${SITE_URL}/calculator">Car loan calculator</a></li>
    </ul>
  </main>`,
  }));
}
