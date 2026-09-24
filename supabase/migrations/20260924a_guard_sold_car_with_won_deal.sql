-- SWEEP-1: a sold car could be set back to 'available' while its deal stayed won.
--
-- 12 won leads pointed at cars that were no longer 'sold'. Every one had been
-- sold (sold_at stamped by auto_create_customer_on_won) and then a person flipped
-- the car back with a status dropdown (dealer OwnerCarPanel -> handleStatus,
-- salesman panels -> update_listing_status). The car went back on sale while the
-- customer row, the 8 handover steps and the commission all still existed: the
-- won = sold rule broken in the reverse direction.
--
-- Fix lives in the DB so it covers every client at once:
--   1. guard trigger: a car with a live won deal cannot leave 'sold'.
--   2. undo_car_sale(): the ONE way to reverse a sale. Reopens the deal
--      (won -> negotiating), deletes the rows the won-trigger created for it
--      (customer + handover steps; the lead keeps every buyer detail, and a
--      re-win recreates both), then relists the car. Refuses when a service
--      package was sold against the deal, because that is real money.

create or replace function public.guard_sold_car_with_won_deal()
returns trigger
language plpgsql
security definer          -- must see every lead on the car, not just the caller's (RLS)
set search_path = public
as $$
begin
  if old.status = 'sold'
     and new.status is distinct from 'sold'
     and coalesce(current_setting('app.undo_sale', true), '') <> 'on'
     and exists (
       select 1 from leads l
        where l.car_listing_id = new.id
          and l.stage in ('won', 'closed_won')
          and coalesce(l.is_deleted, false) = false
     )
  then
    raise exception 'car_has_won_deal'
      using hint = 'This car has a won deal. Use Undo sale to reopen the deal and relist the car.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_sold_car on public.car_listings;
create trigger trg_guard_sold_car
  before update of status on public.car_listings
  for each row execute function public.guard_sold_car_with_won_deal();

create or replace function public.undo_car_sale(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_car   car_listings%rowtype;
  v_leads uuid[];
  v_pkgs  int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_car from car_listings where id = p_listing_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select role into v_role from profiles where id = v_uid;

  -- Who may reverse a sale: the owning dealer (or a self-owned salesman, who is
  -- their own dealer), that dealer's manager/admin, the rep who closed it, or a
  -- superadmin. A linked salesman cannot reverse a colleague's sale.
  if not (
       is_superadmin()
    or v_car.dealer_id = v_uid
    or (v_role in ('manager', 'admin') and v_car.dealer_id = get_my_dealer_id())
    or (v_role = 'salesman' and v_car.assigned_to = v_uid)
  ) then
    raise exception 'not_allowed';
  end if;

  if v_car.status is distinct from 'sold' then
    raise exception 'not_sold';
  end if;

  select array_agg(id) into v_leads
    from leads
   where car_listing_id = p_listing_id
     and stage in ('won', 'closed_won')
     and coalesce(is_deleted, false) = false;

  if v_leads is not null then
    select count(*) into v_pkgs
      from service_packages sp
     where sp.lead_id = any(v_leads)
        or sp.customer_id in (select id from customers where lead_id = any(v_leads));
    if v_pkgs > 0 then
      raise exception 'sale_has_service_packages'
        using hint = 'A service package was sold on this deal. Remove it before undoing the sale.';
    end if;

    delete from post_sale_tasks where lead_id = any(v_leads);
    delete from customers       where lead_id = any(v_leads);
    update leads set stage = 'negotiating', updated_at = now() where id = any(v_leads);
  end if;

  perform set_config('app.undo_sale', 'on', true);
  update car_listings
     set status = 'available', sold_at = null, sold_date = null
   where id = p_listing_id;
  perform set_config('app.undo_sale', '', true);

  return jsonb_build_object('reopened_leads', coalesce(array_length(v_leads, 1), 0));
end;
$$;

revoke all on function public.undo_car_sale(uuid) from public;
revoke all on function public.undo_car_sale(uuid) from anon;
grant execute on function public.undo_car_sale(uuid) to authenticated;
