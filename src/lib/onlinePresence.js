// "Online now" (ONLINE-1, 2026-10-21): who has the app open this minute.
//
// Built on Supabase Realtime PRESENCE, which lives in the realtime server's
// memory: nothing is written to the database, so it costs no disk IO (the
// reason it is presence and not a last_seen column). Every open tab joins one
// channel and says only what KIND of user it is; the platform console counts.
//
// Privacy: the channel is public, so the payload carries no user id, name or
// page. The key is a random id per tab, so one person with two tabs counts
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

// Fold the channel's presence state into counts for the console.
export function countOnline(state) {
  const out = { sellers: 0, buyers: 0, visitors: 0, live: 0, total: 0 };
  for (const metas of Object.values(state || {})) {
    const m = metas?.[0];
    if (!m) continue;
    out.total += 1;
    if (m.a === 'seller') out.sellers += 1;
    else if (m.a === 'buyer') out.buyers += 1;
    else out.visitors += 1;
    if (m.live) out.live += 1;
  }
  return out;
}
