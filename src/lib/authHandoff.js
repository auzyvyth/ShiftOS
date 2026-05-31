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
