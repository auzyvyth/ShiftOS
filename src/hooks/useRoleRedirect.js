import { useNavigate, useLocation } from 'react-router-dom';
import { isPremiumSalesman } from '../utils/salesmanPlan';

// THE role -> home-surface map. There is exactly one of these; import it, never
// retype it. Five hand-copied duplicates had drifted (SalesmanLite,
// SalesmanPremium, Header, MarketplaceHeader, BuyerAuthPage): every copy was
// missing `buyer` and every copy sent `superadmin` to /dashboard instead of
// /platform. Two of them defaulted the missing key to '/dashboard', so a buyer
// who reached /salesman-lite was bounced through the dealer dashboard (whose
// own guard then sent them on to /account) instead of going there directly.
export const ROLE_ROUTES = {
  superadmin:  '/platform',
  dealer:      '/dashboard',
  owner:       '/dashboard',
  manager:     '/manager',
  salesman:    '/salesman',
  accountant:  '/accountant',
  fi_officer:  '/fi',
  admin:       '/admin',
  buyer:       '/account',
};

// Where an unknown/absent role goes. Deliberately the LEAST privileged surface:
// an unrecognised role is almost always a half-created stub, and guessing
// "seller" for those is what put a shopper in a dealer dashboard. /account is
// harmless for everyone — a real seller is in the map above and never lands here.
export const FALLBACK_ROUTE = '/account';

// Turn a role into a destination. Correct for every role EXCEPT `salesman` —
// see routeForProfile. Use this only where the profile genuinely isn't loaded.
export function routeForRole(role) {
  return ROLE_ROUTES[role] ?? FALLBACK_ROUTE;
}

/**
 * Where this ACCOUNT's home is. Prefer this over routeForRole anywhere the
 * profile is in hand.
 *
 * `salesman` is the one role a role name cannot answer on its own, because
 * three different panels serve it:
 *   dealer_id set            -> /salesman          (works under a dealer)
 *   standalone, PAID full    -> /salesman-premium
 *   standalone, otherwise    -> /salesman-lite
 * ROLE_ROUTES.salesman is '/salesman', so every "Dashboard" link sent a
 * STANDALONE rep to the linked-salesman panel. Salesmanpanel.jsx:517 catches it
 * and re-navigates, so it self-corrected — but only after mounting the wrong
 * panel, and only because that one guard exists. This is the same rule as
 * Salesmanpanel's, stated once, before the navigation instead of after it.
 */
// The columns routeForProfile needs. SELECT THESE, not a hand-picked subset:
// isPremiumSalesman reads is_active / plan_expires_at / payment_status, and
// every caller used to select only 'role, dealer_id, plan' — so it answered
// "not Premium" for every Premium rep, their Dashboard link went to
// /salesman-lite, and Lite forwarded them to /salesman-premium a second later.
export const ROUTE_PROFILE_COLUMNS = 'role, dealer_id, plan, is_active, plan_expires_at, payment_status';

export function routeForProfile(profile) {
  if (!profile?.role) return FALLBACK_ROUTE;
  if (profile.role === 'salesman' && !profile.dealer_id) {
    return isPremiumSalesman(profile) ? '/salesman-premium' : '/salesman-lite';
  }
  return routeForRole(profile.role);
}

// A seller's home is a dashboard; a buyer's is their account. Every surface that
// renders this link was wording it independently, and the mini page called it
// "Dashboard" for everyone — so a shopper on a seller's page saw a button
// labelled Dashboard and, reasonably, pressed it.
export function isSellerRole(role) {
  return Boolean(role) && role !== 'buyer';
}

/**
 * Returns a redirect function. Call it with the user's actual role after
 * fetching their profile. If the role isn't in the allowed set the user
 * is navigated away and the function returns true (so the caller can bail).
 * Returns false when the role is allowed or when already at the destination
 * (prevents redirect loops).
 *
 * expectedRole may be a single role string or an array of allowed roles.
 *
 * Usage:
 *   const redirectByRole = useRoleRedirect('salesman');
 *   const redirectByRole = useRoleRedirect(['dealer', 'manager', 'admin']);
 *   ...
 *   if (redirectByRole(profileData.role)) return;
 */
export function useRoleRedirect(expectedRole) {
  const navigate = useNavigate();
  const location = useLocation();

  const allowed = Array.isArray(expectedRole) ? expectedRole : [expectedRole];

  // Accepts either a bare role string (the original call shape) or the whole
  // profile row. Pass the profile where you have it — it is the only way the
  // standalone-salesman panels resolve correctly.
  return (current) => {
    const profile = typeof current === 'string' || !current ? null : current;
    const currentRole = profile ? profile.role : current;
    if (allowed.includes(currentRole)) return false;
    const destination = profile ? routeForProfile(profile) : routeForRole(currentRole);
    // Avoid redirect loop — don't navigate if already at the destination
    if (location.pathname === destination) return false;
    navigate(destination, { replace: true });
    return true;
  };
}
