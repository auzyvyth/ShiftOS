// The broker's "Dealer stock" tab (the REAL BrokerStock, Premium theme) on a sample dealer, for the
// broker ad scene. Commissions are example numbers (owner, 2026-11-25: keep them modest).
// "Sample Motors" and the buyer are made up (PDPA); the car photos are the owner's own.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import BrokerStock from '../../../../src/components/brokers/BrokerStock.jsx';
import { premiumDark as PD } from '../../../../src/theme/tokens.js';

const photo = (f) => `/@fs/home/user/ShiftOS/marketing/ads/drevo-remotion/public/photos/${f}`;
const q = new URLSearchParams(location.search);
const view = q.get('view') || 'cars';
const D = 'd-sample';
const car = (id, year, brand, model, variant, price, km, img, commission) =>
  ({ id, slug: id, year, brand, model, variant, selling_price: price, mileage: km, transmission: 'Auto', image: photo(img), commission, on_my_page: false });
const hold = new Date(Date.now() + 14 * 86400000).toISOString();
globalThis.__STUB_RPC = {
  broker_my_dealers: [{ dealer_id: D, name: 'Sample Motors', status: 'active', requested_by: 'dealer', commission_default: 300 }],
  broker_dealer_stock: [
    car('c1', 2023, 'Land Rover', 'Defender', '90 P300', 689000, 12000, 'defender-90-2023.jpg', 500),
    car('c2', 2025, 'Toyota', 'GR86', '2.4', 345000, 2000, 'gr86-2025.jpg', 400),
    car('c3', 2024, 'Mazda', 'MX-5', '2.0 RF', 268800, 8000, 'mx5-2024.jpg', 300),
    car('c4', 2022, 'Mini', 'John Cooper Works', '2.0', 239000, 21000, 'mini-jcw-2022.jpg', 300),
  ],
  broker_my_regs: view === 'buyers' ? [{ id: 'r1', buyer_name: 'Hafiz Rahman', buyer_phone: '60100000005', car_label: '2023 Land Rover Defender', dealer_name: 'Sample Motors',
    status: 'registered', hold_until: hold, commission_agreed: 500, source: 'manual' }] : [],
  broker_add_to_page: { ok: true },
  broker_register_buyer: { ok: true, until: hold },
};
i18n.changeLanguage(q.get('lng') === 'en' ? 'en' : 'ms').then(() => {
  createRoot(document.getElementById('root')).render(
    <MemoryRouter><div style={{ padding: '18px 16px', minHeight: '100vh', boxSizing: 'border-box', background: PD.canvas, fontFamily: 'var(--xd-font-body)' }}>
      <BrokerStock userId="u1" slug="aiman-cars" isPremium theme="premium" hasWhatsApp onUpgrade={() => {}} />
    </div></MemoryRouter>
  );
  setTimeout(() => { window.BROKER_READY = true; }, 700);
});
