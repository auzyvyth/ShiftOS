// The Sold tab's REAL components (Coming up, buyer cards, handover checklist) on made-up buyers,
// for the renewals ad. Never real customers: their names, phones and plates are personal data (PDPA).
// Run with the clock fixed at 2026-11-03 (harness/sold.cjs) so "in 7 days" stays true.
// ?lng=ms|en  &view=coming|renewals|checklist|trade
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import SoldCustomers, { ComingUp } from '../../../../src/pages/salesmanPremium/SoldCustomers.jsx';
import PostSaleChecklist from '../../../../src/components/postsale/PostSaleChecklist.jsx';
import { premiumDark as PD } from '../../../../src/theme/tokens.js';

const q = new URLSearchParams(location.search);
const lang = q.get('lng') === 'en' ? 'en' : 'ms';
const view = q.get('view') || 'coming';

// Sample buyers. Fake numbers (0100000001...) so no real person can be messaged.
export const BUYERS = [
  { id: 'c-aiman', lead_id: 'l-aiman', name: 'Aiman Hakim', phone: '0100000001', car_year: 2023, car_brand: 'Honda', car_model: 'City', car_plate: 'WXY 1234',
    purchase_date: '2025-11-10', road_tax_expiry: '2026-11-10', insurance_expiry: '2026-11-10', selling_price: 78000 },
  { id: 'c-siti', lead_id: 'l-siti', name: 'Siti Nurhaliza', phone: '0100000002', car_year: 2022, car_brand: 'Perodua', car_model: 'Myvi', car_plate: 'BQT 5678',
    purchase_date: '2024-11-28', road_tax_expiry: '2027-02-14', insurance_expiry: '2026-11-28', selling_price: 52000 },
  { id: 'c-farid', lead_id: 'l-farid', name: 'Farid Azman', phone: '0100000003', car_year: 2021, car_brand: 'Toyota', car_model: 'Vios', car_plate: 'VKE 4821',
    purchase_date: '2025-12-02', road_tax_expiry: '2026-12-02', insurance_expiry: '2027-03-01', selling_price: 69000 },
  { id: 'c-hafiz', lead_id: 'l-hafiz', name: 'Hafiz Rahman', phone: '0100000004', car_year: 2019, car_brand: 'Honda', car_model: 'Civic', car_plate: 'JTM 3390',
    purchase_date: '2023-05-20', road_tax_expiry: '2027-05-20', insurance_expiry: '2027-05-20', selling_price: 98000 },
];
const handover = { deals: [], statusForLead: () => ({ done: true, progress: 100 }), nextStepByLead: {} };

// Handover for Aiman's deal: insurance + road tax ticked (each writes its expiry date).
const STEPS = ['loan_settlement', 'insurance', 'puspakom_b5', 'puspakom_b7', 'jpj_transfer', 'road_tax', 'geran_collection', 'handover'];
const OWNER = { loan_settlement: 'dealer', insurance: 'customer', puspakom_b5: 'runner', puspakom_b7: 'runner', jpj_transfer: 'runner', road_tax: 'runner', geran_collection: 'runner', handover: 'salesman' };
const COST = { puspakom_b5: 30, puspakom_b7: 60, jpj_transfer: 100 };
const DONE = new Set((q.get('done') || 'loan_settlement,insurance,puspakom_b5,puspakom_b7,jpj_transfer').split(','));
const TASKS = STEPS.map((k, i) => ({
  id: `t-${k}`, lead_id: 'l-aiman', step_key: k, sort_order: i, owner_role: OWNER[k], cost: COST[k] ?? null,
  status: DONE.has(k) ? 'done' : 'pending', completed_at: DONE.has(k) ? '2026-11-03T10:00:00+08:00' : null,
  result_date: DONE.has(k) && (k === 'insurance' || k === 'road_tax') ? '2027-11-03' : null,
}));
globalThis.__STUB_TABLES = { post_sale_tasks: TASKS };

function App() {
  const [focus] = useState(view === 'renewals' ? { id: 'c-aiman', section: 'renewals' } : null);
  const list = view === 'trade' ? BUYERS.filter((b) => b.id === 'c-hafiz') : BUYERS;
  return (
    <div style={{ padding: 16, minHeight: '100vh', boxSizing: 'border-box', background: PD.canvas, fontFamily: 'var(--xd-font-body)' }}>
      {view === 'coming' && <ComingUp customers={BUYERS} handover={handover} packagesByCustomer={{}} onPick={() => {}} skipHandover />}
      {(view === 'renewals' || view === 'trade') && (
        <SoldCustomers customers={list} loading={false} handover={handover} packagesByCustomer={{}} pkgProps={{}}
          focus={focus} customerParam={null} repName="Aida" onOpenHandover={() => {}} />
      )}
      {view === 'checklist' && (
        <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: 14 }}>
          <PostSaleChecklist lead={{ id: 'l-aiman', dealer_id: 'demo', car_listing_id: null, loan_status: 'approved' }} theme="premium" initialTasks={TASKS} />
        </div>
      )}
    </div>
  );
}

i18n.changeLanguage(lang).then(() => {
  createRoot(document.getElementById('root')).render(<App />);
  setTimeout(() => { window.SOLD_READY = true; }, 600);
});
