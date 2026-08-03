-- F6: error_logs accepted unbounded public inserts (WITH CHECK true) with no rate
-- limit and unbounded JSONB context/metadata -> storage-exhaustion + log-poisoning
-- (and INFRA-1 already flags storage as full). Add a rate limit, size caps, and
-- block attributing a forged log to another user.

create or replace function public.error_logs_rate_ok(p_user_id uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare cnt int;
begin
  if p_user_id is not null then
    select count(*) into cnt from error_logs
     where user_id = p_user_id and created_at > now() - interval '1 hour';
    return cnt < 60;
  end if;
  -- anonymous: global flood guard on recent anon rows
  select count(*) into cnt from error_logs
   where user_id is null and created_at > now() - interval '1 minute';
  return cnt < 30;
end; $$;

drop policy if exists "Anyone can insert error logs" on error_logs;
create policy error_logs_insert on error_logs
  for insert to anon, authenticated
  with check (
    public.error_logs_rate_ok(user_id)
    and (user_id is null or user_id = auth.uid())
    and length(coalesce(error_message,'')) between 1 and 4000
    and (error_code is null or length(error_code) <= 200)
    and (context is null or length(context) <= 4000)
    and (role is null or length(role) <= 40)
    and (query_info is null or length(query_info::text) <= 8000)
    and (metadata is null or length(metadata::text) <= 8000)
  );

-- Least privilege: anon only needs INSERT (dealers read their own via the
-- existing SELECT policy).
revoke select, update on error_logs from anon;
