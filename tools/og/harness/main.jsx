import { STUB } from './fixture.js';
globalThis.__STUB = STUB;
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/i18n/config.js';
import '../../../src/index.css';
import OverviewTab from '../../../src/components/OverviewTab.jsx';
import { premiumLight as PL } from '../../../src/theme/tokens.js';
try { localStorage.clear(); } catch {}
document.body.style.background = PL.canvas;
createRoot(document.getElementById('root')).render(
  <div style={{ padding: 28, fontFamily: 'var(--xd-font-body)', background: PL.canvas, minHeight: '100vh' }}>
    <OverviewTab dealerId="dealer-demo" role="dealer" can={() => true} onNavigate={() => {}} />
  </div>
);
