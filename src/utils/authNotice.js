// Why we signed someone out, carried across the sign-out to the login page.
//
// The idle logout used to end with `window.location.href = '/login?timeout=1'`,
// fired from ANY page. So a seller who had been away three days, tapped a
// /compare link someone sent them, and landed on a public marketplace page was
// yanked off it to a login screen that said nothing at all — the link they
// clicked was gone and there was no explanation. That happened to a real user.
//
// The rule now: signing out is silent and never navigates. The reason is parked
// here, and only the login page — reached when the person chooses to sign in,
// or when a page that genuinely needs a session sends them — reads it out.

const KEY = "shiftos_logout_notice";

/** Record why we signed the user out. Reason is a short stable key. */
export function setLogoutNotice(reason, extra = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ reason, at: Date.now(), ...extra }));
  } catch { /* private mode — the notice is a nicety, never a blocker */ }
}

/**
 * Read the notice without consuming it. Returns null when there is none, or
 * when it is older than a day — a month-old "you were signed out" banner is
 * noise, and by then the person has signed in and out several times.
 */
export function readLogoutNotice() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const notice = JSON.parse(raw);
    if (!notice?.reason) return null;
    if (Date.now() - (notice.at || 0) > 24 * 60 * 60 * 1000) {
      clearLogoutNotice();
      return null;
    }
    return notice;
  } catch {
    return null;
  }
}

export function clearLogoutNotice() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Whole days between then and now, floored, never below 1. */
export function daysSince(ts) {
  if (!ts) return null;
  return Math.max(1, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

// Paths that cannot render without a session. An idle sign-out that happens
// while someone is STANDING on one of these has to reload so the page's own
// guard runs — otherwise the panel keeps showing a dead session's data and
// every write fails silently. Everything else (the marketplace, a car page,
// /compare, an article) renders perfectly well logged out and is left alone.
const SESSION_REQUIRED_PREFIXES = [
  "/dashboard", "/salesman", "/salesman-lite", "/salesman-premium",
  "/admin", "/platform", "/manager", "/accountant", "/fi",
  "/onboarding", "/dealer-onboarding", "/salesman-onboarding",
];

export function pathNeedsSession(pathname) {
  const p = (pathname || "").toLowerCase();
  return SESSION_REQUIRED_PREFIXES.some((pre) => p === pre || p.startsWith(pre + "/"));
}
