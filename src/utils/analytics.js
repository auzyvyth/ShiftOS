import { getRef } from './refTracking';

const SESSION_KEY = "xdrive_session_id";

export function getOrCreateSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * Fire an analytics event. Always fails silently — analytics must never break a page.
 * Automatically attaches session_id, page_path, referrer, and salesman_slug from sessionStorage
 * (persists across navigation within a session, even if ?ref= is no longer in the URL).
 */
export async function trackEvent(supabase, eventType, payload = {}) {
  try {
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      session_id: getOrCreateSessionId(),
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      salesman_slug: getRef(),
      ...payload,
    });
  } catch (e) {
    console.warn("Analytics error:", e);
  }
}
