-- ONE access check for the dealer team: dealer_can(dealer, capability) (owner, 2026-11-13: "the owner
-- controls and gives access to the manager with anything", and "the option to just cross out manager").
-- Plain version: the switches in Settings > Team were saved in role_permissions but only the
-- BROWSER read them, so "hide cost from my manager" hid a screen and nothing else. After this the
-- database asks dealer_can() too.
--
-- QUEUED, NOT APPLIED. DDL after midnight Malaysia time with nobody live (CLAUDE.md). One migration.
-- Before applying, read the live state (the role_permissions policies were made in the dashboard
-- and are not in this repo):
--   select policyname, cmd, qual, with_check from pg_policies where tablename = 'role_permissions';
--   select oid::regprocedure from pg_proc where proname in ('dealer_can','dealer_cap_default');
--
-- Owner-only, never a switch: billing, adding/removing staff (invites edge function), changing the
-- switches (role_permissions write policy below), deleting the dealership.
begin;

-- 1. Defaults. A MIRROR of CAPABILITIES in src/lib/permissions.js; `npm run test:dealercan` fails
--    when the two disagree. Change both together.
create or replace function public.dealer_cap_default(p_role text, p_cap text)
returns boolean language sql immutable
set search_path to 'pg_catalog'
as $$
  select coalesce((select d.val from (values
    ('salesman', 'view_commission', true),
    ('salesman', 'view_all_leads', false),
    ('manager', 'view_cost', true),
    ('admin', 'view_cost', false),
    ('manager', 'view_gross', true),
    ('admin', 'view_gross', false),
    ('manager', 'export_data', true),
    ('admin', 'export_data', true),
    ('manager', 'assign_leads', true),
    ('manager', 'assign_cars', true),
    ('manager', 'add_staff', false),
    ('manager', 'approve_listings', true),
    ('manager', 'change_price', true),
    ('manager', 'delete_car', false),
    ('manager', 'approve_deals', true),
    ('manager', 'edit_settings', false),
    ('manager', 'tab_crm', true),
    ('admin', 'tab_crm', true),
    ('manager', 'tab_hp', true),
    ('admin', 'tab_hp', true),
    ('manager', 'tab_inventory', true),
    ('admin', 'tab_inventory', true),
    ('manager', 'tab_stock', true),
    ('admin', 'tab_stock', false),
    ('manager', 'tab_sold', true),
    ('admin', 'tab_sold', true),
    ('manager', 'tab_revenue', true),
    ('admin', 'tab_revenue', false),
    ('manager', 'tab_performance', true),
    ('admin', 'tab_performance', false),
    ('manager', 'tab_reports_listings', true),
    ('admin', 'tab_reports_listings', true),
    ('manager', 'tab_storefront', false),
    ('admin', 'tab_storefront', false),
    ('manager', 'tab_ai_manager', true),
    ('admin', 'tab_ai_manager', false),
    ('manager', 'tab_team', true),
    ('admin', 'tab_team', false)
  ) as d(role, cap, val) where d.role = p_role and d.cap = p_cap), false)
$$;

-- 2. The check. Owner (the dealer account itself) and the platform admin: always yes. A team
--    member of THIS dealer: the owner's stored switch, else the default. Anyone else: no.
--    "Do you have a manager?" = No (role_enabled false on the manager row) switches a manager off.
create or replace function public.dealer_can(p_dealer uuid, p_cap text)
returns boolean language plpgsql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_role text;
  v_perm jsonb;
begin
  if auth.uid() is null or p_dealer is null then return false; end if;
  if p_dealer = auth.uid() or public.is_superadmin() then return true; end if;
  select me.role into v_role from public.profiles me
   where me.id = auth.uid() and me.dealer_id = p_dealer
     and coalesce(me.is_active, true);
  if v_role is null then return false; end if;
  select rp.permissions into v_perm from public.role_permissions rp
   where rp.dealer_id = p_dealer and rp.role = v_role;
  if v_role = 'manager' and jsonb_typeof(v_perm -> 'role_enabled') = 'boolean'
     and not (v_perm ->> 'role_enabled')::boolean then
    return false;
  end if;
  if jsonb_typeof(v_perm -> p_cap) = 'boolean' then
    return (v_perm ->> p_cap)::boolean;
  end if;
  return public.dealer_cap_default(v_role, p_cap);
end $$;
revoke all on function public.dealer_can(uuid, text) from public, anon;
grant execute on function public.dealer_can(uuid, text) to authenticated;
revoke all on function public.dealer_cap_default(text, text) from public, anon;

-- 3. Stock (buy prices): accountant and owner as before (can_see_dealer_money); a manager or
--    admin only while "View stock cost" is on (manager: on by default; admin: off). It was every
--    manager, always. NOTE: stock_units' policy is FOR ALL, so this switch also gives write;
--    splitting read from write is a follow-up.
create or replace function public.can_see_dealer_stock(p_dealer uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.can_see_dealer_money(p_dealer)
      or exists (select 1 from public.profiles me
                  where me.id = auth.uid() and me.role in ('manager', 'admin') and me.dealer_id = p_dealer)
         and public.dealer_can(p_dealer, 'view_cost')
$$;

-- 4. The two money tables the profit sum needs, READ only, for a manager/admin with
--    "View gross profit" on. Without them a manager's profit skipped ad spend and the cost
--    settings and read higher than the owner's. Writes stay owner + accountant.
drop policy if exists money_view_gross_select on public.ad_spend;
create policy money_view_gross_select on public.ad_spend for select to authenticated
  using ((select public.dealer_can(dealer_id, 'view_gross')));
drop policy if exists money_view_gross_select on public.dealer_cost_settings;
create policy money_view_gross_select on public.dealer_cost_settings for select to authenticated
  using ((select public.dealer_can(dealer_id, 'view_gross')));

-- 5. The switches themselves: the team reads its own dealer's rows (the dashboard needs them);
--    ONLY the owner writes. Every existing policy is replaced (they were made in the dashboard).
alter table public.role_permissions enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'role_permissions' loop
    execute format('drop policy %I on public.role_permissions', p.policyname);
  end loop;
end $$;
create policy rp_team_read on public.role_permissions for select to authenticated
  using (dealer_id = (select public.get_my_dealer_id()) or (select public.is_superadmin()));
create policy rp_owner_write on public.role_permissions for all to authenticated
  using ((dealer_id = auth.uid() and (select public.my_profile_role()) in ('dealer', 'owner')) or (select public.is_superadmin()))
  with check ((dealer_id = auth.uid() and (select public.my_profile_role()) in ('dealer', 'owner')) or (select public.is_superadmin()));

commit;
