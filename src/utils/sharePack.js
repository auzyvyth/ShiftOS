// Share Pack — turns a car_listings row into ready-to-paste listing copy for
// each external channel. Pure functions, no network, no AI tokens: everything
// is templated from columns we already store. This is also the canonical
// "render a car into platform X's format" layer that a future feed endpoint
// (FB catalog / Mudah / Carlist data feed) and the "Polish caption" AI button
// will both reuse — keep all platform shaping here, not in the UI.

import { calcMonthly } from "./financing";
import { getStorefrontUrl } from "../hooks/useTenant";

const fmtRM = (n) => `RM ${Number(n).toLocaleString("en-MY")}`;
const fmtNum = (n) => Number(n).toLocaleString("en-MY");

// Listing headline (the "title" field on Mudah/Carlist/FB).
export function buildTitle(car) {
  return [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
}

// Public car URL. Prefer the dealer's own subdomain storefront, fall back to
// the dealer's xdrive.my slug page, then the bare marketplace.
export function buildShareUrl(car, dealer = {}) {
  const path = car.slug ? `/showroom/${car.slug}` : "";
  if (dealer.subdomain) return getStorefrontUrl(dealer.subdomain, path);
  if (path) return `https://xdrive.my${path}`;
  if (dealer.slug) return `https://xdrive.my/s/${dealer.slug}`;
  return "https://xdrive.my";
}

// The shared facts every platform draws from. Each value is pre-formatted and
// null-safe so the platform templates below stay dumb.
function facts(car) {
  const monthly = car.loan_eligible !== false ? calcMonthly(car.selling_price) : null;
  return {
    title: buildTitle(car),
    price: car.selling_price ? fmtRM(car.selling_price) : null,
    monthly: monthly ? `${fmtRM(monthly)}/mo` : null,
    // spec bullets, in the order a buyer scans
    specs: [
      car.mileage && `Mileage: ${fmtNum(car.mileage)} km`,
      car.transmission && `Transmission: ${car.transmission}`,
      car.fuel_type && `Fuel: ${car.fuel_type}`,
      car.engine_cc && `Engine: ${fmtNum(car.engine_cc)} cc`,
      car.body_type && `Body: ${car.body_type}`,
      car.colour && `Colour: ${car.colour}`,
      car.previous_owners != null &&
        `Owners: ${car.previous_owners} owner${car.previous_owners !== 1 ? "s" : ""}`,
      car.state && `Location: ${car.state}`,
    ].filter(Boolean),
    // selling points / trust badges
    perks: [
      car.is_recon && "Recon unit",
      car.warranty_months > 0 && `${car.warranty_months}-month warranty`,
      car.loan_eligible !== false && "Loan available",
    ].filter(Boolean),
  };
}

function dealerLine(dealer = {}) {
  const name = dealer.site_name || dealer.dealership;
  const wa = dealer.whatsapp_number;
  return [name, wa && `WhatsApp: ${wa}`].filter(Boolean).join(" · ") || null;
}

// platform: 'whatsapp' | 'facebook' | 'mudah' | 'carlist'
// Returns { title, body, text } where `text` is the full pasteable block.
export function buildCaption(car, dealer = {}, platform = "whatsapp") {
  if (!car) return { title: "", body: "", text: "" };
  const f = facts(car);
  const url = buildShareUrl(car, dealer);
  const dl = dealerLine(dealer);

  const priceLine = [f.price, f.monthly && `(est. ${f.monthly})`].filter(Boolean).join(" ");
  const specBlock = f.specs.join("\n");
  const perkLine = f.perks.length ? f.perks.join(" | ") : null;

  let body;
  switch (platform) {
    case "facebook":
      // FB Marketplace has its own title/price/category fields — body is prose.
      body = [
        f.title,
        priceLine,
        perkLine,
        "",
        specBlock,
        car.specs || car.description || "",
        "",
        dl,
        `More details: ${url}`,
      ];
      break;
    case "mudah":
    case "carlist":
      // These have a separate title field (use buildTitle); body is the listing
      // description. Keep it factual and contact-forward.
      body = [
        priceLine,
        perkLine,
        "",
        specBlock,
        car.specs || car.description || "",
        "",
        "Interested? Contact us to view or test drive.",
        dl,
        `Full listing: ${url}`,
      ];
      break;
    case "whatsapp":
    default:
      // A chat blast / WhatsApp status — title first, scannable, link last.
      body = [
        f.title,
        priceLine,
        perkLine,
        "",
        specBlock,
        "",
        dl,
        url,
      ];
      break;
  }

  const text = body
    .filter((line) => line !== null && line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse runs of blank lines
    .trim();

  return { title: f.title, body: text, text };
}

// Convenience: build all four at once for the Share Pack sheet.
export function buildAllCaptions(car, dealer = {}) {
  return {
    whatsapp: buildCaption(car, dealer, "whatsapp"),
    facebook: buildCaption(car, dealer, "facebook"),
    mudah: buildCaption(car, dealer, "mudah"),
    carlist: buildCaption(car, dealer, "carlist"),
  };
}
