// Run: npm run test:postcaption
// The caption adjuster (supabase/functions/_shared/postCaption.js) is the ONLY thing that
// stops an over-long Threads post or a link in a TikTok title: Zernio accepts 501 characters
// for Threads without complaint (tested 2026-11-12).
import {
  buildPost, validateText, carLink, carTitle, clip, money, LIMITS, TIKTOK_TITLE_MAX, BIO_LINE,
} from '../supabase/functions/_shared/postCaption.js';

let pass = 0;
const fails = [];
const ok = (cond, label) => { if (cond) pass++; else fails.push(label); };
const len = (s) => Array.from(s).length;

// Real rows from premiummotors, 2026-11-12.
const defender = { year: 2023, brand: 'Land Rover', model: 'Defender', variant: '90', mileage: 10000, selling_price: '270000', state: 'Kuala Lumpur', slug: 'land-rover-defender-2023-5676' };
const civic = { year: 2025, brand: 'Honda', model: 'Civic', variant: 'FL5 TYPE-R 2.0L HATCHBACK', mileage: 866, selling_price: '250000', state: 'Kuala Lumpur', slug: 'honda-civic-2025-95d8' };
const url = carLink('https://drevo.my', defender, 'premiummotors');

ok(url === 'https://drevo.my/showroom/land-rover-defender-2023-5676?src=autopost&ref=premiummotors', 'link has src + ref: ' + url);
ok(money('270000') === 'RM270,000', 'money format');
ok(money(0) === '' && money(null) === '', 'no price = empty, not RM0');
ok(carTitle(defender) === '2023 Land Rover Defender 90', 'title');
ok(carTitle({ year: 2022, brand: 'MINI', model: 'Cooper', variant: 'Cooper WORKS' }) === '2022 MINI Cooper', 'variant that repeats the model is dropped');

// --- every platform, normal car ------------------------------------------------------
for (const p of ['facebook', 'threads', 'instagram', 'tiktok']) {
  const r = buildPost(p, defender, url);
  ok(r.fits, p + ' fits');
  ok(r.text.includes(money(defender.selling_price)) || p === 'tiktok', p + ' keeps price');
  ok(!validateText(p, r.text, { title: r.title }).errors.length, p + ' built text passes its own validation: ' + JSON.stringify(validateText(p, r.text, { title: r.title })));
}
ok(buildPost('facebook', defender, url).text.includes(url), 'facebook carries the clickable link');
ok(buildPost('threads', defender, url).text.includes(url), 'threads carries the link');
ok(!buildPost('instagram', defender, url).text.includes('http'), 'instagram has no link');
ok(buildPost('instagram', defender, url).text.includes(BIO_LINE), 'instagram says link in bio');
const tt = buildPost('tiktok', civic, url);
ok(!tt.text.includes('http') && !tt.title.includes('http'), 'tiktok has no link');
ok(tt.text.includes(BIO_LINE), 'tiktok says link in bio');
ok(len(tt.title) <= TIKTOK_TITLE_MAX && !tt.title.includes('#'), 'tiktok title <= 90, no hashtag: ' + tt.title);
ok(tt.title.includes('RM250,000'), 'tiktok title keeps the price');

// --- Threads: the 500 cap, hammered ---------------------------------------------------
const longUrl = 'https://drevo.my/showroom/' + 'x'.repeat(150) + '?src=autopost&ref=premiummotors';
const nasty = [
  { ...civic, description: 'word '.repeat(400) },
  { ...civic, variant: 'V'.repeat(200) },
  { ...civic, state: 'S'.repeat(300), transmission: 'T'.repeat(200), fuel_type: 'F'.repeat(200) },
  { ...defender, description: 'x'.repeat(5000) },
];
for (const [i, c] of nasty.entries()) {
  for (const u of [url, longUrl]) {
    const r = buildPost('threads', c, u);
    ok(len(r.text) <= LIMITS.threads || r.fits === false, `threads case ${i}: ${len(r.text)} chars but fits=${r.fits}`);
    if (r.fits) ok(r.text.includes(u) && /RM[\d,]+/.test(r.text), `threads case ${i}: link and price survive`);
  }
}
const impossible = buildPost('threads', { ...civic, variant: 'V'.repeat(600) }, url);
ok(impossible.fits === false && impossible.warnings.includes('too_long'), 'a title that alone is over 500 is refused, not cut');
// the optional pieces go in order: extra, then specs, and the price is never touched
const tight = buildPost('threads', { ...civic, state: 'K'.repeat(120), transmission: 'T'.repeat(150), fuel_type: 'F'.repeat(150) }, url);
ok(tight.dropped.length > 0 && tight.text.includes('RM250,000'), 'tight threads drops pieces, keeps price');

// --- Facebook / Instagram long description is clipped at a word, with "..." ------------------
const fb = buildPost('facebook', { ...defender, description: 'One owner, full service history. '.repeat(100) }, url);
ok(len(fb.text) <= LIMITS.facebook && fb.text.includes('...') && fb.text.includes(url), 'facebook clips the description, keeps the link');
ok(!/\w\.\.\.\s*\n\n\w+ \w+\.\.\./.test(fb.text), 'single clip only');
ok(clip('Hello world this is long', 12) === 'Hello...' || clip('Hello world this is long', 12).endsWith('...'), 'clip ends with ...');
ok(len(clip('a'.repeat(50), 20)) <= 20, 'clip honours max');
ok(clip('short', 20) === 'short', 'short text untouched');

// --- missing data ----------------------------------------------------------------------
const noPrice = buildPost('threads', { ...defender, selling_price: null }, url);
ok(noPrice.warnings.includes('no_price') && !noPrice.text.includes('RM'), 'no price is a warning, never "RM0"');
const noMileage = buildPost('threads', { ...defender, mileage: 0 }, url);
ok(!noMileage.text.includes(' km'), 'zero mileage not printed');

// --- validateText: what the server re-checks ---------------------------------------------
ok(validateText('threads', 'x'.repeat(501)).errors.includes('too_long'), '501 chars rejected for threads');
ok(validateText('threads', 'x'.repeat(500)).ok, '500 chars accepted for threads');
ok(validateText('threads', '😀'.repeat(500)).ok, 'emoji count as one character each');
ok(validateText('threads', 'call me 012-345 6789').errors.includes('phone_number'), 'phone 012-345 6789');
ok(validateText('facebook', 'WhatsApp +60123456789 now').errors.includes('phone_number'), 'phone +60123456789');
ok(validateText('facebook', 'text 0123456789').errors.includes('phone_number'), 'phone 0123456789');
ok(validateText('facebook', 'chat https://wa.me/60123456789').errors.includes('phone_number'), 'wa.me link');
ok(validateText('facebook', 'RM270,000 10,000 km 2023').ok, 'price, mileage and year are not phone numbers');
ok(validateText('facebook', 'RM1,234,567,890').ok, 'a long price is not a phone number');
ok(validateText('tiktok', 'see https://drevo.my/x', { title: 'ok' }).errors.includes('tiktok_link'), 'tiktok link rejected');
ok(validateText('tiktok', 'fine', { title: 'a'.repeat(91) }).errors.includes('title_too_long'), 'tiktok title 91');
ok(validateText('tiktok', 'fine', { title: 'Honda #civic' }).errors.includes('title_hashtag'), 'tiktok hashtag');
ok(validateText('threads', '   ').errors.includes('empty'), 'empty rejected');
ok(!validateText('myspace', 'hi').ok, 'unknown platform rejected');

if (fails.length) {
  console.error(`FAIL ${fails.length} (pass ${pass}):\n - ` + fails.join('\n - '));
  process.exit(1);
}
console.log(`postCaption: ${pass} checks passed`);
