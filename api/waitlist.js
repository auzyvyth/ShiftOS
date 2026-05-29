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

  // Return existing signup if phone already registered
  const { data: existing, error: selectErr } = await supabase
    .from('waitlist_signups')
    .select('position, referral_code')
    .eq('phone', phoneClean)
    .maybeSingle();

  if (selectErr) {
    console.error('[api/waitlist] select error', selectErr.message);
    return res.status(500).json({ error: selectErr.message });
  }

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

  // Grant founding member to referrer on their first successful referral
  if (refCode) {
    const { data: referrer } = await supabase
      .from('waitlist_signups')
      .select('id, founding_member')
      .eq('referral_code', refCode)
      .maybeSingle();

    if (referrer && !referrer.founding_member) {
      const { count } = await supabase
        .from('waitlist_signups')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', refCode);
      if (count >= 1) {
        await supabase
          .from('waitlist_signups')
          .update({ founding_member: true })
          .eq('id', referrer.id);
      }
    }
  }

  return res.status(200).json({
    position: inserted.position,
    referral_code: inserted.referral_code,
    isExisting: false,
  });
}
