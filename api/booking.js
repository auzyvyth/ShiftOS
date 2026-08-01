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

  // Free Salesman Lite tier: a booking must land in the Bookings tab as a PENDING
  // request only — the pipeline lead is created when the salesman confirms and has
  // contacted the buyer (SalesmanLite.autoUpsertLeadFromAppt), not up front. So for
  // a Lite-owned car we skip the pre-created lead and leave the appointment
  // unlinked (lead_id null). Every other flow (dealer, linked salesman, unassigned
  // open pool) keeps the pre-created lead so the open-pool claim still grabs the
  // lead + its viewing slot together via claim_lead. Gate on the OWNING salesman's
  // plan so it holds whether the booking came in via ?ref= or a plain listing view.
  let skipLead = false;
  if (salesmanId) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', salesmanId)
      .maybeSingle();
    if (owner?.plan === 'salesman_lite') skipLead = true;
  }

  const cleanNotes = notes?.trim().substring(0, 500) || null;
  const notesWithIntent = intentLabel
    ? `Intent: ${intentLabel}${cleanNotes ? ` — ${cleanNotes}` : ''}`.substring(0, 560)
    : cleanNotes;

  // Create the pipeline lead FIRST so the appointment can link back to it via
  // lead_id. A linked lead means an aimless (unassigned) booking that lands in
  // the open pool is claimed WHOLE — the lead and its actual viewing slot —
  // when a rep taps claim (claim_lead grabs both). Non-fatal: a lead failure
  // must not block the booking itself. Stage 'viewing_booked' labels it as a
  // buyer who wants to view (not a generic "new" enquiry).
  // Skipped for Lite (see skipLead above) — Lite creates the lead only on confirm.
  let leadId = null;
  if (!skipLead) {
    const { data: leadResult, error: leadErr } = await supabase.rpc('create_lead_from_booking', {
      p_dealer_id: listing.dealer_id,
      p_car_id: carId,
      p_name: name.trim().substring(0, 100),
      p_phone: phoneClean,
      p_state: state || null,
      p_ref_slug: refSlug || null,
      p_notes: notesWithIntent,
      p_assigned_to: salesmanId,
    });
    if (leadErr) {
      console.error('[api/booking] lead:', leadErr.message);
    } else {
      leadId = leadResult || null;
    }
  }
  // The booking arrives as 'pending' — the seller must approve it before the
  // slot is real. This is the commitment gate: a window-shopper tap no longer
  // silently books a confirmed viewing; the seller confirms genuine buyers.
  const { error: bookErr } = await supabase.from('appointments').insert({
    dealer_id: listing.dealer_id,
    salesman_id: salesmanId,
    lead_id: leadId,
    car_listing_id: carId,
    buyer_name: name.trim().substring(0, 100),
    buyer_phone: phoneClean,
    buyer_state: state || null,
    appointment_date: dt.toISOString(),
    booking_type: 'viewing',
    notes: notesWithIntent,
    status: 'pending',
  });

  if (bookErr) {
    console.error('[api/booking]', bookErr.message);
    return res.status(500).json({ error: 'Booking failed. Please try again.' });
  }

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
