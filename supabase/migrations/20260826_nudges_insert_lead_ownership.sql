-- scheduled_nudges' insert policy only checked salesman_id = auth.uid(), never
-- that lead_id actually belongs to a lead the salesman/dealer owns. A salesman
-- who obtained another dealer's lead_id (a UUID, not normally exposed) could
-- attach a nudge to it; fire_due_nudges() (SECURITY DEFINER) would then push
-- that lead's buyer_name into the attacker's own salesman_notifications/push --
-- a cross-tenant name leak via confused deputy. Add the same lead-ownership
-- predicate the SELECT/UPDATE/DELETE policies already use elsewhere in this
-- app (salesman_id match or dealer scope), checked against the real leads row
-- rather than relied on leads' own RLS.

drop policy if exists nudges_own_insert on public.scheduled_nudges;

create policy nudges_own_insert on public.scheduled_nudges for insert
  with check (
    salesman_id = auth.uid()
    and exists (
      select 1 from public.leads l
       where l.id = lead_id
         and (l.salesman_id = auth.uid() or l.dealer_id = public.get_my_dealer_id())
    )
  );
