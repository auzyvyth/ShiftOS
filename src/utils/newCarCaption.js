// The WhatsApp / social caption for a NEW-CAR card (NEWCAR-1), in BM.
//
// buildCopyText (listingCopy.js) is the used-car caption: it reads the
// car_listings row, and a new-car card leaves almost every field on that row
// empty on purpose. The real facts live in the price list (new_car_models), so
// the old caption printed a name, one price and the CHEAPEST variant's gearbox
// ("CVT" on an S70 card where 4 of 6 variants are a turbo DCT).
//
// Input is the get_new_car_listing_info result (same as the car page), so the
// prices are the seller's own zone. Rules:
// - Only catalogue facts. "Semua varian" lists only what EVERY variant has.
// - A zone with no price says "tanya harga", never the Peninsular number.
// - No promo, rebate or loan approval: none is stored, and the seller's own
//   promise goes in their "What you offer" text, quoted as they wrote it.
// - Feature names stay as the catalogue writes them (English, the way they are
//   said in a Malaysian showroom); only the structure is BM.
// Pure; npm run test:newcarcaption.

const LINE = "━━━━━━━━━━━━━━━━━━━━";

const ZONE_BM = {
  peninsular: "Semenanjung",
  sabah_sarawak: "Sabah / Sarawak",
  labuan: "Labuan",
  langkawi: "Langkawi",
};

const rmBM = (n) => `RM${Math.round(Number(n)).toLocaleString("en-MY")}`;
const hasPrice = (v) => v.price != null && v.price !== "" && Number(v.price) > 0;

// "5 years / unlimited km" -> "5 tahun / km tanpa had". Anything else as written.
function warrantyBM(w) {
  const s = String(w || "").trim();
  if (!s) return "";
  return s
    .replace(/(\d+)\s*years?/i, "$1 tahun")
    .replace(/unlimited\s*km/i, "km tanpa had")
    .replace(/(\d[\d,]*)\s*km/i, "$1 km");
}

// "1.5L turbo · 181PS · 7-speed DCT" / "60.22 kWh · 410 km · 1-speed".
function variantSpec(v) {
  const s = v.specs || {};
  return [
    s.engine || (s.battery_kwh ? `${s.battery_kwh} kWh` : null),
    s.power_ps ? `${s.power_ps}PS` : null,
    s.range_km ? `jarak ${s.range_km} km` : null,
    v.transmission || null,
  ].filter(Boolean).join(", ");
}

const itemsOf = (v) => [...(v.specs?.safety || []), ...(v.specs?.features || [])];

// Values every variant shares, or null when they differ / any is missing.
function shared(variants, get) {
  const vals = variants.map(get);
  if (vals.some((x) => x == null || x === "")) return null;
  return vals.every((x) => x === vals[0]) ? vals[0] : null;
}

export function buildNewCarCaption({ listing = {}, info = {}, link = "" }) {
  const brand = info.brand || listing.brand || "";
  const model = info.model || listing.model || "";
  let variants = Array.isArray(info.variants) ? info.variants : [];
  // An old per-variant card (before one-card-per-model) names its variant.
  if (listing.variant) {
    const one = variants.filter((v) => v.variant === listing.variant);
    if (one.length) variants = one;
  }
  variants = [...variants].sort((a, b) =>
    (hasPrice(a) ? Number(a.price) : Infinity) - (hasPrice(b) ? Number(b.price) : Infinity));
  const priced = variants.filter(hasPrice);
  const zone = ZONE_BM[info.price_zone] || ZONE_BM.peninsular;

  const out = [];
  out.push(LINE);
  out.push(`🆕 ${[brand, model, listing.year].filter(Boolean).join(" ")} | Kereta baru`);
  out.push(LINE);
  if (priced.length) {
    const from = rmBM(priced[0].price);
    out.push(priced.length > 1 || variants.length > 1 ? `💰 Dari ${from}` : `💰 ${from}`);
    out.push(`Harga rasmi ${zone}, atas jalan tanpa insurans`);
  } else {
    out.push(`💰 Harga: tanya saya`);
  }
  out.push("");

  if (variants.length) {
    out.push(variants.length > 1 ? `VARIAN & HARGA` : `VARIAN`);
    for (const v of variants) {
      const spec = variantSpec(v);
      const price = hasPrice(v) ? rmBM(v.price) : "tanya harga";
      out.push(`• ${v.variant}: ${price}${spec ? ` (${spec})` : ""}`);
    }
    out.push("");

    // Basics + kit every variant has.
    const seats = shared(variants, (v) => v.specs?.seats);
    const boot = shared(variants, (v) => v.specs?.boot_l);
    const airbags = shared(variants, (v) => v.specs?.airbags);
    const warranty = shared(variants, (v) => v.specs?.warranty);
    const basics = [
      seats ? `${seats} tempat duduk` : null,
      boot ? `but ${boot}L` : null,
      airbags ? `${airbags} beg udara` : null,
    ].filter(Boolean).join(" · ");
    const first = itemsOf(variants[0]);
    const common = first.filter((x) => variants.every((v) => itemsOf(v).includes(x))).slice(0, 6);
    if (basics || common.length || warranty) {
      out.push(variants.length > 1 ? `✅ SEMUA VARIAN` : `✅ CIRI UTAMA`);
      if (basics) out.push(`• ${basics}`);
      common.forEach((x) => out.push(`• ${x}`));
      if (warranty) out.push(`• Waranti ${warrantyBM(warranty)}`);
      out.push("");
    }

    // What the top variant adds over the cheapest one.
    if (variants.length > 1) {
      const top = variants[variants.length - 1];
      // What ONLY the top variant has (sunroof, steering assist) leads; kit it
      // shares with the variant below it follows. Else the list is just the
      // first few safety items, and the reasons to pay more fall off the end.
      const below = variants.length > 2 ? itemsOf(variants[variants.length - 2]) : first;
      const extra = itemsOf(top).filter((x) => !first.includes(x))
        .sort((a, b) => below.includes(a) - below.includes(b)).slice(0, 6);
      if (extra.length) {
        out.push(`⭐ ${top.variant} tambah (berbanding ${variants[0].variant})`);
        extra.forEach((x) => out.push(`• ${x}`));
        out.push("");
      }
    }
  }

  // Seller's own colours win; else every colour the catalogue lists.
  const colours = String(listing.colour || "").trim()
    || [...new Set(variants.flatMap((v) => v.specs?.colours || []))].join(", ");
  if (colours) out.push(`🎨 Warna: ${colours}`, "");

  // The seller's "What you offer" box (NewCarForm), word for word.
  const offer = String(listing.description || "").trim();
  if (offer) {
    out.push(`🎁 DARI SAYA`);
    out.push(offer);
    out.push("");
  }

  const place = [listing.city, listing.state].filter(Boolean).join(", ");
  if (place) out.push(`📍 ${place}`);
  out.push(`📞 WhatsApp saya untuk test drive & tempahan`);
  // Same warning every buyer-facing new-car surface carries (payWarning).
  out.push(`⚠️ Bayar deposit hanya ke akaun rasmi ${brand || "jenama"} atau di kaunter showroom, bukan akaun peribadi.`);
  out.push("");

  const tag = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tags = [...new Set([tag(brand), tag(model), tag(brand) + tag(model), "keretabaru"])]
    .filter((x) => x.length > 1).map((x) => `#${x}`);
  out.push(tags.join(" "));
  out.push(LINE);
  if (link) out.push(`👉 ${link}`);
  return out.join("\n");
}
