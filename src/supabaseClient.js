import { createClient, processLock } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lemdkdizdlcirhbzqlos.supabase.co";
// Exported so the service-worker push config (usePushNotifications.js) can hand
// the worker the same project URL + anon key the app uses. A worker cannot read
// Vite env vars, and a second copy of these values would be free to drift.
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbWRrZGl6ZGxjaXJoYnpxbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjY2MTUsImV4cCI6MjA4ODIwMjYxNX0.KhD0skeM_lgmWfq94nIISvRWzEGUmBc8BReTLdPKji4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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

