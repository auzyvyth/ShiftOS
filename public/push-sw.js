/*
 * Push notification handlers for the ShiftOS service worker.
 *
 * WHY THIS IS A SEPARATE FILE: vite-plugin-pwa runs in `generateSW` mode, which
 * writes sw.js from scratch on every build — there is nowhere in that generated
 * file to put custom code. Switching to `injectManifest` to get a hand-written
 * SW would mean re-doing the precache/globIgnores config in vite.config.js, and
 * the comments there document two separate production outages caused by exactly
 * that config. So this file is pulled in via workbox `importScripts` instead:
 * zero changes to the caching behaviour, custom handlers still run.
 *
 * Without these handlers a delivered push does NOT show your notification —
 * Chrome substitutes a generic "This site has been updated in the background"
 * message, which is why push looked broken even where it was being delivered.
 *
 * Note: the browser only re-fetches an imported script when the importing SW
 * itself changes. sw.js gets new precache revisions on every build, so a deploy
 * always picks this up — but editing ONLY this file with no other change may not
 * reach already-installed clients until the next real build.
 */

self.addEventListener('push', (event) => {
  // A push with no payload, or a malformed one, must still show something —
  // the browser penalises a push event that resolves without a notification.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ShiftOS';
  const options = {
    body: payload.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    // `tag` collapses repeats: a second push with the same tag replaces the
    // first rather than stacking. Senders use ids like `appt-<uuid>`.
    tag: payload.tag || 'shiftos',
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  // Prefer focusing a tab that is already open over opening a duplicate one.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
