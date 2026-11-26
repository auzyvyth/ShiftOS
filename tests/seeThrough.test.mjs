import assert from 'node:assert/strict';
import { cornersTransparent } from '../src/utils/seeThrough.js';

const img = (w, h, alphaAt) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = alphaAt(x, y);
  return d;
};
// A cut-out: clear edges, solid middle.
assert.equal(cornersTransparent(img(10, 10, (x, y) => (x > 2 && x < 7 && y > 2 ? 255 : 0)), 10, 10), true);
// A .webp on white (every pixel opaque): not a cut-out.
assert.equal(cornersTransparent(img(10, 10, () => 255), 10, 10), false);
// A person cut-out standing on the bottom edge: bottom corners can be solid, top ones clear.
assert.equal(cornersTransparent(img(10, 10, (x, y) => (y > 6 ? 255 : 0)), 10, 10), true);
console.log('seeThrough: 3 passed');
