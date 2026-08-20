-- APPR-2: ping the admin on Telegram the moment a new listing needs approval or a
-- new self-signup lands, instead of them having to keep checking the admin panel.
-- Reuses notify_ops_telegram() (20260815_ops_error_telegram_alerts.sql) — it already
-- posts straight to the Telegram Bot API using the superadmin's own bot token/chat_id,
-- so this needs no new secrets, no edge-function auth changes, and no push/VAPID setup.
-- Each row's own id is the throttle key, so notify_ops_listing's 15-min dedup only
-- ever collapses retries of the SAME event, never two different listings/signups.

create or replace function public.notify_admin_on_pending_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller text;
  v_msg    text;
begin
  select coalesce(full_name, email, 'A seller') into v_seller
  from profiles where id = new.dealer_id;

  v_msg :=
    '🚗 New listing pending approval' || E'\n' ||
    trim(coalesce(new.year::text, '') || ' ' || coalesce(new.brand, '') || ' ' ||
         coalesce(new.model, '') || ' ' || coalesce(new.variant, '')) ||
    coalesce(E'\nRM ' || to_char(new.selling_price, 'FM999,999,999'), '') || E'\n' ||
    'Seller: ' || coalesce(v_seller, '—');

  perform notify_ops_telegram('pending_listing:' || new.id::text, v_msg);
  return new;
exception when others then
  return new;
end;
$$;

-- Split into an INSERT trigger and an UPDATE trigger — a combined INSERT OR UPDATE
-- trigger's WHEN clause cannot reference OLD at all (Postgres rejects it outright),
-- so the "did status just change" check can only live on the UPDATE-only trigger.
drop trigger if exists trg_notify_admin_on_pending_listing on public.car_listings;
drop trigger if exists trg_notify_admin_on_pending_listing_ins on public.car_listings;
drop trigger if exists trg_notify_admin_on_pending_listing_upd on public.car_listings;
create trigger trg_notify_admin_on_pending_listing_ins
  after insert on public.car_listings
  for each row
  when (new.status = 'pending_approval')
  execute function public.notify_admin_on_pending_listing();
create trigger trg_notify_admin_on_pending_listing_upd
  after update of status on public.car_listings
  for each row
  when (new.status = 'pending_approval' and old.status is distinct from new.status)
  execute function public.notify_admin_on_pending_listing();

create or replace function public.notify_admin_on_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg text;
begin
  v_msg :=
    '🆕 New signup pending review' || E'\n' ||
    coalesce(new.full_name, new.email, 'A new user') || ' — ' || coalesce(new.role, '—') ||
    coalesce(' (' || new.dealership || ')', '') || E'\n' ||
    'Plan: ' || coalesce(new.plan::text, '—') ||
    coalesce(' · ' || nullif(trim(coalesce(new.city, '') || ', ' || coalesce(new.state, '')), ','), '');

  perform notify_ops_telegram('new_signup:' || new.id::text, v_msg);
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_notify_admin_on_new_signup on public.profiles;
create trigger trg_notify_admin_on_new_signup
  after insert on public.profiles
  for each row
  when (new.approval_status = 'pending')
  execute function public.notify_admin_on_new_signup();
