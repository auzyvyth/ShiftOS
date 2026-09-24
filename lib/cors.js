/* eslint-env node */
// MOBILE-6: these /api/* routes used to be called only from the same origin
// (a relative fetch from xdrive.my), so no CORS headers were ever needed. The
// native app now calls them with an ABSOLUTE url (see src/utils/apiUrl.js)
// from capacitor://localhost / https://localhost, which IS cross-origin —
// without this, the browser drops the response (and, for a JSON POST, the
// preflight OPTIONS request never gets an answer at all).
//
// Same allowlist as supabase/functions/_shared/cors.ts, kept as a second file
// because that one runs on Deno/edge and this runs on Vercel/Node. If a
// caller (a new xdrive.my subdomain, a new Vercel preview pattern, a changed
// capacitor.config.json scheme) is added to one, add it to the other too.

const EXACT = new Set([
  'https://xdrive.my',
  'https://www.xdrive.my',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
]);

const PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.xdrive\.my$/,
  /^https:\/\/shift-[a-z0-9-]+-shift-os\.vercel\.app$/,
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return EXACT.has(origin) || PATTERNS.some((re) => re.test(origin));
}

// Sets CORS headers and answers the preflight. Returns true when the caller
// should stop (an OPTIONS request was already answered).
export function applyCors(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers.origin || null;
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin(origin) ? origin : 'https://xdrive.my');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
