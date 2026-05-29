/* eslint-env node */
// Public proxy: records a test-drive appointment + lead row.
// Rate-limited at the edge by middleware.js (3 req/IP/min).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carId, dealerId, assignedTo, name, phone, state, appointmentDate, notes, refSlug } =
    req.body || {};

  if (!carId || !dealerId || !name?.trim() || !phone?.trim() || !appointmentDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const phoneClean = String(phone).replace(/\D/g, '');
  if (phoneClean.length < 9 || phoneClean.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const dt = new Date(appointmentDate);
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  if (isNaN(dt.getTime()) || dt < todayUTC) {
    return res.status(400).json({ error: 'Invalid appointment date' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  );

  // Resolve salesman from refSlug if provided
  let salesmanId = assignedTo || null;
  if (refSlug) {
    const { data: sm } = await supabase
      .from('profiles')
      .select('id')
      .eq('slug', refSlug)
      .maybeSingle();
    if (sm?.id) salesmanId = sm.id;
  }

  const { error: bookErr } = await supabase.from('appointments').insert({
    dealer_id: dealerId,
    salesman_id: salesmanId,
    car_listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    buyer_phone: phoneClean,
    appointment_date: dt.toISOString(),
    notes: notes?.trim().substring(0, 500) || null,
    status: 'confirmed',
  });

  if (bookErr) {
    console.error('[api/booking]', bookErr.message);
    return res.status(500).json({ error: 'Booking failed. Please try again.' });
  }

  // Non-fatal: create lead for heatmap / CRM
  await supabase.from('leads').insert({
    dealer_id: dealerId,
    salesman_id: salesmanId,
    car_listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    phone: phoneClean,
    buyer_state: state || null,
    lead_source: 'enquiry',
    stage: 'new',
  });

  return res.status(200).json({ success: true });
}
