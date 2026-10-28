// Instant car page (owner, 2026-10-21). Two things, both started by the CARD
// the buyer taps rather than by the car page after it mounts:
//  1. a preview (title, price, first photo) the card already holds, so the car
//     page's loading screen shows the actual car instead of grey boxes;
//  2. the full row request, fired on pointer-down, so it is in flight while the
//     finger is still on the glass and the lazy page code is downloading.
// Public data only, kept in memory (never stored on the device).
import { publicClient } from "../supabaseClient";
import { withTimeout } from "../config/marketplaceConfig";

// seller_role (from the public_car_listings view) is the authoritative signal
// for agent-vs-dealer on the car page — without it in the select,
// carData.seller_role is always undefined and the get_salesman_by_id lookup
// never fires, so a Salesman Lite listing silently falls through to a nameless
// "Seller" with no mini-page link.
export const CAR_PUBLIC_FIELDS = "id,listing_title,specs_overridden,brand,model,variant,year,state,mileage,colour,condition,registration_date,specs,options,features,selling_price,images,created_at,transmission,city,body_type,fuel_type,status,engine_cc,previous_price,original_price,dealer_id,vin_number,auction_grade,interior_grade,is_recon,import_country,damage_map,local_reg_date,auction_house,chassis_status,assigned_to,slug,video_url,salesman_slug,document_types,previous_owners,road_tax_expiry,loan_eligible,warranty_months,deposit_amount,ai_captions,financing_type,dealer_perks,canonical_variant,description,included_services,co2_emissions,fuel_consumption,insurance_group,horsepower,acceleration,top_speed,boot_size,doors,seats,safety_rating,cylinders,market_avg_price,market_sample_count,puspakom_b5_date,puspakom_b7_date,seller_role,seller_type,payment_type,docs_verified,geran_status,condition_declared_at,is_model_card";

const ROW_TTL = 30 * 1000;
const previews = new Map(); // slug or id -> { title, price, image }
const rows = new Map();     // slug or id -> { at, promise }

function keysOf(car) {
  return [car?.slug, car?.id].filter(Boolean).map(String);
}

export function rememberCarPreview(car) {
  if (!car) return;
  const preview = {
    title: [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" "),
    // The car page heading's order (brand, model, trim, year), so the preview
    // and the loaded page say the same thing in the same place.
    heading: [car.brand, car.model, car.variant, car.year].filter(Boolean).join(" "),
    // Brand + model let the "no longer listed" screen offer cars like it.
    brand: car.brand || null,
    model: car.model || null,
    price: Number(car.selling_price) > 0 ? Number(car.selling_price) : null,
    image: Array.isArray(car.images) ? car.images.find(Boolean) || null : null,
  };
  for (const k of keysOf(car)) previews.set(k, preview);
}

export function getCarPreview(key) {
  return key ? previews.get(String(key)) || null : null;
}

// Same lookup the car page has always done: by slug, then by id. A stalled
// database hangs a request rather than failing it, hence the cap.
export function fetchCarRow(key) {
  const k = String(key || "");
  const hit = rows.get(k);
  if (hit && Date.now() - hit.at < ROW_TTL) return hit.promise;
  const promise = (async () => {
    let res = await withTimeout(
      publicClient.from("public_car_listings").select(CAR_PUBLIC_FIELDS).eq("slug", k).maybeSingle(), 12000);
    if (!res.data && !res.error) {
      res = await withTimeout(
        publicClient.from("public_car_listings").select(CAR_PUBLIC_FIELDS).eq("id", k).maybeSingle(), 12000);
    }
    return { data: res.data || null, error: res.error || null };
  })().catch((error) => ({ data: null, error }));
  // Failures are not kept, so a retry goes back to the database.
  promise.then((r) => { if (r.error) rows.delete(k); });
  rows.set(k, { at: Date.now(), promise });
  return promise;
}

// Props for any link or card that opens a car page.
export function carWarmProps(car) {
  return {
    onPointerDown: () => {
      rememberCarPreview(car);
      const k = car?.slug || car?.id;
      if (k) fetchCarRow(k);
    },
  };
}
