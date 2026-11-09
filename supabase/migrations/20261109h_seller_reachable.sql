-- SEC-10c (2026-11-09): buyers could not reach 5 standalone Premium sellers.
--
-- is_dealer_active() read subscription_status / trial_ends_at, which mean
-- nothing for a salesman (Premium runs on plan_expires_at). Any salesman_full
-- seller whose old trial_ends_at had passed read "inactive", and four callers
-- refuse on that:
--   get_seller_whatsapp      -> the WhatsApp button (/api/wa) returns nothing
--   get_listing_call_number  -> the Call button returns nothing
--   api/enquiry.js, api/booking.js -> enquiry + booking refused
--   whatsapp_enquiries.enquiries_public_insert policy
-- Live on 2026-11-09: bydann (6 cars), drivenbyyazeed (7), shamsulsa (1).
-- Rule: never gate a buyer's way to reach a seller. A salesman is reachable
-- while the account is live (on, not suspended, not deleted), whatever plan.
-- Dealers keep the subscription check exactly as before.
--
-- CREATE OR REPLACE with the same argument list and name: replaces in place,
-- keeps the grants (anon needs EXECUTE: the policy calls it as anon).

create or replace function public.is_dealer_active(p_dealer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles
     where id = p_dealer_id
       and (
         (role = 'salesman'
            and is_active = true
            and suspended_at is null
            and deleted_at is null
            and coalesce(account_status, 'active') <> 'deleted')
         or plan = 'salesman_lite'
         or subscription_status = 'active'
         or (subscription_status = 'trial' and trial_ends_at > now())
       )
  );
$$;

-- Check after applying (expect 0 rows, and exactly one overload):
--   select slug from profiles where role = 'salesman' and is_active
--     and suspended_at is null and coalesce(account_status,'active') <> 'deleted'
--     and not public.is_dealer_active(id);
--   select oid::regprocedure from pg_proc where proname = 'is_dealer_active';
