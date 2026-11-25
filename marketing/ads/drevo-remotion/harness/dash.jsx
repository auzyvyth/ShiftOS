// The Salesman Premium Dashboard tab (the REAL component) on a made-up seller, for the dashboard ad.
// Sample numbers and sample buyers only (PDPA): never a real seller's data without their OK.
// ?lng=ms|en   Run with the clock fixed (harness/dash.cjs).
import React from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import DashboardTab from '../../../../src/pages/salesmanPremium/DashboardTab.jsx';
import { premiumDark as PD } from '../../../../src/theme/tokens.js';

const q = new URLSearchParams(location.search);
const lang = q.get('lng') === 'en' ? 'en' : 'ms';
const photo = (f) => `/@fs/home/user/ShiftOS/marketing/ads/drevo-remotion/public/photos/${f}`; // the owner's own cars (premiummotors)
const car = (id, brand, model, variant, year, price, status = 'available', extra = {}) =>
  ({ id, brand, model, variant, year, selling_price: price, status, images: [], created_at: '2026-10-20T10:00:00+08:00', ...extra });
const CARS = [
  car('k1', 'Honda', 'Civic', 'Type R FL5', 2025, 399800, 'available', { images: [photo('civic-fl5-2025.jpg')] }),
  car('k2', 'Mazda', 'MX-5', '2.0 RF', 2024, 268800, 'available', { images: [photo('mx5-2024.jpg')] }),
  car('k3', 'Toyota', 'GR86', '2.4', 2025, 345000, 'available', { images: [photo('gr86-2025.jpg')] }),
  car('k4', 'Mini', 'John Cooper Works', '2.0', 2022, 239000, 'available', { images: [photo('mini-jcw-2022.jpg')] }),
  car('k5', 'Toyota', 'GR Yaris', '1.6', 2024, 329000, 'available', { images: [photo('gr-yaris-2024.png')] }),
  car('s1', 'Land Rover', 'Defender', '90', 2023, 689000, 'sold', { sold_at: '2026-11-08T10:00:00+08:00', commission_amount: 1200 }),
  car('s2', 'Honda', 'Civic', 'Type R', 2024, 379000, 'sold', { sold_at: '2026-11-19T10:00:00+08:00', commission_amount: 900 }),
];
// views / taps per car: 7-day series, oldest first, index 6 = today
const S = (views, taps, d, w) => ({ views, enquiries: taps, daily: d, waDaily: w });
const carStatsMap = {
  k1: S(812, 41, [52, 61, 48, 70, 88, 95, 104], [3, 4, 2, 5, 6, 7, 8]),
  k2: S(640, 33, [40, 38, 55, 49, 62, 71, 80], [2, 3, 3, 4, 4, 5, 6]),
  k3: S(911, 58, [61, 70, 66, 82, 90, 99, 112], [4, 5, 5, 7, 8, 9, 10]),
  k4: S(402, 17, [25, 31, 28, 30, 36, 41, 45], [1, 2, 1, 2, 3, 3, 3]),
  k5: S(523, 26, [33, 30, 41, 46, 50, 58, 61], [2, 2, 3, 3, 4, 4, 5]),
};
const minipageStats = { visits: 1284, daily: [31, 38, 35, 44, 52, 61, 70], byChannel: [{ channel: 'tiktok', visits: 520 }, { channel: 'share', visits: 210 }, { channel: 'whatsapp', visits: 96 }, { channel: 'direct', visits: 300 }] };
const lead = (id, name, stage, carId, extra = {}) => ({ id, buyer_name: name, stage, car_listing_id: carId, created_at: '2026-11-20T10:00:00+08:00',
  updated_at: '2026-11-24T10:00:00+08:00', last_contacted_at: '2026-11-24T10:00:00+08:00', car_listings: CARS.find((c) => c.id === carId), ...extra });
const LEADS = [
  lead('l1', 'Aiman Hakim', 'test_drive', 'k1', { follow_up_at: '2026-11-25T15:00:00+08:00' }), lead('l2', 'Siti Nurhaliza', 'negotiating', 'k3'),
  lead('l3', 'Farid Azman', 'contacted', 'k2'), lead('l4', 'Nadia Rahim', 'new', 'k5'), lead('l5', 'Hafiz Rahman', 'contacted', 'k4'),
  lead('l6', 'Aina Zulkifli', 'new', 'k3'), lead('l7', 'Daniel Lim', 'negotiating', 'k1'),
];
const APPTS = [{ id: 'a1', buyer_name: 'Aiman Hakim', status: 'confirmed', appointment_date: '2026-11-25T11:00:00+08:00', car_listings: CARS[0] },
  { id: 'a2', buyer_name: 'Siti Nurhaliza', status: 'confirmed', appointment_date: '2026-11-25T16:30:00+08:00', car_listings: CARS[2] }];
const noop = () => {};
i18n.changeLanguage(lang).then(() => {
  createRoot(document.getElementById('root')).render(
    <div id="dash" style={{ padding: 24, minHeight: '100vh', boxSizing: 'border-box', background: PD.canvas, fontFamily: 'var(--xd-font-body)' }}>
      <DashboardTab leads={LEADS} appointments={APPTS} myListings={CARS} carStatsMap={carStatsMap} enquiries={[]} staleLeads={[]} isReturning={false}
        goal={{ target: 5000 }} goalEditing={false} goalDraft="" showPrevMonth={false} customers={[]} dueNudges={[]}
        profile={{ id: 'p1', slug: 'aiman-cars', full_name: 'Aiman', dealership: 'Aiman Cars' }} servicePackages={[]}
        handoverActive={1} handoverNext="JPJ" minipageStats={minipageStats} isMobile={false}
        setActiveTab={noop} setActiveLeadStage={noop} setGoalDraft={noop} setGoalEditing={noop} setShowPrevMonth={noop}
        setShowAddForm={noop} setInboxSubTab={noop} saveGoal={noop} triggerGlow={noop} switchTab={noop} handleThisWeekContacted={noop}
        onVisitMinipage={noop} starterHidden starterTasksReady={false} onStarterDismiss={noop} silentPick={null} onShareTour={noop} />
    </div>
  );
  setTimeout(() => { window.DASH_READY = true; }, 600);
});
