import './instrument';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n/config';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// After a new deployment, an old tab may reference lazy chunk hashes that no
// longer exist on the server (the request then returns index.html → a "Failed
// to load module script" / MIME error). Auto-reload once so the client picks up
// the fresh build instead of white-screening.
function isChunkLoadError(msg = '') {
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Failed to load module script') ||
    msg.includes('dynamically imported module')
  );
}

// Cache-busting reload. A plain location.reload() is not enough in aggressively
// caching in-app webviews (Facebook/Instagram): they re-serve the stale
// index.html from cache, which still references the missing chunk hash, so the
// page crashes again. Appending a changing query param forces the webview to
// bypass its HTTP cache for the document request.
function hardReload() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

// One-shot guard: never reload more than once per short window, so a chunk that
// genuinely cannot load can't trap the page in an infinite reload loop.
function reloadOnceForChunk() {
  const KEY = 'chunk-reload-ts';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  hardReload();
}

// Branded fallback with a working recovery action. The previous bare-text
// fallback was a dead end when the auto-reload guard had already fired (the
// user just saw "Something went wrong" with no way forward). The button does a
// cache-busting reload that ignores the 10s guard.
function ErrorFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '24px 20px', background: '#080C14', color: '#fff', fontFamily: "system-ui, sans-serif", textAlign: 'center' }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: '#dc2626', letterSpacing: 2, lineHeight: 1, margin: 0 }}>OOPS</p>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 320, margin: 0 }}>
        The page failed to load. This usually fixes itself with a reload.
      </p>
      <button
        onClick={hardReload}
        style={{ marginTop: 8, padding: '12px 28px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        Reload
      </button>
    </div>
  );
}

// Vite's own signal when a dynamically imported module fails to preload.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnceForChunk();
});

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason?.message)) {
    event.preventDefault();
    reloadOnceForChunk();
  }
});

// skipWaiting + clientsClaim activate a new service worker the instant a
// deploy lands, but an already-open tab keeps running its old JS until
// something reloads it — that's the "blank after deploy, needs several
// manual refreshes" report. Two things were wrong with the previous
// approach: (1) registerType 'autoUpdate' made the plugin ALSO fire its own
// internal plain window.location.reload() on activation, racing our
// cache-busting hardReload() — whichever won, a plain reload in an
// aggressively caching mobile webview can be served the same stale document
// back from HTTP cache, silently no-opping; (2) the browser only re-checks
// the SW script for changes on a fresh top-level navigation or ~24h — an
// already-open tab (or a PWA re-opened from the home screen) can sit on a
// stale worker indefinitely with no update check at all.
//
// Fix: registerType is now 'prompt' (vite.config.js) so the plugin never
// reloads on its own; we drive the ONE reload ourselves via the raw
// controllerchange event (fires the instant the new worker actually takes
// over fetches — the earliest point a reload is guaranteed fresh) and always
// cache-bust with hardReload(). We also actively poll for updates so a
// backgrounded/reopened tab checks within seconds instead of waiting on the
// browser's own lazy check.
if ('serviceWorker' in navigator) {
  // Snapshot BEFORE registration: a controller already present means this is
  // a returning tab picking up a real update. No controller yet means this is
  // this tab's first-ever load, and the SW claiming it for the first time is
  // not an "update" worth reloading for.
  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadControllerAtBoot) reloadOnceForChunk();
  });

  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const poll = () => registration.update().catch(() => {});
        setInterval(poll, 60_000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') poll();
        });
        window.addEventListener('focus', poll);
      },
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary
    fallback={<ErrorFallback />}
    onError={(error) => {
      // Lazy-route failures are caught here (not as unhandledrejection), so the
      // reload must be triggered from the boundary too.
      if (isChunkLoadError(error?.message)) reloadOnceForChunk();
    }}
  >
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <App />
        <Toaster />
      </Suspense>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);
