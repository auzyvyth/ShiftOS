import { supabase } from '../supabaseClient';

// Fire-and-forget audit logger (activity_log): never throws, never blocks the caller.
// Shared by the dealer dashboard and ServicesPage.
export const logActivity = ({ dealerId, actor, tableName, recordId, action, summary, fieldChanges = null }) => {
  if (!dealerId) return;
  supabase.from('activity_log').insert({
    dealer_id:    dealerId,
    actor_id:     actor?.id   || null,
    actor_name:   actor?.full_name || actor?.email || 'Unknown',
    actor_role:   actor?.role  || null,
    table_name:   tableName,
    record_id:    recordId    || null,
    action,
    summary,
    field_changes: fieldChanges,
  }).then(({ error }) => { if (error) console.warn('[activity_log]', error.message); });
};
