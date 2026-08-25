import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { computeProgress, nextBlocker } from '../utils/postSaleSteps';

export const WON_STAGES = ['won', 'closed_won'];

// One source of truth for "deals that are past the win and in handover".
//
// Pipeline, Handover and Customers all need the same answer (which won deals
// exist, how far along each one is, what the next step is) and used to each
// find it out on their own — PostSaleBoard fetched on mount, Customers fetched
// once at page bootstrap and never again. Winning a deal in one tab therefore
// left the other two showing the world as it was before the sale.
//
// Instantiate this ONCE per page and hand the same object to every surface, so
// a win (or a ticked checklist step) updates all of them in the same tick.
// dealerId scopes to a dealership; salesmanId narrows to one rep's own deals.
export default function useHandover(dealerId, salesmanId = null) {
  const [deals, setDeals] = useState([]);
  const [tasksByLead, setTasksByLead] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Guards against an older refresh landing after a newer one (tab switches and
  // a win firing a refresh can overlap).
  const runRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!dealerId) { setLoading(false); return; }
    const run = ++runRef.current;
    setLoading(true);

    let q = supabase
      .from('leads')
      .select('id, dealer_id, buyer_name, phone, car_listing_id, salesman_id, assigned_to, loan_bank, loan_amount, loan_status, updated_at, car_listings(brand, model, year, selling_price), salesman_profile:salesman_id(full_name)')
      .eq('dealer_id', dealerId)
      .in('stage', WON_STAGES)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });
    if (salesmanId) q = q.eq('salesman_id', salesmanId);

    const { data, error: dealsErr } = await q;
    if (run !== runRef.current) return;
    if (dealsErr) {
      // Previously swallowed. A failed read here looks exactly like "no sold
      // deals yet", which is the most misleading empty state in the product.
      console.error('useHandover deals:', dealsErr);
      setError(dealsErr);
      setLoading(false);
      return;
    }

    const rows = data || [];
    setDeals(rows);

    const ids = rows.map((l) => l.id);
    if (ids.length) {
      const { data: allTasks, error: tasksErr } = await supabase
        .from('post_sale_tasks')
        .select('lead_id, step_key, status')
        .in('lead_id', ids);
      if (run !== runRef.current) return;
      if (tasksErr) console.error('useHandover tasks:', tasksErr);
      const byLead = {};
      (allTasks || []).forEach((t) => { (byLead[t.lead_id] ||= []).push(t); });
      setTasksByLead(byLead);
    } else {
      setTasksByLead({});
    }

    setError(null);
    setLoading(false);
  }, [dealerId, salesmanId]);

  useEffect(() => { refresh(); }, [refresh]);

  // The checklist owns the live task rows for the deal it has open. Pushing
  // them back up keeps every other surface's percentage and "next step" chip
  // honest without a refetch.
  const setTasksForLead = useCallback((leadId, tasks) => {
    if (!leadId || !Array.isArray(tasks)) return;
    const next = tasks.map((t) => ({ lead_id: leadId, step_key: t.step_key, status: t.status }));
    setTasksByLead((p) => {
      // Same steps, same statuses -> keep the old array so nothing downstream
      // re-renders on a report that changed nothing.
      const prev = p[leadId];
      if (prev && prev.length === next.length &&
          prev.every((t, i) => t.step_key === next[i].step_key && t.status === next[i].status)) return p;
      return { ...p, [leadId]: next };
    });
  }, []);

  // A deal won in this session: show it immediately rather than waiting on the
  // round trip. refresh() still runs and replaces this with the real row.
  const addWonDeal = useCallback((lead) => {
    if (!lead?.id) return;
    setDeals((p) => (p.some((d) => d.id === lead.id) ? p : [{ ...lead }, ...p]));
  }, []);

  // -1 = tasks not loaded/seeded yet, so callers can tell "unknown" from "0%".
  const progressByLead = useMemo(() => {
    const out = {};
    deals.forEach((d) => { out[d.id] = tasksByLead[d.id] ? computeProgress(tasksByLead[d.id]) : -1; });
    return out;
  }, [deals, tasksByLead]);

  const nextStepByLead = useMemo(() => {
    const out = {};
    deals.forEach((d) => { out[d.id] = tasksByLead[d.id] ? nextBlocker(tasksByLead[d.id]) : null; });
    return out;
  }, [deals, tasksByLead]);

  // Handover state for one lead, keyed by lead id — what the Pipeline card and
  // the Customers row each render as a chip.
  const statusForLead = useCallback((leadId) => {
    if (!leadId) return null;
    const deal = deals.find((d) => d.id === leadId);
    if (!deal) return null;
    const progress = progressByLead[leadId];
    return {
      deal,
      progress,
      done: progress === 100,
      next: nextStepByLead[leadId] || null,
      steps: tasksByLead[leadId] || [],
    };
  }, [deals, progressByLead, nextStepByLead, tasksByLead]);

  const activeCount = useMemo(
    () => deals.filter((d) => progressByLead[d.id] !== 100).length,
    [deals, progressByLead],
  );

  return {
    deals, tasksByLead, progressByLead, nextStepByLead,
    loading, error, refresh,
    setTasksForLead, addWonDeal, statusForLead, activeCount,
  };
}
