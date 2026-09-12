-- PREM-LEADS-ALERTS-1: deleting a lead left things pointing at it.
--
-- A lead is SOFT-deleted — `handleDeleteLead` (SalesmanPremium.jsx) and
-- `useLeads.js` both just set `is_deleted = true`. Every foreign key into
-- `leads` is written for a HARD delete (chat_threads SET NULL, scheduled_nudges
-- CASCADE, …), so none of them ever fire and everything that referenced the
-- lead keeps referencing it.
--
-- What that actually looked like, measured on live data before this ran:
--   * 2 `chat_threads` still carrying the `lead_id` of a deleted lead. This is
--     the visible half. `useChat.js:133` embeds `lead:lead_id(id, stage)` with
--     no is_deleted filter, so the thread kept rendering the dead lead's stage
--     pill — the "it still exists somewhere else" in the report.
--   * open `scheduled_nudges` were already handled, but only by the pg_cron
--     sweep `fire_due_nudges()` (every 5 min), so a rep could delete a lead and
--     still be nudged about it for the next five minutes.
--
-- NOT filtering the chat embed on is_deleted instead, deliberately: `leads` RLS
-- returns only rows where salesman_id = auth.uid(), so SellerInbox separates
-- "not yours to see" from "no lead" on `lead_id` being set while `lead` is null
-- (`SellerInbox.jsx:201`). Hiding a deleted lead that way would land the thread
-- in the "it's in the dealer pool, not yours" state and tell a rep a real buyer
-- is someone else's — the one thing that file says never to do. Clearing the
-- link is the honest fix: no lead_id, no lead, no claim either way.
--
-- One trigger rather than a patch per client, for the same reason the won-lead
-- trigger is one trigger: the Premium pipeline, the dealer LeadDrawer, useLeads
-- and the kanban all delete leads, and any of them can be the one that forgets.
--
-- NOT touched on purpose: `appointments.lead_id` and `whatsapp_enquiries.lead_id`.
-- A booked viewing and a received enquiry are real events that happened; the rep
-- deciding the pipeline card is dead does not un-book the appointment.

CREATE OR REPLACE FUNCTION public.lead_soft_delete_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
begin
  -- The conversation is still real even when the pipeline row is not. Clearing
  -- the link (rather than the thread) keeps every message; if the buyer writes
  -- again, `chat_after_message` raises a fresh lead, which is the right answer
  -- for someone the rep had written off.
  update public.chat_threads
     set lead_id = null
   where lead_id = new.id;

  -- Same statement `fire_due_nudges()` uses, so the two can never disagree
  -- about what a dismissed nudge looks like — it just no longer waits up to
  -- five minutes for the sweep.
  update public.scheduled_nudges
     set status = 'dismissed', actioned_at = now()
   where lead_id = new.id
     and status in ('pending', 'ready');

  -- The bell row a fired nudge leaves behind. `fire_due_nudges()` writes
  -- ref_id = the NUDGE id (not the lead id), which is why this deletes by
  -- subquery and why no other notification type is affected: nothing else in
  -- salesman_notifications references a lead at all (verified across all 158
  -- live rows — they point at bookings, chats and listings).
  delete from public.salesman_notifications
   where type = 'nudge_due'
     and ref_id in (select id from public.scheduled_nudges where lead_id = new.id);

  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_lead_soft_delete_fanout ON public.leads;
CREATE TRIGGER trg_lead_soft_delete_fanout
AFTER UPDATE OF is_deleted ON public.leads
FOR EACH ROW
WHEN (new.is_deleted IS TRUE AND old.is_deleted IS DISTINCT FROM TRUE)
EXECUTE FUNCTION public.lead_soft_delete_fanout();

-- Backfill what the missing trigger already left behind.
UPDATE public.chat_threads c
   SET lead_id = null
  FROM public.leads l
 WHERE l.id = c.lead_id
   AND l.is_deleted IS TRUE;

UPDATE public.scheduled_nudges n
   SET status = 'dismissed', actioned_at = now()
  FROM public.leads l
 WHERE l.id = n.lead_id
   AND n.status IN ('pending', 'ready')
   AND l.is_deleted IS TRUE;
