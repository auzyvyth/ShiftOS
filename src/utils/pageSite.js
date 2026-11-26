// The Premium page's own sections (PAGE-SITE 2, owner 2026-11-25: "a face people
// trust"): promos of the month, delivery towns, and the order the seller wants
// their page in. ONE rules file, shared by the Settings editor
// (premium/PageSiteCard.jsx) and the public page (agent/site/*). The database
// repeats the limits in `_page_site_ok` (migration 20261125b);
// `npm run test:pagesite` checks the JS side.
//
// Everything here is the SELLER'S OWN CLAIM, typed by them:
//  - a promo MUST carry an end date and hides itself after it (a promo with no
//    end is how a stale offer stays on a public page for months);
//  - a promo price is "set by the seller", never a Drevo price;
//  - delivery km / minutes are the seller's estimate and are labelled so.
// No phone number can be typed into any field (CDP-3): a run of 7+ digits is refused.

import { malaysiaDate } from './myDay.js';

export const SITE_VERSION = 1;
export const SITE_SECTIONS = ['models', 'cars', 'promos', 'delivery', 'calculator', 'handover', 'steps', 'book', 'faq'];
// How much of the row a section takes on a wide screen (owner, 2026-11-25: "everything is too
// wide"): a half section sits beside the next half one; a full one has its own row.
export const SECTION_SPAN = { models: 'full', cars: 'full', promos: 'half', delivery: 'half', calculator: 'full', handover: 'full', steps: 'full', book: 'full', faq: 'half' };
export const SECTION_LABEL = {
  promos: 'Promos of the month',
  models: 'Pick a model',
  cars: 'Cars for sale',
  calculator: 'Instalment calculator',
  delivery: 'Delivery to your town',
  handover: 'Handover day + photos',
  steps: 'How buying works',
  book: 'Book a visit',
  faq: 'Questions buyers ask',
};
// Sections whose switch means something to the seller (cars + calculator hide on their own when empty).
// The page background is NOT the seller's pick any more (owner, 2026-11-26: the black look of the
// reference he sent; a seller-chosen colour fights black-and-white). page_site.ground is ignored.

export const PROMO_MAX = 12;
export const DELIVERY_MAX = 12;
export const MODEL_MAX = 40;
export const NOTE_MAX = 160;   // the seller's own line about a model
export const NOTES_MAX = 12;
export const TEXT_MAX = 80;
export const TOWN_MAX = 40;
export const PRICE_MAX = 2000000;
export const KM_MAX = 3000;
export const MIN_MAX = 2880;
export const PROMO_DAYS_MAX = 120; // an end date further out than this is refused
// PAGE-SITE 3 (owner, 2026-11-26, after a Proton advisor's site): handover checklist, buying steps,
// FAQ, labelled rankings, best sellers, booking time slots. All the seller's own words.
export const LIST_MAX = 8;        // handover lines, buying steps
export const LINE_T_MAX = 60;     // a line's title
export const LINE_D_MAX = 200;    // a line's explanation
export const FAQ_MAX = 10;
export const FAQ_Q_MAX = 120;
export const FAQ_A_MAX = 500;
export const RANK_MAX = 6;
export const RANK_TITLE_MAX = 60;
export const BEST_MAX = 80;
export const SLOT_MAX = 8;
export const DEFAULT_SLOTS = ['10:00', '11:30', '14:00', '15:30', '17:00'];
// Starters the editor offers (the seller adds, edits or deletes them; nothing shows until saved).
export const HANDOVER_STARTERS = [
  { t: 'We check the car together', d: 'Body, paint, tyres and papers, before the keys are yours.' },
  { t: 'Every feature, one by one', d: 'Infotainment, drive modes and the safety features.' },
  { t: 'Your phone connected', d: 'Apple CarPlay or Android Auto, where the car has it.' },
  { t: 'Service and warranty', d: 'When the first service is due and what the warranty covers.' },
  { t: 'A handover photo', d: 'For you to keep and share with family.' },
];
export const STEP_STARTERS = [
  { t: 'Test drive', d: 'Try the car at the showroom, or ask if I can bring it to you.' },
  { t: 'Price and quote', d: 'The full price, what is included and the monthly, in writing.' },
  { t: 'Loan application', d: 'I send your documents to the bank. The bank decides.' },
  { t: 'Trade-in', d: 'Bring your current car; I get you a valuation.' },
  { t: 'Booking', d: 'Booking fee and the car is held for you.' },
  { t: 'Insurance and registration', d: 'Insurance, road tax and the number plate, done for you.' },
  { t: 'Handover', d: 'Checked together, explained, keys handed over.' },
];

const SEP = /[\s\-.+()]/g;
export const hasNumberRun = (s) => /[0-9]{7,}/.test(String(s || '').replace(SEP, ''));
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Today in Malaysia, as YYYY-MM-DD (the end date is a Malaysian calendar day).
export const myToday = (now = new Date()) => malaysiaDate(now);

export const EMPTY_SITE = { v: SITE_VERSION, order: [...SITE_SECTIONS], off: [], promos: [], notes: [], delivery: { base: '', items: [] },
  handover: [], steps: [], faq: [], ranks: [], rankTitle: '', best: '', slots: [] };

// Any saved value -> a valid full site. Never throws, never invents: bad rows are dropped.
export function cleanSite(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const order = [];
  for (const id of Array.isArray(r.order) ? r.order : []) if (SITE_SECTIONS.includes(id) && !order.includes(id)) order.push(id);
  for (const id of SITE_SECTIONS) if (!order.includes(id)) order.push(id); // a new section appears, never vanishes
  const off = (Array.isArray(r.off) ? r.off : []).filter((id, i, a) => SITE_SECTIONS.includes(id) && a.indexOf(id) === i);
  const promos = [];
  for (const p of Array.isArray(r.promos) ? r.promos : []) {
    const model = clean(p?.model, MODEL_MAX);
    const text = clean(p?.text, TEXT_MAX);
    const until = isDate(p?.until) ? p.until : '';
    const price = Math.round(Number(p?.price));
    if (!model || !until) continue;
    promos.push({ model, text, until, ...(price > 0 && price <= PRICE_MAX ? { price } : {}) });
    if (promos.length >= PROMO_MAX) break;
  }
  const notes = [];
  for (const x of Array.isArray(r.notes) ? r.notes : []) {
    const model = clean(x?.model, MODEL_MAX);
    const text = clean(x?.text, NOTE_MAX);
    if (!model || !text || notes.some((y) => y.model.toLowerCase() === model.toLowerCase())) continue;
    notes.push({ model, text });
    if (notes.length >= NOTES_MAX) break;
  }
  const d = r.delivery && typeof r.delivery === 'object' ? r.delivery : {};
  const items = [];
  for (const it of Array.isArray(d.items) ? d.items : []) {
    const town = clean(it?.town, TOWN_MAX);
    const km = Math.round(Number(it?.km));
    const min = Math.round(Number(it?.min));
    if (!town || !(km > 0 && km <= KM_MAX)) continue;
    items.push({ town, km, ...(min > 0 && min <= MIN_MAX ? { min } : {}) });
    if (items.length >= DELIVERY_MAX) break;
  }
  const lines = (arr, max) => {
    const out = [];
    for (const x of Array.isArray(arr) ? arr : []) {
      const t = clean(x?.t, LINE_T_MAX);
      const dd = clean(x?.d, LINE_D_MAX);
      if (!t || hasNumberRun(t) || hasNumberRun(dd)) continue;
      out.push(dd ? { t, d: dd } : { t });
      if (out.length >= max) break;
    }
    return out;
  };
  const faq = [];
  for (const x of Array.isArray(r.faq) ? r.faq : []) {
    const q = clean(x?.q, FAQ_Q_MAX);
    const a = clean(x?.a, FAQ_A_MAX);
    if (!q || !a || hasNumberRun(q) || hasNumberRun(a)) continue;
    faq.push({ q, a });
    if (faq.length >= FAQ_MAX) break;
  }
  const ranks = [];
  for (const x of Array.isArray(r.ranks) ? r.ranks : []) {
    const m = /^\d{4}-\d{2}$/.test(String(x?.m || '')) && +String(x.m).slice(5) >= 1 && +String(x.m).slice(5) <= 12 ? x.m : '';
    const n = Math.round(Number(x?.n));
    if (!m || !(n >= 1 && n <= 99) || ranks.some((y) => y.m === m)) continue;
    ranks.push({ m, n });
    if (ranks.length >= RANK_MAX) break;
  }
  ranks.sort((a, b) => a.m.localeCompare(b.m));
  const slots = [];
  for (const t of Array.isArray(r.slots) ? r.slots : []) {
    const v = String(t || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v) || slots.includes(v)) continue;
    slots.push(v);
    if (slots.length >= SLOT_MAX) break;
  }
  slots.sort();
  const rankTitle = clean(r.rankTitle, RANK_TITLE_MAX);
  const best = clean(r.best, BEST_MAX);
  return {
    v: SITE_VERSION, order, off, promos, notes, delivery: { base: clean(d.base, TOWN_MAX), items },
    handover: lines(r.handover, LIST_MAX), steps: lines(r.steps, LIST_MAX), faq, ranks,
    rankTitle: hasNumberRun(rankTitle) ? '' : rankTitle, best: hasNumberRun(best) ? '' : best, slots,
  };
}

export function lineProblem(x) {
  if (!clean(x?.t, LINE_T_MAX)) return 'Type the title.';
  if (hasNumberRun(x?.t) || hasNumberRun(x?.d)) return "Don't type a phone number here.";
  return '';
}
export function faqProblem(x) {
  if (!clean(x?.q, FAQ_Q_MAX)) return 'Type the question.';
  if (!clean(x?.a, FAQ_A_MAX)) return 'Type your answer.';
  if (hasNumberRun(x?.q) || hasNumberRun(x?.a)) return "Don't type a phone number here.";
  return '';
}
export function rankProblem(x, now = new Date()) {
  if (!/^\d{4}-\d{2}$/.test(String(x?.m || ''))) return 'Pick the month.';
  if (String(x.m) > malaysiaDate(now).slice(0, 7)) return 'That month has not happened yet.';
  const n = Number(x?.n);
  if (!(n >= 1 && n <= 99 && Number.isInteger(n))) return 'Rank is a number from 1 to 99.';
  return '';
}
// "Sep" / "Sept 2026" for a rank tile.
export const rankMonth = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
// The booking slots to offer: the seller's, else the defaults.
export const bookSlots = (site) => (site?.slots?.length ? site.slots : DEFAULT_SLOTS);
// "11:30" -> "11:30 am"
export function slotLabel(t) {
  const [h, m] = String(t).split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// What is wrong with one promo row, in words for the seller, or '' when fine.
export function promoProblem(p, today = myToday()) {
  if (!clean(p?.model, MODEL_MAX)) return 'Type the model.';
  if (hasNumberRun(p?.model) || hasNumberRun(p?.text)) return "Don't type a phone number here.";
  if (!isDate(p?.until)) return 'Pick the last day of the promo.';
  if (p.until < today) return 'That date has passed.';
  if (p.until > addDays(today, PROMO_DAYS_MAX)) return `Promos can run ${PROMO_DAYS_MAX} days at most. Add the next one when it renews.`;
  const price = Number(p?.price);
  if (p?.price !== '' && p?.price != null && !(price > 0 && price <= PRICE_MAX)) return 'The price looks wrong.';
  return '';
}
export function noteProblem(x) {
  if (!clean(x?.model, MODEL_MAX)) return 'Pick or type the model.';
  if (!clean(x?.text, NOTE_MAX)) return 'Write your note.';
  if (hasNumberRun(x?.model) || hasNumberRun(x?.text)) return "Don't type a phone number here.";
  return '';
}
export function deliveryProblem(it) {
  if (!clean(it?.town, TOWN_MAX)) return 'Type the town.';
  if (hasNumberRun(it?.town)) return "Don't type a phone number here.";
  const km = Number(it?.km);
  if (!(km > 0 && km <= KM_MAX)) return `Distance is 1 to ${KM_MAX} km.`;
  if (it?.min !== '' && it?.min != null && !(Number(it.min) > 0 && Number(it.min) <= MIN_MAX)) return 'The minutes look wrong.';
  return '';
}

// Promos still running today (the end day counts), soonest end first.
export const activePromos = (site, today = myToday()) =>
  (site?.promos || []).filter((p) => p.until >= today).sort((a, b) => a.until.localeCompare(b.until) || a.model.localeCompare(b.model));

export const daysLeft = (until, today = myToday()) => Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

// "Ends today" / "Ends tomorrow" / "Ends 30 Nov".
export function untilLabel(until, today = myToday()) {
  const n = daysLeft(until, today);
  if (n <= 0) return 'Ends today';
  if (n === 1) return 'Ends tomorrow';
  const d = new Date(`${until}T00:00:00Z`);
  return `Ends ${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
}

// One line the ticker scrolls and the WhatsApp message repeats.
export const promoLine = (p) => [p.model, p.text, p.price ? `from RM ${Math.round(p.price).toLocaleString('en-MY')}` : ''].filter(Boolean).join(' · ');

// "38 km · about 45 min" (the seller's estimate).
export const deliveryLine = (it) => `${it.km} km${it.min ? ` · about ${it.min >= 90 ? `${Math.floor(it.min / 60)} h ${it.min % 60 ? `${it.min % 60} min` : ''}`.trim() : `${it.min} min`}` : ''}`;

// The sections to show, in the seller's order, minus the ones they switched off and the ones with nothing to show.
export function visibleSections(site, has, today = myToday()) {
  const s = cleanSite(site);
  const filled = {
    promos: activePromos(s, today).length > 0,
    models: !!has.models,
    cars: !!has.cars,
    calculator: !!has.calculator,
    delivery: s.delivery.items.length > 0,
    handover: s.handover.length > 0 || !!has.photos,
    steps: s.steps.length > 0,
    book: !!has.book,
    faq: s.faq.length > 0,
  };
  return s.order.filter((id) => !s.off.includes(id) && filled[id]);
}

export function siteErrorText(err) {
  const m = String(err?.message || err || '');
  if (/set_my_page_site|does not exist|PGRST202/.test(m)) return 'Saving your page is not available yet. Try again later.';
  if (/page_site_invalid/.test(m)) return 'Something in your page is not valid. Check the dates and numbers.';
  if (/not_a_seller|not_premium|not_signed_in/.test(m)) return 'Sign in again and retry. These sections are for Premium pages.';
  return "Couldn't save. Check your connection and try again.";
}

// Lay sections out in rows: a full section is a row of its own, half sections go two to a
// row, and a half section with no half neighbour stays alone (the page caps it at half
// the width, so it never stretches). items = [{ id, span: 'full' | 'half', ... }].
export function flowRows(items) {
  const rows = [];
  let open = null;
  for (const it of items || []) {
    if (it.span === 'half') {
      if (open) { open.push(it); rows.push(open); open = null; } else open = [it];
    } else {
      if (open) { rows.push(open); open = null; }
      rows.push([it]);
    }
  }
  if (open) rows.push(open);
  return rows;
}
