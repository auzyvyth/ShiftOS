const SESSION_KEY = "xdrive_session_id";

export function getOrCreateSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function getSlugFromURL() {
  return new URLSearchParams(window.location.search).get("ref") || null;
}

/**
 * Fire an analytics event. Always fails silently — analytics must never break a page.
 * Automatically attaches session_id, page_path, referrer, and salesman_slug from URL.
 */
export async function trackEvent(supabase, eventType, payload = {}) {
  try {
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      session_id: getOrCreateSessionId(),
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      salesman_slug: getSlugFromURL(),
      ...payload,
    });
  } catch (e) {
    console.warn("Analytics error:", e);
  }
}
