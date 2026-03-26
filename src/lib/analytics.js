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

export async function trackEvent(eventType, { carId = null, carName = null } = {}) {
  const slug = getRef();
  if (!slug) return;
  await supabase.from('analytics_events').insert({
    salesman_slug: slug,
    event_type:    eventType,
    car_id:        carId   || null,
    car_name:      carName || null,
    session_id:    getSessionId(),
  });
}
