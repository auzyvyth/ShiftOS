-- PREM-LAPSE leftovers (TODO, logged 2026-10-19; the first free months end 4-17 Nov).
-- NOT APPLIED: written inside the 09:00-22:00 MYT no-DDL window. Run after
-- 22:00 MYT. Independent of 20261021a; either order works.
--
-- 1. fire_due_nudges() never checked the plan, so a seller whose Premium had
--    lapsed kept getting "Follow-up ready" pushes from a tool Lite cannot open.
--    Now only sellers entitled to it (salesman_has_full_page: Premium paid,
--    dealer-linked, or not a salesman at all) are fired. A lapsed seller's
--    nudges stay pending, so renewing brings them back; anything that has been
--    due for over 7 days expires instead, so a renewal does not fire a backlog.
-- 2. Telegram booking reminders set while Premium still sent after the lapse:
--    trg_zz_lite_no_booking_reminder only clears remind_at on a NEW write.
--    sweep_premium_lapses() (hourly, :41) now clears the unsent ones of every
--    lapsed seller. Worst case one reminder goes out in the hour before the
--    sweep reaches them. They do not come back on renewal: the seller sets the
--    reminder again from the booking.

begin;

create or replace function public.fire_due_nudges()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_fired integer := 0;
begin
  -- 1. Drop nudges whose lead is already closed or deleted. Chasing a buyer
  --    who already bought (or walked) is the fastest way to make the salesman
  --    distrust the queue.
  update public.scheduled_nudges n
     set status = 'dismissed', actioned_at = now()
    from public.leads l
   where l.id = n.lead_id
     and n.status in ('pending','ready')
     and (l.is_deleted is true
          or l.stage in ('won','closed_won','lost','closed_lost'));

  -- 2. Expire what the salesman ignored for a week, so the queue stays a
  --    to-do list and not an archive.
  update public.scheduled_nudges
     set status = 'expired'
   where status = 'ready'
     and notified_at < now() - interval '7 days';

  -- 2b. Same for a nudge that has been due for a week and never fired (its
  --     seller's Premium lapsed): renewing must not fire a month of backlog.
  update public.scheduled_nudges
     set status = 'expired'
   where status = 'pending'
     and scheduled_for < now() - interval '7 days';

  -- 3. Fire what is due, for sellers who still have reminders. The
  --    notification row is the push.
  with due as (
    update public.scheduled_nudges n
       set status = 'ready', notified_at = now()
     where n.status = 'pending'
       and n.scheduled_for <= now()
       and public.salesman_has_full_page(n.salesman_id)
    returning n.id, n.salesman_id, n.lead_id, n.draft_message
  ), ins as (
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    select d.salesman_id,
           'nudge_due',
           'Follow-up ready: ' || coalesce(nullif(l.buyer_name, ''), 'your lead'),
           left(d.draft_message, 140),
           d.id
      from due d
      join public.leads l on l.id = d.lead_id
    returning 1
  )
  select count(*)::int into v_fired from ins;

  return v_fired;
end;
$function$;

create or replace function public.sweep_premium_lapses()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_cap int := (select listing_cap from plan_config where plan = 'salesman_lite');
  r record;
  v_locked int;
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
    with ranked as (
      select c.id, c.status,
             row_number() over (order by (c.status = 'reserved') desc, c.created_at desc) as rn
        from car_listings c
       where c.dealer_id = r.id
         and c.status not in ('sold', 'archived', 'unpublished')
         and c.new_car_model_id is null
    )
    update car_listings c
       set plan_locked_status = c.status, plan_locked_at = now(), status = 'unpublished'
      from ranked
     where ranked.id = c.id and ranked.rn > v_cap
       and ranked.status in ('available', 'active');

    -- Telegram booking reminders are Premium. Ones set before the lapse would
    -- still send, because the Lite guard trigger only sees new writes.
    update appointments
       set remind_at = null
     where salesman_id = r.id
       and remind_at is not null
       and remind_sent is not true;

    if r.plan_expires_at > now() - interval '30 days'
       and not exists (
         select 1 from salesman_notifications n
          where n.salesman_id = r.id and n.type = 'premium_ended'
            and n.created_at > r.plan_expires_at) then
      select count(*) into v_locked
        from car_listings where dealer_id = r.id and plan_locked_at is not null;
      insert into salesman_notifications (salesman_id, type, title, body)
      values (r.id, 'premium_ended', 'Your Premium has ended',
              case when v_locked > 0
                then v_locked || case when v_locked = 1 then ' car is' else ' cars are' end
                     || ' hidden from buyers until you renew. Nothing is deleted.'
                else 'You are on Lite now. Renew any time and everything comes back.' end);
    end if;
  end loop;
end;
$function$;

commit;

-- Verify afterwards: exactly one row each.
--   select oid::regprocedure from pg_proc where proname in ('fire_due_nudges', 'sweep_premium_lapses');
