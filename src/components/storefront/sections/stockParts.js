// The dealer's live cars, as the few columns the brand strip and the browse bar need
// (STOREFRONT-2 stage 4 phase B). ONE read per dealer per page load, shared by both sections
// (module cache), and only when one of them is drawn. Through publicClient: a public read must
// never wait on a stale login (CLAUDE.md, useTenant). The page's own car query stops at 30
// newest; these options must cover every car, so this one reads up to 500 small rows.
import { useEffect, useState } from "react";
import { publicClient } from "../../../supabaseClient";
import { withTimeout } from "../../../config/marketplaceConfig";

const cache = new Map(); // dealerId -> Promise<rows>

function load(dealerId) {
  if (!cache.has(dealerId)) {
    const p = withTimeout(
      publicClient
        .from("public_car_listings")
        .select("brand,model,body_type,selling_price")
        .eq("dealer_id", dealerId)
        .in("status", ["available", "reserved"])
        .not("is_model_card", "is", true)
        .limit(500),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      })
      .catch(() => {
        cache.delete(dealerId); // a failed read is tried again on the next page load, never kept
        return [];
      });
    cache.set(dealerId, p);
  }
  return cache.get(dealerId);
}

// -> rows, or null while loading. A failed read reads as no cars: the sections hide.
export function useDealerStock(dealerId) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!dealerId) return undefined;
    let on = true;
    load(dealerId).then((r) => on && setRows(r));
    return () => { on = false; };
  }, [dealerId]);
  return dealerId ? rows : [];
}
