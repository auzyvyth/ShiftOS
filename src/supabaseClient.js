import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lemdkdizdlcirhbzqlos.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbWRrZGl6ZGxjaXJoYnpxbG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjY2MTUsImV4cCI6MjA4ODIwMjYxNX0.KhD0skeM_lgmWfq94nIISvRWzEGUmBc8BReTLdPKji4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

