import './instrument';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './i18n/config';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

// Reload when a lazy chunk fails to fetch after a new deployment
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    event.preventDefault();
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh.</p>}>
    <Suspense fallback={null}>
      <App />
      <Toaster />
    </Suspense>
  </Sentry.ErrorBoundary>
);
