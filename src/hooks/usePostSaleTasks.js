import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { defaultTasksFor, computeProgress } from '../utils/postSaleSteps';

// Loads the post-sale checklist for a won deal (lead). Seeds the default
// Malaysian handover steps the first time the board is opened for that deal.
export function usePostSaleTasks(lead) {
  const leadId = lead?.id || null;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);

    // Is the car clean-title (no outstanding loan)? If so the loan-settlement
    // step doesn't apply and should be auto-marked N/A.
    let encumbranceClear = false;
    if (lead?.car_listing_id) {
      const { data: su } = await supabase
        .from('stock_units')
        .select('encumbrance_status')
        .eq('listing_id', lead.car_listing_id)
        .maybeSingle();
      encumbranceClear = su?.encumbrance_status === 'clear';
    }

    // Does this dealership handle road tax / insurance in-house? When not,
    // those steps are auto-marked N/A so they never show as the dealer's work.
    let handlesRoadtaxInsurance = true;
    if (lead?.dealer_id) {
      const { data: dp } = await supabase
        .from('profiles')
        .select('handles_roadtax_insurance')
        .eq('id', lead.dealer_id)
        .maybeSingle();
      handlesRoadtaxInsurance = dp?.handles_roadtax_insurance !== false;
    }

    const { data } = await supabase
      .from('post_sale_tasks')
      .select('*')
      .eq('lead_id', leadId)
      .order('sort_order', { ascending: true });

    if (data && data.length > 0) {
      // Reconcile steps seeded 'pending' by the DB trigger (which doesn't see
      // encumbrance or the dealer's road tax/insurance setting) — flip once.
      const loanStep = data.find((t) => t.step_key === 'loan_settlement');
      if (encumbranceClear && loanStep && loanStep.status === 'pending') {
        await supabase.from('post_sale_tasks').update({ status: 'na' }).eq('id', loanStep.id);
        loanStep.status = 'na';
      }
      if (!handlesRoadtaxInsurance) {
        for (const key of ['road_tax', 'insurance']) {
          const step = data.find((t) => t.step_key === key);
          if (step && step.status === 'pending') {
            await supabase.from('post_sale_tasks').update({ status: 'na' }).eq('id', step.id);
            step.status = 'na';
          }
        }
      }
      setTasks(data);
      setLoading(false);
      return;
    }

    // No tasks yet — seed the default checklist for this deal.
    const rows = defaultTasksFor(lead, { encumbranceClear, handlesRoadtaxInsurance }).map((t) => ({
      ...t,
      dealer_id: lead.dealer_id,
      lead_id: leadId,
      listing_id: lead.car_listing_id || null,
      salesman_id: lead.salesman_id || lead.assigned_to || null,
    }));
    const { data: seeded } = await supabase
      .from('post_sale_tasks')
      .insert(rows)
      .select('*');
    setTasks((seeded || []).sort((a, b) => a.sort_order - b.sort_order));
    setLoading(false);
  }, [leadId, lead]);

  useEffect(() => { load(); }, [load]);

  const updateTask = useCallback(async (id, patch) => {
    if (patch.status === 'done' && !patch.completed_at) patch.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== 'done') patch.completed_at = null;
    patch.updated_at = new Date().toISOString();
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from('post_sale_tasks').update(patch).eq('id', id);
  }, []);

  return { tasks, loading, progress: computeProgress(tasks), reload: load, updateTask };
}
