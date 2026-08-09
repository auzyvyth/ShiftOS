// Tiered cookie/consent state, stored first-party (localStorage) — no third-party
// cookies are used anywhere. Categories:
//   - necessary   : always on (auth session, Turnstile/security, load). Not gated.
//   - analytics   : trackEvent -> analytics_events (car_view, whatsapp_click, ...).
//   - preferences : "remember my details" prefill on the WhatsApp/enquiry popups.
//
// Model: opt-OUT. Until the visitor decides, analytics + preferences are treated
// as granted so the dealer's metrics and the prefill convenience keep working; an
// explicit "Reject non-essential" (or unticking a category) turns them off. To
// switch to strict opt-IN (both off until "Accept all"), flip DEFAULT_GRANTED.

const KEY = 'xdrive_cookie_consent';
const DETAILS_KEY = 'xdrive_buyer_details';
const VERSION = 1;
const DEFAULT_GRANTED = true; // opt-out default; set false for strict opt-in

const CHANGE_EVENT = 'xdrive-consent-change';
const OPEN_EVENT = 'xdrive-consent-open';

function safeLocal() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; }
  catch { return null; }
}

// { decided, analytics, preferences }
export function getConsent() {
  const ls = safeLocal();
  try {
    const raw = ls && JSON.parse(ls.getItem(KEY) || 'null');
    if (!raw || raw.v !== VERSION) {
      return { decided: false, analytics: DEFAULT_GRANTED, preferences: DEFAULT_GRANTED };
    }
    return { decided: true, analytics: !!raw.analytics, preferences: !!raw.preferences };
  } catch {
    return { decided: false, analytics: DEFAULT_GRANTED, preferences: DEFAULT_GRANTED };
  }
}

export function setConsent({ analytics, preferences }) {
  const ls = safeLocal();
  try {
    ls && ls.setItem(KEY, JSON.stringify({
      v: VERSION, analytics: !!analytics, preferences: !!preferences, ts: Date.now(),
    }));
  } catch { /* private mode / quota — non-fatal */ }
  // If preferences was withdrawn, drop any remembered buyer details.
  if (!preferences) clearBuyerDetails();
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* ignore */ }
}

export function hasConsent(category) {
  if (category === 'necessary') return true;
  const c = getConsent();
  return !!c[category];
}

// Fired by a "Cookie settings" link to re-open the banner after a decision.
export function openConsentSettings() {
  try { window.dispatchEvent(new Event(OPEN_EVENT)); } catch { /* ignore */ }
}

export const CONSENT_CHANGE_EVENT = CHANGE_EVENT;
export const CONSENT_OPEN_EVENT = OPEN_EVENT;

// ── Remember-my-details (preferences tier) ──────────────────────────────────
// First-party only, on the visitor's own device. No-ops without preferences
// consent, so nothing is stored or read back when a buyer opts out.
export function saveBuyerDetails(details) {
  if (!hasConsent('preferences')) return;
  const ls = safeLocal();
  const clean = {
    name: (details?.name || '').toString().slice(0, 100),
    phone: (details?.phone || '').toString().slice(0, 30),
    state: (details?.state || '').toString().slice(0, 40),
  };
  if (!clean.name && !clean.phone && !clean.state) return;
  try { ls && ls.setItem(DETAILS_KEY, JSON.stringify(clean)); } catch { /* ignore */ }
}

export function loadBuyerDetails() {
  if (!hasConsent('preferences')) return null;
  const ls = safeLocal();
  try {
    const raw = ls && JSON.parse(ls.getItem(DETAILS_KEY) || 'null');
    if (!raw) return null;
    return { name: raw.name || '', phone: raw.phone || '', state: raw.state || '' };
  } catch { return null; }
}

export function clearBuyerDetails() {
  const ls = safeLocal();
  try { ls && ls.removeItem(DETAILS_KEY); } catch { /* ignore */ }
}
