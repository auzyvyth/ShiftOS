import { useCallback, useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY, loadTurnstileScript } from '../utils/turnstileScript';

// ── AUTH-6 / ACT-10: proof-of-human on every Supabase auth call ──────────────
//
// Plain version: Supabase can require a captcha token on sign-in, sign-up,
// password reset, magic link and anonymous sign-in. It is ONE project-wide
// switch in the Supabase dashboard — there is no per-page setting. The moment
// it is on, EVERY auth call that does not carry a token is rejected. So the
// code has to carry a token on all of them BEFORE the switch is flipped.
//
// Why a hook and not the <Turnstile> component we already have:
//  1. `signInAnonymously()` in useChat.js has no form to put a widget in, and
//     it goes through /auth/v1/signup — the exact endpoint the captcha guards.
//     Miss it and every guest buyer conversation dies silently.
//  2. A Turnstile token is SINGLE USE. On a login page "wrong password, try
//     again" is the normal path, so a token captured once into state is stale
//     by the second attempt. Here every call executes the widget fresh.
//  3. No layout work on five different forms, and no per-surface light/dark
//     theming for a box that is invisible almost always.
//
// TIMING — the thing this got wrong once, so do not "simplify" it back.
// The widget solves its challenge ON PAGE LOAD and parks the token. getToken()
// hands over the parked one and immediately re-arms in the background, so the
// person pressing Sign In waits for nothing. The first version passed
// `execution: 'execute'`, which defers the whole Cloudflare handshake until the
// button is pressed — every login and password reset took about ten seconds,
// on production. A captcha the user waits for is a captcha you have put in
// front of your own front door.
// `appearance: 'interaction-only'` still means nothing is SHOWN unless
// Cloudflare actually wants a challenge; that is what stays invisible, not the
// solving.
//
// INERT UNTIL CONFIGURED: with no VITE_TURNSTILE_SITE_KEY, getToken() resolves
// undefined immediately, and `options: { captchaToken: undefined }` is exactly
// what Supabase receives today. Shipping this changes nothing until the site
// key is set AND the dashboard toggle is on.

// Ceiling on waiting for Cloudflare, so a blocked script cannot hang a login
// form forever. Cleared the moment an interactive challenge appears — a person
// solving a puzzle must never be timed out from under.
const TOKEN_TIMEOUT_MS = 20000;

export const CAPTCHA_ERROR_MESSAGE =
  "Couldn't verify you're human. Please refresh and try again — if you use an ad blocker, allow challenges.cloudflare.com.";

/** True when Supabase rejected the call for a captcha reason rather than a bad credential. */
export function isCaptchaError(error) {
  return /captcha/i.test(error?.message || '');
}

export default function useAuthCaptcha() {
  const hostRef = useRef(null);
  const widgetId = useRef(null);
  const pendingRef = useRef(null);
  const prevOverflow = useRef('');
  // The pre-solved token, waiting to be spent. Null while a challenge is in
  // flight, or straight after one is consumed.
  const tokenRef = useRef(null);

  // NOTE ON HIDING: we deliberately do NOT hide the container ourselves.
  // `appearance: 'interaction-only'` means CLOUDFLARE decides what to show — it
  // renders nothing at all (a 0x0 slot) unless a real challenge is needed. A
  // container we had forced to visibility:hidden would risk the challenge being
  // unsolvable, or refused outright as an anti-abuse signal. So the host sits
  // there permanently, empty and click-through, and all `reveal` adds is the
  // dim backdrop behind whatever Cloudflare just put on screen.

  const hide = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.background = 'transparent';
    document.body.style.overflow = prevOverflow.current;
  }, []);

  // Cloudflare is asking the person to do something. Dim the page behind it and
  // lock body scroll so the box cannot be scrolled away from (overlay rules —
  // it already lives on document.body).
  const reveal = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    host.style.background = 'rgba(0,0,0,0.55)';
    // The person is now driving. Stop the clock — nobody gets timed out in the
    // middle of solving a puzzle.
    if (pendingRef.current?.timer) {
      clearTimeout(pendingRef.current.timer);
      pendingRef.current.timer = null;
    }
  }, []);

  // Start earning the next token. Background work — nobody awaits this.
  const rearm = useCallback(() => {
    if (widgetId.current === null || !window.turnstile) return;
    try { window.turnstile.reset(widgetId.current); } catch { /* ignore */ }
  }, []);

  // A challenge finished (or failed). Either hand the result to whoever is
  // waiting, or park it for the next getToken().
  const deliver = useCallback((token) => {
    hide();
    const p = pendingRef.current;
    if (!p) {
      tokenRef.current = token || null;
      return;
    }
    pendingRef.current = null;
    if (p.timer) clearTimeout(p.timer);
    tokenRef.current = null;
    // Never reject: a captcha that fails must produce a call Supabase can
    // answer with a real error, not an unhandled promise in a submit handler.
    p.resolve(token || undefined);
    rearm();
  }, [hide, rearm]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let cancelled = false;

    const host = document.createElement('div');
    host.setAttribute('data-auth-captcha', '');
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      // Click-through while empty, so a full-screen layer that is invisible
      // 99% of the time never swallows a click on the page underneath.
      pointerEvents: 'none',
    });
    const slot = document.createElement('div');
    slot.style.pointerEvents = 'auto';
    document.body.appendChild(host);
    host.appendChild(slot);
    hostRef.current = host;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        if (widgetId.current !== null) return; // guard StrictMode double-mount
        widgetId.current = window.turnstile.render(slot, {
          sitekey: TURNSTILE_SITE_KEY,
          // No `execution` option on purpose — the default solves at render
          // time, which is the whole point. See the timing note at the top.
          appearance: 'interaction-only',
          action: 'auth',
          'before-interactive-callback': () => reveal(),
          callback: (t) => deliver(t),
          // A parked token goes stale after ~5 minutes. Drop it and earn a
          // fresh one, or someone who left the login page open sends an
          // expired token and gets told their password is wrong.
          'expired-callback': () => {
            tokenRef.current = null;
            // deliver() re-arms when someone is waiting; when nobody is, we
            // still want a fresh token ready for the next login. Never both,
            // or the second reset abandons the challenge the first just began.
            if (pendingRef.current) deliver(undefined);
            else rearm();
          },
          'error-callback': () => { tokenRef.current = null; deliver(undefined); },
        });
      })
      .catch(() => {
        // Script blocked or offline. Any in-flight ask resolves empty and
        // Supabase gives the real answer.
        if (!cancelled) deliver(undefined);
      });

    return () => {
      cancelled = true;
      tokenRef.current = null;
      if (pendingRef.current) deliver(undefined);
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
      }
      widgetId.current = null;
      try { host.remove(); } catch { /* ignore */ }
      hostRef.current = null;
    };
  }, [reveal, deliver]);

  /**
   * Take the single-use token for one auth call, and start earning the next.
   * Await it immediately before the call; never cache the result yourself.
   *
   * Normally resolves INSTANTLY — the token was solved when the page loaded.
   * It only waits if someone submits within the first moment of page load, or
   * if a challenge is genuinely on screen.
   *
   * @returns {Promise<string|undefined>} undefined when Turnstile is not
   *   configured or could not produce one — the call then goes to Supabase
   *   without a token and Supabase decides.
   */
  const getToken = useCallback(() => {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
    if (!window.turnstile || widgetId.current === null) return Promise.resolve(undefined);

    // The fast path, and the one almost every login takes.
    const parked = tokenRef.current;
    if (parked) {
      tokenRef.current = null;
      // Single use: spending this one immediately starts earning the next, so
      // a retry after a wrong password has a fresh token ready rather than
      // replaying a spent one.
      rearm();
      return Promise.resolve(parked);
    }

    // Nothing parked yet. Wait for the in-flight challenge rather than firing
    // a second one — reset() here would abandon the challenge already running
    // and start the clock over.
    if (pendingRef.current) deliver(undefined);

    return new Promise((resolve) => {
      const timer = setTimeout(() => deliver(undefined), TOKEN_TIMEOUT_MS);
      pendingRef.current = { resolve, timer };
    });
  }, [deliver, rearm]);

  return { getToken };
}
