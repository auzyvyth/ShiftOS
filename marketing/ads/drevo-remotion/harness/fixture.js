// Real Proton model cards (seller eb8b1987..., read from public_car_listings +
// get_new_car_listing_info on 2026-11-02). Photos are a neutral drawn stand-in:
// the cards' stock photos are the brand's, and this session cannot load storage.
const BODY = {
  sedan: 'M18 112C18 97 28 90 50 86L110 78C140 52 172 40 216 39C262 38 294 52 320 74L364 82C384 86 392 97 392 112V124H18Z',
  suv: 'M20 116C20 100 28 92 48 88L92 82C112 56 138 44 182 42L278 42C308 42 328 54 346 78L372 84C386 88 392 98 392 112V124H20Z',
};
const GLASS = {
  sedan: 'M130 78C154 58 180 49 216 48C252 48 278 58 300 76Z',
  suv: 'M106 80C124 60 144 52 182 51L274 51C298 51 314 60 328 78Z',
};
function photo(type, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 600 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f38"/><stop offset=".62" stop-color="#14171c"/><stop offset="1" stop-color="#0b0d10"/></linearGradient>
  <radialGradient id="l" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="rgba(255,255,255,.18)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
  <rect width="600" height="400" fill="url(#g)"/><rect width="600" height="400" fill="url(#l)"/>
  <ellipse cx="300" cy="300" rx="230" ry="16" fill="rgba(0,0,0,.6)"/>
  <g transform="translate(95 160)"><path d="${BODY[type]}" fill="${color}"/><path d="${GLASS[type]}" fill="#1B2130"/>
  <path d="M40 100H380" stroke="rgba(255,255,255,.4)" stroke-width="3"/>
  <circle cx="104" cy="126" r="27" fill="#0b0c10"/><circle cx="104" cy="126" r="13" fill="#9AA0AA"/>
  <circle cx="312" cy="126" r="27" fill="#0b0c10"/><circle cx="312" cy="126" r="13" fill="#9AA0AA"/>
  <rect x="370" y="90" width="18" height="8" rx="3" fill="#EF4444"/><rect x="22" y="92" width="18" height="8" rx="3" fill="#F8FAFC"/></g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const v = (variant, price, model_id, engine_cc, extra = {}) => ({ variant, price, model_id, body_type: extra.body, fuel_type: 'Petrol', transmission: extra.tx, specs: { engine_cc, seats: extra.seats || 5, airbags: extra.airbags || 6, safety: extra.safety || [], features: extra.features || [] } });

const S70 = [
  v('1.5 Lite', 59800, '2bcffc16-a517-4274-9b10-76b8cbc705fd', 1499, { safety: ['Blind spot monitor', 'Reverse camera', 'Rear parking sensors'], features: ['Halogen headlamps', '8-inch touchscreen, wireless Apple CarPlay and Android Auto', 'Fabric seats'] }),
  v('1.5 Prime', 62800, '6909008e-6b1c-4ff0-9eb7-4da6a04734c0', 1499, { safety: ['Blind spot monitor', 'Reverse camera', 'Parking sensors (front and rear)'], features: ['LED headlamps', 'Auto headlamps', 'Automatic climate control', 'Leatherette seats'] }),
  v('1.5TD Executive', 73800, '21f8d253-3983-48b9-a85f-8a370e63fcf2', 1499, { safety: ['Autonomous emergency braking', 'Lane keeping assist', 'Blind spot monitor', 'Reverse camera'], features: ['LED projector headlamps', 'Auto headlamps'] }),
  v('1.5TD Premium', 79800, '13ed4979-cd48-4b37-9936-1541f7b8d4c2', 1499, { safety: ['Autonomous emergency braking', 'Lane keeping assist', 'Blind spot monitor', 'Reverse camera', 'ISOFIX'], features: ['LED projector headlamps', 'Automatic climate control'] }),
  v('1.5TD Flagship', 89800, 'ce7a89cb-dc53-4efc-9edd-45ce8c5dea76', 1499, { safety: ['Autonomous emergency braking', 'Lane keeping assist', 'Adaptive cruise control with stop and go', '360-degree camera', 'ISOFIX'], features: ['Auto high beam', 'Auto wipers', '12.3-inch touchscreen, wireless Apple CarPlay and Android Auto', 'Full digital instrument cluster', "Power-adjustable driver's seat"] }),
  v('1.5TD Flagship X', 94800, '16e04976-7dd7-4332-87f0-5f5c53ab05b9', 1499, { safety: ['Autonomous emergency braking', 'Adaptive cruise control with stop and go', 'Steering assist', '360-degree camera'], features: ['12.3-inch touchscreen, wireless Apple CarPlay and Android Auto', 'Sunroof'] }),
];
const SAGA = [v('1.5 Standard', 38990, '9b306298-071e-4f1c-a3d2-c044a859035c', 1499), v('1.5 Executive', 44990, '2b9dcf47-46ee-467c-89c4-46cb34aa0cd2', 1499), v('1.5 Premium', 49990, 'c7b4972e-84c6-4307-81f8-7e95a019713b', 1499)];
const X50 = [v('1.5TD Executive', 89800, '040836da-4b39-4623-b385-574b49a3f6f2', 1499), v('1.5TD Premium', 101800, '36bf50e1-339a-43bd-871e-a2dec938d688', 1499), v('1.5TD Flagship', 113300, '33435d69-d1a6-46c2-a2ec-fd33005476ea', 1499), v('1.5TD Sport Edition', 115299, '3bea6fa8-160b-4759-a92c-12148247e4ee', 1499)];
const X70 = [v('1.5TD Executive', 106800, 'f473d477-ab18-4d16-b012-de6adc7f95bc', 1499), v('1.5TD Premium', 119800, '45739572-dc97-44cd-bb2c-0daee7c3697a', 1499)];
const X90 = [v('1.5TD Lite', 106800, '83732e02-61e3-4069-9157-fd2a1ba47da9', 1499, { seats: 7 }), v('1.5TD Prime', 116800, '8fe17c36-bfad-4c6c-a90e-115325511ba4', 1499, { seats: 7 }), v('1.5TD Prime X', 122800, '7fd4d26b-c836-4dca-baab-2d01568f57d8', 1499, { seats: 6 })];

const card = (id, slug, model, body, price, variants, color) => ({
  id, slug, year: 2026, brand: 'Proton', model, variant: null, selling_price: price, condition: 'new',
  is_model_card: true, stock_photos: true, body_type: body, fuel_type: 'Petrol', engine_cc: null, mileage: 0,
  status: 'available', state: 'Selangor', city: 'Shah Alam', images: [photo(body === 'SUV' ? 'suv' : 'sedan', color)],
  _variants: variants,
});

export const LISTINGS = [
  card('4a108c4c-dad9-470c-ba41-4d501d7e5cd3', 'proton-s70-2026-4a10', 'S70', 'Sedan', 59800, S70, '#C9CED6'),
  card('a09b9940-d510-4c6c-b5e2-54f9cde3aed1', 'proton-saga-2026-a09b', 'Saga', 'Sedan', 38990, SAGA, '#B91C1C'),
  card('9356c178-a2a8-4995-9ba4-381d67bce8c9', 'proton-x50-2026-9356', 'X50', 'SUV', 89800, X50, '#E5E7EB'),
  card('ff8bbddf-edad-40ca-a073-61713f5b93a1', 'proton-x70-2026-ff8b', 'X70', 'SUV', 106800, X70, '#1F2937'),
  card('38c05e3a-8642-4c2c-bf39-1a996b98cd23', 'proton-x90-2026-38c0', 'X90', 'SUV', 106800, X90, '#6B7280'),
];

export function infoFor(id) {
  const c = LISTINGS.find((l) => l.id === id);
  if (!c) return null;
  const vs = c._variants.map((x) => ({ ...x, body_type: c.body_type, fuel_type: 'Petrol', transmission: c.body_type === 'SUV' ? '7-speed DCT' : 'CVT', effective_from: '2026-10-08' }));
  return { brand: 'Proton', model: c.model, variant: vs[0].variant, specs: vs[0].specs, variants: vs, body_type: c.body_type, fuel_type: 'Petrol', price_zone: 'peninsular', transmission: vs[0].transmission, effective_from: '2026-10-08', advisor_verified: true, other_cards: [] };
}
