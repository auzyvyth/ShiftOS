import { useNavigate, useLocation } from 'react-router-dom';

const ROLE_ROUTES = {
  salesman:   '/salesman',
  admin:      '/admin',
  manager:    '/dashboard',
  accountant: '/accounts',
  owner:      '/dashboard',
  dealer:     '/dashboard',
  superadmin: '/dashboard',
};

/**
 * Returns a redirect function. Call it with the user's actual role after
 * fetching their profile. If the role doesn't match expectedRole the user
 * is navigated away and the function returns true (so the caller can bail).
 * Returns false when the role matches or when already at the destination
 * (prevents redirect loops).
 *
 * Usage:
 *   const redirectByRole = useRoleRedirect('salesman');
 *   ...
 *   if (redirectByRole(profileData.role)) return;
 */
export function useRoleRedirect(expectedRole) {
  const navigate = useNavigate();
  const location = useLocation();

  return (currentRole) => {
    if (currentRole === expectedRole) return false;
    const destination = ROLE_ROUTES[currentRole] ?? '/dashboard';
    // Avoid redirect loop — don't navigate if already at the destination
    if (location.pathname === destination) return false;
    navigate(destination, { replace: true });
    return true;
  };
}
