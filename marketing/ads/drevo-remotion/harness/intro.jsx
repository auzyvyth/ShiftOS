// The intro ad's extra screens (briefs/intro.md), all real app components on SAMPLE data:
//   ?view=contact  LivePresenter with the seller's sample contact (shown by the top-bar button in intro.cjs)
//   ?view=report   LivePresenter, then the real end-of-live report on sample analytics events
//   ?view=sources  ChannelBreakdown, the Premium Analytics "traffic by platform" card, sample counts
import React from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import LivePresenter from '../../../../src/components/live/LivePresenter.jsx';
import ChannelBreakdown from '../../../../src/components/ChannelBreakdown.jsx';
import { premiumDark as PD } from '../../../../src/theme/tokens.js';
import { LISTINGS } from './fixture.js';

const q = new URLSearchParams(location.search);
const lang = q.get('lang') === 'en' ? 'en' : 'ms';
const view = q.get('view') || 'contact';
try { localStorage.clear(); } catch { /* fresh every take */ }
await i18n.changeLanguage(lang);
new MutationObserver(() => { document.querySelectorAll('.lp-brand').forEach((e) => { if (e.textContent !== 'Drevo') e.textContent = 'Drevo'; }); }).observe(document.body, { childList: true, subtree: true, characterData: true });

// Sample events for the report: 23 people opened the page, 14 of them from TikTok,
// 9 car taps (5 on #1), 4 WhatsApp taps, 2 new leads. Sample data, labelled so in the ad.
const ev = [];
for (let i = 0; i < 23; i++) ev.push({ event_type: 'minipage_view', session_id: `s${i}`, car_id: null, metadata: { channel: i < 14 ? 'tiktok' : 'direct' } });
for (let i = 0; i < 9; i++) ev.push({ event_type: 'minipage_card_click', session_id: `s${i}`, car_id: LISTINGS[i < 5 ? 0 : i - 4].id, metadata: {} });
for (let i = 0; i < 4; i++) ev.push({ event_type: 'whatsapp_click', session_id: `s${i}`, car_id: LISTINGS[0].id, metadata: {} });
globalThis.__STUB_TABLES = { analytics_events: ev, leads: [{ id: 'l1' }, { id: 'l2' }] };

const SOURCES = [
  { channel: 'tiktok', views: 41, enquiries: 6 },
  { channel: 'facebook', views: 18, enquiries: 3 },
  { channel: 'whatsapp', views: 12, enquiries: 2 },
  { channel: 'share', views: 7, enquiries: 1 },
  { channel: 'direct', views: 5, enquiries: 0 },
];

const Sources = () => (
  <div id="card" style={{ margin: 16, background: PD.card, borderRadius: PD.radius.card, padding: '16px 18px', fontFamily: 'Outfit, system-ui, sans-serif' }}>
    <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: PD.textMuted, fontWeight: 600, marginBottom: 12 }}>
      {i18n.t('salesmanPremium.perf.trafficByPlatform')}
    </div>
    <ChannelBreakdown theme="premium" rows={SOURCES} metric="views" title=""
      viewsLabel={i18n.t('salesmanPremium.dash.visitsLower')} enquiriesLabel="WA" />
  </div>
);

createRoot(document.getElementById('root')).render(
  view === 'sources'
    ? <div style={{ background: PD.bg || '#0b0c0f', minHeight: '100vh' }}><Sources /></div>
    : <LivePresenter listings={LISTINGS} slug="aida" sellerId="demo" sellerName="Aida" sellerPhone="0100000001" onClose={() => {}} officialNew initialLang={lang} />
);
setTimeout(() => { window.INTRO_READY = true; }, 900);
