-- INFRA-3, the tail: every remaining public table.
-- Applied to the live DB as: 20260906c_rls_initplan_remaining_tables
--
-- Same mechanical rewrite as 20260906d (which covered the five hot tables):
-- `auth.uid()` and the SECURITY DEFINER helpers re-evaluate ONCE PER ROW
-- SCANNED inside a policy. Wrapped as `(select auth.uid())` the planner makes
-- them an InitPlan and runs them once per query. The helpers matter most --
-- get_my_dealer_id(), is_superadmin(), is_active_salesman(), is_linked_salesman()
-- and salesman_under_listing_limit() are profiles lookups, not constants.
--
-- The expression is otherwise untouched, so who can see what does not move.
-- Verified by counting rows visible to a dealer, a linked salesman, a
-- standalone salesman, a buyer and anon across 25 tables before and after --
-- identical -- and by confirming no policy is left with an unwrapped call.
--
-- To reverse: strip the `(select ...)` wrapper. The rewrite is exactly
-- reversible, which is why no backup table is kept.
--
-- The five tables from 20260906d are excluded: the pattern below matches the
-- inner call of an already-wrapped expression too, so re-running over them
-- would nest a second `(select ...)`.

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
      and c.relname not in ('car_listings','leads','appointments',
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
