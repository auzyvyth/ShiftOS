import { supabase as mainClient } from "../supabaseClient";

// ── One brute-force throttle for every password login page ───────────────────
// Plain version: three wrong passwords for the same email inside 15 minutes
// locks that email out of signing in for 60 seconds. The counter lives in the
// DATABASE (`auth_login_throttle` + the `login_throttle_*` SECURITY DEFINER
// RPCs), not in the page, so reloading, opening a new tab or going incognito
// does not reset it.
//
// This module exists because the throttle was wired into LoginPage ONLY. The
// buyer sign-in (`BuyerAuthPage`) and — worse — the platform console login
// (`AdminPage`, the superadmin credential) both called
// `signInWithPassword` with no limit at all, so an attacker simply used one of
// those two pages instead. Three login pages calling three slightly different
// versions of this is exactly the drift this repo keeps getting bitten by, so
// there is one implementation and every page imports it.
//
// `client` is a parameter because /platform runs on the isolated
// `platformClient` session (its own storageKey). Same project, same anon key,
// so the RPCs resolve identically — but the CLEAR call must go through the
// client that actually holds the new session, see below.

// How many wrong passwords before the page offers "reset your password".
// Deliberately the same number as the DB lock, so the lock and the way out of
// it arrive in the same breath. One mistyped password is a typo — answering it
// with a reset link sends people on an email round-trip they did not need.
export const RESET_AFTER_FAILS = 3;

/**
 * Ask the server whether this email may attempt a password login right now.
 * Call BEFORE signInWithPassword — an active lock has to hold even for someone
 * who just reloaded the page.
 * Fails OPEN: if the RPC errors we let the login proceed. A throttle that
 * breaks must never become the reason nobody can sign in.
 */
export async function throttleCheck(email, client = mainClient) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return { allowed: true, secondsLeft: 0 };
  try {
    const { data } = await client.rpc("login_throttle_check", { p_email: clean });
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      return { allowed: false, secondsLeft: row.seconds_left || 60 };
    }
  } catch {
    /* fail open */
  }
  return { allowed: true, secondsLeft: 0 };
}

/**
 * Record one failed password attempt and read back where that leaves the email.
 * `attempts` is the running count — the pages use it to decide when to offer a
 * password reset, so it must come from the server rather than a local counter.
 */
export async function throttleFail(email, client = mainClient) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return { locked: false, secondsLeft: 0, attempts: 0 };
  try {
    const { data } = await client.rpc("login_throttle_fail", { p_email: clean });
    const row = Array.isArray(data) ? data[0] : data;
    return {
      locked: !!row?.locked,
      secondsLeft: row?.seconds_left || 60,
      attempts: row?.attempts || 0,
    };
  } catch {
    return { locked: false, secondsLeft: 0, attempts: 0 };
  }
}

/**
 * Clear the counter after a SUCCESSFUL sign-in. Fire and forget — nothing the
 * user sees depends on it, and a stale row expires on its own after 15 minutes.
 *
 * It must be called on the client that holds the brand-new session:
 * `login_throttle_clear` checks the caller's own `auth.uid()` against the email
 * it is handed (migration 20260905l — it used to clear ANY email's lockout for
 * anyone who asked, which made the throttle bypassable over the public REST
 * endpoint). Called with no session it silently no-ops, which is safe.
 */
export function throttleClear(email, client = mainClient) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return;
  try {
    client.rpc("login_throttle_clear", { p_email: clean }).then(
      () => {},
      () => {},
    );
  } catch {
    /* never block a successful login on cleanup */
  }
}

// ── AUTH-5: how often a stranger can make us send an auth email ──────────────
// Password reset, magic link and "resend confirmation" all mail whatever
// address is typed in the box. Nothing in the app limited that, so typing
// someone else's address and holding down the button mail-bombed their inbox
// on our behalf. `auth_email_action_gate` is a sliding window per
// (email, action): 3 sends per 15 minutes, and it hands back the seconds until
// the oldest one ages out.
//
// Per ACTION, not per email — filling the "reset" bucket must not also block
// the magic link, which may be the only way that person can get in.
//
// Say plainly what this is: the key is an address the CALLER supplies, so it
// is a spam brake, not proof of a human. Someone can burn a victim's three
// sends and delay that victim's own reset by up to 15 minutes, which is why
// the window is short and self-healing instead of a long lock. The real
// proof-of-human control is the captcha in AUTH-6 / ACT-10.
export const EMAIL_ACTIONS = { RESET: "reset", MAGIC: "magic", RESEND: "resend" };

/**
 * @returns {{allowed: boolean, secondsLeft: number, message: string}}
 * `message` is ready to show — the caller does not have to format the wait.
 * Fails OPEN, same rule as the login throttle: a broken brake must never
 * become the reason nobody can recover their account.
 */
export async function emailActionGate(email, action, client = mainClient) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return { allowed: true, secondsLeft: 0, message: "" };
  try {
    const { data } = await client.rpc("auth_email_action_gate", {
      p_email: clean,
      p_action: action,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      const secs = row.seconds_left || 60;
      const mins = Math.ceil(secs / 60);
      return {
        allowed: false,
        secondsLeft: secs,
        message:
          secs > 90
            ? `Too many requests for this email. Try again in about ${mins} minutes.`
            : `Too many requests for this email. Try again in ${secs}s.`,
      };
    }
  } catch {
    /* fail open */
  }
  return { allowed: true, secondsLeft: 0, message: "" };
}
