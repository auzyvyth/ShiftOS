# Auth flow audit — login routing, magic link, password reset, email (2026-09-26)

Scope: `/login` (LoginPage), `/buyer-login` (BuyerAuthPage), `/auth/callback`
(AuthCallbackPage), `/auth/confirm` (AuthConfirmPage), `/reset-password`
(ResetPasswordPage), Google One Tap, `ensureBuyerProfile`, and the Resend-based
auth emails in edge functions. Checked against live Supabase auth logs and
`auth.users` as well as the code.

## Live state (Supabase, checked 2026-09-26)
- 28 real accounts + 15 guest (anonymous) buyers. Every auth user has a profile row.
- 0 accounts stuck unconfirmed. 3 reset codes requested in 30 days; both password
  users signed in afterwards (the flow works end to end).
- Last 24h of auth logs: only two error kinds. `captcha_failed` on a password
  login from a Vercel preview URL (expected — Turnstile only allows xdrive.my,
  already explained on screen by `captchaErrorMessage`), and two
  `refresh_token_not_found` (a stale session on a device; harmless).
- All Resend-sending edge functions returned 200 today. They all fall back to
  `onboarding@resend.dev` when `RESEND_FROM_EMAIL` is unset
  (`invites/index.ts:56`, `create-salesman/index.ts:42`,
  `send-signup-reminder/index.ts:84`, `send-document/index.ts:250`). Resend's
  sandbox sender only delivers to the Resend account owner, so if that secret is
  ever removed every setup/invite email silently stops reaching real people.
  Could not read the secret from here — confirm it is set in the dashboard.

## FIXED in this change — errors that were hidden or mislabelled

| # | Where | What was wrong | Now |
|---|---|---|---|
| E1 | `AuthCallbackPage.jsx:211,229,258` + `LoginPage.jsx:93` | Every callback failure went to `/login?error=auth_failed`, and **nothing read that param**. A dead magic link, a cancelled Google sign-in or a 10s timeout landed on a plain login form with no message. | Callback passes a reason; login shows it (`callbackFailureMessage`). |
| E2 | `LoginPage.jsx:677` | "Resend confirmation email" ignored the result and always said "resent!". | Checks the error, shows it. Also passes `emailRedirectTo` so the new link lands on `/auth/callback` like the original. |
| E3 | `LoginPage.jsx:409`, `BuyerAuthPage.jsx:181` | Wrong-password test was `status === 400`. Supabase also returns 400 for an **unconfirmed email**, so that person was told "Wrong password" and spent one of their 3 throttle attempts. (The BuyerAuth comment even claimed the opposite.) | Classified on `error.code` (`invalid_credentials`). Unconfirmed goes to the confirm screen with a working resend button. |
| E4 | `ResetPasswordPage.jsx:204` | Supabase answers a typo'd code and an expired code with the same error ("Token has expired or is invalid"). The page matched `/expired/`, so **every typo said "your code has expired, request a new one"** — sending people into the 3-per-15-min send cap. | "That code is wrong or has expired…" for `otp_expired`; any other error says what it is. |
| E5 | `LoginPage.jsx:290`, `AuthCallbackPage.jsx`, `AuthConfirmPage.jsx`, `ResetPasswordPage.jsx` | A failed `profiles` read was treated as "no profile", so a network/RLS blip routed an existing dealer or salesman into the **signup wizard**. | A failed read stops and says so. |
| E6 | `src/lib/buyerAuth.js:94,111` | `ensureBuyerProfile` ignored insert/update errors and returned `'buyer'` anyway. On the buyer page an exception there left the button **spinning forever**. | Throws; every caller (callback, buyer page, One Tap) catches and shows it. |
| E7 | All send/sign-in sites | Raw Supabase strings, and rate-limit/captcha/network errors shown inconsistently. | One reader, `src/utils/authErrors.js` `authErrorMessage`. |
| E8 | Everywhere above | Nothing told the team when auth broke. | `reportAuthFailure` writes system-side failures to `error_logs` -> `trg_notify_error_log` -> `notify_ops` (Telegram + superadmin push, 15-min throttle per code, codes `auth:<step>`). User mistakes (wrong password, bad code, rate limits), dropped connections and preview-URL captcha failures are NOT reported. No email address, query string or hash is sent. |

## FIXED in the follow-up — login routing drift (needs a staging click-through before prod)
Root cause: there are **four hand-written `redirectByRole` copies** (LoginPage,
AuthCallbackPage, AuthConfirmPage, ResetPasswordPage) and one canonical
resolver nobody uses here (`routeForProfile`, `src/hooks/useRoleRedirect.js`).
They disagree:

- **R1** `LoginPage.jsx:364` — manager / admin / accountant / fi_officer (5 live
  accounts) fall into the `else` and go to `/salesman`. Salesmanpanel's guard
  then bounces them to their real panel: a full wasted panel boot on every login.
- **R2** `LoginPage.jsx:333`, `AuthConfirmPage.jsx:78`, `ResetPasswordPage.jsx:32` —
  a dealer mid-onboarding is sent to `/onboarding`, which App.jsx redirects to
  `/plans`. They lose their place; `AuthCallbackPage` correctly resumes
  `/dealer-onboarding`.
- **R3** `AuthCallbackPage.jsx:175-176` — salesman after Google/magic link:
  hardcoded `https://xdrive.my/...` (a staging/preview sign-in jumps to PROD),
  and ignores `plan`, so a Premium salesman lands on Lite and is bounced again.
- **R4** `AuthConfirmPage.jsx:81-94` — used by `send-signup-reminder` links.
  Premium salesman mid-onboarding -> `/salesman-onboarding` (defaults to Lite:
  the silent downgrade AuthCallbackPage's comment warns about); Premium done ->
  Lite; `buyer` -> `/dashboard`.
- **R5** `ResetPasswordPage.jsx:64` — buyer who opens `/reset-password` while
  signed in goes to `/salesman`.
- **R6** `Salesmanpanel.jsx:616,641` — a failed session/profile read sends the
  rep to `/login` with no message (same pattern as E5, outside the auth pages).

- **R7** (found in the follow-up, the cause of "Premium opens Lite, then jumps
  to Premium"): the header "Dashboard" links selected only `role, dealer_id,
  plan`; `isPremiumSalesman` needs `is_active, plan_expires_at,
  payment_status`, so it said "not Premium" for every Premium rep.
- **R8** SalesmanLite forwarded on `plan === 'salesman_full'` alone while
  SalesmanPremium sends anyone not entitled back to Lite: an unpaid or expired
  Premium account looped between the two forever.

Fix shipped: `src/utils/postAuthRoute.js` (`resolvePostAuthRoute`) used by all
four pages, `ROUTE_PROFILE_COLUMNS` for every routeForProfile caller, Lite's
guard on `isPremiumSalesman`, panels say why when they send you to /login,
`push_home_path` on the same Premium rule (migration 20260926a, applied live).
Tests: `tests/postAuthRoute.test.mjs`. Still to do: the staging click-through
per role, and the Premium free-month entitlement decision (TODO AUTH-10).
