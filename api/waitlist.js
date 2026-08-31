/* eslint-env node */
// Public proxy: handles waitlist signup with referral logic.
// Rate-limited at the edge by middleware.js (3 req/IP/5min).

import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, refCode } = req.body || {};

  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const phoneClean = String(phone).replace(/\D/g, '');
  if (phoneClean.length < 9 || phoneClean.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  );

  // Return existing signup if phone already registered.
  //
  // This runs as the ANON role and waitlist_signups has no anon SELECT policy
  // (the table holds names and phone numbers, and one would expose the whole
  // list). A plain .from().select() therefore returned null every time, so a
  // returning person got a NEW row and a NEW queue position on every submit.
  // waitlist_lookup is a SECURITY DEFINER RPC that answers for one phone and
  // returns only the two fields echoed back below.
  const { data: lookup, error: selectErr } = await supabase
    .rpc('waitlist_lookup', { p_phone: phoneClean });

  if (selectErr) {
    console.error('[api/waitlist] lookup error', selectErr.message);
    return res.status(500).json({ error: selectErr.message });
  }

  const existing = Array.isArray(lookup) ? lookup[0] : lookup;

  if (existing) {
    return res.status(200).json({
      position: existing.position,
      referral_code: existing.referral_code,
      isExisting: true,
    });
  }

  const code = nanoid(8);
  const { data: inserted, error: insertErr } = await supabase
    .from('waitlist_signups')
    .insert({
      name: name.trim().substring(0, 100),
      phone: phoneClean,
      referral_code: code,
      referred_by: refCode || null,
      founding_member: false,
    })
    .select('position, referral_code')
    .single();

  if (insertErr) {
    console.error('[api/waitlist] insert error', insertErr.message);
    return res.status(500).json({ error: insertErr.message });
  }

  // Grant founding member to the referrer on their first successful referral.
  // Same reason as above: the old read-then-update ran as anon, the read always
  // came back null, and so nobody had ever been granted the badge. The RPC takes
  // the referral CODE (not an id), checks the code has actually been used, and
  // is a no-op otherwise — so it cannot be aimed at an arbitrary row.
  if (refCode) {
    const { error: refErr } = await supabase
      .rpc('waitlist_credit_referrer', { p_ref_code: refCode });
    if (refErr) console.error('[api/waitlist] referral credit', refErr.message);
  }

  return res.status(200).json({
    position: inserted.position,
    referral_code: inserted.referral_code,
    isExisting: false,
  });
}
