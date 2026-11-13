// Calls to the `zernio-post` edge function (Drevo's own social pages, SOCIAL-1). The console passes
// `platformClient`: the owner's superadmin login lives in that isolated session, and the function only
// answers a superadmin. Anything else gets { error: 'forbidden' }.
import { supabase } from '../../supabaseClient';

const SERVER_ERRORS = {
  not_connected: 'That account is not connected in Zernio.',
  car_not_live: 'Only a live (Available) car can be posted.',
  car_not_found: 'That car was not found.',
  no_consent: 'This seller has not agreed to have this car posted on Drevo\'s pages.',
  needs_photo: 'TikTok needs at least one photo.',
  tiktok_options_failed: 'Could not read your TikTok account\'s options. Try again in a moment.',
  tiktok_cannot_post: 'TikTok says this account cannot post more right now. Try again later.',
  tiktok_consent: 'Tick the TikTok box that confirms you previewed the post and agree to publish it.',
  tiktok_privacy: 'Pick who can see the TikTok post.',
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

// Turns an edge-function failure into { data, err }. `client` = the Supabase client to call as.
export async function callZernioPost(body, client = supabase) {
  const { data, error } = await client.functions.invoke('zernio-post', { body });
  if (!error) return { data, err: data?.error ? data : null };
  // functions.invoke puts a non-2xx body on error.context; read the code out of it.
  let j = null;
  try { j = await error.context.json(); } catch { /* not json */ }
  return { data: null, err: j || { error: 'network' } };
}
