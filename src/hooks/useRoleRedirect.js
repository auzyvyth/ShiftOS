import { useNavigate, useLocation } from 'react-router-dom';

const ROLE_ROUTES = {
  superadmin:  '/dashboard',
  dealer:      '/dashboard',
  owner:       '/dashboard',
  manager:     '/manager',
  salesman:    '/salesman',
  accountant:  '/accountant',
  fi_officer:  '/fi',
  admin:       '/admin',
};

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
    const destination = ROLE_ROUTES[currentRole] ?? '/dashboard';
    // Avoid redirect loop — don't navigate if already at the destination
    if (location.pathname === destination) return false;
    navigate(destination, { replace: true });
    return true;
  };
}
