-- SEC-B4. Applied to the live DB as: 20260906a_guard_seat_cap_and_vin_plate_rpcs
--
-- Two SECURITY DEFINER RPCs took a dealer id as an argument and acted on it with
-- no check that the caller owns it. Naming a subject is not an ownership check
-- (CLAUDE.md). Both now derive authority from the SESSION and use the argument
-- only to confirm it -- the same guard get_plan_usage already carries.
--
-- Anonymous sign-in hands out the `authenticated` role, so "authenticated only"
-- was never a boundary against the public here.

create or replace function public.check_seat_cap(p_dealer_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  cap           int;
  current_count int;
begin
  if auth.uid() is null
     or not (p_dealer_id = auth.uid()
             or p_dealer_id = public.get_my_dealer_id()
             or public.is_superadmin()) then
    raise exception 'not authorized';
  end if;

  select pc.seat_cap into cap
  from profiles p
  join plan_config pc on pc.plan = p.plan::text
  where p.id = p_dealer_id;

  if cap is null then
    return jsonb_build_object('allowed', true);
  end if;

  select count(*) into current_count
  from profiles
  where dealer_id = p_dealer_id
    and is_active = true;

  if current_count >= cap then
    return jsonb_build_object('allowed', false, 'cap', cap, 'current', current_count);
  end if;

  return jsonb_build_object('allowed', true, 'cap', cap, 'current', current_count);
end;
$function$;

-- Was a cross-dealer VIN/plate existence oracle: hand it any plate and it told
-- you whether another dealer on the platform has that car listed. Count-only,
-- but it confirmed the fact to anyone signed in, guest buyers included.
create or replace function public.count_other_dealer_vin_plate(
  p_field text,
  p_value text,
  p_dealer_id uuid,
  p_exclude_listing uuid default null::uuid
)
 returns integer
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  n int;
begin
  if auth.uid() is null
     or not (p_dealer_id = auth.uid()
             or p_dealer_id = public.get_my_dealer_id()
             or public.is_superadmin()) then
    raise exception 'not authorized';
  end if;

  select count(*)::int into n
  from car_listings
  where status = any (array['available','active','reserved','pending_approval'])
    and dealer_id is distinct from p_dealer_id
    and (p_exclude_listing is null or id <> p_exclude_listing)
    and case
          when p_field = 'plate' then upper(plate_number) = upper(btrim(p_value))
          else upper(coalesce(vin_number, vin)) = upper(btrim(p_value))
        end;

  return n;
end;
$function$;
