// Download the code for screens the user has not opened yet, so the first tap
// on them is instant (and works offline: the service worker keeps every
// /assets/*.js it sees, vite.config.js `page-code-v1`).
//
// Rules (owner, 2026-10-13):
// - Call it only AFTER the landing screen and its data are on screen.
// - ONE file at a time, each after the phone goes idle, so a tap the user makes
//   meanwhile never queues behind a background download.
// - Never on data-saver, a 2G-class connection, or offline.
//
// `loaders` are the same `() => import(...)` functions handed to React.lazy, so
// a warmed file is the exact module the tab later renders (import() caches it).

const HEAD_START_MS = 3000;

const whenIdle = () =>
  new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 3000 });
    } else {
      setTimeout(resolve, 1500); // Safari has no requestIdleCallback
    }
  });

function shouldSkip() {
  if (navigator.onLine === false) return true;
  const c = navigator.connection;
  return Boolean(c && (c.saveData || /2g/.test(c.effectiveType || '')));
}

// Returns a cancel function for useEffect cleanup.
export function warmChunks(loaders) {
  let cancelled = false;
  (async () => {
    // Head start for the screen's own data. A returning seller's panel paints
    // from the device cache on frame 1 (so `loading` is already false) while
    // the live queries are still in flight; those go first.
    if (document.readyState !== 'complete') {
      await new Promise((r) => window.addEventListener('load', r, { once: true }));
    }
    await new Promise((r) => setTimeout(r, HEAD_START_MS));
    for (const load of loaders) {
      await whenIdle();
      if (cancelled || shouldSkip()) return;
      // While this is set, main.jsx's vite:preloadError handler does not
      // reload: a background download failing (a deploy replaced the file)
      // must never reload the page under someone mid-typing. A real tab that
      // fails still recovers through the error boundary's own reload.
      window.__warmingChunks = true;
      try {
        await load();
      } catch {
        return; // network dropped or a deploy replaced the file: stop quietly
      } finally {
        window.__warmingChunks = false;
      }
    }
  })();
  return () => { cancelled = true; };
}
