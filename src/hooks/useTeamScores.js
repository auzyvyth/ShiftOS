import { useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useCachedFetch } from './useCachedFetch';

// The ONE read of how each linked salesman is doing: `gm_salesman_scores`, which calls the
// database's `_team_health` rules (status, score, issues). Team's table AND the status word on
// each salesman's card read this, so the two can never disagree (they did: the card had its own
// "Inactive 30d+" rule). Cached per dealer; a failed read throws so the last good copy stays.
// Key kept from the old Performance tab (`perf:scores:`) so the cache carries over.
export function useTeamScores(dealerId) {
  const { data, loading, refresh } = useCachedFetch(
    dealerId ? `perf:scores:${dealerId}` : null,
    async () => {
      const { data: rows, error } = await supabase.rpc('gm_salesman_scores', { p_dealer_id: dealerId });
      if (error) throw error;
      return rows || [];
    },
    { enabled: !!dealerId },
  );
  const scores = useMemo(() => data || [], [data]);
  const byId = useMemo(() => Object.fromEntries(scores.map((s) => [s.id, s])), [scores]);
  return { scores, byId, loading: loading && !data, refresh };
}
