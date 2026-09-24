-- SWEEP-4: 49 appointments in the past were still 'pending' / 'confirmed'.
-- Nothing asked whether the viewing happened, so show / no-show rates were
-- unknowable and booking lists filled with dead rows. The panels now all offer
-- "Viewing done" / "No-show" on a past booking; this job makes sure someone is
-- actually asked, once, the day after.
--
-- Pure SQL, same shape as fire_due_nudges(): inserting a *_notifications row IS
-- the push (trg_push_on_salesman_notification / trg_push_on_dealer_notification).
-- Only viewings that ended 3-48h ago are asked about, so the historic backlog is
-- not blasted out in one go; it stays visible in the lists with the buttons.
-- Runs hourly 09:17-21:17 MYT so nobody is asked at 2am.

create or replace function public.ask_viewing_outcomes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_n     int;
begin
  -- Rep-owned bookings: ask the rep.
  insert into salesman_notifications (salesman_id, type, title, body, ref_id)
  select a.salesman_id,
         'viewing_outcome',
         'How did the viewing go?',
         coalesce(nullif(a.buyer_name, ''), 'A buyer')
           || coalesce(' · ' || nullif(concat_ws(' ', c.year::text, c.brand, c.model), ''), '')
           || '. Mark it done or no-show.',
         a.id
    from appointments a
    left join car_listings c on c.id = a.car_listing_id
   where a.status in ('pending', 'confirmed')
     and a.salesman_id is not null
     and a.appointment_date between now() - interval '48 hours' and now() - interval '3 hours'
     and not exists (
       select 1 from salesman_notifications n
        where n.ref_id = a.id and n.type = 'viewing_outcome'
     );
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  -- Bookings with no rep sit in the dealer's pool: ask the dealer.
  insert into dealer_notifications (dealer_id, type, title, body, ref_id)
  select a.dealer_id,
         'viewing_outcome',
         'How did the viewing go?',
         coalesce(nullif(a.buyer_name, ''), 'A buyer')
           || coalesce(' · ' || nullif(concat_ws(' ', c.year::text, c.brand, c.model), ''), '')
           || '. Mark it done or no-show in Bookings.',
         a.id
    from appointments a
    left join car_listings c on c.id = a.car_listing_id
   where a.status in ('pending', 'confirmed')
     and a.salesman_id is null
     and a.dealer_id is not null
     and a.appointment_date between now() - interval '48 hours' and now() - interval '3 hours'
     and not exists (
       select 1 from dealer_notifications n
        where n.ref_id = a.id and n.type = 'viewing_outcome'
     );
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  return v_count;
end;
$$;

revoke all on function public.ask_viewing_outcomes() from public;
revoke all on function public.ask_viewing_outcomes() from anon;
revoke all on function public.ask_viewing_outcomes() from authenticated;

select cron.schedule('ask-viewing-outcomes', '17 1-13 * * *', 'select public.ask_viewing_outcomes();');
