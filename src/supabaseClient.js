import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'REDACTED_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global handler for stale/invalid refresh tokens.
// When a TOKEN_REFRESHED event fires with no session it means the refresh
// token has been revoked or expired. Sign the user out cleanly and redirect
// to /login so they don't get stuck in a broken auth loop.
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }
});