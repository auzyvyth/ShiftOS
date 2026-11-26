import { useEffect, useState } from 'react';
import { isSeeThroughPhoto } from './img.js';

// PAGE-HERO (2026-11-25): a .png / .webp name does NOT mean see-through. Drevo's
// stock new-car photos are .webp on a white background, and the hero stood them
// in front of the seller as a white box. So the file is opened and its corners
// read: only a photo whose corners are transparent counts as a cut-out.
// `?a=1` makes it a separate cache entry, so a copy the page already loaded
// without CORS (a car card's <img>) cannot taint the canvas.

const cache = new Map(); // url -> Promise<boolean>

export function cornersTransparent(data, w, h, alphaMax = 16) {
  const at = (x, y) => data[(y * w + x) * 4 + 3];
  const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [Math.floor(w / 2), 0]];
  return pts.filter(([x, y]) => at(x, y) <= alphaMax).length >= 3;
}

export function checkSeeThrough(url) {
  if (!isSeeThroughPhoto(url) || typeof document === 'undefined') return Promise.resolve(false);
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const S = 48;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, S, S);
        resolve(cornersTransparent(ctx.getImageData(0, 0, S, S).data, S, S));
      } catch { resolve(false); }
    };
    img.onerror = () => resolve(false);
    img.src = url + (url.includes('?') ? '&' : '?') + 'a=1';
  });
  cache.set(url, p);
  return p;
}

// null while checking, then true / false.
export function useSeeThrough(url) {
  const [state, setState] = useState(() => (isSeeThroughPhoto(url) ? null : false));
  useEffect(() => {
    let off = false;
    if (!isSeeThroughPhoto(url)) { setState(false); return undefined; }
    setState(null);
    checkSeeThrough(url).then((v) => { if (!off) setState(v); });
    return () => { off = true; };
  }, [url]);
  return state;
}

// The first of `urls` that is really see-through (checked in order), else null.
export function useFirstSeeThrough(urls) {
  const key = urls.filter(isSeeThroughPhoto).slice(0, 8).join('|');
  const [hit, setHit] = useState(null);
  useEffect(() => {
    let off = false;
    setHit(null);
    const list = key ? key.split('|') : [];
    (async () => {
      for (const u of list) {
        if (await checkSeeThrough(u)) { if (!off) setHit(u); return; }
      }
    })();
    return () => { off = true; };
  }, [key]);
  return hit;
}

// CAR-RING (2026-11-26): where the car actually is inside a cut-out. Photos carry different empty
// margins, so drawn at one width they came out different sizes and floated at different heights.
// Returns null (not a cut-out) or { x, y, w, h, ar }: the opaque box as fractions of the photo, and
// the photo's width / height. Pure maths in `opaqueBox` (tests/heroFrame.test.mjs covers it).
export function opaqueBox(data, w, h, alphaMin = 40) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= alphaMin) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
}

const boxCache = new Map();
export function seeThroughBox(url) {
  if (!isSeeThroughPhoto(url) || typeof document === 'undefined') return Promise.resolve(null);
  if (boxCache.has(url)) return boxCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const ar = img.naturalWidth / Math.max(1, img.naturalHeight);
        const W = 200, H = Math.max(1, Math.round(W / ar));
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;
        if (!cornersTransparent(d, W, H)) { resolve(null); return; }
        const b = opaqueBox(d, W, H);
        resolve(b && b.w > 0.2 ? { ...b, ar } : null);
      } catch { resolve(null); }
    };
    img.onerror = () => { boxCache.delete(url); resolve(null); }; // a failed load is retried next time
    img.src = url + (url.includes('?') ? '&' : '?') + 'a=1';
  });
  boxCache.set(url, p);
  return p;
}
