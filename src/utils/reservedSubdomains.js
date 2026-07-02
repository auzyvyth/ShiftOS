// Subdomains a dealer may NOT claim — they collide with infra, routing, auth,
// or brand namespaces (e.g. admin.xdrive.my, login.xdrive.my). Keep this list
// in sync with the DB guard `is_reserved_subdomain()` (migration
// reserved_subdomain_guard) — the DB is the real enforcement; this is for
// friendly inline validation before submit.
export const RESERVED_SUBDOMAINS = new Set([
  // infra / mail / dns
  'www', 'ftp', 'mail', 'smtp', 'imap', 'pop', 'ns1', 'ns2', 'mx', 'email', 'webmail',
  'cpanel', 'whm', 'host', 'hosting', 'server', 'db', 'database', 'redis', 'ws', 'socket',
  'cdn', 'static', 'assets', 'media', 'img', 'images', 'files', 'download', 'downloads',
  // auth / account / admin
  'admin', 'administrator', 'superadmin', 'root', 'system', 'sys', 'sysadmin',
  'auth', 'login', 'signin', 'signup', 'register', 'logout', 'oauth', 'sso',
  'dashboard', 'portal', 'account', 'accounts', 'my', 'me', 'user', 'users', 'secure', 'vpn', 'proxy', 'gateway',
  // api / app
  'api', 'app', 'apps', 'graphql', 'rest',
  // brand / roles
  'xdrive', 'shiftos', 'dealer', 'dealers', 'salesman', 'salesmen', 'manager', 'buyer', 'buyers', 'owner',
  // environments
  'staging', 'preview', 'prod', 'production', 'dev', 'test', 'demo', 'sandbox', 'beta', 'alpha',
  // content / commerce
  'blog', 'news', 'help', 'support', 'docs', 'status', 'about', 'contact', 'legal', 'terms', 'privacy',
  'billing', 'pay', 'payment', 'payments', 'checkout', 'invoice', 'store', 'shop', 'cart',
]);

export function isReservedSubdomain(sub) {
  return RESERVED_SUBDOMAINS.has(String(sub || '').trim().toLowerCase());
}
