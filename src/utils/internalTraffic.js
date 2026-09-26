/*
 * Keeps the owner's own browsing out of analytics_events.
 *
 * Sessions are per TAB (sessionStorage), so one person testing a page shows up
 * as a new "visitor" every time they open it. We cannot filter by IP from the
 * browser (and a phone's IP changes every few minutes anyway), so we mark the
 * DEVICE instead: a localStorage flag that survives logout, new tabs and days.
 *
 * A device becomes internal when:
 *   - any seller / staff / superadmin account signs in on it
 *     (useInternalDeviceMark in App.jsx, and AdminPage for the console), or
 *   - someone opens any page with ?internal=1 (for browsers you never log in
 *     on, e.g. the Instagram in-app browser behind your bio link).
 * ?internal=0 clears it. Buyers and anonymous guests are never marked.
 *
 * Preview deploys and localhost are never tracked at all.
 */
const KEY = 'xdrive_internal';

function readUrlToggle() {
  try {
    const v = new URLSearchParams(window.location.search).get('internal');
    if (v === '1') localStorage.setItem(KEY, '1');
    else if (v === '0') localStorage.removeItem(KEY);
  } catch { /* storage blocked: fall through */ }
}

export function markInternalDevice() {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
}

export function isInternalDevice() {
  try {
    readUrlToggle();
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function isNonProdHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app');
}

/** True when this page view must not be written to analytics_events. */
export function shouldSkipTracking() {
  return isNonProdHost() || isInternalDevice();
}
