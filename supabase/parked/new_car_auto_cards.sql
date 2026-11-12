-- PARKED: the owner declined applying this at 00:27 MYT on 2026-11-13. Apply only on their go-ahead, after midnight MYT, nobody live.

-- NEWCAR-4 (owner, 2026-11-12): a brand's sales advisor gets every model of their brand on
-- their page automatically, never by hand. Signup already added them from the browser
-- (NEWCAR-3), but only models that HAD photos at that moment, and console-made accounts got
-- nothing. The one Toyota advisor had 0 cards because Toyota had no photos when they joined.
--
-- One server rule, two moments:
--   1. a seller finishes onboarding (or changes brand)  -> every eligible model of their brand
--   2. a model gets its FIRST photos in the console      -> that model, for every advisor of the brand
-- "Eligible" = has photos + an active price row. A seller who already has ANY card of the model
-- (even one they took off = archived) is skipped, so taking a model off is respected.
-- Only standalone salesmen (dealer_id NULL): new_car_card_fill prices cards off the row's
-- dealer profile, so a linked salesman's card is not supported anyway.
-- Every insert is wrapped: a failure never blocks a signup or a photo save.

create or replace function public._new_car_fill_seller(p_seller uuid, p_model text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p profiles%rowtype;
  r record;
  v_added int := 0;
begin
  select * into p from profiles where id = p_seller;
  if p.id is null or p.new_car_brand is null or p.role <> 'salesman' or p.dealer_id is not null
     or not coalesce(p.onboarding_complete, false)
     or coalesce(p.account_status, '') = 'deleted' then
    return 0;
  end if;

  for r in
    select mm.model, mm.images,
           (select nm.id from new_car_models nm
             where nm.brand = mm.brand and nm.model = mm.model and nm.is_active
             order by nm.price_peninsular nulls last, nm.sort_order limit 1) as mid
      from new_car_model_media mm
     where mm.brand = p.new_car_brand
       and coalesce(array_length(mm.images, 1), 0) > 0
       and (p_model is null or mm.model = p_model)
       and not exists (select 1 from car_listings c
                        where c.dealer_id = p.id and c.brand = mm.brand and c.model = mm.model
                          and c.new_car_model_id is not null and not coalesce(c.new_car_unit, false))
  loop
    continue when r.mid is null;
    begin
      perform set_config('app.stock_cards', 'on', true);
      -- Price, variant, specs and slug are set by new_car_card_fill.
      insert into car_listings (dealer_id, assigned_to, new_car_model_id, brand, model,
                                selling_price, condition, state, city, status, images, stock_photos)
      select p.id, p.id, r.mid, p.new_car_brand, r.model,
             nm.price_peninsular, 'new', p.state, p.city, 'available', r.images, true
        from new_car_models nm where nm.id = r.mid;
      perform set_config('app.stock_cards', '', true);
      v_added := v_added + 1;
    exception when others then
      perform set_config('app.stock_cards', '', true);
      raise warning '_new_car_fill_seller % %: %', p_seller, r.model, sqlerrm;
    end;
  end loop;
  return v_added;
end $$;

revoke all on function public._new_car_fill_seller(uuid, text) from public, anon, authenticated;

-- 1. Onboarding finished / brand changed.
create or replace function public.trg_new_car_cards_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.new_car_brand is not null and coalesce(new.onboarding_complete, false)
     and (old.onboarding_complete is distinct from new.onboarding_complete
          or old.new_car_brand is distinct from new.new_car_brand) then
    begin
      perform _new_car_fill_seller(new.id);
    exception when others then
      raise warning 'trg_new_car_cards_on_profile %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_new_car_cards_on_profile on public.profiles;
create trigger trg_new_car_cards_on_profile
  after update of onboarding_complete, new_car_brand on public.profiles
  for each row execute function public.trg_new_car_cards_on_profile();

-- 2. A model gets its first photos. Later photo edits do not re-add (new_car_media_sync
--    already swaps the photos on existing cards).
create or replace function public.trg_new_car_cards_on_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare s uuid;
begin
  if coalesce(array_length(new.images, 1), 0) = 0 then return new; end if;
  if tg_op = 'UPDATE' and coalesce(array_length(old.images, 1), 0) > 0 then return new; end if;
  for s in
    select id from profiles
     where new_car_brand = new.brand and role = 'salesman' and dealer_id is null
       and coalesce(onboarding_complete, false) and coalesce(account_status, '') <> 'deleted'
  loop
    begin
      perform _new_car_fill_seller(s, new.model);
    exception when others then
      raise warning 'trg_new_car_cards_on_media %: %', s, sqlerrm;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists trg_new_car_cards_on_media on public.new_car_model_media;
create trigger trg_new_car_cards_on_media
  after insert or update of images on public.new_car_model_media
  for each row execute function public.trg_new_car_cards_on_media();
