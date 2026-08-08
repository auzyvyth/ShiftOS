import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

const _dsn = import.meta.env.VITE_SENTRY_DSN;

if (_dsn) {
  Sentry.init({
    dsn: _dsn,
    environment: import.meta.env.MODE,
    // Do not attach user IP / request PII to events. The dealer dashboard handles
    // buyer PII (phone, IC, loan amounts) and error attribution comes from our own
    // error_logs table, so Sentry does not need identifying data.
    sendDefaultPii: false,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      // Replay is loaded lazily after the page is idle so it doesn't block
      // the main thread during initial load (was causing ~35s TBT).
      // Explicitly mask all text/inputs and block media so Session Replay cannot
      // capture buyer PII rendered on the dealer dashboard.
      Sentry.lazyLoadIntegration('replayIntegration').then((integration) => {
        Sentry.addIntegration(integration({
          maskAllText: true,
          maskAllInputs: true,
          blockAllMedia: true,
        }));
      }).catch(() => {}),
    ],
    // 10% trace sampling — 100% was adding instrumentation overhead to every fetch.
    tracesSampleRate: 0.1,
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/lemdkdizdlcirhbzqlos\.supabase\.co/,
      /^https:\/\/.*\.xdrive\.my/,
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: true,
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err?.name === 'AbortError' && err?.message?.includes('steal')) return null;
      if (err?.message?.includes("selectNode") && err?.message?.includes("has no parent")) return null;
      return event;
    },
  });
}
