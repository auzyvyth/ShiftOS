import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { defaultTasksFor, computeProgress } from '../utils/postSaleSteps';

// Loads the post-sale checklist for a won deal (lead). Seeds the default
// Malaysian handover steps the first time the board is opened for that deal.
//
// initialTasks: full step rows the caller already holds (the handover board
// loads them for every deal). With them the checklist paints at once and the
// fetch below only refreshes in the background. Without them (lead drawer,
// linked-salesman panel) it behaves as before. Opening a deal used to show
// "Loading handover steps..." every time, behind three queries in a row.
export function usePostSaleTasks(lead, { initialTasks = null } = {}) {
  const leadId = lead?.id || null;
  const seeded = Array.isArray(initialTasks) && initialTasks.length > 0 && initialTasks.every((t) => t.id)
    ? [...initialTasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : null;
  const [tasks, setTasks] = useState(seeded || []);
  const [loading, setLoading] = useState(false);
  const hadSeed = useRef(!!seeded);
  // Bumped by every tap. A background read that started before a tap would
  // otherwise land after it and un-tick the step on screen.
  const edits = useRef(0);

  const load = useCallback(async () => {
    if (!leadId) return;
    // Only show a spinner when there is nothing on screen yet.
    if (!hadSeed.current) setLoading(true);
    const editsAtStart = edits.current;

    // The three reads do not depend on each other, so they go out together
    // (they used to run one after another, which was most of the wait).
    // stock_units: is the car clean-title? Then loan settlement does not apply.
    // profiles: does the dealership do road tax / insurance in-house?
    const [suRes, dpRes, tasksRes] = await Promise.all([
      lead?.car_listing_id
        ? supabase.from('stock_units').select('encumbrance_status').eq('listing_id', lead.car_listing_id).maybeSingle()
        : Promise.resolve({ data: null }),
      lead?.dealer_id
        ? supabase.from('profiles').select('handles_roadtax_insurance').eq('id', lead.dealer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('post_sale_tasks').select('*').eq('lead_id', leadId).order('sort_order', { ascending: true }),
    ]);
    const encumbranceClear = suRes.data?.encumbrance_status === 'clear';
    const handlesRoadtaxInsurance = dpRes.data?.handles_roadtax_insurance !== false;
    const { data, error } = tasksRes;
    // A failed refresh keeps what is on screen; never blank a painted list.
    if (error) { console.error('usePostSaleTasks:', error); setLoading(false); return; }

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
      if (edits.current === editsAtStart) setTasks(data);
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
    const { data: inserted } = await supabase
      .from('post_sale_tasks')
      .insert(rows)
      .select('*');
    setTasks((inserted || []).sort((a, b) => a.sort_order - b.sort_order));
    setLoading(false);
  }, [leadId, lead]);

  useEffect(() => { load(); }, [load]);

  const updateTask = useCallback(async (id, patch) => {
    edits.current += 1;
    if (patch.status === 'done' && !patch.completed_at) patch.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== 'done') patch.completed_at = null;
    patch.updated_at = new Date().toISOString();
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from('post_sale_tasks').update(patch).eq('id', id);
  }, []);

  return { tasks, loading, progress: computeProgress(tasks), reload: load, updateTask };
}
