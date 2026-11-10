import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import LivePresenter from '../../../../src/components/live/LivePresenter.jsx';
import { LISTINGS, PROTON } from './fixture.js';

const q = new URLSearchParams(location.search);
const lang = q.get('lang') === 'en' ? 'en' : 'ms';
try { localStorage.clear(); } catch { /* fresh every take */ }
// The brand label still reads XDrive in the app until switch night (BRAND-1); the ad says Drevo.
new MutationObserver(() => { document.querySelectorAll('.lp-brand').forEach((e) => { if (e.textContent !== 'Drevo') e.textContent = 'Drevo'; }); }).observe(document.body, { childList: true, subtree: true, characterData: true });
createRoot(document.getElementById('root')).render(
  // ?basic=1 = the free (Lite) presenter; ?new=1 = treat the cars as new (the Rebate line always shows);
  // ?set=proton = a new-car advisor's line-up at official prices (the Live ad).
  <LivePresenter listings={q.get('set') === 'proton' ? PROTON : q.get('new') ? LISTINGS.map((c) => ({ ...c, condition: 'new' })) : LISTINGS} slug="aida" sellerId="demo" sellerName="Aida" sellerPhone=""
    onClose={() => {}} officialNew initialLang={lang} basic={q.get('basic') === '1'} />
);
