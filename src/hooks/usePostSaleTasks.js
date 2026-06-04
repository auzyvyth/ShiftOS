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
    const { data } = await supabase
      .from('post_sale_tasks')
      .select('*')
      .eq('lead_id', leadId)
      .order('sort_order', { ascending: true });

    if (data && data.length > 0) {
      setTasks(data);
      setLoading(false);
      return;
    }

    // No tasks yet — seed the default checklist for this deal.
    const rows = defaultTasksFor(lead).map((t) => ({
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
