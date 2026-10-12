import { supabase } from "../supabaseClient";
import { setLogoutNotice } from "../utils/authNotice";
import { isPlatformRole } from "../utils/platformOnly";

// Signing the platform admin account back OUT of the main client
// (why: src/utils/platformOnly.js). Scope LOCAL: only this browser's main
// session slot, never the console's own session (src/lib/platformClient.js).

/**
 * Drop a superadmin session from the MAIN client. The 'platform' notice tells
 * usePushHeal this is not a real sign-out, so it leaves the device's push
 * registration alone (the console may own it).
 */
export async function evictPlatformSession() {
  setLogoutNotice("platform");
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch { /* the local slot is cleared even when the network call fails */ }
}

/**
 * For sign-in pages: read this user's role on the main client and, if it is the
 * platform account, sign it back out. Returns true when it did (the caller shows
 * PLATFORM_ONLY_MESSAGE and stops). A failed read returns false and the page's
 * own profile read reports it.
 */
export async function refusePlatformAccount(userId) {
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!isPlatformRole(data?.role)) return false;
  await evictPlatformSession();
  return true;
}
