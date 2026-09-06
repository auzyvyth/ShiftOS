-- INFRA-3, hot tables only. Applied to the live DB as: 20260906b_rls_initplan_hot_tables
--
-- A policy expression like `dealer_id = auth.uid()` re-evaluates auth.uid() ONCE
-- PER ROW SCANNED. Wrapped as `(select auth.uid())` the planner treats it as an
-- InitPlan and runs it once per query.
--
-- The same applies -- and matters far more -- to the SECURITY DEFINER helpers,
-- which are not constants but table reads: get_my_dealer_id(), is_superadmin(),
-- is_active_salesman(), is_linked_salesman(), salesman_under_listing_limit().
-- Those were doing a profiles lookup per row and are the real cost here; the
-- TODO entry only counted the auth.uid() ones.
--
-- This is a mechanical rewrite: the expression is unchanged apart from the
-- wrapper, so who can see what does not move. Verified by counting rows visible
-- to a dealer, a linked salesman, an unlinked salesman and anon across all five
-- tables before and after -- identical -- and by EXPLAIN ANALYZE showing every
-- helper subplan at loops=1.

do $$
declare
  p       record;
  names   text[] := array[
            'auth.uid', 'auth.jwt', 'auth.role',
            'get_my_dealer_id', 'is_superadmin', 'is_active_salesman',
            'is_linked_salesman', 'salesman_under_listing_limit'
          ];
  nm      text;
  pat     text;
  rep     text;
  q_new   text;
  w_new   text;
  n       int := 0;
begin
  for p in
    select c.relname as tbl, pol.polname as polname, pol.polcmd as cmd,
           pg_get_expr(pol.polqual, pol.polrelid)      as q,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as w
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relname in ('car_listings','leads','appointments',
                        'salesman_notifications','whatsapp_enquiries')
  loop
    q_new := p.q;
    w_new := p.w;

    foreach nm in array names loop
      -- The leading guard stops a bare name matching the tail of a
      -- schema-qualified one (public.is_superadmin() -> public.(select ...)).
      pat := '(^|[^.[:alnum:]_])' || replace(nm, '.', '\.') || '\(\)';
      rep := '\1(select ' || nm || '())';
      if q_new is not null then q_new := regexp_replace(q_new, pat, rep, 'g'); end if;
      if w_new is not null then w_new := regexp_replace(w_new, pat, rep, 'g'); end if;
    end loop;

    if q_new is not distinct from p.q and w_new is not distinct from p.w then
      continue;
    end if;

    if p.cmd = 'a' then                     -- INSERT: WITH CHECK only
      execute format('alter policy %I on public.%I with check (%s)', p.polname, p.tbl, w_new);
    elsif p.w is not null then              -- UPDATE / ALL: both halves
      execute format('alter policy %I on public.%I using (%s) with check (%s)',
                     p.polname, p.tbl, q_new, w_new);
    else                                    -- SELECT / DELETE: USING only
      execute format('alter policy %I on public.%I using (%s)', p.polname, p.tbl, q_new);
    end if;

    n := n + 1;
  end loop;

  raise notice 'rewrote % policies', n;
end $$;
