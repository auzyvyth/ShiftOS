import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './i18n/config';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

Sentry.init({
  dsn: 'https://81c2ffa7260df60f9182b44e58dea4c5@o4511450095812608.ingest.us.sentry.io/4511450098171904',
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/lemdkdizdlcirhbzqlos\.supabase\.co/,
    /^https:\/\/.*\.xdrive\.my/,
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <Suspense fallback={null}>
        <App />
        <Toaster />
    </Suspense>
);
