// npm run test:posterstyles
import assert from 'node:assert/strict';
import { fitInside, CUTOUT_STYLES, featureStrip, featureList, specParts, photoPlan, styleAvailable, ribbonsFor, tintFromRgb, CARD_FALLBACK_TINT, paletteOf, styleOf } from '../src/utils/posterStyles.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('features: string or array, trimmed to 22 chars, max 3, never padded with invented words', () => {
  assert.deepEqual(featureList({ features: 'Sunroof, 360 camera ,' }), ['Sunroof', '360 camera']);
  assert.deepEqual(featureStrip({ features: 'A very very long feature name indeed' }, 'en'), ['A very very long feat…']);
  assert.deepEqual(featureStrip({ features: ['a', 'b', 'c', 'd'] }, 'en'), ['a', 'b', 'c']);
  assert.deepEqual(featureStrip({}, 'en'), []);
});
t('features fall back to facts the row holds', () => {
  assert.deepEqual(featureStrip({ transmission: 'Auto', previous_owners: 1, warranty_months: 12 }, 'en'), ['Auto', '1 owner', '12-month warranty']);
  assert.deepEqual(featureStrip({ previous_owners: 2 }, 'en'), []);
});
t('spec parts drop what is missing', () => {
  assert.deepEqual(specParts({ year: 2025, mileage: '4200', engine_cc: 1998 }), ['2025', '4,200 KM', '2.0L']);
  assert.deepEqual(specParts({}), []);
});
t('photo plans shrink with the photo count', () => {
  assert.deepEqual(photoPlan('showroom', 1).thumbs, []);
  assert.deepEqual(photoPlan('showroom', 2).thumbs, [1]);
  assert.deepEqual(photoPlan('showroom', 6).thumbs, [1, 2]);
  assert.equal(photoPlan('story', 2), null);
  assert.deepEqual(photoPlan('story', 3), { top: [1, 2], hero: 0, split: null, bottom: null });
  assert.equal(photoPlan('story', 5).bottom, 4);
  assert.equal(styleAvailable('story', 2), false);
  assert.equal(styleAvailable('story', 3), true);
  assert.equal(styleAvailable('card', 1), true);
});
t('ribbons are only offered when the listing backs them', () => {
  assert.deepEqual(ribbonsFor({}), ['none', 'import']);
  assert.ok(ribbonsFor({ is_recon: true }).includes('recon'));
  assert.ok(ribbonsFor({ previous_owners: 1 }).includes('owner'));
  assert.ok(!ribbonsFor({ previous_owners: 2 }).includes('owner'));
  assert.ok(ribbonsFor({ condition: 'new' }).includes('new'));
});
t('card tint is dark, and falls back on bad input', () => {
  const hex = tintFromRgb(240, 240, 240);
  assert.match(hex, /^#[0-9a-f]{6}$/);
  assert.ok(parseInt(hex.slice(1, 3), 16) < 100);
  assert.equal(tintFromRgb(NaN, 1, 2), CARD_FALLBACK_TINT);
});
t('unknown ids fall back to the first', () => {
  assert.equal(paletteOf('nope').id, 'carbon');
  assert.equal(styleOf('nope').id, 'kiraan');
});
t('fitInside never crops and never leaves the box', () => {
  assert.deepEqual(fitInside(1024, 768, 842, 1075), { w: 842, h: 632 });
  assert.deepEqual(fitInside(768, 1024, 842, 600), { w: 450, h: 600 });
  assert.deepEqual(fitInside(0, 10, 5, 5), { w: 0, h: 0 });
  assert.deepEqual(CUTOUT_STYLES, ['showroom', 'card']);
});
console.log(`${n} passed`);
