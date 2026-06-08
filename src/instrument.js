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
    sendDefaultPii: true,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
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
    beforeSend(event, hint) {
      const err = hint?.originalException;
      // Supabase gotrue-js uses Web Locks with steal:true for cross-tab auth
      // coordination. The old tab gets AbortError — expected, not a real error.
      if (err?.name === 'AbortError' && err?.message?.includes('steal')) return null;
      // Browser extensions (translate, grammar/spell checkers) mutate the DOM
      // after React re-renders and call Range.selectNode on detached nodes.
      // Not reproducible from our code — no createRange/selectNode anywhere in src.
      if (err?.message?.includes("selectNode") && err?.message?.includes("has no parent")) return null;
      // Stale code-split chunk after a fresh deploy — old tabs reference hashed
      // filenames the CDN no longer serves. main.jsx already auto-reloads on
      // this exact error; Sentry's own rejection handler just reports it first.
      const msg = err?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) return null;
      return event;
    },
  });
}
