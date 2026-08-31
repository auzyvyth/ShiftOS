import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Marketplace-wide counts: total live listings, distinct dealers, and how many
// cars actually qualify as a hot deal (>= 3% under list — the is_hot_deal rule
// from migration 20260831h, computed DB-side so this count and the
// ?hot_deals=true grid can never disagree).
//
// Module-level cache shared by every consumer for the page-session lifetime,
// the same shape as useMarketplaceSettings. The header, the footer and the
// marketplace page all need these numbers; without the cache that is three
// copies of one RPC on every page load.
// listings/dealers stay NULL until the real numbers land — the hero stat tiles
// render an em-dash for null and would otherwise flash "0+ cars listed" on a
// marketplace that has thousands. hotDeals defaults to 0 on purpose: the Hot
// Deals nav entry is hidden until we KNOW there are deals behind it.
const FALLBACK = { listings: null, dealers: null, hotDeals: 0 };

let _cache = null;
let _promise = null;

export function invalidateMarketplaceStatsCache() {
  _cache = null;
  _promise = null;
}

export default function useMarketplaceStats() {
  const [stats, setStats] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    let active = true;
    if (_cache) {
      setStats(_cache);
      setLoading(false);
      return () => { active = false; };
    }
    if (!_promise) {
      _promise = supabase.rpc('get_marketplace_stats').maybeSingle()
        .then(({ data, error }) => {
          // A failed read must not be cached as "0 hot deals" forever — that
          // would hide the Hot Deals nav for the rest of the session over one
          // dropped request. Leave the cache empty so the next mount retries.
          if (error) { _promise = null; return FALLBACK; }
          _cache = {
            listings: data?.listings ?? 0,
            dealers:  data?.dealers  ?? 0,
            hotDeals: data?.hot_deals ?? 0,
          };
          return _cache;
        });
    }
    _promise.then(data => {
      if (!active) return;
      setStats(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return { stats: stats || FALLBACK, loading };
}
