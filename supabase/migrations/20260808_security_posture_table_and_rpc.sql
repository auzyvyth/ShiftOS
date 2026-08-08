-- Attestation store for posture checks that can't be computed live from the DB
-- (header presence, Sentry masking, leaked-password toggle, dependency audit).
-- CI / an edge function updates these rows; the live DB checks are computed in the RPC.
CREATE TABLE IF NOT EXISTS public.security_posture (
  key        text PRIMARY KEY,
  category   text NOT NULL,
  label      text NOT NULL,
  status     text NOT NULL CHECK (status IN ('ok','warn','fail','unknown')),
  value      text,
  detail     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_posture ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin reads posture" ON public.security_posture;
CREATE POLICY "superadmin reads posture" ON public.security_posture
  FOR SELECT TO authenticated USING (public.is_superadmin());
REVOKE ALL ON public.security_posture FROM anon;

INSERT INTO public.security_posture (key, category, label, status, value, detail) VALUES
  ('security_headers', 'Headers', 'Security response headers', 'warn', 'CSP report-only',
   'X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy enforced in vercel.json; CSP is in Report-Only mode — review violation reports on staging, then switch to enforced Content-Security-Policy.'),
  ('sentry_replay_masking', 'Auth & PII', 'Sentry replay PII masking', 'ok', 'maskAllText + blockAllMedia',
   'Session Replay masks all text and inputs and blocks media; sendDefaultPii disabled.'),
  ('leaked_password_protection', 'Auth & PII', 'Leaked-password protection', 'unknown', 'verify in dashboard',
   'Enable the HaveIBeenPwned check in Supabase Auth settings (dashboard toggle — no code).'),
  ('dependency_audit', 'Dependencies', 'npm audit (high severity)', 'warn', 'see Dependabot',
   'CI runs npm audit --audit-level=high (non-blocking). Dependabot reports advisories on the default branch — triage the backlog, then make CI blocking.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_security_posture()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v jsonb;
  v_rls_off int;
  v_rls_nopolicy int;
  v_secdef_views int;
  v_priv_buckets int;
  v_pub_buckets int;
  v_al_bad_grants int;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select count(*) into v_rls_off
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

  select count(*) into v_rls_nopolicy
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  select count(*) into v_secdef_views
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public' and c.relkind='v'
    and not ('security_invoker=on'  = any(coalesce(c.reloptions,'{}'::text[]))
          or 'security_invoker=true' = any(coalesce(c.reloptions,'{}'::text[])));

  select count(*) filter (where not public), count(*) filter (where public)
    into v_priv_buckets, v_pub_buckets
  from storage.buckets;

  select count(*) into v_al_bad_grants
  from information_schema.role_table_grants
  where table_schema='public' and table_name='activity_log'
    and grantee in ('anon','authenticated')
    and privilege_type in ('UPDATE','DELETE','TRUNCATE');

  v := jsonb_build_array(
    jsonb_build_object('category','RLS & policies','key','rls_coverage','label','RLS on all public tables',
      'status', case when v_rls_off=0 then 'ok' else 'fail' end,
      'value', v_rls_off || ' without RLS',
      'detail','Every public table must enable row-level security.','live', true),
    jsonb_build_object('category','RLS & policies','key','rls_nopolicy','label','RLS-enabled tables with no policy',
      'status','ok',
      'value', v_rls_nopolicy || ' deny-all',
      'detail','These reject all client access by default (server/service-role only). Confirm intentional.','live', true),
    jsonb_build_object('category','RLS & policies','key','secdef_views','label','Views running as owner (security_invoker off)',
      'status', case when v_secdef_views=0 then 'ok' else 'warn' end,
      'value', v_secdef_views::text,
      'detail','Owner-run views bypass the caller''s RLS. public_car_listings is the intended public read surface; confirm it exposes no cost/PII columns (e.g. included_services_cost, car_documents) or set security_invoker=on.','live', true),
    jsonb_build_object('category','Storage','key','private_bucket','label','Private storage bucket for documents',
      'status', case when v_priv_buckets>0 then 'ok' else 'warn' end,
      'value', v_priv_buckets || ' private / ' || v_pub_buckets || ' public',
      'detail','Buyer documents (IC, geran, contracts) must not live in a public bucket. If any are stored as files, put them in a private bucket served via short-lived signed URLs.','live', true),
    jsonb_build_object('category','Audit log','key','activity_append_only','label','activity_log is append-only',
      'status', case when v_al_bad_grants=0 then 'ok' else 'fail' end,
      'value', case when v_al_bad_grants=0 then 'locked' else v_al_bad_grants || ' risky grants' end,
      'detail','No UPDATE/DELETE/TRUNCATE grants to anon/authenticated; writes go through triggers/RPCs and the scoped client INSERT policy.','live', true)
  );

  v := v || (
    select coalesce(jsonb_agg(jsonb_build_object(
      'category', category, 'key', key, 'label', label, 'status', status,
      'value', value, 'detail', detail, 'checked_at', updated_at, 'live', false)), '[]'::jsonb)
    from security_posture
  );

  return v;
end;
$function$;

REVOKE ALL ON FUNCTION public.get_security_posture() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_security_posture() TO authenticated;
