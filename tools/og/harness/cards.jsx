globalThis.__STUB = {};
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const qc = new QueryClient();
import '../../../src/i18n/config.js';
import '../../../src/index.css';
import ShowroomCard from '../../../src/components/ShowroomCard.jsx';
const base = location.origin + '/photos/';
const mk = (id, brand, model, variant, year, price, mileage, img, cond) => ({ id, slug: id, brand, model, variant, year, selling_price: price, mileage, images: [base + img], condition: cond, transmission: 'Automatic', fuel_type: 'Petrol', status: 'available', seller_role: 'dealer', dealer_is_verified: true, is_model_card: false });
const cars = [
  mk('c1', 'Honda', 'Civic', 'Type R FL5', 2025, 399800, 3000, 'civic-fl5-2025.jpg', 'used'),
  mk('c2', 'Mazda', 'MX-5', '2.0 RF', 2024, 268800, 8000, 'mx5-2024.jpg', 'recon'),
  mk('c3', 'Toyota', 'GR86', '2.4', 2025, 345000, 2000, 'gr86-2025.jpg', 'recon'),
];
document.body.style.background = '#fff';
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={qc}><MemoryRouter><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 280px)', gap: 18, padding: 24, fontFamily: 'var(--xd-font-body)', background: '#fff', width: 'max-content' }}>
    {cars.map((c) => <div key={c.id} id={c.id}><ShowroomCard car={c} priority /></div>)}
  </div></MemoryRouter></QueryClientProvider>
);
