import { isCaptchaError, captchaErrorMessage } from "../hooks/useAuthCaptcha";
import { logError } from "./logError";

// ── One reader for every Supabase auth error the sign-in pages can hit ────────
// Plain version: supabase-js puts a machine-readable `code` on every auth error
// (`invalid_credentials`, `email_not_confirmed`, `otp_expired`, ...). The pages
// used to guess from the HTTP status instead, and `status === 400` is shared by
// a wrong password, an unconfirmed email AND a captcha rejection — so an
// unconfirmed account was told "Wrong password" and burned a throttle attempt.
// Classify on the code; fall back to the message only for older servers.

export function authErrorCode(error) {
  return error?.code || "";
}

/** A genuinely rejected email + password pair — the only thing that counts as a guess. */
export function isWrongCredentials(error) {
  if (!error) return false;
  if (error.code) return error.code === "invalid_credentials";
  return /invalid login credentials/i.test(error.message || "");
}

export function isEmailNotConfirmed(error) {
  return error?.code === "email_not_confirmed" || /email not confirmed/i.test(error?.message || "");
}

/**
 * The sentence to SHOW for a failed auth call. Never returns an empty string:
 * a failure with nothing on screen is the bug this module exists to stop.
 */
export function authErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (isCaptchaError(error)) return captchaErrorMessage();
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "We've just sent an email to this address. Wait a minute, then try again.";
    case "over_request_rate_limit":
      return "Too many attempts from this device. Wait a minute, then try again.";
    case "otp_expired":
      return "That code or link is wrong or has expired. Request a new one.";
    case "otp_disabled":
    case "signup_disabled":
    case "user_not_found":
      return "No account found with that email. Check for typos, or sign up first.";
    case "email_not_confirmed":
      return "This email isn't confirmed yet. Check your inbox for the confirmation link.";
    case "email_address_invalid":
      return "That email address doesn't look right. Check it and try again.";
    case "user_banned":
      return "This account has been suspended. Contact support@xdrive.my.";
    case "weak_password":
      return error.message || "That password is too weak.";
    case "same_password":
      return "Your new password must be different from your current one.";
    default:
      break;
  }
  // A dropped connection surfaces as a fetch TypeError or a status-0 AuthRetryableFetchError.
  if (error.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(error.message || "")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return error.message || fallback;
}

// Why /auth/callback bounced someone back to /login. The callback puts a short
// reason on the URL (`?error=auth_failed&reason=...`); before this, /login never
// read it, so a failed Google sign-in or a dead magic link landed on a plain
// form with no hint anything had gone wrong.
export function callbackFailureMessage(reason) {
  switch (reason) {
    case "otp_expired":
    case "access_denied":
      return "That sign-in link has expired or was already used. Request a new one below.";
    case "timeout":
      return "Sign-in didn't finish. If you opened the link on a different device or browser, request a new one here.";
    case "profile":
      return "You're signed in, but we couldn't load your account. Please try again.";
    default:
      return "Sign-in didn't complete. Please try again.";
  }
}

// ── Telling US, not just the person on the page ──────────────────────────────
// Codes that mean the PERSON did something (typo, expired code, pressed send
// too often). Reporting these would bury the real failures in noise.
const USER_CAUSED = new Set([
  "invalid_credentials", "email_not_confirmed", "otp_expired",
  "over_email_send_rate_limit", "over_request_rate_limit", "otp_disabled",
  "signup_disabled", "user_not_found", "email_address_invalid", "weak_password",
  "same_password", "mfa_verification_failed", "user_already_exists",
  "email_exists", "user_banned",
]);

/**
 * Send a SYSTEM-side auth failure to error_logs, whose trigger
 * (trg_notify_error_log -> notify_ops) pushes the superadmin and posts to the
 * ops Telegram channel, throttled per code. `where` becomes the error code
 * (`auth:<where>`), so each failing step alerts on its own.
 *
 * Skips user mistakes, dropped connections, and captcha rejections off
 * xdrive.my (every Vercel preview fails the captcha by design). Never sends
 * the email address, and never the URL's query or hash — on /auth/callback
 * those carry the sign-in code and tokens.
 */
export function reportAuthFailure(where, error) {
  try {
    if (!error) return;
    if (error.code && USER_CAUSED.has(error.code)) return;
    if (error.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(error.message || "")) return;
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    if (isCaptchaError(error) && !(host === "xdrive.my" || host.endsWith(".xdrive.my"))) return;
    logError(error, {
      code: `auth:${where}`,
      context: `auth ${where} failed${error.code ? ` (${error.code})` : ""}`,
      metadata: {
        url: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : null,
        auth_code: error.code || null,
        status: error.status ?? null,
      },
    });
  } catch {
    /* reporting must never break the page that is already handling a failure */
  }
}
