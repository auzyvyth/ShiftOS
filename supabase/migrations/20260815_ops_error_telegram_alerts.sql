-- Ops alerting: instant, throttled Telegram push when a client error (error_logs)
-- or an audit anomaly (activity_log.is_anomaly) lands. Fires directly from the DB
-- via pg_net -> Telegram Bot API. No-ops silently until the platform ops bot is
-- configured on the superadmin (fallback owner) profile row. Alerting can never
-- break the originating write (all wrapped, triggers are AFTER INSERT).

-- 1) Throttle state: at most one alert per key per window (kills crash-loop / mass-delete floods)
create table if not exists public.ops_alert_state (
  alert_key       text primary key,
  last_alerted_at timestamptz not null default now()
);
alter table public.ops_alert_state enable row level security;  -- definer-only, no policies

-- 2) Central sender: reads ops bot token+chat off the superadmin/owner profile,
--    enforces the throttle, posts to Telegram. SECURITY DEFINER to read the token
--    and write throttle state regardless of the caller's RLS.
create or replace function public.notify_ops_telegram(p_key text, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_chat  text;
  v_last  timestamptz;
begin
  select telegram_bot_token, coalesce(telegram_chat_id, telegram_channel_id)
    into v_token, v_chat
  from profiles
  where role in ('superadmin','owner')
    and telegram_bot_token is not null and btrim(telegram_bot_token) <> ''
  order by (role = 'superadmin') desc
  limit 1;

  if v_token is null or v_chat is null or btrim(v_chat) = '' then
    return;  -- ops bot not configured yet -> silent no-op
  end if;

  select last_alerted_at into v_last from ops_alert_state where alert_key = p_key;
  if v_last is not null and v_last > now() - interval '15 minutes' then
    return;  -- throttled
  end if;

  insert into ops_alert_state(alert_key, last_alerted_at)
  values (p_key, now())
  on conflict (alert_key) do update set last_alerted_at = now();

  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || btrim(v_token) || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
                 'chat_id', btrim(v_chat),
                 'text', p_text,
                 'disable_web_page_preview', true
               )
  );
exception when others then
  return;  -- never surface alerting failure to the originating transaction
end;
$$;

-- 3) error_logs -> alert (throttle keyed on error_code so a render loop = 1 msg/15min)
create or replace function public.trg_notify_error_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_msg text;
begin
  v_msg :=
    '🔴 ShiftOS error · ' || coalesce(new.error_code, 'uncoded') || E'\n' ||
    left(coalesce(new.error_message, ''), 300) || E'\n' ||
    'role: ' || coalesce(new.role, '—') ||
    coalesce(E'\nurl: ' || (new.metadata->>'url'), '') || E'\n' ||
    to_char(new.created_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') || ' KL';
  perform notify_ops_telegram('err:' || coalesce(new.error_code, 'uncoded'), v_msg);
  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists notify_error_log on public.error_logs;
create trigger notify_error_log
  after insert on public.error_logs
  for each row execute function public.trg_notify_error_log();

-- 4) activity_log anomalies -> alert (throttle keyed on table+action so a mass
--    delete of N rows = 1 msg/15min). Only fires when is_anomaly = true.
create or replace function public.trg_notify_activity_anomaly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  perform notify_ops_telegram(
    'anom:' || coalesce(new.table_name, '?') || ':' || coalesce(new.action, '?'),
    v_msg
  );
  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists notify_activity_anomaly on public.activity_log;
create trigger notify_activity_anomaly
  after insert on public.activity_log
  for each row execute function public.trg_notify_activity_anomaly();
