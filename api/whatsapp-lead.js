/* eslint-env node */
// Public proxy: creates a pipeline lead from a WhatsApp-contact tap (ContactGate).
// Replaces the old direct anon `create_lead_from_whatsapp` RPC call from the
// browser so the write now passes through two real gates it never had before:
//   1. Per-IP rate limit (middleware.js — 'rl:walead').
//   2. Cloudflare Turnstile proof-of-human (verifyTurnstile below).
// The buyer has already been sent to WhatsApp by ContactGate BEFORE this call, so
// a rejection here only skips the CRM record — it never blocks the actual chat.
//
// SEC-10 (migration 20261021a): create_lead_from_whatsapp now runs for the
// server key only. While the public key could call it, both gates above were
// optional: a script called the RPC straight from /rest/v1.

import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile, clientIp } from '../lib/turnstile.js';
import { applyCors } from '../lib/cors.js';
import { normalizePhone, isValidMyPhone } from '../src/lib/phone.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lemdkdizdlcirhbzqlos.supabase.co';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dealerId, carId, name, phone, state, refSlug, token, variantId, colour } = req.body || {};
  // NEWCAR-PICK: the variant + colour the buyer picked on a new-car model page. Shape-checked
  // here; the database checks they belong to the car (create_lead_from_whatsapp).
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pickVariant = UUID.test(String(variantId || '')) ? String(variantId) : null;
  const pickColour = pickVariant && colour ? String(colour).trim().slice(0, 40) || null : null;

  const nm = String(name || '').trim();
  if ((!dealerId && !carId) || !nm) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Proof-of-human. Fails open only when TURNSTILE_SECRET is unset (pre-setup).
  const check = await verifyTurnstile(token, clientIp(req));
  if (!check.ok) {
    return res.status(403).json({ error: 'captcha_failed', reason: check.reason });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[api/whatsapp-lead] SUPABASE_SERVICE_ROLE_KEY not set');
    return res.status(200).json({ success: false, softError: 'not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  if (!realDealerId) return res.status(400).json({ error: 'Missing required fields' });

  const args = {
    p_dealer_id: realDealerId,
    p_car_id: carId || null,
    p_name: nm.substring(0, 100),
    // Optional: a number that cannot be real is dropped (the buyer is on WhatsApp
    // anyway), never a reason to lose the lead.
    p_phone: phone && isValidMyPhone(phone) ? normalizePhone(phone) : null,
    p_ref_slug: refSlug || null,
    p_state: state ? String(state).substring(0, 40) : null,
  };
  let { data, error } = await supabase.rpc('create_lead_from_whatsapp',
    pickVariant ? { ...args, p_variant_id: pickVariant, p_colour: pickColour } : args);
  // Before migration 20261122b the function has no pick parameters: make the lead without them.
  if (error && pickVariant && /p_variant_id|does not exist|PGRST202/i.test(`${error.code} ${error.message}`)) {
    ({ data, error } = await supabase.rpc('create_lead_from_whatsapp', args));
  }

  if (error) {
    // rate_limited (DB flood cap) and other RPC errors are non-fatal to the UX —
    // the chat is already open. Log and return a soft failure.
    console.error('[api/whatsapp-lead]', error.message);
    return res.status(200).json({ success: false, softError: error.message });
  }

  return res.status(200).json({ success: true, leadId: data || null });
}
