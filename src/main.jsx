import './instrument';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './i18n/config';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

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

// One-shot guard: never reload more than once per short window, so a chunk that
// genuinely cannot load can't trap the page in an infinite reload loop.
function reloadOnceForChunk() {
  const KEY = 'chunk-reload-ts';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary
    fallback={<p>Something went wrong. Please refresh.</p>}
    onError={(error) => {
      // Lazy-route failures are caught here (not as unhandledrejection), so the
      // reload must be triggered from the boundary too.
      if (isChunkLoadError(error?.message)) reloadOnceForChunk();
    }}
  >
    <Suspense fallback={null}>
      <App />
      <Toaster />
    </Suspense>
  </Sentry.ErrorBoundary>
);
