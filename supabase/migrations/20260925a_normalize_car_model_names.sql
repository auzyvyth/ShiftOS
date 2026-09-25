-- One model name per model, so brand/model pages, the buyer model filter and
-- search titles can group cars. Live data had 12 Alphards spelled four ways
-- ("ALPHARD 2.5L", "Alphard", ...), engine sizes typed into `model`, and
-- "RX350" / "Rx350" / "RX" for one car line. The CarForm picker allows custom
-- text (and five other screens write listings), so the rule lives HERE, in a
-- BEFORE trigger, where every write path goes through it.
--
-- Rules (model = the plain name from src/data/carData.js; the rest -> variant):
--   1. trim + collapse spaces on brand / model / variant
--   2. an engine size inside model moves to the front of variant
--      ("HARRIER 2.0L" + "G"  ->  "HARRIER" + "2.0L G")
--   3. Lexus series+number splits ("RX350" -> "RX" + "350 ...")
--   4. ALL-CAPS or all-lowercase names get title case, but only when a word
--      has 4+ letters, so real acronyms (BRZ, WRX, CR-V, RAV4) are untouched
-- Slugs are set on INSERT only (set_car_slug), so no existing URL changes.

-- Pure function: the rules, reusable for previews and the one-time backfill.
create or replace function public.normalize_car_model_parts(
  p_brand text, p_model text, p_variant text,
  out model text, out variant text)
language plpgsql
immutable
set search_path = public
as $$
declare
  m text[];
begin
  model   := nullif(regexp_replace(btrim(coalesce(p_model, '')),   '\s+', ' ', 'g'), '');
  variant := nullif(regexp_replace(btrim(coalesce(p_variant, '')), '\s+', ' ', 'g'), '');
  if model is null then
    return;
  end if;

  -- 2. engine size typed into the model
  m := regexp_match(model, '^(.+?)\s+(\d\.\d\s*L?\s*(\(T\)|T)?(\s.*)?)$', 'i');
  if m is not null then
    model   := m[1];
    variant := btrim(m[2] || ' ' || coalesce(variant, ''));
  end if;

  -- 3. Lexus: series letters + displacement number
  if lower(btrim(coalesce(p_brand, ''))) = 'lexus' then
    m := regexp_match(model, '^(IS|ES|GS|LS|UX|NX|RX|GX|LX|RC|LC)\s*(\d{3}h?)$', 'i');
    if m is not null then
      model   := upper(m[1]);
      variant := btrim(m[2] || ' ' || coalesce(variant, ''));
    end if;
  end if;

  -- 4. shouting / lowercase names -> title case (acronyms left alone)
  if model ~ '[A-Za-z]{4,}' and (model = upper(model) or model = lower(model)) then
    model := initcap(model);
  end if;

  variant := nullif(btrim(variant), '');
end;
$$;

create or replace function public.normalize_car_model()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  new.brand := nullif(regexp_replace(btrim(coalesce(new.brand, '')), '\s+', ' ', 'g'), '');
  r := public.normalize_car_model_parts(new.brand, new.model, new.variant);
  new.model   := r.model;
  new.variant := r.variant;
  return new;
end;
$$;

drop trigger if exists trg_normalize_car_model on public.car_listings;
create trigger trg_normalize_car_model
  before insert or update of brand, model, variant on public.car_listings
  for each row execute function public.normalize_car_model();

-- One-off corrections the generic rules cannot infer (a model name that is
-- really a trim of a catalogue model). Keyed on the exact current values.
update public.car_listings set model = 'G-Class', variant = btrim('G63 ' || coalesce(variant, ''))
  where brand = 'Mercedes-Benz' and model = 'G63';
update public.car_listings set model = '911', variant = btrim('GT3 (992) ' || coalesce(variant, ''))
  where brand = 'Porsche' and model = '992 GT3';
update public.car_listings set model = 'Crown', variant = btrim('Sport ' || coalesce(variant, ''))
  where brand = 'Toyota' and upper(model) = 'CROWN SPORT';

-- Backfill: only rows the rules would change (the trigger does the rewrite).
update public.car_listings c set model = c.model
  where c.brand is distinct from nullif(regexp_replace(btrim(coalesce(c.brand, '')), '\s+', ' ', 'g'), '')
     or exists (
       select 1 from public.normalize_car_model_parts(c.brand, c.model, c.variant) n
       where n.model is distinct from c.model or n.variant is distinct from c.variant);

-- stock_units keeps its own copy of model/variant (auto_create_stock_unit).
update public.stock_units s set model = c.model, variant = c.variant
  from public.car_listings c
  where s.listing_id = c.id
    and (s.model is distinct from c.model or s.variant is distinct from c.variant);

revoke all on function public.normalize_car_model_parts(text, text, text) from public;
revoke all on function public.normalize_car_model() from public;

-- The trigger calls this as the writing user (SECURITY INVOKER), so every role
-- that saves a listing needs EXECUTE. Explicit, not reliant on default privileges.
grant execute on function public.normalize_car_model_parts(text, text, text) to authenticated, service_role;
