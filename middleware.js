/* eslint-env browser */
// Vercel Edge Middleware — rate-limits public form submissions and dealer AI calls.
// Fails open if Upstash credentials are not configured so the site continues to
// work during local dev and before env vars are added.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const PROTECTED = new Set([
  '/api/enquiry',
  '/api/whatsapp-lead',
  '/api/booking',
  '/api/call-number',
  '/api/waitlist',
  '/api/ai-messages',
  '/api/car-specs',
  '/api/auth-account-status',
]);

// Per-IP sliding-window limits
const LIMITS = {
  '/api/enquiry':      { window: '60 s',  max: 5,  prefix: 'rl:enquiry' },
  '/api/whatsapp-lead':{ window: '60 s',  max: 8,  prefix: 'rl:walead' },
  '/api/booking':      { window: '60 s',  max: 3,  prefix: 'rl:booking' },
  // Low enough that bulk harvesting a number per listing is impractical, high
  // enough that a real buyer comparing a few cars never hits it.
  '/api/call-number':  { window: '60 s',  max: 6,  prefix: 'rl:callnum' },
  '/api/waitlist':     { window: '300 s', max: 3,  prefix: 'rl:waitlist' },
  '/api/ai-messages':  { window: '60 s',  max: 20, prefix: 'rl:ai' },
  '/api/car-specs':    { window: '60 s',  max: 30, prefix: 'rl:carspecs' },
  // SEC-B5: Turnstile is the real gate; this is belt-and-braces for the
  // window where TURNSTILE_SECRET is unset and verifyTurnstile fails open.
  // A real login retries a handful of times a minute at most.
  '/api/auth-account-status': { window: '60 s', max: 10, prefix: 'rl:acctstatus' },
};

let limiters = null;

function buildLimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  const result = {};
  for (const [path, cfg] of Object.entries(LIMITS)) {
    result[path] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.max, cfg.window),
      prefix: cfg.prefix,
    });
  }
  return result;
}

export default async function middleware(req) {
  const { pathname } = new URL(req.url);

  if (!PROTECTED.has(pathname)) return;

  // MOBILE-6: the native app calls these cross-origin, so a real POST is now
  // preceded by a CORS preflight OPTIONS. It carries no body and the route
  // handler answers it before doing any work — don't spend rate-limit budget
  // on it too, or every native request costs two hits against the same IP cap.
  if (req.method === 'OPTIONS') return;

  if (!limiters) limiters = buildLimiters();
  if (!limiters) return; // Upstash not configured — pass through

  // Rate-limit key = the client IP. Prefer x-real-ip, which Vercel's edge sets to
  // the true connecting IP; the FIRST token of x-forwarded-for is client-supplied,
  // so keying on it alone let an attacker rotate a spoofed value to slip the
  // throttle. Fall back to XFF (then localhost) only when x-real-ip is absent.
  const ip =
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';

  const { success, limit, remaining, reset } = await limiters[pathname].limit(ip);

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      },
    );
  }
}

export const config = {
  matcher: ['/api/enquiry', '/api/whatsapp-lead', '/api/booking', '/api/call-number', '/api/waitlist', '/api/ai-messages', '/api/car-specs', '/api/auth-account-status'],
};
