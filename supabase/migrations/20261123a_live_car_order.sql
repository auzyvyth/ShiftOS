-- LIVE-ORDER (owner, 2026-11-23): a seller arranges their own "#N" numbers in the
-- Live presenter (brand by brand, car by car). "#N" is the position on the mini
-- page, so the order must live on the ACCOUNT, not the device: viewers read the
-- same numbers on /s/<slug>. Ordering only: a list of the seller's own car ids.
alter table public.profiles
  add column if not exists car_order uuid[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_car_order_max;
alter table public.profiles
  add constraint profiles_car_order_max check (cardinality(car_order) <= 200);

-- Save. Keeps only cars the caller can show on their page (own, assigned or
-- featured); anything else is dropped, never an error, so a car reassigned
-- mid-live cannot block the save. Duplicates keep their first position.
create or replace function public.set_my_car_order(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare v_ids uuid[];
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles where id = auth.uid() and role = 'salesman') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if cardinality(coalesce(p_ids, '{}')) > 200 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  select coalesce(array_agg(d.x order by d.o), '{}') into v_ids
    from (select x, min(o) as o from unnest(coalesce(p_ids, '{}')) with ordinality as t(x, o) group by x) d
   where exists (select 1 from public.car_listings c
                  where c.id = d.x
                    and (c.dealer_id = auth.uid() or c.assigned_to = auth.uid()
                         or exists (select 1 from public.salesman_listings sl
                                     where sl.listing_id = c.id and sl.salesman_id = auth.uid())));
  update public.profiles set car_order = v_ids where id = auth.uid();
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids));
end $$;

-- Read, for the public page. Same gate as get_agent_pins minus the plan check:
-- the order is just how the seller's already-public cars are numbered.
create or replace function public.get_agent_car_order(p_slug text)
returns uuid[]
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(p.car_order, '{}')
    from public.profiles p
   where p.slug = nullif(btrim(p_slug), '')
     and p.role = 'salesman'
     and coalesce(p.is_active, false) and p.suspended_at is null
     and p.account_status is distinct from 'deleted'
   limit 1;
$$;

revoke all on function public.set_my_car_order(uuid[]) from public, anon;
grant execute on function public.set_my_car_order(uuid[]) to authenticated;
revoke all on function public.get_agent_car_order(text) from public;
grant execute on function public.get_agent_car_order(text) to anon, authenticated;
