/* eslint-env node */
// Public proxy: returns the responsible seller's call number for ONE listing.
// Rate-limited at the edge by middleware.js (6 req/IP/min).
//
// Why this exists rather than shipping the number in the page payload: a number
// rendered or fetched on page load is scrapeable, and the broad profile RPCs
// (get_dealer_profile_by_id etc.) hand one out for any id, so a bot never even
// needs to load the page. This answers one listing at a time, behind a per-IP
// throttle, and only when a buyer actually taps Call.
//
// The resolution itself lives in the get_listing_call_number SECURITY DEFINER
// function: RLS blocks the anon role from reading profiles, so it cannot be done
// here. That function also refuses any listing the public cannot see.

import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../lib/cors.js';

const SUPABASE_URL = 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Never let a phone number sit in a shared or browser cache.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const { carId } = req.body || {};
  if (!carId) {
    return res.status(400).json({ error: 'Missing carId' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
  );

  const { data, error } = await supabase.rpc('get_listing_call_number', {
    p_listing_id: carId,
  });

  if (error) {
    console.error('[api/call-number]', error.message);
    return res.status(500).json({ error: 'Could not fetch number' });
  }

  // No number, listing not public, or seller inactive — all answer the same way
  // so this cannot be used to probe which listings or sellers exist.
  if (!data) {
    return res.status(404).json({ error: 'no_number' });
  }

  return res.status(200).json({ phone: data });
}
