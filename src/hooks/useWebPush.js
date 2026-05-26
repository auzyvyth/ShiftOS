import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function saveSubscription(userId, sub) {
  const subJson = sub.toJSON();
  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: subJson.endpoint, subscription: subJson },
    { onConflict: 'user_id,endpoint' },
  );
}

function keyBytesMatch(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a), vb = new Uint8Array(b);
  for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
  return true;
}

async function doSubscribe(userId) {
  if (!VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const existingKey = sub.options?.applicationServerKey;
      if (!existingKey || !keyBytesMatch(existingKey, currentKey.buffer)) {
        await sub.unsubscribe();
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: currentKey,
      });
    }
    await saveSubscription(userId, sub);
  } catch (err) {
    console.warn('Push subscribe error:', err);
  }
}

export function useWebPush(userId) {
  useEffect(() => {
    if (!userId) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      doSubscribe(userId);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') doSubscribe(userId);
      });
    }
  }, [userId]);
}

// Call this from event handlers (appointment created, lead won, etc.)
export async function sendPush({ userIds, title, body, url, tag }) {
  const validIds = (userIds || []).filter(Boolean);
  if (validIds.length === 0) return;
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_ids: validIds, title, body, url, tag },
    });
  } catch (err) {
    console.warn('sendPush error:', err);
  }
}
