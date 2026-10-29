// npm run test:scope
import assert from 'node:assert/strict';
import {
  linkKey, patchElements, removeElements, shiftElements,
  patchOtherLayers, removeOtherLayers, addToOthers, patchPhotos,
} from '../src/components/studio/scope.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

const slides = () => [
  { id: 's1', elements: [{ id: 'a1', link: 'L', content: 'x' }, { id: 'b1', content: 'solo' }, { id: 'watermark', content: 'W' }],
    layers: [{ id: 'g1', link: 'overlay', x: 0, y: 0, width: 100, height: 100 }], bgAdjust: { brightness: 1, contrast: 1 } },
  { id: 's2', elements: [{ id: 'a2', link: 'L', content: 'x' }, { id: 'watermark', content: 'W' }],
    layers: [{ id: 'g2', link: 'overlay', x: 0, y: 0, width: 100, height: 100 }], bgAdjust: { brightness: 0.8, contrast: 1.2 } },
  { id: 's3', elements: [{ id: 'c3', content: 'other' }], layers: [], bgAdjust: { brightness: 1, contrast: 1 } },
];

t('linkKey: link field, the fixed watermark id, else null', () => {
  assert.equal(linkKey({ id: 'q', link: 'L' }), 'L');
  assert.equal(linkKey({ id: 'watermark' }), 'watermark');
  assert.equal(linkKey({ id: 'q' }), null);
  assert.equal(linkKey(null), null);
});

t('This slide: a patch touches only the active element', () => {
  const s = patchElements(slides(), 0, 'a1', { content: 'new' }, false);
  assert.equal(s[0].elements[0].content, 'new');
  assert.equal(s[1].elements[0].content, 'x');
});

t('All slides: a patch reaches every linked copy, nothing else', () => {
  const before = slides();
  const s = patchElements(before, 0, 'a1', { content: 'new', fontSize: 60 }, true);
  assert.equal(s[1].elements[0].content, 'new');
  assert.equal(s[1].elements[0].fontSize, 60);
  assert.equal(s[0].elements[1].content, 'solo');
  assert.equal(s[2], before[2], 'a slide with no copy is the same object');
});

t('All slides on an unlinked element edits only itself', () => {
  const s = patchElements(slides(), 0, 'b1', { content: 'z' }, true);
  assert.equal(s[0].elements[1].content, 'z');
  assert.deepEqual(s[1].elements.map((e) => e.content), ['x', 'W']);
});

t('the watermark is linked on every slide', () => {
  const s = patchElements(slides(), 1, 'watermark', { opacity: 0.3 }, true);
  assert.equal(s[0].elements[2].opacity, 0.3);
  assert.equal(s[1].elements[1].opacity, 0.3);
});

t('remove: this slide vs all slides', () => {
  assert.equal(removeElements(slides(), 0, 'a1', false)[1].elements.length, 2);
  const s = removeElements(slides(), 0, 'a1', true);
  assert.deepEqual(s[0].elements.map((e) => e.id), ['b1', 'watermark']);
  assert.deepEqual(s[1].elements.map((e) => e.id), ['watermark']);
});

t('shift: front / up / back move the element in the stack', () => {
  assert.deepEqual(shiftElements(slides(), 0, 'a1', 'front', false)[0].elements.map((e) => e.id), ['b1', 'watermark', 'a1']);
  assert.deepEqual(shiftElements(slides(), 0, 'a1', 'up', false)[0].elements.map((e) => e.id), ['b1', 'a1', 'watermark']);
  assert.deepEqual(shiftElements(slides(), 0, 'watermark', 'back', true)[1].elements.map((e) => e.id), ['watermark', 'a2']);
});

t('other slides\' layers follow a linked patch and stay inside the canvas', () => {
  const s = patchOtherLayers(slides(), 0, 'overlay', { x: 90, width: 50 });
  assert.equal(s[0].layers[0].x, 0, 'the active slide is left to the layer editor');
  assert.equal(s[1].layers[0].width, 50);
  assert.equal(s[1].layers[0].x, 50, 'clamped to 100 - width');
  assert.equal(patchOtherLayers(slides(), 0, null, { x: 5 })[1].layers[0].x, 0, 'no link: nothing');
});

t('remove linked layers from the other slides', () => {
  const s = removeOtherLayers(slides(), 0, 'overlay');
  assert.equal(s[0].layers.length, 1);
  assert.equal(s[1].layers.length, 0);
});

t('addToOthers gives each other slide its own fresh copy', () => {
  let k = 0;
  const s = addToOthers(slides(), 1, 'elements', () => ({ id: 'n' + k++, link: 'N' }));
  assert.equal(s[1].elements.length, 2);
  assert.equal(s[0].elements.at(-1).id, 'n0');
  assert.equal(s[2].elements.at(-1).id, 'n1');
});

t('photo: one adjustment on all slides keeps each slide\'s others', () => {
  const s = patchPhotos(slides(), 0, (sl) => ({ bgAdjust: { ...sl.bgAdjust, brightness: 1.3 } }), true);
  assert.deepEqual(s.map((x) => x.bgAdjust.brightness), [1.3, 1.3, 1.3]);
  assert.equal(s[1].bgAdjust.contrast, 1.2);
  const one = patchPhotos(slides(), 1, () => ({ backdrop: 'dusk' }), false);
  assert.deepEqual(one.map((x) => x.backdrop), [undefined, 'dusk', undefined]);
});

console.log(`\n${n} passed`);
