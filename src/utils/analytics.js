import { getShareChannel } from "./refTracking";
import { hasConsent } from "./consent";
import { shouldSkipTracking } from "./internalTraffic";

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
  // Analytics tier of the cookie consent banner. No-op when the visitor has not
  // granted analytics (necessary/security telemetry doesn't route through here).
  if (!hasConsent("analytics")) return;
  // The owner's own devices and preview deploys (see internalTraffic.js).
  if (shouldSkipTracking()) return;
  try {
    const row = {
      event_type: eventType,
      session_id: getOrCreateSessionId(),
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      salesman_slug: getSlugFromURL(),
      ...payload,
    };
    // Stamp the share channel (?src= captured on landing) into metadata so the
    // analytics dashboard can break clicks down by platform.
    const channel = getShareChannel();
    if (channel) row.metadata = { ...(row.metadata || {}), channel };
    await supabase.from("analytics_events").insert(row);
  } catch (e) {
    console.warn("Analytics error:", e);
  }
}

/**
 * Track a page visit with time-on-page.
 * Fires `${eventType}` immediately (default "page_view"); fires the matching
 * exit event (eventType with "_view" swapped for "_exit") with time_spent on
 * cleanup. Returns a cleanup function — call it on component unmount.
 *
 * eventType lets non-marketplace callers (e.g. landing_page_view for the
 * /shiftos and /for-salesmen marketing pages) avoid polluting marketplace-
 * scoped stats that filter on the plain page_view/page_exit types.
 */
export function trackPageView(supabase, overridePath, eventType = "page_view") {
  const start = Date.now();
  const path = overridePath || window.location.pathname;
  const exitType = eventType.replace(/_view$/, "_exit");

  trackEvent(supabase, eventType, {
    page_path: path,
    dealer_id: null,
  });

  let fired = false;
  function fireExit() {
    if (fired) return;
    fired = true;
    const secs = Math.round((Date.now() - start) / 1000);
    if (secs < 1) return; // ignore React StrictMode double-invoke in dev
    trackEvent(supabase, exitType, {
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
