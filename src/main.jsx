import './instrument';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './i18n/config';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh.</p>}>
    <Suspense fallback={null}>
      <App />
      <Toaster />
    </Suspense>
  </Sentry.ErrorBoundary>
);
