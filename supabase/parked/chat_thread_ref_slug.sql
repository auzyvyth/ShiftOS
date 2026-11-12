-- PARKED (2026-11-11). In-app chat honours the visit's ?ref= like WhatsApp, booking and
-- enquiry already do (audit 2026-11-11: a buyer who came from a salesman's page and chatted
-- about an unassigned dealer car landed in the dealer pool, not with that salesman).
--
-- start_chat_thread(uuid) passed NULL as the ref to resolve_lead_salesman. This adds an
-- optional p_ref_slug. The resolver still checks the slug is a salesman of THIS car's dealer
-- (rule 1), so a guessed slug cannot pull a lead across dealers.
--
-- Adding a parameter makes a NEW overload (see CLAUDE.md "CREATE OR REPLACE FUNCTION does NOT
-- replace a function whose params you reordered"), so the old (uuid) one is dropped in the
-- same migration. useChat.js calls it by NAME with p_listing_id, which resolves to the new
-- one through the default. Ship the client change (pass p_ref_slug: getRef()) only AFTER this
-- is applied, or the extra named argument fails with PGRST202 on the old function.
--
-- Body below is the live definition read 2026-11-11 (pg_get_functiondef), changed only at
-- the resolver call. Re-read the live body before applying: it may have moved on.

begin;

drop function if exists public.start_chat_thread(uuid);

create function public.start_chat_thread(p_listing_id uuid, p_ref_slug text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_anon   boolean;
  v_listing public.car_listings;
  v_label  text;
  v_salesman uuid;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'sign in required';
  end if;

  select * into v_listing from public.car_listings where id = p_listing_id;
  if v_listing.id is null then
    raise exception 'listing not found';
  end if;

  if not exists (select 1 from public.chat_threads
                  where listing_id = p_listing_id and buyer_id = v_uid)
     and (select count(*) from public.chat_threads
           where buyer_id = v_uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'rate_limited' using errcode = 'check_violation';
  end if;

  select coalesce(u.is_anonymous, false) into v_anon from auth.users u where u.id = v_uid;

  select case
           when v_anon then 'Guest ' || upper(substr(replace(v_uid::text, '-', ''), 1, 4))
           else coalesce(nullif(trim(p.full_name), ''),
                         nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
                         'Buyer')
         end
    into v_label
    from public.profiles p where p.id = v_uid;

  v_label := coalesce(v_label, 'Guest ' || upper(substr(replace(v_uid::text, '-', ''), 1, 4)));

  -- Same resolver as create_lead_from_whatsapp and the enquiry_to_lead trigger, now WITH the ref.
  v_salesman := public.resolve_lead_salesman(
    v_listing.dealer_id, p_listing_id, nullif(btrim(left(coalesce(p_ref_slug, ''), 80)), ''), null);

  insert into public.chat_threads
    (listing_id, dealer_id, salesman_id, buyer_id, buyer_label, buyer_is_anon)
  values
    (p_listing_id, v_listing.dealer_id, v_salesman, v_uid, v_label, v_anon)
  on conflict (listing_id, buyer_id) do update
    set buyer_label   = excluded.buyer_label,
        buyer_is_anon = excluded.buyer_is_anon,
        salesman_id   = coalesce(public.chat_threads.salesman_id, excluded.salesman_id)
  returning id into v_id;

  return v_id;
end;
$function$;

-- Grants re-asserted explicitly (a DROP + CREATE loses them). Guests use anonymous
-- sign-in, which is the `authenticated` role, so anon itself does not need it.
revoke all on function public.start_chat_thread(uuid, text) from public, anon;
grant execute on function public.start_chat_thread(uuid, text) to authenticated, service_role;

commit;

-- After applying, check:
--   select oid::regprocedure from pg_proc where proname = 'start_chat_thread';  -- exactly ONE row
--   select has_function_privilege('authenticated', 'public.start_chat_thread(uuid, text)', 'execute');  -- true
