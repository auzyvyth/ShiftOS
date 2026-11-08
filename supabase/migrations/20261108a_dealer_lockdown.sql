-- Dealer lock-down (docs/DEALER_DIAGNOSIS.md, batch 1). Owner, 2026-11-08.
--
-- 1. Leads: a linked salesman reads and edits ONLY their own leads, and can SEE the
--    unassigned dealer pool (claiming stays the claim_lead() function, first come first
--    served). Dealer-side roles keep the full view. Before this, the permissive policy
--    leads_dealer_reads_salesman_leads let every linked account read every buyer of the
--    dealer, and leads_team_update let them edit (and reassign) any of them.
-- 2. stock_units (purchase price, recon, gross): dealer, manager, accountant only.
--    Salesmen get the few non-money fields they use through get_dealer_stock_basic().
-- 3. dealer_documents: an issued document can no longer be edited by anyone through the
--    API (send-document uses the service role to stamp email_sent_at, unaffected).
--
-- Not in this batch: buy-price columns on car_listings (batch 4, needs readers moved).

begin;

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function public.my_profile_role()
returns text language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$ select role from public.profiles where id = auth.uid() $$;

revoke all on function public.my_profile_role() from public, anon;
grant execute on function public.my_profile_role() to authenticated;

-- Who may see stock costs for a dealer: the dealer, their accountant (can_see_dealer_money),
-- and their manager.
create or replace function public.can_see_dealer_stock(p_dealer uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.can_see_dealer_money(p_dealer)
      or exists (select 1 from public.profiles me
                  where me.id = auth.uid() and me.role = 'manager' and me.dealer_id = p_dealer)
$$;

revoke all on function public.can_see_dealer_stock(uuid) from public, anon;
grant execute on function public.can_see_dealer_stock(uuid) to authenticated;

-- ── 1. leads ───────────────────────────────────────────────────────────────
drop policy if exists leads_dealer_reads_salesman_leads on public.leads;
drop policy if exists leads_team_update on public.leads;

create policy leads_dealer_side_select on public.leads
  for select to authenticated
  using (
    (select public.my_profile_role()) in ('dealer','owner','manager','admin','accountant','fi_officer','superadmin')
    and (
      dealer_id = (select public.get_my_dealer_id())
      or salesman_id in (select p.id from public.profiles p
                          where p.dealer_id = (select public.get_my_dealer_id())
                            and p.role = 'salesman')
    )
  );

-- The incoming pool (Salesmanpanel fetchPool): unassigned leads of the salesman's dealer.
create policy leads_salesman_pool_select on public.leads
  for select to authenticated
  using (
    salesman_id is null
    and dealer_id = (select public.get_my_dealer_id())
    and (select public.is_linked_salesman())
  );

create policy leads_dealer_side_update on public.leads
  for update to authenticated
  using (
    dealer_id = (select public.get_my_dealer_id())
    and (select public.my_profile_role()) in ('dealer','owner','manager','admin','fi_officer','superadmin')
  )
  with check (
    dealer_id = (select public.get_my_dealer_id())
    and (select public.my_profile_role()) in ('dealer','owner','manager','admin','fi_officer','superadmin')
  );
-- Salesmen keep leads_salesman_linked_update (own rows, cannot hand them to another dealer).

-- ── 2. stock_units ─────────────────────────────────────────────────────────
drop policy if exists stock_team_all on public.stock_units;

create policy stock_money_roles_all on public.stock_units
  for all to authenticated
  using (public.can_see_dealer_stock(dealer_id))
  with check (public.can_see_dealer_stock(dealer_id));
-- Standalone sellers (Lite/Premium) own their stock: dealer_id = auth.uid() passes.

create or replace function public.get_dealer_stock_basic(p_listing_id uuid default null)
returns table (
  id uuid, listing_id uuid, brand text, model text, year integer,
  registration_number text, asking_price numeric, encumbrance_status text, status text
)
language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select s.id, s.listing_id, s.brand, s.model, s.year::integer,
         s.registration_number, s.asking_price, s.encumbrance_status, s.status
    from public.stock_units s
   where s.dealer_id = public.get_my_dealer_id()
     and (p_listing_id is null or s.listing_id = p_listing_id)
$$;

revoke all on function public.get_dealer_stock_basic(uuid) from public, anon;
grant execute on function public.get_dealer_stock_basic(uuid) to authenticated;

-- ── 3. dealer_documents: issued = read-only ────────────────────────────────
drop policy if exists documents_team_update on public.dealer_documents;

create policy documents_team_update on public.dealer_documents
  for update to authenticated
  using (
    dealer_id = (select public.get_my_dealer_id())
    and doc_status is distinct from 'issued'
  )
  with check (dealer_id = (select public.get_my_dealer_id()));

commit;
