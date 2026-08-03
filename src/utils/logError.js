import { supabase } from '../supabaseClient';

// Crash-safe error reporter -> error_logs table. Gives superadmins a
// user/dealer-attributed ops view of client errors (Sentry still owns full
// stack traces). The DB enforces the hard rate limit via error_logs_rate_ok();
// this client guard just stops a render/crash loop from flooding the network
// before that backstop kicks in. Every path is wrapped so the reporter can
// never itself throw — it runs from inside error handlers.

let ctx = { userId: null, role: null, dealerId: null };

// Opportunistically set by useProfile once the profile loads, so uncaught
// errors carry role/dealer attribution without logError depending on the hook.
export function setErrorContext(next) {
  ctx = { ...ctx, ...(next || {}) };
}

const RATE_KEY = 'errlog-rate';
const MAX_PER_MIN = 8;

function underRateLimit() {
  try {
    const now = Date.now();
    const recent = JSON.parse(sessionStorage.getItem(RATE_KEY) || '[]').filter(t => now - t < 60000);
    if (recent.length >= MAX_PER_MIN) return false;
    recent.push(now);
    sessionStorage.setItem(RATE_KEY, JSON.stringify(recent));
    return true;
  } catch {
    return true; // sessionStorage blocked — don't suppress reporting
  }
}

function clip(v, n) {
  if (v == null) return null;
  const s = String(v);
  return s.length > n ? s.slice(0, n) : s;
}

// logError(error, { code, context, metadata, queryInfo })
export async function logError(error, opts = {}) {
  try {
    const message = clip(error?.message || error || 'Unknown error', 4000);
    if (!message) return;
    if (!underRateLimit()) return;

    const metadata = {
      url: clip(typeof window !== 'undefined' ? window.location?.href : null, 500),
      ua: clip(typeof navigator !== 'undefined' ? navigator.userAgent : null, 300),
      ...(opts.metadata || {}),
    };
    let queryInfo = opts.queryInfo || null;
    if (error?.stack) queryInfo = { ...(queryInfo || {}), stack: clip(error.stack, 3000) };

    // RLS requires user_id to be null or exactly auth.uid(); read the live
    // session so a stale cached id can never fail the insert.
    let userId = ctx.userId;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data?.session?.user?.id || null;
    } catch { /* fall back to cached */ }

    await supabase.from('error_logs').insert({
      user_id: userId,
      dealer_id: ctx.dealerId || null,
      role: clip(ctx.role, 40),
      error_code: clip(opts.code, 200),
      error_message: message,
      context: clip(opts.context, 4000),
      query_info: queryInfo,
      metadata,
    });
  } catch {
    // Swallow — the reporter must never surface its own failure.
  }
}
