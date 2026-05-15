export const BRANDS = ['Perodua','Proton','Honda','Toyota','Mazda','BMW','Mercedes-Benz','Hyundai','Nissan','Mitsubishi','Kia','Volvo'];
export const BODY_TYPES = ['Sedan','SUV','MPV','Hatchback','Coupe','Pickup'];
export const TRANSMISSIONS = ['Auto','Manual'];
export const FINANCING_TYPES = [
  { value: 'loan',          label: 'Loan' },
  { value: 'cash',          label: 'Cash Only' },
  { value: 'sambung_bayar', label: 'Sambung Bayar' },
];
export const MY_STATES = ['Kuala Lumpur','Selangor','Johor','Penang','Perak','Kedah','Pahang','Negeri Sembilan','Melaka','Sabah','Sarawak','Terengganu','Kelantan','Perlis'];
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

export const CAR_FIELDS  = 'id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,engine_cc,condition,previous_owners,auction_grade,interior_grade,is_recon,financing_type,images,status,created_at';
export const DEALER_JOIN = 'dealer:profiles!car_listings_dealer_id_fkey(dealership,site_name,subdomain,whatsapp_number,site_logo_url,brand_color,role)';

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
export function sanitizeSellerType(val){ return ['dealer','agent'].includes(val) ? val : null; }
export function sanitizeStr(val)       { return (!val || typeof val !== 'string') ? '' : val.replace(/[%_\\]/g,'').slice(0,80).trim(); }
export function sanitizePrice(val, PRICE_STEPS) {
  const n = parseInt(val, 10);
  const allowed = PRICE_STEPS.filter(s => s.value).map(s => parseInt(s.value, 10));
  return allowed.includes(n) ? n : null;
}
