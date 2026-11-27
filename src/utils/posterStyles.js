// Poster styles (POSTER-6): the pure part. Which style needs how many photos,
// what the three palettes are, which facts fill the strip and the ribbon, and
// how the card colour is worked out. No canvas, no network: tested by
// `npm run test:posterstyles`. Drawing lives in components/poster/renderCarPoster.js.
//
// Every word printed comes from the listing row or from these fixed lists.
// Nothing is typed free, and no money amount is ever part of a ribbon.

export const POSTER_STYLES = [
  { id: 'kiraan', name: 'Kiraan', w: 1080, h: 1350, minPhotos: 1 },
  { id: 'showroom', name: 'Showroom', w: 1080, h: 1350, minPhotos: 1 },
  { id: 'story', name: 'Story', w: 1080, h: 1920, minPhotos: 3 },
  { id: 'card', name: 'Card', w: 1080, h: 1920, minPhotos: 1 },
];
export const styleOf = (id) => POSTER_STYLES.find((s) => s.id === id) || POSTER_STYLES[0];

// Showroom palettes. One layout, three looks (the owner's references were one
// layout in four colours).
export const PALETTES = [
  { id: 'carbon', name: 'Carbon', bg: '#0a0c11', glow: 'rgba(225,29,42,0.30)', accent: '#e11d2a', plate: 'rgba(10,12,17,0.86)', plateText: '#ffffff' },
  { id: 'gunmetal', name: 'Gunmetal', bg: '#15171b', glow: 'rgba(245,184,0,0.16)', accent: '#f2b705', plate: 'rgba(30,32,38,0.9)', plateText: '#ffffff' },
  { id: 'forest', name: 'Forest', bg: '#06231f', glow: 'rgba(40,150,110,0.28)', accent: '#dc2626', plate: 'rgba(5,28,24,0.9)', plateText: '#ffffff' },
];
export const paletteOf = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

// The ribbon is a fixed pick-list. `ok(car)` says whether the listing can
// honestly carry it, so the sheet only offers what is true of this car.
export const RIBBONS = [
  { id: 'none', ok: () => true },
  { id: 'import', ok: () => true },
  { id: 'recon', ok: (car) => car?.is_recon === true || String(car?.condition || '').toLowerCase() === 'recon' },
  { id: 'new', ok: (car) => String(car?.condition || '').toLowerCase() === 'new' },
  { id: 'owner', ok: (car) => Number(car?.previous_owners) === 1 },
];
export const ribbonsFor = (car) => RIBBONS.filter((r) => r.ok(car)).map((r) => r.id);
export const RIBBON_TEXT = {
  ms: { import: 'Import terus', recon: 'Recond', new: 'Kereta baru', owner: '1 pemilik' },
  en: { import: 'Direct import', recon: 'Recon', new: 'Brand new', owner: '1 owner' },
};

const trimTo = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

// Photos the listing really has, in order, no empties.
export const photosOf = (car) => (Array.isArray(car?.images) ? car.images : []).filter(Boolean);

// `features` is a comma separated string (CarForm) or, in older rows, an array.
export function featureList(car) {
  const raw = car?.features;
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,\n]/);
  return list.map((x) => String(x).trim()).filter(Boolean);
}

// The three-item strip: the seller's own features first, then plain facts the
// listing holds. Never invented, never padded: fewer than three is fine.
export function featureStrip(car, lang = 'ms', max = 3) {
  const out = featureList(car).map((f) => trimTo(f, 22));
  const en = lang === 'en';
  if (out.length < max && car?.transmission) out.push(trimTo(car.transmission, 22));
  if (out.length < max && Number(car?.previous_owners) === 1) out.push(en ? '1 owner' : '1 pemilik');
  if (out.length < max && Number(car?.warranty_months) > 0) out.push(en ? `${Number(car.warranty_months)}-month warranty` : `Waranti ${Number(car.warranty_months)} bulan`);
  return [...new Set(out)].slice(0, max);
}

// "2025 · 4,200 KM · 2.0L"-style line. Only what the row holds.
export function specParts(car) {
  const out = [];
  if (car?.year) out.push(String(car.year));
  const km = Number(String(car?.mileage ?? '').replace(/[^0-9.]/g, ''));
  if (km > 0) out.push(`${Math.round(km).toLocaleString('en-MY')} KM`);
  const cc = Number(String(car?.engine_cc ?? '').replace(/[^0-9.]/g, ''));
  if (cc > 0) out.push(cc >= 600 ? `${(cc / 1000).toFixed(1)}L` : `${cc} CC`);
  return out;
}

// Which photo goes where. Showroom: hero + up to 2 thumbs. Story: a top pair,
// a hero, an optional photo beside the text and an optional wide photo at the
// foot; with fewer photos the rows that have none simply do not exist.
export function photoPlan(styleId, n) {
  if (styleId === 'showroom') return { hero: 0, thumbs: n >= 3 ? [1, 2] : n === 2 ? [1] : [] };
  if (styleId === 'story') {
    if (n < 3) return null;
    return { top: [1, 2], hero: 0, split: n >= 4 ? 3 : null, bottom: n >= 5 ? 4 : null };
  }
  return { hero: 0 };
}
export const photosNeeded = (styleId) => styleOf(styleId).minPhotos;
export const styleAvailable = (styleId, n) => n >= photosNeeded(styleId);

// Card colour: the photo's average colour, pulled dark and a little richer.
// Inputs are 0-255. Returns '#rrggbb'. (Fallback is the Drevo dark.)
export const CARD_FALLBACK_TINT = '#1a1317';
export function tintFromRgb(r, g, b) {
  const nums = [r, g, b].map((v) => Number(v));
  if (nums.some((v) => !Number.isFinite(v))) return CARD_FALLBACK_TINT;
  const avg = (nums[0] + nums[1] + nums[2]) / 3;
  const f = (c) => Math.max(0, Math.min(255, Math.round((avg + (c - avg) * 1.9) * 0.34)));
  return `#${nums.map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}

// What a free (Lite) seller may pick. Premium and dealer-linked: everything.
// A client-side choice only: the credit itself is claimed in the database
// (claim_loan_poster), the style is a look, not an entitlement to a number.
export const LITE_STYLES = ['kiraan', 'showroom'];
export const LITE_PALETTES = ['carbon'];
export const styleLocked = (styleId, unlimited) => unlimited === false && !LITE_STYLES.includes(styleId);
export const paletteLocked = (paletteId, unlimited) => unlimited === false && !LITE_PALETTES.includes(paletteId);

// Fit a picture inside a box WITHOUT cropping it (contain). Returns the drawn
// size. Used by the Card, so a landscape photo is shown whole, not zoomed in.
export function fitInside(iw, ih, maxW, maxH) {
  if (!(iw > 0) || !(ih > 0) || !(maxW > 0) || !(maxH > 0)) return { w: 0, h: 0 };
  const k = Math.min(maxW / iw, maxH / ih);
  return { w: Math.round(iw * k), h: Math.round(ih * k) };
}
// Styles that can put a cut-out car straight on the colour.
export const CUTOUT_STYLES = ['showroom', 'card'];

// Mix two #rrggbb colours (t = 0 gives a, 1 gives b). The card's gradient is
// built from its own colour this way, so a lift or a deepening keeps the hue
// instead of washing it grey with white or black.
export function mixHex(a, b, t) {
  const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const A = rgb(a), B = rgb(b), k = Math.max(0, Math.min(1, Number(t) || 0));
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}
