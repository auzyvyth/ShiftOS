-- 20261116g: the broker confirms the dealer's payment (BROKER-3, 2026-11-16). QUEUED, not applied.
-- Flow: dealer approves the sale (broker_mark_sold) -> dealer marks it paid (broker_mark_paid) ->
-- the BROKER answers "received" or "not received" (broker_confirm_received). "Not received" never erases the
-- dealer's own paid_at: it sets not_received_at beside it, tells the dealer, and the dealer can mark it paid
-- again once settled (WhatsApp, outside Drevo). Drevo moves no money; this is a record both sides can see.
-- One migration = one API freeze: apply after midnight MYT with nobody live.

alter table public.broker_registrations
  add column if not exists received_at timestamptz,
  add column if not exists not_received_at timestamptz;

-- Dealer marks paid. Allowed first time, or again after the broker said "not received". Never after "received".
create or replace function public.broker_mark_paid(p_reg uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare r public.broker_registrations%rowtype;
begin
  select * into r from public.broker_registrations where id = p_reg for update;
  if not found or not public.broker_is_dealer_owner(r.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if r.status <> 'sold' or r.received_at is not null or (r.paid_at is not null and r.not_received_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  update public.broker_registrations set paid_at = now(), not_received_at = null where id = r.id;
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (r.broker_id, 'broker_paid', 'Commission marked as paid',
          'The dealer marked your commission on ' || r.car_label || ' as paid. Open Analytics and tell us if you received it.', r.id);
  return jsonb_build_object('ok', true);
end $$;

-- Broker answers. Only the broker on that registration, only after the dealer marked it paid, only until received.
create or replace function public.broker_confirm_received(p_reg uuid, p_received boolean)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare r public.broker_registrations%rowtype;
begin
  if auth.uid() is null or p_received is null then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into r from public.broker_registrations where id = p_reg and broker_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if r.status <> 'sold' or r.paid_at is null or r.received_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  if p_received then
    update public.broker_registrations set received_at = now(), not_received_at = null where id = r.id;
    insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
    values (r.dealer_id, 'broker_received', 'Broker confirmed the commission',
            public._broker_name(r.broker_id) || ' confirmed they received the commission on ' || r.car_label || '.', 'team', r.id);
  else
    if r.not_received_at is not null then
      return jsonb_build_object('ok', false, 'reason', 'bad_action');  -- already reported; wait for the dealer
    end if;
    update public.broker_registrations set not_received_at = now() where id = r.id;
    insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
    values (r.dealer_id, 'broker_not_received', 'Broker says the commission has not arrived',
            public._broker_name(r.broker_id) || ' says they have not received the commission on ' || r.car_label
              || '. Settle it with them, then mark it paid again.', 'team', r.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.broker_confirm_received(uuid, boolean) from public, anon;
grant execute on function public.broker_confirm_received(uuid, boolean) to authenticated;

-- The audit trail records both answers.
create or replace function public.broker_audit_reg()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'registered',
            jsonb_build_object('source', new.source, 'commission_agreed', new.commission_agreed, 'hold_until', new.hold_until));
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(),
            case when new.status = 'sold' then 'sold' else 'sale_undone' end,
            jsonb_build_object('commission', new.commission_amount, 'sold_by', new.sold_by));
  end if;
  if new.sale_claimed_at is distinct from old.sale_claimed_at then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(),
            case when new.sale_claimed_at is null then 'claim_cleared' else 'sale_claimed' end, '{}'::jsonb);
  end if;
  if new.claim_disputed_at is distinct from old.claim_disputed_at and new.claim_disputed_at is not null then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'claim_disputed', '{}'::jsonb);
  end if;
  if new.paid_at is distinct from old.paid_at then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'marked_paid',
            jsonb_build_object('commission', new.commission_amount));
  end if;
  if new.received_at is distinct from old.received_at and new.received_at is not null then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'commission_received',
            jsonb_build_object('commission', new.commission_amount));
  end if;
  if new.not_received_at is distinct from old.not_received_at and new.not_received_at is not null then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'commission_not_received',
            jsonb_build_object('commission', new.commission_amount));
  end if;
  return null;
end $$;

-- Both screens read the two new fields. A table function's return type cannot change in place: drop + create,
-- then re-assert the grants (never inherited from the old function). The broker also gets the dealer's WhatsApp
-- number (the dealer's own storefront number, already public on its page) so "not received" can open a chat.
drop function if exists public.broker_my_regs();
create function public.broker_my_regs()
returns table(id uuid, dealer_name text, car_label text, buyer_name text, buyer_phone text, registered_at timestamptz,
              hold_until timestamptz, status text, commission_amount numeric, paid_at timestamptz, source text,
              commission_agreed numeric, broker_lead_id uuid, sold_by text, listing_id uuid, sale_claimed_at timestamptz,
              claim_disputed_at timestamptz, received_at timestamptz, not_received_at timestamptz, dealer_phone text)
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select r.id,
         coalesce(nullif(btrim(p.dealership), ''), nullif(btrim(p.site_name), ''), 'Dealer'),
         r.car_label, r.buyer_name, r.buyer_phone, r.registered_at, r.hold_until, r.status,
         r.commission_amount, r.paid_at, r.source, r.commission_agreed, r.broker_lead_id, r.sold_by,
         r.listing_id, r.sale_claimed_at, r.claim_disputed_at, r.received_at, r.not_received_at,
         public.normalize_my_phone(p.whatsapp_number)
    from public.broker_registrations r
    join public.profiles p on p.id = r.dealer_id
   where r.broker_id = auth.uid()
   order by r.registered_at desc
   limit 200;
$$;
revoke all on function public.broker_my_regs() from public, anon;
grant execute on function public.broker_my_regs() to authenticated, service_role;

drop function if exists public.dealer_broker_regs();
create function public.dealer_broker_regs()
returns table(id uuid, broker_id uuid, broker_name text, car_label text, buyer_name text, buyer_phone text,
              registered_at timestamptz, hold_until timestamptz, status text, commission_amount numeric,
              paid_at timestamptz, refused_count integer, source text, commission_agreed numeric, sold_by text,
              sale_claimed_at timestamptz, claim_disputed_at timestamptz, received_at timestamptz, not_received_at timestamptz)
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select r.id, r.broker_id, public._broker_name(r.broker_id), r.car_label, r.buyer_name, r.buyer_phone,
         r.registered_at, r.hold_until, r.status, r.commission_amount, r.paid_at, r.refused_count,
         r.source, r.commission_agreed, r.sold_by, r.sale_claimed_at, r.claim_disputed_at,
         r.received_at, r.not_received_at
    from public.broker_registrations r
   where r.dealer_id = auth.uid() and public.broker_is_dealer_owner(r.dealer_id)
   order by r.registered_at desc
   limit 200;
$$;
revoke all on function public.dealer_broker_regs() from public, anon;
grant execute on function public.dealer_broker_regs() to authenticated, service_role;

-- A "not received" answer puts the money back in the dealer's OWED total until it is marked paid again.
-- Same signature as before, so CREATE OR REPLACE is enough (no second overload).
create or replace function public.dealer_my_brokers()
returns table(broker_id uuid, name text, slug text, plan text, status text, requested_by text, commission_default numeric,
              since timestamptz, cars_on_page integer, buyers integer, sold integer, owed numeric, holding integer,
              to_approve integer, paid numeric)
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select b.broker_id, public._broker_name(b.broker_id), p.slug, p.plan::text, b.status, b.requested_by,
         b.commission_default, coalesce(b.decided_at, b.requested_at),
         (select count(*)::int from public.salesman_listings sl
           where sl.salesman_id = b.broker_id and sl.dealer_id = b.dealer_id),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id and r.status = 'sold'),
         (select coalesce(sum(r.commission_amount), 0) from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'sold' and (r.paid_at is null or r.not_received_at is not null)),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'registered' and r.hold_until > now() and r.sale_claimed_at is null),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'registered' and r.sale_claimed_at is not null),
         (select coalesce(sum(r.commission_amount), 0) from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'sold' and r.paid_at is not null and r.not_received_at is null)
    from public.dealer_brokers b
    join public.profiles p on p.id = b.broker_id
   where b.dealer_id = auth.uid() and public.broker_is_dealer_owner(b.dealer_id)
   order by (b.status = 'requested') desc, b.requested_at desc;
$$;
