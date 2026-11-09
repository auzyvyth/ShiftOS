// Non-money stock fields (make, model, plate, asking price, encumbrance) for any team
// member. Salesmen can no longer read stock_units directly: it holds purchase price and
// recon (migration 20261109c_dealer_lockdown.sql, policy stock_money_roles_all).
// Falls back to the table while the function is not yet applied, so this can ship first.
import { supabase } from '../supabaseClient';

export async function fetchStockBasic({ listingId = null, dealerId = null } = {}) {
  const rpc = await supabase.rpc('get_dealer_stock_basic', { p_listing_id: listingId });
  if (!rpc.error) return { data: rpc.data || [], error: null };
  if (rpc.error.code !== 'PGRST202' && rpc.error.code !== '42883') return { data: [], error: rpc.error };
  let q = supabase.from('stock_units')
    .select('id, listing_id, brand, model, year, registration_number, asking_price, encumbrance_status, status');
  if (listingId) q = q.eq('listing_id', listingId);
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  return { data: data || [], error };
}
