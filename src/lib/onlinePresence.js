// "Online now" (ONLINE-1, 2026-10-21): who has the app open this minute.
//
// Built on Supabase Realtime PRESENCE, which lives in the realtime server's
// memory: nothing is written to the database, so it costs no disk IO (the
// reason it is presence and not a last_seen column). Every open tab joins one
// channel and says only what KIND of user it is; the platform console counts.
//
// Privacy: the channel is public, so the payload carries no user id, name or
// page. The key is a random id per DEVICE (`deviceKey`, shared by every tab on
// that browser), so a seller whose dashboard opens the Live presentation in a
// second tab still counts once. The same person on a phone AND a laptop counts
// twice. Anyone could also join and add fake entries, so this is a dashboard
// number, never a security or release gate (the release gate reads
// seller_live_state, CLAUDE.md release rule).

export const ONLINE_CHANNEL = 'online-now';

// The seller-side routes. A signed-in account on one of these is a seller.
export const SELLER_PREFIXES = [
  '/dashboard', '/salesman', '/salesman-lite', '/salesman-premium',
  '/manager', '/accountant', '/fi', '/admin', '/accounts',
];

// Live presentation open on this tab. LivePresenter flips it on mount/unmount
// and the beacon re-announces itself.
let liveOpen = false;
export function isLiveOpen() { return liveOpen; }
export function setLiveOpen(on) {
  liveOpen = Boolean(on);
  try { window.dispatchEvent(new Event('xd:live')); } catch { /* SSR / old browser */ }
}

// One random id per browser, kept in localStorage, so every tab on the device
// joins under the same presence key. Falls back to a per-tab id where storage
// is blocked (private mode), which only means that device may count twice.
const DEVICE_KEY = 'xd_online_device';
function randomId() {
  try { return crypto.randomUUID(); } catch { return `d${Date.now()}${Math.random().toString(36).slice(2)}`; }
}
export function deviceKey() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = randomId(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch {
    return randomId();
  }
}

// Fold the channel's presence state into counts for the console. One entry per
// device key; its tabs are merged: a seller tab anywhere makes it a seller, and
// any tab with Live open makes it live.
export function countOnline(state) {
  // team = our own devices signed out (isInternalDevice), kept out of buyers/visitors.
  const out = { sellers: 0, buyers: 0, visitors: 0, team: 0, live: 0, total: 0 };
  for (const metas of Object.values(state || {})) {
    if (!metas?.length) continue;
    out.total += 1;
    const kinds = metas.map((m) => m.a);
    if (kinds.includes('seller')) out.sellers += 1;
    else if (kinds.includes('team')) out.team += 1;
    else if (kinds.includes('buyer')) out.buyers += 1;
    else out.visitors += 1;
    if (metas.some((m) => m.live)) out.live += 1;
  }
  return out;
}
