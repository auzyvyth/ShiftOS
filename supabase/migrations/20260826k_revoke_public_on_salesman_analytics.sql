-- Follow-up to 20260826j, which did not actually close the hole.
--
-- These functions carry a grant to PUBLIC (`=X/postgres` in proacl), and anon
-- inherits EXECUTE through it. `revoke ... from anon` removes a role-specific
-- grant that was never there, so it succeeds and changes nothing -
-- has_function_privilege('anon', ...) still returned true afterwards.
-- The grant to revoke is the one to PUBLIC; the real roles are then named
-- explicitly so the privilege set is visible rather than inherited.

revoke execute on function public.get_salesman_minipage_stats(text) from public;
revoke execute on function public.get_salesman_minipage_daily(text) from public;
revoke execute on function public.get_salesman_channel_breakdown(uuid[], text) from public;

grant execute on function public.get_salesman_minipage_stats(text) to authenticated, service_role;
grant execute on function public.get_salesman_minipage_daily(text) to authenticated, service_role;
grant execute on function public.get_salesman_channel_breakdown(uuid[], text) to authenticated, service_role;
