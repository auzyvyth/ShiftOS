import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// RAPTOR-1 / RAPTOR-4 — timed follow-up nudges.
//
// A nudge is a REMINDER with the message already drafted. It is never an
// auto-send: the salesman reviews the text and taps send themselves. Nothing
// in this hook, the `scheduled_nudges` table, or the `fire_due_nudges()` cron
// ever contacts a buyer. Buyers must know they are talking to a person.
//
// Lifecycle (status column):
//   pending   — queued, waiting for scheduled_for
//   ready     — due; the cron pushed a reminder, the human hasn't acted yet
//   sent      — the salesman opened WhatsApp with this draft
//   dismissed — the salesman binned it, or the lead closed/was deleted
//   expired   — sat 'ready' for 7 days untouched

// One open nudge per lead is enforced by a partial unique index in the DB
// (scheduled_nudges_one_open_per_lead), so the queue can't fill with
// duplicates for the same buyer.
const DUPLICATE_CODE = '23505';

export const NUDGE_PRESETS = [
  { key: 'tomorrow', label: 'Tomorrow 9am', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { key: 'days3',    label: 'In 3 days',    at: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(10, 0, 0, 0); return d; } },
  { key: 'week',     label: 'In a week',    at: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0); return d; } },
];

export function useNudges(salesmanId, dealerId) {
  const [nudges, setNudges]   = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!salesmanId) { setNudges([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_nudges')
      .select('id, lead_id, draft_message, reason, channel, scheduled_for, status, ai_drafted, created_at, notified_at, lead:lead_id(buyer_name, phone, stage, last_contacted_at, car_listing:car_listing_id(brand, model, year))')
      .eq('salesman_id', salesmanId)
      .in('status', ['pending', 'ready'])
      .order('scheduled_for', { ascending: true });
    // Surface the failure instead of rendering a silently empty queue — an
    // empty queue and a broken query look identical to the user otherwise.
    if (error) { console.error('useNudges load:', error); setLoading(false); return; }
    setNudges(data || []);
    setLoading(false);
  }, [salesmanId]);

  useEffect(() => { load(); }, [load]);

  // Returns { ok } or { ok:false, duplicate:true } when this lead already has
  // an open nudge.
  const createNudge = useCallback(async ({ leadId, message, when, reason = null, aiDrafted = false }) => {
    if (!salesmanId || !leadId || !message?.trim()) return { ok: false };
    const { error } = await supabase.from('scheduled_nudges').insert({
      dealer_id: dealerId || null,
      salesman_id: salesmanId,
      lead_id: leadId,
      draft_message: message.trim(),
      reason,
      ai_drafted: aiDrafted,
      scheduled_for: when.toISOString(),
    });
    if (error) {
      console.error('createNudge:', error);
      return { ok: false, duplicate: error.code === DUPLICATE_CODE };
    }
    await load();
    return { ok: true };
  }, [salesmanId, dealerId, load]);

  // Terminal transitions drop the row out of the queue (it only reads
  // pending/ready), so update local state optimistically.
  const closeNudge = useCallback(async (id, status) => {
    setNudges(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase
      .from('scheduled_nudges')
      .update({ status, actioned_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { console.error('closeNudge:', error); load(); }
  }, [load]);

  // Snooze puts a fired nudge back to 'pending' so the cron re-fires it later.
  // notified_at is cleared, otherwise the 7-day expiry would still measure
  // from the original firing and could expire it mid-snooze.
  const snoozeNudge = useCallback(async (id, when) => {
    setNudges(prev => prev.map(n => n.id === id
      ? { ...n, status: 'pending', scheduled_for: when.toISOString(), notified_at: null }
      : n));
    const { error } = await supabase
      .from('scheduled_nudges')
      .update({ status: 'pending', scheduled_for: when.toISOString(), notified_at: null })
      .eq('id', id);
    if (error) { console.error('snoozeNudge:', error); load(); }
  }, [load]);

  const due       = nudges.filter(n => n.status === 'ready');
  const scheduled = nudges.filter(n => n.status === 'pending');

  return { nudges, due, scheduled, loading, reload: load, createNudge, closeNudge, snoozeNudge };
}
