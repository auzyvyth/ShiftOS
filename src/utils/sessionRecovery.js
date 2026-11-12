import { supabase } from "../supabaseClient";

// A panel that cannot read its OWN profile has two very different causes, and
// they used to share one screen ("stuck in traffic, you're still signed in"):
//   1. the database stalled (timeout / 5xx)  -> Try again is right;
//   2. the saved login is dead (expired or revoked token, HTTP 401) -> Try again
//      can NEVER work, because every reload sends the same dead token.
// 2026-11-11: seller Yazeed sat on case 2 for hours. His access token had
// expired and his browser never refreshed it; every profile read was a 401.

/** True when the server rejected the login itself, not the query. */
export function isAuthRejected(error) {
  if (!error) return false;
  if (error.status === 401 || error.status === 403) return true;
  if (error.code === "PGRST301" || error.code === "PGRST303" || error.code === "bad_jwt") return true;
  return /jwt|token is expired|invalid token/i.test(error.message || "");
}

/**
 * Try to repair a rejected login. Returns "retry" when a fresh session was
 * obtained (read again), or "login" when the session cannot be saved (the saved
 * login is cleared on this device only, so the seller can sign in again).
 */
export async function recoverRejectedSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) return "retry";
  } catch { /* fall through to sign-in */ }
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* already gone */ }
  return "login";
}
