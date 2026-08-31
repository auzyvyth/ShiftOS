-- Follow-up to 20260831c. The site footer prints a platform support contact and
-- reads it from public_dealer_profiles by a hardcoded id
-- (Footer.jsx:8 SUPERADMIN_ID). That id is NOT a superadmin row — it is
-- role='dealer' — so guarding the email/phone columns on role='superadmin'
-- blanked the footer. Guard on the designated contact row itself instead:
-- exactly one profile publishes a contact email and phone, everyone else on the
-- marketplace returns NULL for both.
create or replace view public.public_dealer_profiles as
  select id, slug, subdomain, custom_domain, dealership, site_name,
         site_logo_url, logo_url, brand_color, font_choice,
         hero_title, hero_subtitle, hero_cta_text, about_text,
         whatsapp_number, location, city, state,
         social_tiktok, social_instagram, social_facebook,
         announcement_bar, announcement_bar_enabled,
         storefront_why, storefront_how, storefront_testimonials, storefront_cta,
         hero_video_url, hero_video_title, hero_video_enabled,
         avatar_url, watermark_text, is_active,
         whatsapp_number as contact_whatsapp,
         case when role = 'superadmin'
                or id = '1e7bf24e-5b71-4c64-8d03-b60db5e59316'::uuid
              then email else null end as email,
         case when role = 'superadmin'
                or id = '1e7bf24e-5b71-4c64-8d03-b60db5e59316'::uuid
              then phone else null end as phone
    from profiles
   where role = any (array['dealer','owner','superadmin'])
     and is_active = true
     and account_status is distinct from 'deleted';

revoke all on public.public_dealer_profiles from anon, authenticated, public;
grant select on public.public_dealer_profiles to anon, authenticated;
