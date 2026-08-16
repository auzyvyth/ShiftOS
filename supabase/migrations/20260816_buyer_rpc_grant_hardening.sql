-- Advisor follow-up on the buyer RPCs.
--
-- 1. The `revoke ... from anon, authenticated` in 20260816_buyer_accounts_rpcs was a
--    no-op: EXECUTE is granted to PUBLIC by default and both roles inherit it, so the
--    functions stayed callable on /rest/v1/rpc. They were never a data leak (every one
--    opens with is_superadmin() and raises 'not authorized'), but an unauthenticated
--    caller could still reach them. Revoke from PUBLIC first, then grant back only what
--    the panel needs. Anything that revokes from anon/authenticated without also
--    revoking from PUBLIC does nothing -- this is the trap.
-- 2. The two internal helpers get no grant at all. They are invoked with `perform` from
--    inside SECURITY DEFINER functions, which execute as the owner, so they do not need
--    one -- and nothing outside those functions has any business calling them.
-- 3. normalize_phone gets a fixed search_path (advisor: function_search_path_mutable).
--    It touches only built-ins, so pg_catalog is sufficient and it stays IMMUTABLE,
--    which the generated columns depend on. It keeps its PUBLIC execute grant on
--    purpose: it is a pure text function with no data access, and the generated columns
--    on profiles/leads/whatsapp_enquiries evaluate it.

create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
parallel safe
set search_path to 'pg_catalog'
as $$
  select case when length(n) >= 11 then n else null end
  from (
    select case
             when d = ''            then null
             when left(d, 2) = '60' then d
             when left(d, 1) = '0'  then '60' || substr(d, 2)
             else                        '60' || d
           end as n
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) a
  ) b;
$$;

revoke all on function public.get_buyer_accounts(int)                   from public, anon, authenticated;
revoke all on function public.get_buyer_detail(uuid)                    from public, anon, authenticated;
revoke all on function public.admin_set_buyer_ban(uuid, timestamptz)    from public, anon, authenticated;
revoke all on function public.admin_revoke_buyer_sessions(uuid)         from public, anon, authenticated;
revoke all on function public._assert_buyer_action_allowed(uuid)        from public, anon, authenticated;
revoke all on function public._log_buyer_action(uuid, text, text)       from public, anon, authenticated;

-- Only signed-in users may reach these, and each one still re-checks is_superadmin()
-- internally -- the grant is the outer door, not the lock.
grant execute on function public.get_buyer_accounts(int)                to authenticated;
grant execute on function public.get_buyer_detail(uuid)                 to authenticated;
grant execute on function public.admin_set_buyer_ban(uuid, timestamptz) to authenticated;
grant execute on function public.admin_revoke_buyer_sessions(uuid)      to authenticated;
