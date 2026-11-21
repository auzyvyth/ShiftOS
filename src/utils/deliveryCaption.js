// Delivery photos on a dealer's own site (STOREFRONT-2 stage 4 phase C, "Happy customers").
// ONE set of rules for the words under a photo, shared by the dashboard upload panel
// (dashboard/storefront/DeliveryPhotos.jsx) and the site section (sections/Deliveries.jsx).
// The database repeats them in migration 20261121b (CHECKs on storefront_deliveries);
// `npm run test:deliverycaption` checks both say the same.
//
// Why so strict (PDPA 2010, checked 2026-11-21): a photo of a buyer is their personal data.
// The site shows the CAR and the MONTH only. No buyer name, phone number or plate is ever
// stored or shown, so the words can never identify the buyer further than the photo does.
// A run of 7+ digits (spaces, dashes, dots, brackets and + ignored) is refused: that is how a
// phone number or an IC number gets typed. Names and plates cannot be detected reliably, so
// the panel asks the dealer not to type them.

export const CAPTION_MAX = 60;
export const CAR_NAME_MAX = 80;
export const DELIVERY_CAP = 60; // photos per dealer (the SQL trigger says the same)
export const SITE_SHOWS = 24;   // newest shown on the site (get_dealer_deliveries limit)

// The same characters the SQL strips before looking for a digit run.
const SEPARATORS = /[\s\-.+()]/g;
export const hasNumberRun = (s) => /[0-9]{7,}/.test(String(s || "").replace(SEPARATORS, ""));

// Trim, fold whitespace, cut to the cap. Never adds or invents anything.
export function cleanText(s, max) {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
export const cleanCaption = (s) => cleanText(s, CAPTION_MAX);
export const cleanCarName = (s) => cleanText(s, CAR_NAME_MAX);

// What is wrong with a caption or car name, in words for the dealer, or "" when fine.
export function textProblem(s, { max = CAPTION_MAX, required = false } = {}) {
  const v = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!v) return required ? "Type the car, for example Honda City 1.5 V." : "";
  if (v.length > max) return `Keep it to ${max} characters.`;
  if (hasNumberRun(v)) return "Take out the long number. No phone, IC or other numbers here.";
  return "";
}

// "2026-11" (a month input) or a date -> "2026-11-01", the first of the month. Null when it is
// not a real month, in the future, or before 2000 (the SQL CHECK refuses the same).
export function monthValue(v, now = new Date()) {
  const m = /^(\d{4})-(\d{2})/.exec(String(v || ""));
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  if (mo < 1 || mo > 12 || y < 2000) return null;
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  if (y * 12 + (mo - 1) > nowKey) return null;
  return `${m[1]}-${m[2]}-01`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-01" -> "Nov 2026". Empty when it cannot be read.
export function monthLabel(d) {
  const m = /^(\d{4})-(\d{2})/.exec(String(d || ""));
  if (!m || +m[2] < 1 || +m[2] > 12) return "";
  return `${MONTHS[+m[2] - 1]} ${m[1]}`;
}

// Rows from get_dealer_deliveries -> what the site draws. Drops anything without a photo and
// re-applies the rules, so a bad row can never print a number on the page.
export function deliveryCards(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.photo_url === "string" && /^https:\/\//.test(r.photo_url))
    .slice(0, SITE_SHOWS)
    .map((r) => {
      const name = cleanCarName(r.car_name);
      const caption = cleanCaption(r.caption);
      return {
        photo: r.photo_url,
        name: hasNumberRun(name) ? "" : name,
        caption: hasNumberRun(caption) ? "" : caption,
        when: monthLabel(r.delivered_month),
      };
    });
}

// Where an upload goes in the car-images bucket. The storage policies in 20261121b allow
// exactly deliveries/<dealer_id>/..., and the table CHECK requires the URL to point there.
export const deliveryFolder = (dealerId) => `deliveries/${dealerId}`;
// The storage path back from a public URL (for deleting the file with the row).
export function deliveryPathOf(url, dealerId) {
  const key = `/car-images/${deliveryFolder(dealerId)}/`;
  const i = String(url || "").indexOf(key);
  return i < 0 ? null : decodeURIComponent(String(url).slice(i + "/car-images/".length).split("?")[0]);
}
