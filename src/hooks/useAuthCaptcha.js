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
// The widget runs in `execution: 'execute'` + `appearance: 'interaction-only'`:
// nothing is shown to a normal person. Only if Cloudflare wants a real
// challenge does the box become visible, and `before-interactive-callback`
// is what reveals it.
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

  const settle = useCallback((token) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    hide();
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    // Never reject: a captcha that fails must produce a call Supabase can
    // answer with a real error, not an unhandled promise in a submit handler.
    p.resolve(token || undefined);
  }, [hide]);

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
          execution: 'execute',
          appearance: 'interaction-only',
          action: 'auth',
          'before-interactive-callback': () => reveal(),
          callback: (t) => settle(t),
          'expired-callback': () => settle(undefined),
          'error-callback': () => settle(undefined),
        });
      })
      .catch(() => {
        // Script blocked or offline. Any in-flight ask resolves empty and
        // Supabase gives the real answer.
        if (!cancelled) settle(undefined);
      });

    return () => {
      cancelled = true;
      if (pendingRef.current) settle(undefined);
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
      }
      widgetId.current = null;
      try { host.remove(); } catch { /* ignore */ }
      hostRef.current = null;
    };
  }, [reveal, settle]);

  /**
   * Get a FRESH single-use token for one auth call.
   * Always await it immediately before the call, never cache the result.
   * @returns {Promise<string|undefined>} undefined when Turnstile is not
   *   configured or could not produce one — the call then goes to Supabase
   *   without a token and Supabase decides.
   */
  const getToken = useCallback(() => {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
    if (!window.turnstile || widgetId.current === null) return Promise.resolve(undefined);

    // A second ask cancels the first rather than leaking it. Forms disable
    // their submit button, so this is belt and braces.
    if (pendingRef.current) settle(undefined);

    return new Promise((resolve) => {
      const timer = setTimeout(() => settle(undefined), TOKEN_TIMEOUT_MS);
      pendingRef.current = { resolve, timer };
      try {
        // reset() before execute() is what makes the token fresh. Without it a
        // retry after a wrong password replays a spent token and Supabase
        // rejects the login for the wrong reason.
        window.turnstile.reset(widgetId.current);
        window.turnstile.execute(widgetId.current);
      } catch {
        settle(undefined);
      }
    });
  }, [settle]);

  return { getToken };
}
