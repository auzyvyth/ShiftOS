-- SENSUS-1: demo requests from the /sensus-ai landing page.
--
-- The owner resells Sensus AI (a dealership AI agent + CRM, a separate company)
-- to Malaysian dealerships. The landing page's one job is to book a meeting, so a
-- request must reach the owner the moment it is sent: it lands here AND fires
-- notify_ops (Telegram ops channel + the superadmin's push), console > People >
-- Sensus demos.
--
-- Deliberately NOT platform_prospects: that table auto-links a phone to an XDrive
-- account and moves it to 'signed_up', and phone is unique there. A dealer who is
-- both an XDrive prospect and a Sensus lead would collide, and "signed up" means
-- nothing for a Sensus sale.
--
-- Anon writes go through ONE security definer function with its own limits; the
-- table itself has no anon policy at all (the waitlist was filled by scripts once
-- because its policy was WITH CHECK (true)).

create table if not exists public.sensus_demo_requests (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(btrim(name)) between 2 and 100),
  dealership        text not null check (length(btrim(dealership)) between 2 and 120),
  role              text check (role is null or length(role) <= 60),
  -- Step 1 of the form. 'agent' or 'lt100' enquiries = below the fit line
  -- (sensusCopy.js isSensusFit); still saved, flagged Early in the console.
  dealer_type       text check (dealer_type is null or dealer_type in ('franchise','group','single','service','agent')),
  phone             text not null,
  monthly_enquiries text check (monthly_enquiries is null or monthly_enquiries in ('lt100','100_300','300_1000','gt1000','unsure')),
  note              text check (note is null or length(note) <= 1000),
  source            text check (source is null or length(source) <= 80),
  status            text not null default 'new'
                    check (status in ('new','contacted','booked','demo_done','won','lost')),
  owner_notes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists sensus_demo_requests_created_idx on public.sensus_demo_requests(created_at desc);
create index if not exists sensus_demo_requests_phone_idx on public.sensus_demo_requests(phone);

alter table public.sensus_demo_requests enable row level security;
drop policy if exists sensus_demo_requests_superadmin on public.sensus_demo_requests;
create policy sensus_demo_requests_superadmin on public.sensus_demo_requests
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
revoke all on public.sensus_demo_requests from anon, public;
grant select, update, delete on public.sensus_demo_requests to authenticated;

create or replace function public.sensus_request_demo(
  p_name text, p_dealership text, p_phone text,
  p_role text default null, p_enquiries text default null,
  p_note text default null, p_source text default null,
  p_dealer_type text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone text := public.normalize_my_phone(nullif(btrim(p_phone), ''));
  v_id    uuid;
  v_cnt   integer;
  v_label text;
  v_type  text := case when p_dealer_type in ('franchise','group','single','service','agent') then p_dealer_type end;
  v_early boolean;
begin
  if p_name is null or length(btrim(p_name)) not between 2 and 100 then
    raise exception 'sensus_bad_name' using errcode = '22023';
  end if;
  if p_dealership is null or length(btrim(p_dealership)) not between 2 and 120 then
    raise exception 'sensus_bad_dealership' using errcode = '22023';
  end if;
  if v_phone is null or v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'sensus_bad_phone' using errcode = '22023';
  end if;

  -- Limits: 3 per phone per day, 30 in total per hour (a script cannot bury the list).
  select count(*) into v_cnt from sensus_demo_requests
   where phone = v_phone and created_at > now() - interval '1 day';
  if v_cnt >= 3 then raise exception 'sensus_rate_limited' using errcode = '42901'; end if;
  select count(*) into v_cnt from sensus_demo_requests where created_at > now() - interval '1 hour';
  if v_cnt >= 30 then raise exception 'sensus_rate_limited' using errcode = '42901'; end if;

  insert into sensus_demo_requests(name, dealership, role, dealer_type, phone, monthly_enquiries, note, source)
  values (btrim(p_name), btrim(p_dealership), nullif(btrim(left(p_role, 60)), ''), v_type, v_phone,
          case when p_enquiries in ('lt100','100_300','300_1000','gt1000','unsure') then p_enquiries end,
          nullif(btrim(left(p_note, 1000)), ''), nullif(btrim(left(p_source, 80)), ''))
  returning id into v_id;

  v_label := case p_enquiries
    when 'lt100' then 'under 100' when '100_300' then '100-300' when '300_1000' then '300-1,000'
    when 'gt1000' then 'over 1,000' else 'not sure' end;
  v_early := v_type = 'agent' or p_enquiries = 'lt100';

  -- The alert must never cost the dealer their request.
  begin
    perform public.notify_ops('sensus_demo:' || v_phone,
      'New Sensus demo request' || case when v_early then ' (early, below fit)' else '' end || E'\n' ||
      btrim(p_name) || coalesce(' (' || nullif(btrim(p_role), '') || ')', '') || ', ' || btrim(p_dealership) || E'\n' ||
      'Type: ' || coalesce(v_type, 'not given') || ', enquiries a month: ' || v_label || E'\n' ||
      'WhatsApp: +' || v_phone);
  exception when others then
    raise warning 'sensus_request_demo notify: %', sqlerrm;
  end;

  return v_id;
end $function$;

revoke all on function public.sensus_request_demo(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sensus_request_demo(text, text, text, text, text, text, text, text) to anon, authenticated;
