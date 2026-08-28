-- A1/A2: the admin console's salesman "Delete" must be a soft delete.
--
-- Applied live via MCP apply_migration on 2026-08-28
-- (migration admin_delete_is_soft_delete_only); committed here so the repo
-- carries the source.
--
-- Part 1 -- close the client-side hard-delete path for good.
--
-- Two RLS policies let a browser session run DELETE FROM profiles, which
-- cascades through ~50 tables. For a standalone Lite/Premium seller
-- dealer_id IS NULL, so they ARE their own dealer and every car, lead,
-- customer, deal and chat thread cascades away with them -- including rows the
-- PLATFORM reports on (sold cars feeding MRR/GP, buyer reviews, analytics).
--
-- Nothing legitimate uses either policy: the only client-side profiles delete
-- in the app was AdminPage.deleteSalesman (now a soft delete), and
-- purge-deleted-accounts hard-deletes via auth.admin.deleteUser on the service
-- role, which bypasses RLS entirely. Dropping them makes "soft delete only"
-- enforceable in the database instead of by convention.
drop policy if exists superadmin_delete_any_profile on public.profiles;
drop policy if exists delete_own_profile on public.profiles;

-- Part 2 -- stop the eventual hard delete from failing on audit-trail columns.
--
-- Four FKs onto profiles are NO ACTION. Any account that ever accepted an
-- invite, or approved / verified / granted a plan to someone else, cannot be
-- deleted at all: the delete raises a foreign-key error. That is what made the
-- old console button fail silently, and it would ALSO make
-- purge-deleted-accounts fail 30 days after every soft delete.
--
-- All four are attribution columns, all nullable. SET NULL is the right
-- semantics: the action still happened, the actor's account is simply gone.
alter table public.dealer_invites
  drop constraint dealer_invites_accepted_by_fkey,
  add constraint dealer_invites_accepted_by_fkey
    foreign key (accepted_by) references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint profiles_approved_by_fkey,
  add constraint profiles_approved_by_fkey
    foreign key (approved_by) references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint profiles_verified_by_fkey,
  add constraint profiles_verified_by_fkey
    foreign key (verified_by) references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint profiles_plan_granted_by_fkey,
  add constraint profiles_plan_granted_by_fkey
    foreign key (plan_granted_by) references public.profiles(id) on delete set null;
