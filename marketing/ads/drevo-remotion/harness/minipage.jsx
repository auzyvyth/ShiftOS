// The Premium mini page /s/<slug> (the REAL SalesmanProfilePage) on a sample seller, for the mini page ad
// scene. Made-up seller "Aiman Hakim"; the car photos are the owner's own. Nothing here is verified, so the
// page shows no "Verified" badge.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import SalesmanProfilePage from '../../../../src/pages/SalesmanProfilePage.jsx';

const q = new URLSearchParams(location.search);
const photo = (f) => `${location.origin}/@fs/home/user/ShiftOS/marketing/ads/drevo-remotion/public/photos/${f}`;
const ID = 'p-aiman';
const car = (id, year, brand, model, variant, price, km, img, cond = 'recon', cc = 2000) => ({ id, slug: id, year, brand, model, variant,
  selling_price: price, images: [photo(img)], mileage: km, transmission: 'Automatic', colour: null, dealer_id: ID, docs_verified: false,
  condition: cond, state: 'Selangor', status: 'available', is_model_card: false, engine_cc: cc });
const CARS = [
  car('m1', 2025, 'Toyota', 'GR86', '2.4', 345000, 2000, 'gr86-2025.jpg', 'recon', 2400),
  car('m2', 2025, 'Honda', 'Civic', 'Type R FL5', 399800, 3000, 'civic-fl5-2025.jpg', 'used', 2000),
  car('m3', 2024, 'Mazda', 'MX-5', '2.0 RF', 268800, 8000, 'mx5-2024.jpg', 'recon', 2000),
  car('m4', 2024, 'Toyota', 'GR Yaris', '1.6', 329000, 5000, 'gr-yaris-2024.png', 'recon', 1600),
  car('m5', 2022, 'Mini', 'John Cooper Works', '2.0', 239000, 21000, 'mini-jcw-2022.jpg', 'used', 2000),
  car('m6', 2023, 'Land Rover', 'Defender', '90 P300', 689000, 12000, 'defender-90-2023.jpg', 'used', 2000),
];
const PROFILE = { id: ID, slug: 'aiman-cars', full_name: 'Aiman Hakim', dealership: 'Aiman Cars', role: 'salesman', seller_type: 'used',
  job_title: 'Sales advisor', bio: 'Recon and sports cars around the Klang Valley. I tell you the real monthly before you visit, and I answer the same day.',
  specializations: ['Sports cars', 'Recon', 'Loan help'], city: 'Petaling Jaya', state: 'Selangor', page_basic: false, has_whatsapp: true, has_phone: true,
  brand_color: '#dc2626', cover_url: photo('gr86-2025.jpg'), avatar_url: null, tiktok: 'aimancars', instagram: 'aimancars', is_verified: false, dealer_id: null };
globalThis.__STUB_TABLES = { public_car_listings: CARS, seller_public_stats: [{ sold_count: 14 }] };
globalThis.__STUB_RPC = {
  get_salesman_by_slug: [PROFILE], get_salesman_featured_listings: [], get_agent_pins: [], get_agent_car_order: [],
  get_agent_about: [{ years_selling: 6, languages: ['Malay', 'English'], areas_covered: 'Klang Valley', my_promise: 'The real monthly before you visit.' }],
  get_agent_nickname: 'aimancars', get_salesman_live: null, get_agent_recent_sales: [], get_agent_reply_time: null, get_salesman_by_id: [PROFILE],
};
i18n.changeLanguage(q.get('lng') === 'en' ? 'en' : 'ms').then(() => {
  createRoot(document.getElementById('root')).render(
    <MemoryRouter initialEntries={['/s/aiman-cars']}><Routes><Route path="/s/:slug" element={<SalesmanProfilePage />} /></Routes></MemoryRouter>
  );
  setTimeout(() => { window.MINI_READY = true; }, 2500);
});
