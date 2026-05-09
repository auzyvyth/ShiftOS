// Stale-while-revalidate cache for dealer listings.
// Keyed per dealer so account switching never shows wrong data.
// TTL is 10 min — realtime subscription keeps in-memory state fresh anyway.

const KEY_PREFIX = 'xdrive_listings_v2_';
const TTL_MS = 10 * 60 * 1000;

export function getCachedListings(dealerId) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + dealerId);
    if (!raw) return null;
    const { listings, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null;
    return listings;
  } catch {
    return null;
  }
}

export function setCachedListings(dealerId, listings) {
  try {
    localStorage.setItem(
      KEY_PREFIX + dealerId,
      JSON.stringify({ listings, ts: Date.now() })
    );
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

export function clearListingsCache(dealerId) {
  try {
    localStorage.removeItem(KEY_PREFIX + dealerId);
  } catch {}
}

// Patch a single listing in the cache without a full refresh.
// Called by the realtime subscription to keep cache in sync.
export function patchCachedListing(dealerId, eventType, newRow, oldRow) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + dealerId);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    let { listings } = parsed;
    if (eventType === 'INSERT') {
      if (!listings.some((l) => l.id === newRow.id)) listings = [newRow, ...listings];
    } else if (eventType === 'UPDATE') {
      listings = listings.map((l) => (l.id === newRow.id ? { ...l, ...newRow } : l));
    } else if (eventType === 'DELETE') {
      listings = listings.filter((l) => l.id !== oldRow.id);
    }
    localStorage.setItem(KEY_PREFIX + dealerId, JSON.stringify({ listings, ts: parsed.ts }));
  } catch {}
}
