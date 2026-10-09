/* eslint-env node */
// POST /api/track — the ONE way an analytics event gets written (ANALYTICS-SPOOF).
// Rate-limited per IP at the edge by middleware.js.
//
// The browser used to insert into analytics_events itself, rate-limited only on
// a session_id it made up, so a script could pour fake views and WhatsApp taps
// onto any seller. Now:
//   - the row is shape-checked by cleanEvent (lib/analyticsEvent.js)
//   - dealer_id is read from the CAR when there is one, never trusted
//     (a car id that does not exist is dropped along with its name)
//   - a dealer_id with no car must be a real account, or it is dropped
//   - the per-session cap (analytics_rate_limit_ok) still applies on top
// Migration 20261009a drops the anon INSERT policy once this is live.
// Always answers 204: analytics must never break or slow a page.

import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../lib/cors.js';
import { cleanEvent } from '../lib/analyticsEvent.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lemdkdizdlcirhbzqlos.supabase.co';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const row = cleanEvent(body);
  if (!row || !key) {
    if (!key) console.error('[api/track] SUPABASE_SERVICE_ROLE_KEY not set');
    return res.status(204).end();
  }

  try {
    const db = createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: ok } = await db.rpc('analytics_rate_limit_ok', { p_session_id: row.session_id });
    if (ok !== true) return res.status(204).end();

    if (row.car_id) {
      // The dealer is the car's dealer. car_listings, not the public view: a
      // sold car's page still gets visits and they still belong to its seller.
      const { data: car } = await db.from('car_listings')
        .select('dealer_id').eq('id', row.car_id).maybeSingle();
      if (car) row.dealer_id = car.dealer_id;
      else { row.car_id = null; row.car_name = null; row.dealer_id = null; }
    } else if (row.dealer_id) {
      const { data: acct } = await db.from('profiles')
        .select('id').eq('id', row.dealer_id).maybeSingle();
      if (!acct) row.dealer_id = null;
    }

    const { error } = await db.from('analytics_events').insert(row);
    if (error) console.error('[api/track]', error.message);
  } catch (e) {
    console.error('[api/track]', e?.message || e);
  }
  return res.status(204).end();
}
