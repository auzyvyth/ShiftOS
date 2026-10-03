-- Agent page (/s/:slug) trust signals. ONE migration = one API freeze.
--
-- 1. get_agent_recent_sales  - "Recently sold": the agent's last sold cars.
--    public_car_listings has no sold_at, so this is the anon-safe path. It
--    returns the car and the MONTH it sold. No price, no buyer, no exact date:
--    the sale price is between the agent and the buyer.
-- 2. get_agent_reply_time    - replaces the self-typed profiles.response_time
--    on the public page with a number measured from chat_messages.
-- 3. report_seller           - "Report this agent". Same table, rate limit and
--    duplicate rule as report_listing(); listing_id is NULL and the snapshot
--    carries kind='seller'.
-- 4. notify_ops_on_listing_report - names an agent report as one, instead of
--    "Listing reported: Listing".
--
-- Who counts as a public agent is the same rule get_salesman_by_slug uses, so
-- a suspended or deleted agent exposes nothing here either.

create or replace function public.agent_is_public(p_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
     where id = p_id
       and role = 'salesman'
       and (is_active = true or approval_status = 'pending')
       and suspended_at is null
       and coalesce(account_status, 'active') <> 'deleted'
       and deleted_at is null
  );
$$;

create or replace function public.get_agent_recent_sales(p_salesman_id uuid, p_limit integer default 6)
returns table(brand text, model text, variant text, year integer, sold_month date)
language sql
stable security definer
set search_path to 'public'
as $$
  select c.brand, c.model, c.variant, c.year::integer,
         date_trunc('month', c.sold_at)::date
    from car_listings c
   where agent_is_public(p_salesman_id)
     and c.status = 'sold'
     and c.sold_at is not null
     and (c.dealer_id = p_salesman_id or c.assigned_to = p_salesman_id)
   order by c.sold_at desc
   limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

-- Median minutes from a buyer's message to the agent's next reply, over the
-- last 90 days. Each buyer "burst" (first buyer message after a seller one)
-- is one sample. A burst left unanswered for 24h counts as 24h, so ignoring
-- buyers drags the number up rather than dropping out of it. The page only
-- shows it at 5+ samples.
create or replace function public.get_agent_reply_time(p_salesman_id uuid)
returns table(median_minutes integer, samples integer)
language sql
stable security definer
set search_path to 'public'
as $$
  with m as (
    select cm.thread_id, cm.sender_role, cm.created_at,
           lag(cm.sender_role) over (partition by cm.thread_id order by cm.created_at) as prev_role
      from chat_messages cm
      join chat_threads t on t.id = cm.thread_id
     where t.salesman_id = p_salesman_id
       and cm.created_at > now() - interval '90 days'
  ), asks as (
    select thread_id, created_at from m
     where sender_role = 'buyer' and (prev_role is null or prev_role <> 'buyer')
  ), pairs as (
    select a.created_at as asked,
           (select min(x.created_at) from chat_messages x
             where x.thread_id = a.thread_id and x.sender_role <> 'buyer'
               and x.created_at > a.created_at) as replied
      from asks a
  ), s as (
    select least(extract(epoch from coalesce(replied, now()) - asked) / 60, 1440) as mins
      from pairs
     where replied is not null or asked < now() - interval '24 hours'
     order by asked desc
     limit 30
  )
  select round(percentile_cont(0.5) within group (order by mins))::integer,
         count(*)::integer
    from s
   where agent_is_public(p_salesman_id)
  having count(*) > 0;
$$;

create or replace function public.report_seller(p_seller_id uuid, p_reason text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid    uuid := auth.uid();
  v_recent integer;
  v_s      record;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = 'check_violation';
  end if;
  if p_reason not in ('wrong_info', 'scam_suspicious', 'offensive', 'other') then
    raise exception 'invalid_reason' using errcode = 'check_violation';
  end if;
  if p_seller_id = v_uid then
    raise exception 'cannot_report_self' using errcode = 'check_violation';
  end if;

  select id, full_name, slug into v_s
    from profiles where id = p_seller_id and role = 'salesman';
  if v_s.id is null then
    raise exception 'seller_not_found' using errcode = 'check_violation';
  end if;

  -- Shared with report_listing: 3 reports per person per 24h, any kind.
  select count(*) into v_recent from listing_reports
   where reporter_id = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= 3 then
    raise exception 'rate_limited' using errcode = 'check_violation';
  end if;

  if exists (select 1 from listing_reports
              where reporter_id = v_uid and dealer_id = p_seller_id
                and listing_id is null and status in ('open', 'reviewing')) then
    raise exception 'already_reported' using errcode = 'check_violation';
  end if;

  insert into listing_reports (listing_id, dealer_id, reporter_id, reason, note, listing_snapshot)
  values (null, p_seller_id, v_uid, p_reason, nullif(btrim(coalesce(p_note, '')), ''),
          jsonb_build_object('kind', 'seller', 'name', v_s.full_name, 'slug', v_s.slug))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.notify_ops_on_listing_report()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_reason   text;
  v_car      text;
  v_seller   text;
  v_reporter text;
  v_msg      text;
  v_is_agent boolean := NEW.listing_id IS NULL AND NEW.listing_snapshot->>'kind' = 'seller';
BEGIN
  v_reason := CASE NEW.reason
    WHEN 'sold_elsewhere'  THEN 'Already sold / unavailable'
    WHEN 'wrong_info'      THEN 'Wrong or misleading details'
    WHEN 'scam_suspicious' THEN 'Looks like a scam'
    WHEN 'duplicate'       THEN 'Duplicate listing'
    WHEN 'offensive'       THEN 'Offensive / inappropriate'
    ELSE 'Something else'
  END;

  IF v_is_agent THEN
    v_car := 'Agent page /s/' || coalesce(NEW.listing_snapshot->>'slug', '?');
  ELSE
    v_car := NULLIF(btrim(
      coalesce(NEW.listing_snapshot->>'year', '')   || ' ' ||
      coalesce(NEW.listing_snapshot->>'brand', '')  || ' ' ||
      coalesce(NEW.listing_snapshot->>'model', '')  || ' ' ||
      coalesce(NEW.listing_snapshot->>'variant', '')
    ), '');
  END IF;

  SELECT coalesce(full_name, dealership, email, '—') INTO v_seller
    FROM profiles WHERE id = NEW.dealer_id;

  SELECT coalesce(full_name, email, 'A buyer') INTO v_reporter
    FROM profiles WHERE id = NEW.reporter_id;

  v_msg :=
    CASE WHEN v_is_agent THEN 'Agent reported: ' ELSE 'Listing reported: ' END || v_reason || E'\n' ||
    coalesce(v_car, 'Listing') || E'\n' ||
    'Seller: ' || coalesce(v_seller, '—') || E'\n' ||
    'By: ' || coalesce(v_reporter, '—') ||
    coalesce(E'\n"' || left(btrim(NEW.note), 140) || '"', '');

  PERFORM notify_ops('listing_report:' || NEW.id::text, v_msg);
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$function$;

-- Supabase grants new functions to anon DIRECTLY, so revoke from both.
revoke all on function public.agent_is_public(uuid) from public, anon, authenticated;
revoke all on function public.get_agent_recent_sales(uuid, integer) from public;
revoke all on function public.get_agent_reply_time(uuid) from public;
revoke all on function public.report_seller(uuid, text, text) from public, anon;
grant execute on function public.get_agent_recent_sales(uuid, integer) to anon, authenticated;
grant execute on function public.get_agent_reply_time(uuid) to anon, authenticated;
grant execute on function public.report_seller(uuid, text, text) to authenticated;
