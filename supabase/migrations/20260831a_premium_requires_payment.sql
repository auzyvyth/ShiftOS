-- SEC-PLAN. Salesman Premium was free to anyone who asked for it.
--
-- prevent_profile_privilege_escalation deliberately lets a salesman move their
-- own `plan` between 'salesman_lite' and 'salesman_full' (that is how the
-- upgrade screen works), and is_salesman_premium() treated a NULL
-- `plan_expires_at` as "dealer-granted, no expiry". A Lite user therefore only
-- had to run one update on their own profiles row from the browser:
--
--   supabase.from('profiles').update({ plan: 'salesman_full' }).eq('id', me)
--
-- ...and every gate opened: unlimited listings (salesman_under_listing_limit),
-- every AI feature (salesman_ai_quota_ok), and the /salesman-premium route,
-- which reads the same self-written column. The trigger does stamp
-- payment_status='pending' on that flip, but nothing ever read it.
--
-- The fix is to require a signal the user cannot write themselves. All three
-- below are pinned against self-service edits by
-- prevent_profile_privilege_escalation:
--   dealer_id        - cannot be changed by the user (tenant move is blocked)
--   plan_expires_at  - reset to OLD on any user update
--   payment_status   - reset to OLD/NULL unless already equal
create or replace function public.is_salesman_premium()
returns boolean
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'salesman'
      AND is_active = true
      AND plan = 'salesman_full'
      AND (
        dealer_id IS NOT NULL          -- granted by their dealer, revoked on unlink
        OR plan_expires_at > now()     -- self-paid, still inside the paid window
        OR payment_status = 'received' -- self-paid or comped, confirmed off-platform
      )
  );
$function$;

-- auzyvyth+premium is a standalone Premium account that has never been through
-- a payment flow. Stamp it comped so the honest gate above does not demote it.
update public.profiles
   set payment_status = 'received'
 where email = 'auzyvyth+premium@gmail.com'
   and role = 'salesman'
   and plan = 'salesman_full'
   and dealer_id is null;
