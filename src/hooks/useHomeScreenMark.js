import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { isStandalone } from '../utils/installPrompt';

/*
 * Mounted once in App.jsx (REACH-1). When a signed-in account is running the
 * app from the home screen, stamp that on the account (mark_home_screen_app),
 * so the platform console can say who has the app installed. The old
 * `pwa_installed` analytics event is anonymous and per device, so it could not
 * answer "has THIS seller added it?".
 *
 * At most once per account per day per device. Not consent-gated: it is a
 * fact about the account's own setup, read only by the platform admin, and
 * carries no page or behaviour data.
 */
const KEY = 'xd_home_screen_mark_';

function platformHint() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'other';
}

export function useHomeScreenMark() {
  useEffect(() => {
    if (!isStandalone()) return undefined;
    let cancelled = false;

    const mark = (user) => {
      if (cancelled || !user?.id || user.is_anonymous) return;
      const today = new Date().toISOString().slice(0, 10);
      try {
        if (localStorage.getItem(KEY + user.id) === today) return;
        localStorage.setItem(KEY + user.id, today);
      } catch { /* private mode: mark anyway, it is an upsert */ }
      supabase.rpc('mark_home_screen_app', { p_platform: platformHint() })
        .then(() => {}, () => {});
    };

    supabase.auth.getSession().then(({ data }) => mark(data?.session?.user));
    // Never return a promise from this callback (it holds the auth lock).
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') mark(session?.user);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);
}

export default useHomeScreenMark;
