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
export const SITE_SECTIONS = ['promos', 'models', 'cars', 'calculator', 'delivery'];
export const SECTION_LABEL = {
  promos: 'Promos of the month',
  models: 'Pick a model',
  cars: 'Cars for sale',
  calculator: 'Instalment calculator',
  delivery: 'Delivery to your town',
};
// Sections whose switch means something to the seller (cars + calculator hide on their own when empty).
export const PROMO_MAX = 12;
export const DELIVERY_MAX = 12;
export const MODEL_MAX = 40;
export const TEXT_MAX = 80;
export const TOWN_MAX = 40;
export const PRICE_MAX = 2000000;
export const KM_MAX = 3000;
export const MIN_MAX = 2880;
export const PROMO_DAYS_MAX = 120; // an end date further out than this is refused

const SEP = /[\s\-.+()]/g;
export const hasNumberRun = (s) => /[0-9]{7,}/.test(String(s || '').replace(SEP, ''));
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Today in Malaysia, as YYYY-MM-DD (the end date is a Malaysian calendar day).
export const myToday = (now = new Date()) => malaysiaDate(now);

export const EMPTY_SITE = { v: SITE_VERSION, order: [...SITE_SECTIONS], off: [], promos: [], delivery: { base: '', items: [] } };

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
  return { v: SITE_VERSION, order, off, promos, delivery: { base: clean(d.base, TOWN_MAX), items } };
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
