// Auto-post TEST rig (ZERNIO-1, 2026-11-12): asks the edge function `zernio-post` whether
// THIS login may post to the owner's social accounts, and which are connected. Everyone
// else gets { allowed: false } and the "Post to socials" menu item never appears.
// Runs once per tab session per user (10-minute copy in sessionStorage); no DB writes.
// A failure of any kind means "not allowed": the button simply stays hidden.
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

// A "yes" is kept 10 minutes; a "no" only 30 seconds, so adding the secret on the server shows up
// on the next refresh instead of ten minutes later (2026-11-12: a cached "no" hid the button).
const TTL_YES = 10 * 60 * 1000;
const TTL_NO = 30 * 1000;
const key = (uid) => `xd_zp_access_${uid}`;
const NO = { allowed: false, accounts: [] };

function readCached(uid) {
  try {
    const raw = sessionStorage.getItem(key(uid));
    if (!raw) return null;
    const { v, at } = JSON.parse(raw);
    return Date.now() - at < (v?.allowed ? TTL_YES : TTL_NO) ? v : null;
  } catch { return null; }
}

const SERVER_ERRORS = {
  not_connected: 'That account is not connected in Zernio.',
  car_not_live: 'Only a live (Available) car can be posted.',
  car_not_found: 'That car was not found on your account.',
  needs_photo: 'Instagram needs at least one photo.',
  link_missing: 'The text must keep this car\'s link.',
  foreign_link: 'Only drevo.my links are allowed in a post.',
  forbidden: 'This login is not allowed to post.',
  not_configured: 'The Zernio key is not set on the server yet.',
  network: 'Could not reach the server. Try again.',
  unknown_action: 'The server does not know this action. Redeploy the function.',
  publish_unconfirmed: 'Zernio did not confirm the post. Check the Recent tab before trying again.',
  daily_limit: 'You have reached today\'s limit of 10 posts. Try again tomorrow.',
  already_posted: 'This car is already posted there in the last 24 hours. Take that post down first (Recent tab) if you want to post it again.',
  post_not_found: 'That post is not on your account, or it is older than 30 days.',
  not_published: 'That post is not live on this network, so there is nothing to take down.',
  not_a_draft: 'Only a draft can be deleted here.',
};
export const explain = (e) => (e?.message && e.error === 'text_rejected') ? e.message
  : (e?.error === 'zernio_failed' ? `Zernio said no${e.message ? `: ${e.message}` : ` (${e.status || 'error'})`}.` : SERVER_ERRORS[e?.error] || 'Something went wrong. Nothing was posted.');

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
