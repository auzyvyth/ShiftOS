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

// Precache a handful of image URLs into the browser's Cache Storage so a
// repeat visit paints images instantly from cache instead of the network.
// cacheName should be versioned (e.g. 'mp-images-v1') so a shape change can
// invalidate old entries by bumping the suffix.
export function precacheImages(urls, cacheName) {
  if (!("caches" in window) || !urls?.length) return;
  caches.open(cacheName).then(async (cache) => {
    for (const url of urls) {
      try {
        const has = await cache.match(url);
        if (!has) await cache.add(url);
      } catch {
        // ignore — best-effort only, never blocks rendering
      }
    }
  }).catch(() => {});
}
