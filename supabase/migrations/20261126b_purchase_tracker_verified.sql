-- Buyer purchase tracker: match only on a VERIFIED sign-in identity.
begin;

create or replace function public.get_my_purchase_tracker()
returns table(lead_id uuid, car_label text, plate text, purchase_date date, selling_price numeric,
              dealership text, step_key text, status text, sort_order integer, due_date date)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with me as (
    select
      case when u.email_confirmed_at is not null then lower(u.email) end as email,
      case when u.phone_confirmed_at is not null
           then nullif(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), '') end as phone
    from auth.users u
    where u.id = auth.uid()
      and not coalesce(u.is_anonymous, false)
  ),
  my_customers as (
    select c.lead_id,
           btrim(concat_ws(' ', c.car_year, c.car_brand, c.car_model)) as car_label,
           c.car_plate as plate, c.purchase_date, c.selling_price,
           coalesce(seller.dealership, seller.site_name, seller.full_name) as dealership
    from customers c
    join profiles seller on seller.id = c.dealer_id
    cross join me
    where c.lead_id is not null
      and coalesce(seller.plan::text, '') <> 'salesman_lite'
      and (
        (me.email is not null and lower(c.email) = me.email)
        or (me.phone is not null
            and nullif(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), '') = me.phone)
      )
  )
  select mc.lead_id, mc.car_label, mc.plate, mc.purchase_date, mc.selling_price, mc.dealership,
         t.step_key, t.status, t.sort_order, t.due_date
  from my_customers mc
  join post_sale_tasks t on t.lead_id = mc.lead_id
  order by mc.purchase_date desc nulls last, t.sort_order;
$function$;

revoke all on function public.get_my_purchase_tracker() from public, anon;
grant execute on function public.get_my_purchase_tracker() to authenticated;

commit;
