-- INPUT-1 (2026-10-28): length limits on free text, and file types on car-docs.
--
-- Most text columns had no limit, so anything that writes them (a public form,
-- or a direct API call that skips the form) could store megabytes in a name.
-- The limits are generous: they stop junk, not real use. Each sits well above
-- what the app's own forms allow (CreateSellerModal bio 2000, chat 4000) and
-- far above the longest value stored when this was written (names 28 chars,
-- descriptions 494), so every existing row passes and no form can hit them.
-- Phone numbers are NOT checked here: src/lib/phone.js + api/* do that, and a
-- refusal in the DB would silently drop real leads written by triggers.

alter table public.leads
  add constraint leads_buyer_name_len check (char_length(buyer_name) <= 120),
  add constraint leads_notes_len check (char_length(notes) <= 20000);

alter table public.whatsapp_enquiries
  add constraint whatsapp_enquiries_buyer_name_len check (char_length(buyer_name) <= 120),
  add constraint whatsapp_enquiries_buyer_message_len check (char_length(buyer_message) <= 4000);

alter table public.appointments
  add constraint appointments_buyer_name_len check (char_length(buyer_name) <= 120),
  add constraint appointments_notes_len check (char_length(notes) <= 4000);

alter table public.customers
  add constraint customers_name_len check (char_length(name) <= 120);

alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 120),
  add constraint profiles_job_title_len check (char_length(job_title) <= 120),
  add constraint profiles_bio_len check (char_length(bio) <= 4000);

alter table public.car_listings
  add constraint car_listings_description_len check (char_length(description) <= 10000);

alter table public.waitlist_signups
  add constraint waitlist_signups_name_len check (char_length(name) <= 120);

alter table public.sensus_demo_requests
  add constraint sensus_demo_requests_name_len check (char_length(name) <= 120),
  add constraint sensus_demo_requests_note_len check (char_length(note) <= 4000);

alter table public.listing_reports
  add constraint listing_reports_note_len check (char_length(note) <= 2000),
  add constraint listing_reports_reason_len check (char_length(reason) <= 200);

-- car-docs (private) accepted any file type. CarForm offers PDF + images only
-- (accept=".pdf,.jpg,.jpeg,.png,.webp"); every stored file is a JPEG.
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'car-docs';
