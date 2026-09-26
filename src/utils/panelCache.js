// Shared localStorage cache rules for the logged-in panels
// (Salesman Lite + Premium, the linked-salesman panel, the dealer dashboard).
//
// Each panel caches its profile + listings/leads/enquiries/appointments so it
// paints instantly on the next visit. Three rules govern what is allowed to sit
// there, and they live here because they were previously a per-file copy: Lite
// had lead redaction and Premium never got it, so the PAID tier was the one
// writing buyer IC numbers to disk.
//
// 1. Redact before writing. localStorage is plaintext, readable by any script
//    on the origin, and has no expiry of its own (the TTL is only
//    checked on READ — the row stays on disk until something overwrites it).
//    Identity documents and home addresses do not go there.
// 2. Purge on logout. Signing out must not leave the previous user's buyer list
//    on a shared or borrowed device.
// 3. Never seed a panel from cache when this device holds no Supabase session
//    (`hasStoredSession` below). The seed runs BEFORE auth resolves — that is
//    the whole point of it — so it is the only thing standing between a
//    signed-out visitor and a painted panel full of the last user's leads.

// How long a cached panel may seed the FIRST FRAME. It is not a freshness
// window: every panel still runs its live fetch behind the seed and overwrites
// it. This was 30 minutes here (dealer + linked-salesman panels) and a 24h
// local copy in Lite/Premium, so an owner opening the app in the morning — the
// normal case — found the cache "expired" and sat through the full cold start,
// which during a slow patch on the database was 15-28 seconds of spinner
// (edge logs, 2026-09-26). Logout still purges everything (rule 2), and the
// idle sign-out is 30 days, so 7 days only ever serves the same signed-in user.
export const PANEL_SEED_TTL = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_TTL = PANEL_SEED_TTL;

// ── TTL envelope ───────────────────────────────────────────────────────────
// Same shape the panels used to declare locally, one copy.
export function readCache(key, ttlMs = DEFAULT_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return Date.now() - ts < ttlMs ? data : null;
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Quota exceeded / private mode — the cache is an optimisation, never
    // required for correctness. The live fetch still populates state.
  }
}

// ── who was here last ──────────────────────────────────────────────────────
// The cache keys end in the user id, but the id only arrives after
// getSession() — a network round trip. Remembering it lets the panel read its
// own cache on the very first render instead of waiting for auth.
const lastUidKey = (panel) => `${panel}_last_uid`;

export function rememberPanelUid(panel, uid) {
  try { if (uid) localStorage.setItem(lastUidKey(panel), uid); } catch { /* ignore */ }
}

export function lastPanelUid(panel) {
  try { return localStorage.getItem(lastUidKey(panel)); } catch { return null; }
}

// True when supabase-js has a persisted session for this origin. Checked
// synchronously (rule 3) — `supabase.auth.getSession()` is a promise, and by
// the time it settles the first paint has already happened.
export function hasStoredSession() {
  try {
    return Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k));
  } catch {
    return false;
  }
}

// ── redaction ──────────────────────────────────────────────────────────────
// `buyer_ic` is a Malaysian identity-card number and `buyer_address` is a home
// address; neither is needed to render a pipeline card, and both are re-fetched
// from the server the moment the panel actually needs them.
export const redactLeadsForCache = (rows) =>
  (rows || []).map(({ buyer_ic, buyer_address, ...rest }) => rest);

// The panel's OWN profile row is cached so the loading gate can clear on the
// first frame. `ic_hash` / `ic_last4` are identity material and nothing on a
// panel renders from them, so the raw values never reach disk.
//
// The IC-verified STATUS is a different thing: SalesmanLite's icEnforced check
// and its "verify IC" gate button both branch on `!!profile.ic_hash`. Dropping
// the field entirely (as this used to) made that check read false on the very
// first frame for every seller, including one who verified at onboarding —
// the cached seed paints before the live fetch lands, so the panel force-opened
// the IC modal on top of an already-verified account and nothing ever closed it
// back down. Caching a plain boolean isn't identity material (it can't be
// reversed to a hash or a digit), so it's safe to keep.
export const redactProfileForCache = (p) => {
  if (!p) return null;
  const { ic_hash, ic_last4, ...rest } = p;
  return { ...rest, ic_hash: ic_hash ? true : null };
};

// A cached profile clears the panel's loading gate on the first frame, which
// means the access gates each panel renders (pending approval, scheduled
// deletion, awaiting payment, expired trial, unfinished onboarding) evaluate
// against the CACHED row for a few hundred ms before the fresh one lands.
//
// Every state below is one where the correct answer is "not the panel", and all
// of them are decidable from the cached row alone — including the expired trial,
// because `trial_ends_at` is a date we can just compare against now. So a
// blocked account gets no seed at all and falls back to the old blocking
// spinner, rather than being shown a panel it is going to be thrown out of.
//
// This is deliberately the UNION of every panel's gates, in one place: a
// per-panel copy is how these lists drift apart.
function isSeedableProfile(p) {
  if (!p) return false;
  if (p.account_status === "pending" || p.account_status === "deleted") return false;
  if (p.is_active === false) return false;
  if (p.payment_status === "pending") return false;
  if (p.onboarding_complete === false) return false;
  if (
    p.subscription_status === "trial" &&
    p.trial_ends_at &&
    new Date(p.trial_ends_at) < new Date()
  ) return false;
  return true;
}

// ── first-frame seed ───────────────────────────────────────────────────────
// Returns whatever this device already knows about the last signed-in user, so
// a panel can initialise its state from cache and paint before auth + the
// profile query have resolved. Everything here is replaced by the live fetch a
// few hundred ms later; a mismatch on the real uid clears it (see the panels'
// bootstrap). Returns empty values — never throws — when there is nothing
// cached, no remembered uid, or no stored session.
export function seedPanelCache(panel, ttlMs = DEFAULT_TTL) {
  const empty = { uid: null, profile: null, listings: [], leads: null, enquiries: [], appts: [] };
  if (!hasStoredSession()) return empty;
  const uid = lastPanelUid(panel);
  if (!uid) return empty;
  const profile = readCache(`${panel}_profile_${uid}`, ttlMs);
  // No seed at all for a blocked account — the panel must not paint before the
  // fresh profile has confirmed the account can be in it.
  if (profile && !isSeedableProfile(profile)) return empty;
  return {
    uid,
    profile,
    listings: readCache(`${panel}_listings_${uid}`, ttlMs) || [],
    // null (not []) so the panel can tell "nothing cached" from "cached, empty"
    // and only show the leads skeleton in the first case.
    leads: readCache(`${panel}_leads_${uid}`, ttlMs),
    enquiries: readCache(`${panel}_enquiries_${uid}`, ttlMs) || [],
    appts: readCache(`${panel}_appts_${uid}`, ttlMs) || [],
  };
}

// Data caches holding buyer PII or the account's own profile, per panel. Prefix
// match — each key ends in the user id (e.g. `sp_leads_<uuid>`), so a purge
// clears every account's copy on this device, which is the point on a shared
// machine.
export const PANEL_DATA_CACHE_PREFIXES = [
  "sp_listings_", "sp_leads_", "sp_enquiries_", "sp_appts_", "sp_profile_", "sp_last_uid",
  "slite_listings_", "slite_leads_", "slite_enquiries_", "slite_appts_", "slite_profile_", "slite_last_uid",
  "spanel_listings_", "spanel_leads_", "spanel_enquiries_", "spanel_appts_", "spanel_profile_", "spanel_last_uid",
  "dash_listings_", "dash_profile_", "dash_salesmen_", "dash_last_uid",
  // useCachedFetch envelopes (dealer snapshot, PerformanceTab) — `cf:v1:<key>`,
  // and every one of those keys ends in a user id.
  "cf:v1:",
];

// Drop every cached buyer list on this device. Called on sign-out. Deliberately
// leaves non-PII preferences (goal, tour-seen, dismissed banners) alone — those
// are harmless and losing them on logout is a worse experience for no gain.
export const clearPanelDataCache = () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (PANEL_DATA_CACHE_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    // A blocked/full localStorage must not strand the user on the panel —
    // signing out matters more than the purge succeeding.
    console.error("clearPanelDataCache:", e);
  }
};
