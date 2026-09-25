// Vercel Edge Function — crawler prerender for XDrive (bots are routed here by
// vercel.json). It must return REAL, UNIQUE, content-rich HTML per route, or
// Google flags pages as Soft 404 / Duplicate / "not indexed". Three kinds of
// output: (1) car detail pages, (2) listing index pages (with live car links so
// crawlers discover sublinks), (3) static content pages (/shiftos, articles,
// etc.) with route-specific meta + schema mirroring the SPA's Helmet.

import { getChassisCode } from "../src/utils/chassisCodes.js";
import * as SL from "../src/config/salesmanLandingCopy.js";
import { GUIDE_META, GUIDE_STEPS, GUIDE_FAQS, GUIDE_TIPS, GUIDE_FAQ_LD } from "../src/config/guidesCopy.js";
import { FEATURES as FEATURE_PAGES, ORDER as FEATURE_ORDER, featureTitle } from "../src/config/featurePagesCopy.js";
import { SALESMAN_PLANS, DEALER_PLANS } from "../src/utils/plans.js";
import { TERMS, PRIVACY, DPA, LEGAL_META } from "../src/legal/legalDocs.js";
import {
  HUB_BASE, HUB_LIVE, HUB_ROW_COLS, buildHubs, hubSlug as hubSlugOf, findHub, hubCopy, hubCrumbs, hubCarFilter, faqLd, breadcrumbLd,
} from "../src/utils/modelHubs.js";
import { canonicalModel } from "../src/utils/modelKey.js";
import { ARTICLE_PAGES as ARTICLES } from "../src/config/articlePages.generated.js";

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

// RPC caller — needed for SECURITY DEFINER functions like get_salesman_by_slug,
// which is the only anon-safe path to a salesman profile (RLS blocks anon from
// reading the profiles table directly, so a plain sbFetch would come back empty).
async function sbRpc(fn, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (Array.isArray(data)) return data;
    return data ? [data] : [];
  } catch {
    return [];
  }
}

async function getSalesmanData(slug) {
  const [s] = await sbRpc("get_salesman_by_slug", { p_slug: slug });
  return s ?? null;
}

// Query the public_car_listings VIEW: the anon key has no grant on the base
// car_listings table, so hitting it here returned nothing and every car page
// 404'd for crawlers. The view exposes the same columns and is granted to anon.
async function getListingData(slug) {
  const [car] = await sbFetch(
    `public_car_listings?slug=eq.${encodeURIComponent(slug)}&select=brand,model,variant,year,selling_price,mileage,colour,transmission,fuel_type,body_type,engine_cc,images,status,city,state,slug,is_recon,auction_grade,dealer_id,options,features,specs,seller_role,salesman_slug&limit=1`,
  );
  return car ?? null;
}

async function getDealerData(dealerId) {
  if (!dealerId) return null;
  // Anon has no SELECT on profiles, so a direct profiles read here always came
  // back empty: no car page ever named its seller to Google. The SECURITY
  // DEFINER RPC is the anon-safe path (active dealer/owner rows only). Only the
  // fields the prerender uses are kept — no phone numbers leave this function.
  const [d] = await sbRpc("get_dealer_profile_by_id", { p_dealer_id: dealerId });
  return d ? { dealership: d.site_name || d.dealership, subdomain: d.subdomain, city: d.city, state: d.state } : null;
}

// Who is selling this car, for the page text and the schema. A salesman's car
// credits the agent and links their /s/ page; everything else is the dealer.
async function getSellerData(car) {
  if (car.seller_role === "salesman" && car.salesman_slug) {
    const s = await getSalesmanData(car.salesman_slug);
    if (s) {
      return {
        kind: "agent",
        dealership: s.full_name || s.site_name || s.dealership || s.slug,
        url: `${SITE_URL}/s/${encodeURIComponent(s.slug)}`,
        city: s.city, state: s.state,
      };
    }
  }
  return getDealerData(car.dealer_id);
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

// A salesman's cars, collected the SAME way the mini page (SalesmanProfilePage)
// does: cars they own + cars assigned to them + dealer cars they feature via
// salesman_listings. Owned-only missed the last two, so a salesman under a
// dealer showed Google "New listings coming soon" over a page full of cars.
const SALESMAN_CAR_COLS = "id,slug,brand,model,variant,year,selling_price,mileage,state,images,status";
async function getSalesmanCars(id) {
  const live = "status=in.(available,reserved)";
  const [owned, assigned, featured, stats] = await Promise.all([
    sbFetch(`public_car_listings?dealer_id=eq.${id}&${live}&select=${SALESMAN_CAR_COLS}&order=created_at.desc&limit=48`),
    sbFetch(`public_car_listings?assigned_to=eq.${id}&${live}&select=${SALESMAN_CAR_COLS}&order=created_at.desc&limit=48`),
    sbRpc("get_salesman_featured_listings", { p_salesman_id: id }),
    sbFetch(`seller_public_stats?seller_id=eq.${id}&select=sold_count&limit=1`),
  ]);
  const seen = new Set();
  const cars = [...owned, ...assigned, ...featured.filter((c) => ["available", "reserved"].includes(c.status))]
    .filter((c) => c?.slug && !seen.has(c.id) && seen.add(c.id))
    .slice(0, 48);
  return { cars, soldCount: Number(stats[0]?.sold_count) || 0 };
}

// ── Brand/model hubs (/used-cars/...) ────────────────────────────────────────
// All grouping + copy lives in src/utils/modelHubs.js (shared with the SPA page
// and the sitemap). Here: fetch the rows, render crawler HTML.
async function getHubs() {
  const rows = await sbFetch(`public_car_listings?status=in.(${[...HUB_LIVE, "sold"].join(",")})&select=${HUB_ROW_COLS}&limit=5000`);
  return buildHubs(rows);
}

async function getHubCars(brand, model) {
  const or = encodeURIComponent(`(${hubCarFilter(brand, model)})`);
  return sbFetch(
    `public_car_listings?status=in.(${HUB_LIVE.join(",")})&or=${or}&select=slug,brand,model,variant,year,selling_price,mileage,state,images&order=created_at.desc&limit=48`,
  );
}

const crumbHtml = (crumbs) =>
  `<nav aria-label="Breadcrumb">${crumbs.map((c) => `<a href="${SITE_URL}${c.path === "/" ? "" : c.path}">${esc(c.name)}</a>`).join(" › ")}</nav>`;

function buildHubHtml(hubs, brand, model, cars) {
  const copy = hubCopy(brand, model);
  const crumbs = hubCrumbs(brand, model);
  const canonical = `${SITE_URL}${model ? model.path : brand ? brand.path : HUB_BASE}`;
  const carItems = cars.map((c) => {
    const name = [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ");
    const price = c.selling_price ? `RM ${Number(c.selling_price).toLocaleString("en-MY")}` : "";
    const km = c.mileage ? ` · ${Number(c.mileage).toLocaleString("en-MY")} km` : "";
    return `<li><a href="${SITE_URL}/showroom/${esc(c.slug)}">${esc(name)}</a> — ${esc(price)}${esc(km)}${c.state ? ` · ${esc(c.state)}` : ""}</li>`;
  }).join("\n      ");
  const hubLink = (h, label) => `<li><a href="${SITE_URL}${h.path}">${esc(label)}</a> (${h.count})</li>`;
  let nav = "";
  if (!brand) {
    nav = hubs.map((b) => `<h2><a href="${SITE_URL}${b.path}">Used ${esc(b.brand)}</a> (${b.count})</h2><ul>${b.models.map((m) => hubLink(m, `${b.brand} ${m.model}`)).join("")}</ul>`).join("\n    ");
  } else if (!model) {
    nav = `<h2>${esc(brand.brand)} models for sale</h2><ul>${brand.models.map((m) => hubLink(m, `${brand.brand} ${m.model}`)).join("")}</ul>`;
  } else {
    const others = brand.models.filter((m) => m.slug !== model.slug);
    nav = others.length ? `<h2>Other ${esc(brand.brand)} models</h2><ul>${others.map((m) => hubLink(m, `${brand.brand} ${m.model}`)).join("")}</ul>` : "";
  }
  const listLd = cars.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: copy.h1,
        numberOfItems: cars.length,
        itemListElement: cars.map((c, i) => ({
          "@type": "ListItem", position: i + 1, url: `${SITE_URL}/showroom/${c.slug}`,
          name: [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" "),
        })),
      }
    : null;
  const body = `  <main>
    ${crumbHtml(crumbs)}
    <h1>${esc(copy.h1)}</h1>
    <p>${esc(copy.intro)}</p>
    ${brand ? `<h2>${esc(copy.h1.replace(/^Used /, "").replace(/ for sale$/, ""))} listings</h2>\n    <ul>\n      ${carItems}\n    </ul>` : ""}
    ${nav}
    ${copy.faqs.length ? `<h2>FAQ</h2>\n    ${faqHtml(copy.faqs)}` : ""}
    <p><a href="${SITE_URL}/showroom">Browse all used cars</a> · <a href="${SITE_URL}/calculator">Car loan calculator</a> · <a href="${SITE_URL}/guides/buying">Buyer's guide</a></p>
  </main>`;
  return htmlShell({
    title: copy.title,
    description: copy.description,
    canonical,
    image: cars[0]?.images?.[0] || undefined,
    jsonLd: [breadcrumbLd(crumbs, SITE_URL), listLd, faqLd(copy.faqs)],
    body,
  });
}

// ── HTML shell ────────────────────────────────────────────────────────────────
function htmlShell({ lang = "en", title, description, canonical, image = `${SITE_URL}/og-default.jpg`, robots, jsonLd = [], body, ogType = "website", extraHead = "" }) {
  const ld = jsonLd
    .filter(Boolean)
    // "<" escaped as \u003c: JSON-LD carries seller-typed text, and a literal
    // "</script>" in it would end the tag and run whatever follows.
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`)
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
  <meta property="og:type" content="${ogType}" />${extraHead}
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

// Feature tags a buyer might search by ("bucket seats", "carbon pack", "360
// camera"). Prefer the structured options/features columns; fall back to specs
// only when it's a short, clean comma list, not a multi-line WhatsApp/emoji
// spec-sheet blob. De-duped and capped so alt/description stay natural.
function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return String(raw).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}
function carFeatures(car) {
  let tags = [...parseTags(car.options), ...parseTags(car.features)];
  if (!tags.length) {
    const s = (car.specs || "").trim();
    if (s && s.length <= 200 && !/[\n\r]|[─-➿]|[\u{1F000}-\u{1FAFF}]/u.test(s)) {
      tags = parseTags(s);
    }
  }
  const seen = new Set();
  return tags
    .filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k) || t.length > 40) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);
}

// The seller's own write-up ("About this car" in CarForm, stored in `specs`).
// The most specific text a car page has, and the only part not assembled from
// structured fields, so it is what separates one Alphard page from the next.
// Sellers paste WhatsApp-style markdown (**bold**, bullets); strip the markers.
function sellerText(car) {
  return String(car.specs || "")
    .replace(/\*\*|__/g, "")
    .split(/\n+/).map((l) => l.replace(/^\s*[•*\-]\s*/, "").trim()).filter(Boolean);
}

// ── Car detail ────────────────────────────────────────────────────────────────
function buildCarSchema(car, dealer, canonicalUrl, feats = [], code = null) {
  const baseName = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
  const name = code ? `${baseName} (${code})` : baseName;
  const dealerUrl = dealer?.subdomain ? `https://${dealer.subdomain}.${ROOT_DOMAIN}` : SITE_URL;
  return JSON.parse(JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Car",
    name,
    description: (() => {
      const own = sellerText(car).join(" ");
      return own.length >= 40
        ? own.slice(0, 500)
        : `${name}${car.colour ? ` in ${car.colour}` : ""} for sale in Malaysia${feats.length ? `. Features: ${feats.join(", ")}` : ""}.`;
    })(),
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
            "@type": dealer.kind === "agent" ? "Person" : "AutoDealer",
            name: dealer.dealership ?? "xdrive.my",
            url: dealer.url || dealerUrl,
            // NO telephone here. This block is served to crawlers (see the
            // user-agent rewrite in vercel.json), which includes googlebot,
            // bingbot and the AI scrapers (GPTBot, ClaudeBot, PerplexityBot,
            // ia_archiver). A telephone field handed every one of them the
            // seller's number in a structured, trivially-parsed form. Buyers
            // reach the seller through the Call button, which fetches the number
            // on tap via /api/call-number.
            address: { "@type": "PostalAddress", addressLocality: dealer.city ?? car.city ?? undefined, addressRegion: dealer.state ?? car.state ?? undefined, addressCountry: "MY" },
          }
        : { "@type": "AutoDealer", name: "xdrive.my", url: SITE_URL },
    },
  }));
}

function buildCarHtml(car, dealer, canonical, baseUrl, carBase, crumbs = null) {
  const baseName = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
  // Chassis/generation code (e.g. "G82") — enthusiasts search "m4 g82"; surfacing
  // it in the title/H1/description is what lets Google match those queries to us.
  const chassis = getChassisCode(car.brand, car.model, car.year, car.variant);
  const name = chassis ? `${baseName} (${chassis})` : baseName;
  const priceFormatted = `RM ${Number(car.selling_price).toLocaleString("en-MY")}`;
  const image = car.images?.[0] ?? `${SITE_URL}/og-default.jpg`;
  const location = [car.city, car.state].filter(Boolean).join(", ") || "Malaysia";
  const specs = [
    car.variant,
    car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
    car.colour, car.transmission, car.fuel_type,
    car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : null,
  ].filter(Boolean).join(" · ");
  const feats = carFeatures(car);
  const featShort = feats.slice(0, 3).join(", ");
  // Natural, query-shaped alt: make/model/year + colour + top features +
  // location, e.g. "2024 BMW M4 Competition in Frozen Black with Carbon Racing
  // Seats, 360 Camera for sale in Selangor, Malaysia". Capped so it never spams.
  const heroAlt = `${name}${car.colour ? ` in ${car.colour}` : ""}${featShort ? ` with ${featShort}` : ""} for sale in ${location}`;
  // Expose up to 6 photos to Google Images (was only the first); rest get
  // numbered alts so the whole gallery is discoverable.
  const gallery = (car.images || []).filter(Boolean).slice(0, 6);
  const imgs = (gallery.length ? gallery : [image]).map((src, i) =>
    `<img src="${esc(src)}" alt="${esc(i === 0 ? heroAlt : `${name} — photo ${i + 1} — for sale in ${location}`)}" width="1200" height="630" loading="${i === 0 ? "eager" : "lazy"}" />`,
  ).join("\n    ");
  const rows = [
    ["Year", car.year], ["Brand", car.brand], ["Model", car.model], ["Variant", car.variant],
    ["Mileage", car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null],
    ["Transmission", car.transmission], ["Fuel", car.fuel_type], ["Body", car.body_type],
    ["Colour", car.colour], ["Engine", car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : null],
    ["Condition", car.is_recon ? `Recon${car.auction_grade ? ` (grade ${car.auction_grade})` : ""}` : "Used"],
    ["Location", location],
  ].filter(([, v]) => v).map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("\n      ");
  const modelHub = crumbs && crumbs.length > 3 ? crumbs[crumbs.length - 1] : null;
  const body = `  <main>
    ${crumbs ? crumbHtml(crumbs) : ""}
    <h1>${esc(name)}</h1>
    <p><strong>${esc(priceFormatted)}</strong></p>
    ${imgs}
    <p>${esc([priceFormatted, specs, location].filter(Boolean).join(" · "))}</p>
    <ul>
      ${rows}
    </ul>
    ${(() => { const t = sellerText(car); return t.length ? `<h2>About this car</h2>\n    ${t.map((l) => `<p>${esc(l)}</p>`).join("\n    ")}` : ""; })()}
    ${feats.length ? `<p>Options &amp; features: ${esc(feats.join(", "))}.</p>` : ""}
    ${dealer?.dealership ? `<p>Sold by ${dealer.url ? `<a href="${esc(dealer.url)}">${esc(dealer.dealership)}</a>` : esc(dealer.dealership)}${dealer.kind === "agent" ? " (car agent)" : ""}.</p>` : ""}
    ${modelHub ? `<p><a href="${SITE_URL}${modelHub.path}">More used ${esc(car.brand)} ${esc(modelHub.name)} for sale</a></p>` : ""}
    <p><a href="${baseUrl}${carBase}">Browse more used cars on xdrive.my</a></p>
  </main>`;
  return htmlShell({
    title: `${name} — ${priceFormatted} | xdrive.my`,
    description: `${name} for ${priceFormatted}. ${specs}.${feats.length ? ` Features: ${feats.slice(0, 6).join(", ")}.` : ""} Located in ${location}. Browse on xdrive.my.`,
    canonical, image,
    jsonLd: [
      buildCarSchema(car, dealer, canonical, feats, chassis),
      crumbs ? breadcrumbLd([...crumbs, { name, path: null }], SITE_URL) : null,
    ],
    body,
  });
}

// ── Listing index pages ───────────────────────────────────────────────────────
// Brand identity schema for the root homepage — mirrors HomePage.jsx Helmet.
// This is what tells Google the domain IS the "XDrive" brand (brand-name ranking)
// and enables the sitelinks search box. The bot render omitted it before, so the
// crawler only ever saw an ItemList and never the Organization/WebSite signal.
const BRAND_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "XDrive",
    alternateName: "XDrive Malaysia",
    url: SITE_URL,
    logo: `${SITE_URL}/xdrivelogo.png`,
    description:
      "XDrive is a Malaysian marketplace for verified used, recon and new cars with transparent pricing and full vehicle history.",
    areaServed: "MY",
    sameAs: [
      "https://facebook.com/xdrive.my",
      "https://instagram.com/xdrive.my",
      "https://tiktok.com/@xdrive.my",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "XDrive",
    alternateName: "XDrive Malaysia",
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/showroom?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
];

function buildListingHtml({ title, description, h1, intro, cars, canonical, baseUrl, carBase, extraLd = [], hubs = [] }) {
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
    ${hubs.length ? `<h2>Browse used cars by brand and model</h2>
    <ul>${hubs.map((b) => `<li><a href="${SITE_URL}${b.path}">${esc(b.brand)}</a> (${b.count}): ${b.models.map((m) => `<a href="${SITE_URL}${m.path}">${esc(m.model)}</a>`).join(", ")}</li>`).join("")}</ul>
    <p><a href="${SITE_URL}${HUB_BASE}">All brands and models</a></p>` : ""}
  </main>`;
  return htmlShell({ title, description, canonical, jsonLd: [...extraLd, itemList], body });
}

// ── Salesman mini page (/s/:slug) ─────────────────────────────────────────────
// The salesman's public storefront. The OG image is their own cover banner
// (falling back to avatar, then the site default) so a shared link previews the
// agent's page — not the generic XDrive/ShiftOS banner it fell through to before.
function buildSalesmanHtml(s, cars, canonical, baseUrl, soldCount = 0) {
  const name = s.full_name || s.dealership || s.slug;
  const location = [s.city, s.state].filter(Boolean).join(", ");
  const image = s.cover_url || s.avatar_url || `${SITE_URL}/og-default.jpg`;
  const title = `${name} — Car Agent${location ? ` in ${location}` : ""} | XDrive`;
  const description =
    (s.about_text || s.bio || "").slice(0, 300) ||
    `Browse ${cars.length ? `${cars.length} ` : ""}cars for sale from ${name}${location ? ` in ${location}` : ""} on XDrive.${s.whatsapp_number ? " Contact directly on WhatsApp." : ""}`;
  const items = cars
    .map((c) => {
      const cname = [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ");
      const price = c.selling_price ? `RM ${Number(c.selling_price).toLocaleString("en-MY")}` : "";
      const loc = c.state ? ` · ${c.state}` : "";
      return `<li><a href="${baseUrl}/showroom/${esc(c.slug)}">${esc(cname)} — ${esc(price)}${esc(loc)}</a></li>`;
    })
    .join("\n      ");
  const personLd = JSON.parse(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name,
      jobTitle: s.job_title || "Car Sales Agent",
      image: s.avatar_url || undefined,
      url: canonical,
      worksFor: s.dealership ? { "@type": "AutoDealer", name: s.dealership } : undefined,
      address: location
        ? { "@type": "PostalAddress", addressLocality: s.city || undefined, addressRegion: s.state || undefined, addressCountry: "MY" }
        : undefined,
      // NO telephone — same reason as the dealer block above: this HTML is
      // served to crawlers and AI scrapers, and an agent's personal mobile is
      // the last thing that should sit in a machine-readable field.
    }),
  );
  const body = `  <main>
    <h1>${esc(name)}</h1>
    ${s.dealership ? `<p>${esc(s.dealership)}</p>` : ""}
    ${location ? `<p>${esc(location)}</p>` : ""}
    ${s.about_text || s.bio ? `<p>${esc(s.about_text || s.bio)}</p>` : ""}
    ${s.specializations?.length ? `<p>Specialises in: ${esc(s.specializations.join(", "))}.</p>` : ""}
    ${soldCount ? `<p>${soldCount} car${soldCount === 1 ? "" : "s"} sold on XDrive.</p>` : ""}
    <h2>Cars for sale from ${esc(name)}</h2>
    <ul>
      ${items || "<li>New listings coming soon.</li>"}
    </ul>
    <p><a href="${SITE_URL}/showroom">Browse all used cars on xdrive.my</a></p>
  </main>`;
  // The agent's stock as an ItemList, so the page reads as "this person's cars"
  // and each car URL is discoverable from structured data too.
  const listLd = cars.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Cars for sale from ${name}`,
        numberOfItems: cars.length,
        itemListElement: cars.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${baseUrl}/showroom/${c.slug}`,
          name: [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" "),
        })),
      }
    : null;
  return htmlShell({ title, description, canonical, image, jsonLd: [personLd, listLd], body });
}

// ── Static content pages (mirror SPA Helmet) ──────────────────────────────────
const SHIFTOS_DESC = "ShiftOS ialah software dealer kereta Malaysia & used car DMS untuk urus stok kereta terpakai, lead CRM, rekod jualan dan komisen salesman. Sistem urus stok kereta terpakai untuk dealer & salesman — mula percuma.";

const SHIFTOS_FAQS = [
  { q: "Apa itu ShiftOS?", a: "ShiftOS ialah sistem urus stok kereta terpakai (used car DMS Malaysia) yang direka khas untuk dealer kereta di Malaysia. Ia satu app urus stok kereta dan app untuk dealer kereta terpakai yang menggabungkan CRM lead, rekod jualan, komisen salesman dan analitik keuntungan." },
  { q: "Berapa harga ShiftOS?", a: "Harga ShiftOS bermula RM0 untuk Salesman Lite (percuma) dan RM35/bulan untuk Salesman Premium. Untuk dealer: Dealer Starter RM299/bulan, Dealer Growth RM599/bulan dan Dealer Pro RM1,199/bulan. Ia software dealer kereta murah berbanding kos rekod manual." },
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
    { "@type": "Offer", name: "Salesman Premium", price: "35", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Dealer Starter", price: "299", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Dealer Growth", price: "599", priceCurrency: "MYR" },
    { "@type": "Offer", name: "Dealer Pro", price: "1199", priceCurrency: "MYR" },
  ],
  publisher: { "@type": "Organization", name: "XDrive", url: SITE_URL },
};

// Articles: title, dates, FAQ, JSON-LD and the FULL body come from
// src/config/articlePages.generated.js, which tools/generate-article-pages.mjs
// renders from the real components in src/pages/articles/. Nothing here is
// retyped, so the crawler reads exactly the article a visitor reads.
function buildArticleHtml(slug, canonical) {
  const a = ARTICLES[slug];
  const extraHead = `
  <meta property="article:published_time" content="${esc(a.datePublished)}" />
  <meta property="article:modified_time" content="${esc(a.dateModified)}" />`;
  const body = `  <main>
    <article>
${a.html}
      <p><a href="${SITE_URL}/articles">Semua panduan</a> · <a href="${SITE_URL}/showroom">Lihat kereta dijual</a></p>
    </article>
  </main>`;
  return htmlShell({ lang: "ms", title: `${a.title} · XDrive`, description: a.description, canonical, jsonLd: [a.jsonLd], body, ogType: "article", extraHead });
}

// ── Shared-copy pages (guides, plans, features, legal) ───────────────────────
// Every one of these reads the SAME config file its SPA page renders from, so
// the crawler copy cannot drift from what a visitor sees.
const faqHtml = (faqs) => faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n    ");
const liHtml = (xs) => xs.map((x) => `<li>${esc(x)}</li>`).join("");
const GUIDE_LINKS = `<p><a href="${SITE_URL}/guides">How it works</a> · <a href="${SITE_URL}/guides/buying">Buyer's guide</a> · <a href="${SITE_URL}/guides/faq">FAQ</a> · <a href="${SITE_URL}/showroom">Browse used cars</a> · <a href="${SITE_URL}/calculator">Loan calculator</a></p>`;

function guidePage(key, inner, jsonLd = []) {
  const m = GUIDE_META[key];
  return htmlShell({
    title: m.title, description: m.description, canonical: `${SITE_URL}${m.path}`, jsonLd,
    body: `  <main>
    <h1>${esc(m.h1)}</h1>
    ${m.intro ? `<p>${esc(m.intro)}</p>` : ""}
    ${inner}
    ${GUIDE_LINKS}
  </main>`,
  });
}

function planHtml(p) {
  return `<h3>${esc(p.label)} — ${esc(p.price)} ${esc(p.priceSub)}</h3><ul>${liHtml([...p.caps, ...p.features, ...(p.trial ? [p.trial] : [])])}</ul>`;
}

function buildFeatureHtml(slug) {
  const f = FEATURE_PAGES[slug];
  const others = FEATURE_ORDER.filter((s) => s !== slug)
    .map((s) => `<li><a href="${SITE_URL}/features/${s}">${esc(FEATURE_PAGES[s].kicker)}</a></li>`).join("");
  const steps = f.steps
    ? `<h2>${esc(f.steps.title)}</h2>${f.steps.sub ? `<p>${esc(f.steps.sub)}</p>` : ""}<ol>${f.steps.items.map((st) => `<li><strong>${esc(st.title)}</strong> — ${esc(st.desc)}</li>`).join("")}</ol>`
    : "";
  return htmlShell({
    title: `${featureTitle(f)} | ShiftOS`,
    description: f.seo,
    canonical: `${SITE_URL}/features/${slug}`,
    jsonLd: [SOFTWARE_LD],
    body: `  <main>
    <p>${esc(f.kicker)}</p>
    <h1>${esc(featureTitle(f))}</h1>
    <p>${esc(f.sub)}</p>
    <h2>${esc(f.painTitle)}</h2><ul>${liHtml(f.pains)}</ul>
    <h2>${esc(f.solutionTitle)}</h2><ul>${liHtml(f.solutions)}</ul>
    <h2>What it does</h2>
    ${f.capabilities.map((c) => `<h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p>`).join("\n    ")}
    ${steps}
    <h2>More ShiftOS features</h2><ul>${others}</ul>
    <p><a href="${SITE_URL}/shiftos">ShiftOS for dealers</a> · <a href="${SITE_URL}/plans">Plans &amp; pricing</a></p>
  </main>`,
  });
}

function legalHtml(doc) {
  return `<p>${esc(doc.intro)}</p>
    ${doc.sections.map((sec) => `<h2>${esc(sec.h)}</h2>${sec.p.map((x) => `<p>${esc(x)}</p>`).join("")}`).join("\n    ")}`;
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
  // Salesman Lite landing. Same copy as the SPA (shared config) — without this
  // entry crawlers got the generic buyer fallback ("Quality used cars").
  "/for-salesmen": () => {
    const li = (xs) => xs.map((x) => `<li>${esc(x)}</li>`).join("");
    const body = `  <main>
    <h1>${esc(SL.HERO_H1)}</h1>
    <p>${esc(SL.HERO_INTRO)}</p>
    <p><a href="${SITE_URL}/salesman-onboarding/lite">Sign up free</a></p>
    <h2>Salesman Lite vs Mudah / Carlist</h2>
    <ul>${SL.COMPARE_ROWS.map((r) => `<li><strong>${esc(r.label)}:</strong> Mudah / Carlist — ${esc(r.old)}. Salesman Lite — ${esc(r.lite)}.</li>`).join("")}</ul>
    <h2>What you get</h2>
    ${SL.FEATURE_COPY.map((f) => `<h3>${esc(f.title)}</h3><p>${esc(f.body)}</p>`).join("\n    ")}
    <h2>How it works</h2>
    <ol>${SL.STEPS.map((st) => `<li><strong>${esc(st.title)}</strong> — ${esc(st.body)}</li>`).join("")}</ol>
    <h2>Pricing</h2>
    <h3>Salesman Lite — RM0, free forever</h3><ul>${li(SL.LITE_BULLETS)}</ul>
    <h3>Salesman Premium — RM35/month</h3><ul>${li(SL.PREMIUM_BULLETS)}</ul>
    <h2>FAQ</h2>
    ${SL.FAQS.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n    ")}
    <p><a href="${SITE_URL}/showroom">Browse cars on XDrive</a> · <a href="${SITE_URL}/articles/cara-kira-komisen-salesman-kereta">Cara kira komisen salesman kereta</a> · <a href="${SITE_URL}/shiftos">ShiftOS for dealers</a></p>
  </main>`;
    return htmlShell({
      title: SL.SEO_TITLE,
      description: SL.SEO_DESC,
      canonical: SL.CANON,
      jsonLd: [SL.SOFTWARE_LD, SL.FAQ_LD],
      body,
    });
  },
  "/guides": () => guidePage("how", `<ol>${GUIDE_STEPS.map((st) => `<li><h2>${esc(st.title)}</h2><p>${esc(st.body)}</p><ul>${liHtml(st.tips)}</ul></li>`).join("")}</ol>`),
  "/guides/faq": () => guidePage("faq", faqHtml(GUIDE_FAQS), [GUIDE_FAQ_LD]),
  "/guides/buying": () => guidePage("buying", GUIDE_TIPS.map((t) => `<h2>${esc(t.category)}</h2><ul>${liHtml(t.items)}</ul>`).join("\n    ")),
  "/plans": () => htmlShell({
    title: "Plans & Pricing | XDrive",
    description: "Sell cars on XDrive. Free for individual salesmen, RM35/month for Premium, dealer plans from RM299/month with a 14-day free trial.",
    canonical: `${SITE_URL}/plans`,
    jsonLd: [SOFTWARE_LD],
    body: `  <main>
    <h1>Start selling on XDrive</h1>
    <p>Pick how you sell. You can change plan later without losing your listings.</p>
    <h2>For individual salesmen and agents</h2>
    <p>You sell cars yourself, under your own name. Your listings go live on the marketplace and enquiries come straight to you.</p>
    ${SALESMAN_PLANS.map(planHtml).join("\n    ")}
    <h2>For dealerships</h2>
    <p>You run a lot and a team. Adds the dealer dashboard, a shared lead pipeline, stock and profit tracking, and seats for your salesmen.</p>
    ${DEALER_PLANS.map(planHtml).join("\n    ")}
    <p>Browsing, saving and messaging sellers are free for buyers and need no plan.</p>
    <p><a href="${SITE_URL}/for-salesmen">Salesman Lite (free)</a> · <a href="${SITE_URL}/shiftos">ShiftOS for dealers</a></p>
  </main>`,
  }),
  "/terms": () => htmlShell({
    title: "Terms of Service | XDrive",
    description: `Terms of Service for the ShiftOS platform and the xdrive.my marketplace. Effective ${LEGAL_META.effectiveDate}.`,
    canonical: `${SITE_URL}/terms`,
    body: `  <main>
    <h1>Terms of Service</h1>
    ${legalHtml(TERMS)}
  </main>`,
  }),
  "/privacy": () => htmlShell({
    title: "Privacy Policy | XDrive",
    description: `How ShiftOS and xdrive.my collect, use and protect personal data under Malaysia's PDPA 2010. Effective ${LEGAL_META.effectiveDate}.`,
    canonical: `${SITE_URL}/privacy`,
    body: `  <main>
    <h1>Privacy Policy</h1>
    ${legalHtml(PRIVACY)}
    <h2>Data Processing Agreement</h2>
    ${legalHtml(DPA)}
  </main>`,
  }),
  // Placeholder pages with no content yet — kept out of the index until they
  // are real, or Google files them as thin/soft-404.
  "/vehicle-services": () => htmlShell({ title: "Vehicle Services | XDrive", description: "Coming soon to XDrive.", canonical: `${SITE_URL}/vehicle-services`, robots: "noindex, follow", body: "  <main><h1>Vehicle Services</h1><p>Coming soon.</p></main>" }),
  "/automotive-products": () => htmlShell({ title: "Automotive Products | XDrive", description: "Coming soon to XDrive.", canonical: `${SITE_URL}/automotive-products`, robots: "noindex, follow", body: "  <main><h1>Automotive Products</h1><p>Coming soon.</p></main>" }),
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
      .map(([slug, a]) => `<li><a href="${SITE_URL}/articles/${esc(slug)}">${esc(a.title)}</a> — ${esc(a.description)}</li>`)
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
    const [dealer, hubs] = await Promise.all([getSellerData(car), subdomain ? [] : getHubs()]);
    // Link the car up to its brand/model hub when that hub exists (it only
    // exists while the model has a live car, so a sold unit may get brand only).
    const cm = canonicalModel(car.brand, car.model);
    const { brand: hubBrand, model: hubModel } = findHub(
      hubs,
      hubSlugOf(cm.brand || car.brand),
      hubSlugOf(cm.matched ? cm.model : car.model),
    );
    const crumbs = hubBrand ? hubCrumbs(hubBrand, hubModel) : null;
    return html(buildCarHtml(car, dealer, `${baseUrl}${pathname}`, baseUrl, carBase, crumbs));
  }

  // 2. Article pages
  const articleMatch = pathname.match(/^\/articles\/([^/]+)$/);
  if (articleMatch) {
    // No such article in the SPA either (its router falls through to Not Found).
    if (!ARTICLES[articleMatch[1]]) return new Response("Not found", { status: 404 });
    return html(buildArticleHtml(articleMatch[1], `${SITE_URL}/articles/${articleMatch[1]}`));
  }

  // 3. Static content pages
  if (STATIC_PAGES[pathname]) {
    return html(STATIC_PAGES[pathname]());
  }

  // 3b. ShiftOS feature pages. Unknown slugs redirect in the SPA, so 404 here.
  const featureMatch = pathname.match(/^\/features\/([^/]+)$/);
  if (featureMatch) {
    if (!FEATURE_PAGES[featureMatch[1]]) return new Response("Not found", { status: 404 });
    return html(buildFeatureHtml(featureMatch[1]));
  }
  // Only /guides, /guides/faq and /guides/buying exist; anything else under
  // /guides would be a duplicate of /guides, so crawlers get a 404.
  // /guides/how-it-works was the footer's URL for /guides (same page): send
  // crawlers to the one canonical address instead of a 404.
  if (pathname === "/guides/how-it-works") return new Response(null, { status: 301, headers: { Location: `${SITE_URL}/guides` } });
  if (pathname.startsWith("/guides/")) return new Response("Not found", { status: 404 });

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
      "/": { title: "XDrive — Verified Used & Recon Cars in Malaysia", h1: "Verified used & recon cars in Malaysia", desc: "Buy verified used, recon and new cars in Malaysia with transparent pricing and full vehicle history. Trusted local dealers and easy financing on XDrive." },
      "/marketplace": { title: "Used Car Marketplace Malaysia — Browse & Compare | XDrive", h1: "Used car marketplace Malaysia", desc: "Malaysia's used car marketplace — browse, filter and compare thousands of quality-checked used cars from trusted dealers on XDrive." },
      "/showroom": { title: "Showroom — All Used Cars for Sale in Malaysia | XDrive", h1: "Used car showroom", desc: "Browse every used car for sale on XDrive — filter by brand, price, year, mileage and location across Malaysia." },
      "/cars": { title: "Showroom — All Used Cars for Sale in Malaysia | XDrive", h1: "Used car showroom", desc: "Browse every used car for sale on XDrive — filter by brand, price, year, mileage and location across Malaysia." },
    };
    const m = META[pathname];
    // /cars on root canonicalises to /showroom (same page); others self-canonical.
    const canonical = pathname === "/cars" ? `${SITE_URL}/showroom` : `${SITE_URL}${pathname === "/" ? "" : pathname}`;
    // Root homepage carries the Organization + WebSite/SearchAction brand schema;
    // the other index pages (marketplace/showroom/cars) stay ItemList-only.
    const extraLd = pathname === "/" ? BRAND_LD : [];
    const hubs = await getHubs();
    return html(buildListingHtml({ title: m.title, description: m.desc, h1: m.h1, intro: m.desc, cars, canonical, baseUrl, carBase, extraLd, hubs }));
  }

  // 4b. Brand/model hubs — marketplace only (tenant sites have no hubs).
  const hubMatch = pathname.match(/^\/used-cars(?:\/([^/]+))?(?:\/([^/]+))?$/);
  if (hubMatch) {
    if (subdomain) return new Response("Not found", { status: 404 });
    const hubs = await getHubs();
    const [, bSlug, mSlug] = hubMatch;
    const { brand, model } = findHub(hubs, bSlug && decodeURIComponent(bSlug), mSlug && decodeURIComponent(mSlug));
    // Unknown brand/model, or one with no live car: a real 404, never an empty
    // page (soft 404) and never the generic fallback.
    if ((bSlug && !brand) || (mSlug && !model)) return new Response("Not found", { status: 404 });
    const cars = brand ? await getHubCars(brand, model) : [];
    return html(buildHubHtml(hubs, brand, model, cars));
  }

  // 4c. Salesman mini page (/s/:slug) — the agent's public storefront. Uses the
  // salesman's own cover banner as the OG image so shared links preview their
  // page instead of the generic site banner.
  const salesmanMatch = pathname.match(/^\/s\/([^/]+)$/);
  if (salesmanMatch) {
    const s = await getSalesmanData(decodeURIComponent(salesmanMatch[1]));
    // Unknown / deleted agent slug → a real 404, NOT the generic fallback page.
    // Returning 200 for a non-existent /s/<slug> makes Google flag it "Soft 404".
    // Same hard-404 contract as the car-detail branch above.
    if (!s) return new Response("Not found", { status: 404 });
    const { cars, soldCount } = await getSalesmanCars(s.id);
    return html(buildSalesmanHtml(s, cars, `${baseUrl}${pathname}`, baseUrl, soldCount));
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
