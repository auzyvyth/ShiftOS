-- Premium free trial: 30 days -> 7 days (owner, 2026-10-25).
-- Only trials that START after this are shorter: plan_expires_at is stamped
-- when a trial starts, so every seller already on a free month (Ashraf,
-- Yazeed, ...) keeps their date. When the 7 days end, Premium lapses the
-- usual way (20261019a): the seller drops to Lite, cars over the Lite cap
-- are locked until they pay.
-- The console's "Set up a seller" can still grant 30 days (create-salesman,
-- trial_days) for prospects who were promised a month; that path is a
-- service-role write and never reaches this trigger.
-- Same length as PLAN_CONFIG.salesman_full.trialDays (src/utils/planConfig.js).

create or replace function public.apply_premium_free_month()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  completing boolean;
  used_before timestamptz;
begin
  if auth.uid() is null or is_superadmin() then
    return new;
  end if;

  -- start_premium_trial() sets this flag for its own transaction only.
  if coalesce(current_setting('app.premium_trial', true), '') = 'on' then
    new.plan := 'salesman_full';
    new.plan_expires_at := now() + interval '7 days';
    new.premium_trial_started_at := now();
    new.payment_status := null;   -- the escalation guard set 'pending'
    return new;
  end if;

  -- Nobody writes the marker by hand.
  used_before := case when tg_op = 'UPDATE' then old.premium_trial_started_at end;
  new.premium_trial_started_at := used_before;

  -- A Premium signup finishing onboarding starts its free trial here.
  completing := new.onboarding_complete = true
    and (tg_op = 'INSERT' or coalesce(old.onboarding_complete, false) = false);
  if completing and used_before is null
     and new.role = 'salesman' and new.dealer_id is null
     and new.plan::text = 'salesman_full' then
    new.plan_expires_at := now() + interval '7 days';
    new.premium_trial_started_at := now();
  end if;
  return new;
end;
$function$;
