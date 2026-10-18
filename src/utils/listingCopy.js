// The text a seller copies out of a listing: the WhatsApp post (buildCopyText)
// and the plain facts (buildListingFacts). Pure functions, kept out of
// CarForm.jsx so a page that only needs the text does not download the whole
// form, its photo drag-and-drop and the chassis decoder (~66 KB gz).
import { HIGH_VALUE_THRESHOLD } from "./financing";

// Splits a free-text "specs"/"features" field into list items on commas and
// newlines. A plain /[\n,]+/ split also cuts thousands-separator commas in
// half — "Mileage: 28,595 km" pasted into the specs box became two bullets,
// "28" and "595 km". Numbers are masked out before splitting and restored
// after, so "28,595" survives as one item.
function splitList(raw) {
  const str = String(raw || "");
  const numbers = [];
  const masked = str.replace(/\d{1,3}(?:,\d{3})+/g, (m) => {
    numbers.push(m);
    return `@@N${numbers.length - 1}@@`;
  });
  return masked
    .split(/[\n,]+/)
    .map((x) => x.replace(/@@N(\d+)@@/g, (_, i) => numbers[Number(i)]).trim())
    .filter(Boolean);
}

// ─── Copy formatter (also exported for DashboardPage use) ────────────────────
export function buildCopyText(l) {
  const condLabel =
    { used: "Used", recon: "Recon", new: "New" }[l.condition] ||
    l.condition ||
    "";
  const condEmoji = { used: "🚗", recon: "✨", new: "🆕" }[l.condition] || "🚗";

  const hasDiscount =
    l.original_price && l.selling_price && l.original_price > l.selling_price;
  const discountPct = hasDiscount
    ? Math.round(
        ((l.original_price - l.selling_price) / l.original_price) * 100,
      )
    : 0;
  const isHot = discountPct >= 3;

  // Auto hashtags — built only from the listing's own name + features, never
  // generic budget tags ("#keretamurah" = "cheap car", "#keretabekas" = "used
  // car") that undersell the listing regardless of its price point.
  const brand = (l.brand || "").toLowerCase().replace(/\s+/g, "");
  const model = (l.model || "").toLowerCase().replace(/\s+/g, "");
  const isHighValue = Number(l.selling_price) > HIGH_VALUE_THRESHOLD;
  const featureTags = splitList(l.features)
    .map((f) => `#${f.toLowerCase().replace(/[^a-z0-9]+/g, "")}`)
    .filter((f) => f.length > 1);
  const tags = [`#${brand}`, `#${model}`, ...featureTags].filter(Boolean).join(" ");

  const lines = [];
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(
    `${condEmoji} ${l.year || ""} ${l.brand || ""} ${l.model || ""}${l.variant ? " " + l.variant : ""} (${condLabel})`,
  );
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push("");

  // Core info
  if (l.year) lines.push(`📅 Year        : ${l.year}`);
  if (l.registration_date)
    lines.push(`📋 Reg Date    : ${l.registration_date}`);
  if (l.mileage)
    lines.push(`🔢 Mileage     : ${Number(l.mileage).toLocaleString()} km`);
  if (l.engine_cc)
    lines.push(`⚙️  Engine      : ${Number(l.engine_cc).toLocaleString()}cc`);
  if (l.transmission) lines.push(`🔧 Transmission: ${l.transmission}`);
  if (l.fuel_type) lines.push(`⛽ Fuel        : ${l.fuel_type}`);
  if (l.body_type) lines.push(`🚘 Body Type   : ${l.body_type}`);
  if (l.colour) lines.push(`🎨 Colour      : ${l.colour}`);
  if (l.state || l.city)
    lines.push(
      `📍 Location    : ${[l.city, l.state].filter(Boolean).join(", ")}`,
    );
  if (l.vin_number) lines.push(`🔑 VIN         : ${l.vin_number}`);
  lines.push("");

  // Pricing
  lines.push(`💰 PRICING`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if (hasDiscount) {
    lines.push(`   Was  : RM ${Number(l.original_price).toLocaleString()}`);
    lines.push(
      `   Now  : RM ${Number(l.selling_price).toLocaleString()} ${isHot ? "🔥" : ""}`,
    );
    lines.push(
      `   Save : RM ${Number(l.original_price - l.selling_price).toLocaleString()} (${discountPct}% off)`,
    );
  } else {
    lines.push(`   Price: RM ${Number(l.selling_price).toLocaleString()}`);
  }
  lines.push("");

  // Features
  if (l.features && l.features.trim()) {
    lines.push(`✨ FEATURES`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    splitList(l.features).forEach((f) => lines.push(`   • ${f}`));
    lines.push("");
  }

  // Specs
  if (l.specs && l.specs.trim()) {
    lines.push(`🔩 SPECS`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    splitList(l.specs).forEach((s) => lines.push(`   • ${s}`));
    lines.push("");
  }

  // About / Options
  if (l.options && l.options.trim()) {
    lines.push(`📋 ABOUT THIS CAR`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`   ${l.options.trim()}`);
    lines.push("");
  }

  lines.push(`📞 DM or WhatsApp to enquire!`);
  lines.push(
    isHighValue
      ? `Viewing by appointment · Bank financing available`
      : `Loan available ✅ Trade-in welcome ✅`,
  );
  lines.push("");
  lines.push(tags);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  return lines.join("\n");
}

// The same listing, as a plain fact sheet for an AI to write from.
//
// buildCopyText above is the finished WhatsApp post — dividers, emoji, a CTA.
// Feeding that to a model wastes tokens on decoration and invites it to copy
// the layout instead of writing something new. This is the same SOURCE FIELDS,
// stripped to labelled facts.
//
// It exists because the AI caption writer was being handed four things (name,
// price, mileage, and a comma-joined transmission/colour/fuel/body string)
// while the human-written copy carried the variant, condition, recon grade,
// features, specs, the seller's own description and the location. The model
// was writing about a car it had barely been told about.
//
// Empty fields are omitted rather than sent as "unknown" — a blank invites the
// model to fill it in, which is exactly what must not happen with a car spec.
export function buildListingFacts(l) {
  const condLabel =
    { used: "Used", recon: "Recon", new: "New" }[l.condition] || l.condition || "";
  const out = [];
  const add = (k, v) => { if (v !== null && v !== undefined && String(v).trim() !== "") out.push(`${k}: ${v}`); };
  const list = (raw) => splitList(raw).join(", ");

  add("Car", [l.year, l.brand, l.model, l.variant].filter(Boolean).join(" "));
  add("Condition", condLabel);
  if (l.is_recon) {
    add("Recon import", l.import_country || "yes");
    add("Auction grade", l.auction_grade);
    add("Interior grade", l.interior_grade);
  }
  add("Price", l.selling_price ? `RM ${Number(l.selling_price).toLocaleString("en-MY")}` : null);
  if (l.original_price && l.selling_price && Number(l.original_price) > Number(l.selling_price)) {
    add("Was priced", `RM ${Number(l.original_price).toLocaleString("en-MY")}`);
    add("Discount", `RM ${Number(l.original_price - l.selling_price).toLocaleString("en-MY")}`);
  }
  add("Mileage", l.mileage ? `${Number(l.mileage).toLocaleString()} km` : null);
  add("Registered", l.registration_date);
  add("Engine", l.engine_cc ? `${Number(l.engine_cc).toLocaleString()}cc` : null);
  add("Horsepower", l.horsepower ? `${l.horsepower} hp` : null);
  add("Transmission", l.transmission);
  add("Fuel", l.fuel_type);
  add("Body type", l.body_type);
  add("Colour", l.colour);
  add("Seats", l.seats);
  add("Previous owners", l.previous_owners);
  add("Location", [l.city, l.state].filter(Boolean).join(", "));
  add("Warranty", l.warranty_months ? `${l.warranty_months} months` : null);
  add("Features", list(l.features));
  add("Specs", list(l.specs));
  add("Seller's description", String(l.options || "").trim() || null);
  if (Array.isArray(l.included_services) && l.included_services.length) {
    add("Included with purchase", l.included_services.map((s) => s?.name || s).filter(Boolean).join(", "));
  }
  return out.join("\n");
}
