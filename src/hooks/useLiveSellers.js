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
    const load = () => {
      client.rpc('get_live_sellers').then(({ data, error }) => {
        if (cancelled) return;
        setRows(error ? null : (data || []));
      });
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [client, enabled]);

  return rows;
}

export default useLiveSellers;
