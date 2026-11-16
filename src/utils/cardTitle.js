// The car card's two lines, built from the STRUCTURED fields (MARKET-CARD, 2026-11-16).
// Line 1 = "2023 Toyota Vellfire" (year, brand, model). Line 2 = the variant, tidied.
// The seller's free-text headline (listing_title) is NOT used on the card any more:
// it produced "TOYOTA VELLFIRE 2.5L HYBRID EXECUTIVE LOUNGE 2023" next to "Mini John
// Cooper Works" and "Volkswagen Golf golf gti 2.0 se". It still shows on the car page.

// Tokens that stay upper case when a variant is re-cased.
const UPPER = new Set([
  'gti', 'gt', 'gr', 'rz', 'se', 'sc', 'z', 'g', 's', 'x', 'l', 'm', 'f', 'av', 'h', 'e', 'v',
  'cvt', 'at', 'mt', 'amt', 'dct', 'hev', 'phev', 'ev', 'awd', '4wd', '2wd', 'fwd', 'rwd',
  'amg', 'rs', 'st', 'svr', 'gts', 'gtr', 'vgt', 'vvt', 'tsi', 'tfsi', 'tdi', 'cbu', 'ckd',
  'mpv', 'suv', 'ii', 'iii', 'iv',
]);

function recaseWord(w) {
  // "2.0L", "1.5T", "FL5", "350", "sDrive20i": anything with a digit keeps the seller's casing,
  // except a trailing litre/turbo letter, which reads best upper case.
  if (/\d/.test(w)) return w.replace(/^(\d+(?:\.\d+)?)([lt])$/i, (_, n, u) => n + u.toUpperCase());
  return w.split('-').map((p) => {
    const lw = p.toLowerCase().replace(/[()]/g, '');
    if (UPPER.has(lw)) return p.toUpperCase();
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join('-');
}

// Variant as a buyer should read it. Re-cases ONLY an all-lower or ALL-UPPER string
// (a mixed-case one like "sDrive20i M Sport" was typed with care) and drops a
// leading repeat of the model name ("Golf golf gti" -> "GTI").
export function tidyVariant(variant, model) {
  let v = String(variant || '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  const letters = v.replace(/[^a-z]/gi, '');
  if (letters && (letters === letters.toLowerCase() || letters === letters.toUpperCase())) {
    v = v.split(' ').map(recaseWord).join(' ');
  }
  const m = String(model || '').trim().toLowerCase();
  if (m) {
    const words = v.split(' ');
    while (words.length > 1 && words[0].toLowerCase().replace(/[()]/g, '') === m) words.shift();
    v = words.join(' ');
  }
  return v;
}

export function cardTitle(car) {
  const name = [car?.year, car?.brand, car?.model].filter(Boolean).join(' ').trim();
  return { name: name || 'Car', variant: tidyVariant(car?.variant, car?.model) };
}

// Town for the card's last line. Sellers type a street or a district into `city`
// ("Jalan Semarak", "Chow Kit") or a state into it ("wilayah persekutuan"); the
// buyer wants the town. Only Kuala Lumpur's own districts are folded; anything
// else is shown as typed, title-cased.
const KL_AREAS = new Set([
  'kuala lumpur', 'kl', 'wilayah persekutuan', 'wp kuala lumpur', 'wilayah persekutuan kuala lumpur',
  'jalan semarak', 'titiwangsa', 'chow kit', 'cheras', 'kepong', 'setapak', 'wangsa maju', 'bukit bintang',
  'bangsar', 'mont kiara', 'sri hartamas', 'segambut', 'sentul', 'kampung baru', 'jalan ipoh', 'bukit jalil',
  'sri petaling', 'old klang road', 'jalan klang lama', 'desa park city',
]);
const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
export function cardPlace(car) {
  const city = String(car?.city || '').trim();
  const state = String(car?.state || '').trim();
  if (city && KL_AREAS.has(city.toLowerCase())) return 'Kuala Lumpur';
  if (city) return titleCase(city);
  if (state && KL_AREAS.has(state.toLowerCase())) return 'Kuala Lumpur';
  return state ? titleCase(state) : '';
}

// True when the seller's free-text headline only repeats the car's own name
// ("TOYOTA VELLFIRE 2.5L HYBRID EXECUTIVE LOUNGE 2023" under "Toyota Vellfire
// 2.5L Executive Lounge"). The car page then shows the title ONCE. A headline
// that says something new ("Full service record, one owner") still shows.
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').split(' ').filter((w) => w.length > 1 || /\d/.test(w));
export function isTitleRepeat(headline, car) {
  const h = words(headline);
  if (!h.length) return true;
  const litre = Number(car?.engine_cc) > 0 ? (Number(car.engine_cc) / 1000).toFixed(1) : '';
  const known = new Set(words([car?.year, car?.brand, car?.model, car?.variant, car?.fuel_type, car?.transmission, car?.body_type, litre].join(' ')));
  const extra = h.filter((w) => !known.has(w) && !known.has(w.replace(/l$/, '')));
  return extra.length <= 1;
}
