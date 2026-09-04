// Mask the identifying tail of a chassis / VIN number for PUBLIC surfaces.
//
// The last 6 characters of a VIN are the sequential production serial — the
// part that pins a listing to one specific physical car, and the part a
// scraper needs to clone the ad or run an identity against the grant.
// Everything before it (WMI + VDS + check digit + model year + plant) is
// shared by every car of that build, so a buyer can still sanity-check the
// model, year and origin against the seller's claim.
//
// Use ONLY on buyer-facing pages. Seller-side panels (CarDetailPopup, the
// dealer dashboard, the platform console review modal) intentionally keep the
// full number — the tenant owns the car and needs it for paperwork, and RLS
// already restricts who can read those rows at all.
export function maskVin(vin) {
  const v = String(vin || '').trim();
  if (!v) return '';
  if (v.length <= 6) return '•'.repeat(v.length);
  return v.slice(0, -6) + '••••••';
}
