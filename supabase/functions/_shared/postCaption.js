// Caption adjuster for auto-post (ZERNIO-1, 2026-11-12). ONE pure file, no imports:
// the app (preview in the Post sheet) and the edge function `zernio-post` (final check
// before anything is sent) both import it, so the rules cannot drift apart.
// Tests: `npm run test:postcaption`.
//
// What it does: turns one car's facts into the text each network can actually take.
//   - Threads: 500 characters, link counts. The description is clipped, then optional pieces drop.
//   - TikTok photo post: title max 90 chars with NO link/hashtag (Zernio strips them),
//     description max 4000. No clickable link anywhere, so it says "link in bio".
//   - Instagram: a link in a caption is not clickable, so "link in bio" too.
//   - Facebook Page: long text and a clickable link.
// Never cut: the year + model, the price, the link (or "link in bio"). If even that does not
// fit, `fits` is false and the sheet refuses to send. Never a phone number (CDP-3) and never
// a number that is not on the car row (price, year, mileage only).
//
// Zernio itself does NOT check these lengths when a post is scheduled (tested 2026-11-12:
// 501 characters accepted for Threads), so this file is the only guard.

export const LIMITS = {
  threads: 500,
  facebook: 5000, // Facebook allows far more; a car post this long is not read
  instagram: 2200,
  tiktok: 4000, // the description; the title has its own cap below
};
export const TIKTOK_TITLE_MAX = 90;
export const BIO_LINE = 'All my cars: link in bio';
export const PLATFORMS = ['facebook', 'threads', 'instagram', 'tiktok'];

const len = (s) => Array.from(String(s || '')).length; // characters, not UTF-16 units

export function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  return 'RM' + Math.round(v).toLocaleString('en-US');
}

function km(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  return Math.round(v).toLocaleString('en-US') + ' km';
}

// "2023 Land Rover Defender 90". The variant is dropped when it only repeats the model.
export function carTitle(car, { variant = true } = {}) {
  const model = String(car.model || '').trim();
  let v = variant ? String(car.variant || '').trim() : '';
  if (v && model && v.toLowerCase().includes(model.toLowerCase())) v = '';
  return [car.year, car.brand, model, v].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// Cut free text at a word boundary and end it with "..." (never mid-number).
export function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (max <= 0) return '';
  if (len(t) <= max) return t;
  if (max <= 3) return '';
  const chars = Array.from(t).slice(0, max - 3).join('');
  const cut = chars.replace(/\s+\S*$/, '');
  const base = cut.length >= Math.floor(max / 3) ? cut : chars;
  return base.replace(/[\s,.;:-]+$/, '') + '...';
}

// Each platform is a list of pieces. `must` pieces are never dropped; the rest are dropped
// from the LAST in `dropOrder` first until the text fits. `desc` is clipped, not dropped,
// before anything else goes.
function layout(platform, car, url, credit = '') {
  const title = carTitle(car);
  const price = money(car.selling_price ?? car.price);
  const specs = [km(car.mileage), car.state || car.city || ''].filter(Boolean).join(' · ');
  const extra = [car.transmission, car.fuel_type].filter(Boolean).join(' · ');
  const desc = car.description || '';
  const headline = price ? `${title}\n${price}` : title;
  const cta = platform === 'facebook' || platform === 'threads' ? url : BIO_LINE;
  const ctaLabel = platform === 'facebook' ? 'Photos and details: ' : '';
  // Drevo's own pages post a seller's car: the seller is credited by name (moral rights, and honest
  // about who is advertising). Empty for a seller posting their own car.
  const creditLine = credit ? `Listed on Drevo by ${credit}` : '';

  if (platform === 'threads') {
    return {
      pieces: [
        { key: 'headline', text: headline, must: true },
        { key: 'specs', text: specs },
        { key: 'extra', text: extra },
        { key: 'desc', text: desc, clip: true },
        { key: 'credit', text: creditLine, must: true },
        { key: 'cta', text: cta, must: true },
      ],
      dropOrder: ['desc', 'extra', 'specs'], joiner: '\n\n', descKey: 'desc',
    };
  }
  if (platform === 'facebook') {
    return {
      pieces: [
        { key: 'headline', text: headline, must: true },
        { key: 'specs', text: [specs, extra].filter(Boolean).join(' · ') },
        { key: 'desc', text: desc, clip: true },
        { key: 'credit', text: creditLine, must: true },
        { key: 'cta', text: ctaLabel + cta, must: true },
      ],
      dropOrder: ['desc', 'specs'], joiner: '\n\n', descKey: 'desc',
    };
  }
  // instagram + tiktok description
  return {
    pieces: [
      { key: 'headline', text: headline, must: true },
      { key: 'specs', text: [specs, extra].filter(Boolean).join(' · ') },
      { key: 'desc', text: desc, clip: true },
      { key: 'credit', text: creditLine, must: true },
      { key: 'cta', text: cta, must: true },
    ],
    dropOrder: ['desc', 'specs'], joiner: '\n\n', descKey: 'desc',
  };
}

function join(pieces, joiner) {
  return pieces.filter((p) => p.text).map((p) => p.text).join(joiner);
}

function fit(platform, car, url, limit, credit = '') {
  const { pieces, dropOrder, joiner } = layout(platform, car, url, credit);
  const dropped = [];
  let cur = pieces.map((p) => ({ ...p }));
  // 1. clip the free-text description to what is left
  const desc = cur.find((p) => p.clip && p.text);
  if (desc) {
    const without = join(cur.map((p) => (p === desc ? { ...p, text: '' } : p)), joiner);
    const room = limit - len(without) - len(joiner);
    desc.text = clip(desc.text, Math.min(room, 600));
    if (!desc.text) dropped.push('desc');
  }
  // 2. drop optional pieces in order until it fits
  for (const key of dropOrder) {
    if (len(join(cur, joiner)) <= limit) break;
    const p = cur.find((x) => x.key === key);
    if (p && p.text) { p.text = ''; if (!dropped.includes(key)) dropped.push(key); }
  }
  const text = join(cur, joiner);
  return { text, dropped, fits: len(text) <= limit };
}

// Build the post for one platform. `url` is the full car link (with its ?src= and ?ref=).
// `credit` = the seller's name when Drevo's own page posts their car (empty when a seller posts their own).
export function buildPost(platform, car, url, { credit = '' } = {}) {
  const warnings = [];
  const price = money(car.selling_price ?? car.price);
  if (!price) warnings.push('no_price');
  if (!car.model) warnings.push('no_model');

  if (platform === 'tiktok') {
    // Title: no links, no hashtags, 90 chars. Drop the variant, then the brand, never the price.
    const cands = [
      [carTitle(car), price],
      [carTitle(car, { variant: false }), price],
      [[car.year, car.model].filter(Boolean).join(' '), price],
    ].map(([t, p]) => [t, p].filter(Boolean).join(' '));
    const title = cands.find((c) => len(c) <= TIKTOK_TITLE_MAX) || clip(cands[2], TIKTOK_TITLE_MAX);
    const body = fit('tiktok', car, url, LIMITS.tiktok, credit);
    if (len(cands[2]) > TIKTOK_TITLE_MAX) warnings.push('title_clipped');
    return { platform, title, text: body.text, length: len(body.text), limit: LIMITS.tiktok,
      titleLimit: TIKTOK_TITLE_MAX, fits: body.fits, dropped: body.dropped, warnings };
  }
  const limit = LIMITS[platform];
  if (!limit) throw new Error('unknown platform ' + platform);
  const r = fit(platform, car, url, limit, credit);
  if (!r.fits) warnings.push('too_long');
  return { platform, text: r.text, length: len(r.text), limit, fits: r.fits, dropped: r.dropped, warnings };
}

const PHONE = /(?:\+?60|\b0)1\d[\s-]?\d{3,4}[\s-]?\d{4}\b|wa\.me\/|api\.whatsapp\.com/i;

// The last check, run again by the edge function on whatever text the seller typed.
export function validateText(platform, text, { title } = {}) {
  const errors = [];
  const t = String(text || '');
  if (!t.trim()) errors.push('empty');
  const limit = LIMITS[platform];
  if (!limit) return { ok: false, errors: ['unknown_platform'] };
  if (len(t) > limit) errors.push('too_long');
  if (PHONE.test(t)) errors.push('phone_number');
  if (platform === 'tiktok') {
    if (/https?:\/\//i.test(t) || /https?:\/\//i.test(title || '')) errors.push('tiktok_link');
    if (title != null) {
      if (!String(title).trim()) errors.push('title_empty');
      if (len(title) > TIKTOK_TITLE_MAX) errors.push('title_too_long');
      if (/#/.test(title)) errors.push('title_hashtag');
    }
  }
  return { ok: errors.length === 0, errors };
}

export const ERROR_TEXT = {
  empty: 'The text is empty.',
  too_long: 'The text is over this network\'s limit.',
  phone_number: 'Take the phone number out. Buyers reach you through the link.',
  tiktok_link: 'TikTok does not make links clickable. Use "link in bio".',
  title_empty: 'TikTok needs a title.',
  title_too_long: 'The TikTok title is over 90 characters.',
  title_hashtag: 'TikTok removes hashtags from a photo title.',
  unknown_platform: 'That network is not supported yet.',
};

// The link a post carries: the car's canonical address + where the visit came from.
// A solo seller's car lives at /showroom/<slug> (api/og.js carCanonical). A dealer with a
// storefront subdomain is not handled here yet: the dealer screen must pass its own base.
export function carLink(siteUrl, car, sellerSlug) {
  const q = new URLSearchParams();
  q.set('src', 'autopost');
  if (sellerSlug) q.set('ref', sellerSlug);
  return `${siteUrl}/showroom/${encodeURIComponent(car.slug)}?${q.toString()}`;
}
