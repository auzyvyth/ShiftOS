// SEC-B5: auth_account_status is no longer callable directly (anon's EXECUTE
// grant was revoked, migration 20260912b) -- it's an enumeration oracle, so it
// now sits behind api/auth-account-status.js, which requires a Turnstile
// token. One implementation shared by LoginPage and BuyerAuthPage so the two
// copies of this call can't drift on the request/response shape.
//
// Returns null on any failure (network, captcha rejection, misconfigured
// server key) rather than throwing -- both callers already treat a falsy
// result the same as "couldn't determine", which degrades to the generic
// "no account found" copy instead of crashing the login flow.
export async function checkAccountStatus(email, captchaToken) {
  try {
    const res = await fetch('/api/auth-account-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token: captchaToken }),
    });
    if (!res.ok) return null;
    return await res.json(); // { account_exists, has_password }
  } catch {
    return null;
  }
}
