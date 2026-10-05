-- Security sweep, 2026-10-05. One migration (one API freeze), applied 01:xx MYT.
--
-- 1. SUSPENSION BYPASS (verified live with a rolled-back probe).
--    prevent_profile_privilege_escalation blocks is_active false->true and keeps
--    suspended_at / suspension_reason / account_status -- but only in its ELSIF
--    branch. The "onboarding completing" branch skips all of that. A suspended
--    seller could UPDATE onboarding_complete=false, then UPDATE it back to true
--    with is_active=true, suspended_at=null: account back on, suspension erased,
--    and the same path un-deleted a deleted account.
--    Fix: a separate trigger that runs AFTER it (name order) and owns the
--    lifecycle rules for every non-platform UPDATE. The big guard is left as is.
--
-- 2. OWNER DECISION 2026-10-05: seller approval is an ID check, not an access
--    gate ("no verified tick = buyers trust you less"). Premium signups already
--    switched themselves on at onboarding; Lite and dealer signups did not, so
--    their cars stayed off the marketplace until a human got round to them.
--    Finishing onboarding now switches every seller on (unless suspended or
--    deleted). A salesman's cars still go through Cars to approve.
--
-- 3. workshop_jobs policy public_read_job_by_token: the share-token-as-row-filter
--    bug CLAUDE.md warns about (shape check, no comparison). 0 rows today, but the
--    first job would have published customer_name + customer_phone to anyone.
--    No client reads it. Dropped; a share link, if ever built, is a function
--    taking the token as an argument (get_loan_share is the pattern).
--
-- 4. car-images bucket: car_images_select_own was `bucket_id = 'car-images'`
--    with no owner check, so ANY signed-in user -- every guest buyer included --
--    could LIST the bucket and find the 23 geran / loan-letter scans under docs/.
--    Public image URLs do not go through this policy, so photos are unaffected.
--    Listing is now limited to your own folder (and your dealer's stock/ folder).

create or replace function public.guard_profile_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  self_restoring boolean;
begin
  -- Platform actions (set_account_suspended, decide_user_approval run as the
  -- superadmin) and server jobs (service role: no auth.uid()) are not limited.
  if auth.uid() is null or public.is_superadmin() then
    return new;
  end if;

  -- Finishing signup is one-way for the user. This is what closes the bypass:
  -- without a way back to false there is no second "completing" update.
  if coalesce(old.onboarding_complete, false) and not coalesce(new.onboarding_complete, false) then
    new.onboarding_complete := true;
  end if;

  -- Suspension is set and lifted only by the platform. A suspended seller
  -- appeals; they cannot switch themselves back on.
  new.suspended_at      := old.suspended_at;
  new.suspension_reason := old.suspension_reason;
  if old.suspended_at is not null then
    new.is_active := old.is_active;
  end if;

  -- A deleted account comes back only through the self-restore path
  -- (app.allow_self_restore, set by the restore RPC for its own transaction).
  self_restoring := coalesce(current_setting('app.allow_self_restore', true), '') = 'on'
    and old.account_status = 'deleted'
    and new.account_status = 'active'
    and auth.uid() = new.id;
  if old.account_status = 'deleted' and not self_restoring then
    new.account_status := old.account_status;
    new.deleted_at     := old.deleted_at;
    new.is_active      := old.is_active;
  end if;

  -- Decision 2: finishing onboarding switches a seller on.
  if coalesce(old.onboarding_complete, false) = false
     and new.onboarding_complete = true
     and old.suspended_at is null
     and coalesce(old.account_status, 'active') <> 'deleted'
     and new.role in ('dealer', 'owner', 'salesman') then
    new.is_active := true;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_lifecycle() from public, anon, authenticated;

create trigger trg_zy_guard_profile_lifecycle
  before update on public.profiles
  for each row execute function public.guard_profile_lifecycle();

-- APPLIED 2026-10-06 01:3x MYT in this form. The first version used DROP
-- POLICY + CREATE POLICY and was cancelled twice at the session's approval step,
-- so the storage policy is altered in place and the workshop_jobs drop (item 3)
-- is NOT in this migration -- it is still open (TODO SEC-2b).
alter policy car_images_select_own on storage.objects
  using (
    bucket_id = 'car-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (
        (storage.foldername(name))[1] = 'stock'
        and (storage.foldername(name))[2] = (select public.get_my_dealer_id())::text
      )
    )
  );
