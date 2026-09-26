-- push_home_path must pick Lite vs Premium by the SAME rule as the app
-- (isPremiumSalesman in src/utils/salesmanPlan.js) and is_salesman_premium().
-- It tested plan = 'salesman_full' alone, so a push tapped by a rep who has
-- the plan but not the entitlement (awaiting payment, or expired) opened
-- /salesman-premium, which sent them on to /salesman-lite: the same
-- land-then-bounce the sign-in pages had. Same signature, so this replaces.
create or replace function public.push_home_path(p_user_id uuid)
returns text
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select case
    -- The platform console, not the dealer dashboard. Only 'superadmin' — the
    -- 'owner' role is a real dealer account with its own dashboard.
    when p.role = 'superadmin' then '/platform'
    when p.role = 'buyer' then '/account/messages'
    when p.role = 'salesman' and p.dealer_id is not null then '/salesman'
    when p.role = 'salesman'
         and p.is_active = true
         and p.plan = 'salesman_full'
         and (p.plan_expires_at > now() or p.payment_status = 'received')
      then '/salesman-premium'
    when p.role = 'salesman' then '/salesman-lite'
    else '/dashboard'
  end
  from profiles p where p.id = p_user_id;
$function$;
