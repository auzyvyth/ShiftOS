-- Every CarForm image upload was failing with 42501
-- "new row violates row-level security policy".
--
-- Cause: both upload paths in CarForm.jsx send upsert:true (added earlier as a
-- retry-idempotency fix). Supabase Storage implements upsert as
--   INSERT INTO storage.objects ... ON CONFLICT (name, bucket_id) DO UPDATE ...
-- and Postgres evaluates that statement against the UPDATE and SELECT policies
-- as well as the INSERT one -- even when no conflicting row exists. The
-- car-images bucket had ONLY an INSERT policy ("Auth upload") and a DELETE
-- policy, so the whole statement was rejected every time. The avatars bucket
-- has avatars_update, which is why avatar upserts kept working and only car
-- photos failed.
--
-- Confirmed from storage_logs (queryName "UpsertObject", x_upsert "true",
-- code 42501) and reproduced by probing as a real salesman: a plain INSERT
-- passed while the upsert form failed, and both passed once these were added.
-- Note the failing uploads were only ~175KB, so client-side compression was
-- never the problem.
--
-- Applied live via MCP apply_migration on 2026-08-28 (migrations
-- car_images_update_policy_for_upsert + car_images_select_policy_for_upsert);
-- committed here so the repo carries the source.

-- UPDATE half. Scoped to the uploader's own uid folder (same shape as the
-- existing "Authenticated delete own images" policy) so a user can only
-- overwrite their OWN images -- a blanket authenticated UPDATE would let any
-- logged-in user overwrite any dealer's photos.
drop policy if exists "car_images_update_own" on storage.objects;
create policy "car_images_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'car-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'car-images'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- SELECT half: ON CONFLICT DO UPDATE has to be able to read the conflict
-- target row. Not a disclosure change -- the car-images bucket is public=true,
-- so every object in it is already readable by anyone via its public URL.
drop policy if exists "car_images_select_own" on storage.objects;
create policy "car_images_select_own"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'car-images');
