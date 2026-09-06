import { useCallback, useEffect, useRef, useState } from 'react';

// Stale-while-revalidate cache backed by localStorage so dashboards paint
// INSTANTLY from the last result on revisit (no blank/lag), then refresh in the
// background. A daily stamp guarantees at least one fresh fetch per day even if
// the tab stays open. Always key per-user (pass the dealer/user id in `key`) so
// one account's data never leaks into another's cache.
//
//   const { data, loading, refresh } = useCachedFetch(
//     userId ? `revops:${userId}` : null,           // null key => disabled
//     async () => (await supabase.rpc(...)).data,    // fetcher returns the value
//     { enabled: !!userId }
//   );

const VERSION = 'v1';

// Default: ALWAYS revalidate in the background. The cached value still paints
// instantly — that is the whole point — but it is never trusted as fresh.
//
// This used to default to a full day, which made every consumer a
// once-per-day-per-device snapshot: a dealer who sold a car saw yesterday's
// numbers on the dashboard until tomorrow, with no way to force a refresh
// short of clearing site data. A cache that suppresses the refetch is only
// right for something genuinely daily; pass an explicit ttlMs for that.

const today = () => new Date().toISOString().slice(0, 10);

function readCache(storageKey) {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useCachedFetch(key, fetcher, { enabled = true, ttlMs = 0 } = {}) {
  const storageKey = key ? `cf:${VERSION}:${key}` : null;

  const [data, setData] = useState(() => readCache(storageKey)?.data ?? null);
  // Only block with a spinner when there's nothing cached to show.
  const [loading, setLoading] = useState(() => enabled && !readCache(storageKey));
  const [error, setError] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const revalidate = useCallback(async () => {
    if (!storageKey) return;
    try {
      const fresh = await fetcherRef.current();
      setData(fresh);
      setError(null);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ t: Date.now(), day: today(), data: fresh }));
      } catch { /* quota / private mode — ignore, still works in-memory */ }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !storageKey) { setLoading(false); return; }
    const cached = readCache(storageKey);
    if (cached?.data != null) {
      setData(cached.data);
      setLoading(false);
      // Refresh in the background unless the caller asked for a TTL and the
      // cache is still inside it. With the default ttlMs of 0 this is always a
      // refetch, i.e. pure stale-while-revalidate: instant paint, live data.
      const fresh = cached.day === today() && cached.t && (Date.now() - cached.t) < ttlMs;
      if (!fresh) revalidate();
    } else {
      setLoading(true);
      revalidate();
    }
  }, [storageKey, enabled, ttlMs, revalidate]);

  return { data, loading, error, refresh: revalidate };
}
