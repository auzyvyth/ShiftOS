// Single source of truth for "is this listing well-informed enough to sell" —
// used by the Inventory tab badge, the Analytics incomplete-listings card, and
// the CarForm publish gate. Bulk/AI import and quick manual entries often
// leave several of these blank; buyers won't trust (or the platform won't
// show well) a listing missing them. Keep all call sites on this list rather
// than re-implementing the check so they can't drift apart.
export const LISTING_GAP_CHECKS = [
  { key: "photos", label: "photos", test: (l) => Array.isArray(l.images) && l.images.length > 0 },
  { key: "price", label: "price", test: (l) => l.selling_price && Number(l.selling_price) > 0 },
  { key: "mileage", label: "mileage", test: (l) => l.mileage && Number(l.mileage) > 0 },
  { key: "transmission", label: "transmission", test: (l) => !!l.transmission },
  { key: "fuel_type", label: "fuel type", test: (l) => !!l.fuel_type },
  { key: "vin", label: "VIN", test: (l) => !!l.vin_number },
  { key: "colour", label: "colour", test: (l) => !!l.colour },
  { key: "condition", label: "condition", test: (l) => !!l.condition },
  { key: "state", label: "state", test: (l) => !!l.state },
];

// listing: a car_listings-shaped object (or an equivalent — pass a mapped
// object if your field names differ, e.g. a form's camelCase state).
export function getListingGaps(listing) {
  return LISTING_GAP_CHECKS.filter((c) => !c.test(listing)).map((c) => c.label);
}
