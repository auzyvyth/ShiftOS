// Trade-in enquiry on a dealer's own site (STOREFRONT-1, 2026-11-20).
// ONE set of rules for the form (TradeInSheet.jsx) and the server (api/enquiry.js),
// so the browser and the server never disagree on what is a valid trade-in or on
// the words the dealer reads. Plain data, no imports: api/ runs it too.
//
// Never a price, valuation or offer in any of these words: the dealer has not
// seen the car (same rule as the AI drafts: no invented numbers).

export const TRADE_IN_MIN_YEAR = 1980;
export const TRADE_IN_MAX_KM = 2000000;
const TEXT_MAX = 40;

const clean = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

// Returns { ok, car, errors }. `car` is the cleaned trade-in; errors keyed by field.
export function checkTradeIn(input, now = new Date()) {
  const maxYear = now.getFullYear() + 1;
  const brand = clean(input?.brand).slice(0, TEXT_MAX);
  const model = clean(input?.model).slice(0, TEXT_MAX);
  const year = Number(input?.year);
  const kmRaw = String(input?.mileage ?? "").replace(/[^\d]/g, "");
  const mileage = kmRaw === "" ? null : Number(kmRaw);
  const errors = {};
  if (!brand) errors.brand = "Which brand is it?";
  if (!model) errors.model = "Which model is it?";
  if (!Number.isInteger(year) || year < TRADE_IN_MIN_YEAR || year > maxYear) errors.year = "Pick the year";
  if (mileage !== null && (!Number.isFinite(mileage) || mileage > TRADE_IN_MAX_KM)) errors.mileage = "Check the mileage";
  return { ok: Object.keys(errors).length === 0, car: { brand, model, year, mileage }, errors };
}

const km = (n) => `${Number(n).toLocaleString("en-MY")} km`;

// The line saved on the dealer's pipeline lead (becomes the lead's note).
export function tradeInNote(car) {
  const name = [car.year, car.brand, car.model].filter(Boolean).join(" ");
  return `Trade-in: ${name}${car.mileage != null ? `, about ${km(car.mileage)}` : ""}`;
}

// The WhatsApp text the buyer sends to the dealer.
export function tradeInWhatsApp(car, siteName) {
  const name = [car.year, car.brand, car.model].filter(Boolean).join(" ");
  const hi = siteName ? `Hi ${siteName}` : "Hi";
  const kmLine = car.mileage != null ? `, about ${km(car.mileage)}` : "";
  return `${hi}, I'd like to trade in my ${name}${kmLine}. Can you let me know what you could offer?`;
}
