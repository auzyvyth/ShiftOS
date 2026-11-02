-- A salesman's car always goes through review, whichever screen saved it
-- (REVIEW-1 lock, owner 2026-11-02). Premium's quick add (CarFormFast) saved
-- straight to 'available', skipping review; it is removed from Lite/Premium,
-- and this makes the next such form harmless too.
--
-- Only for the signed-in user being role 'salesman' (solo or dealer-linked).
-- Dealers, the platform admin, service role and cron (auth.uid() null) are untouched.
-- Never touches: new-car model cards (new_car_model_id, created live on purpose by
-- new_car_add_cards), sold units (new_car_unit), or any status other than a car
-- going LIVE ('available' / 'reserved').
-- INSERT: a live status becomes 'pending_approval'.
-- UPDATE: going live FROM pending_approval / rejected / private becomes
-- 'pending_approval' (approving is the admin's job; update_listing_status already
-- does this for private cars, this backs it up for any direct write).
-- Named trg_zzz_ so it runs AFTER trg_zz_new_car_card has filled the card fields.
-- Apply after midnight MYT with nobody live (DDL freezes the API).
begin;

create or replace function public.enforce_seller_car_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.new_car_model_id is not null or coalesce(new.new_car_unit, false) then return new; end if;
  if new.status not in ('available', 'reserved') then return new; end if;
  if tg_op = 'UPDATE' and old.status not in ('pending_approval', 'rejected', 'private') then return new; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'salesman') then
    return new;
  end if;
  new.status := 'pending_approval';
  return new;
end $$;

revoke all on function public.enforce_seller_car_review() from public, anon, authenticated;

drop trigger if exists trg_zzz_seller_car_review on public.car_listings;
create trigger trg_zzz_seller_car_review
  before insert or update of status on public.car_listings
  for each row execute function public.enforce_seller_car_review();

commit;
