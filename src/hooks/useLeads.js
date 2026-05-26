import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [dealerId, setDealerId] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    async function resolveDealer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles').select('id,role,dealer_id').eq('id', user.id).single();
      if (!profile) return;
      const did = ['manager', 'admin'].includes(profile.role) ? profile.dealer_id : profile.id;
      setDealerId(did || null);
    }
    resolveDealer();
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!dealerId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('leads')
      .select(SELECT_QUERY)
      .eq('dealer_id', dealerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (err) { setError(err); setLoading(false); return; }
    setLeads(data || []);
    setLoading(false);
  }, [dealerId]);

  useEffect(() => {
    if (!dealerId) return;
    fetchLeads();

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel('leads_dealer_' + dealerId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `dealer_id=eq.${dealerId}` }, fetchLeads)
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [dealerId, fetchLeads]);

  const addLead = useCallback(async (payload) => {
    if (!dealerId) throw new Error('No dealer context');
    const row = { ...payload, dealer_id: dealerId, stage: payload.stage || 'new' };
    const { data, error: err } = await supabase
      .from('leads')
      .insert(row)
      .select(SELECT_QUERY);
    if (err) throw err;
    const inserted = data?.[0];
    if (inserted) setLeads(prev => [inserted, ...prev]);
    return inserted;
  }, [dealerId]);

  const updateLeadStage = useCallback(async (id, stage) => {
    const { error: err } = await supabase
      .from('leads')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) throw err;
    const { data } = await supabase.from('leads').select(SELECT_QUERY).eq('id', id).single();
    if (data) setLeads(prev => prev.map(l => l.id === id ? data : l));
    return data;
  }, []);

  const updateLead = useCallback(async (id, patch) => {
    const { error: err } = await supabase
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) throw err;
    const { data } = await supabase.from('leads').select(SELECT_QUERY).eq('id', id).single();
    if (data) setLeads(prev => prev.map(l => l.id === id ? data : l));
    return data;
  }, []);

  const deleteLead = useCallback(async (id) => {
    const { error: err } = await supabase
      .from('leads')
      .update({ is_deleted: true })
      .eq('id', id);
    if (err) throw err;
    setLeads(prev => prev.filter(l => l.id !== id));
  }, []);

  const optimisticStageChange = useCallback((id, newStage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
  }, []);

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
