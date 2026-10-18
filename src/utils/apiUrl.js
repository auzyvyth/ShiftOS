// MOBILE-6: a relative fetch('/api/...') resolves against the page's own
// origin. On the web that's xdrive.my, so it just works. Inside the native
// Capacitor app the page is served from capacitor://localhost (iOS) or
// https://localhost (Android) — the same relative path resolves there
// instead and 404s, since none of the Vercel /api routes are bundled into
// the app. Every /api/ caller must go through this helper rather than
// writing the path literally, or it silently breaks only on a phone.
import { SITE_URL } from '../config/site';

const API_ORIGIN = SITE_URL;

// The native app's own bridge defines window.Capacitor before the page loads,
// so this needs no import. Importing @capacitor/core here put ~23 KB into every
// web visitor's first download just to answer "no".
const isNativeApp = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export function apiUrl(path) {
  return isNativeApp() ? `${API_ORIGIN}${path}` : path;
}
