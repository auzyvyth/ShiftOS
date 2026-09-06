// Shared stale-while-revalidate cache helpers for public/anon-facing pages.
// Pattern lifted from SalesmanLite.jsx's local cache (localStorage + TTL
// envelope + Cache Storage image precache) — generalized so other pages don't
// duplicate it. Callers always still fire a fresh fetch in the background and
// overwrite both state and cache when it lands; the cache only affects what
// paints on the very first render of a repeat visit, never final correctness.

export function readCache(key, ttlMs) {
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
    // localStorage full/blocked (private browsing) — cache is an optimization, never required
  }
}

// precacheImages() was REMOVED. It opened a Cache Storage bucket and eagerly
// fetched image URLs into it, but no service-worker fetch handler ever read
// those buckets back — the bytes were downloaded, stored and never served,
// competing for bandwidth with the queries the page was waiting on. Car photos
// are cached by the service worker's CacheFirst runtime route instead (see
// runtimeCaching in vite.config.js), which caches what actually renders.

// One-time cleanup for the Cache Storage buckets the removed precacheImages()
// left behind. Nothing reads them and nothing deletes them, so on an existing
// install they sit there holding megabytes of car photos forever. Safe to keep
// calling: caches.delete() on a name that is already gone resolves false.
const DEAD_IMAGE_CACHES = ['slite-images-v1', 'sp-images-v1', 'mp-images-v1', 'hp-images-v1'];

export function purgeDeadImageCaches() {
  if (!('caches' in window)) return;
  const run = () => {
    DEAD_IMAGE_CACHES.forEach((name) => { caches.delete(name).catch(() => {}); });
  };
  // Idle so this never competes with the first paint it exists to protect.
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 10000 });
  else setTimeout(run, 5000);
}
