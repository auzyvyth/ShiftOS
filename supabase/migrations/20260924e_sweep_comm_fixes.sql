-- Dealer dashboard communication sweep (2026-09-24).
--
-- 1. Account purge has failed every night. auth.users -> profiles -> car_listings
--    all cascade, and trg_delete_stock_on_listing_delete then deletes the car's
--    stock_units row — as the AUTH service's role, which has no privilege on
--    stock_units ("permission denied for table stock_units", then GoTrue's
--    "Database error deleting user"). The one invoker trigger on that path; run
--    it as definer like the other sync triggers.
-- 2. notify_new_enquiry linked the dealer's bell to tab 'enquiries', which no
--    longer exists (enquiries live in Leads / CRM): tapping it opened a blank
--    pane. Point it at 'crm' and repoint the rows already sent.

create or replace function public.sync_delete_stock_on_listing_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  delete from stock_units where listing_id = old.id;
  return old;
end;
$function$;

create or replace function public.notify_new_enquiry()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
  values (
    new.dealer_id, 'new_enquiry', 'New enquiry received',
    coalesce(new.buyer_name, 'Someone') || ' is interested in a car',
    'crm', new.id
  );
  return new;
end; $function$;

update dealer_notifications set link_to = 'crm' where link_to = 'enquiries';
