-- Anon-reachable SECURITY DEFINER sweep.
--
-- The Supabase advisor lists 127 SECURITY DEFINER functions that `anon` may
-- EXECUTE. Most are trigger functions (PostgREST never exposes those) or are
-- anon-facing by design. Three were neither: they take an argument, do real
-- work, and check nothing about who is calling. Confirmed live as `anon`
-- inside a rolled-back DO block before writing this.
--
-- The rest of this file is defence in depth: the admin/ops RPCs all raise
-- unless is_superadmin(), so revoking anon changes the error message and not
-- the behaviour — but it keeps the grant surface honest, and per this repo's
-- own rule a grant is only safe if you can say why it is there.

-- ---------------------------------------------------------------------------
-- 1. HIGH — login_throttle_clear reset ANY email's brute-force lockout.
--
-- `DELETE FROM auth_login_throttle WHERE email = $1` with no caller check, and
-- EXECUTE granted to anon. So the lockout that login_throttle_fail applies
-- after 3 bad passwords could be lifted by anyone, for anyone, over the public
-- REST endpoint — call it between attempts and the throttle is gone. Proven:
-- as anon, the target's throttle row went 1 -> 0.
--
-- The one legitimate caller is LoginPage.jsx, immediately after a SUCCESSFUL
-- signInWithPassword, so a session exists by then. Clearing is therefore
-- something you EARN by logging in, not something you ask for by naming an
-- email: the caller must be signed in and may only clear their own row. The
-- p_email argument is kept (the caller passes it) but is now checked against
-- the session rather than trusted.
--
-- Degrading safely matters here: if auth.uid() is somehow not set yet this
-- no-ops, and login_throttle_fail already zeroes the counter after 15 minutes
-- without a failure, so a lingering row expires on its own. It can never lock
-- a legitimate user out.
create or replace function public.login_throttle_clear(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_email text;
begin
  select lower(btrim(u.email)) into v_session_email
    from auth.users u
   where u.id = auth.uid();

  if v_session_email is null or v_session_email = '' then
    return;
  end if;
  if v_session_email is distinct from lower(btrim(coalesce(p_email, ''))) then
    return;
  end if;

  delete from public.auth_login_throttle where email = v_session_email;
end;
$$;

revoke all on function public.login_throttle_clear(text) from public;
revoke all on function public.login_throttle_clear(text) from anon;
grant execute on function public.login_throttle_clear(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. MEDIUM — get_car_analytics(uuid[]) leaked every seller's per-car numbers.
--
-- It aggregates analytics_events for whatever car ids you hand it, with no
-- ownership filter and no auth check, and anon could execute it. Car ids are
-- public by design (they come straight off public_car_listings), so any
-- visitor could pull views, enquiries and a 7-day series for every listing on
-- the marketplace — one dealer's demand signal, readable by their competitor.
-- Proven: as anon it answered for 5 arbitrary public listings.
--
-- It is also DEAD. Nothing in the app calls it; the dashboard and the salesman
-- panel both use get_dealer_car_analytics(p_dealer_id, p_days), which does the
-- ownership check this one is missing (auth.uid() = dealer, or
-- get_my_dealer_id() = dealer, or is_superadmin()). This is the superseded
-- predecessor left behind with the hole in it. Nothing depends on it
-- (pg_depend is empty), so it goes rather than gets patched — a second
-- analytics entry point is exactly the drift this repo keeps getting bitten by.
drop function if exists public.get_car_analytics(uuid[]);

-- ---------------------------------------------------------------------------
-- 3. LOW — cron_key_matches was an anon-callable oracle for the cron key.
--
-- It answers "is this the cron key?" as a boolean. The key is long and random
-- so guessing it is not a practical attack, but an oracle anyone can query at
-- network speed should not exist. Its only caller is the notify-chat-unread
-- edge function, which runs on the service-role client, and service_role
-- bypasses these grants entirely.
revoke all on function public.cron_key_matches(text) from public;
revoke all on function public.cron_key_matches(text) from anon;
revoke all on function public.cron_key_matches(text) from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Defence in depth — admin/ops RPCs anon had no business holding a grant on.
--
-- Each of these raises unless is_superadmin(), so this is not a fix for a live
-- hole; it removes a grant nobody can justify. Grants are re-applied by
-- Supabase's default privileges at CREATE time, which is how they got here, so
-- these revokes have to be re-asserted whenever one of these functions is
-- recreated. Verify with has_function_privilege, never by reading this file.
revoke all on function public.admin_list_listing_reports(text) from public, anon;
revoke all on function public.admin_resolve_listing_report(uuid, text, text) from public, anon;
revoke all on function public.decide_kyc_verification(uuid, boolean, text) from public, anon;
revoke all on function public.get_pending_kyc() from public, anon;
revoke all on function public.get_error_logs(timestamptz, integer, text) from public, anon;
revoke all on function public.get_error_summary() from public, anon;
revoke all on function public.get_landing_page_visits(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_marketplace_funnel(timestamptz, timestamptz) from public, anon;
revoke all on function public.get_marketplace_top(timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.get_platform_engagement(timestamptz, timestamptz) from public, anon;
revoke all on function public.broadcast_notification(text, text, text, text, uuid[]) from public, anon;

grant execute on function public.admin_list_listing_reports(text) to authenticated;
grant execute on function public.admin_resolve_listing_report(uuid, text, text) to authenticated;
grant execute on function public.decide_kyc_verification(uuid, boolean, text) to authenticated;
grant execute on function public.get_pending_kyc() to authenticated;
grant execute on function public.get_error_logs(timestamptz, integer, text) to authenticated;
grant execute on function public.get_error_summary() to authenticated;
grant execute on function public.get_landing_page_visits(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_marketplace_funnel(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_marketplace_top(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.get_platform_engagement(timestamptz, timestamptz) to authenticated;
grant execute on function public.broadcast_notification(text, text, text, text, uuid[]) to authenticated;
