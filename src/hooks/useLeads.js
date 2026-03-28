import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const SELECT_QUERY = `
  *,
  car_listing:car_listing_id ( id, brand, model, year, selling_price, images ),
  assigned_profile:assigned_to ( id, full_name )
`;

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('leads')
      .select(SELECT_QUERY)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (err) { setError(err); setLoading(false); return; }
    setLeads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const addLead = useCallback(async (payload) => {
    const { data: { user } } = await supabase.auth.getUser();
    const row = { ...payload, dealer_id: user.id, stage: 'new' };
    const { data, error: err } = await supabase
      .from('leads')
      .insert(row)
      .select(SELECT_QUERY);
    if (err) throw err;
    const inserted = data?.[0];
    if (inserted) setLeads(prev => [inserted, ...prev]);
    return inserted;
  }, []);

  const updateLeadStage = useCallback(async (id, stage) => {
    const { data, error: err } = await supabase
      .from('leads')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_QUERY);
    if (err) throw err;
    const updated = data?.[0];
    if (updated) setLeads(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  }, []);

  const updateLead = useCallback(async (id, patch) => {
    const { data, error: err } = await supabase
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_QUERY);
    if (err) throw err;
    const updated = data?.[0];
    if (updated) setLeads(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  }, []);

  const deleteLead = useCallback(async (id) => {
    const { error: err } = await supabase
      .from('leads')
      .update({ is_deleted: true })
      .eq('id', id);
    if (err) throw err;
    setLeads(prev => prev.filter(l => l.id !== id));
  }, []);

  // Optimistic stage change — call this before the async Supabase update
  const optimisticStageChange = useCallback((id, newStage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
  }, []);

  // Revert a stage change back to original (on Supabase error)
  const revertStageChange = useCallback((id, originalStage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: originalStage } : l));
  }, []);

  return {
    leads,
    setLeads,
    loading,
    error,
    fetchLeads,
    addLead,
    updateLeadStage,
    updateLead,
    deleteLead,
    optimisticStageChange,
    revertStageChange,
  };
}
