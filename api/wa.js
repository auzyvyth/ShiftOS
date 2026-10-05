/* eslint-env node */
// Public redirect: /api/wa?car=<id>&slug=<rep>&seller=<id>&text=<msg>
// -> 302 to https://wa.me/<the right seller's number>?text=<msg>
// Rate-limited at the edge by middleware.js (per IP).
//
// CDP-3: a WhatsApp number in the page payload, or in an RPC that answers for
// any id, can be harvested in bulk without anyone loading a page. Every public
// WhatsApp button now links HERE instead of to wa.me, so the number is looked
// up once, server side, for the one car or seller the buyer tapped, and is
// never part of the page. Because it is a plain link the browser follows, it
// opens synchronously from the tap: no popup-blocker risk, unlike a fetch-then-
// window.open.
//
// The lookup is get_seller_whatsapp (SECURITY DEFINER): it refuses a car the
// public cannot see, and it resolves the rep through resolve_lead_salesman.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/i;

function page(res, status, title, body) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#F7F6F2;color:#111827;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box">
<div style="max-width:360px;text-align:center"><p style="font-size:17px;font-weight:700;margin:0 0 8px">${title}</p>
<p style="font-size:14px;color:#6b7280;line-height:1.5;margin:0 0 18px">${body}</p>
<a href="javascript:history.back()" style="color:#dc2626;font-weight:600;text-decoration:none">Go back</a></div></body></html>`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Never let a resolved number sit in a shared or browser cache.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const q = req.query || {};
  const car = UUID.test(String(q.car || '')) ? String(q.car) : null;
  const seller = UUID.test(String(q.seller || '')) ? String(q.seller) : null;
  const slug = SLUG.test(String(q.slug || '')) ? String(q.slug) : null;
  const text = String(q.text || '').slice(0, 1000);

  if (!car && !slug && !seller) {
    return page(res, 400, 'Link not complete', 'This WhatsApp link is missing who to message.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc('get_seller_whatsapp', {
    p_listing_id: car,
    p_slug: slug,
    p_seller_id: seller,
  });

  if (error) {
    console.error('[api/wa]', error.message);
    return page(res, 502, "Couldn't reach the seller", 'Please try again in a moment.');
  }

  let digits = String(data || '').replace(/\D/g, '');
  // Malaysian numbers are often stored in the local 01x form; wa.me needs 60.
  if (digits.startsWith('0')) digits = '6' + digits;
  if (digits.length < 9) {
    // No number, car not public, or seller inactive all read the same, so this
    // cannot be used to probe which cars or sellers exist.
    return page(res, 404, 'No WhatsApp number', "This seller hasn't added a WhatsApp number yet.");
  }

  res.setHeader('Location', `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
  return res.status(302).end();
}
