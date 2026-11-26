// Hero photo trim box. Run: npm run test:herophoto
import { opaqueBounds, heroExt, heroErrorText } from '../src/utils/heroPhoto.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const W = 100, H = 100;
const px = (fill) => { const d = new Uint8ClampedArray(W * H * 4); fill(d); return d; };
const box = (d, x0, y0, x1, y1, a = 255) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d[(y * W + x) * 4 + 3] = a; };

is('empty cut-out = null', opaqueBounds(px(() => {}), W, H), null);
const b = opaqueBounds(px((d) => box(d, 30, 20, 69, 99)), W, H);
is('box hugs the person, small margin', [b.x, b.y, b.x + b.w, b.y + b.h], [28, 18, 72, 100]);
is('faint halo is ignored', opaqueBounds(px((d) => box(d, 0, 0, 99, 99, 10)), W, H), null);
is('webp ext', heroExt({ type: 'image/webp' }), 'webp');
is('jpg ext', heroExt({ type: 'image/jpeg' }), 'jpg');
is('missing function = not available yet', heroErrorText({ message: 'Could not find the function public.set_my_hero_photo(p_url)' }).includes('not available yet'), true);
console.log(`heroPhoto: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
