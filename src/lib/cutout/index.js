// Cut the car out of a photo, on the phone (CUTOUT-1). Returns a PNG with a
// transparent background at the photo's own resolution (capped at MAX_SIDE).
// The car's pixels are the seller's real photo: the model only decides which
// pixels to keep, it never redraws anything (unlike an image-generation model).
//
// First use downloads the model once (~47 MB) into Cache Storage; after that it
// works offline. remove.bg, the old provider, shuts its self-service API on
// 1 Dec 2026, which is why this exists.

export const CUTOUT_MODEL_URL = '/models/isnet-wq8-v1.onnx';
export const CUTOUT_MODEL_BYTES = 46728969;
const CUTOUT_CACHE = 'xd-cutout-v1'; // same name as the worker's
const SIZE = 1024;      // the model's fixed input; other sizes fail inside it
const MAX_SIDE = 2048;  // bigger photos are scaled down first, to spare phone memory

let worker = null;
let nextId = 1;
const pending = new Map();
let progressListener = null;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./cutout.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress' || m.type === 'working') { progressListener?.(m); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === 'done') p.resolve(m.mask);
    else p.reject(new Error(m.message));
  };
  worker.onerror = (e) => {
    // a crashed worker (usually out of memory) takes every pending job with it
    for (const p of pending.values()) p.reject(new Error(e.message || 'cutout_worker_crashed'));
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

/** True once the model is on this device, so the UI can skip the download warning. */
export async function isCutoutModelSaved() {
  try {
    const cache = await caches.open(CUTOUT_CACHE);
    return !!(await cache.match(CUTOUT_MODEL_URL));
  } catch { return false; }
}

async function toBitmap(src) {
  // fetch -> blob avoids a tainted canvas for cross-origin (Supabase) photos
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * @param {string|Blob} src  photo URL (http, blob:) or a Blob/File
 * @param {{ onProgress?: (p: {stage: 'download'|'working', loaded?: number, total?: number}) => void }} [opts]
 * @returns {Promise<Blob>} PNG with the background made transparent
 */
export async function cutOutBackground(src, { onProgress } = {}) {
  const bmp = await toBitmap(src);
  const srcW = bmp.width, srcH = bmp.height;
  const k = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const w = Math.round(srcW * k), h = Math.round(srcH * k);

  // Input: the photo squashed to 1024x1024, scaled by its brightest channel
  // value and centred on 0 (exactly how the model was trained/exported).
  const inC = canvas(SIZE, SIZE);
  const inCtx = inC.getContext('2d', { willReadFrequently: true });
  inCtx.drawImage(bmp, 0, 0, SIZE, SIZE);
  const px = inCtx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > max) max = px[i];
    if (px[i + 1] > max) max = px[i + 1];
    if (px[i + 2] > max) max = px[i + 2];
  }
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let p = 0, i = 0; p < plane; p++, i += 4) {
    input[p] = px[i] / max - 0.5;
    input[plane + p] = px[i + 1] / max - 0.5;
    input[2 * plane + p] = px[i + 2] / max - 0.5;
  }

  const id = nextId++;
  progressListener = (m) => onProgress?.(m.type === 'progress'
    ? { stage: 'download', loaded: m.loaded, total: m.total }
    : { stage: 'working' });
  let mask;
  try {
    mask = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage(
        { id, modelUrl: CUTOUT_MODEL_URL, modelBytes: CUTOUT_MODEL_BYTES, input, size: SIZE },
        [input.buffer],
      );
    });
  } finally {
    progressListener = null;
  }

  // Mask -> alpha. Stretch to 0..1 first; the raw output is not normalised.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < mask.length; i++) { const v = mask[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const mC = canvas(SIZE, SIZE);
  const mCtx = mC.getContext('2d');
  const mImg = mCtx.createImageData(SIZE, SIZE);
  for (let p = 0, i = 0; p < plane; p++, i += 4) {
    mImg.data[i] = mImg.data[i + 1] = mImg.data[i + 2] = 255;
    mImg.data[i + 3] = Math.round(((mask[p] - lo) / span) * 255);
  }
  mCtx.putImageData(mImg, 0, 0);

  // Keep the real photo's pixels where the (smoothly upscaled) mask says car.
  const out = canvas(w, h);
  const ctx = out.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mC, 0, 0, w, h);
  bmp.close?.();

  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('cutout_encode_failed'))), 'image/png');
  });
}

/** Plain words for whatever went wrong. */
export function cutoutErrorText(err) {
  const m = String(err?.message || err || '');
  if (/model_http_|Failed to fetch|NetworkError|network/i.test(m)) {
    return "Couldn't download the cut-out tool. Check your connection and try again.";
  }
  if (/memory|alloc|crashed/i.test(m)) {
    return 'This phone ran out of memory. Close other apps and try again.';
  }
  return "Couldn't remove the background from this photo. Try again, or use another photo.";
}
