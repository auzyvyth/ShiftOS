-- DRAFTS-1 fix (2026-11-16): a salesman under a dealer could ADD a draft car but never EDIT or RESUBMIT it.
-- car_listings had no UPDATE rule for a linked salesman (salesman_updates_own_listings needs dealer_id = auth.uid(),
-- which only fits standalone sellers), so "Edit & resubmit" on a rejected car changed 0 rows and the car stayed
-- rejected for good. Found by a rolled-back probe against the live DB.
-- Rule: a linked salesman may update ONLY a car THEY submitted, ONLY while it is pending_approval or rejected, and
-- the result is always pending_approval with the reason cleared. Cost, assignee, dealer and submitter stay as they were.
-- One migration = one API freeze: apply after midnight MYT with nobody live. Needs 20261114d.
begin;

drop policy if exists linked_salesman_edits_own_draft on public.car_listings;
create policy linked_salesman_edits_own_draft on public.car_listings
  for update to authenticated
  using (
    submitted_by = (select auth.uid())
    and status in ('pending_approval', 'rejected')
    and dealer_id = (select public.get_my_dealer_id())
    and (select public.is_linked_salesman())
  )
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending_approval'
    and dealer_id = (select public.get_my_dealer_id())
    and (select public.is_linked_salesman())
  );

-- Whatever the client sends, a draft edit cannot touch money, the owner's assignment or who it belongs to.
-- It acts ONLY on the salesman's own draft/rejected car, so a won-trigger or any other definer function that
-- runs as the salesman on a live car is left alone.
create or replace function public.guard_linked_salesman_draft_edit()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if auth.uid() is null or old.submitted_by is distinct from auth.uid()
     or old.status not in ('pending_approval', 'rejected') then
    return new;
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'salesman'
                    and p.dealer_id is not null and p.dealer_id = old.dealer_id) then
    return new;
  end if;
  new.dealer_id        := old.dealer_id;
  new.submitted_by     := old.submitted_by;
  new.assigned_to      := old.assigned_to;
  new.purchase_price   := old.purchase_price;
  new.base_price       := old.base_price;
  new.recon_cost       := old.recon_cost;
  new.status           := 'pending_approval';
  new.rejection_reason := null;
  return new;
end $$;

drop trigger if exists trg_a_linked_salesman_draft_edit on public.car_listings;
create trigger trg_a_linked_salesman_draft_edit before update on public.car_listings
  for each row execute function public.guard_linked_salesman_draft_edit();

commit;
