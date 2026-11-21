// ONE standing answer per seller to "may Drevo feature my cars on its Facebook Page + TikTok?" (SOCIAL-1,
// owner 2026-11-22: "once only, not per car"). Kept in profiles.starter_tasks.social_all ('yes' | 'no'), no
// migration. A "yes" covers every car the seller has now and every one they publish later; the per-car
// column the console queue reads (car_listings.social_consent) is still written, through the same
// set_listing_social_consent function, so the database rules do not change. A "no" is final too: it is
// never asked again, and the seller can still change it any time by messaging us.
import { supabase } from '../../supabaseClient';

const KEY = 'social_all';

export async function readStanding(userId) {
  const { data } = await supabase.from('profiles').select('starter_tasks').eq('id', userId).maybeSingle();
  const v = data?.starter_tasks?.[KEY];
  return v === 'yes' || v === 'no' ? v : null;
}

export async function saveStanding(userId, value) {
  const { data } = await supabase.from('profiles').select('starter_tasks').eq('id', userId).maybeSingle();
  const next = { ...(data?.starter_tasks || {}), [KEY]: value };
  const { error } = await supabase.from('profiles').update({ starter_tasks: next }).eq('id', userId);
  return !error;
}

// Writes the answer on each car through the database function. Returns how many failed.
// A missing function (migration not applied) reports 'missing' so the caller closes quietly.
export async function setConsentFor(ids, yes) {
  let failed = 0;
  for (const id of ids) {
    const { error } = await supabase.rpc('set_listing_social_consent', { p_listing: id, p_consent: yes });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') return 'missing';
      failed++;
    }
  }
  return failed;
}

// Every car of the seller's that has never been asked about (own, not a new-car card, not archived).
export async function unansweredCarIds(userId) {
  const { data } = await supabase.from('car_listings').select('id')
    .eq('dealer_id', userId).is('social_consent', null).is('new_car_model_id', null).neq('status', 'archived').limit(1000);
  return (data || []).map((r) => r.id);
}
