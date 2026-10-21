import { useEffect, useState } from 'react';
import { ONLINE_CHANNEL, countOnline } from '../lib/onlinePresence';

// The platform console's side of "online now": watches the presence channel
// every app tab announces itself on (OnlineBeacon) and returns live counts.
// It listens only; it never tracks, so the admin is not counted.
// Returns null until the channel has synced once.
export function useOnlineNow(client, enabled) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!enabled || !client) return undefined;
    const channel = client.channel(ONLINE_CHANNEL);
    const update = () => setCounts(countOnline(channel.presenceState()));
    channel
      .on('presence', { event: 'sync' }, update)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, enabled]);

  return counts;
}

export default useOnlineNow;
