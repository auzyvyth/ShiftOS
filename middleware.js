/* eslint-env browser */
// Vercel Edge Middleware — rate-limits public form submissions and dealer AI calls.
// Fails open if Upstash credentials are not configured so the site continues to
// work during local dev and before env vars are added.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { storefrontSubdomain } from './src/config/site.js';

const PROTECTED = new Set([
  '/api/enquiry',
  '/api/whatsapp-lead',
  '/api/booking',
  '/api/call-number',
  '/api/wa',
  '/api/track',
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
  // CDP-3: one seller WhatsApp number per tap. A buyer messaging a handful of
  // sellers fits easily; walking every listing for numbers does not.
  '/api/wa':           { window: '60 s',  max: 10, prefix: 'rl:wa' },
  '/api/waitlist':     { window: '300 s', max: 3,  prefix: 'rl:waitlist' },
  // ANALYTICS-SPOOF: one page fires several events (view, card clicks, exit).
  // Generous because Malaysian mobile carriers put many phones behind one IP;
  // a script inflating one seller's numbers still hits it fast.
  '/api/track':        { window: '60 s',  max: 120, prefix: 'rl:track' },
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

// PERF (2026-10-18): `/` and `/showroom` on the main domain are served by
// api/shell.js, which puts the newest cars and their first photos into the
// HTML (and is cached on Vercel's CDN). Only for real visitors on the plain,
// unfiltered page: a filtered URL shows other cars, a dealer subdomain is a
// different page, and crawlers keep their own route (vercel.json -> api/og).
const SHELL_PAGES = { '/': 'home', '/showroom': 'showroom' };
// Tracking params do not change what the page shows.
const TRACKING_PARAM = /^(utm_\w+|ref|fbclid|gclid|ttclid|igshid|mc_\w+)$/;
const CRAWLER = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|preview|perplexity|gpt|claude|anthropic|cohere|ia_archiver|google-inspectiontool|googleother|meta-external/i;

function shellRewrite(req, url) {
  const page = SHELL_PAGES[url.pathname];
  if (!page || req.method !== 'GET') return null;
  if (storefrontSubdomain(url.hostname)) return null;
  if ([...url.searchParams.keys()].some((k) => !TRACKING_PARAM.test(k))) return null;
  if (CRAWLER.test(req.headers.get('user-agent') || '')) return null;
  // Same as @vercel/edge rewrite(). Tracking params are dropped so every
  // visitor shares one CDN copy.
  return new Response(null, { headers: { 'x-middleware-rewrite': new URL(`/api/shell?p=${page}`, url).toString() } });
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const { pathname } = url;

  const shell = shellRewrite(req, url);
  if (shell) return shell;

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
  matcher: ['/', '/showroom', '/api/enquiry', '/api/whatsapp-lead', '/api/booking', '/api/call-number', '/api/wa', '/api/track', '/api/waitlist', '/api/ai-messages', '/api/car-specs', '/api/auth-account-status'],
};
