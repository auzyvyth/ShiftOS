-- Premium lapse is instant, not "whenever the sweep runs" (owner, 2026-10-31:
-- "fuck the due date, instant rollback to lite").
--
-- Features already end the second plan_expires_at passes (is_salesman_premium,
-- and the Premium panel's timer sends the seller to Lite). What lagged was the
-- car lock + the "Premium ended" push: they only ran in sweep_premium_lapses(),
-- whose cron is DAILY (00:00 UTC) on the live DB. So a seller whose trial ended
-- at 09:00 kept 30 cars live for buyers until 08:00 the next day.
--
-- Now the per-seller work is one helper, and the Lite panel runs it for the
-- signed-in seller on load (apply_my_premium_lapse), so the moment a lapsed
-- seller lands on Lite their extra cars are locked. The daily sweep stays as
-- the backstop for sellers who never open the app.

-- The lapse work for ONE seller: lock cars over the Lite cap, drop Telegram
-- reminders, send the one "ended" push. Caller has checked the seller lapsed.
create or replace function public._apply_premium_lapse(p_id uuid, p_expires timestamptz)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_cap    int := (select listing_cap from plan_config where plan = 'salesman_lite');
  v_locked int;
begin
  -- Keep reserved cars first (a buyer has put money down), then the newest.
  with ranked as (
    select c.id, c.status,
           row_number() over (order by (c.status = 'reserved') desc, c.created_at desc) as rn
      from car_listings c
     where c.dealer_id = p_id
       and c.status not in ('sold', 'archived', 'unpublished', 'private')
       and c.new_car_model_id is null
  )
  update car_listings c
     set plan_locked_status = c.status, plan_locked_at = now(), status = 'unpublished'
    from ranked
   where ranked.id = c.id and ranked.rn > v_cap
     and ranked.status in ('available', 'active');

  update appointments
     set remind_at = null
   where salesman_id = p_id
     and remind_at is not null
     and remind_sent is not true;

  if p_expires > now() - interval '30 days'
     and not exists (
       select 1 from salesman_notifications n
        where n.salesman_id = p_id and n.type = 'premium_ended'
          and n.created_at > p_expires) then
    select count(*) into v_locked
      from car_listings where dealer_id = p_id and plan_locked_at is not null;
    insert into salesman_notifications (salesman_id, type, title, body)
    values (p_id, 'premium_ended', 'Your Premium has ended',
            case when v_locked > 0
              then v_locked || case when v_locked = 1 then ' car is' else ' cars are' end
                   || ' hidden from buyers until you renew. Nothing is deleted.'
              else 'You are on Lite now. Renew any time and everything comes back.' end);
  end if;
end;
$function$;

revoke all on function public._apply_premium_lapse(uuid, timestamptz) from public, anon, authenticated;

-- Same sweep as before; the loop body is now the helper above.
create or replace function public.sweep_premium_lapses()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r record;
begin
  insert into salesman_notifications (salesman_id, type, title, body)
  select p.id, 'premium_ending',
         'Your Premium ends in ' ||
           greatest(1, ceil(extract(epoch from (p.plan_expires_at - now())) / 86400))::int ||
           case when p.plan_expires_at - now() <= interval '1 day' then ' day' else ' days' end,
         'Renew to keep reminders, Performance and every car live. Nothing is deleted if you do not.'
    from profiles p
   where p.role = 'salesman' and p.plan::text = 'salesman_full'
     and p.dealer_id is null and coalesce(p.is_active, true)
     and p.payment_status is distinct from 'received'
     and p.plan_expires_at > now()
     and p.plan_expires_at <= now() + interval '3 days'
     and not exists (
       select 1 from salesman_notifications n
        where n.salesman_id = p.id and n.type = 'premium_ending'
          and n.created_at > p.plan_expires_at - interval '4 days');

  for r in
    select p.id, p.plan_expires_at from profiles p
     where p.role = 'salesman' and p.plan::text = 'salesman_full'
       and p.dealer_id is null and coalesce(p.is_active, true)
       and coalesce(p.account_status, '') <> 'deleted'
       and p.payment_status is distinct from 'received'
       and p.plan_expires_at is not null
       and p.plan_expires_at <= now()
  loop
    perform public._apply_premium_lapse(r.id, r.plan_expires_at);
  end loop;
end;
$function$;

revoke all on function public.sweep_premium_lapses() from public, anon, authenticated;

-- Called by the Lite panel on load. Applies the lapse to the CALLER only
-- (subject = auth.uid(), takes no argument), then returns the caller's locked
-- car ids, so it doubles as get_my_locked_listings(). Idempotent: a second
-- call locks nothing new (only available/active cars over the cap move) and
-- the push is once per lapse.
create or replace function public.apply_my_premium_lapse()
returns setof uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_exp timestamptz;
begin
  if auth.uid() is null then return; end if;
  select p.plan_expires_at into v_exp
    from profiles p
   where p.id = auth.uid()
     and p.role = 'salesman' and p.plan::text = 'salesman_full'
     and p.dealer_id is null and coalesce(p.is_active, true)
     and coalesce(p.account_status, '') <> 'deleted'
     and p.payment_status is distinct from 'received'
     and p.plan_expires_at is not null
     and p.plan_expires_at <= now();
  if found then
    perform public._apply_premium_lapse(auth.uid(), v_exp);
  end if;
  return query
    select c.id from car_listings c
     where c.dealer_id = auth.uid() and c.plan_locked_at is not null;
end;
$function$;

revoke all on function public.apply_my_premium_lapse() from public, anon;
grant execute on function public.apply_my_premium_lapse() to authenticated;

-- Check after applying:
--   select oid::regprocedure from pg_proc where proname in ('sweep_premium_lapses','apply_my_premium_lapse','_apply_premium_lapse');
--   select has_function_privilege('anon', 'public.apply_my_premium_lapse()', 'execute');  -- false
--   select has_function_privilege('authenticated', 'public._apply_premium_lapse(uuid, timestamptz)', 'execute');  -- false
