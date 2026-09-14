-- Second half of the incomplete-signup fix: give abandoned signups (Google
-- sign-in started, onboarding never finished) a home OTHER than the "waiting
-- on your decision" Review queue -- a separate, informational "Incomplete"
-- section, plus a way to track when a nudge email was sent so it isn't
-- resent blindly every time the admin opens the panel.
alter table public.profiles
  add column if not exists signup_reminder_sent_at timestamptz;

create or replace function public.get_incomplete_signups()
 returns table(id uuid, full_name text, email text, role text, dealership text, avatar_url text, created_at timestamptz, signup_reminder_sent_at timestamptz)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;
  return query
    select p.id, p.full_name, p.email, p.role, p.dealership, p.avatar_url, p.created_at, p.signup_reminder_sent_at
    from public.profiles p
    where p.onboarding_complete = false
      and p.role in ('dealer', 'salesman')
      and p.account_status = 'active'
    order by p.created_at desc;
end;
$function$;
