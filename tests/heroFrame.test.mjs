import { opaqueBox } from '../src/utils/seeThrough.js';
import { heroFrame, withHeroFrame, heroImageUrl, heroPersonStyle, heroCarCandidates } from '../src/utils/heroFrame.js';
let pass = 0, fail = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', name, JSON.stringify(a), '!=', JSON.stringify(b)); };
const U = 'https://x.supabase.co/storage/v1/object/public/avatars/u/hero.webp?t=123';
const ID = '673d0772-871c-4586-bc67-98f4382503a7';
eq('plain url = defaults', heroFrame(U), { size: 100, x: 0, y: 0, car: 'auto', carSize: 100, layout: 'stage', ringBrand: '' });
eq('defaults write nothing', withHeroFrame(U, {}), U);
const w = withHeroFrame(U, { size: 130, x: -12, y: 8, car: ID });
eq('round trip', heroFrame(w), { size: 130, x: -12, y: 8, car: ID, carSize: 100, layout: 'stage', ringBrand: '' });
eq('car size round trip', heroFrame(withHeroFrame(U, { carSize: 75 })).carSize, 75);
eq('car size clamped', heroFrame(withHeroFrame(U, { carSize: 9 })).carSize, 50);
eq('keeps t=', w.includes('t=123'), true);
eq('clamped', heroFrame(withHeroFrame(U, { size: 999, x: -999, y: 999 })), { size: 160, x: -40, y: 40, car: 'auto', carSize: 100, layout: 'stage', ringBrand: '' });
eq('none', heroFrame(withHeroFrame(U, { car: 'none' })).car, 'none');
eq('junk car ignored', heroFrame(U + '&hc=<script>').car, 'auto');
eq('image url strips keys', heroImageUrl(w), U);
eq('rewrite replaces', heroFrame(withHeroFrame(w, { size: 100, x: 0, y: 0, car: 'auto', carSize: 100, layout: 'stage', ringBrand: '' })), heroFrame(U));
eq('no style at default', heroPersonStyle(heroFrame(U), true), undefined);
eq('cut style', heroPersonStyle({ size: 120, x: 10, y: -5 }, true).transform, 'translate(10%, -5%) scale(1.2)');
const cars = [{ id: 'a', images: ['a.png'] }, { id: ID, images: ['b.png'] }];
eq('auto = all', heroCarCandidates(cars, { car: 'auto' }), ['a.png', 'b.png']);
eq('picked first', heroCarCandidates(cars, { car: ID }), ['b.png']);
eq('none', heroCarCandidates(cars, { car: 'none' }), []);
eq('gone car -> auto', heroCarCandidates(cars, { car: '11111111-1111-1111-1111-111111111111' }), ['a.png', 'b.png']);
eq('card layout', heroFrame(withHeroFrame(U, { layout: 'card' })).layout, 'card');
eq('junk layout', heroFrame(U + '&hl=x').layout, 'stage');
eq('image url drops layout', heroImageUrl(withHeroFrame(U, { layout: 'card' })), U);
// Ring brand (hb)
{
  const u = withHeroFrame('https://x/a.png?t=1', { layout: 'card', ringBrand: 'Proton' });
  eq('ring brand kept', heroFrame(u).ringBrand, 'Proton');
  eq('ring brand + card', heroFrame(u).layout, 'card');
  eq('ring brand stripped from image url', heroImageUrl(u), 'https://x/a.png?t=1');
  eq('bad ring brand dropped', heroFrame('https://x/a.png?hb=%3Cscript%3E').ringBrand, '');
  eq('no ring brand', heroFrame('https://x/a.png').ringBrand, '');
}
// opaqueBox: the car's box inside a cut-out (4x4 image, opaque 2x2 at x 1..2, y 2..3)
{
  const w = 4, h = 4, d = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of [[1, 2], [2, 2], [1, 3], [2, 3]]) d[(y * w + x) * 4 + 3] = 255;
  eq('opaque box', opaqueBox(d, w, h), { x: 0.25, y: 0.5, w: 0.5, h: 0.5 });
  eq('empty box', opaqueBox(new Uint8ClampedArray(64), 4, 4), null);
}
console.log(`heroFrame: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
