/* eslint-env node */
// SEC-B5: fronts the DB function auth_account_status(p_email), which answers
// "does this email have an account, and does it have a password" -- used by
// LoginPage and BuyerAuthPage to offer a magic link instead of a password
// reset for Google/OTP-only accounts. That answer is an enumeration oracle,
// so the DB function's EXECUTE grant to anon/authenticated/public was revoked
// (migration 20260912b) and this route is now the only caller, gated on the
// same invisible Turnstile proof-of-human every other auth call already
// requires (AUTH-6). Rate-limited at the edge by middleware.js on top of that.

import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile, clientIp } from '../lib/turnstile.js';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, token } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Missing email' });
  }

  // Proof-of-human. Fails open only when TURNSTILE_SECRET is unset — the
  // per-IP limit in middleware.js is the backstop for that window, same as
  // enquiry/whatsapp-lead.
  const check = await verifyTurnstile(token, clientIp(req));
  if (!check.ok) {
    return res.status(403).json({ error: 'captcha_failed', reason: check.reason });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    // Fail closed and loud in the log -- but the caller (checkAccountStatus)
    // treats a non-200 the same as "couldn't determine", which degrades to
    // the generic "no account found" copy rather than crashing login.
    console.error('[api/auth-account-status] no service role key configured');
    return res.status(500).json({ error: 'not_configured' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: rows, error } = await supabase.rpc('auth_account_status', {
    p_email: email.trim(),
  });
  if (error) {
    console.error('[api/auth-account-status]', error.message);
    return res.status(500).json({ error: 'lookup_failed' });
  }

  const status = Array.isArray(rows) ? rows[0] : rows;
  return res.status(200).json({
    account_exists: !!status?.account_exists,
    has_password: !!status?.has_password,
  });
}
