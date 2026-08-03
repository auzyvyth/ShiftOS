-- F7 hygiene: least-privilege grants + pin function search_path.

-- anon never writes car_listings (listings are dealer-authenticated); RLS already
-- blocks it, but the stray grants are a least-privilege violation.
revoke insert, update on car_listings from anon;

-- Pin search_path on the 4 flagged functions (function_search_path_mutable) so a
-- caller can't shadow objects via a hostile search_path.
alter function public.enforce_subdomain_rules() set search_path to 'public', 'pg_temp';
alter function public.is_reserved_subdomain(p_sub text) set search_path to 'public', 'pg_temp';
alter function public.leads_normalize_phone() set search_path to 'public', 'pg_temp';
alter function public.normalize_my_phone(p text) set search_path to 'public', 'pg_temp';

-- NOTE (not changed here): the pg_net extension lives in the public schema
-- (extension_in_public). Moving it risks breaking cron/webhook callers, so it is
-- left in place and flagged rather than relocated blind.
