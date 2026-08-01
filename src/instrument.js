import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

const _dsn = import.meta.env.VITE_SENTRY_DSN;

// Sentry.init sets up fetch/history instrumentation + schedules the replay
// integration — all main-thread work that was previously running during the
// initial load window, inflating Total Blocking Time (the biggest lever on the
// mobile Lighthouse score). Defer it to browser idle so first paint / TTI land
// first; error capture still works, it just arms a beat after load. The
// Sentry.ErrorBoundary in main.jsx renders its fallback with or without init.
function initSentry() {
  Sentry.init({
    dsn: _dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
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
      Sentry.lazyLoadIntegration('replayIntegration').then((integration) => {
        Sentry.addIntegration(integration());
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

if (_dsn) {
  const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
  ric(() => initSentry(), { timeout: 3000 });
}
