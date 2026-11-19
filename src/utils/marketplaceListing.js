// "Post to Facebook Marketplace" helper (MKT-1, 2026-11-20).
// Meta has no public posting API for normal sellers, and tools that log into a
// seller's Facebook and post for them break Meta's automation terms and get
// the SELLER's account restricted. So Drevo only prepares the text: the seller
// copies each field into Marketplace's own form and presses Publish themselves
// (same rule as AI drafts: a human sends). Pure functions, `npm run test:marketplace`.
import { SITE_URL } from "../config/site.js";

export const MARKETPLACE_CREATE_URL = "https://www.facebook.com/marketplace/create/vehicle";

const clean = (v) => String(v ?? "").trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const listOf = (raw) => String(raw || "").replace(/(\d{1,3}(?:,\d{3})+)/g, (m) => m.replace(/,/g, "\u0001"))
  .split(/[\n,]+/).map((x) => x.replace(/\u0001/g, ",").trim()).filter(Boolean);

export function marketplaceFields(car, { slug } = {}) {
  const make = clean(car?.brand);
  const model = clean(car?.model);
  const year = num(car?.year);
  const price = num(car?.selling_price ?? car?.price);
  const mileage = num(car?.mileage);
  const title = [year, make, model, clean(car?.variant)].filter(Boolean).join(" ");
  const link = car?.slug
    ? `${SITE_URL}/showroom/${car.slug}?${slug ? `ref=${encodeURIComponent(slug)}&` : ""}src=marketplace`
    : null;

  // Plain words, no emoji, no hashtags, no phone number: Marketplace listings
  // are read by strangers and the buyer should message through Marketplace.
  const lines = [];
  const add = (k, v) => { if (v !== null && v !== undefined && clean(v) !== "") lines.push(`${k}: ${v}`); };
  lines.push(title);
  lines.push("");
  add("Condition", { used: "Used", recon: "Recon", new: "New" }[car?.condition] || car?.condition);
  add("Mileage", mileage ? `${mileage.toLocaleString("en-MY")} km` : null);
  add("Transmission", car?.transmission);
  add("Fuel", car?.fuel_type);
  add("Engine", num(car?.engine_cc) ? `${num(car.engine_cc).toLocaleString("en-MY")}cc` : null);
  add("Colour", car?.colour);
  add("Previous owners", car?.previous_owners);
  add("Location", [car?.city, car?.state].filter(Boolean).join(", "));
  const feats = listOf(car?.features);
  if (feats.length) { lines.push(""); lines.push(`Features: ${feats.join(", ")}`); }
  const note = clean(car?.options);
  if (note) { lines.push(""); lines.push(note); }
  if (link) { lines.push(""); lines.push(`More photos and details: ${link}`); }

  return {
    title,
    price: price ? String(Math.round(price)) : "",
    year: year ? String(year) : "",
    make,
    model,
    mileage: mileage ? String(Math.round(mileage)) : "",
    description: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    link,
  };
}
