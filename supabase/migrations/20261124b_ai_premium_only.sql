-- No AI on Lite (owner, 2026-11-23). Every AI endpoint (ai-proxy, chat-assist,
-- api/ai-messages via lib/aiGuard.js) calls record_ai_request before it calls the
-- model and refuses when it fails, so this ONE check closes every AI path for a
-- standalone seller without Premium, including AI features added later.
-- Allowed: Premium + free trial (is_salesman_premium), salesmen under a dealer,
-- dealers and their staff, superadmin. Body otherwise unchanged; same signature,
-- so CREATE OR REPLACE replaces it (no second overload).

create or replace function public.record_ai_request(p_dealer_id uuid, p_user_id uuid, p_role text, p_feature text, p_model text, p_max_tokens integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;
  if not (p_dealer_id = auth.uid()
          or p_dealer_id = public.get_my_dealer_id()
          or public.is_superadmin()) then
    raise exception 'not authorized';
  end if;

  -- Lite = a standalone salesman (no dealer) without Premium.
  if exists (select 1 from public.profiles
             where id = auth.uid() and role = 'salesman' and dealer_id is null)
     and not public.is_salesman_premium() then
    raise exception 'ai_premium_only';
  end if;

  insert into ai_usage (dealer_id, date, count)
  values (p_dealer_id, current_date, 1)
  on conflict (dealer_id, date)
  do update set count = ai_usage.count + 1, updated_at = now()
  returning count into v_count;

  insert into ai_request_log (dealer_id, user_id, role, feature, model, max_tokens)
  values (p_dealer_id, p_user_id, p_role, p_feature, p_model, p_max_tokens);

  return v_count;
end;
$function$;
