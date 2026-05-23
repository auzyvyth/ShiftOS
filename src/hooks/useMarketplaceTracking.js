import { useEffect } from "react";
import { supabase } from "../supabaseClient";
import { trackPageView } from "../utils/analytics";

/**
 * Tracks a marketplace page visit (page_view + page_exit with time_spent).
 * Pass condition=false to skip tracking (e.g. on dealer subdomains).
 */
export function useMarketplaceTracking(condition = true) {
  useEffect(() => {
    if (!condition) return;
    const cleanup = trackPageView(supabase);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
