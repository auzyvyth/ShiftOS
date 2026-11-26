import assert from 'node:assert/strict';
import { frameRect, opaquePixels, FRAME_W, FRAME_H, FLOOR, CAR_MAX_W, CAR_MAX_H } from '../src/utils/cutoutFrame.js';

// Two cars with very different margins/sizes come out the same width, on the same floor.
const small = frameRect({ x: 300, y: 200, w: 400, h: 180 });   // a car in a small middle patch
const big = frameRect({ x: 0, y: 64, w: 3000, h: 1350 });       // a car filling a huge photo
assert.equal(Math.round(small.w), Math.round(FRAME_W * CAR_MAX_W));
assert.equal(Math.round(big.w), Math.round(FRAME_W * CAR_MAX_W));
for (const r of [small, big]) {
  assert.equal(Math.round(r.y + r.h), Math.round(FRAME_H * FLOOR)); // tyres on one line
  assert.equal(Math.round(r.x + r.w / 2), FRAME_W / 2);           // centred
}
// A tall car gives way on height, never overflows the frame.
const tall = frameRect({ x: 0, y: 0, w: 500, h: 400 });
assert.ok(tall.h <= FRAME_H * CAR_MAX_H + 0.01 && tall.w < FRAME_W * CAR_MAX_W);
assert.ok(tall.y >= 0);

// opaquePixels finds the car, ignores faint specks.
const w = 10, h = 6, d = new Uint8ClampedArray(w * h * 4);
const put = (x, y, a) => { d[(y * w + x) * 4 + 3] = a; };
put(0, 0, 20); put(3, 2, 255); put(7, 4, 200);
assert.deepEqual(opaquePixels(d, w, h), { x: 3, y: 2, w: 5, h: 3 });
assert.equal(opaquePixels(new Uint8ClampedArray(16), 2, 2), null);
console.log('cutoutFrame: all passed');
