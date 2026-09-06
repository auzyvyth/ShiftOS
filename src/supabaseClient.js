import { createClient, processLock } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lemdkdizdlcirhbzqlos.supabase.co";
// Exported so the service-worker push config (usePushNotifications.js) can hand
// the worker the same project URL + anon key the app uses. A worker cannot read
// Vite env vars, and a second copy of these values would be free to drift.
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbWRrZGl6ZGxjaXJoYnpxbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjY2MTUsImV4cCI6MjA4ODIwMjYxNX0.KhD0skeM_lgmWfq94nIISvRWzEGUmBc8BReTLdPKji4";

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
    // PKCE instead of the implicit flow. Implicit returns the access token in the
    // URL fragment, so it lands in history, referrers and any logger that records
    // a URL. PKCE returns a short-lived ?code= that is worthless without the
    // verifier this browser generated and kept in local storage, and it is the
    // only flow that survives a native WebView handoff -- which is what the
    // mobile app needs. Trade-off: the verifier is per-browser, so a password
    // reset must be opened in the SAME browser that requested it.
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

