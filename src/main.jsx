import './instrument';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18nReady } from './i18n/config';
// Side-effect import, and it must stay ABOVE the render: this registers the
// `beforeinstallprompt` listener at module scope. React mounts behind the
// i18nReady promise below, so a component-level listener can miss the event.
import './utils/installPrompt';
import App from '@/App';
import { logError } from '@/utils/logError';
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
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Failed to load module script') ||
    msg.includes('dynamically imported module') ||
    // Safari/WebKit's wording for the exact same stale-chunk failure (this is
    // what iOS Mail's in-app browser throws — it does NOT match any of the
    // Chrome/Firefox strings above, so it fell through to the OOPS screen
    // instead of self-healing). This is React.lazy() choking on an import()
    // that didn't resolve to a real module.
    msg.includes("Cannot read properties of undefined (reading 'default')")
  ) return true;
  // Backup layer: catch wording variants we haven't seen yet without needing a
  // new patch every time a browser phrases this differently. Still scoped to
  // the same failure family (a dynamic import/module chunk that didn't load
  // cleanly) — not a blanket catch-all for unrelated crashes.
  return /\b(chunk|module script|dynamically imported)\b/i.test(msg) ||
    /Unexpected token ['"<]/.test(msg) ||
    /Cannot read propert(y|ies) of undefined \(reading '(default|then)'\)/.test(msg);
}

// Benign clipboard rejections: the Clipboard API throws NotAllowedError when a
// copy fires while the document isn't focused (tab switch, mid-gesture) or the
// permission is denied. Nothing broke, nothing to fix — it's pure ops noise, so
// it must never reach error_logs (and never wake the ops Telegram alert).
function isBenignClipboardError(msg = '') {
  return (
    msg.includes("execute 'writeText' on 'Clipboard'") ||
    msg.includes('Document is not focused') ||
    (msg.includes('clipboard') && msg.includes('not allowed'))
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
    return;
  }
  if (isBenignClipboardError(event.reason?.message)) {
    event.preventDefault();
    return; // copy-while-unfocused — harmless, don't log
  }
  // Chunk reloads self-heal and are noise; everything else is a real ops signal.
  logError(event.reason, { code: 'unhandledrejection', context: 'window.unhandledrejection' });
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

// P1-4: the cache-busting hardReload() leaves ?_r=<timestamp> in the address
// bar, which pollutes analytics referrers and canonical URLs. Once the fresh
// document has loaded, strip it back out without a navigation.
(function stripCacheBustParam() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_r')) {
      url.searchParams.delete('_r');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch { /* ignore */ }
})();

// i18nReady resolves in a microtask for English visitors (en is bundled) and
// awaits one small chunk for Malay ones, so the first paint is already in the
// right language instead of flashing English. It never rejects — a failed
// locale fetch falls back to en — so the app always mounts.
i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <Sentry.ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error) => {
        // Lazy-route failures are caught here (not as unhandledrejection), so the
        // reload must be triggered from the boundary too.
        if (isChunkLoadError(error?.message)) { reloadOnceForChunk(); return; }
        logError(error, { code: 'react_error_boundary', context: 'Sentry.ErrorBoundary' });
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
});
