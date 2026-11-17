-- BROKER-4 (2026-11-17): the dealer confirming a broker's Won left the broker's own lead behind:
-- moving it to Won seeds its handover steps under the DEALER's login, and guard_post_sale_task_owner
-- refused (post_sale_task_not_yours). Allowed now only inside broker_twin_after (app.broker_twin) and
-- only for a broker lead tied to a dealer lead. APPLIED 2026-11-17; rolled-back probe: approve ->
-- dealer lead won, broker lead won, car sold.
CREATE OR REPLACE FUNCTION public.guard_post_sale_task_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null or public.is_superadmin() then return new; end if;
  if tg_op = 'UPDATE' and new.lead_id is not distinct from old.lead_id and new.dealer_id is not distinct from old.dealer_id then return new; end if;
  if coalesce(current_setting('app.broker_twin', true), '') = 'on'
     and exists (select 1 from public.leads l where l.id = new.lead_id and l.broker_twin_id is not null
                   and l.dealer_id is not distinct from new.dealer_id) then
    return new;
  end if;
  if not exists (select 1 from public.leads l where l.id = new.lead_id and l.dealer_id is not distinct from new.dealer_id and (l.salesman_id = auth.uid() or l.dealer_id = public.get_my_dealer_id() or l.dealer_id = auth.uid())) then
    raise exception 'post_sale_task_not_yours' using errcode = '42501';
  end if;
  return new;
end; $function$;
