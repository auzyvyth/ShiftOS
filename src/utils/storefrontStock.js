// What a dealer's own site can offer buyers to filter by, worked out from the dealer's OWN live
// cars (STOREFRONT-2 stage 4 phase B: the brand strip and the browse bar). Pure functions.
// Every option leads to at least one car, and every link only carries values /cars accepts:
// brand and body type pass the SAME whitelists /cars reads (marketplaceConfig.js), a model is
// the catalogue name (canonicalModel, the one grouping /cars matches its spellings with), and a
// price is one of /cars' own price steps (passed in, they live in PriceDrumPicker).
// `npm run test:storefrontstock`.
import { sanitizeBrand, sanitizeBodyType } from "../config/marketplaceConfig.js";
import { canonicalModel } from "./modelKey.js";

export const MIN_BRANDS = 2; // a strip of one logo says nothing the cars do not

const live = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === "object");
const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name);

// Brands the dealer has cars of, most cars first: [{ name, count }]. Brands /cars would not
// filter by (not on the whitelist) are left out, so no tile leads to an unfiltered page.
export function stockBrands(rows) {
  const counts = new Map();
  for (const r of live(rows)) {
    const name = sanitizeBrand(typeof r.brand === "string" ? r.brand.trim() : null);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort(byCount);
}

// Body types the dealer has cars of: [{ name, count }], most first.
export function stockBodyTypes(rows) {
  const counts = new Map();
  for (const r of live(rows)) {
    const name = sanitizeBodyType(typeof r.body_type === "string" ? r.body_type.trim() : null);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort(byCount);
}

// Models of one brand, by catalogue name ("ALPHARD 2.5L" and "Alphard" are one), A to Z.
export function stockModels(rows, brand) {
  const out = new Set();
  for (const r of live(rows)) {
    if (!brand || sanitizeBrand(typeof r.brand === "string" ? r.brand.trim() : null) !== brand) continue;
    const m = typeof r.model === "string" && r.model.trim() ? canonicalModel(brand, r.model.trim()).model : "";
    if (m) out.add(m);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

// Max-price options: /cars' own steps, from the first that buys the cheapest car up to the first
// that buys the dearest, so every option shows at least one car and the top one shows them all.
// steps = PRICE_STEPS ([{ value: "50000", label: "RM 50k" }, ...], "" = Any).
export function stockPriceSteps(rows, steps) {
  const prices = live(rows).map((r) => Number(r.selling_price)).filter((n) => Number.isFinite(n) && n > 0);
  if (!prices.length || !Array.isArray(steps)) return [];
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const out = [];
  for (const s of steps) {
    const v = Number(s?.value);
    if (!s?.value || !Number.isFinite(v) || v < lo) continue;
    out.push({ value: String(v), label: s.label });
    if (v >= hi) break;
  }
  return out;
}

// The /cars link for a pick. Anything not in the dealer's options is dropped, never passed on.
export function browseHref(carsBase, { brand, model, maxPrice, bodyType } = {}, rows, steps) {
  const q = new URLSearchParams();
  const brands = stockBrands(rows).map((b) => b.name);
  if (brand && brands.includes(brand)) {
    q.set("brand", brand);
    if (model && stockModels(rows, brand).includes(model)) q.set("model", model);
  }
  if (maxPrice && stockPriceSteps(rows, steps).some((s) => s.value === String(maxPrice))) q.set("max_price", String(maxPrice));
  if (bodyType && stockBodyTypes(rows).some((b) => b.name === bodyType)) q.set("body_type", bodyType);
  const s = q.toString();
  return s ? `${carsBase}?${s}` : carsBase;
}

// Recently sold rows (get_dealer_recent_sales) -> what the card prints. Name = year, brand,
// model, variant; when = "Sold in March 2026". Never a price or a buyer: the rows carry neither.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function soldCards(rows) {
  return live(rows)
    .map((r) => {
      const name = [r.year, r.brand, r.model, r.variant].filter((x) => x != null && String(x).trim()).join(" ");
      const m = typeof r.sold_month === "string" ? /^(\d{4})-(\d{2})/.exec(r.sold_month) : null;
      const when = m && +m[2] >= 1 && +m[2] <= 12 ? `Sold in ${MONTHS[+m[2] - 1]} ${m[1]}` : null;
      return name && when ? { name, when, photo: typeof r.photo === "string" && r.photo ? r.photo : null } : null;
    })
    .filter(Boolean);
}
