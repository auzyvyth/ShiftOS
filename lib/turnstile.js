/* eslint-env node */
// Shared Cloudflare Turnstile server-side verification for the public /api write
// routes (whatsapp-lead, enquiry). The SECRET key lives only in server env
// (TURNSTILE_SECRET) and is never exposed to the client — the browser only
// carries VITE_TURNSTILE_SITE_KEY and returns a one-time token from the widget.
//
// Fails OPEN when TURNSTILE_SECRET is not configured, so the site keeps working
// before the secret is added (and during local dev) — the DB flood caps remain
// the backstop. Once the secret is set, a missing/invalid token is rejected.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Returns { ok: boolean, reason: string }. ok=true means the request may proceed.
export async function verifyTurnstile(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET;

  // No secret configured yet -> fail open (do not block real buyers before setup).
  if (!secret) return { ok: true, reason: 'not_configured' };

  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteip) body.append('remoteip', remoteip);

    const resp = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await resp.json();
    if (data?.success) return { ok: true, reason: 'verified' };
    return { ok: false, reason: (data?.['error-codes'] || []).join(',') || 'failed' };
  } catch (err) {
    // Network error reaching Cloudflare -> fail open rather than drop the lead
    // (the buyer already reached WhatsApp; the DB caps still apply).
    console.error('[turnstile] verify error:', err?.message);
    return { ok: true, reason: 'verify_unreachable' };
  }
}

// Best-effort client IP from Vercel's forwarded headers.
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}
