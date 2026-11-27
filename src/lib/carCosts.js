// THE read and writes for a car's costs (COSTS-1). Every money screen reads through loadCarCosts,
// which merges the new car_costs table with the two older tables it replaces (recon_jobs, ad_spend:
// production writes them until the next release). Rules live in src/utils/carCosts.js.
import { supabase } from '../supabaseClient';
import { fromLedger, fromReconJob, fromAdSpend } from '../utils/carCosts';

// car_costs is created by migration 20261127b (queued). Until it runs, its read fails with
// "relation does not exist" (42P01) or PostgREST's "not in the schema cache" (PGRST205): that is
// "no new rows yet", never a reason to show a profit with costs missing. Any OTHER error throws.
export const isMissingTable = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /car_costs/.test(e.message || '') && /does not exist|schema cache/.test(e.message || ''));

/** Rows for one car (unitId) or a whole dealer (no unitId). Throws on a real failure. */
export async function loadCarCosts({ dealerId, unitId = null }) {
  const scope = (q) => (unitId ? q.eq('stock_unit_id', unitId) : q);
  const [c, j, a] = await Promise.all([
    scope(supabase.from('car_costs').select('id, stock_unit_id, kind, label, payee, amount, state, cost_date, due_date, paid_at, created_at').eq('dealer_id', dealerId)),
    scope(supabase.from('recon_jobs').select('id, stock_unit_id, title, vendor, cost, status, completed_at, created_at').eq('dealer_id', dealerId)),
    scope(supabase.from('ad_spend').select('id, stock_unit_id, channel, amount, spent_at, created_at').eq('dealer_id', dealerId)),
  ]);
  if (c.error && !isMissingTable(c.error)) throw c.error;
  if (j.error) throw j.error;
  if (a.error) throw a.error;
  const rows = [
    ...(c.error ? [] : (c.data || []).map(fromLedger)),
    ...(j.data || []).map(fromReconJob),
    ...(a.data || []).map(fromAdSpend),
  ];
  // Newest first; a missing date sorts last.
  rows.sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
  return { rows, ledgerLive: !c.error };
}

/** Add one cost (row already checked by checkCost). Returns the new row in the shared shape. */
export async function addCarCost({ dealerId, unitId, row }) {
  const { data, error } = await supabase.from('car_costs')
    .insert({ ...row, dealer_id: dealerId, stock_unit_id: unitId }).select().single();
  if (error) throw error;
  return fromLedger(data);
}

/** Owed or estimate -> paid. Checks a row came back (RLS refuses as "0 rows, no error"). */
export async function markCarCostPaid(id) {
  const { data, error } = await supabase.from('car_costs').update({ state: 'paid' }).eq('id', id).select().single();
  if (error) throw error;
  return fromLedger(data);
}

/** Delete from whichever table the row lives in. */
export async function deleteCarCost(row) {
  const { data, error } = await supabase.from(row.source).delete().eq('id', row.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('not_deleted');
}
