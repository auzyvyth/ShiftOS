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

/*
 * SUBSCRIPTION ROTATION — the reason push kept "switching itself off".
 *
 * The browser can throw a push subscription away and mint a new one on its own
 * (FCM re-registration, storage eviction, a browser data change). When it does,
 * it fires `pushsubscriptionchange` here. Nothing was listening, so the old
 * endpoint stayed in the database, went dead, and the user had to walk to
 * Settings and tap "Turn on" again — which minted yet another endpoint. One
 * account had four rows for one phone in six days.
 *
 * The service worker has no Supabase session, so it cannot do an authenticated
 * write. Instead it calls the `push_swap_endpoint` RPC, which is keyed on the
 * OLD endpoint: knowing that string is the credential, and it derives the user
 * from the matched row rather than trusting anything the caller says.
 *
 * Config (VAPID key, project URL, anon key, last known endpoint) is written into
 * a cache by the app when push is enabled — see src/hooks/usePushNotifications.js.
 * A worker cannot read Vite env vars, and hardcoding the VAPID key in this static
 * file would guarantee it drifts from VITE_VAPID_PUBLIC_KEY.
 */

const PUSH_CFG_CACHE = 'shiftos-push-config';
const PUSH_CFG_URL = '/__shiftos-push-config';

function swUrlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = self.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function readPushConfig() {
  const cache = await caches.open(PUSH_CFG_CACHE);
  const res = await cache.match(PUSH_CFG_URL);
  return res ? res.json() : null;
}

async function writePushConfig(cfg) {
  const cache = await caches.open(PUSH_CFG_CACHE);
  await cache.put(PUSH_CFG_URL, new Response(JSON.stringify(cfg), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const cfg = await readPushConfig();
      if (!cfg || !cfg.vapidKey || !cfg.supabaseUrl || !cfg.anonKey) return;

      // `oldSubscription` is the spec's own answer to "which row do I move?".
      // It isn't always populated, so fall back to the endpoint the app stored
      // the last time it registered this device.
      const oldEndpoint = (event.oldSubscription && event.oldSubscription.endpoint) || cfg.endpoint;
      if (!oldEndpoint) return;

      // Prefer whatever the browser already made for us; only subscribe from
      // scratch if it handed us nothing — subscribing twice on one registration
      // throws.
      const sub = event.newSubscription
        || (await self.registration.pushManager.getSubscription())
        || (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: swUrlBase64ToUint8Array(cfg.vapidKey),
        }));
      if (!sub) return;

      const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/push_swap_endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
        },
        body: JSON.stringify({ p_old_endpoint: oldEndpoint, p_subscription: sub.toJSON() }),
      });
      if (!res.ok) return;

      // Remember the new endpoint so a SECOND rotation still has something to
      // swap from when `oldSubscription` is absent.
      await writePushConfig({ ...cfg, endpoint: sub.endpoint });
    } catch (err) {
      // A failed rotation must not throw out of the worker. The app repairs the
      // subscription on its next open anyway (usePushHeal) — this handler exists
      // to close the gap while the app is shut.
      console.error('pushsubscriptionchange:', err);
    }
  })());
});
