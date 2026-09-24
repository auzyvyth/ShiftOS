-- Stock tab recon jobs: the policy was dealer_id = auth.uid(), so a manager or
-- admin running the dealer's stock saw an empty recon list and every write they
-- made was rejected. Same scope as the team roles get on the dealer dashboard;
-- linked salesmen stay out (recon cost is margin data).
drop policy if exists dealer_recon_jobs on public.recon_jobs;
create policy dealer_recon_jobs on public.recon_jobs
  for all
  using (
    dealer_id = (select auth.uid())
    or (dealer_id = (select get_my_dealer_id())
        and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role in ('manager','admin')))
  )
  with check (
    dealer_id = (select auth.uid())
    or (dealer_id = (select get_my_dealer_id())
        and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role in ('manager','admin')))
  );
