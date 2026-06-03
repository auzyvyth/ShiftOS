import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Realtime presence for a dealer's team.
 *
 * Every staff member (dealer, manager, salesman, etc.) that mounts this hook
 * joins the same channel keyed on the dealer's profile id and tracks themselves.
 * Supabase automatically drops a member ~30-60s after their tab closes or the
 * connection is lost, so the returned set reflects who is genuinely live.
 *
 * @param {string} dealerKey  the dealer's profile id (shared by the whole team)
 * @returns {Set<string>} set of online user ids
 */
export function usePresence(dealerKey) {
  const [onlineIds, setOnlineIds] = useState(() => new Set());

  useEffect(() => {
    if (!dealerKey) return;
    let channel;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase.channel(`presence-dealer-${dealerKey}`, {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (cancelled) return;
          setOnlineIds(new Set(Object.keys(channel.presenceState())));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString() });
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [dealerKey]);

  return onlineIds;
}
