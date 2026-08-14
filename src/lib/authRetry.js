// Auth-aware query recovery for public read surfaces (marketplace / showroom).
//
// public_car_listings is anon-readable, so a logged-OUT visitor's search always
// works. The failure mode we hit is a logged-IN visitor whose stored session
// token is stale/expired on THIS origin: supabase-js attaches the dead token to
// the PostgREST request and it comes back 401, which the grid surfaced as the
// opaque "Failed to load listings". Refreshing the session (or, if the refresh
// token itself is dead, dropping the local session so the retry goes out
// anonymously) lets the public read succeed instead of leaving the grid stuck.

export function isAuthError(err) {
  if (!err) return false;
  const status = err.status ?? err.statusCode;
  const code = String(err.code || "");
  const msg = String(err.message || "").toLowerCase();
  return (
    status === 401 ||
    code === "PGRST301" || // JWT expired / invalid (PostgREST)
    msg.includes("jwt") ||
    msg.includes("token is expired") ||
    msg.includes("invalid token")
  );
}

// `run` must return the awaited PostgREST result object ({ data, error, count }).
// It may THROW for non-PostgREST failures (e.g. a hard timeout race) — those are
// left to propagate untouched, so timeout/network handling upstream is unchanged.
// Only an auth-shaped `error` triggers exactly one recovery + retry.
export async function runWithAuthRetry(supabase, run) {
  let res = await run();
  if (!isAuthError(res?.error)) return res;

  let recovered = false;
  try {
    const { data } = await supabase.auth.refreshSession();
    recovered = !!data?.session;
  } catch {
    /* refresh threw — treat as unrecoverable below */
  }
  // Refresh token is dead: drop the local session (scope:'local' does NOT revoke
  // the token server-side, it just clears this origin's storage) so the retry
  // goes out as anon and the public listing read still succeeds.
  if (!recovered) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore — retry proceeds regardless */
    }
  }
  return run();
}
