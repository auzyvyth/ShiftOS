-- SEC-3 finish: car documents left behind in the PUBLIC car-images bucket.
-- The 2026-10 move copied every document a listing used into the private
-- car-docs bucket, but its "delete the public copy" step could not work: the
-- superadmin had a DELETE policy on car-images and no SELECT policy, and
-- storage deletes only rows the caller can also see. So the public copies
-- stayed, plus older uploads no listing uses any more.
--
-- 1. The superadmin may see document files in car-images (docs folders only),
--    so the console can delete them.
-- 2. get_public_doc_leftovers(): the console's list of those files, with
--    whether a private copy already exists and whether a listing still points
--    at the public file. Superadmin only; returns nothing for anyone else.
-- QUEUED: apply after midnight MYT, nobody live.

begin;

drop policy if exists car_images_superadmin_read_docs on storage.objects;
create policy car_images_superadmin_read_docs on storage.objects
  for select to authenticated
  using (
    bucket_id = 'car-images'
    and public.is_superadmin()
    and (name like '%/docs/%' or name like 'docs/%')
  );

create or replace function public.get_public_doc_leftovers()
returns table (name text, size_bytes bigint, has_private_copy boolean, in_use boolean)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.name,
         coalesce((o.metadata->>'size')::bigint, 0),
         exists (
           select 1 from storage.objects c
           where c.bucket_id = 'car-docs'
             and c.name like '%/docs/' || regexp_replace(o.name, '^.*/', '')
         ),
         exists (
           select 1 from public.car_listings l
           where l.car_documents::text like '%/car-images/' || o.name || '%'
         )
  from storage.objects o
  where public.is_superadmin()
    and o.bucket_id = 'car-images'
    and (o.name like '%/docs/%' or o.name like 'docs/%')
  order by o.created_at;
$$;

revoke all on function public.get_public_doc_leftovers() from public, anon;
grant execute on function public.get_public_doc_leftovers() to authenticated;

commit;
