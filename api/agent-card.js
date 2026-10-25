/* eslint-env node */
// Link-preview picture for an agent page (/s/:slug): their cover photo with
// their profile photo on it, 1200x630 JPEG. api/og.js points og:image
// here, so a link shared on WhatsApp / Facebook shows the agent's face as well
// as their banner. URL: agentShareImage() in src/utils/agentSeo.js.
//
// Takes a SLUG, never an image URL: the photos are read from the agent's own
// profile, so this cannot be used to fetch or re-host anything else.
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const W = 1200;
const H = 630;
const AV = 300;   // profile photo diameter
const RING = 10;  // white ring around it
const MAX_BYTES = 15 * 1024 * 1024;

async function getAgent(slug) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_salesman_by_slug`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (Array.isArray(data) ? data[0] : data) || null;
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

// No cover: the same sky-to-sand gradient the page paints (SalesmanProfilePage .ap-cover).
const FALLBACK_BG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.45">
    <stop offset="0" stop-color="#DCE8F2"/><stop offset="0.45" stop-color="#EEF0EA"/><stop offset="1" stop-color="#F6E3CF"/>
  </linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);

// Returns { bg, avatarY }: the background PNG and where the photo's centre sits.
// A normal photo fills the frame, face in the middle. A thin banner (most agent
// covers are ~4:1) is laid out like the page: the sharp banner across the top,
// a blurred copy filling the rest, the face overlapping the banner's bottom edge.
// Zooming a banner to fill 1200x630 cut off whatever it says (the brand name).
async function background(cover) {
  if (cover) {
    try {
      const img = sharp(cover).rotate();
      const { width, height } = await img.metadata();
      const dim = (o) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000" fill-opacity="${o}"/></svg>`);
      const ratio = width && height ? width / height : W / H;
      if (ratio <= 2.2) {
        // Dimmed a touch so the white ring around the face stands out.
        const bg = await sharp(cover).rotate().resize(W, H, { fit: 'cover' })
          .composite([{ input: dim(0.18) }]).png().toBuffer();
        return { bg, avatarY: H / 2 };
      }
      const bannerH = Math.round(W / ratio);
      const banner = await sharp(cover).rotate().resize(W, bannerH, { fit: 'cover' }).png().toBuffer();
      const bg = await sharp(cover).rotate().resize(W, H, { fit: 'cover' }).blur(28)
        .composite([{ input: dim(0.35) }, { input: banner, top: 0, left: 0 }]).png().toBuffer();
      return { bg, avatarY: bannerH + (AV + RING * 2) * 0.3 };
    } catch { /* unreadable cover: fall through to the gradient */ }
  }
  return { bg: await sharp(FALLBACK_BG).png().toBuffer(), avatarY: H / 2 };
}

async function avatarDisc(avatar) {
  const D = AV + RING * 2;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${AV}" height="${AV}"><circle cx="${AV / 2}" cy="${AV / 2}" r="${AV / 2}"/></svg>`);
  const face = await sharp(avatar).rotate().resize(AV, AV, { fit: 'cover', position: 'attention' })
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const ring = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="#fff"/></svg>`);
  return sharp(ring).composite([{ input: face, top: RING, left: RING }]).png().toBuffer();
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug || '');
  if (!/^[a-z0-9._-]{1,64}$/i.test(slug)) return res.status(400).end();

  let agent = null;
  try { agent = await getAgent(slug); } catch { /* treated as not found */ }
  if (!agent) return res.status(404).end();

  const [cover, avatar] = await Promise.all([getImage(agent.cover_url), getImage(agent.avatar_url)]);
  if (!cover && !avatar) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.redirect(302, '/og-default.jpg');
  }

  try {
    const { bg, avatarY } = await background(cover);
    const layers = [];
    if (avatar) {
      try {
        const disc = await avatarDisc(avatar);
        const D = AV + RING * 2;
        const top = Math.min(Math.max(Math.round(avatarY - D / 2), 24), H - D - 24);
        layers.push({ input: disc, top, left: Math.round((W - D) / 2) });
      } catch { /* unreadable avatar: the cover alone */ }
    }
    const out = await sharp(bg).composite(layers)
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    // The URL carries a version of both photos (agentShareImage), so a long cache is safe.
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    return res.status(200).end(out);
  } catch {
    return res.redirect(302, agent.cover_url || agent.avatar_url);
  }
}
