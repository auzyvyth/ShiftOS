// One car's cost list + its actions (COSTS-1), shared by the car pop-up's Owner tab (OwnerCarPanel)
// and the Stock tab's Costs pop-up, so adding / paying / editing works the same in both.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { loadCarCosts, addCarCost, updateCarCost, deleteCarCost } from '../lib/carCosts';

const sameRow = (a, b) => a.source === b.source && a.id === b.id;
const fmt = (n) => 'RM ' + Math.round(Number(n) || 0).toLocaleString('en-MY');

export function useCarCosts(dealerId, unitId, { onChanged } = {}) {
  const [rows, setRows] = useState([]);
  const [failed, setFailed] = useState(false);
  const [ledgerLive, setLedgerLive] = useState(true);
  const [payees, setPayees] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!dealerId || !unitId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try { const r = await loadCarCosts({ dealerId, unitId }); setRows(r.rows); setLedgerLive(r.ledgerLive); setFailed(false); }
    catch { setRows([]); setFailed(true); }
    setLoading(false);
  }, [dealerId, unitId]);

  useEffect(() => { reload(); }, [reload]);
  // Supplier names to suggest in "Paid to" (the owner's saved vendors; other roles simply get none).
  useEffect(() => {
    if (!dealerId) return;
    supabase.from('vendors').select('name').eq('dealer_id', dealerId).eq('is_active', true).order('name')
      .then(({ data }) => setPayees((data || []).map((v) => v.name).filter(Boolean)));
  }, [dealerId]);

  const changed = (next) => { setRows(next); onChanged?.(next); };

  // add / edit throw on failure so the pop-up stays open with what was typed.
  const add = async (row) => {
    try { const r = await addCarCost({ dealerId, unitId, row }); changed([r, ...rows]); toast.success('Cost added'); }
    catch (e) { toast.error(String(e?.message).includes('car_costs_wrong') ? 'This car is not on your account' : 'Could not save the cost'); throw e; }
  };
  const edit = async (old, patch) => {
    try { const r = await updateCarCost(old.id, patch); changed(rows.map((x) => (sameRow(x, old) ? r : x))); toast.success('Cost updated'); }
    catch (e) { toast.error('Could not save the change'); throw e; }
  };
  const setState = async (old, state) => {
    try { const r = await updateCarCost(old.id, { state }); changed(rows.map((x) => (sameRow(x, old) ? r : x))); toast.success(state === 'paid' ? 'Marked paid' : 'Moved to owed'); }
    catch { toast.error('Could not change it'); }
  };
  const remove = async (old) => {
    if (!window.confirm(`Delete "${old.label}" (${fmt(old.amount)})?`)) return;
    try { await deleteCarCost(old); changed(rows.filter((x) => !sameRow(x, old))); toast.success('Cost deleted'); }
    catch { toast.error('Could not delete it'); }
  };
  return { rows, failed, ledgerLive, payees, loading, reload, add, edit, setState, remove };
}

export const LEDGER_OFF_REASON = "Adding costs switches on with tonight's update. The costs already logged are shown and counted.";
