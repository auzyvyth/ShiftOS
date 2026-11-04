import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import LivePresenter from '../../../../src/components/live/LivePresenter.jsx';
import { LISTINGS } from './fixture.js';

const q = new URLSearchParams(location.search);
const lang = q.get('lang') === 'en' ? 'en' : 'ms';
try { localStorage.clear(); } catch { /* fresh every take */ }
// The brand label still reads XDrive in the app until switch night (BRAND-1); the ad says Drevo.
new MutationObserver(() => { document.querySelectorAll('.lp-brand').forEach((e) => { if (e.textContent !== 'Drevo') e.textContent = 'Drevo'; }); }).observe(document.body, { childList: true, subtree: true, characterData: true });
createRoot(document.getElementById('root')).render(
  <LivePresenter listings={LISTINGS} slug="aida" sellerId="demo" sellerName="Aida" sellerPhone="" onClose={() => {}} officialNew initialLang={lang} />
);
