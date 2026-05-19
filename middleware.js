/* eslint-env browser */
// Vercel Edge Middleware — rate-limits public form submission routes only.
// Fails open if Upstash credentials are not yet configured so the site
// continues to work during local dev and before env vars are added.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const PROTECTED = new Set(['/api/enquiry', '/api/booking', '/api/waitlist']);

// Limits: enquiry 5/min, booking 3/min, waitlist 3/5min per IP
const LIMITS = {
  '/api/enquiry': { window: '60 s', max: 5, prefix: 'rl:enquiry' },
  '/api/booking': { window: '60 s', max: 3, prefix: 'rl:booking' },
  '/api/waitlist': { window: '300 s', max: 3, prefix: 'rl:waitlist' },
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

  if (!limiters) limiters = buildLimiters();
  if (!limiters) return; // Upstash not configured — pass through

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';

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
  matcher: ['/api/enquiry', '/api/booking', '/api/waitlist'],
};
