// Shared canvas-poster image helpers: the quotation poster
// (FinancingCalculator.jsx) and the loan poster (components/poster) both draw
// remote photos onto a <canvas>, and both need the same service-worker-safe
// loader. One copy.
import { cdnImg } from './img';

// Remote images (car photo, seller avatar) live on the Supabase CDN. A <canvas>
// can only draw a fully-loaded, same-origin-safe HTMLImageElement, so we fetch →
// dataURL → decode into an Image first (this also normalises any format, incl.
// webp). Every step is wrapped so a failed or blocked image never breaks the
// poster — that element simply doesn't render and the layout falls back.

//
// Never fetch the raw storage URL first: the service worker caches car photos
// CacheFirst (vite.config.js `car-images-v1`) and keeps OPAQUE copies from
// plain <img> loads. A cors fetch of that URL gets the opaque copy back
// (status 0, unreadable), so any car already viewed on this device printed
// "No photo". The resizer URL is on another host the worker never caches,
// and also shrinks a multi-MB photo to what the poster draws. The raw URL,
// cache-busted so it misses the worker's cache, is the fallback.
const readDataUrl = (url) => fetch(url, { mode: 'cors' })
  .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('bad status'))))
  .then((blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  }));

export const fetchDataUrl = async (url) => {
  if (!url) return null;
  const sized = cdnImg(url, 1200, 85);
  const bust = `${url}${url.includes('?') ? '&' : '?'}poster=1`;
  for (const candidate of [...new Set([sized, bust])]) {
    try { return await readDataUrl(candidate); } catch { /* try the next */ }
  }
  return null;
};

export const loadImg = (dataUrl) => new Promise((resolve) => {
  if (!dataUrl) return resolve(null);
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = dataUrl;
});

export const roundRectPath = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Cover-crop a loaded image directly into a rounded box on the poster canvas
// (the box fills, centre-crops to the box's aspect, and clips to rounded corners).
export const drawCover = (ctx, img, x, y, w, h, r = 0) => {
  ctx.save();
  if (r > 0) { roundRectPath(ctx, x, y, w, h, r); ctx.clip(); }
  const ar = img.width / img.height, tar = w / h;
  let sw, sh, sx, sy;
  if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / tar; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
};

// Centre-crop a loaded image into a circle on the poster canvas.
export const drawCircle = (ctx, img, cx, cy, r) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
};

