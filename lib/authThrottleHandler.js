/* eslint-env node */
// Not a route of its own: Vercel Hobby allows 12 serverless functions per
// deployment and a 16th file in api/ failed the build. /api/auth-throttle is
// rewritten (vercel.json) to /api/auth-account-status?throttle=1, which hands
// the request here. middleware.js still limits /api/auth-throttle on its own.
//
// Fronts the login throttle + auth-email gate DB functions:
//   check -> login_throttle_check(p_email)
//   fail  -> login_throttle_fail(p_email)
//   gate  -> auth_email_action_gate(p_email, p_action)
// Throttle writes go through the server: the DB functions are server-only
// (migration 20261109l), this route calls them with the server key, and
// middleware.js applies a per-IP limit to the route.
//
// Every answer is advisory to our own sign-in pages, so the client
// (src/utils/authThrottle.js) treats any non-200 as "allowed" (fail open):
// a broken throttle must never be the reason nobody can sign in.
// login_throttle_clear is NOT here: it checks the caller's own session, so the
// page keeps calling it directly on the client that holds the new session.

import { createClient } from '@supabase/supabase-js';
import { applyCors } from './cors.js';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';
const EMAIL_ACTIONS = new Set(['reset', 'magic', 'resend']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function authThrottleHandler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, emailAction } = req.body || {};
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!clean || clean.length > 254 || !EMAIL_RE.test(clean)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  let rpc;
  let args;
  if (action === 'check') {
    rpc = 'login_throttle_check';
    args = { p_email: clean };
  } else if (action === 'fail') {
    rpc = 'login_throttle_fail';
    args = { p_email: clean };
  } else if (action === 'gate') {
    if (!EMAIL_ACTIONS.has(emailAction)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    rpc = 'auth_email_action_gate';
    args = { p_email: clean, p_action: emailAction };
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Server key first, same as api/waitlist.js: it works before and after the
  // grants move to service_role. Without it the anon fallback only works until
  // 20261109l is applied; after that the RPC errors and the client fails open.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) console.error('[api/auth-throttle] no service role key configured');
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    serviceKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    console.error('[api/auth-throttle]', rpc, error.message);
    return res.status(500).json({ error: 'throttle_failed' });
  }

  const row = (Array.isArray(data) ? data[0] : data) || {};
  if (action === 'fail') {
    return res.status(200).json({
      locked: !!row.locked,
      seconds_left: row.seconds_left || 0,
      attempts: row.attempts || 0,
    });
  }
  return res.status(200).json({
    allowed: row.allowed !== false,
    seconds_left: row.seconds_left || 0,
  });
}
