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

/**
 * Track a marketplace page visit with time-on-page.
 * Fires page_view immediately; fires page_exit with time_spent on cleanup.
 * Returns a cleanup function — call it on component unmount.
 */
export function trackPageView(supabase, overridePath) {
  const start = Date.now();
  const path = overridePath || window.location.pathname;

  trackEvent(supabase, "page_view", {
    page_path: path,
    dealer_id: null,
  });

  let fired = false;
  function fireExit() {
    if (fired) return;
    fired = true;
    const secs = Math.round((Date.now() - start) / 1000);
    if (secs < 1) return; // ignore React StrictMode double-invoke in dev
    trackEvent(supabase, "page_exit", {
      page_path: path,
      dealer_id: null,
      time_spent: secs,
    });
  }

  window.addEventListener("beforeunload", fireExit, { once: true });
  return () => {
    window.removeEventListener("beforeunload", fireExit);
    fireExit();
  };
}
