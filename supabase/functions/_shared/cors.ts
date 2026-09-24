// ONE origin allowlist for every browser-called edge function (MOBILE-4).
// There used to be five hand-rolled copies that disagreed: ai-proxy, chat-assist
// and send-telegram rejected dealer subdomains and staging, only send-push took
// Vercel previews, and none took the native app.
//
// Who calls us:
//   - the web app:        https://xdrive.my, https://www.xdrive.my, https://<sub>.xdrive.my
//   - staging previews:   https://shift-<hash>-shift-os.vercel.app (Vercel team "shift-os")
//   - the native app (Capacitor 8 defaults, checked against node_modules/@capacitor):
//       iOS     capacitor://localhost   (server.iosScheme default "capacitor")
//       Android https://localhost       (server.androidScheme default "https")
//     Change either scheme or server.hostname in capacitor.config.json and this
//     list must change with it, or every function call from the app is blocked.
//   - local dev:          http://localhost:3000, http://localhost:5173
//
// CORS is not auth. Every function still checks the caller's JWT; this only
// decides which web pages the browser lets read the response.

const EXACT = new Set([
  "https://xdrive.my",
  "https://www.xdrive.my",
  "capacitor://localhost",
  "https://localhost",
  "http://localhost:3000",
  "http://localhost:5173",
]);

const PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.xdrive\.my$/,
  /^https:\/\/shift-[a-z0-9-]+-shift-os\.vercel\.app$/,
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return EXACT.has(origin) || PATTERNS.some((re) => re.test(origin));
}

export function corsHeaders(origin: string | null, methods = "POST, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : "https://xdrive.my",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Max-Age": "86400",
    // The allowed origin varies per request, so any shared cache must key on it.
    "Vary": "Origin",
  };
}
