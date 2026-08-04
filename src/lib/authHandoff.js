// Cross-subdomain session handoff.
//
// Login happens on xdrive.my (or shiftos.com) but dashboards and salesman
// panels are served from <sub>.xdrive.my — a different origin, so the Supabase
// session in localStorage does not carry across. We hand the session over by
// passing the access/refresh tokens through the redirect URL.
//
// The tokens travel in the URL *hash fragment* (not the query string) because
// hash fragments are never included in Referer headers and are not written to
// server access logs, which removes the two worst leakage vectors. The fragment
// is stripped from the URL the moment it is consumed.

export function handoffSuffix(session) {
  const at = session?.access_token;
  const rt = session?.refresh_token;
  if (!at || !rt) return "";
  return `#_at=${at}&_rt=${rt}`;
}

export function readHandoffTokens() {
  // Read from the hash first, then fall back to the legacy query-string form so
  // that redirects already in flight during a deploy still complete.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  const at = hash.get("_at") || search.get("_at");
  const rt = hash.get("_rt") || search.get("_rt");
  return { at, rt };
}

export function clearHandoffTokens() {
  // Drops both the query string and the hash, leaving a clean path.
  window.history.replaceState({}, "", window.location.pathname);
}

// ── Robust cross-subdomain session establishment ────────────────────────────
//
// Login happens on xdrive.my; dealer dashboards live on <sub>.xdrive.my — a
// different origin whose localStorage does NOT carry the session. We pass the
// tokens in the URL hash and call setSession on the subdomain. Two things make
// that fragile, and this helper handles both so a dealer never lands on the
// subdomain's OWN /login and has to sign in a second time:
//
//  1. A STALE session already in the subdomain's localStorage (from a previous
//     login) makes supabase-js auto-recover/refresh it on load, holding the auth
//     lock. Our setSession then contends for that lock and its promise can stall
//     for several seconds — even though it still persists the fresh session to
//     storage once the lock frees. So: wait (capped), then poll getSession,
//     which reads the now-persisted session.
//  2. If it still hasn't taken, do ONE guarded reload. The previous code cleared
//     the URL tokens BEFORE reloading, so the reloaded page had nothing to retry
//     with and dropped straight to /login (the double-login bug). We stash the
//     tokens in sessionStorage (origin-scoped, survives the reload) so the fresh
//     page — with no stale-session refresh contending for the lock — retries the
//     handoff cleanly, then clears the stash on success.
//
// Returns { session, reloading }. When reloading is true the caller MUST bail —
// the page is navigating away.
const STASH_AT = "handoff_stash_at";
const STASH_RT = "handoff_stash_rt";
const RELOAD_GUARD = "handoff_reloaded";

function ssGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key, val) {
  try { sessionStorage.setItem(key, val); } catch { /* blocked in partitioned webview */ }
}
function ssDel(key) {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}
function clearHandoffStash() {
  ssDel(STASH_AT);
  ssDel(STASH_RT);
  ssDel(RELOAD_GUARD);
}

export async function establishSessionFromHandoff(supabase) {
  let at, rt;
  ({ at, rt } = readHandoffTokens());
  // After a guarded reload the URL is clean — fall back to the stash.
  if (!at || !rt) {
    at = ssGet(STASH_AT);
    rt = ssGet(STASH_RT);
  }

  // No handoff in play — just report the existing session.
  if (!at || !rt) {
    const { data } = await supabase.auth.getSession();
    return { session: data?.session ?? null, reloading: false };
  }

  // Clean the URL immediately — tokens must not linger in the address bar. The
  // stash (not the URL) is what survives a retry reload.
  clearHandoffTokens();

  const setResult = await Promise.race([
    supabase.auth
      .setSession({ access_token: at, refresh_token: rt })
      .then((r) => ({ ok: true, r }))
      .catch(() => ({ ok: false })),
    new Promise((res) => setTimeout(() => res({ ok: false }), 8000)),
  ]);

  let session = setResult.ok ? setResult.r?.data?.session ?? null : null;

  // setSession stalled on the lock — poll storage, where it usually landed.
  for (let i = 0; i < 8 && !session; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const { data } = await supabase.auth.getSession();
    session = data?.session ?? null;
  }

  if (session) {
    clearHandoffStash();
    return { session, reloading: false };
  }

  // Still nothing. One guarded reload with the tokens stashed for the retry.
  // Before reloading, purge any STALE persisted session sitting in this origin's
  // localStorage. That stale session is what supabase-js auto-recovers on load
  // and holds the auth lock with — so a naive reload just re-creates the same
  // contention and the retry drops to /login all over again (the "still happens"
  // double-login). Clearing the persisted session key (NOT a server sign-out —
  // that would revoke the very refresh token we're handing off) means the
  // reloaded page has nothing to recover, and setSession(stashed tokens) applies
  // cleanly with no lock to fight for.
  if (!ssGet(RELOAD_GUARD)) {
    ssSet(STASH_AT, at);
    ssSet(STASH_RT, rt);
    ssSet(RELOAD_GUARD, "1");
    try {
      Object.keys(localStorage)
        .filter((k) => /^sb-.*-auth-token$/.test(k))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* storage blocked in partitioned webview — reload still retries */ }
    window.location.reload();
    return { session: null, reloading: true };
  }

  // Second attempt failed too — give up cleanly; caller falls back to /login.
  clearHandoffStash();
  return { session: null, reloading: false };
}
