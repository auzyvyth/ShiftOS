// The dealer's active hero slides, the ONE read of `hero_carousel_slides` for the dealer site:
// HeroCarousel (top banner A "Slides") and the full-screen banner (C, background Photo) both
// use it. Slides linked to a car that has since sold are left out.
import { supabase } from "../../supabaseClient";

export async function loadHeroSlides(dealerId) {
  if (!dealerId) return [];
  const { data, error } = await supabase
    .from("hero_carousel_slides")
    .select("*")
    .eq("active", true)
    .eq("dealer_id", dealerId)
    .order("sort_order", { ascending: true });
  let rows = !error && data ? data : [];
  // Enrich linked listings via the anon-safe public view. The base
  // car_listings table is NOT readable by anon (it holds dealer
  // financials), so embedding car_listings(...) here 403s the whole
  // request for logged-out visitors and the hero renders empty. The
  // public_car_listings view exposes slug/status publicly.
  const carIds = [...new Set(rows.map(r => r.car_listing_id).filter(Boolean))];
  if (carIds.length) {
    const { data: cars } = await supabase
      .from("public_car_listings")
      .select("id, slug, status")
      .in("id", carIds);
    const byId = {};
    (cars || []).forEach(c => { byId[c.id] = c; });
    rows = rows.map(r => (r.car_listing_id ? { ...r, car_listings: byId[r.car_listing_id] || null } : r));
  }
  return rows.filter(s => !s.car_listing_id || s.car_listings?.status !== 'sold');
}

// The first slide that is a photo (a "text" slide has no picture to show), or null.
export const firstSlidePhoto = (slides) =>
  (slides || []).find((s) => s?.image_url && s.mode !== "text")?.image_url || null;
