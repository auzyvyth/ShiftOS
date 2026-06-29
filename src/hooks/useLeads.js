import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { getDealerIdFromProfile } from './useProfile';

const SELECT_QUERY = `
  *,
  car_listing:car_listing_id ( id, brand, model, year, selling_price, images ),
  assigned_profile:assigned_to ( id, full_name ),
  salesman_profile:salesman_id ( id, full_name )
`;

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dealerIdRef = useRef(null);

  // Resolve the dealer_id the same way the rest of the app does — manager/admin
  // belong to a dealer (profile.dealer_id), dealer/superadmin/owner ARE the dealer
  // (profile.id). Raw user.id orphans manager/admin-created rows.
  const resolveDealerId = useCallback(async () => {
    if (dealerIdRef.current) return dealerIdRef.current;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, dealer_id')
      .eq('id', user.id)
      .maybeSingle();
    dealerIdRef.current = getDealerIdFromProfile(profile);
    return dealerIdRef.current;
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const dealerId = await resolveDealerId();
    let query = supabase
      .from('leads')
      .select(SELECT_QUERY)
      .eq('is_deleted', false)
      // 'enquiry' is the pre-pipeline stage (raw WhatsApp enquiries surfaced in
      // the Outreach tab). Keep them out of the pipeline board until qualified,
      // so the funnel isn't polluted with un-vetted tyre-kickers.
      .neq('stage', 'enquiry')
      .order('created_at', { ascending: false });
    if (dealerId) query = query.eq('dealer_id', dealerId);

    const { data, error: err } = await query;

    if (err) { setError(err); setLoading(false); return; }
    setLeads(data || []);
    setLoading(false);
  }, [resolveDealerId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const addLead = useCallback(async (payload) => {
    const dealerId = await resolveDealerId();
    const row = { stage: 'new', ...payload, dealer_id: dealerId };
    const { data, error: err } = await supabase
      .from('leads')
      .insert(row)
      .select(SELECT_QUERY);
    if (err) throw err;
    const inserted = data?.[0];
    if (inserted) setLeads(prev => [inserted, ...prev]);
    return inserted;
  }, [resolveDealerId]);

  const updateLeadStage = useCallback(async (id, stage) => {
    const stagePayload = { stage, updated_at: new Date().toISOString() };
    const { error: err } = await supabase
      .from('leads')
      .update(stagePayload)
      .eq('id', id);
    console.log('leads update error:', JSON.stringify(err));
    console.log('leads update payload:', JSON.stringify(stagePayload));
    if (err) throw err;
    const { data } = await supabase.from('leads').select(SELECT_QUERY).eq('id', id).single();
    if (data) setLeads(prev => prev.map(l => l.id === id ? data : l));
    return data;
  }, []);

  const updateLead = useCallback(async (id, patch) => {
    const updatePayload = { ...patch, updated_at: new Date().toISOString() };
    const { error: err } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', id);
    console.log('leads update error:', JSON.stringify(err));
    console.log('leads update payload:', JSON.stringify(updatePayload));
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
