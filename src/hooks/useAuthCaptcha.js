import { useEffect } from 'react';
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
// ONE WIDGET PER PAGE — everything below the hook is module state, on purpose.
// This used to be per-hook-instance, and CarDetailPage mounts <BuyerChat>
// THREE times (mobile CTA card, desktop sidebar, mobile sticky bar). They are
// hidden from each other with CSS media queries, and `display:none` does not
// unmount a React component — so every car page rendered THREE Turnstile
// widgets against the same sitekey within a few milliseconds of each other,
// plus three stacked full-screen overlays. Cloudflare reads a burst of widgets
// from one page the way you would expect it to: it stops solving them
// invisibly and starts asking the person to prove it. That is what turned the
// chat gate's Continue button into a ten-second wait — the click was not slow,
// it was standing in line behind an interactive challenge that only started
// because we asked for three at once. It also meant the token one instance had
// already parked was invisible to the other two, since each kept its own.
// Refcounted so the widget is built on the first consumer and torn down after
// the last one leaves.
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

// Grace period before the shared widget is destroyed once its last consumer
// unmounts. React StrictMode mounts, unmounts and remounts every effect in
// development, and a route change can swap one consumer for another in the
// same tick; without this, both would throw away a challenge that was already
// most of the way to a token.
const TEARDOWN_GRACE_MS = 1000;

export const CAPTCHA_ERROR_MESSAGE =
  "Couldn't verify you're human. Please refresh and try again — if you use an ad blocker, allow challenges.cloudflare.com.";

/**
 * The message to SHOW a person whose auth call was rejected for a captcha reason.
 *
 * Three of the four reasons are a CONFIGURATION mismatch that no amount of
 * refreshing or ad-blocker fiddling can fix, and the generic message sent the
 * owner hunting an ad blocker for an hour on a Vercel preview URL. Each one is
 * named instead, because the reader is the only person who can fix it:
 *   - no site key in this build  -> VITE_TURNSTILE_SITE_KEY is missing here
 *   - 110200                     -> this hostname is not on the widget's
 *                                   domain list (EVERY per-deploy preview URL)
 *   - 1101xx                     -> the site key itself is not valid
 * Anything else keeps the original advice, which is the one case where a
 * refresh or an allowlist entry genuinely is the answer.
 *
 * On xdrive.my none of the first three can happen — the domain is listed and
 * the key is set — so a real buyer only ever sees the generic message.
 */
export function captchaErrorMessage() {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'this address';
  if (!TURNSTILE_SITE_KEY) {
    return `Sign-in can't be verified on ${host} — this build has no Turnstile site key (VITE_TURNSTILE_SITE_KEY). Use xdrive.my.`;
  }
  if (lastErrorCode === '110200') {
    return `Sign-in is blocked on ${host} — this address isn't on the Turnstile domain list, so the check can't run (not an ad blocker). Use xdrive.my, or add this hostname to the widget in Cloudflare.`;
  }
  if (lastErrorCode && lastErrorCode.startsWith('1101')) {
    return `Sign-in is blocked on ${host} — the Turnstile site key this build was made with isn't valid. Use xdrive.my.`;
  }
  return CAPTCHA_ERROR_MESSAGE;
}

/** True when Supabase rejected the call for a captcha reason rather than a bad credential. */
export function isCaptchaError(error) {
  return /captcha/i.test(error?.message || '');
}

// ── the one shared widget ────────────────────────────────────────────────────
let host = null;
let slot = null;
let widgetId = null;
let consumers = 0;
let teardownTimer = null;
// The pre-solved token, waiting to be spent. Null while a challenge is in
// flight, or straight after one is consumed.
let parkedToken = null;
// Whoever is currently awaiting a token: { resolve, timer }.
let pending = null;
// True while an interactive challenge is on screen (between
// before-interactive-callback and the solve/error that ends it).
let revealed = false;
// True when the widget's last outcome was an error and no challenge is running,
// so it will not produce a token until it is reset.
let failed = false;
// The numeric code from the last 'error-callback', kept so the form can say
// WHICH failure this was instead of blaming an ad blocker for all of them.
// See captchaErrorMessage().
let lastErrorCode = null;
let prevOverflow = '';

// NOTE ON HIDING: we never hide a widget that has not finished.
// `appearance: 'interaction-only'` means CLOUDFLARE decides what to show — it
// renders nothing at all (a 0x0 slot) unless a real challenge is needed, and a
// container forced out of view while a challenge is live risks it being
// unsolvable, or refused outright as an anti-abuse signal. So the host sits
// there permanently, empty and click-through; `reveal` adds the dim backdrop
// behind whatever Cloudflare just put on screen, and `hide` clears it AND
// collapses the spent widget once the challenge is over.
function hide() {
  if (!host) return;
  host.style.background = 'transparent';
  document.body.style.overflow = prevOverflow;
  // ...and take the box off the screen. Cloudflare does NOT clear a widget
  // that has been interacted with: after the person ticks the checkbox it sits
  // there in its success (or error) state until the widget is reset, which for
  // a parked token is not until the NEXT auth call. So dropping only the
  // backdrop left a buyer who solved a chat challenge staring at a floating
  // captcha box, over a page they could no longer click. This is the one
  // moment hiding is safe — the challenge is already finished and its token is
  // in hand. reveal() puts the slot back before the next one is shown, so
  // nothing is ever hidden while it still needs solving.
  if (revealed && slot) slot.style.display = 'none';
  revealed = false;
}

// Cloudflare is asking the person to do something. Dim the page behind it and
// lock body scroll so the box cannot be scrolled away from (overlay rules — it
// already lives on document.body).
function reveal() {
  if (!host) return;
  prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  host.style.background = 'rgba(0,0,0,0.55)';
  // Fires before Cloudflare draws the challenge, so restoring the slot here
  // means a challenge is never shown into a hidden container.
  if (slot) slot.style.display = '';
  revealed = true;
  failed = false;
  // The person is now driving. Stop the clock — nobody gets timed out in the
  // middle of solving a puzzle.
  if (pending?.timer) {
    clearTimeout(pending.timer);
    pending.timer = null;
  }
}

// Start earning the next token. Background work — nobody awaits this.
function rearm() {
  if (widgetId === null || !window.turnstile) return;
  failed = false;
  try { window.turnstile.reset(widgetId); } catch { /* ignore */ }
}

// A challenge finished (or failed). Either hand the result to whoever is
// waiting, or park it for the next getToken().
function deliver(token) {
  hide();
  if (!pending) {
    parkedToken = token || null;
    return;
  }
  const p = pending;
  pending = null;
  if (p.timer) clearTimeout(p.timer);
  parkedToken = null;
  // Never reject: a captcha that fails must produce a call Supabase can answer
  // with a real error, not an unhandled promise in a submit handler.
  p.resolve(token || undefined);
  rearm();
}

function mountWidget() {
  host = document.createElement('div');
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
  slot = document.createElement('div');
  slot.style.pointerEvents = 'auto';
  document.body.appendChild(host);
  host.appendChild(slot);

  const mountedFor = slot;
  loadTurnstileScript()
    .then(() => {
      // Torn down while the script was loading, or another consumer already
      // built the widget.
      if (slot !== mountedFor || !window.turnstile || widgetId !== null) return;
      widgetId = window.turnstile.render(slot, {
        sitekey: TURNSTILE_SITE_KEY,
        // No `execution` option on purpose — the default solves at render
        // time, which is the whole point. See the timing note at the top.
        appearance: 'interaction-only',
        action: 'auth',
        'before-interactive-callback': () => reveal(),
        callback: (t) => { failed = false; lastErrorCode = null; deliver(t); },
        // A parked token goes stale after ~5 minutes. Drop it and earn a fresh
        // one, or someone who left the login page open sends an expired token
        // and gets told their password is wrong.
        'expired-callback': () => {
          parkedToken = null;
          // deliver() re-arms when someone is waiting; when nobody is, we still
          // want a fresh token ready for the next login. Never both, or the
          // second reset abandons the challenge the first just began.
          if (pending) deliver(undefined);
          else rearm();
        },
        // Cloudflare hands back a numeric code and we used to throw it away,
        // which made every failure look identical: the form says "couldn't
        // verify you're human, check your ad blocker" whatever actually
        // happened. The one that costs the most time is 110200 — THIS HOSTNAME
        // IS NOT ON THE WIDGET'S DOMAIN LIST, which is what every Vercel
        // preview URL hits while the widget only allows xdrive.my. An ad
        // blocker cannot cause that, and nothing in the app can fix it. Name it
        // in the console so the next person reads the cause instead of
        // guessing at it.
        'error-callback': (code) => {
          console.warn(`[turnstile] auth widget error ${code} on ${window.location.hostname}` +
            (String(code) === '110200' ? ' — this hostname is not on the Turnstile widget\'s domain list' : ''));
          lastErrorCode = String(code ?? '');
          parkedToken = null;
          // Nothing more is coming from this widget until it is reset, so a
          // later getToken() must not sit out the full timeout waiting for it.
          failed = true;
          deliver(undefined);
        },
      });
    })
    .catch(() => {
      // Script blocked or offline. Any in-flight ask resolves empty and
      // Supabase gives the real answer.
      failed = true;
      deliver(undefined);
    });
}

function unmountWidget() {
  parkedToken = null;
  if (pending) deliver(undefined);
  if (widgetId !== null && window.turnstile) {
    try { window.turnstile.remove(widgetId); } catch { /* ignore */ }
  }
  widgetId = null;
  revealed = false;
  failed = false;
  try { host?.remove(); } catch { /* ignore */ }
  host = null;
  slot = null;
}

/**
 * Take the single-use token for one auth call, and start earning the next.
 * Await it immediately before the call; never cache the result yourself.
 *
 * Normally resolves INSTANTLY — the token was solved when the page loaded. It
 * only waits if someone submits within the first moment of page load, or if a
 * challenge is genuinely on screen.
 *
 * @returns {Promise<string|undefined>} undefined when Turnstile is not
 *   configured or could not produce one — the call then goes to Supabase
 *   without a token and Supabase decides.
 */
function getToken() {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
  if (!window.turnstile || widgetId === null) return Promise.resolve(undefined);

  // The fast path, and the one almost every login takes.
  if (parkedToken) {
    const token = parkedToken;
    parkedToken = null;
    // Single use: spending this one immediately starts earning the next, so a
    // retry after a wrong password has a fresh token ready rather than
    // replaying a spent one.
    rearm();
    return Promise.resolve(token);
  }

  // The widget errored and is sitting idle. Waiting on it would burn the full
  // timeout for a token that is never coming, so hand back nothing now, let
  // Supabase answer, and reset in the background so the next attempt has a
  // real chance.
  if (failed) {
    rearm();
    return Promise.resolve(undefined);
  }

  // Nothing parked yet. Wait for the in-flight challenge rather than firing a
  // second one — reset() here would abandon the challenge already running and
  // start the clock over.
  if (pending) deliver(undefined);

  return new Promise((resolve) => {
    const timer = setTimeout(() => deliver(undefined), TOKEN_TIMEOUT_MS);
    pending = { resolve, timer };
  });
}

export default function useAuthCaptcha() {
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    if (teardownTimer) { clearTimeout(teardownTimer); teardownTimer = null; }
    consumers += 1;
    if (consumers === 1 && !host) mountWidget();
    return () => {
      consumers -= 1;
      if (consumers > 0) return;
      teardownTimer = setTimeout(() => {
        teardownTimer = null;
        if (consumers === 0) unmountWidget();
      }, TEARDOWN_GRACE_MS);
    };
  }, []);

  // Module-level and therefore stable for the life of the app, so callers can
  // keep it in a useCallback dependency list without re-creating anything.
  return { getToken };
}
