import { MY_STATES } from '../utils/locations';
import { readCache } from '../utils/localCache';
// Canonical brand whitelist used for filtering. Must cover every brand the
// brand strips link to AND every brand value that can exist in the DB (from
// CarForm CAR_DATA), otherwise sanitizeBrand() drops the param and the page
// renders unfiltered. Includes both "Mercedes" and "Mercedes-Benz" so neither
// stored spelling slips through.
export const BRANDS = [
  'Perodua','Proton','Honda','Toyota','Nissan','Mazda','Mitsubishi','Suzuki',
  'Subaru','Daihatsu','Hyundai','Kia','BMW','Mercedes-Benz','Mercedes',
  'Volkswagen','Audi','Porsche','Lexus','Volvo','Tesla','Ford','MG','BYD',
  'MINI','Chery','Haval','Geely','Jaguar','Land Rover','Ferrari','Lamborghini',
  'Bentley','Rolls Royce','Alfa Romeo',
];
// Brands surfaced in the filter <select> dropdowns (curated, common-first).
export const BRAND_OPTIONS = ['Perodua','Proton','Honda','Toyota','Mazda','BMW','Mercedes-Benz','Hyundai','Nissan','Mitsubishi','Kia','Volvo','Lexus','Subaru','Volkswagen','Audi','Suzuki','Daihatsu'];
export const BODY_TYPES = ['Sedan','SUV','MPV','Hatchback','Coupe','Pickup'];
export const TRANSMISSIONS = ['Auto','Manual'];
export const FINANCING_TYPES = [
  { value: 'loan', label: 'Loan' },
  { value: 'cash', label: 'Cash Only' },
];
// Re-exported from the one list (src/utils/locations.js). This copy was
// missing Labuan and Putrajaya, so a seller in either could not be filtered
// for on the marketplace even though signup let them pick it.
export { MY_STATES };
export const SORT_OPTIONS = [
  { label: 'Newest First',       value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

export const MILEAGE_OPTIONS = [
  { label: 'Under 20,000 km',  value: '20000' },
  { label: 'Under 50,000 km',  value: '50000' },
  { label: 'Under 80,000 km',  value: '80000' },
  { label: 'Under 150,000 km', value: '150000' },
];
export const CONDITION_OPTIONS = [
  { value: 'used',  label: 'Used' },
  { value: 'new',   label: 'New' },
  { value: 'recon', label: 'Recon / Import' },
];
export const FUEL_TYPES = ['Petrol','Diesel','Electric','Hybrid','Mild Hybrid'];
export const COLOURS    = ['White','Black','Silver','Grey','Red','Blue','Brown','Green','Orange','Yellow','Gold','Maroon'];

export const CAR_FIELDS  = 'id,slug,listing_title,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at,seller_role,seller_type,dealer_is_verified,seller_sold_count,payment_type';
export const DEALER_JOIN = 'dealer:profiles!dealer_id(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color,role)';

/* Last good UNFILTERED list of live cars (newest first), kept on the device so
   the public grids survive a database outage. Written by the marketplace
   default grid and the unfiltered /showroom page 1; both select CAR_FIELDS, so
   either copy serves either page and the hero rows. Shape: { cars, totalCount }.
   Fresh copies (MarketplacePage CACHE_TTL) paint instantly; an older one is
   used ONLY when the live fetch fails, with a notice saying so. Never show it
   under an active filter -- unfiltered cars under "Toyota" would be a lie. */
export const LIVE_CARS_CACHE_KEY = 'mp_default_grid_v1';
export const LIVE_CARS_FALLBACK_TTL = 7 * 24 * 60 * 60 * 1000;

export function readLiveCarsFallback() {
  const hit = readCache(LIVE_CARS_CACHE_KEY, LIVE_CARS_FALLBACK_TTL);
  return hit?.cars?.length ? hit : null;
}

// A stalled database does not fail a request, it hangs it (60-90s on
// 2026-10-02). Race every public listing query against a timeout so the page
// settles into data, the device copy, or the retry state.
export const LISTING_QUERY_TIMEOUT = 15000;
export function withTimeout(query, ms = LISTING_QUERY_TIMEOUT) {
  return Promise.race([
    query,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export function dedupe(arr) {
  const seen = new Set();
  return arr.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
}

export function sanitizeBrand(val)       { return BRANDS.includes(val) ? val : null; }
export function sanitizeBodyType(val)    { return BODY_TYPES.includes(val) ? val : null; }
export function sanitizeTransmission(val){ return TRANSMISSIONS.includes(val) ? val : null; }
export function sanitizeFinancing(val)   { return FINANCING_TYPES.map(f => f.value).includes(val) ? val : null; }
export function sanitizeState(val)       { return MY_STATES.includes(val) ? val : null; }
export function sanitizeYear(val) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 1990 && n <= CURRENT_YEAR ? n : null;
}
export function sanitizeQ(val) {
  if (!val || typeof val !== 'string') return '';
  return val.replace(/[%_\\]/g, '').slice(0, 60).trim();
}
export function sanitizeCondition(val)   { return CONDITION_OPTIONS.map(c => c.value).includes(val) ? val : null; }
export function sanitizeMileageMax(val) {
  const n = parseInt(val, 10);
  return [20000, 50000, 80000, 150000].includes(n) ? n : null;
}
export function sanitizeFuelType(val)  { return FUEL_TYPES.includes(val) ? val : null; }
export function sanitizeColour(val)    { return COLOURS.includes(val) ? val : null; }
export function sanitizeSellerType(val){ return ['dealer','agent','private'].includes(val) ? val : null; }
export function sanitizeStr(val)       { return (!val || typeof val !== 'string') ? '' : val.replace(/[%_\\]/g,'').slice(0,80).trim(); }
export function sanitizePrice(val, PRICE_STEPS) {
  const n = parseInt(val, 10);
  const allowed = PRICE_STEPS.filter(s => s.value).map(s => parseInt(s.value, 10));
  return allowed.includes(n) ? n : null;
}
