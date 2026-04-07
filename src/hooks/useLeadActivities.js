import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useLeadActivities(leadId, dealerId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const { data } = await supabase
      .from('lead_activities')
      .select('*, creator:created_by ( id, full_name )')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    setActivities(data || []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const addActivity = useCallback(async (payload) => {
    if (!leadId) return;
    const { data: { user } } = await supabase.auth.getUser();

    const row = {
      lead_id:       leadId,
      dealer_id:     dealerId             ?? null,
      activity_type: payload.activity_type || 'note_added',
      note:          payload.note          ?? null,
      from_stage:    payload.from_stage    ?? null,
      to_stage:      payload.to_stage      ?? null,
      created_by:    user?.id              ?? null,
    };

    const { data, error } = await supabase
      .from('lead_activities')
      .insert(row);
    console.log('activity error:', JSON.stringify(error));
    if (error) throw error;
    await fetchActivities();
  }, [leadId, fetchActivities]);

  return { activities, loading, fetchActivities, addActivity };
}
