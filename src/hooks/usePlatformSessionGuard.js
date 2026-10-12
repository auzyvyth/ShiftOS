import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { isPlatformRole, PLATFORM_ONLY_MESSAGE } from '../utils/platformOnly';
import { evictPlatformSession } from '../lib/platformEvict';

/*
 * Mounted once in App.jsx. The main client must never hold the platform admin
 * account (see utils/platformOnly.js). The sign-in pages refuse it up front;
 * this is the net under them: a Google / magic-link / reset route, a path
 * added later, or a superadmin session saved on this device before the split.
 *
 * One role read per signed-in user per tab, then remembered in sessionStorage:
 * a role cannot become superadmin from the client, so a user that passed once
 * passes for the rest of the tab.
 *
 * The auth callback only SCHEDULES the check and returns nothing. supabase-js
 * awaits that callback while holding the auth lock, and a callback that awaits
 * a query deadlocks the tab (CLAUDE.md, 2026-10-12).
 */
const OK_KEY = 'xd_main_role_ok';

function alreadyOk(uid) {
  try { return sessionStorage.getItem(OK_KEY) === uid; } catch { return false; }
}
function markOk(uid) {
  try { sessionStorage.setItem(OK_KEY, uid); } catch { /* private mode */ }
}

export function usePlatformSessionGuard() {
  useEffect(() => {
    let cancelled = false;

    const check = async (user) => {
      if (cancelled || !user?.id || user.is_anonymous || alreadyOk(user.id)) return;
      const { data, error } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (cancelled || error) return; // a failed read is not a verdict; next load retries
      if (!isPlatformRole(data?.role)) { markOk(user.id); return; }
      await evictPlatformSession();
      toast(PLATFORM_ONLY_MESSAGE);
    };

    supabase.auth.getSession().then(({ data }) => check(data?.session?.user));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setTimeout(() => { check(session?.user); }, 0);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);
}

export default usePlatformSessionGuard;
