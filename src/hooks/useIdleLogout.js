import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { setLogoutNotice, pathNeedsSession } from '../utils/authNotice';

// Sign a logged-in user out after this much inactivity.
const IDLE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECK_MS = 60 * 1000;          // re-evaluate every minute
const WRITE_THROTTLE_MS = 15 * 1000; // don't hammer localStorage on every event
const KEY = 'shiftos_last_activity';

// Auto-logout after 24h of inactivity. The last-activity timestamp lives in
// localStorage so it's shared across tabs and survives reloads — the timer
// reflects real use of the app anywhere, not per-tab. No-op when logged out.
//
// Signing out NEVER navigates. See utils/authNotice.js for why: the redirect
// this used to do stole a public page out from under a returning user.
//
// Deliberately strict: on mount / tab focus / each interval we CHECK the stored
// timestamp, so returning to a tab that's been idle >24h (or reloading after a
// long gap) signs out rather than silently resetting the clock. Only genuine
// user interaction (pointer/key/scroll/touch) refreshes the timestamp.
export function useIdleLogout() {
  const lastWrite = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const now = () => Date.now();

    const readLast = () => {
      const v = Number(localStorage.getItem(KEY));
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const seed = () => {
      const t = now();
      lastWrite.current = t;
      try { localStorage.setItem(KEY, String(t)); } catch { /* private mode */ }
    };
    const markActive = () => {
      const t = now();
      if (t - lastWrite.current < WRITE_THROTTLE_MS) return;
      lastWrite.current = t;
      try { localStorage.setItem(KEY, String(t)); } catch { /* private mode */ }
    };

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return; // not logged in → nothing to enforce
      const last = readLast();
      if (last == null) { seed(); return; } // first run this login → start the clock
      if (now() - last > IDLE_MS) {
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        await supabase.auth.signOut({ scope: 'local' });
        // Park the reason for the login page, then STAY PUT. This used to be a
        // hard `window.location.href = '/login?timeout=1'` from whatever page
        // the user was on, so someone returning after a few days and tapping a
        // shared /compare link was thrown off that public page onto a login
        // screen that explained nothing — the link they clicked was lost. A
        // public page renders fine signed out; there is nothing to redirect.
        setLogoutNotice('idle', { idleSince: last });
        // The one exception: a page that cannot render without a session. Its
        // own guard already sends people to login on mount, so reloading is
        // enough — and it is necessary, because otherwise a tab left open past
        // the window keeps rendering a dead session's data while every write
        // silently fails.
        if (pathNeedsSession(window.location.pathname)) window.location.reload();
      }
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const iv = setInterval(check, CHECK_MS);
    check();

    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(iv);
    };
  }, []);
}
