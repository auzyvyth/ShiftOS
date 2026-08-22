import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient';

/*
 * Web push subscribe/unsubscribe for any logged-in account (dealer, salesman
 * lite/premium, linked salesman, manager, admin — it only needs a user id).
 *
 * Plain version: this is what asks the browser for notification permission and
 * registers the device with Google/Apple's push service, then stores the result
 * in `push_subscriptions` so the server can push to it later. It is NOT the same
 * as the in-tab `new Notification()` code in SalesmanLite.jsx:849 — that only
 * works while the tab is open. This one works with the app closed.
 *
 * The sending half already existed: `supabase/functions/send-push/index.ts`.
 *
 * TWO PIECES OF STATE, NOT ONE. A device is really subscribed only when BOTH
 * are true: the browser holds a subscription, AND `push_subscriptions` has a row
 * for that exact endpoint. They fall out of sync in both directions, and each
 * direction was its own bug:
 *   - browser drops its subscription (rotation, eviction) -> the stored row goes
 *     dead and the toggle reads OFF, so the user re-enables by hand every day and
 *     leaves a trail of orphan rows. Fixed by healPushSubscription() below plus
 *     the `pushsubscriptionchange` handler in public/push-sw.js.
 *   - the row is deleted server-side (send-push prunes on a 410) while the
 *     browser subscription lives on -> the toggle showed a green "On" badge for a
 *     device the server could no longer reach, with no way out but off-then-on.
 * So `subscribed` is now checked against the database, never the browser alone.
 */

// Public half of the VAPID keypair. Public by design — it ships in the bundle.
// PERMANENT: every subscription is bound to the key it was created with, so
// changing this value silently kills every existing subscription. See CLAUDE.md.
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

// Mirrors of the two constants in public/push-sw.js. The worker cannot read Vite
// env vars or import app modules, so the app leaves it what it needs here.
const PUSH_CFG_CACHE = 'shiftos-push-config';
const PUSH_CFG_URL = '/__shiftos-push-config';

// The browser wants the key as raw bytes, not the base64url string we store.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// iOS refuses web push in a normal Safari tab — the PWA must be installed to the
// home screen first (16.4+). Worth detecting so the UI can say that instead of
// showing a toggle that can never succeed.
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// Hand the service worker what it needs to re-register this device on its own
// after the browser rotates the subscription. Best-effort: if the Cache API is
// unavailable the app still works, it just loses the while-closed repair.
async function writeSwConfig(endpoint) {
  try {
    const cache = await caches.open(PUSH_CFG_CACHE);
    await cache.put(PUSH_CFG_URL, new Response(JSON.stringify({
      vapidKey: VAPID_PUBLIC_KEY,
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      endpoint,
    }), { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* cache unavailable — non-fatal */ }
}

async function clearSwConfig() {
  try {
    const cache = await caches.open(PUSH_CFG_CACHE);
    await cache.delete(PUSH_CFG_URL);
  } catch { /* nothing to clear */ }
}

// Store the device against the account. Returns true only when the row is
// actually written — a subscription the server never stored can never be pushed
// to, so reporting success on a failed write would be a lie the user pays for.
async function saveSubscription(userId, sub) {
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
  }, { onConflict: 'user_id,endpoint' });

  if (error) {
    console.error('usePushNotifications save:', error);
    return false;
  }
  await writeSwConfig(sub.endpoint);
  return true;
}

/*
 * Silent repair, run on every app open for any logged-in user — see
 * src/hooks/usePushHeal.js.
 *
 * NEVER prompts. It only acts when this device already granted permission, and
 * Chrome remembers that grant even after it has thrown the subscription itself
 * away. That is the whole trick: re-subscribing needs no tap from the user, so
 * the "turn it on again every morning" chore disappears.
 */
export async function healPushSubscription(userId) {
  if (!pushSupported() || !VAPID_PUBLIC_KEY || !userId) return { status: 'skipped' };
  if (Notification.permission !== 'granted') return { status: 'not_granted' };
  if (isIOS() && !isStandalone()) return { status: 'ios_needs_install' };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
    const saved = await saveSubscription(userId, sub);
    return saved ? { status: 'ok', endpoint: sub.endpoint } : { status: 'save_failed' };
  } catch (err) {
    console.error('healPushSubscription:', err);
    return { status: 'error' };
  }
}

export function usePushNotifications(userId) {
  const supported = pushSupported();

  // Separate from `supported` on purpose: the browser can be perfectly capable
  // while the deploy is missing VITE_VAPID_PUBLIC_KEY. Those need different
  // messages — "your browser can't" vs "we haven't finished setting this up".
  const configured = VAPID_PUBLIC_KEY.length > 0;

  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'unsupported'));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reflect what is ACTUALLY true — browser subscription and stored row must
  // agree — so the toggle opens in the right position and never claims to be on
  // for a device the server cannot reach.
  const sync = useCallback(async () => {
    if (!supported) return false;
    try {
      setPermission(Notification.permission);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub || !userId) { setSubscribed(false); return false; }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint)
        .maybeSingle();

      const ok = Boolean(data) && !error;
      setSubscribed(ok);
      return ok;
    } catch {
      setSubscribed(false);
      return false;
    }
  }, [supported, userId]);

  useEffect(() => {
    let cancelled = false;
    // Repair before reading. The app-wide heal may not have run yet (or may have
    // raced this mount), and a Settings page that shows OFF for a device it could
    // have fixed itself is the bug this whole file is about.
    healPushSubscription(userId).then(() => { if (!cancelled) sync(); });
    return () => { cancelled = true; };
  }, [userId, sync]);

  const enable = useCallback(async () => {
    if (!supported) return { ok: false, reason: 'unsupported' };
    if (!configured) return { ok: false, reason: 'not_configured' };
    if (!userId) return { ok: false, reason: 'no_user' };
    if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios_needs_install' };

    setBusy(true);
    try {
      // Must run inside the click that called this — browsers reject a
      // permission prompt that isn't tied to a user gesture.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return { ok: false, reason: result === 'denied' ? 'denied' : 'dismissed' };

      const reg = await navigator.serviceWorker.ready;
      // Reuse an existing subscription if the browser already has one for this
      // key; subscribing twice on one registration throws.
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

      if (!(await saveSubscription(userId, sub))) return { ok: false, reason: 'save_failed' };

      setSubscribed(true);
      return { ok: true };
    } catch (err) {
      console.error('usePushNotifications enable:', err);
      return { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
  }, [supported, configured, userId]);

  const disable = useCallback(async () => {
    if (!supported || !userId) return { ok: false, reason: 'unsupported' };
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete()
          .eq('user_id', userId).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      // Otherwise the service worker's rotation handler would helpfully
      // re-register the device the user just switched off.
      await clearSwConfig();
      setSubscribed(false);
      return { ok: true };
    } catch (err) {
      console.error('usePushNotifications disable:', err);
      return { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
  }, [supported, userId]);

  // Round-trips a real push through the push service, so it proves delivery end
  // to end rather than just that the row saved. send-push forces a logged-in
  // caller to target only themselves, so this cannot notify anyone else.
  const sendTest = useCallback(async () => {
    if (!subscribed) return { ok: false, reason: 'not_subscribed' };
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          title: 'ShiftOS notifications are on',
          body: 'This is a test. Real alerts will arrive here even with the app closed.',
          url: '/',
          tag: 'push-test',
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error || data?.error) {
        console.error('usePushNotifications sendTest:', error || data.error);
        return { ok: false, reason: 'send_failed' };
      }
      if (!data?.sent) {
        // send-push prunes the row on a 410, so a device that has just gone
        // stale reports zero here. Re-read state so the toggle stops claiming
        // to be on instead of leaving the user to guess.
        await sync();
        return { ok: false, reason: 'no_devices' };
      }
      return { ok: true, sent: data.sent };
    } catch (err) {
      console.error('usePushNotifications sendTest:', err);
      return { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
  }, [subscribed, sync]);

  return { supported, configured, permission, subscribed, busy, enable, disable, sendTest };
}

export default usePushNotifications;
