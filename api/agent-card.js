/* eslint-env node */
// Link-preview picture for an agent page (/s/:slug), 1200x630 JPEG, the same
// size for every agent: their cover as a banner across the top, then a white
// card like the page's: profile photo, role, name, town, and chips for the cars
// on the page, "Verified" and their specialisations. api/og.js points og:image
// here; the URL comes from agentShareImage() in src/utils/agentSeo.js.
//
// Never the phone number or the bio (owner, 2026-10-25): the number would put
// the seller's contact on a public URL anyone can fetch (CDP-3), and the bio is
// already the text WhatsApp prints under the picture.
//
// Takes a SLUG, never an image URL: the photos are read from the agent's own
// profile, so this cannot be used to fetch or re-host anything else.
// Photos: sharp. Text: satori (draws the words as shapes from the font files in
// api/_fonts, so the server needs no fonts installed).
import fs from 'node:fs';
import sharp from 'sharp';
import satori from 'satori';
import { agentName, agentLocation } from '../src/utils/agentSeo.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sbHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

const W = 1200;
const H = 630;
const BANNER = 340;   // cover height
const AV = 210;       // profile photo diameter
const RING = 8;       // white ring around it
const D = AV + RING * 2;
const AV_X = 56;
const AV_Y = BANNER - Math.round(D / 2);
const MAX_BYTES = 15 * 1024 * 1024;

const font = (f) => fs.readFileSync(new URL(`./_fonts/${f}`, import.meta.url));
const FONTS = [
  { name: 'Outfit', data: font('outfit-latin-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'Outfit', data: font('outfit-latin-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Bebas', data: font('bebas-neue-latin-400-normal.woff'), weight: 400, style: 'normal' },
];

async function sb(path, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, body
      ? { method: 'POST', headers: { ...sbHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) }
      : { headers: sbHeaders, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data ? [data] : [];
  } catch {
    return [];
  }
}

// Cars on the page: the same three sources as api/og.js getSalesmanCars.
async function carCount(id) {
  const live = 'status=in.(available,reserved)';
  const [owned, assigned, featured] = await Promise.all([
    sb(`public_car_listings?dealer_id=eq.${id}&${live}&is_model_card=eq.false&select=id`),
    sb(`public_car_listings?assigned_to=eq.${id}&${live}&is_model_card=eq.false&select=id`),
    sb('rpc/get_salesman_featured_listings', { p_salesman_id: id }),
  ]);
  const ids = new Set([...owned, ...assigned].map((c) => c.id));
  featured.filter((c) => ['available', 'reserved'].includes(c?.status)).forEach((c) => ids.add(c.id));
  return ids.size;
}

async function getImage(url) {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length && buf.length <= MAX_BYTES ? buf : null;
  } catch {
    return null;
  }
}

const svg = (w, h, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`);
// No cover: the same sky-to-sand gradient the page paints (SalesmanProfilePage .ap-cover).
const FALLBACK_BANNER = svg(W, BANNER, `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.45">
  <stop offset="0" stop-color="#DCE8F2"/><stop offset="0.45" stop-color="#EEF0EA"/><stop offset="1" stop-color="#F6E3CF"/>
  </linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`);

async function banner(cover) {
  if (cover) {
    try {
      return await sharp(cover).rotate().resize(W, BANNER, { fit: 'cover', position: 'attention' }).png().toBuffer();
    } catch { /* unreadable cover: the gradient */ }
  }
  return sharp(FALLBACK_BANNER).png().toBuffer();
}

async function avatarDisc(avatar, initial) {
  const ring = svg(D, D, `<circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#fff"/>`);
  let face = null;
  if (avatar) {
    try {
      const mask = svg(AV, AV, `<circle cx="${AV / 2}" cy="${AV / 2}" r="${AV / 2}"/>`);
      face = await sharp(avatar).rotate().resize(AV, AV, { fit: 'cover', position: 'attention' })
        .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    } catch { /* unreadable photo: the initial */ }
  }
  if (!face) {
    face = svg(AV, AV, `<circle cx="${AV / 2}" cy="${AV / 2}" r="${AV / 2}" fill="#111827"/>`);
    face = await sharp(face).png().toBuffer();
    const letter = await satori(
      { type: 'div', props: { style: { width: AV, height: AV, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas', fontSize: 120, color: '#fff' }, children: initial } },
      { width: AV, height: AV, fonts: FONTS },
    );
    face = await sharp(face).composite([{ input: Buffer.from(letter) }]).png().toBuffer();
  }
  return sharp(ring).composite([{ input: face, top: RING, left: RING }]).png().toBuffer();
}

// Emoji and symbols have no glyph in these fonts; keep letters, digits, punctuation.
const plain = (v) => String(v ?? '').replace(/[^\p{L}\p{N}\p{P}\p{Zs}+&]/gu, '').replace(/\s+/g, ' ').trim();

const chip = (text, dark) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex', alignItems: 'center', height: 50, padding: '0 22px', marginRight: 12, marginBottom: 12,
      borderRadius: 10, fontSize: 26, fontWeight: dark ? 700 : 500,
      background: dark ? '#111827' : '#F0EEE8', color: dark ? '#fff' : '#374151',
      border: dark ? 'none' : '1px solid #E2DED5',
    },
    children: text,
  },
});

function textLayer(agent, cars) {
  const role = plain(agent.job_title) || 'Car agent';
  const where = plain(agentLocation(agent));
  const chips = [
    cars > 0 && chip(`${cars} car${cars === 1 ? '' : 's'} for sale`, true),
    agent.is_verified && chip('Verified', true),
    ...(Array.isArray(agent.specializations) ? agent.specializations : []).map(plain).filter(Boolean).slice(0, 6).map((t) => chip(t, false)),
  ].filter(Boolean);
  const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return {
    type: 'div',
    props: {
      style: { width: W, height: H, display: 'flex', flexDirection: 'column', fontFamily: 'Outfit' },
      children: [
        { type: 'div', props: { style: { height: BANNER, display: 'flex' } } },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', paddingLeft: AV_X + D + 36, paddingRight: 56, paddingTop: 22 },
            children: [
              { type: 'div', props: { style: { display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 700, letterSpacing: 4, color: '#6b7280', textTransform: 'uppercase' },
                children: [{ type: 'div', props: { style: { width: 32, height: 4, background: '#dc2626', marginRight: 14 } } }, { type: 'div', props: { style: oneLine, children: role } }] } },
              { type: 'div', props: { style: { ...oneLine, fontFamily: 'Bebas', fontSize: 84, lineHeight: 1, color: '#111827', marginTop: 8 }, children: plain(agentName(agent)) } },
              where && { type: 'div', props: { style: { ...oneLine, fontSize: 30, fontWeight: 500, color: '#4b5563', marginTop: 4 }, children: where } },
            ].filter(Boolean),
          },
        },
        // Chips: one row; anything that does not fit is dropped rather than squeezed.
        { type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', overflow: 'hidden', height: 50, paddingLeft: AV_X, paddingRight: 56, marginTop: 22 }, children: chips } },
      ],
    },
  };
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug || '');
  if (!/^[a-z0-9._-]{1,64}$/i.test(slug)) return res.status(400).end();

  const [agent] = await sb('rpc/get_salesman_by_slug', { p_slug: slug });
  if (!agent) return res.status(404).end();

  try {
    const [cover, avatar, cars] = await Promise.all([getImage(agent.cover_url), getImage(agent.avatar_url), carCount(agent.id)]);
    const name = plain(agentName(agent));
    const [top, disc, words] = await Promise.all([
      banner(cover),
      avatarDisc(avatar, (name[0] || '?').toUpperCase()),
      satori(textLayer(agent, cars), { width: W, height: H, fonts: FONTS }),
    ]);
    const out = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite([
        { input: top, top: 0, left: 0 },
        { input: Buffer.from(words), top: 0, left: 0 },
        { input: disc, top: AV_Y, left: AV_X },
      ])
      .jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    // The URL carries a version of everything drawn here (agentShareImage), so a
    // long cache is safe; the car count can lag by up to a day.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).end(out);
  } catch {
    return res.redirect(302, agent.cover_url || agent.avatar_url || '/og-default.jpg');
  }
}
