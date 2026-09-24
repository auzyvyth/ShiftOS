// MOBILE-6: a relative fetch('/api/...') resolves against the page's own
// origin. On the web that's xdrive.my, so it just works. Inside the native
// Capacitor app the page is served from capacitor://localhost (iOS) or
// https://localhost (Android) — the same relative path resolves there
// instead and 404s, since none of the Vercel /api routes are bundled into
// the app. Every /api/ caller must go through this helper rather than
// writing the path literally, or it silently breaks only on a phone.
import { Capacitor } from '@capacitor/core';

const API_ORIGIN = 'https://xdrive.my';

export function apiUrl(path) {
  return Capacitor.isNativePlatform() ? `${API_ORIGIN}${path}` : path;
}
