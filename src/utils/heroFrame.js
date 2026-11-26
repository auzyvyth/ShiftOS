// PAGE-HERO 2 (owner, 2026-11-26): the seller sizes and places their hero photo, and picks
// which car stands in front of it (or none). Saved ON the hero URL's query string, like the
// cover's `fy=` (coverFocus.js): `set_my_hero_photo` only checks the part before `?`, so
// there is no column and no migration. Keys: hs = size %, hx / hy = shift % of the frame,
// hc = 'none' | a listing id. Nothing set = today's look exactly.

export const HERO_SIZE = { min: 60, max: 160, def: 100 };
export const HERO_SHIFT = { min: -40, max: 40, def: 0 };
export const HERO_CAR_SIZE = { min: 50, max: 160, def: 100 }; // hk = the car's size %
const KEYS = ['hs', 'hx', 'hy', 'hc', 'hk', 'hl', 'hb', 'ds', 'dx', 'dy', 'dk'];
// HERO-DESK (owner, 2026-11-26: "make em separate"): desktop has its OWN size, position and car
// size (ds / dx / dy / dk). None of them on the URL = desktop uses the phone's numbers, so a
// page saved before this looks exactly as it did. `desk` is null until the seller sets it.
export const HERO_DESK_MIN_W = 900; // the hero's desktop layout starts here (SalesmanProfilePage CSS)
// hb = the business card ring's brand ('' = the brand with the most cut-out cars).
const BRAND = /^[\p{L}\p{N} .&-]{1,30}$/u;
const cleanBrand = (v) => { const b = String(v || '').trim(); return BRAND.test(b) ? b : ''; };
// hl = the hero's layout: 'stage' (default: the seller big on the dark band) | 'card' (a white business card).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clampInt = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};

// Any URL -> { size, x, y, car }. car: 'auto' | 'none' | <listing id>.
export function heroFrame(url) {
  const out = { size: HERO_SIZE.def, x: HERO_SHIFT.def, y: HERO_SHIFT.def, car: 'auto', carSize: HERO_CAR_SIZE.def, layout: 'stage', ringBrand: '', desk: null };
  const q = String(url || '').split('#')[0].split('?')[1];
  if (!q) return out;
  const p = new URLSearchParams(q);
  if (['ds', 'dx', 'dy', 'dk'].some((k) => p.has(k))) {
    out.desk = {
      size: clampInt(p.get('ds'), HERO_SIZE.min, HERO_SIZE.max, HERO_SIZE.def),
      x: clampInt(p.get('dx'), HERO_SHIFT.min, HERO_SHIFT.max, HERO_SHIFT.def),
      y: clampInt(p.get('dy'), HERO_SHIFT.min, HERO_SHIFT.max, HERO_SHIFT.def),
      carSize: clampInt(p.get('dk'), HERO_CAR_SIZE.min, HERO_CAR_SIZE.max, HERO_CAR_SIZE.def),
    };
  }
  if (p.has('hs')) out.size = clampInt(p.get('hs'), HERO_SIZE.min, HERO_SIZE.max, HERO_SIZE.def);
  if (p.has('hx')) out.x = clampInt(p.get('hx'), HERO_SHIFT.min, HERO_SHIFT.max, HERO_SHIFT.def);
  if (p.has('hy')) out.y = clampInt(p.get('hy'), HERO_SHIFT.min, HERO_SHIFT.max, HERO_SHIFT.def);
  if (p.get('hl') === 'card') out.layout = 'card';
  out.ringBrand = cleanBrand(p.get('hb'));
  if (p.has('hk')) out.carSize = clampInt(p.get('hk'), HERO_CAR_SIZE.min, HERO_CAR_SIZE.max, HERO_CAR_SIZE.def);
  const c = p.get('hc');
  if (c === 'none' || UUID.test(c || '')) out.car = c;
  return out;
}

// The URL with these settings; defaults are left out, other query keys (t=) are kept.
export function withHeroFrame(url, frame) {
  const s = String(url || '');
  if (!s) return s;
  const [base, q = ''] = s.split('#')[0].split('?');
  const p = new URLSearchParams(q);
  KEYS.forEach((k) => p.delete(k));
  const f = { ...heroFrame(''), ...frame };
  const size = clampInt(f.size, HERO_SIZE.min, HERO_SIZE.max, HERO_SIZE.def);
  const x = clampInt(f.x, HERO_SHIFT.min, HERO_SHIFT.max, 0);
  const y = clampInt(f.y, HERO_SHIFT.min, HERO_SHIFT.max, 0);
  if (size !== HERO_SIZE.def) p.set('hs', String(size));
  if (x !== 0) p.set('hx', String(x));
  if (y !== 0) p.set('hy', String(y));
  const k = clampInt(f.carSize, HERO_CAR_SIZE.min, HERO_CAR_SIZE.max, HERO_CAR_SIZE.def);
  if (k !== HERO_CAR_SIZE.def) p.set('hk', String(k));
  if (f.layout === 'card') p.set('hl', 'card');
  if (cleanBrand(f.ringBrand)) p.set('hb', cleanBrand(f.ringBrand));
  if (f.car === 'none' || UUID.test(f.car || '')) p.set('hc', f.car);
  if (f.desk) { // all four, so their presence alone says "desktop is separate"
    p.set('ds', String(clampInt(f.desk.size, HERO_SIZE.min, HERO_SIZE.max, HERO_SIZE.def)));
    p.set('dx', String(clampInt(f.desk.x, HERO_SHIFT.min, HERO_SHIFT.max, 0)));
    p.set('dy', String(clampInt(f.desk.y, HERO_SHIFT.min, HERO_SHIFT.max, 0)));
    p.set('dk', String(clampInt(f.desk.carSize, HERO_CAR_SIZE.min, HERO_CAR_SIZE.max, HERO_CAR_SIZE.def)));
  }
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

// The image's own URL (without the frame keys), for loading the file.
export const heroImageUrl = (url) => withHeroFrame(url, { size: HERO_SIZE.def, x: 0, y: 0, car: 'auto', carSize: HERO_CAR_SIZE.def, layout: 'stage', ringBrand: '', desk: null });

// The numbers one screen uses: desktop's own set when it has one, else the phone's.
export function heroFrameFor(frame, desktop) {
  const f = frame || heroFrame('');
  if (!desktop || !f.desk) return f;
  return { ...f, size: f.desk.size, x: f.desk.x, y: f.desk.y, carSize: f.desk.carSize };
}

// CSS for the car in front: grows from its wheels (bottom centre).
export const heroCarStyle = (frame) => (frame && frame.carSize !== HERO_CAR_SIZE.def
  ? { scale: String(frame.carSize / 100), transformOrigin: '50% 100%' } : undefined);

// CSS for the person. A cut-out grows from its feet (bottom centre); a framed photo
// keeps its frame and moves the picture inside it.
export function heroPersonStyle(frame, cut) {
  const f = frame || heroFrame('');
  if (f.size === 100 && f.x === 0 && f.y === 0) return undefined;
  if (cut) return { transform: `translate(${f.x}%, ${f.y}%) scale(${f.size / 100})`, transformOrigin: '50% 100%' };
  return { objectPosition: `${50 - f.x}% ${50 - f.y}%`, transform: f.size !== 100 ? `scale(${f.size / 100})` : undefined, transformOrigin: '50% 50%' };
}

// Which car photos the hero may stand in front of, in order. `cars` = the page's listings.
export function heroCarCandidates(cars, frame) {
  const first = (c) => (Array.isArray(c?.images) ? c.images[0] : null);
  const list = Array.isArray(cars) ? cars : [];
  if (frame?.car === 'none') return [];
  if (frame?.car && frame.car !== 'auto') {
    const pick = list.find((c) => c.id === frame.car);
    if (pick && first(pick)) return [first(pick)];
  }
  return list.map(first).filter(Boolean);
}
