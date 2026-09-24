-- The dealer's viewing-outcome bell row had no link_to, so tapping it did nothing.
-- Bookings live in the Leads / CRM tab.

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
  insert into dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
  select a.dealer_id,
         'viewing_outcome',
         'How did the viewing go?',
         coalesce(nullif(a.buyer_name, ''), 'A buyer')
           || coalesce(' · ' || nullif(concat_ws(' ', c.year::text, c.brand, c.model), ''), '')
           || '. Mark it done or no-show in Bookings.',
         'crm',
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

