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
