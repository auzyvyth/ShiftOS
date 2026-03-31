import { supabase } from '../supabaseClient';

const SESSION_KEY = 'shiftos_session';
const REF_KEY     = 'shiftos_ref';

function getSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, sid); }
  return sid;
}

export function setRef(slug) {
  if (slug) sessionStorage.setItem(REF_KEY, slug);
}

export function getRef() {
  return sessionStorage.getItem(REF_KEY);
}

/**
 * Track an analytics event. Always includes dealer_id so the RLS policy
 * "dealer_reads_own_events" (dealer_id = auth.uid()) can scope reads correctly.
 *
 * When dealerId is provided (car-context events: car_view, whatsapp_click,
 * call_click) it is used directly.
 *
 * When dealerId is not provided (link_visit — no specific car in view), we
 * resolve it by: slug → salesman profile → dealership name → dealer profile.id
 */
export async function trackEvent(eventType, { carId = null, carName = null, dealerId = null } = {}) {
  const slug = getRef();
  if (!slug) return;

  let resolvedDealerId = dealerId;

  if (!resolvedDealerId) {
    // Resolve dealer_id from the salesman's slug via dealership name match
    const { data: salesman } = await supabase
      .from('profiles')
      .select('dealership')
      .eq('slug', slug)
      .single();

    if (salesman?.dealership) {
      const { data: dealer } = await supabase
        .from('profiles')
        .select('id')
        .eq('dealership', salesman.dealership)
        .eq('role', 'dealer')
        .limit(1)
        .single();
      resolvedDealerId = dealer?.id || null;
    }
  }

  await supabase.from('analytics_events').insert({
    salesman_slug: slug,
    event_type:    eventType,
    car_id:        carId   || null,
    car_name:      carName || null,
    session_id:    getSessionId(),
    dealer_id:     resolvedDealerId,
  });
}
