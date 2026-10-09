/* eslint-env node */
// ANALYTICS-SPOOF: the shape check for one analytics_events row arriving at
// /api/track. Pure (no DB), so tests/analyticsEvent.test.mjs can pin it.
//
// The browser used to INSERT into analytics_events directly, with dealer_id and
// salesman_slug taken on trust. Now the browser posts here, this drops anything
// malformed, and api/track.js overwrites dealer_id from the car itself.

// Same list as the old `analytics_insert_v2` policy. A new event type goes here.
export const EVENT_TYPES = new Set([
  'page_view', 'page_exit', 'car_view', 'store_visit', 'link_visit',
  'whatsapp_click', 'call_click', 'booking_click', 'share', 'enquiry',
  'listing_view', 'card_click', 'minipage_view', 'minipage_card_click',
  'pwa_installed', 'landing_page_view', 'landing_page_exit',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const MAX_METADATA_BYTES = 2000;

const uuidOrNull = (v) => (typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : null);
const textOrNull = (v, max) => (typeof v === 'string' && v.length ? v.slice(0, max) : null);

// Returns a clean row, or null when the event must be dropped.
export function cleanEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!EVENT_TYPES.has(body.event_type)) return null;
  const session_id = uuidOrNull(body.session_id);
  if (!session_id) return null;

  let metadata = null;
  if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
    const s = JSON.stringify(body.metadata);
    if (s.length <= MAX_METADATA_BYTES) metadata = JSON.parse(s);
  }

  const t = Number(body.time_spent);
  const page = textOrNull(body.page_path, 300);

  return {
    event_type: body.event_type,
    session_id,
    salesman_slug: typeof body.salesman_slug === 'string' && SLUG.test(body.salesman_slug)
      ? body.salesman_slug : null,
    car_id: uuidOrNull(body.car_id),
    car_name: textOrNull(body.car_name, 120),
    dealer_id: uuidOrNull(body.dealer_id),
    page_path: page && page.startsWith('/') ? page : null,
    referrer: textOrNull(body.referrer, 500),
    time_spent: Number.isInteger(t) && t >= 0 && t <= 86400 ? t : null,
    metadata,
  };
}
