-- claim_lead() attributed the leads row (and its appointment) to the claiming
-- salesman but never touched the chat_threads row a chat-sourced lead is
-- linked to via chat_threads.lead_id. chat_thread_role() RLS still let the
-- claimer read/reply (it also grants 'seller' to anyone whose dealer matches
-- the thread's dealer_id, not just the thread's own salesman_id), so nothing
-- was BLOCKED -- but chat_after_message()'s push routing checks
-- chat_threads.salesman_id specifically: with it still NULL, the buyer's next
-- reply pushed the dealer's general inbox instead of the salesman who just
-- claimed the lead, undermining "you took it, you own it".
--
-- Only fills a blank (AND salesman_id IS NULL) -- never re-attributes a
-- thread that already has an owner for some other reason.
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ok boolean;
BEGIN
  IF NOT is_active_salesman() THEN RETURN false; END IF;
  UPDATE leads
     SET salesman_id = auth.uid(), updated_at = now()
   WHERE id = p_lead_id
     AND salesman_id IS NULL
     AND dealer_id = get_my_dealer_id()
  RETURNING true INTO v_ok;

  IF COALESCE(v_ok, false) THEN
    UPDATE appointments
       SET salesman_id = auth.uid(), updated_at = now()
     WHERE lead_id = p_lead_id
       AND salesman_id IS NULL
       AND dealer_id = get_my_dealer_id();

    UPDATE chat_threads
       SET salesman_id = auth.uid()
     WHERE lead_id = p_lead_id
       AND salesman_id IS NULL
       AND dealer_id = get_my_dealer_id();
  END IF;

  RETURN COALESCE(v_ok, false);
END; $function$;
