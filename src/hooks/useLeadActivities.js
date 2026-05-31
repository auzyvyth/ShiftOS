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

    // Optimistic: add a temp row immediately so UI updates without waiting
    const tempId = `temp_${Date.now()}`;
    const tempRow = {
      id:            tempId,
      lead_id:       leadId,
      dealer_id:     dealerId             ?? null,
      activity_type: payload.activity_type || 'note_added',
      note:          payload.note          ?? null,
      from_stage:    payload.from_stage    ?? null,
      to_stage:      payload.to_stage      ?? null,
      created_by:    user?.id              ?? null,
      created_at:    new Date().toISOString(),
      creator:       null,
    };
    setActivities(prev => [...prev, tempRow]);

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
      .insert(row)
      .select('*, creator:created_by ( id, full_name )')
      .single();

    if (error) {
      // Revert optimistic row on error
      setActivities(prev => prev.filter(a => a.id !== tempId));
      throw error;
    }

    // Replace temp row with real DB row
    setActivities(prev => prev.map(a => a.id === tempId ? data : a));
  }, [leadId, dealerId]);

  return { activities, loading, fetchActivities, addActivity };
}
