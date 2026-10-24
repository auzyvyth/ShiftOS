-- IO-2 (2026-10-24): live updates by Broadcast from triggers, not postgres_changes.
--
-- While any postgres_changes listener is connected, Realtime polls the database
-- nonstop (realtime.list_changes: ~121k calls / ~30 min of DB time in a day on
-- the small instance that kept stalling). A Broadcast only costs when a row
-- changes: rt_notify() sends {op, id, key, table} to private topics
-- `rt:<table>:<column>:<value>` (and `rt:<table>:all`), one per column the
-- screens filter on. NO ROW DATA is sent: the client (src/lib/liveChannel.js)
-- re-reads the row through RLS, so a topic permission can only ever expose an id.
--
-- Client first, DB second is safe: until this runs, a private topic is refused
-- and liveChannel falls back to postgres_changes for it.
-- Apply after midnight MYT with nobody live (one schema reload). Dropping these
-- tables from supabase_realtime is a LATER, separate step (20261025a), once the
-- new client has been out long enough that no open tab still needs them.

create or replace function public.rt_notify()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  key text := case when r ? 'id' then 'id' else tg_argv[0] end;
  msg jsonb;
  col text;
  v text;
begin
  if key is null or r->>key is null then return null; end if;
  msg := jsonb_build_object('op', tg_op, 'id', r->>key, 'key', key, 'table', tg_table_name);
  foreach col in array tg_argv loop
    if col = '*' then
      perform realtime.send(msg, 'change', 'rt:' || tg_table_name || ':all', true);
    else
      v := r->>col;
      if v is not null then
        perform realtime.send(msg, 'change', 'rt:' || tg_table_name || ':' || col || ':' || v, true);
      end if;
    end if;
  end loop;
  return null;
exception when others then
  -- A live update must never block the write it describes.
  raise warning 'rt_notify %: %', tg_table_name, sqlerrm;
  return null;
end
$$;

revoke all on function public.rt_notify() from public, anon, authenticated;

-- Columns = the filters the screens use (src/lib/liveChannel.js liveTopic).
drop trigger if exists trg_rt_leads on public.leads;
create trigger trg_rt_leads after insert or update or delete on public.leads
  for each row execute function public.rt_notify('salesman_id', 'dealer_id');

-- Screens only listen for new notifications.
drop trigger if exists trg_rt_salesman_notifications on public.salesman_notifications;
create trigger trg_rt_salesman_notifications after insert on public.salesman_notifications
  for each row execute function public.rt_notify('salesman_id');

drop trigger if exists trg_rt_dealer_notifications on public.dealer_notifications;
create trigger trg_rt_dealer_notifications after insert or update or delete on public.dealer_notifications
  for each row execute function public.rt_notify('dealer_id');

drop trigger if exists trg_rt_whatsapp_enquiries on public.whatsapp_enquiries;
create trigger trg_rt_whatsapp_enquiries after insert or update or delete on public.whatsapp_enquiries
  for each row execute function public.rt_notify('salesman_id', 'dealer_id');

drop trigger if exists trg_rt_appointments on public.appointments;
create trigger trg_rt_appointments after insert or update or delete on public.appointments
  for each row execute function public.rt_notify('salesman_id', 'dealer_id');

-- status: the console's pending-approval queue (status=eq.pending_approval).
drop trigger if exists trg_rt_car_listings on public.car_listings;
create trigger trg_rt_car_listings after insert or update or delete on public.car_listings
  for each row execute function public.rt_notify('dealer_id', 'assigned_to', 'status');

drop trigger if exists trg_rt_chat_messages on public.chat_messages;
create trigger trg_rt_chat_messages after insert or update on public.chat_messages
  for each row execute function public.rt_notify('thread_id');

drop trigger if exists trg_rt_chat_threads on public.chat_threads;
create trigger trg_rt_chat_threads after insert or update or delete on public.chat_threads
  for each row execute function public.rt_notify('buyer_id', 'salesman_id', 'dealer_id');

-- No id column: rt_notify keys it on its first argument (user_id). The console
-- watches it unfiltered, so it also goes to rt:kyc_documents:all.
drop trigger if exists trg_rt_kyc_documents on public.kyc_documents;
create trigger trg_rt_kyc_documents after insert or update or delete on public.kyc_documents
  for each row execute function public.rt_notify('user_id', '*');

-- Who may join a private topic. Messages carry ids only and every row is
-- re-read through RLS, so this guards against id snooping, not data.
--   superadmin: every topic (the console)
--   rt:<t>:<col>:<me>          the viewer's own rows
--   rt:<t>:dealer_id:<dealer>  their dealer's rows (get_my_dealer_id)
--   rt:chat_messages:thread_id:<thread>  a thread they are a party to
--   `all` / `status` topics: superadmin only
create or replace function public.rt_topic_allowed(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(p_topic, ':');
  me uuid := auth.uid();
begin
  if me is null or parts[1] is distinct from 'rt' or array_length(parts, 1) < 3 then
    return false;
  end if;
  if public.is_superadmin() then return true; end if;
  if parts[3] in ('all', 'status') or parts[4] is null then return false; end if;
  if parts[4] = me::text then return true; end if;
  if parts[3] = 'dealer_id' and parts[4] = public.get_my_dealer_id()::text then return true; end if;
  if parts[2] = 'chat_messages' and parts[3] = 'thread_id' then
    return public.chat_thread_role(parts[4]::uuid) is not null;
  end if;
  return false;
exception when others then
  return false;
end
$$;

revoke all on function public.rt_topic_allowed(text) from public, anon;
grant execute on function public.rt_topic_allowed(text) to authenticated;

drop policy if exists rt_private_receive on realtime.messages;
create policy rt_private_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.rt_topic_allowed((select realtime.topic()))
  );
