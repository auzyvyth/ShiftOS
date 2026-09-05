// Canonical model resolution.
//
// `car_listings.model` is free text, so the SAME car is stored under several
// strings: live right now there are 12 rows of "ALPHARD 2.5L" and 5 of
// "Alphard". CarListingPage.jsx:518 filters with `.ilike('model', model)` —
// an exact match — so a buyer filtering for an Alphard sees 5 of the 17 on
// the site. This resolves any free-text (brand, model) pair onto one key.
//
// The JPJ open-data registration feed (see IDEA-5 in TODO.md) has the same
// problem in a worse form — manufacturer-declared strings like
// "HONDA CITY 1.5 S i-VTEC". Both sides go through here so a dealer's stock
// and the national registration data can actually be joined. One resolver,
// not two.
import { CAR_DATA } from '../data/carData.js';
import { chassisSearch } from './chassisCodes.js';

// Free text -> a CAR_DATA brand key. Left side is already normalised.
const BRAND_ALIASES = {
  'MERCEDES BENZ': 'Mercedes', 'MERC': 'Mercedes', 'BENZ': 'Mercedes',
  'ROLLS ROYCE': 'Rolls Royce', 'LAND ROVER': 'Land Rover',
  'RANGE ROVER': 'Land Rover', 'VW': 'Volkswagen', 'CHEVROLET': 'Chevrolet',
  'MINI COOPER': 'MINI', 'BMW MINI': 'MINI',
};

// Collapse anything non-alphanumeric to a single space, uppercase, trim.
// "CIVIC 2.0L(T) HATCHBACK" -> "CIVIC 2 0L T HATCHBACK"
// "CR-V" -> "CR V"          so "CRV", "CR-V" and "CR V" all agree.
export function norm(s) {
  return String(s == null ? '' : s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const BRAND_KEYS = Object.keys(CAR_DATA);
const BRAND_LOOKUP = {};
for (const b of BRAND_KEYS) BRAND_LOOKUP[norm(b)] = b;
for (const [k, v] of Object.entries(BRAND_ALIASES)) {
  // An alias pointing at a brand the catalogue does not carry would resolve
  // to a brand with no model list. Drop it rather than crash later.
  if (CAR_DATA[v]) BRAND_LOOKUP[norm(k)] = v;
}

// Per brand, models sorted longest-first so "Range Rover Sport" is tried
// before "Range Rover" and "GR86" before "86".
const MODELS_BY_BRAND = {};
for (const b of BRAND_KEYS) {
  MODELS_BY_BRAND[b] = CAR_DATA[b]
    .map((m) => ({ label: m, n: norm(m) }))
    .sort((a, b2) => b2.n.length - a.n.length);
}

// A model matches when it starts a token of the haystack AND ends on a
// boundary. The end check is what stops "Supra" matching "SUPRAX"; allowing
// a DIGIT after it is what lets "NX" match "NX250 2 5L", which is how Lexus
// trims are actually written in car_listings.
function endsOk(hay, i, len) {
  const c = hay[i + len];
  return c === undefined || c === ' ' || (c >= '0' && c <= '9');
}

function startsToken(hay, needle) {
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i === -1) return false;
    if ((i === 0 || hay[i - 1] === ' ') && endsOk(hay, i, needle.length)) return true;
    from = i + 1;
  }
}

// Second pass with every space removed, anchored at position 0 only, so a
// model written without its separator still lands: "CRV 1.5" -> Honda CR-V.
// Anchoring at 0 is what keeps it safe — it cannot match mid-string.
function matchesSquashed(hay, needle) {
  const h = hay.replace(/ /g, '');
  const n = needle.replace(/ /g, '');
  return n.length >= 3 && h.startsWith(n) && endsOk(h, 0, n.length);
}

function findModel(brand, hay) {
  const list = MODELS_BY_BRAND[brand] || [];
  for (const m of list) if (startsToken(hay, m.n)) return m;
  for (const m of list) if (matchesSquashed(hay, m.n)) return m;
  // Mercedes names its cars by class ("G-Class") but badges them with an
  // AMG number ("G63", "C43"). Strip a trailing two-digit badge off the
  // first token and retry: G63 -> G -> G-Class, GLC43 -> GLC.
  if (brand === 'Mercedes') {
    const stem = hay.split(' ')[0].replace(/\d{2}$/, '');
    if (stem.length >= 1) {
      for (const m of list) if (m.n === stem || m.n.startsWith(stem + ' ')) return m;
    }
  }
  return null;
}

export function resolveBrand(brand) {
  return BRAND_LOOKUP[norm(brand)] || null;
}

/**
 * Resolve free-text brand + model onto a canonical CAR_DATA pair.
 *
 * Returns { brand, model, key, matched, via }:
 *   matched  true only when BOTH brand and model resolved.
 *   key      "toyota:alphard", or null when unmatched. Safe as a group-by.
 *   via      'catalogue' | 'chassis' | null — how the model was found.
 * Never throws and never invents a model: an unknown string returns
 * matched:false with the input echoed back, so callers can show it as-is.
 */
export function canonicalModel(brand, model) {
  const rawBrand = String(brand == null ? '' : brand).trim();
  const rawModel = String(model == null ? '' : model).trim();
  const miss = { brand: rawBrand || null, model: rawModel || null, key: null, matched: false, via: null };

  const hay = norm(rawModel);
  let b = resolveBrand(rawBrand);

  // The brand is sometimes glued to the front of the model string
  // ("HONDA CITY 1.5 S i-VTEC" in one column). Peel it off.
  let searchHay = hay;
  if (!b && hay) {
    for (const cand of BRAND_KEYS) {
      const nb = norm(cand);
      if (hay === nb || hay.startsWith(nb + ' ')) { b = cand; searchHay = hay.slice(nb.length).trim(); break; }
    }
  } else if (b && hay) {
    const nb = norm(b);
    if (hay.startsWith(nb + ' ')) searchHay = hay.slice(nb.length).trim();
  }

  if (b && searchHay) {
    const m = findModel(b, searchHay);
    if (m) return { brand: b, model: m.label, key: keyOf(b, m.label), matched: true, via: 'catalogue' };
  }

  // Generation codes the catalogue does not carry as model names: a Porsche
  // logged as "992 GT3" is a 911, "W205" is a C-Class. chassisCodes.js
  // already holds that table — do not duplicate it here.
  const firstToken = searchHay.split(' ')[0];
  if (firstToken) {
    const gen = chassisSearch(firstToken);
    if (gen && gen.brand) {
      const gb = resolveBrand(gen.brand) || gen.brand;
      const label = (MODELS_BY_BRAND[gb] || []).find((m) => m.n === norm(gen.models[0]));
      if (label) return { brand: gb, model: label.label, key: keyOf(gb, label.label), matched: true, via: 'chassis' };
    }
  }

  if (b) return { ...miss, brand: b };
  return miss;
}

export function keyOf(brand, model) {
  return `${norm(brand).toLowerCase().replace(/ /g, '-')}:${norm(model).toLowerCase().replace(/ /g, '-')}`;
}
