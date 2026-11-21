// MET-1: what a buyer searched, kept safe to store. Pure; `npm run test:searchtrack`.
// The text is a car search ("myvi", "alphard 2019"), but a box can hold anything
// a person pastes, so a number-like run (phone, IC) is never stored, and the
// text is cut short. The filters are recorded by NAME, never by value.
export function cleanSearchText(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
  if (!s) return null;
  if (/\d[\d\s-]{6,}\d/.test(s)) return null;      // 7+ digits in a row = phone / IC
  if (/@/.test(s) || /https?:|www\./.test(s)) return null; // email / link
  return s;
}

// { brand: 'honda', q: '', state: 'selangor' } -> ['brand', 'state']
export function activeFilterKeys(filters) {
  return Object.entries(filters || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false)
    .map(([k]) => k)
    .sort();
}

// One event per DISTINCT search per session: the same params twice (a refetch,
// React StrictMode, going back) is one search, not two.
export function searchKey(surface, filters, sort) {
  return `${surface}|${sort || ''}|${JSON.stringify(Object.entries(filters || {}).filter(([, v]) => v).sort())}`;
}

// Dealer's "what buyers searched on your site": search_run rows -> totals and the
// most common asks. A search with results 0 is a "no match", which is the stock
// the dealer does not have. Label = the typed words, else the filters used.
const FILTER_WORDS = {
  bodyType: 'body type', minPrice: 'min price', maxPrice: 'max price', yearFrom: 'year from', yearTo: 'year to',
  mileageMax: 'max mileage', hotDeals: 'hot deals', fuelType: 'fuel', sellerType: 'seller type', q: 'search',
};
export const filterWord = (k) => FILTER_WORDS[k] || k;
// A stored label may be raw filter names joined by ' + ' (no typed words): show them as words.
export const humanLabel = (label) => String(label || '').split(' + ').map(filterWord).join(' + ');

export function summariseSearches(events) {
  const rows = (events || []).filter((e) => e.event_type === 'search_run');
  const by = new Map();
  let noMatch = 0;
  for (const e of rows) {
    const m = e.metadata || {};
    const label = m.q || (Array.isArray(m.filters) && m.filters.length ? m.filters.map(filterWord).join(' + ') : null);
    const none = Number(m.results) === 0;
    if (none) noMatch += 1;
    if (!label) continue;
    const cur = by.get(label) || { label, count: 0, noMatch: 0 };
    cur.count += 1;
    if (none) cur.noMatch += 1;
    by.set(label, cur);
  }
  const top = [...by.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 5);
  return { total: rows.length, noMatch, top };
}
