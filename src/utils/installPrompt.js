// Add-to-home-screen plumbing, split out from the UI for one reason: timing.
//
// Chromium fires `beforeinstallprompt` as soon as it decides the app is
// installable, which can land BEFORE the React tree mounts — main.jsx defers
// `createRoot().render()` behind `i18nReady`, so a Malay visitor (who awaits a
// locale chunk) or a repeat visitor with a warm service worker can easily have
// the event fire with nothing listening yet. A component-level useEffect would
// silently miss it and the install affordance would never appear.
//
// So the listener is registered at MODULE SCOPE and main.jsx imports this file
// eagerly. The event is stashed here; the component reads the stash on mount
// and subscribes for any later firing.

const SNOOZE_KEY = 'xdrive_install_snooze';
const SNOOZE_DAYS = 30;

// Counts a real install exactly once per device, ever. 'appinstalled' only
// fires on Chromium/Android; iOS has no install event at all (see
// isStandalone below), so the fallback in logPwaInstallIfStandalone catches
// it — and this flag is what stops the two paths from double-counting the
// same device.
const INSTALL_LOGGED_KEY = 'xdrive_pwa_install_logged';

let deferredEvent = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try { fn(deferredEvent); } catch { /* a bad subscriber must not break the rest */ }
  });
}

function logInstallOnce() {
  const ls = safeLocal();
  try {
    if (ls && ls.getItem(INSTALL_LOGGED_KEY)) return;
    ls && ls.setItem(INSTALL_LOGGED_KEY, '1');
  } catch { /* private mode / quota — best effort, may recount */ }
  // Lazy import: this module is loaded eagerly at app boot (see file header),
  // before the main supabase client and analytics helper are needed for
  // anything else, so pull them in only when there's actually an install to log.
  import('../supabaseClient').then(({ supabase }) => {
    import('./analytics').then(({ trackEvent }) => trackEvent(supabase, 'pwa_installed'));
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppress Chrome's own mini-infobar so the app controls where and when the
    // invitation appears. Skipping preventDefault() would show BOTH.
    e.preventDefault();
    deferredEvent = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    snoozeInstallPrompt(); // belt-and-braces; the standalone check is the real guard
    logInstallOnce();
    emit();
  });
}

// iOS has no 'appinstalled' event, so this is the only signal available for
// it: called on mount from InstallPrompt (scoped to authenticated app
// routes), it credits an install the first time this device is seen running
// standalone. Also the fallback for any Android case where 'appinstalled'
// didn't fire — logInstallOnce's flag makes calling this redundantly safe.
export function logPwaInstallIfStandalone() {
  if (isStandalone()) logInstallOnce();
}

export function getDeferredPrompt() {
  return deferredEvent;
}

export function subscribeInstallPrompt(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Shows the real Chromium install dialog. The deferred event is single-use —
// once prompt() has been called the browser invalidates it, so it is cleared
// here whatever the outcome. Returns the user's choice, or null if unavailable.
export async function showInstallDialog() {
  const evt = deferredEvent;
  if (!evt) return null;
  deferredEvent = null;
  emit();
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome; // 'accepted' | 'dismissed'
  } catch {
    return null;
  }
}

function safeLocal() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; }
  catch { return null; }
}

export function snoozeInstallPrompt() {
  const ls = safeLocal();
  try { ls && ls.setItem(SNOOZE_KEY, String(Date.now())); }
  catch { /* private mode / quota — non-fatal */ }
}

export function isInstallPromptSnoozed() {
  const ls = safeLocal();
  try {
    const ts = Number(ls && ls.getItem(SNOOZE_KEY));
    if (!ts) return false;
    return Date.now() - ts < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// Already installed — either launched from the home screen (display-mode) or
// iOS Safari's legacy navigator.standalone. Never invite an install here.
//
// Known iOS limitation: navigator.standalone is only true INSIDE the installed
// app. Browsing normally in Safari it reads false even for someone who already
// added the app, and iOS exposes no "is this installed?" API to do better. So
// an iOS user who has installed can still see the hint once; the 30-day snooze
// on dismissal is what keeps that from becoming a nag. Android has no such gap
// — Chromium simply stops firing beforeinstallprompt once installed.
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  } catch {
    return false;
  }
}

// In-app webviews (Facebook, Instagram, TikTok, Line, generic Android wv) cannot
// install anything. They are a real slice of this app's mobile traffic, and
// showing them instructions they physically cannot follow is pure noise.
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|; wv\)/i.test(navigator.userAgent || '');
}

// iOS has no beforeinstallprompt — add-to-home-screen is a manual Share-sheet
// action, and ONLY Safari can do it (Chrome/Firefox/Edge on iOS create a plain
// bookmark instead), so the hint is gated to real Safari.
export function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ reports itself as desktop Safari on MacIntel; touch points
    // are what separate it from a real Mac.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
}
