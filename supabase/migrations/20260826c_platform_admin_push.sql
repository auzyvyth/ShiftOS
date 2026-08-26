-- Platform admin (superadmin) web push.
--
-- Applied live via MCP apply_migration on 2026-08-26 (migrations
-- ops_alerts_push_to_platform_admin + ops_triggers_call_notify_ops); committed
-- here so the repo carries the source.
--
-- Before this, every ops alert (new signup, listing pending approval, error
-- log, activity anomaly) went to the ops Telegram channel ONLY. The superadmin
-- account had no push path at all: nothing inserted a notification row for it,
-- and push_home_path() sent it to /dashboard, the dealer console.
--
-- 1) push_home_path: a superadmin push opens /platform.
-- 2) notify_ops(): the ONE ops-alert fanout — throttle, then Telegram, then web
--    push to every superadmin. notify_ops_telegram() stays as a thin compat
--    shim because deployed-only edge functions may still call it by that name
--    (see CLAUDE.md: the repo is not the source of truth for edge functions).
-- 3) The four producer triggers call notify_ops() directly.

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
    when p.role = 'salesman' and p.dealer_id is not null then '/salesman'
    when p.role = 'salesman' and p.plan = 'salesman_full' then '/salesman-premium'
    when p.role = 'salesman' then '/salesman-lite'
    else '/dashboard'
  end
  from profiles p where p.id = p_user_id;
$function$;

create or replace function public.notify_ops(p_key text, p_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_token  text;
  v_chat   text;
  v_last   timestamptz;
  v_title  text;
  v_body   text;
  v_admins uuid[];
begin
  -- ONE throttle for both channels, and it runs FIRST. It used to sit after the
  -- "is the Telegram bot configured" bail-out, so with no bot the state row was
  -- never written — fine when Telegram was the only channel, wrong now that a
  -- push depends on the same gate.
  select last_alerted_at into v_last from ops_alert_state where alert_key = p_key;
  if v_last is not null and v_last > now() - interval '15 minutes' then
    return;
  end if;

  insert into ops_alert_state(alert_key, last_alerted_at)
  values (p_key, now())
  on conflict (alert_key) do update set last_alerted_at = now();

  -- Telegram (ops channel)
  select telegram_bot_token, coalesce(telegram_chat_id, telegram_channel_id)
    into v_token, v_chat
  from profiles
  where role in ('superadmin','owner')
    and telegram_bot_token is not null and btrim(telegram_bot_token) <> ''
  order by (role = 'superadmin') desc
  limit 1;

  if v_token is not null and v_chat is not null and btrim(v_chat) <> '' then
    perform net.http_post(
      url     := 'https://api.telegram.org/bot' || btrim(v_token) || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
                   'chat_id', btrim(v_chat),
                   'text', p_text,
                   'disable_web_page_preview', true
                 )
    );
  end if;

  -- Web push (platform admin's phone / desktop). The message is built as
  -- "headline\ndetail...", so line one is the title and the rest is the body.
  v_title := split_part(p_text, E'\n', 1);
  v_body  := left(nullif(btrim(substr(p_text, length(v_title) + 2)), ''), 300);

  select array_agg(id) into v_admins from profiles where role = 'superadmin';

  if v_admins is not null then
    -- Tag by alert family ('err', 'anom', 'new_signup', 'pending_listing') so a
    -- second alert of the same kind replaces the first on the device instead of
    -- stacking. push_to_users swallows its own failures.
    perform push_to_users(
      v_admins,
      coalesce(v_title, 'ShiftOS ops'),
      coalesce(v_body, ''),
      '/platform',
      'ops:' || split_part(coalesce(p_key, 'ops'), ':', 1)
    );
  end if;
exception when others then
  return;  -- never surface alerting failure to the originating transaction
end;
$function$;

-- Deprecated name kept as a shim: callers we cannot see (edge functions that
-- exist only on Supabase) may still use it. New code calls notify_ops().
create or replace function public.notify_ops_telegram(p_key text, p_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform notify_ops(p_key, p_text);
end;
$function$;

-- ── Producers now call notify_ops() directly. Bodies otherwise unchanged. ────

create or replace function public.notify_admin_on_new_signup()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_msg text;
begin
  v_msg :=
    '🆕 New signup pending review' || E'\n' ||
    coalesce(new.full_name, new.email, 'A new user') || ' — ' || coalesce(new.role, '—') ||
    coalesce(' (' || new.dealership || ')', '') || E'\n' ||
    'Plan: ' || coalesce(new.plan::text, '—') ||
    coalesce(' · ' || nullif(trim(coalesce(new.city, '') || ', ' || coalesce(new.state, '')), ','), '');

  perform notify_ops('new_signup:' || new.id::text, v_msg);
  return new;
exception when others then
  return new;
end;
$function$;

create or replace function public.notify_admin_on_pending_listing()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  perform notify_ops('pending_listing:' || new.id::text, v_msg);
  return new;
exception when others then
  return new;
end;
$function$;

create or replace function public.trg_notify_error_log()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_msg text;
begin
  v_msg :=
    '🔴 ShiftOS error · ' || coalesce(new.error_code, 'uncoded') || E'\n' ||
    left(coalesce(new.error_message, ''), 300) || E'\n' ||
    'role: ' || coalesce(new.role, '—') ||
    coalesce(E'\nurl: ' || (new.metadata->>'url'), '') || E'\n' ||
    to_char(new.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') || ' KL';
  perform notify_ops('err:' || coalesce(new.error_code, 'uncoded'), v_msg);
  return null;
exception when others then
  return null;
end;
$function$;

create or replace function public.trg_notify_activity_anomaly()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_msg text;
begin
  if new.is_anomaly is not true then
    return null;
  end if;
  v_msg :=
    '⚠️ ShiftOS anomaly · ' || coalesce(new.anomaly_reason, 'flagged') || E'\n' ||
    coalesce(new.action, '?') || ' on ' || coalesce(new.table_name, '?') || E'\n' ||
    'actor: ' || coalesce(new.actor_name, new.actor_role, 'system') ||
    coalesce(E'\nrecord: ' || new.record_id::text, '') || E'\n' ||
    to_char(new.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') || ' KL';
  perform notify_ops(
    'anom:' || coalesce(new.table_name, '?') || ':' || coalesce(new.action, '?'),
    v_msg
  );
  return null;
exception when others then
  return null;
end;
$function$;
