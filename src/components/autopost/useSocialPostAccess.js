// Auto-post TEST rig (ZERNIO-1, 2026-11-12): asks the edge function `zernio-post` whether
// THIS login may post to the owner's social accounts, and which are connected. Everyone
// else gets { allowed: false } and the "Post to socials" menu item never appears.
// Runs once per tab session per user (10-minute copy in sessionStorage); no DB writes.
// A failure of any kind means "not allowed": the button simply stays hidden.
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const TTL = 10 * 60 * 1000;
const key = (uid) => `xd_zp_access_${uid}`;
const NO = { allowed: false, accounts: [] };

function readCached(uid) {
  try {
    const raw = sessionStorage.getItem(key(uid));
    if (!raw) return null;
    const { v, at } = JSON.parse(raw);
    return Date.now() - at < TTL ? v : null;
  } catch { return null; }
}

// Shared by the sheet: turns an edge-function failure into one plain sentence.
export async function callZernioPost(body) {
  const { data, error } = await supabase.functions.invoke('zernio-post', { body });
  if (!error) return { data, err: data?.error ? data : null };
  // functions.invoke puts a non-2xx body on error.context; read the code out of it.
  let j = null;
  try { j = await error.context.json(); } catch { /* not json */ }
  return { data: null, err: j || { error: 'network' } };
}

export function useSocialPostAccess(userId) {
  const [s, setS] = useState(() => (userId && readCached(userId)) || NO);
  useEffect(() => {
    if (!userId) return undefined;
    const cached = readCached(userId);
    if (cached) { setS(cached); return undefined; }
    let dead = false;
    callZernioPost({ action: 'status' }).then(({ data, err }) => {
      if (dead) return;
      const v = !err && data?.allowed ? { allowed: true, accounts: data.accounts || [] } : NO;
      setS(v);
      try { sessionStorage.setItem(key(userId), JSON.stringify({ v, at: Date.now() })); } catch { /* private mode */ }
    }).catch(() => { if (!dead) setS(NO); });
    return () => { dead = true; };
  }, [userId]);
  return s;
}
