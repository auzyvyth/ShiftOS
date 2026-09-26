import { routeForProfile } from "../hooks/useRoleRedirect";
import { handoffSuffix } from "../lib/authHandoff";

// ── THE one answer to "where does this account land after signing in?" ──────
// Plain version: password login, Google, magic links, the email-confirm link
// and the reset page each had their own hand-copied version of this, and they
// had drifted apart:
//   - managers / admins / accountants / F&I officers were sent to /salesman
//     first and bounced on from there (LoginPage)
//   - Premium reps landed on /salesman-lite and were forwarded a second later
//     (AuthCallbackPage, AuthConfirmPage)
//   - a Google sign-in on staging jumped to PRODUCTION, because the salesman
//     address was hardcoded to https://xdrive.my (AuthCallbackPage)
//   - a dealer halfway through signup went to /onboarding, which App.jsx turns
//     into /plans, so they lost their place (LoginPage, AuthConfirmPage)
//   - a buyer confirming their email was sent to /dashboard (AuthConfirmPage)
// Each page still owns what only it knows (the "no profile yet" signup resume,
// the buyer's return-to page); the account-to-destination rule lives here.
//
// The profile must be selected with POST_AUTH_COLUMNS — routeForProfile needs
// the payment columns to tell Lite from Premium.

export const POST_AUTH_COLUMNS =
  "role, dealer_id, plan, is_active, plan_expires_at, payment_status, subdomain, onboarding_complete, full_name, ic_number, dealership";

export function isProdHost() {
  const h = typeof window !== "undefined" ? window.location.hostname : "";
  return h === "xdrive.my" || h.endsWith(".xdrive.my");
}

/**
 * @param profile  a profiles row selected with POST_AUTH_COLUMNS (never null —
 *                 "no profile yet" is each page's own signup-resume decision)
 * @param opts.session     the new session, for the cross-subdomain handoff
 * @param opts.buyerHome   where a buyer goes (the page's return-to URL)
 * @param opts.premiumHint true when signup metadata says the rep chose Premium,
 *                         so a mid-onboarding re-auth resumes the right tier
 * @returns {{ url: string, hard: boolean }} `hard` = leave the SPA with a full
 *          page load (another origin, or tokens riding in the hash).
 */
export function resolvePostAuthRoute(profile, { session = null, buyerHome = "/account", premiumHint = false } = {}) {
  const prod = isProdHost();
  const role = profile?.role;

  if (role === "buyer") return { url: buyerHome, hard: false };
  // The platform console, never a dealer dashboard.
  if (role === "superadmin") return { url: "/platform", hard: false };

  // A BARE signup stub: the handle_new_user trigger stamps role='dealer' the
  // instant an auth user exists, so someone who only pressed "Continue with
  // Google" has a dealer row with nothing in it. They never chose to be a
  // dealer — ask (the chooser also has an "I'm just here to buy" exit) rather
  // than drop them into the dealer wizard. Dealer/owner only: role='salesman'
  // is written by the salesman wizard itself, so that person already chose and
  // resumes their wizard below.
  const bareStub =
    (role === "dealer" || role === "owner") &&
    profile.onboarding_complete === false &&
    !profile.subdomain && !profile.full_name && !profile.ic_number && !profile.dealership;
  if (bareStub) return { url: "/choose-plan", hard: false };

  if (role === "dealer" || role === "owner") {
    // A subdomain means onboarding finished, whatever the flag says (flag drift
    // must never lock a live dealer out of their dashboard).
    if (profile.onboarding_complete === false && !profile.subdomain) {
      return { url: "/dealer-onboarding", hard: false };
    }
    // Dealer dashboards live on <sub>.xdrive.my, another origin: carry the
    // session in the hash. Only on the real domain — a preview or localhost
    // has no dealer subdomains, and jumping anyway lands on production.
    if (profile.subdomain && prod) {
      return { url: `https://${profile.subdomain}.xdrive.my/dashboard${handoffSuffix(session)}`, hard: true };
    }
    return { url: "/dashboard", hard: false };
  }

  if (role === "salesman") {
    // Never let a half-signed-up rep into an empty dashboard. Resume the tier
    // they picked; without it the wizard defaults to Lite and silently
    // downgrades a Premium signup.
    if (profile.onboarding_complete === false) {
      const premium = premiumHint || profile.plan === "salesman_full";
      return { url: `/salesman-onboarding/${premium ? "premium" : "lite"}`, hard: false };
    }
    const home = routeForProfile(profile); // /salesman, /salesman-premium or /salesman-lite
    // Sign-in can start on www.xdrive.my or a dealer subdomain, whose stored
    // session xdrive.my cannot see — so on prod the panel is always reached on
    // xdrive.my with the session handed over. Off prod, stay on this host.
    if (prod) return { url: `https://xdrive.my${home}${handoffSuffix(session)}`, hard: true };
    return { url: home, hard: false };
  }

  // manager / admin / accountant / fi_officer straight to their own panel, and
  // anything unrecognised to the least-privileged surface (/account).
  return { url: routeForProfile(profile), hard: false };
}

/** Go there: a full page load when leaving the SPA, else a router replace. */
export function goPostAuth({ url, hard }, navigate) {
  if (hard || !navigate) window.location.replace(url);
  else navigate(url, { replace: true });
}
