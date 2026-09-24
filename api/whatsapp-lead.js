/* eslint-env node */
// Public proxy: creates a pipeline lead from a WhatsApp-contact tap (ContactGate).
// Replaces the old direct anon `create_lead_from_whatsapp` RPC call from the
// browser so the write now passes through two real gates it never had before:
//   1. Per-IP rate limit (middleware.js — 'rl:walead').
//   2. Cloudflare Turnstile proof-of-human (verifyTurnstile below).
// The buyer has already been sent to WhatsApp by ContactGate BEFORE this call, so
// a rejection here only skips the CRM record — it never blocks the actual chat.

import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile, clientIp } from '../lib/turnstile.js';
import { applyCors } from '../lib/cors.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dealerId, carId, name, phone, state, refSlug, token } = req.body || {};

  const nm = String(name || '').trim();
  if (!dealerId || !nm) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Proof-of-human. Fails open only when TURNSTILE_SECRET is unset (pre-setup).
  const check = await verifyTurnstile(token, clientIp(req));
  if (!check.ok) {
    return res.status(403).json({ error: 'captcha_failed', reason: check.reason });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Trust the car listing over caller-supplied dealerId when a car is in play
  // (stops a bot from aiming leads at a competitor's pipeline). Fall back to the
  // supplied dealerId for context-less contacts (hero/sticky buttons, no car).
  let realDealerId = dealerId;
  if (carId) {
    const { data: listing } = await supabase
      .from('public_car_listings')
      .select('dealer_id')
      .eq('id', carId)
      .maybeSingle();
    if (listing?.dealer_id) realDealerId = listing.dealer_id;
  }

  const { data, error } = await supabase.rpc('create_lead_from_whatsapp', {
    p_dealer_id: realDealerId,
    p_car_id: carId || null,
    p_name: nm.substring(0, 100),
    p_phone: phone ? String(phone).substring(0, 30) : null,
    p_ref_slug: refSlug || null,
    p_state: state ? String(state).substring(0, 40) : null,
  });

  if (error) {
    // rate_limited (DB flood cap) and other RPC errors are non-fatal to the UX —
    // the chat is already open. Log and return a soft failure.
    console.error('[api/whatsapp-lead]', error.message);
    return res.status(200).json({ success: false, softError: error.message });
  }

  return res.status(200).json({ success: true, leadId: data || null });
}
