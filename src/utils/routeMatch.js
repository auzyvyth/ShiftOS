// Boundary-aware pathname prefix matching.
//
// A naive `pathname.startsWith(prefix)` is wrong for route gating: '/accounts'
// would be caught by the '/account' prefix, and '/salesman-lite' by '/salesman'.
// Matching on an exact hit OR a '<prefix>/' boundary keeps sibling routes that
// merely share a string prefix from colliding.
//
// Shared by ConsentBanner (suppress on internal paths) and InstallPrompt (show
// only on authenticated app paths). The two keep separate prefix LISTS on
// purpose — they gate different surfaces — but the matching rule is one thing
// and lives here so it can't drift between them.
export function matchesPathPrefix(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
