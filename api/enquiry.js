/* eslint-env node */
// Public proxy: records a WhatsApp enquiry + lead row.
// Rate-limited at the edge by middleware.js (5 req/IP/min).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carId, name, phone, state, refSlug } = req.body || {};

  if (!carId || !name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const phoneClean = String(phone).replace(/\D/g, '');
  if (phoneClean.length < 9 || phoneClean.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  const { data: listing } = await supabase
    .from('car_listings')
    .select('dealer_id, assigned_to')
    .eq('id', carId)
    .single();

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const { error: enqErr } = await supabase.from('whatsapp_enquiries').insert({
    dealer_id: listing.dealer_id,
    salesman_id: listing.assigned_to || null,
    listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    buyer_phone: phoneClean,
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

  // Non-fatal: create lead for heatmap / CRM
  await supabase.from('leads').insert({
    dealer_id: listing.dealer_id,
    salesman_id: listing.assigned_to || null,
    car_listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    phone: phoneClean,
    buyer_state: state || null,
    lead_source: 'whatsapp',
    stage: 'new',
  });

  return res.status(200).json({ success: true });
}
