-- Two fixes to the admin approval loop.
--
-- Applied live via MCP apply_migration on 2026-08-28 (migrations
-- signup_alert_fires_when_reviewable + realtime_for_kyc_documents);
-- committed here so the repo carries the source.

-- 1) The "new signup pending review" alert fired far too early -----------------
--
-- It was an AFTER INSERT trigger on profiles, and handle_new_user() inserts
-- that row the instant auth.users gets one -- i.e. the moment someone submits
-- the signup form, BEFORE they confirm their email and before they have
-- entered a name, phone or plan. The admin was pinged for accounts with nothing
-- to review that might never come back, and when the account actually BECAME
-- reviewable, no alert fired at all.
--
-- Now it fires when the account becomes REVIEWABLE:
--   a) onboarding_complete flips true while approval_status = 'pending'
--      (they confirmed their email, logged in and finished onboarding -- both
--      DealerOnboarding and SalesmanOnboarding set this only at the end), or
--   b) approval_status returns to 'pending' on an already-onboarded account
--      (a rejected seller resubmitting -- see submit_kyc).
create or replace function public.notify_admin_on_new_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_msg text;
  v_became_reviewable boolean;
begin
  v_became_reviewable :=
       (coalesce(old.onboarding_complete, false) = false
        and new.onboarding_complete = true
        and new.approval_status = 'pending')
    or (new.approval_status = 'pending'
        and old.approval_status is distinct from 'pending'
        and coalesce(new.onboarding_complete, false) = true);

  if not v_became_reviewable then
    return new;
  end if;

  v_msg :=
    '🆕 New signup pending review' || E'\n' ||
    coalesce(new.full_name, new.email, 'A new user') || ' — ' || coalesce(new.role, '—') ||
    coalesce(' (' || new.dealership || ')', '') || E'\n' ||
    'Plan: ' || coalesce(new.plan::text, '—') ||
    coalesce(' · ' || nullif(trim(coalesce(new.city, '') || ', ' || coalesce(new.state, '')), ','), '');

  perform notify_ops('new_signup:' || new.id::text, v_msg);
  return new;
exception when others then
  return new;
end;
$function$;

-- INSERT no longer alerts; the account is not reviewable yet.
drop trigger if exists trg_notify_admin_on_new_signup on public.profiles;
drop trigger if exists trg_notify_admin_on_new_signup_upd on public.profiles;
create trigger trg_notify_admin_on_new_signup_upd
  after update on public.profiles
  for each row
  execute function public.notify_admin_on_new_signup();

-- 2) Realtime for the console's approval queues -------------------------------
--
-- Push tells the admin when the console is CLOSED, but it is not a dependable
-- "instant" signal by itself: a browser can silently rotate its subscription
-- (send-push deletes it on a 410) and the admin is then unreachable with
-- nothing on screen to say so -- which is exactly what happened. With the
-- console open, realtime is the reliable path.
--
-- car_listings is already in the publication. kyc_documents is added here and
-- is safe to publish: RLS restricts it to superadmins (kyc_docs_superadmin_read)
-- and the row's own owner, and realtime evaluates RLS per subscriber.
--
-- profiles is deliberately NOT published: it is the most-written table in the
-- app, and publishing it would put every subscriber's RLS in the path of every
-- profile update. AdminPage uses a slow interval refresh for that queue instead.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kyc_documents'
  ) then
    alter publication supabase_realtime add table public.kyc_documents;
  end if;
end $$;
