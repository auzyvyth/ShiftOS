// The app shell for the marketplace's two busiest pages, `/` and `/showroom`,
// with the newest cars already inside it (PERF, 2026-10-18).
//
// Without this, a first visit waits on three things in a row before a car photo
// shows: the JS bundle, then the car list from the database, then the photo
// from wsrv.nl. Here the HTML itself carries the car list (a JSON data block,
// never executed, so the CSP is untouched) and preloads the first photos, so
// the photo downloads while the JS is still arriving and the grid renders
// with cars on its first paint.
//
// middleware.js routes only real visitors on the main domain here, with no
// filters in the URL. Vercel's CDN keeps the answer 60s and refreshes it in
// the background, so visitors almost never wait on the database. If the
// database is slow or down, this serves the plain index.html: it can never be
// slower than having no shell at all.

import { CAR_FIELDS, DEALER_JOIN } from "../src/config/marketplaceConfig.js";
import { cdnImg } from "../src/utils/img.js";

export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// /showroom shows 15 per page, the marketplace grid 12; 15 covers both.
const SEED_ROWS = 15;
const DB_TIMEOUT_MS = 1500;

// Must build the SAME photo URL the page renders, or the browser downloads the
// photo twice. ShowroomCard: cdnImg(url, 480, 72). HeroCarRow: cdnImg(url, 300, 65).
const PHOTO = {
  showroom: (url) => cdnImg(url, 480, 72),
  home: (url) => cdnImg(url, 300, 65),
};

async function fetchNewestCars() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DB_TIMEOUT_MS);
  try {
    const select = encodeURIComponent(`${CAR_FIELDS}, ${DEALER_JOIN}`);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/public_car_listings?select=${select}&status=in.(available,reserved)&order=created_at.desc&limit=${SEED_ROWS}`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Prefer: "count=exact" },
        signal: ctrl.signal,
      },
    );
    if (!res.ok) return null;
    const cars = await res.json();
    if (!Array.isArray(cars) || !cars.length) return null;
    // Content-Range: 0-14/44 -> 44
    const total = Number((res.headers.get("content-range") || "").split("/")[1]) || cars.length;
    return { cars, totalCount: total };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Pure: index.html + seed -> index.html with preloads and the data block.
export function injectSeed(html, seed, page) {
  const photo = PHOTO[page] || PHOTO.showroom;
  const preloads = seed.cars
    .map((c) => (Array.isArray(c.images) ? c.images[0] : null))
    .filter(Boolean)
    .slice(0, 2)
    .map((url, i) => `<link rel="preload" as="image" href="${photo(url).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"${i === 0 ? ' fetchpriority="high"' : ""}>`)
    .join("");
  // JSON inside <script> must not be able to close the tag.
  const json = JSON.stringify({ v: 1, ...seed })
    .replace(/</g, "\\u003c")
    .replace(/[\u2028\u2029]/g, (ch) => (ch === "\u2028" ? "\\u2028" : "\\u2029"));
  const block = `${preloads}<script type="application/json" id="xd-seed">${json}</script>`;
  return html.includes("</head>") ? html.replace("</head>", `${block}</head>`) : html;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const page = url.searchParams.get("p") === "home" ? "home" : "showroom";

  const [shellRes, seed] = await Promise.all([
    fetch(new URL("/index.html", url.origin)),
    fetchNewestCars(),
  ]);
  if (!shellRes.ok) return shellRes;
  const html = await shellRes.text();

  return new Response(seed ? injectSeed(html, seed, page) : html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The browser always revalidates the HTML (it names the hashed JS files
      // of the CURRENT deploy); only Vercel's CDN keeps a copy. A new deploy
      // clears that copy. Without cars, keep it briefly so a recovered
      // database shows up fast.
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": seed ? "max-age=60, stale-while-revalidate=600" : "max-age=10",
    },
  });
}
