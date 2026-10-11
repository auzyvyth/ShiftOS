-- One-tap unsubscribe for price-alert emails (2026-10-11).
-- The alert email said "Manage your alerts" and linked to /showroom, where
-- alerts cannot be managed, and guests who saved a search by email have no
-- account to manage them from at all.
--
-- The token is a password (CLAUDE.md "A share token is a PASSWORD"): it is
-- checked by a SECURITY DEFINER function that takes it as an ARGUMENT, never by
-- a policy or view, and is never returned as a column to anyone but the
-- service role that builds the email. 122 random bits, so guessing one is not
-- a realistic attack and a per-call rate limit would add nothing.
begin;

alter table public.price_alerts
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists price_alerts_unsubscribe_token_key
  on public.price_alerts (unsubscribe_token);

-- Turns off EVERY active alert for the email the token belongs to: someone
-- pressing "unsubscribe" wants the emails to stop, not one saved search of many.
create or replace function public.price_alert_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from price_alerts where unsubscribe_token = p_token;
  if v_email is null then
    return false;
  end if;
  update price_alerts set is_active = false
   where lower(email) = lower(v_email) and is_active;
  return true;
end;
$$;

revoke all on function public.price_alert_unsubscribe(uuid) from public;
grant execute on function public.price_alert_unsubscribe(uuid) to anon, authenticated;

commit;
