/* eslint-env node */
// Public proxy: records a WhatsApp enquiry + lead row.
// Rate-limited at the edge by middleware.js (5 req/IP/min).
//
// Writes with the SERVER key (SEC-10): the public key may only insert a
// nameless "tapped WhatsApp" row (migration 20261021a), so a named enquiry,
// which becomes a lead, can only come through here, after Turnstile. The
// server key skips RLS, so the checks the old public insert policy made
// (active seller, per-seller cap) are made here instead.

import { createClient } from '@supabase/supabase-js';
import { verifyTurnstile, clientIp } from '../lib/turnstile.js';
import { applyCors } from '../lib/cors.js';
import { normalizePhone, isValidMyPhone } from '../src/lib/phone.js';
import { checkTradeIn, tradeInNote } from '../src/utils/tradeIn.js';
import { checkLoanEnquiry, loanEnquiryNote, toLoanCar } from '../src/utils/loanEnquiry.js';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { carId, name, phone, state, refSlug, token, kind, subdomain, tradeIn, loan } = req.body || {};
  // A trade-in from a dealer's own site has no car: the dealer comes from the
  // subdomain, the phone is required (the dealer must call back with an offer).
  const isTradeIn = kind === 'trade_in';
  const trade = isTradeIn ? checkTradeIn(tradeIn) : null;
  if (isTradeIn) {
    if (!subdomain || typeof subdomain !== 'string' || !name?.trim() || !phone || !trade.ok) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
  }
  // "Check my loan" from a dealer's own site: the dealer comes from the subdomain,
  // the car is optional (and must be that dealer's), the note is built here from
  // the checked answers (src/utils/loanEnquiry.js), never from browser text.
  const isLoan = kind === 'loan_check';
  const loanCheck = isLoan ? checkLoanEnquiry(loan) : null;
  if (isLoan) {
    if (!subdomain || typeof subdomain !== 'string' || !name?.trim() || !phone || !loanCheck.ok) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
  }
  const fromStorefront = isTradeIn || isLoan;

  // Phone is OPTIONAL (the car-detail modal labels it so). Name is the only hard
  // requirement — the buyer has already been sent to WhatsApp, where the seller
  // gets their number from the chat. Requiring phone here silently 400'd every
  // name-only enquiry, so those leads never reached the pipeline.
  if (!fromStorefront && (!carId || !name?.trim())) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Proof-of-human. Fails open only when TURNSTILE_SECRET is unset (pre-setup).
  const check = await verifyTurnstile(token, clientIp(req));
  if (!check.ok) {
    return res.status(403).json({ error: 'captcha_failed', reason: check.reason });
  }

  // Validate phone only when one is supplied; a blank phone is allowed through.
  // One Malaysian-number rule for every box and route: src/lib/phone.js.
  const phoneClean = phone ? normalizePhone(phone) : '';
  if (phoneClean && !isValidMyPhone(phoneClean)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[api/enquiry] SUPABASE_SERVICE_ROLE_KEY not set');
    return res.status(500).json({ error: 'Failed to record enquiry' });
  }
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Read via public_car_listings: the base car_listings table is NOT anon-readable
  // (public reads go through this view), so an anon .from('car_listings') returns
  // no row -> a false 404 that silently dropped every enquiry after the base table
  // was locked down. api/booking.js already reads the view for the same reason.
  let listing = null;
  let loanCar = null;
  if (fromStorefront) {
    // Same lookup the storefront itself makes (HomePage.jsx).
    const { data: dealerId } = await supabase.rpc('get_dealer_id_by_subdomain', { p_subdomain: subdomain.toLowerCase().slice(0, 63) });
    if (dealerId) listing = { dealer_id: dealerId, assigned_to: null };
    if (dealerId && isLoan && typeof carId === 'string' && carId) {
      const { data: car } = await supabase
        .from('public_car_listings')
        .select('id, dealer_id, assigned_to, year, brand, model, variant, condition, selling_price, is_model_card')
        .eq('id', carId)
        .maybeSingle();
      // Another dealer's car is ignored, never attached to this dealer's lead.
      loanCar = car && car.dealer_id === dealerId ? toLoanCar(car) : null;
      if (loanCar) listing.assigned_to = car.assigned_to || null;
    }
  } else {
    ({ data: listing } = await supabase
      .from('public_car_listings')
      .select('dealer_id, assigned_to')
      .eq('id', carId)
      .maybeSingle());
  }

  if (!listing) {
    return res.status(404).json({ error: fromStorefront ? 'Dealer not found' : 'Listing not found' });
  }

  const [{ data: active }, { data: underCap }] = await Promise.all([
    supabase.rpc('is_dealer_active', { p_dealer_id: listing.dealer_id }),
    supabase.rpc('whatsapp_enquiry_rate_ok', { p_session_id: null, p_dealer_id: listing.dealer_id }),
  ]);
  if (active !== true || underCap !== true) {
    // Same answer the policy's rejection used to give.
    return res.status(500).json({ error: 'Failed to record enquiry' });
  }

  // Salesman attribution is resolved DB-side, never here. (This handler used to
  // run as the anon role, where RLS on profiles returns zero rows, so the inline
  // `profiles.eq('slug', refSlug)` lookup that used to sit here could never
  // match.) ref_slug is stored on the enquiry row below and the enquiry_to_lead
  // trigger resolves it through resolve_lead_salesman (the ONE resolver), which
  // is SECURITY DEFINER and can read profiles.
  const salesmanId = listing.assigned_to || null;

  const enquiryNote = isTradeIn ? tradeInNote(trade.car)
    : isLoan ? loanEnquiryNote(loanCheck.answers, loanCar)
    : `Enquiry about listing`;
  const { data: enqRow, error: enqErr } = await supabase.from('whatsapp_enquiries').insert({
    dealer_id: listing.dealer_id,
    salesman_id: salesmanId,
    listing_id: isTradeIn ? null : isLoan ? loanCar?.id || null : carId,
    buyer_name: name.trim().substring(0, 100),
    buyer_phone: phoneClean || null,
    buyer_state: state || null,
    // The trigger enquiry_to_lead copies this onto the lead as its note.
    buyer_message: enquiryNote,
    ref_slug: fromStorefront ? null : refSlug || null,
    source: isTradeIn ? 'trade_in' : isLoan ? 'loan_check' : 'storefront',
    status: 'new',
  }).select('id').single();

  if (enqErr) {
    console.error('[api/enquiry]', enqErr.message);
    return res.status(500).json({ error: 'Failed to record enquiry' });
  }

  // enquiry_to_lead attaches a repeat buyer (same phone) to their EXISTING lead and
  // drops the new note, so a loan check or trade-in from someone already in the
  // pipeline reached nobody (2026-11-21: it landed on a July lead marked won). Append
  // the note to that lead, and bring a lost one back to New so it shows on the board.
  // Best effort: the enquiry is already saved, so a failure here never fails the buyer.
  if (fromStorefront && enqRow?.id) {
    try {
      const { data: enq } = await supabase.from('whatsapp_enquiries').select('lead_id').eq('id', enqRow.id).maybeSingle();
      if (enq?.lead_id) {
        const { data: lead } = await supabase.from('leads').select('id, notes, stage').eq('id', enq.lead_id).maybeSingle();
        if (lead && !(lead.notes || '').includes(enquiryNote)) {
          const stamp = new Date().toISOString().slice(0, 10);
          const patch = { notes: `${lead.notes ? `${lead.notes}\n\n` : ''}[${stamp}] ${enquiryNote}`.slice(0, 4000) };
          if (lead.stage === 'lost' || lead.stage === 'closed_lost') patch.stage = 'new';
          await supabase.from('leads').update(patch).eq('id', lead.id);
        }
      }
    } catch (e) {
      console.error('[api/enquiry] note append failed:', e?.message);
    }
  }

  // The lead is created DB-side by the enquiry_to_lead trigger on
  // whatsapp_enquiries (dedups by phone + resolves the salesman). Do NOT insert a
  // lead here too — that produced a duplicate lead per enquiry.

  return res.status(200).json({ success: true });
}
