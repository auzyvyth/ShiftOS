-- DB-CLEAN-1 (2026-10-22): drop database objects nothing uses any more.
--
-- How "unused" was decided (read-only audit, 2026-10-22):
--   * not referenced by any other function body, RLS policy, view, column
--     default, check constraint or pg_cron job (searched pg_proc / pg_policy /
--     pg_views / pg_attrdef / pg_constraint / cron.job);
--   * not called anywhere in src/, api/, public/ (service worker),
--     middleware.js, tools/ or supabase/functions/;
--   * the one deployed-only edge function (bootstrap-superadmin-alias) is a
--     410 stub, so no deployed code calls them either;
--   * trigger functions: attached to no trigger in any schema;
--   * tables: 0 rows, no code, no dependent view.
--
-- Plain DROP, never CASCADE: if something still depends on one of these, the
-- migration fails and nothing is dropped (one transaction).

begin;

-- 1. Trigger functions no trigger uses (superseded by newer triggers).
drop function public.auto_activate_profile();
drop function public.create_lead_from_whatsapp_enquiry();   -- enquiry_to_lead replaced it
drop function public.handle_new_dealer_signup();            -- handle_new_user replaced it
drop function public.notify_push_on_appointment();          -- push now via salesman/dealer_notifications rows
drop function public.notify_push_on_enquiry();              -- same
drop function public.sync_included_services_to_recon();     -- no-op body

-- 2. Callable functions with no caller.
drop function public.accept_dealer_invite(text);            -- duplicate of use_dealer_invite (the one the app calls)
drop function public.car_specs_done();
drop function public.get_my_linked_dealer_id();             -- get_my_dealer_id covers it
drop function public.get_my_role_and_dealership();
drop function public.is_active_dealer(uuid);                -- is_dealer_active is the live one
drop function public.is_salesman_lite();
drop function public.leads_public_rate_ok(text, uuid);
drop function public.leads_public_rate_ok(text, uuid, uuid);
drop function public.notify_ops_telegram(text, text);       -- shim for notify_ops; no caller left

-- 3. Car hunts: replaced by Find me posts (FINDME-1). Both tables empty, no UI.
drop table public.car_hunt_interests;
drop table public.car_hunts;                                -- takes trg_car_hunts_updated_at + its policies
drop function public.get_active_hunts();
drop function public.car_hunts_rate_ok(text);
drop function public.update_car_hunt_updated_at();

-- 4. Never-built features: empty tables, no code.
drop table public.broadcast_logs;                           -- also unblocks hard-deleting a car (FK, no ON DELETE)
alter table public.dealer_products drop column workshop_id; -- 0 of 4 rows set; FK to workshops
drop table public.workshop_jobs;
drop table public.workshop_service_options;
drop table public.workshop_services;
drop table public.workshops;

commit;

-- Verify after applying (each should return 0 rows):
--   select oid::regprocedure from pg_proc where pronamespace = 'public'::regnamespace
--     and proname in ('auto_activate_profile','create_lead_from_whatsapp_enquiry',
--       'handle_new_dealer_signup','notify_push_on_appointment','notify_push_on_enquiry',
--       'sync_included_services_to_recon','accept_dealer_invite','car_specs_done',
--       'get_my_linked_dealer_id','get_my_role_and_dealership','is_active_dealer',
--       'is_salesman_lite','leads_public_rate_ok','notify_ops_telegram','get_active_hunts',
--       'car_hunts_rate_ok','update_car_hunt_updated_at');
--   select to_regclass('public.car_hunts'), to_regclass('public.broadcast_logs'),
--          to_regclass('public.workshops');
