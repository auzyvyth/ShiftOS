/* eslint-env node */
// Public proxy: records a WhatsApp enquiry + lead row.
// Rate-limited at the edge by middleware.js (5 req/IP/min).

import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile, clientIp } from '../lib/turnstile.js';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carId, name, phone, state, refSlug, token } = req.body || {};

  // Phone is OPTIONAL (the car-detail modal labels it so). Name is the only hard
  // requirement — the buyer has already been sent to WhatsApp, where the seller
  // gets their number from the chat. Requiring phone here silently 400'd every
  // name-only enquiry, so those leads never reached the pipeline.
  if (!carId || !name?.trim()) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Proof-of-human. Fails open only when TURNSTILE_SECRET is unset (pre-setup).
  const check = await verifyTurnstile(token, clientIp(req));
  if (!check.ok) {
    return res.status(403).json({ error: 'captcha_failed', reason: check.reason });
  }

  // Validate phone only when one is supplied; a blank phone is allowed through.
  const phoneClean = phone ? String(phone).replace(/\D/g, '') : '';
  if (phoneClean && (phoneClean.length < 9 || phoneClean.length > 15)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  );

  // Read via public_car_listings: the base car_listings table is NOT anon-readable
  // (public reads go through this view), so an anon .from('car_listings') returns
  // no row -> a false 404 that silently dropped every enquiry after the base table
  // was locked down. api/booking.js already reads the view for the same reason.
  const { data: listing } = await supabase
    .from('public_car_listings')
    .select('dealer_id, assigned_to')
    .eq('id', carId)
    .maybeSingle();

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  // Resolve salesman from refSlug (mirrors api/booking.js behaviour)
  let salesmanId = listing.assigned_to || null;
  if (refSlug) {
    const { data: sm } = await supabase
      .from('profiles')
      .select('id')
      .eq('slug', refSlug)
      .maybeSingle();
    if (sm?.id) salesmanId = sm.id;
  }

  const { error: enqErr } = await supabase.from('whatsapp_enquiries').insert({
    dealer_id: listing.dealer_id,
    salesman_id: salesmanId,
    listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    buyer_phone: phoneClean || null,
    buyer_state: state || null,
    buyer_message: `Enquiry about listing`,
    ref_slug: refSlug || null,
    source: 'storefront',
    status: 'new',
  });

  if (enqErr) {
    console.error('[api/enquiry]', enqErr.message);
    return res.status(500).json({ error: 'Failed to record enquiry' });
  }

  // The lead is created DB-side by the enquiry_to_lead trigger on
  // whatsapp_enquiries (dedups by phone + resolves the salesman). Do NOT insert a
  // lead here too — that produced a duplicate lead per enquiry.

  return res.status(200).json({ success: true });
}
