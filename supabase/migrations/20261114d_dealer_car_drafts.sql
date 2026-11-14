-- DRAFTS-1 (owner, 2026-11-14): a salesman under a dealer DRAFTS a car; the owner, or a manager
-- with "Approve listings", publishes it once the buy price is in. Before this a linked salesman
-- could not add a dealer car at all (every insert policy needed dealer_id = auth.uid() or a
-- dealer-side role), so dealers shared one login to list cars.
-- Needs 20261114c (dealer_can). Apply in the release window, one migration.
begin;

-- Who drafted the car, so the approve / reject reaches them. Not in public_car_listings.
alter table public.car_listings
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null;

-- 1. A linked salesman may insert a car for THEIR dealer, only as a draft.
drop policy if exists linked_salesman_drafts_dealer_car on public.car_listings;
create policy linked_salesman_drafts_dealer_car on public.car_listings
  for insert to authenticated
  with check (
    dealer_id = (select public.get_my_dealer_id())
    and (select public.is_linked_salesman())
    and status = 'pending_approval'
  );

-- 2. Whatever the client sends, that car lands as a draft, with no cost on it (salesmen never
--    see or set buy prices), not locked to anyone, stamped with who sent it. Runs before
--    trg_zz_dealer_costs_off_listing, so no cost reaches the stock unit either.
create or replace function public.dealer_draft_from_salesman()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if auth.uid() is null then return new; end if;
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'salesman'
                    and p.dealer_id is not null and p.dealer_id = new.dealer_id) then
    return new;
  end if;
  new.status         := 'pending_approval';
  new.purchase_price := null;
  new.base_price     := null;
  new.recon_cost     := null;
  new.assigned_to    := null;
  new.submitted_by   := auth.uid();
  return new;
end $$;

drop trigger if exists trg_a_salesman_draft on public.car_listings;
create trigger trg_a_salesman_draft before insert on public.car_listings
  for each row execute function public.dealer_draft_from_salesman();

-- A client never sets submitted_by itself.
create or replace function public.guard_submitted_by()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public'
as $$
begin
  if auth.uid() is not null and new.submitted_by is distinct from old.submitted_by then
    new.submitted_by := old.submitted_by;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_submitted_by on public.car_listings;
create trigger trg_guard_submitted_by before update of submitted_by on public.car_listings
  for each row execute function public.guard_submitted_by();

-- 3. The owner hears about a draft (the row is also the push). The platform ops alert skips
--    dealer drafts: they are the dealer's to approve, not the platform's.
create or replace function public.notify_dealer_on_draft()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare v_name text;
begin
  if new.submitted_by is null then return new; end if;
  select coalesce(full_name, 'A salesman') into v_name from public.profiles where id = new.submitted_by;
  insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
  values (new.dealer_id, 'listing_draft', 'Car waiting for approval',
          v_name || ' added ' || trim(coalesce(new.year::text, '') || ' ' || coalesce(new.brand, '') || ' ' || coalesce(new.model, ''))
            || '. Fill in the buy price and approve it.',
          '/dashboard/listings', new.id);
  return new;
exception when others then
  raise warning 'notify_dealer_on_draft: %', sqlerrm;
  return new;
end $$;
drop trigger if exists trg_notify_dealer_on_draft on public.car_listings;
create trigger trg_notify_dealer_on_draft after insert on public.car_listings
  for each row when (new.submitted_by is not null)
  execute function public.notify_dealer_on_draft();

create or replace function public.notify_admin_on_pending_listing()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_seller text;
  v_msg    text;
begin
  if new.submitted_by is not null then return new; end if;
  select coalesce(full_name, email, 'A seller') into v_seller
  from profiles where id = new.dealer_id;

  v_msg :=
    '🚗 New listing pending approval' || E'\n' ||
    trim(coalesce(new.year::text, '') || ' ' || coalesce(new.brand, '') || ' ' ||
         coalesce(new.model, '') || ' ' || coalesce(new.variant, '')) ||
    coalesce(E'\nRM ' || to_char(new.selling_price, 'FM999,999,999'), '') || E'\n' ||
    'Seller: ' || coalesce(v_seller, '—');

  perform notify_ops('pending_listing:' || new.id::text, v_msg);
  return new;
exception when others then
  return new;
end;
$function$;

-- 4. Approve: the owner, or an active manager with "Approve listings". Never without a buy price.
--    A buy price may be typed here by the owner, or a manager who can see costs.
create or replace function public.dealer_approve_listing(p_listing_id uuid, p_buy_price numeric default null)
returns void language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_role   text;
  v_dealer uuid;
  v_car    public.car_listings%rowtype;
  v_cost   numeric;
begin
  select p.role, case when p.role in ('dealer', 'owner') then p.id else p.dealer_id end
    into v_role, v_dealer
    from public.profiles p where p.id = auth.uid() and coalesce(p.is_active, true);
  if v_dealer is null then raise exception 'not_allowed'; end if;
  if v_role = 'manager' then
    if not public.dealer_can(v_dealer, 'approve_listings') then raise exception 'not_allowed'; end if;
  elsif v_role not in ('dealer', 'owner') then
    raise exception 'not_allowed';
  end if;

  select * into v_car from public.car_listings where id = p_listing_id for update;
  if not found or v_car.dealer_id is distinct from v_dealer then raise exception 'not_found'; end if;
  if v_car.status <> 'pending_approval' then raise exception 'not_pending'; end if;

  if p_buy_price is not null then
    if p_buy_price <= 0 then raise exception 'needs_buy_price'; end if;
    if v_role = 'manager' and not public.dealer_can(v_dealer, 'view_cost') then raise exception 'not_allowed'; end if;
    update public.stock_units set purchase_price = p_buy_price
     where listing_id = p_listing_id and dealer_id = v_dealer;
  end if;

  select max(purchase_price) into v_cost from public.stock_units
   where listing_id = p_listing_id and dealer_id = v_dealer;
  if coalesce(v_cost, 0) <= 0 then raise exception 'needs_buy_price'; end if;

  update public.car_listings set status = 'available', rejection_reason = null where id = p_listing_id;

  if v_car.submitted_by is not null then
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_car.submitted_by, 'listing_approved', 'Your car is live',
            trim(coalesce(v_car.year::text, '') || ' ' || coalesce(v_car.brand, '') || ' ' || coalesce(v_car.model, '')) || ' is now on the marketplace.',
            p_listing_id);
  end if;
end $$;

create or replace function public.dealer_reject_listing(p_listing_id uuid, p_reason text)
returns void language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_role   text;
  v_dealer uuid;
  v_car    public.car_listings%rowtype;
  v_reason text := nullif(btrim(left(coalesce(p_reason, ''), 300)), '');
begin
  select p.role, case when p.role in ('dealer', 'owner') then p.id else p.dealer_id end
    into v_role, v_dealer
    from public.profiles p where p.id = auth.uid() and coalesce(p.is_active, true);
  if v_dealer is null then raise exception 'not_allowed'; end if;
  if v_role = 'manager' then
    if not public.dealer_can(v_dealer, 'approve_listings') then raise exception 'not_allowed'; end if;
  elsif v_role not in ('dealer', 'owner') then
    raise exception 'not_allowed';
  end if;
  if v_reason is null then raise exception 'needs_reason'; end if;

  select * into v_car from public.car_listings where id = p_listing_id for update;
  if not found or v_car.dealer_id is distinct from v_dealer then raise exception 'not_found'; end if;
  if v_car.status <> 'pending_approval' then raise exception 'not_pending'; end if;

  update public.car_listings set status = 'rejected', rejection_reason = v_reason where id = p_listing_id;

  if v_car.submitted_by is not null then
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_car.submitted_by, 'listing_rejected', 'Car sent back',
            trim(coalesce(v_car.year::text, '') || ' ' || coalesce(v_car.brand, '') || ' ' || coalesce(v_car.model, '')) || ': ' || v_reason,
            p_listing_id);
  end if;
end $$;

-- 5. The old manager-only entry point (ManagerPanel, until it is deleted) follows the same rules.
--    It skipped "Approve listings", the manager's own is_active and the buy price.
create or replace function public.manager_approve_listing(p_listing_id uuid)
returns void language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  perform public.dealer_approve_listing(p_listing_id, null);
end $$;

revoke all on function public.dealer_approve_listing(uuid, numeric) from public, anon;
revoke all on function public.dealer_reject_listing(uuid, text) from public, anon;
revoke all on function public.manager_approve_listing(uuid) from public, anon;
revoke all on function public.dealer_draft_from_salesman() from public, anon;
revoke all on function public.notify_dealer_on_draft() from public, anon;
grant execute on function public.dealer_approve_listing(uuid, numeric) to authenticated;
grant execute on function public.dealer_reject_listing(uuid, text) to authenticated;
grant execute on function public.manager_approve_listing(uuid) to authenticated;

commit;
