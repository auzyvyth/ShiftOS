-- BROKER-4 fix (2026-11-17, found by the rolled-back probe right after 20261117b went live): on the dealer's
-- approval the broker's lead stayed put. broker_twin_after cleared won_requested_at by UPDATING the dealer's
-- own row from its AFTER trigger; the live won triggers had already touched that row in the same statement,
-- so Postgres refused, and the exception handler rolled back the broker's Won with it. The flag is now
-- cleared in the BEFORE trigger (no second write), and the broker update no longer shares a handler with it.
-- APPLIED 2026-11-17 (owner: "apply all the migrations ... now").

create or replace function public.broker_twin_before()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_flag boolean := coalesce(current_setting('app.broker_twin', true), '') = 'on';
  v_mapped text;
  d public.leads%rowtype;
begin
  if not v_flag then
    if tg_op = 'INSERT' then
      new.broker_twin_id := null;
      new.won_requested_at := null;
      return new;
    end if;
    new.broker_twin_id := old.broker_twin_id;
    new.won_requested_at := old.won_requested_at;
  end if;

  -- A dealer's lead going Won answers any broker request on it.
  if tg_op = 'UPDATE' and new.via_broker_id is not null and new.won_requested_at is not null
     and new.stage in ('won', 'closed_won') then
    new.won_requested_at := null;
  end if;

  if tg_op <> 'UPDATE' or v_flag or new.broker_twin_id is null
     or new.stage is not distinct from old.stage then
    return new;
  end if;

  select * into d from public.leads
   where id = new.broker_twin_id and via_broker_id = new.salesman_id
     and coalesce(is_deleted, false) = false;
  if not found then return new; end if;

  if new.stage in ('won', 'closed_won') then
    new.stage := old.stage;
    if old.won_requested_at is null and d.stage not in ('won', 'closed_won') then
      new.won_requested_at := now();
      perform set_config('app.broker_twin', 'on', true);
      update public.leads set won_requested_at = now() where id = d.id;
      perform set_config('app.broker_twin', '', true);
      insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
      values (d.dealer_id, 'broker_won_request', 'A broker says their buyer bought the car',
              public._broker_name(new.salesman_id) || ' marked ' || coalesce(d.buyer_name, 'their buyer')
              || ' as Won. Open the lead to approve or reject it.', 'crm', d.id);
    end if;
    return new;
  end if;

  new.won_requested_at := null;
  v_mapped := case when new.stage = 'deposit_taken' then 'negotiating' else new.stage end;
  if v_mapped in ('lost', 'closed_lost') and exists (
       select 1 from public.car_listings where id = d.car_listing_id and status = 'reserved') then
    return new;
  end if;
  if d.stage not in ('won', 'closed_won') then
    perform set_config('app.broker_twin', 'on', true);
    update public.leads
       set stage = v_mapped, won_requested_at = null, updated_at = now()
     where id = d.id and (stage is distinct from v_mapped or won_requested_at is not null);
    perform set_config('app.broker_twin', '', true);
  end if;
  return new;
end $$;

create or replace function public.broker_twin_after()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare b record;
begin
  if new.via_broker_id is null then return null; end if;
  perform set_config('app.broker_twin', 'on', true);
  begin
    if new.stage in ('won', 'closed_won') and coalesce(old.stage, '') not in ('won', 'closed_won') then
      for b in update public.leads
                  set stage = 'won', won_requested_at = null, updated_at = now()
                where broker_twin_id = new.id and stage not in ('won', 'closed_won')
                returning id, salesman_id
      loop
        insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
        values (b.salesman_id, 'broker_won_approved', 'The dealer confirmed your sale',
                coalesce(new.buyer_name, 'Your buyer') || ' is now Won.', b.id);
      end loop;
    elsif coalesce(old.stage, '') in ('won', 'closed_won') and new.stage not in ('won', 'closed_won') then
      update public.leads set stage = 'negotiating', updated_at = now()
       where broker_twin_id = new.id and stage in ('won', 'closed_won');
    end if;
  exception when others then
    raise warning 'broker_twin_after: %', sqlerrm;
  end;
  perform set_config('app.broker_twin', '', true);
  return null;
end $$;
