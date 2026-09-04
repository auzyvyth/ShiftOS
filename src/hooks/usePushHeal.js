import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

/*
 * Mounted once, app-wide (src/App.jsx). Repairs this device's push subscription
 * on app open, silently.
 *
 * The problem it solves: the browser can throw a push subscription away on its
 * own, but it does NOT forget that the user granted notification permission. So
 * the app can just make a new subscription and re-register it — no prompt, no
 * tap, nothing the user ever sees. Before this, the only thing that re-created a
 * lost subscription was the user walking to Settings and pressing "Turn on",
 * which is why push looked like it "switched itself off every day".
 *
 * It lives at App level rather than in PushToggle on purpose: PushToggle only
 * mounts on a Settings tab, so a user who never opens Settings would never get
 * repaired — which is precisely the user who thinks push is broken.
 *
 * No-ops for logged-out visitors (the whole public marketplace) and for anyone
 * who has not granted permission — healPushSubscription() never prompts.
 *
 * It also UNREGISTERS the device on sign-out. That is here, on the auth event,
 * rather than at the ~19 places that call supabase.auth.signOut(): the event
 * fires whoever triggered it, including code added later. Without it a shared
 * or resold phone kept receiving the previous account's notifications forever —
 * push_subscriptions rows were never cleaned up by anything except a 410 from
 * the push service.
 */
export function usePushHeal() {
  // onAuthStateChange also fires on every token refresh. Heal is idempotent but
  // it is still a network write, so only run it once per user per page load.
  const healed = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const run = (userId) => {
      if (cancelled || !userId || healed.current === userId) return;
      // Cheap gate before the dynamic import: only a device that already said
      // yes can be repaired, so nobody else pays to download the push code.
      // App.jsx is eager, so a static import would put it in the marketplace
      // entry bundle for every public visitor.
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      healed.current = userId;
      import('./usePushNotifications')
        .then(({ healPushSubscription }) => healPushSubscription(userId))
        .catch(() => { /* never blocks the app */ });
    };

    supabase.auth.getSession().then(({ data }) => run(data?.session?.user?.id));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user?.id) {
        healed.current = null;
        // Only a real sign-out. onAuthStateChange also reports a null session
        // for INITIAL_SESSION on every logged-out marketplace page load, and
        // dropping a device row there would be nonsense.
        if (event === 'SIGNED_OUT') {
          import('./usePushNotifications')
            .then(({ forgetPushDevice }) => forgetPushDevice())
            .catch(() => { /* never blocks sign-out */ });
        }
        return;
      }
      run(session.user.id);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);
}

export default usePushHeal;
