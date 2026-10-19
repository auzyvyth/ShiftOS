// npm run test:newcarcaption
// Fixture = three of the six live Proton S70 variants (new_car_models, 2026-10-08).
import assert from 'node:assert/strict';
import { buildNewCarCaption } from '../src/utils/newCarCaption.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

const base = { seats: 5, boot_l: 500, airbags: 6, warranty: '5 years / unlimited km' };
const lite = { variant: '1.5 Lite', price: 59800, transmission: 'CVT', specs: { ...base, engine: '1.5L NA', power_ps: 120,
  safety: ['Blind spot monitor', 'Lane change assist', 'Reverse camera', 'ISOFIX'],
  features: ['8-inch touchscreen, wireless Apple CarPlay and Android Auto', 'Keyless entry and push start', 'Manual air-con', 'Fabric seats'],
  colours: ['Quartz Black', 'Snow White', 'Marine Blue'] } };
const exec = { variant: '1.5TD Executive', price: 73800, transmission: '7-speed DCT', specs: { ...base, engine: '1.5L turbo', power_ps: 181,
  safety: ['Autonomous emergency braking', 'Blind spot monitor', 'Reverse camera'],
  features: ['Keyless entry and push start', 'Manual air-con', 'Rear USB ports'],
  colours: ['Quartz Black', 'Ruby Red', 'Snow White'] } };
const fx = { variant: '1.5TD Flagship X', price: 94800, transmission: '7-speed DCT', specs: { ...base, engine: '1.5L turbo', power_ps: 181,
  safety: ['Autonomous emergency braking', 'Blind spot monitor', '360-degree camera', 'ISOFIX'],
  features: ['12.3-inch touchscreen, wireless Apple CarPlay and Android Auto', 'Keyless entry and push start', 'Sunroof'],
  colours: ['Quartz Black', 'Ruby Red', 'Snow White'] } };
// Deliberately out of order: the caption sorts by price.
const info = { brand: 'Proton', model: 'S70', price_zone: 'peninsular', variants: [fx, lite, exec] };
const listing = { brand: 'Proton', model: 'S70', year: 2026, city: 'Jalan Semarak', state: 'Kuala Lumpur',
  description: 'Free tinted + dashcam. Unit ready, delivery 2 minggu.' };
const link = 'https://example.test/showroom/proton-s70-2026-8ff7?ref=premiummotors';

const text = buildNewCarCaption({ listing, info, link });
if (process.argv.includes('--print')) console.log(text + '\n');

t('from-price is the cheapest, with the price basis', () => {
  assert.match(text, /Dari RM59,800/);
  assert.match(text, /Harga rasmi Semenanjung, atas jalan tanpa insurans/);
});
t('every variant listed cheapest first with its own gearbox', () => {
  const a = text.indexOf('1.5 Lite: RM59,800 (1.5L NA, 120PS, CVT)');
  const b = text.indexOf('1.5TD Executive: RM73,800 (1.5L turbo, 181PS, 7-speed DCT)');
  const c = text.indexOf('1.5TD Flagship X: RM94,800');
  assert.ok(a > 0 && b > a && c > b);
});
t('"semua varian" holds only what every variant has', () => {
  const block = text.split('✅ SEMUA VARIAN')[1].split('\n\n')[0];
  assert.match(block, /5 tempat duduk · but 500L · 6 beg udara/);
  assert.match(block, /Blind spot monitor/);
  assert.match(block, /Keyless entry/);
  assert.doesNotMatch(block, /ISOFIX|Manual air-con|Sunroof/); // not on every variant
  assert.match(block, /Waranti 5 tahun \/ km tanpa had/);
});
t('top variant extras come from the catalogue', () => {
  const block = text.split('⭐ 1.5TD Flagship X tambah (berbanding 1.5 Lite)')[1].split('\n\n')[0];
  assert.match(block, /Sunroof/);
  assert.match(block, /360-degree camera/);
  assert.doesNotMatch(block, /Blind spot monitor/);
});
t("seller's What you offer text is quoted as written", () => {
  assert.match(text, /🎁 DARI SAYA\nFree tinted \+ dashcam\. Unit ready, delivery 2 minggu\./);
});
t('colours: catalogue union when the seller typed none, seller text when they did', () => {
  assert.match(text, /🎨 Warna: Quartz Black, Snow White, Marine Blue, Ruby Red/);
  const own = buildNewCarCaption({ listing: { ...listing, colour: 'Snow White sahaja' }, info, link });
  assert.match(own, /🎨 Warna: Snow White sahaja/);
});
t('pay warning, hashtags, link last', () => {
  assert.match(text, /akaun rasmi Proton/);
  assert.match(text, /#proton #s70 #protons70 #keretabaru/);
  assert.ok(text.trimEnd().endsWith(link));
});
t('a zone with no price says ask, never borrows Peninsular', () => {
  const east = { ...info, price_zone: 'sabah_sarawak', variants: info.variants.map((v) => ({ ...v, price: null })) };
  const s = buildNewCarCaption({ listing, info: east, link });
  assert.match(s, /Harga: tanya saya/);
  assert.match(s, /1\.5 Lite: tanya harga/);
  assert.doesNotMatch(s, /RM59,800/);
});
t('no offer text = no empty section', () => {
  const s = buildNewCarCaption({ listing: { ...listing, description: '  ' }, info, link });
  assert.doesNotMatch(s, /DARI SAYA/);
});
t('no "XDrive" anywhere in the caption', () => assert.doesNotMatch(text, /xdrive/i));

console.log(`\n${n} passed`);
