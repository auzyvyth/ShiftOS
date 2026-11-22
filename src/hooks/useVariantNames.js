import { useEffect, useState } from "react";
import { publicClient } from "../supabaseClient";

// Variant names for new_car_models ids (NEWCAR-PICK): the lead card says which variant the buyer
// picked on the model page (leads.new_car_model_id). Public read, cached for the tab's life, one
// query for all the ids a page needs. Returns { [id]: { variant, prices: { price_peninsular, ... } } }.
const cache = new Map();

export function useVariantNames(ids) {
  const want = [...new Set((ids || []).filter(Boolean))];
  const key = want.sort().join(",");
  const [, bump] = useState(0);
  useEffect(() => {
    const missing = want.filter((id) => !cache.has(id));
    if (!missing.length) return;
    let alive = true;
    missing.forEach((id) => cache.set(id, null)); // in flight: never asked twice
    publicClient.from("new_car_models").select("id, variant, price_peninsular, price_sabah_sarawak, price_labuan, price_langkawi").in("id", missing)
      .then(({ data, error }) => {
        if (error) { missing.forEach((id) => cache.delete(id)); return; }
        (data || []).forEach((r) => cache.set(r.id, r.variant ? { variant: r.variant, prices: r } : null));
        if (alive) bump((n) => n + 1);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const out = {};
  want.forEach((id) => { if (cache.get(id)) out[id] = cache.get(id); });
  return out;
}
