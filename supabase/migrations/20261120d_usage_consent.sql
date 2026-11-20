-- USAGE-1 (2026-11-20, QUEUED for the after-midnight slot, apply after 20261120b/c): the owner asks
-- each seller ONCE whether Drevo may count which features they use (IDEA-43). Counts come from rows
-- that already exist (leads, bookings, loan checks...), nothing new is tracked, and only sellers who
-- said yes are counted. The answer is written ONLY by set_usage_consent() (derived from auth.uid(),
-- sellers only: a buyer or the platform admin gets nothing). The console reads get_feature_usage()
-- (superadmin only): counts per feature, never a name.
begin;

create table if not exists public.seller_usage_consent (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  allowed    boolean not null,
  decided_at timestamptz not null default now()
);
alter table public.seller_usage_consent enable row level security;

-- A seller reads only their own answer (the popup needs it); the platform reads all. No direct writes.
drop policy if exists seller_usage_consent_read on public.seller_usage_consent;
create policy seller_usage_consent_read on public.seller_usage_consent
  for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin());
revoke all on public.seller_usage_consent from public, anon;
grant select on public.seller_usage_consent to authenticated;

create or replace function public.set_usage_consent(p_allowed boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('salesman', 'dealer', 'owner') then
    raise exception 'sellers only' using errcode = '42501';
  end if;
  if p_allowed is null then raise exception 'answer required' using errcode = '22023'; end if;
  insert into public.seller_usage_consent (user_id, allowed, decided_at)
  values (auth.uid(), p_allowed, now())
  on conflict (user_id) do update set allowed = excluded.allowed, decided_at = now();
end;
$$;
revoke all on function public.set_usage_consent(boolean) from public, anon;
grant execute on function public.set_usage_consent(boolean) to authenticated;

-- Console > Marketplace > Feature use. Last 30 days, consenting sellers only, counts only.
-- One row per feature even when nobody used it (the left join), because "nobody" is the answer
-- the owner is looking for.
create or replace function public.get_feature_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare r jsonb;
begin
  if not public.is_superadmin() then raise exception 'not allowed' using errcode = '42501'; end if;
  with ok as (
    select c.user_id as id from public.seller_usage_consent c
    join public.profiles p on p.id = c.user_id and p.role in ('salesman', 'dealer', 'owner')
    where c.allowed
  ),
  f(feature, who) as (
    select 'Cars listed', t.who from (select 1) d left join (select dealer_id as who from public.car_listings where status <> 'archived' and created_at > now() - interval '30 days') t on true union all
    select 'Leads added', t.who from (select 1) d left join (select coalesce(salesman_id, dealer_id) as who from public.leads where created_at > now() - interval '30 days') t on true union all
    select 'Calls and stage moves logged', t.who from (select 1) d left join (select created_by as who from public.lead_activities where created_at > now() - interval '30 days') t on true union all
    select 'Bookings made', t.who from (select 1) d left join (select coalesce(salesman_id, dealer_id) as who from public.appointments where created_at > now() - interval '30 days') t on true union all
    select 'Loan check', t.who from (select 1) d left join (select salesman_id as who from public.loan_checks where created_at > now() - interval '30 days') t on true union all
    select 'Loan application', t.who from (select 1) d left join (select coalesce(salesman_id, dealer_id) as who from public.loan_applications where created_at > now() - interval '30 days') t on true union all
    select 'Loan poster', t.who from (select 1) d left join (select user_id as who from public.loan_poster_uses where created_at > now() - interval '30 days') t on true union all
    select 'Live presentation', t.who from (select 1) d left join (select seller_id as who from public.live_sessions where started_at > now() - interval '30 days') t on true union all
    select 'Studio design saved', t.who from (select 1) d left join (select user_id as who from public.studio_designs where created_at > now() - interval '30 days') t on true union all
    select 'Follow-up reminder', t.who from (select 1) d left join (select salesman_id as who from public.scheduled_nudges where created_at > now() - interval '30 days') t on true union all
    select 'AI caption', t.who from (select 1) d left join (select salesman_id as who from public.ai_caption_logs where created_at > now() - interval '30 days') t on true union all
    select 'AI WhatsApp reply', t.who from (select 1) d left join (select salesman_id as who from public.ai_wa_reply_logs where created_at > now() - interval '30 days') t on true union all
    select 'Handover step ticked', t.who from (select 1) d left join (select salesman_id as who from public.post_sale_tasks where status = 'done' and updated_at > now() - interval '30 days') t on true union all
    select 'Seller note', t.who from (select 1) d left join (select salesman_id as who from public.salesman_notes where created_at > now() - interval '30 days') t on true union all
    select 'Featured a dealer car', t.who from (select 1) d left join (select salesman_id as who from public.salesman_listings where created_at > now() - interval '30 days') t on true union all
    select 'Dealer document', t.who from (select 1) d left join (select dealer_id as who from public.dealer_documents where created_at > now() - interval '30 days') t on true union all
    select 'Add-on product', t.who from (select 1) d left join (select dealer_id as who from public.dealer_products where created_at > now() - interval '30 days') t on true
  )
  select jsonb_build_object(
    'window_days', 30,
    'said_yes', (select count(*) from ok),
    'said_no', (select count(*) from public.seller_usage_consent where not allowed),
    'total', (select count(*) from public.profiles
               where role in ('salesman', 'dealer', 'owner') and onboarding_complete
                 and coalesce(account_status, 'active') <> 'deleted'),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('feature', feature, 'sellers', n, 'events', e) order by n desc, feature)
      from (select feature,
                   count(distinct who) filter (where who in (select id from ok)) as n,
                   count(who) filter (where who in (select id from ok)) as e
            from f group by feature) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.get_feature_usage() from public, anon;
grant execute on function public.get_feature_usage() to authenticated;

commit;
