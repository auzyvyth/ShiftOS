import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

// Query-string keys that carry a real person's identity. Redact the VALUE, keep
// the key, so a URL still reads as the query it was without carrying the buyer.
// Everything else (uuids, stage names, ordering) stays legible for debugging.
const PII_QUERY_KEYS = new Set([
  'phone', 'phone_norm', 'buyer_phone', 'whatsapp_number',
  'email', 'buyer_email', 'ic', 'ic_number', 'buyer_ic', 'ic_hash',
  'buyer_name', 'name', 'buyer_address',
]);

function scrubUrl(url) {
  if (typeof url !== 'string') return url;
  const q = url.indexOf('?');
  if (q === -1) return url;
  try {
    const params = new URLSearchParams(url.slice(q + 1));
    let touched = false;
    for (const key of [...params.keys()]) {
      if (PII_QUERY_KEYS.has(key.toLowerCase())) {
        params.set(key, '[redacted]');
        touched = true;
      }
    }
    return touched ? `${url.slice(0, q)}?${params.toString()}` : url;
  } catch {
    // A URL we cannot parse is one we cannot prove is clean.
    return url.slice(0, q) + '?[redacted]';
  }
}

const _dsn = import.meta.env.VITE_SENTRY_DSN;

// Session Replay's masking (maskAllText/maskAllInputs/blockAllMedia) walks
// and re-tags every mutated DOM node on every observed mutation — real,
// continuous CPU cost, not just a one-time setup fee. Lighthouse attributed
// 16.5s of bootup CPU and 1.1s of forced reflow to the replay script on the
// public marketplace, a page with no buyer PII to protect in the first
// place (anon can't read profiles; no lead/deal data ever renders there).
// So: only load Replay at all on the surfaces that actually carry PII
// (dealer dashboard, salesman panels, admin/platform console) — everywhere
// else (marketplace, car pages, storefronts) skips the script entirely
// rather than paying to mask nothing.
const REPLAY_PATH_PREFIXES = ['/dashboard', '/salesman', '/admin', '/platform', '/manager', '/accountant', '/fi'];
const wantsReplay = typeof window !== 'undefined'
  && REPLAY_PATH_PREFIXES.some((p) => window.location.pathname.startsWith(p));

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
      // the main thread during initial load (was causing ~35s TBT), and only
      // on PII-bearing routes at all (see wantsReplay above).
      // Explicitly mask all text/inputs and block media so Session Replay cannot
      // capture buyer PII rendered on the dealer dashboard.
      ...(wantsReplay ? [
        Sentry.lazyLoadIntegration('replayIntegration').then((integration) => {
          Sentry.addIntegration(integration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
          }));
        }).catch(() => {}),
      ] : []),
    ],
    // 10% trace sampling — 100% was adding instrumentation overhead to every fetch.
    tracesSampleRate: 0.1,
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/lemdkdizdlcirhbzqlos\.supabase\.co/,
      /^https:\/\/.*\.xdrive\.my/,
    ],
    replaysSessionSampleRate: wantsReplay ? 0.1 : 0,
    replaysOnErrorSampleRate: wantsReplay ? 1.0 : 0,
    enableLogs: true,
    // Scrub buyer PII out of request URLs before anything is sent.
    // PostgREST puts every filter in the query string, so a lookup like
    // .eq("phone", phone) becomes `/rest/v1/leads?phone=eq.60123456789` — the
    // buyer's real number, in a URL. Sentry records that as an http breadcrumb,
    // and breadcrumbs ride along with every error event that gets sent.
    // sendDefaultPii:false and the replay masking above do NOT cover this path.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb?.data?.url) {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      }
      return breadcrumb;
    },
    // Same URLs again, as span descriptions on performance transactions.
    beforeSendTransaction(event) {
      for (const span of event.spans || []) {
        if (span.description) span.description = scrubUrl(span.description);
        if (span.data?.['url']) span.data['url'] = scrubUrl(span.data['url']);
      }
      return event;
    },
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err?.name === 'AbortError' && err?.message?.includes('steal')) return null;
      if (err?.message?.includes("selectNode") && err?.message?.includes("has no parent")) return null;
      return event;
    },
  });
}
