-- Money tables: only the dealer themself (or their accountant) may read or write.
-- A standalone seller is their own dealer (auth.uid() = dealer_id), so Lite/Premium are unaffected.
-- Linked salesman / manager / admin / fi_officer lose access to these 7 tables.
begin;

create or replace function public.can_see_dealer_money(p_dealer uuid)
 returns boolean language sql stable security definer
 set search_path to 'pg_catalog', 'public'
as $$
  select p_dealer is not null and (
    p_dealer = auth.uid()
    or exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.role = 'accountant' and me.dealer_id = p_dealer)
  );
$$;
revoke all on function public.can_see_dealer_money(uuid) from public, anon;
grant execute on function public.can_see_dealer_money(uuid) to authenticated, service_role;

-- deal_financials
drop policy if exists "dealer owns deal_financials" on public.deal_financials;
drop policy if exists dealer_own on public.deal_financials;
create policy money_roles_all on public.deal_financials for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

-- commission_rules
drop policy if exists "dealer owns rules" on public.commission_rules;
drop policy if exists dealer_own on public.commission_rules;
create policy money_roles_all on public.commission_rules for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

-- expense_entries
drop policy if exists "dealer owns expenses" on public.expense_entries;
drop policy if exists dealer_own on public.expense_entries;
create policy money_roles_all on public.expense_entries for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

-- month_close_checklist
drop policy if exists "dealer owns month_close" on public.month_close_checklist;
drop policy if exists dealer_own on public.month_close_checklist;
create policy money_roles_all on public.month_close_checklist for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

-- ad_spend (superadmin read policy stays)
drop policy if exists ad_spend_team_all on public.ad_spend;
create policy money_roles_all on public.ad_spend for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

-- dealer_cost_settings (superadmin read policy stays)
drop policy if exists cost_settings_team_all on public.dealer_cost_settings;
create policy money_roles_all on public.dealer_cost_settings for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

-- dealer_goals
drop policy if exists "Dealer manages own goals" on public.dealer_goals;
create policy money_roles_all on public.dealer_goals for all to authenticated
  using (public.can_see_dealer_money(dealer_id)) with check (public.can_see_dealer_money(dealer_id));

commit;
