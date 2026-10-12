// ── The platform admin account never signs in on the main client ─────────────
// Plain version: the /platform console has its own login and its own saved
// session (src/lib/platformClient.js). The superadmin account must only ever
// live THERE. If it also signs in through the marketplace / seller sign-in, it
// takes the main session slot, and that slot is the one every seller panel, the
// marketplace header and /login use. Owner, 2026-10-12: the admin login was
// "detected" on the marketplace sign-in, /login jumped straight to the admin's
// 2FA screen, and the salesman account could not be signed into at all.
//
// So every main-client sign-in path checks the role and, for a superadmin,
// signs that main session out again (src/lib/platformEvict.js) and says where
// admin signs in instead. `usePlatformSessionGuard` (App.jsx) catches anything
// that slips past a page, including a superadmin session saved before this.
//
// This file has no imports on purpose: authErrors and postAuthRoute read it,
// and postAuthRoute is unit-tested in plain node.

export const PLATFORM_ROLE = "superadmin";

export const PLATFORM_ONLY_MESSAGE =
  "That's the platform admin account. It only signs in at /platform, so you can stay signed in here as a seller at the same time.";

export function isPlatformRole(role) {
  return role === PLATFORM_ROLE;
}
