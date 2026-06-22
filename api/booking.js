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

  const { carId, dealerId, assignedTo, name, phone, state, appointmentDate, bookingType, notes, refSlug } =
    req.body || {};

  // Buying-intent qualifier (window-shopper triage). Keep in sync with
  // BUYING_INTENT in CarDetailPage.jsx.
  const INTENT_LABELS = {
    ready: "Ready to buy now",
    two_weeks: "Buying within 2 weeks",
    one_month: "Buying within a month",
    browsing: "Just exploring",
  };
  const intentLabel = INTENT_LABELS[bookingType] || null;

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Verify the listing exists and get its real dealer_id from the DB
  // (never trust caller-supplied dealerId — prevents fake bookings on competitor dealers).
  // Read via public_car_listings: the base car_listings table is not anon-readable
  // (public reads go through this view), so anon must look it up here.
  const { data: listing } = await supabase
    .from('public_car_listings')
    .select('dealer_id, assigned_to, brand, model, year')
    .eq('id', carId)
    .maybeSingle();

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  // Resolve salesman from refSlug if provided, else fall back to listing's assigned_to
  let salesmanId = assignedTo || listing.assigned_to || null;
  if (refSlug) {
    const { data: sm } = await supabase
      .from('profiles')
      .select('id')
      .eq('slug', refSlug)
      .maybeSingle();
    if (sm?.id) salesmanId = sm.id;
  }

  const cleanNotes = notes?.trim().substring(0, 500) || null;
  const notesWithIntent = intentLabel
    ? `Intent: ${intentLabel}${cleanNotes ? ` — ${cleanNotes}` : ''}`.substring(0, 560)
    : cleanNotes;

  const { error: bookErr } = await supabase.from('appointments').insert({
    dealer_id: listing.dealer_id,
    salesman_id: salesmanId,
    car_listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    buyer_phone: phoneClean,
    appointment_date: dt.toISOString(),
    booking_type: 'viewing',
    notes: notesWithIntent,
    status: 'confirmed',
  });

  if (bookErr) {
    console.error('[api/booking]', bookErr.message);
    return res.status(500).json({ error: 'Booking failed. Please try again.' });
  }

  // Non-fatal: create lead for heatmap / CRM. A completed viewing booking lands
  // straight in the 'viewing_booked' pipeline stage so it's clearly labelled as
  // a buyer who wants to view the car (not a generic "new" enquiry).
  await supabase.from('leads').insert({
    dealer_id: listing.dealer_id,
    salesman_id: salesmanId,
    car_listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    phone: phoneClean,
    buyer_state: state || null,
    lead_source: 'enquiry',
    stage: 'viewing_booked',
    notes: notesWithIntent,
  });

  // Non-fatal: record a completed-booking analytics event so it shows in the
  // dealer's Listing Performance chart (booking_click only tracks button clicks).
  const carName = [listing.year, listing.brand, listing.model].filter(Boolean).join(' ') || null;
  await supabase.from('analytics_events').insert({
    event_type: 'booking',
    dealer_id: listing.dealer_id,
    car_id: carId,
    car_name: carName,
    metadata: { source: 'car_detail', booking_type: bookingType || null },
  });

  return res.status(200).json({ success: true });
}
