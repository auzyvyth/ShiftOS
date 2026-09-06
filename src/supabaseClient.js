import { createClient, processLock } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lemdkdizdlcirhbzqlos.supabase.co";
// Exported so the service-worker push config (usePushNotifications.js) can hand
// the worker the same project URL + anon key the app uses. A worker cannot read
// Vite env vars, and a second copy of these values would be free to drift.
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbWRrZGl6ZGxjaXJoYnpxbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjY2MTUsImV4cCI6MjA4ODIwMjYxNX0.KhD0skeM_lgmWfq94nIISvRWzEGUmBc8BReTLdPKji4";

// A second, stateless client used for ONE thing: sending password-reset mail.
//
// PKCE keeps half of its secret in the local storage of the browser that STARTED
// the reset. On Android most people open the email in GMAIL'S IN-APP BROWSER,
// which is a different browser with none of that storage -- the code cannot be
// exchanged and the reset dies with "link expired". That is the normal way mail
// gets opened here, not an edge case, so recovery mail stays on the implicit
// flow, whose links work in any browser.
//
// It is stateless on purpose -- persistSession/autoRefreshToken/detectSessionInUrl
// all off, and its own storageKey -- so it can never read, write or race the real
// session the main client owns. It shares processLock for the same reason the main
// client does (see the note there). resetPasswordForEmail needs no session, so a
// stateless client is all it takes.
//
// If a password-reset link ever needs to be PKCE too, the answer is to send it
// from an edge function via generateLink (invites/ and create-salesman/ already
// do), NOT to point this back at the main client.
export const supabaseAuthLinks = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "implicit",
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "sb-xdrive-authlinks",
    lock: processLock,
  },
});

// The URL this tab was opened with, captured BEFORE createClient exists.
// detectSessionInUrl deletes the auth payload (the #access_token... hash, or the
// ?code= query) from the address bar as soon as it has consumed it, via
// history.replaceState. Any component that reads window.location later is racing
// that cleanup and may find the URL already scrubbed -- which is how a page can
// end up unable to tell an emailed link from an ordinary visit.
export const INITIAL_URL = typeof window !== "undefined" ? window.location.href : "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE instead of the implicit flow. Implicit hands the access token back in
    // the URL fragment, so it lands in history, referrers and anything that logs
    // a URL. PKCE hands back a short-lived ?code= that is worthless without the
    // verifier this browser generated and kept -- and it is the only flow that
    // survives a native WebView handoff, which is what the mobile app needs.
    // Password reset is EXEMPT -- see supabaseAuthLinks below.
    flowType: 'pkce',
    // Use the in-memory lock instead of the browser Web Locks API. The default
    // navigatorLock serializes every auth call (getSession runs before every
    // PostgREST query) across tabs and, on timeout, retries with { steal: true },
    // which breaks the current holder and throws
    //   "AbortError: Lock broken by another request with the 'steal' option".
    // That rejection propagates into data fetches (e.g. the marketplace car grid),
    // so listings/images fail to load. processLock still serializes auth calls
    // within a tab but avoids the cross-tab steal, eliminating the AbortError.
    lock: processLock,
  },
});

