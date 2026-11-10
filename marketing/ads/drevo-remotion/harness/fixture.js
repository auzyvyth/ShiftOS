// premiummotors's real listings (public_car_listings, read 2026-11-02), with the
// seller's own photos (uploaded by the owner). Order = the #N on the presenter.
const car = (id, slug, year, brand, model, variant, price, cc, mileage, body, colour, tx, img) => ({
  id, slug, year, brand, model, variant, selling_price: price, condition: 'recon', engine_cc: cc, mileage,
  body_type: body, fuel_type: 'Petrol', transmission: tx, colour, is_model_card: false, stock_photos: false,
  status: 'available', state: 'Kuala Lumpur', city: 'Kuala Lumpur', images: [`/photos/${img}`],
});

export const LISTINGS = [
  car('8345a867-d88e-4e5f-953e-ac556d6ca03f', 'toyota-gr86-2025-8345', 2025, 'Toyota', 'GR86', '2.4L RZ', 175000, 2400, 8752, 'Coupe', 'Red', 'Manual', 'gr86-2025.jpg'),
  car('95d8034d-bb11-4ca7-bc52-537deda90339', 'honda-civic-2025-95d8', 2025, 'Honda', 'Civic', 'FL5 TYPE-R 2.0L HATCHBACK', 250000, 1498, 866, 'Hatchback', 'White', 'Auto', 'civic-fl5-2025.jpg'),
  car('0bb78749-53a0-4f66-a378-9e508dc5e828', 'toyota-yaris-2024-0bb7', 2024, 'Toyota', 'Yaris', 'GR RZ HIGH', 240000, 1496, 12000, 'Hatchback', 'White', 'Auto', 'gr-yaris-2024.png'),
  car('f0370c43-6804-4208-b165-27f6b4a48513', 'mazda-mx-5-2024-f037', 2024, 'Mazda', 'MX-5', 'ROADSTER (MX-5) S', 173000, 1998, 8500, 'Coupe', 'Red', 'Manual', 'mx5-2024.jpg'),
  car('4d7b9baa-07f2-4ed7-8419-2943b73b9c8b', 'mini-cooper-2022-4d7b', 2022, 'MINI', 'Cooper', 'WORKS 3-DOOR', 170000, null, 19000, 'Hatchback', 'Beige', 'Auto', 'mini-jcw-2022.jpg'),
  car('5676687b-0534-4953-bec3-08b8534d3354', 'land-rover-defender-2023-5676', 2023, 'Land Rover', 'Defender', '90', 270000, 2000, 10000, 'Pickup', 'Black', 'Auto', 'defender-90-2023.jpg'),
];

// A Proton advisor's line-up for the Live ad: the platform's own official Peninsular prices
// (new_car_models, read 2026-11-10). The photo is a placeholder until the owner supplies their own
// (stock model photos need the brand's permission).
const fresh = (id, model, variant, price, cc, body) => ({
  id, slug: `proton-${model.toLowerCase()}-demo`, year: 2026, brand: 'Proton', model, variant, selling_price: price, condition: 'new',
  engine_cc: cc, mileage: 0, body_type: body, fuel_type: 'Petrol', transmission: 'Auto', colour: '', is_model_card: false,
  stock_photos: false, status: 'available', state: 'Selangor', city: 'Shah Alam', images: ['/photos/placeholder.svg'],
});
export const PROTON = [
  fresh('11111111-0000-4000-8000-000000000001', 'Saga', '1.5 Executive', 44990, 1499, 'Sedan'),
  fresh('11111111-0000-4000-8000-000000000002', 'Persona', '1.6 Standard', 47800, 1597, 'Sedan'),
  fresh('11111111-0000-4000-8000-000000000003', 'S70', '1.5 Lite', 59800, 1499, 'Sedan'),
  fresh('11111111-0000-4000-8000-000000000004', 'X50', '1.5TD Executive', 89800, 1499, 'SUV'),
  fresh('11111111-0000-4000-8000-000000000005', 'X70', '1.5TD Executive', 106800, 1499, 'SUV'),
];

// No model cards here, so the new-car lookups find nothing.
export function infoFor() { return null; }
