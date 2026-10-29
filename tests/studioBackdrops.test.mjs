// npm run test:backdrops
import assert from 'node:assert/strict';
import { alphaBounds, placeCar } from '../src/components/studio/backdrops.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

const rgbaWith = (w, h, opaque) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of opaque) d[(y * w + x) * 4 + 3] = 255;
  return d;
};

t('alphaBounds finds the car inside a mostly clear cut-out', () => {
  const d = rgbaWith(10, 8, [[2, 3], [7, 3], [4, 6]]);
  assert.deepEqual(alphaBounds(d, 10, 8), { x: 2, y: 3, w: 6, h: 4 });
});

t('alphaBounds ignores faint edge noise and returns null when clear', () => {
  const d = new Uint8ClampedArray(4 * 4 * 4);
  d[3] = 10; // below threshold
  assert.equal(alphaBounds(d, 4, 4), null);
});

t('car stands on the floor line, centred, inside the default box', () => {
  const p = placeCar({ bounds: { x: 100, y: 200, w: 900, h: 300 }, W: 1080, H: 1920, zone: null, fit: null });
  assert.ok(Math.abs(p.floorY - 0.66 * 1920) < 1e-6);
  assert.ok(Math.abs(p.dy + p.dh - p.floorY) < 1e-6);
  assert.ok(Math.abs(p.dx + p.dw / 2 - 540) < 1e-6);
  assert.ok(p.dw <= 0.92 * 1080 + 1e-6);
  assert.deepEqual([p.sx, p.sy, p.sw, p.sh], [100, 200, 900, 300]);
  // aspect kept
  assert.ok(Math.abs(p.dw / p.dh - 3) < 1e-9);
});

t('template car zone (percent) is used when present', () => {
  const p = placeCar({ bounds: { x: 0, y: 0, w: 400, h: 200 }, W: 1000, H: 2000, zone: { x: 10, y: 20, w: 80, h: 20 }, fit: null });
  assert.equal(p.floorY, 800); // zone bottom = (20+20)% of 2000
  assert.ok(p.dw <= 800 && p.dh <= 400);
  assert.ok(Math.abs(p.dx + p.dw / 2 - 500) < 1e-6);
});

t('size scales and lift raises; both are clamped', () => {
  const base = placeCar({ bounds: { x: 0, y: 0, w: 300, h: 100 }, W: 1080, H: 1920, zone: null, fit: { size: 1, lift: 0 } });
  const big = placeCar({ bounds: { x: 0, y: 0, w: 300, h: 100 }, W: 1080, H: 1920, zone: null, fit: { size: 1.2, lift: 0.1 } });
  assert.ok(Math.abs(big.dw - base.dw * 1.2) < 1e-6);
  assert.ok(Math.abs(base.floorY - big.floorY - 192) < 1e-6);
  const wild = placeCar({ bounds: { x: 0, y: 0, w: 300, h: 100 }, W: 1080, H: 1920, zone: null, fit: { size: 99, lift: 99 } });
  assert.ok(Math.abs(wild.dw - base.dw * 1.6) < 1e-6);
  assert.ok(Math.abs(base.floorY - wild.floorY - 0.4 * 1920) < 1e-6);
});

console.log(`\n${n} passed`);
