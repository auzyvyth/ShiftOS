/* eslint-env node */
// Link-preview picture for a dealer's storefront (<sub>.drevo.my), 1200x630 JPEG.
// Same build as api/agent-card.js: the dealer's own banner photo across the top
// (first hero slide, else their newest car), then a white strip with their logo,
// name, town, cars for sale and the site address. api/og.js and HomePage.jsx
// point og:image here through dealerShareImage() (src/utils/dealerShareImage.js).
//
// Never a phone number (the image is a public URL anyone can fetch, CDP-3).
// Takes a SUBDOMAIN, never an image URL: every photo is read from the dealer's
// own rows, so this cannot be used to fetch or re-host anything else.
import fs from 'node:fs';
import sharp from 'sharp';
import satori from 'satori';
import { chosenPageColor, PAGE_COLOR_DEFAULT } from '../../src/utils/pageAccent.js';
import { accentTheme } from '../../src/utils/liveAccent.js';
import { ROOT_DOMAIN } from '../../src/config/site.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sbHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

const W = 1200;
const H = 630;
const BANNER = 360;
const TILE = 168;     // logo tile
const TILE_X = 56;
const TILE_Y = BANNER - Math.round(TILE / 2);
const MAX_BYTES = 15 * 1024 * 1024;

const font = (f) => fs.readFileSync(new URL(`../_fonts/${f}`, import.meta.url));
// Small "Drevo" wordmark bottom right: the site lives on Drevo.
const MARK = fs.readFileSync(new URL('../../public/drevo-logo-dark.png', import.meta.url));
const MARK_W = 132, MARK_H = Math.round(132 * 120 / 688);

const FONTS = [
  { name: 'Outfit', data: font('outfit-latin-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'Outfit', data: font('outfit-latin-700-normal.woff'), weight: 700, style: 'normal' },
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

// The banner photo: the first photo hero slide whose linked car (if any) is not sold,
// the same rule as the site's banner (heroSlides.js), else the newest live car's first photo.
async function bannerPhoto(dealerId, cars) {
  const slides = await sb(`hero_carousel_slides?dealer_id=eq.${dealerId}&active=eq.true&select=image_url,mode,car_listing_id&order=sort_order.asc&limit=10`);
  const linked = [...new Set(slides.map((s) => s.car_listing_id).filter(Boolean))];
  const status = {};
  if (linked.length) (await sb(`public_car_listings?id=in.(${linked.join(',')})&select=id,status`)).forEach((c) => { status[c.id] = c.status; });
  const slide = slides.find((s) => s.image_url && s.mode !== 'text' && (!s.car_listing_id || status[s.car_listing_id] !== 'sold'));
  return slide?.image_url || cars.find((c) => Array.isArray(c.images) && c.images[0])?.images[0] || null;
}

const svg = (w, h, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`);

async function banner(photo, accent) {
  if (photo) {
    try {
      return await sharp(photo).rotate().resize(W, BANNER, { fit: 'cover', position: 'centre' }).png().toBuffer();
    } catch { /* unreadable photo: the colour band */ }
  }
  return sharp(svg(W, BANNER, `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="#0B0C0F"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>`)).png().toBuffer();
}

// White rounded tile with the logo fitted inside, or the dealer's first letter on their colour.
async function logoTile(logo, initial, accent) {
  const r = 28;
  const shadowed = svg(TILE + 40, TILE + 40, `<rect x="20" y="26" width="${TILE}" height="${TILE}" rx="${r}" fill="rgba(0,0,0,0.28)"/>`);
  const shadow = await sharp(shadowed).blur(10).png().toBuffer();
  let inner = null;
  if (logo) {
    try {
      const pad = 18;
      const fit = await sharp(logo).rotate().resize(TILE - pad * 2, TILE - pad * 2, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
      inner = await sharp(svg(TILE, TILE, `<rect width="${TILE}" height="${TILE}" rx="${r}" fill="#fff"/>`))
        .composite([{ input: fit, top: pad, left: pad }]).png().toBuffer();
    } catch { /* unreadable logo: the letter */ }
  }
  if (!inner) {
    const letter = await satori(
      { type: 'div', props: { style: { width: TILE, height: TILE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit', fontWeight: 700, fontSize: 92, color: '#fff' }, children: initial } },
      { width: TILE, height: TILE, fonts: FONTS },
    );
    inner = await sharp(svg(TILE, TILE, `<rect width="${TILE}" height="${TILE}" rx="${r}" fill="${accent}"/>`))
      .composite([{ input: Buffer.from(letter) }]).png().toBuffer();
  }
  return sharp(shadow).composite([{ input: inner, top: 20, left: 20 }]).png().toBuffer();
}

// Emoji and symbols have no glyph in these fonts; keep letters, digits, punctuation.
const plain = (v) => String(v ?? '').replace(/[^\p{L}\p{N}\p{P}\p{Zs}+&]/gu, '').replace(/\s+/g, ' ').trim();

function textLayer({ name, where, cars, verified, host, accent }) {
  const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const chip = (text, dark) => ({ type: 'div', props: { style: {
    display: 'flex', alignItems: 'center', height: 48, padding: '0 20px', marginRight: 12, borderRadius: 10,
    fontSize: 25, fontWeight: dark ? 700 : 500, background: dark ? '#0B0C0F' : '#F1F2F4', color: dark ? '#fff' : '#374151',
  }, children: text } });
  return { type: 'div', props: {
    style: { width: W, height: H, display: 'flex', flexDirection: 'column', fontFamily: 'Outfit' },
    children: [
      { type: 'div', props: { style: { height: BANNER, display: 'flex' } } },
      { type: 'div', props: {
        style: { display: 'flex', flexDirection: 'column', paddingLeft: TILE_X + TILE + 40, paddingRight: 56, paddingTop: 22 },
        children: [
          { type: 'div', props: { style: { ...oneLine, fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, color: '#0B0C0F' }, children: name } },
          { type: 'div', props: { style: { display: 'flex', alignItems: 'center', fontSize: 27, fontWeight: 500, color: '#5b616e', marginTop: 6 }, children: [
            { type: 'div', props: { style: { width: 12, height: 12, borderRadius: 6, background: accent, marginRight: 12 } } },
            { type: 'div', props: { style: oneLine, children: [host, where].filter(Boolean).join(' · ') } },
          ] } },
        ],
      } },
      { type: 'div', props: { style: { display: 'flex', overflow: 'hidden', height: 48, paddingLeft: TILE_X, paddingRight: 56, marginTop: 'auto', marginBottom: 40 }, children: [
        cars > 0 && chip(`${cars} car${cars === 1 ? '' : 's'} for sale`, true),
        verified && chip('Verified', false),
      ].filter(Boolean) } },
    ],
  } };
}

export default async function handler(req, res) {
  const sub = String(req.query?.sub || '').toLowerCase();
  if (!/^[a-z0-9-]{1,63}$/.test(sub)) return res.status(400).end();

  const [dealer] = await sb('rpc/get_dealer_profile_by_subdomain', { p_subdomain: sub });
  if (!dealer?.id) return res.status(404).end();

  try {
    const cars = await sb(`public_car_listings?dealer_id=eq.${dealer.id}&status=in.(available,reserved)&is_model_card=eq.false&select=id,images&order=created_at.desc&limit=200`);
    const accent = accentTheme(chosenPageColor(dealer) || PAGE_COLOR_DEFAULT).accent;
    const name = plain(dealer.site_name || dealer.dealership) || sub;
    const [photo, logo] = await Promise.all([
      bannerPhoto(dealer.id, cars).then(getImage),
      getImage(dealer.site_logo_url || dealer.logo_url),
    ]);
    const where = plain([dealer.city, dealer.state].filter(Boolean).join(', '));
    const [top, tile, words] = await Promise.all([
      banner(photo, accent),
      logoTile(logo, (name[0] || '?').toUpperCase(), accent),
      satori(textLayer({ name, where, cars: cars.length, verified: !!dealer.is_verified, host: `${sub}.${ROOT_DOMAIN}`, accent }), { width: W, height: H, fonts: FONTS }),
    ]);
    const out = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite([
        { input: top, top: 0, left: 0 },
        { input: Buffer.from(words), top: 0, left: 0 },
        { input: tile, top: TILE_Y - 20, left: TILE_X - 20 },
        { input: await sharp(MARK).resize(MARK_W, MARK_H).png().toBuffer(), top: H - 40 - 48 + Math.round((48 - MARK_H) / 2), left: W - 56 - MARK_W },
      ])
      .jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    // The URL carries a version of the profile fields drawn here (dealerShareImage);
    // the photo and car count can lag by up to a day.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).end(out);
  } catch {
    return res.redirect(302, '/og-marketplace.jpg');
  }
}
