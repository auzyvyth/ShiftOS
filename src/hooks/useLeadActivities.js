import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useLeadActivities(leadId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const { data } = await supabase
      .from('lead_activities')
      .select('*, creator:created_by ( full_name )')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    setActivities(data || []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const addActivity = useCallback(async (payload) => {
    if (!leadId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const row = { ...payload, lead_id: leadId, created_by: user?.id };
    const { data, error } = await supabase
      .from('lead_activities')
      .insert(row)
      .select('*, creator:created_by ( full_name )');
    if (error) throw error;
    const inserted = data?.[0];
    if (inserted) setActivities(prev => [...prev, inserted]);
    return inserted;
  }, [leadId]);

  return { activities, loading, fetchActivities, addActivity };
}
