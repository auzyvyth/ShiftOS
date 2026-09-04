-- Platform console > Buyers could not answer "are this buyer's notifications on?".
--
-- push_subscriptions has exactly ONE policy (auth.uid() = user_id), so a
-- superadmin .from() read comes back an EMPTY ARRAY WITH NO ERROR -- the same
-- trap already documented for saved_cars/price_alerts in BuyersTab.jsx. The
-- state has to come through these SECURITY DEFINER RPCs like everything else
-- on that tab.
--
-- Both functions return jsonb, so CREATE OR REPLACE adds keys without changing
-- the return type: the signature and its grants survive untouched (verified
-- after applying: one overload each, anon has no EXECUTE, authenticated does).
--
-- NEVER return the endpoint or the subscription keys. That JSON is the
-- credential for pushing to someone's device; the console only needs to know
-- THAT a device is registered, when, and roughly what it is. Same rule as
-- share tokens: whatever can read the row must not be able to replay it.
--
-- Naming: get_buyer_accounts returns push_device_count (a number),
-- get_buyer_detail returns push_devices (the rows). Deliberately different
-- names -- they were both push_devices for one revision, which is one .map()
-- away from a crash.

create or replace function public.get_buyer_accounts(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.signed_up_at desc nulls last), '[]'::jsonb)
    from (
      select
        u.id,
        (p.id is null)                                              as orphan,
        coalesce(p.full_name,
                 u.raw_user_meta_data->>'full_name',
                 u.raw_user_meta_data->>'name')                     as full_name,
        coalesce(p.email, u.email)                                  as email,
        p.phone,
        p.avatar_url,
        p.account_status,
        p.pdpa_consent,
        p.deleted_at,
        u.created_at                                                as signed_up_at,
        coalesce(u.raw_app_meta_data->>'provider', 'email')          as provider,
        (u.email_confirmed_at is not null)                          as email_verified,
        u.is_anonymous                                              as is_guest,
        u.last_sign_in_at,
        u.banned_until,
        (u.banned_until is not null and u.banned_until > now())     as is_banned,
        exists (select 1 from auth.mfa_factors f
                 where f.user_id = u.id and f.status = 'verified')  as mfa,
        (select count(*) from auth.sessions s
          where s.user_id = u.id
            and (s.not_after is null or s.not_after > now()))       as active_sessions,
        (select t.locked_until from auth_login_throttle t
          where lower(t.email) = lower(u.email)
            and t.locked_until > now())                             as locked_until,
        (select count(*) from saved_cars sc      where sc.user_id  = u.id) as saved_count,
        (select count(*) from price_alerts pa    where pa.user_id  = u.id) as alert_count,
        (select count(*) from reviews r          where r.buyer_id  = u.id) as review_count,
        (select count(*) from listing_comments c where c.author_id = u.id) as comment_count,
        -- Notification state. A device COUNT -- get_buyer_detail returns the
        -- device rows themselves, under push_devices.
        (select count(*) from push_subscriptions ps where ps.user_id = u.id) as push_device_count,
        (select max(ps.created_at) from push_subscriptions ps where ps.user_id = u.id) as push_last_at,
        -- Chat, so "notifications off" can be read against whether anyone is
        -- actually trying to reach them. Off with nothing unread is fine; off
        -- with a seller waiting is the case worth acting on.
        (select count(*) from chat_threads t where t.buyer_id = u.id) as chat_threads,
        (select coalesce(sum(t.buyer_unread), 0) from chat_threads t where t.buyer_id = u.id) as chat_unread,
        (select count(*) from leads l
          where (p.phone_norm is not null and l.phone_norm = p.phone_norm)
             or (u.email is not null and lower(l.buyer_email) = lower(u.email))) as lead_count
      from auth.users u
      left join profiles p on p.id = u.id
      -- p.id is null keeps orphaned auth users visible: they have no profiles row so
      -- they appear in no other admin list at all.
      where p.role = 'buyer' or p.id is null
      order by u.created_at desc
      limit least(coalesce(p_limit, 500), 2000)
    ) x
  );
end;
$function$;

create or replace function public.get_buyer_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone_norm text;
  v_email      text;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select p.phone_norm, coalesce(p.email, u.email)
    into v_phone_norm, v_email
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = p_user_id;

  return jsonb_build_object(
    'saved_cars', (
      select coalesce(jsonb_agg(y order by y.saved_at desc), '[]'::jsonb) from (
        select sc.created_at as saved_at, cl.id as listing_id,
               cl.brand, cl.model, cl.year,
               coalesce(cl.selling_price, cl.base_price) as price,
               cl.status
        from saved_cars sc
        join car_listings cl on cl.id = sc.listing_id
        where sc.user_id = p_user_id
      ) y
    ),
    'price_alerts', (
      select coalesce(jsonb_agg(y order by y.created_at desc), '[]'::jsonb) from (
        select id, brand, model, variant, body_type, state, max_price,
               min_year, max_year, keyword, is_active, created_at, last_notified_at
        from price_alerts where user_id = p_user_id
      ) y
    ),
    'reviews', (
      select coalesce(jsonb_agg(y order by y.created_at desc), '[]'::jsonb) from (
        select r.id, r.rating, r.body, r.status, r.created_at,
               coalesce(d.dealership, d.full_name) as dealer_name
        from reviews r
        left join profiles d on d.id = r.dealer_id
        where r.buyer_id = p_user_id
      ) y
    ),
    -- Which devices can actually receive a notification. Registration time and
    -- the push service only -- deliberately NO endpoint and NO keys.
    'push_devices', (
      select coalesce(jsonb_agg(y order by y.registered_at desc), '[]'::jsonb) from (
        select ps.created_at as registered_at,
               case
                 when ps.endpoint like 'https://fcm.googleapis.com/%'                  then 'Chrome or Android'
                 when ps.endpoint like 'https://web.push.apple.com/%'                  then 'Safari or iOS'
                 when ps.endpoint like 'https://updates.push.services.mozilla.com/%'   then 'Firefox'
                 when ps.endpoint like '%.notify.windows.com/%'                        then 'Edge or Windows'
                 else 'Other browser'
               end as service
        from push_subscriptions ps where ps.user_id = p_user_id
      ) y
    ),
    -- Conversation state only: counts and timestamps, never a message body.
    -- Admin has no business reading what a buyer wrote to a seller.
    'chats', (
      select coalesce(jsonb_agg(y order by y.last_message_at desc nulls last), '[]'::jsonb) from (
        select t.id as thread_id, t.buyer_unread, t.last_message_at, t.last_sender_role,
               nullif(trim(concat_ws(' ', cl.year::text, cl.brand, cl.model)), '') as car,
               coalesce(s.full_name, s.dealership, d.dealership, d.full_name) as seller_name
        from chat_threads t
        left join car_listings cl on cl.id = t.listing_id
        left join profiles s on s.id = t.salesman_id
        left join profiles d on d.id = t.dealer_id
        where t.buyer_id = p_user_id
        order by t.last_message_at desc nulls last
        limit 50
      ) y
    ),
    -- Pipeline match: does this marketplace account correspond to a real lead?
    -- Matched on the canonical phone form (normalize_phone / src/lib/phone.js),
    -- never on raw text -- the same number is stored 60-prefixed in leads and
    -- 0-prefixed in profiles/whatsapp_enquiries.
    'leads', (
      select coalesce(jsonb_agg(y order by y.created_at desc), '[]'::jsonb) from (
        select l.id, l.stage, l.lead_source, l.buyer_name, l.created_at,
               coalesce(d.dealership, d.full_name) as dealer_name,
               coalesce(s.full_name, s.dealership) as salesman_name
        from leads l
        left join profiles d on d.id = l.dealer_id
        left join profiles s on s.id = l.salesman_id
        where (v_phone_norm is not null and l.phone_norm = v_phone_norm)
           or (v_email is not null and lower(l.buyer_email) = lower(v_email))
        order by l.created_at desc
        limit 50
      ) y
    ),
    'enquiries', (
      select coalesce(jsonb_agg(y order by y.created_at desc), '[]'::jsonb) from (
        select w.id, w.status, w.source, w.buyer_message, w.created_at,
               coalesce(d.dealership, d.full_name) as dealer_name
        from whatsapp_enquiries w
        left join profiles d on d.id = w.dealer_id
        where v_phone_norm is not null and w.phone_norm = v_phone_norm
        order by w.created_at desc
        limit 50
      ) y
    ),
    'sessions', (
      select coalesce(jsonb_agg(y order by y.last_seen desc nulls last), '[]'::jsonb) from (
        select s.id, s.created_at, s.refreshed_at as last_seen, s.not_after,
               s.aal::text as aal, host(s.ip) as ip, s.user_agent,
               (s.not_after is not null and s.not_after < now()) as expired
        from auth.sessions s where s.user_id = p_user_id
        order by s.refreshed_at desc nulls last
        limit 20
      ) y
    )
  );
end;
$function$;
