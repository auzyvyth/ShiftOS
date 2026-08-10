import { createClient, processLock } from "@supabase/supabase-js";

// ── Isolated superadmin ("management") auth client ────────────────────────────
// The /platform console is a management account that must be kept completely
// separate from every dealer / salesman / buyer session. The main `supabase`
// client (src/supabaseClient.js) persists its session under the default
// storageKey (`sb-<ref>-auth-token`). Because that key is shared across every
// tab on the origin, logging into a dealer/salesman/buyer account in a second
// tab overwrites it and the auth-state change propagates — which used to knock
// the superadmin out of /platform (it adopted the other account's session).
//
// This client uses its OWN storageKey, so the platform session lives in a
// dedicated localStorage slot that the main app never touches. Signing into any
// other account in another tab leaves the platform session intact, and vice
// versa. It is the same project/anon key — real access is still gated by RLS
// (superadmin-only policies) and the in-app role check; the separate store only
// isolates WHICH session the console runs as.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lemdkdizdlcirhbzqlos.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbWRrZGl6ZGxjaXJoYnpxbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjY2MTUsImV4cCI6MjA4ODIwMjYxNX0.KhD0skeM_lgmWfq94nIISvRWzEGUmBc8BReTLdPKji4";

export const platformClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The platform console is reached directly (its own login gate), never via a
    // magic-link/OAuth redirect that lands tokens in the URL — and we do NOT want
    // this client to swallow an auth callback meant for the main app.
    detectSessionInUrl: false,
    // Dedicated slot — the whole point of this client. Anything but the main
    // client's default key so the two sessions can coexist independently.
    storageKey: "sb-platform-auth",
    // Same rationale as the main client: processLock avoids the cross-tab
    // Web-Locks "steal" AbortError that breaks in-flight PostgREST calls.
    lock: processLock,
  },
});
