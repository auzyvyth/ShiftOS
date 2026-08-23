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
    .select('dealer_id, assigned_to')
    .eq('id', carId)
    .maybeSingle();

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  // Salesman attribution is resolved DB-side, never here. This handler runs as
  // the anon role, and RLS on profiles returns zero rows to anon — so the old
  // inline `profiles.eq('slug', refSlug)` lookup that used to sit here could
  // never match and silently did nothing. refSlug is forwarded raw instead:
  // create_lead_from_booking hands it to resolve_lead_salesman (the ONE resolver,
  // SECURITY DEFINER so it can actually read profiles), and the appointment row
  // is backfilled by the set_appointment_salesman trigger using the same helper.
  const salesmanId = assignedTo || listing.assigned_to || null;

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
  //
  // Solo-panel gate lives INSIDE create_lead_from_booking, not here: a Lite or
  // Premium booking must land in its Bookings tab as a pending appointment only
  // (lead_id null) and become a pipeline lead only when the salesman confirms it
  // (SalesmanLite/SalesmanPremium.autoUpsertLeadFromAppt). We cannot gate on plan
  // in this handler because it runs as the anon role and RLS on profiles blocks
  // the plan read, so the check silently never fires. The SECURITY DEFINER
  // function reads the owner's plan reliably and RETURNs NULL (no lead) for
  // salesman_lite/salesman_full; every other flow (dealer, linked salesman,
  // open pool) still gets the pre-created lead.
  let leadId = null;
  {
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

  // NOTE: this used to insert an analytics_events row with event_type 'booking'.
  // That write could never succeed and nothing read it: the analytics_insert_v2
  // RLS policy only accepts a fixed event_type list (which has no 'booking') and
  // requires a browser session_id, which a server handler does not have. The
  // error was never checked, so it failed silently. The record of a completed
  // booking is the appointments row above (read by the dealer Bookings tab);
  // booking INTENT is already tracked client-side as 'booking_click'.

  return res.status(200).json({ success: true });
}
