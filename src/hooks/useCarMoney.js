// The dealer's cars + their costs, read ONCE and summed by ownerMoney() (src/utils/ownerMoney.js).
// Every money figure on the dealer dashboard (Overview's money section and KPI tiles, Revenue)
// comes from here, so two screens can never show two "gross this month" numbers again: they
// used to read the RPC gm_pnl_snapshot, which skips recon jobs, holding cost, transfer and admin
// fees and counts a car with no buy price as pure profit.
// Kept on the device per dealer (usePersistentState) so the numbers paint at once; a failed read
// keeps them. Several components on one page share one request (`inflight`).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { usePersistentState } from './usePersistentState';
import { mergeCars, ownerMoney } from '../utils/ownerMoney';

async function load(dealerId) {
  const [l, u, a, t, d, c] = await Promise.all([
    supabase.from('car_listings').select('id, brand, model, variant, year, status, selling_price, sold_price, sold_at, created_at, commission_amount, included_services_cost, engine_cc, warranty_months').eq('dealer_id', dealerId).neq('status', 'archived'),
    supabase.from('stock_units').select('id, listing_id, purchase_price, purchase_date, recon_cost, recon_actual, asking_price, sold_price, sold_date, status, created_at, engine_cc, brand, model, year').eq('dealer_id', dealerId),
    supabase.from('ad_spend').select('stock_unit_id, amount').eq('dealer_id', dealerId),
    supabase.from('post_sale_tasks').select('listing_id, status, cost').eq('dealer_id', dealerId),
    supabase.from('deal_products').select('listing_id, sold_price, dealer_products(cost_price)').eq('dealer_id', dealerId),
    supabase.from('dealer_cost_settings').select('*').eq('dealer_id', dealerId).maybeSingle(),
  ]);
  // Every read counts: a failed ad-spend, handover, add-on or cost-settings read used to be
  // treated as "no costs", so profit came out HIGHER instead of the last good numbers staying.
  if ([l, u, a, t, d, c].some((r) => r.error)) throw new Error('read_failed');
  const ads = {};
  for (const r of a.data || []) ads[r.stock_unit_id] = (ads[r.stock_unit_id] || 0) + (Number(r.amount) || 0);
  const handover = {};
  for (const r of t.data || []) if (r.listing_id && r.status !== 'na') handover[r.listing_id] = (handover[r.listing_id] || 0) + (Number(r.cost) || 0);
  const addons = {};
  for (const r of d.data || []) {
    if (!r.listing_id) continue;
    const x = addons[r.listing_id] || (addons[r.listing_id] = { rev: 0, cost: 0 });
    x.rev += Number(r.sold_price) || 0; x.cost += Number(r.dealer_products?.cost_price) || 0;
  }
  return { listings: l.data || [], units: u.data || [], ctx: { ads, handover, addons, cfg: c.data || {} } };
}

const inflight = new Map();
function loadShared(dealerId) {
  if (!inflight.has(dealerId)) {
    const p = load(dealerId).finally(() => setTimeout(() => inflight.delete(dealerId), 2000));
    inflight.set(dealerId, p);
  }
  return inflight.get(dealerId);
}

/** { money: ownerMoney() result or null, failed, cached } */
export function useCarMoney(dealerId) {
  const [raw, setRaw, cached] = usePersistentState(dealerId ? `owner_money:${dealerId}` : null, null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!dealerId) return undefined;
    let off = false;
    loadShared(dealerId)
      .then((r) => { if (!off) { setRaw(r); setFailed(false); } })
      .catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [dealerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const money = useMemo(() => (raw ? ownerMoney(mergeCars(raw.listings, raw.units), raw.ctx) : null), [raw]);
  return { money, failed, cached };
}
