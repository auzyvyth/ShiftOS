// NEWCAR-1: shared wording + helpers for new-car advisors (Proton / Perodua / Toyota / BYD / Honda).
//
// The price itself is never worked out here. The zone (Peninsular, Sabah/Sarawak,
// Labuan, Langkawi) and the zone price come from the DB (new_car_price_zone /
// new_car_zone_price), so the console, settings, mini page and model page can
// never disagree about which number a buyer sees. A null price means "not entered
// for this zone" and must render as "ask", never as the Peninsular number.

export const NEW_CAR_BRANDS = ["Proton", "Perodua", "Toyota", "BYD", "Honda"];

export const PRICE_ZONES = [
  { key: "peninsular",    col: "price_peninsular",    label: "Peninsular" },
  { key: "sabah_sarawak", col: "price_sabah_sarawak", label: "Sabah / Sarawak" },
  { key: "labuan",        col: "price_labuan",        label: "Labuan" },
  { key: "langkawi",      col: "price_langkawi",      label: "Langkawi" },
];

// The price zone a buyer's STATE falls in. Mirrors new_car_price_zone() for the
// state half only: Langkawi is a city in Kedah, so a state alone can never say
// "langkawi" (the model page's zone buttons cover that case).
export function zoneForState(state) {
  if (state === "Sabah" || state === "Sarawak") return "sabah_sarawak";
  if (state === "Labuan") return "labuan";
  return "peninsular";
}

// Live model cards (public_car_listings rows with is_model_card) grouped for the
// marketplace hero's New picker: [{ brand, models: [{ model, from, photo }] }], brands in
// NEW_CAR_BRANDS order, models cheapest first. Only brands with a live card
// appear, so the picker never offers a brand that opens an empty page.
export function liveNewCarBrands(rows) {
  const byBrand = new Map();
  for (const r of rows || []) {
    const brand = NEW_CAR_BRANDS.find((b) => b.toLowerCase() === String(r.brand || "").toLowerCase());
    if (!brand || !r.model) continue;
    if (!byBrand.has(brand)) byBrand.set(brand, new Map());
    const models = byBrand.get(brand);
    const p = Number(r.selling_price) > 0 ? Number(r.selling_price) : null;
    const photo = Array.isArray(r.images) ? r.images[0] || null : null;
    const prev = models.get(r.model);
    if (!prev) models.set(r.model, { model: r.model, from: p, photo });
    else {
      if (p && (!prev.from || p < prev.from)) prev.from = p;
      if (!prev.photo && photo) prev.photo = photo;
    }
  }
  return NEW_CAR_BRANDS.filter((b) => byBrand.has(b)).map((brand) => ({
    brand,
    models: [...byBrand.get(brand).values()].sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity)),
  }));
}

// The buyer's state, remembered on the device (a per-viewer convenience; the
// model page sorts advisors by it). Never sent anywhere.
const BUYER_STATE_KEY = "xd_buyer_state";
export function readBuyerState(valid) {
  try { const s = localStorage.getItem(BUYER_STATE_KEY); return valid.includes(s) ? s : ""; } catch { return ""; }
}
export function saveBuyerState(state) {
  try { if (state) localStorage.setItem(BUYER_STATE_KEY, state); else localStorage.removeItem(BUYER_STATE_KEY); } catch { /* private mode */ }
}

export function zoneLabel(key) {
  return PRICE_ZONES.find((z) => z.key === key)?.label || "Peninsular";
}

export function rm(n) {
  if (n == null || n === "") return null;
  return "RM " + Number(n).toLocaleString("en-MY", { maximumFractionDigits: 0 });
}

export function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// Brands publish on-the-road prices without insurance; every surface that shows
// a catalogue price carries this line so nobody reads it as a final quote.
export function priceBasis(zoneKey, effectiveFrom) {
  const when = effectiveFrom ? `, from ${fmtDate(effectiveFrom)}` : "";
  return `Official price for ${zoneLabel(zoneKey)}, on the road without insurance${when}.`;
}

// Perodua has publicly warned about scammers posing as sales advisors and
// asking for booking fees into personal accounts. Every buyer-facing new-car
// surface carries this line.
export function payWarning(brand) {
  return `Pay a booking fee or deposit only into ${brand || "the brand"}'s official company account or at the showroom counter, never to an advisor's personal account.`;
}

export function isHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || ""));
}

// Rows in, [{ model, variants: [...] }] out, keeping the order the RPC returned.
export function groupByModel(rows) {
  const out = [];
  const idx = new Map();
  for (const r of rows || []) {
    if (!idx.has(r.model)) { idx.set(r.model, out.length); out.push({ model: r.model, variants: [] }); }
    out[idx.get(r.model)].variants.push(r);
  }
  return out;
}

export function slugPart(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The public "pick the model, pick an advisor" page.
export function newModelPath(brand, model) {
  return `/new-cars/${slugPart(brand)}/${slugPart(model)}`;
}

export function brandFromSlug(s) {
  return NEW_CAR_BRANDS.find((b) => slugPart(b) === String(s || "").toLowerCase()) || null;
}

// The rows of one model, from all of a brand's new_car_models rows.
export function modelRows(rows, modelSlug) {
  return (rows || []).filter((r) => r.is_active !== false && slugPart(r.model) === String(modelSlug || "").toLowerCase());
}

// Copy for /new-cars/:brand/:model. Shared by the SPA page and api/og.js, and
// it may only quote numbers that are in the rows (no invented "from" prices).
export function newModelCopy(brand, model, rows) {
  const pen = (rows || []).map((r) => Number(r.price_peninsular)).filter((n) => n > 0);
  const from = pen.length ? Math.min(...pen) : null;
  const n = (rows || []).length;
  const name = `${brand} ${model}`;
  const priceLine = from ? `from ${rm(from)} in Peninsular Malaysia, on the road without insurance` : "official prices by region";
  return {
    title: `New ${name} price in Malaysia | Drevo`,
    h1: `New ${name}`,
    description: `${n} ${n === 1 ? "variant" : "variants"}, ${priceLine}. The official price is set by the brand, so compare the advisors and message one directly.`,
    intro: `${brand} sets the official price, and it is the same in every showroom in your region. What differs is the advisor: how fast they reply, where they are and what they can arrange for you. Compare them below and message one directly.`,
  };
}

// One short spec line from new_car_models.specs, e.g. "1.5L turbo · 181 PS ·
// 7 seats" or "60.22 kWh · 410 km range". Display only.
export function newCarSpecLine(specs) {
  const s = specs || {};
  return [
    s.engine,
    s.battery_kwh ? `${s.battery_kwh} kWh` : null,
    s.range_km ? `${s.range_km} km range` : s.ev_range_km ? `${s.ev_range_km} km EV range` : null,
    s.power_ps ? `${s.power_ps} PS` : null,
    s.seats && s.seats !== 5 ? `${s.seats} seats` : null,
  ].filter(Boolean).join(" · ");
}

// ── Model page helpers (NEWCAR-PAGE, owner 2026-11-22: "robotic and empty") ──
// Every figure comes from new_car_models.specs (checked per batch); nothing is invented.

// A paint name -> a swatch colour for the dot. Unknown names get a neutral grey and
// still show their name, so a new paint never breaks the picker.
const SWATCHES = [
  [/white|putih|pearl/i, "#f4f4f2"], [/black|hitam|onyx|midnight/i, "#17181b"],
  [/silver|perak/i, "#b8bcc2"], [/grey|gray|kelabu|gunmetal|graphite|titanium/i, "#6b7076"],
  [/red|merah|ruby|maroon|crimson/i, "#9b1c24"], [/blue|biru|marine|navy|sapphire/i, "#1e3a5f"],
  [/green|hijau|olive/i, "#3f5b45"], [/brown|bronze|beige|coklat|gold/i, "#8a6a48"],
  [/orange|oren|yellow|kuning/i, "#d9822b"], [/purple|ungu/i, "#5b3f7a"],
];
export function colourSwatch(name) {
  const hit = SWATCHES.find(([re]) => re.test(String(name || "")));
  return hit ? hit[1] : "#a3a3a3";
}

// "5 years / 150,000 km" -> "5 yrs". null when it does not start with a year count.
export function warrantyShort(w) {
  const m = String(w || "").match(/(\d+)\s*(years?|yrs?|tahun)/i);
  return m ? `${m[1]} yrs` : null;
}

// Up to four quick facts for the top of the model page: [{ value, label }].
export function modelFacts(specs) {
  const s = specs || {};
  const out = [];
  if (s.power_ps) out.push({ value: `${s.power_ps} PS`, label: s.engine ? `${engineLabel(s.engine)} engine` : "power" });
  else if (s.engine) out.push({ value: s.engine, label: "engine" });
  if (s.range_km || s.ev_range_km) out.push({ value: `${s.range_km || s.ev_range_km} km`, label: s.range_km ? "range" : "EV range" });
  if (s.seats) out.push({ value: String(s.seats), label: "seats" });
  if (s.boot_l) out.push({ value: `${s.boot_l} L`, label: "boot" });
  const w = warrantyShort(s.warranty);
  if (w) out.push({ value: w, label: "warranty" });
  return out.slice(0, 4);
}

// "1.5L NA" -> "1.5L" ("NA" = naturally aspirated, jargon to a buyer); "1.5L turbo" stays.
export const engineLabel = (e) => String(e || "").replace(/\s+NA$/i, "").trim();

// One plain sentence about the model, from its specs only.
export function modelLead(specs, fromPrice) {
  const s = specs || {};
  const w = warrantyShort(s.warranty);
  const bits = [
    s.engine ? `a ${engineLabel(s.engine)} engine` : null,
    s.seats ? `${s.seats} seats` : null,
    s.boot_l ? `a ${s.boot_l} L boot` : null,
    w ? `a ${w.replace(" yrs", "-year")} warranty` : null,
  ].filter(Boolean);
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
  const text = list ? `${list[0].toUpperCase()}${list.slice(1)}.` : "";
  return [text, fromPrice ? `From ${rm(fromPrice)}.` : ""].filter(Boolean).join(" ");
}
