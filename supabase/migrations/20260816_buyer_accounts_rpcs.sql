-- Buyer accounts for /platform (XDrive Ops -> Buyers).
--
-- Applied live as three migrations: 20260816_buyer_accounts_rpcs,
-- 20260816_buyer_detail_fix_price_col, 20260816_buyer_detail_fix_lead_source_col.
-- Folded into one file here so a replay produces the same end state; the two fixes
-- were column-name corrections (car_listings has selling_price not price; leads has
-- lead_source not source).
--
-- Why these are SECURITY DEFINER and not plain client queries:
--   1. auth.users / auth.sessions / auth.mfa_factors are unreachable with the anon key,
--      so signup date, provider, last login, 2FA and ban state cannot be selected
--      client-side at all.
--   2. saved_cars / price_alerts / reviews / listing_comments are owner-only RLS
--      (user_id = auth.uid()). A superadmin selecting them from the client gets an
--      EMPTY ARRAY WITH NO ERROR -- the panel would show "0 saved cars" for every buyer
--      and look correct. Counting them in here is the only way to get true numbers
--      without widening those policies for a read-only admin screen.
-- Same shape and same is_superadmin() gate as get_active_sessions.

create or replace function public.get_buyer_accounts(p_limit int default 500)
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
        coalesce(u.raw_app_meta_data->>'provider', 'email')         as provider,
        (u.email_confirmed_at is not null)                          as email_verified,
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


-- ---------------------------------------------------------------------------
-- Admin actions. These write to the auth schema, so the guards matter more than
-- the feature. Order is deliberate:
--   1. superadmin only
--   2. TARGET MUST BE A BUYER  <- without this a superadmin-scoped ban function can
--      ban a dealer, another superadmin, or the platform owner. Do not remove.
--   3. never act on self (cannot lock yourself out)
--   4. audit row written in here, so calling the RPC directly cannot skip it
-- Verified: banning a dealer / an owner / self / a nonexistent uuid all raise, and a
-- non-superadmin caller is rejected on every function.
-- ---------------------------------------------------------------------------

create or replace function public._assert_buyer_action_allowed(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  if p_user_id is null then
    raise exception 'target required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot act on self';
  end if;

  if not exists (select 1 from profiles where id = p_user_id and role = 'buyer') then
    raise exception 'target is not a buyer account';
  end if;
end;
$function$;


create or replace function public._log_buyer_action(p_user_id uuid, p_action text, p_summary text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- activity_log.dealer_id is NOT NULL and there is no dealer for a platform action,
  -- so it is stamped with the acting admin's own id. That also makes these rows visible
  -- in the existing Activity Log tab, whose policy is dealer_id = auth.uid().
  insert into activity_log (dealer_id, actor_id, actor_name, actor_role,
                            table_name, record_id, action, summary)
  select auth.uid(), auth.uid(),
         coalesce(p.full_name, p.email, 'superadmin'), p.role,
         'auth.users', p_user_id, p_action, p_summary
  from profiles p where p.id = auth.uid();
end;
$function$;


create or replace function public.admin_set_buyer_ban(p_user_id uuid, p_until timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_email text;
begin
  perform public._assert_buyer_action_allowed(p_user_id);

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'buyer not found';
  end if;

  update auth.users set banned_until = p_until where id = p_user_id;

  perform public._log_buyer_action(
    p_user_id,
    case when p_until is null then 'buyer_unban' else 'buyer_ban' end,
    case when p_until is null
         then 'Unbanned buyer ' || v_email
         else 'Banned buyer ' || v_email || ' until ' || p_until::text end
  );

  return jsonb_build_object('ok', true, 'banned_until', p_until);
end;
$function$;


create or replace function public.admin_revoke_buyer_sessions(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_count int;
begin
  perform public._assert_buyer_action_allowed(p_user_id);

  select email into v_email from auth.users where id = p_user_id;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;

  perform public._log_buyer_action(
    p_user_id, 'buyer_revoke_sessions',
    'Revoked ' || v_count || ' session(s) for buyer ' || coalesce(v_email, p_user_id::text)
  );

  -- Access tokens are stateless JWTs: an already-issued one stays valid until it
  -- expires (default 1h). This kills refresh, it is not an instant kick.
  return jsonb_build_object('ok', true, 'revoked', v_count);
end;
$function$;


revoke all on function public.get_buyer_accounts(int)                   from anon;
revoke all on function public.get_buyer_detail(uuid)                    from anon;
revoke all on function public.admin_set_buyer_ban(uuid, timestamptz)    from anon, authenticated;
revoke all on function public.admin_revoke_buyer_sessions(uuid)         from anon, authenticated;
revoke all on function public._assert_buyer_action_allowed(uuid)        from anon, authenticated;
revoke all on function public._log_buyer_action(uuid, text, text)       from anon, authenticated;

grant execute on function public.get_buyer_accounts(int)                to authenticated;
grant execute on function public.get_buyer_detail(uuid)                 to authenticated;
grant execute on function public.admin_set_buyer_ban(uuid, timestamptz) to authenticated;
grant execute on function public.admin_revoke_buyer_sessions(uuid)      to authenticated;
