-- NEWCAR-PICK (owner, 2026-11-22): the variant and colour a buyer picked on the new-car
-- model page travel into the advisor's lead. QUEUED: apply after midnight MYT, nobody live.
--
-- leads.new_car_model_id already exists (the won confirm writes it; new_car_unit_on_won reads
-- it). This adds the colour and lets create_lead_from_whatsapp write both. The function gains
-- two parameters, so the OLD signature is dropped in this same migration (two overloads with
-- the same parameter names break every named call, see CLAUDE.md).
--
-- Both values are CHECKED here, never trusted from the browser:
--   variant = an active new_car_models row of the SAME brand + model as the lead's car (a model card)
--   colour  = one of that variant's own specs.colours
-- Anything else is dropped silently (the lead is still made). A later pick on the same lead wins.

begin;

alter table public.leads add column if not exists car_colour text;
alter table public.leads drop constraint if exists leads_car_colour_len;
alter table public.leads add constraint leads_car_colour_len check (car_colour is null or length(car_colour) <= 40);

drop function if exists public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text);

create function public.create_lead_from_whatsapp(
  p_dealer_id uuid, p_name text, p_phone text, p_state text, p_car_id uuid, p_ref_slug text,
  p_variant_id uuid default null, p_colour text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_phone text := public.normalize_my_phone(p_phone);
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_car uuid;
  v_salesman uuid;
  v_existing uuid;
  v_id uuid;
  v_recent integer;
  v_variant uuid;
  v_colour text;
begin
  if p_dealer_id is null or v_name is null then
    raise exception 'name and dealer are required';
  end if;
  if not exists (select 1 from profiles
                  where id = p_dealer_id and is_active
                    and coalesce(account_status, 'active') <> 'deleted') then
    raise exception 'dealer_inactive' using errcode = 'check_violation';
  end if;
  select id into v_car from car_listings where id = p_car_id and dealer_id = p_dealer_id;

  -- The picked variant must belong to the car's model; the colour to that variant.
  if v_car is not null and p_variant_id is not null then
    select nm.id into v_variant
      from car_listings c
      join new_car_models anchor on anchor.id = c.new_car_model_id
      join new_car_models nm on nm.brand = anchor.brand and nm.model = anchor.model
     where c.id = v_car and nm.id = p_variant_id and nm.is_active;
  end if;
  if v_variant is not null and nullif(btrim(coalesce(p_colour, '')), '') is not null then
    select x into v_colour
      from new_car_models nm, jsonb_array_elements_text(coalesce(nm.specs->'colours', '[]'::jsonb)) x
     where nm.id = v_variant and lower(x) = lower(btrim(p_colour))
     limit 1;
  end if;

  v_salesman := public.resolve_lead_salesman(p_dealer_id, v_car, p_ref_slug, null);
  if v_phone is not null then
    select id into v_existing from leads
     where dealer_id = p_dealer_id
       and public.normalize_my_phone(phone) = v_phone
       and coalesce(is_deleted, false) = false
     order by created_at desc limit 1;
  else
    select id into v_existing from leads
     where dealer_id = p_dealer_id
       and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
       and coalesce(car_listing_id::text, '') = coalesce(v_car::text, '')
       and coalesce(is_deleted, false) = false
       and created_at >= now() - interval '24 hours'
     order by created_at desc limit 1;
  end if;
  if v_existing is not null then
    update leads set
      car_listing_id = coalesce(car_listing_id, v_car),
      phone = coalesce(nullif(phone, ''), v_phone),
      buyer_state = coalesce(buyer_state, v_state),
      salesman_id = coalesce(salesman_id, v_salesman),
      -- Only onto the SAME car: a pick for another model never relabels this lead.
      new_car_model_id = case when v_variant is not null and coalesce(car_listing_id, v_car) is not distinct from v_car
                              and stage not in ('won', 'closed_won') then v_variant else new_car_model_id end,
      car_colour = case when v_variant is not null and coalesce(car_listing_id, v_car) is not distinct from v_car
                        and stage not in ('won', 'closed_won') then v_colour else car_colour end,
      updated_at = now()
    where id = v_existing;
    return v_existing;
  end if;
  select count(*) into v_recent from leads
   where dealer_id = p_dealer_id
     and lead_source = 'whatsapp'
     and created_at > now() - interval '1 hour';
  if v_recent >= 40 then
    raise exception 'rate_limited' using errcode = 'check_violation';
  end if;
  insert into leads (dealer_id, salesman_id, buyer_name, phone, buyer_state, car_listing_id, stage, lead_source, is_deleted,
                     new_car_model_id, car_colour)
  values (p_dealer_id, v_salesman, v_name, v_phone, v_state, v_car, 'new', 'whatsapp', false, v_variant, v_colour)
  returning id into v_id;
  perform public._broker_capture(v_car, p_ref_slug, v_id, v_name, v_phone);
  return v_id;
end;
$function$;

revoke all on function public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text, uuid, text) to service_role;

commit;

-- Checks after applying (read-only):
--   select oid::regprocedure from pg_proc where proname = 'create_lead_from_whatsapp';  -- exactly ONE row, 8 args
--   select has_function_privilege('anon', 'create_lead_from_whatsapp(uuid,text,text,text,uuid,text,uuid,text)', 'execute'); -- false
--   select column_name from information_schema.columns where table_name = 'leads' and column_name = 'car_colour';
