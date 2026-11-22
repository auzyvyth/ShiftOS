/* eslint-env node */
// One photo of a car, made ready for Drevo's own social posts (SOCIAL-1, owner
// 2026-11-22: "watermark every post"). 1080x1350 JPEG (4:5, fills a phone on
// TikTok and Facebook): the photo, uncropped, over a blurred dark copy of itself,
// with the Drevo wordmark on every slide. The FIRST slide (cover=1) also carries
// the car's name, price and specs, because a TikTok photo post is silent and has
// no clickable link: the cover is what stops the scroll and the "drevo.my" line
// is the only way to the car.
//
// zernio-post builds these URLs; Zernio downloads them. Takes a car SLUG + photo
// number, never an image URL, so it cannot fetch or re-host anything else. Live,
// public cars only (public_car_listings). Only numbers on the car row (year,
// price, mileage). Never a phone number (CDP-3: this is a public URL).
import fs from 'node:fs';
import sharp from 'sharp';
import satori from 'satori';
import { carTitle, money } from '../../supabase/functions/_shared/postCaption.js';
import { ROOT_DOMAIN } from '../../src/config/site.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sbHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

export const W = 1080;
export const H = 1350;
const LOGO_W = 230;                      // drevo-logo-white.png is 688x120
const LOGO_H = Math.round(LOGO_W * 120 / 688);
const MAX_BYTES = 15 * 1024 * 1024;
const PUBLIC_PHOTO = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/car-images\//;

const read = (p) => fs.readFileSync(new URL(p, import.meta.url));
const LOGO = read('../../public/drevo-logo-white.png');
const FONTS = [
  { name: 'Outfit', data: read('../_fonts/outfit-latin-500-normal.woff'), weight: 500, style: 'normal' },
  { name: 'Outfit', data: read('../_fonts/outfit-latin-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Bebas', data: read('../_fonts/bebas-neue-latin-400-normal.woff'), weight: 400, style: 'normal' },
];

const h = (type, style, ...children) => ({ type, props: { style, children: children.length > 1 ? children : children[0] } });

function km(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? `${Math.round(v).toLocaleString('en-US')} km` : '';
}

// The words on top of the photo (transparent everywhere else).
export function overlay(car, { cover }) {
  const shade = { position: 'absolute', left: 0, right: 0, display: 'flex' };
  const top = h('div', { ...shade, top: 0, height: 220, backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))' }, '');
  const site = h('div', {
    position: 'absolute', right: 48, top: 54, display: 'flex',
    fontFamily: 'Outfit', fontWeight: 700, fontSize: 30, color: '#fff', letterSpacing: 0.5,
  }, ROOT_DOMAIN);
  if (!cover) {
    return h('div', { width: W, height: H, display: 'flex', position: 'relative' }, top, site);
  }
  const condition = { used: 'Used', recon: 'Recon', new: 'New' }[String(car.condition || '').toLowerCase()] || '';
  const specs = [km(car.mileage), car.transmission, car.state || car.city].filter(Boolean).join('  ·  ');
  const price = money(car.selling_price);
  const bottom = h('div', {
    ...shade, bottom: 0, height: 560, flexDirection: 'column', justifyContent: 'flex-end',
    padding: '0 56px 64px', backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.92) 45%, rgba(0,0,0,0))',
  },
    condition
      ? h('div', { display: 'flex', marginBottom: 18 },
        h('div', { display: 'flex', background: '#dc2626', color: '#fff', fontFamily: 'Outfit', fontWeight: 700, fontSize: 28, padding: '8px 22px', borderRadius: 999 }, condition))
      : h('div', { display: 'flex' }, ''),
    h('div', { display: 'flex', fontFamily: 'Outfit', fontWeight: 700, fontSize: 58, lineHeight: 1.1, color: '#fff' }, carTitle(car)),
    price
      ? h('div', { display: 'flex', fontFamily: 'Bebas', fontSize: 150, lineHeight: 1, color: '#fff', marginTop: 10 }, price)
      : h('div', { display: 'flex' }, ''),
    specs
      ? h('div', { display: 'flex', fontFamily: 'Outfit', fontWeight: 500, fontSize: 34, color: 'rgba(255,255,255,0.82)', marginTop: 12 }, specs)
      : h('div', { display: 'flex' }, ''),
    h('div', { display: 'flex', marginTop: 34, fontFamily: 'Outfit', fontWeight: 700, fontSize: 34, color: '#fff' },
      `More photos + the seller on ${ROOT_DOMAIN}`),
  );
  return h('div', { width: W, height: H, display: 'flex', position: 'relative' }, top, site, bottom);
}

// photo buffer + car row -> finished JPEG
export async function composePostPhoto(photo, car, { cover }) {
  // Flatten see-through cut-outs onto the studio grey first (ALPHA-1).
  const flat = await sharp(photo).rotate().flatten({ background: '#e5e7eb' }).toBuffer();
  const bg = await sharp(flat).resize(W, H, { fit: 'cover' }).blur(40).modulate({ brightness: 0.55 }).toBuffer();
  const fitted = await sharp(flat).resize(W, H, { fit: 'inside', withoutEnlargement: false }).toBuffer();
  const meta = await sharp(fitted).metadata();
  // On the cover the photo sits higher, so the words below cover less of the car.
  const room = cover ? H - 420 : H;
  const top = Math.max(0, Math.round((room - meta.height) / 2));
  const words = await satori(overlay(car, { cover }), { width: W, height: H, fonts: FONTS });
  const logo = await sharp(LOGO).resize(LOGO_W, LOGO_H).png().toBuffer();
  return sharp(bg)
    .composite([
      { input: fitted, top: Math.min(top, H - meta.height), left: Math.round((W - meta.width) / 2) },
      { input: Buffer.from(words), top: 0, left: 0 },
      { input: logo, top: 48, left: 48 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

async function getCar(slug) {
  const cols = 'slug,images,year,brand,model,variant,selling_price,mileage,state,city,transmission,condition';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/public_car_listings?slug=eq.${encodeURIComponent(slug)}&status=eq.available&is_model_card=eq.false&select=${cols}&limit=1`,
      { headers: sbHeaders, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function getImage(url) {
  if (!PUBLIC_PHOTO.test(url || '')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length && buf.length <= MAX_BYTES ? buf : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const slug = String(req.query?.car || '');
  const i = Number(req.query?.i);
  if (!/^[a-z0-9-]{1,120}$/i.test(slug) || !Number.isInteger(i) || i < 0 || i > 19) {
    res.status(400).send('bad request');
    return;
  }
  const car = await getCar(slug);
  const url = Array.isArray(car?.images) ? car.images[i] : null;
  const photo = url ? await getImage(url) : null;
  if (!photo) {
    res.status(404).send('not found');
    return;
  }
  try {
    const out = await composePostPhoto(photo, car, { cover: req.query?.cover === '1' });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).send(out);
  } catch (e) {
    console.error('post-photo failed', e?.message);
    res.status(500).send('error');
  }
}
