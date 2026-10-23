import { useEffect, useState } from 'react';

// Console Home: which sellers are live right now, by name (ONLINE-2).
// Reads seller_live_state through get_live_sellers (superadmin-only,
// migration 20261021e), never the public presence channel, which carries no
// names on purpose. Re-reads every minute while the console is open; the
// presenter's heartbeat is 4 minutes, so a minute is fresh enough.
// Returns null until the first answer (and on error, so nothing false shows).
const REFRESH_MS = 60_000;

export function useLiveSellers(client, enabled) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!enabled || !client) return undefined;
    let cancelled = false;
    // A hidden console tab skips the read and catches up when shown, and only
    // one read runs at a time: a frozen DB made each hang (IO-7, 2026-10-22).
    let inFlight = false;
    let stale = false;
    const load = () => {
      if (document.visibilityState !== 'visible') { stale = true; return; }
      if (inFlight) return;
      inFlight = true;
      stale = false;
      client.rpc('get_live_sellers').then(({ data, error }) => {
        inFlight = false;
        if (cancelled) return;
        setRows(error ? null : (data || []));
      }, () => { inFlight = false; });
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && stale) load(); };
    load();
    const t = setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client, enabled]);

  return rows;
}

export default useLiveSellers;
