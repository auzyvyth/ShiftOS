import { useNavigate, useLocation } from 'react-router-dom';

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

// The single way to turn a role into a destination.
export function routeForRole(role) {
  return ROLE_ROUTES[role] ?? FALLBACK_ROUTE;
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

  return (currentRole) => {
    if (allowed.includes(currentRole)) return false;
    const destination = routeForRole(currentRole);
    // Avoid redirect loop — don't navigate if already at the destination
    if (location.pathname === destination) return false;
    navigate(destination, { replace: true });
    return true;
  };
}
