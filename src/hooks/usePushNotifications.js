import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

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
 */

// Public half of the VAPID keypair. Public by design — it ships in the bundle.
// PERMANENT: every subscription is bound to the key it was created with, so
// changing this value silently kills every existing subscription. See CLAUDE.md.
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

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

export function usePushNotifications(userId) {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

  // Separate from `supported` on purpose: the browser can be perfectly capable
  // while the deploy is missing VITE_VAPID_PUBLIC_KEY. Those need different
  // messages — "your browser can't" vs "we haven't finished setting this up".
  const configured = VAPID_PUBLIC_KEY.length > 0;

  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'unsupported'));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reflect whatever this device already decided, so the toggle opens in the
  // right position instead of always reading "off".
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancelled) setSubscribed(Boolean(sub)); })
      .catch(() => { /* no registration yet — treat as not subscribed */ });
    return () => { cancelled = true; };
  }, [supported]);

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

      const json = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        subscription: json,
      }, { onConflict: 'user_id,endpoint' });

      if (error) {
        // Do not report success on a failed write — a subscription the server
        // never stored can never be pushed to.
        console.error('usePushNotifications enable:', error);
        return { ok: false, reason: 'save_failed' };
      }

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
      if (!data?.sent) return { ok: false, reason: 'no_devices' };
      return { ok: true, sent: data.sent };
    } catch (err) {
      console.error('usePushNotifications sendTest:', err);
      return { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
  }, [subscribed]);

  return { supported, configured, permission, subscribed, busy, enable, disable, sendTest };
}

export default usePushNotifications;
