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
const CUTOUT_CACHE = 'xd-cutout-v1'; // same name as cutout.core.js
const SIZE = 1024;      // the model's fixed input; other sizes fail inside it
const MAX_SIDE = 2048;  // bigger photos are scaled down first, to spare phone memory

const NO_GPU_KEY = 'xd_cutout_nogpu'; // set on a device where the GPU path failed once

// One worker per engine. Vite needs each `new Worker(new URL(...))` written
// out literally to bundle it, hence the two branches.
const workers = { gpu: null, cpu: null };
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject, kind }
let progressListener = null;
let gpuOk = null;          // null = not checked yet on this page

function getWorker(kind) {
  if (workers[kind]) return workers[kind];
  const w = kind === 'gpu'
    ? new Worker(new URL('./cutout.gpu.worker.js', import.meta.url), { type: 'module' })
    : new Worker(new URL('./cutout.worker.js', import.meta.url), { type: 'module' });
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress' || m.type === 'working') { progressListener?.(m); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === 'done') p.resolve(m.mask);
    else p.reject(new Error(m.message));
  };
  w.onerror = (e) => {
    // a crashed worker (usually out of memory) takes its pending jobs with it
    for (const [id, p] of pending) {
      if (p.kind === kind) { p.reject(new Error(e.message || 'cutout_worker_crashed')); pending.delete(id); }
    }
    w.terminate();
    workers[kind] = null;
  };
  workers[kind] = w;
  return w;
}

/** The graphics chip is used when the browser offers one and it has never failed here. */
async function canUseGpu() {
  if (gpuOk !== null) return gpuOk;
  try { if (localStorage.getItem(NO_GPU_KEY)) return (gpuOk = false); } catch { /* storage blocked */ }
  try {
    gpuOk = !!(navigator.gpu && (await navigator.gpu.requestAdapter()));
  } catch {
    gpuOk = false;
  }
  return gpuOk;
}

function giveUpOnGpu() {
  gpuOk = false;
  try { localStorage.setItem(NO_GPU_KEY, '1'); } catch { /* storage blocked */ }
  workers.gpu?.terminate();
  workers.gpu = null;
}

function runJob(kind, input) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, kind });
    // a copy, not a transfer: the processor path may need the same input after a GPU failure
    getWorker(kind).postMessage({ id, modelUrl: CUTOUT_MODEL_URL, modelBytes: CUTOUT_MODEL_BYTES, input, size: SIZE });
  });
}

const isNetworkError = (err) => /model_http_|Failed to fetch|NetworkError|network/i.test(String(err?.message || err));

/** True once the model is on this device, so the UI can skip the download warning. */
export async function isCutoutModelSaved() {
  try {
    const cache = await caches.open(CUTOUT_CACHE);
    return !!(await cache.match(CUTOUT_MODEL_URL));
  } catch { return false; }
}

// fetch -> blob avoids a tainted canvas for cross-origin (Supabase) photos.
// The service worker keeps car photos (`car-images-v1`, CacheFirst) as OPAQUE
// copies from <img> tags, and handing one to a CORS fetch fails as "Failed to
// fetch". A cache-busting param misses that copy and gets a readable one
// (same trick as the Studio's own image loader; Supabase ignores the param).
async function fetchPhoto(src) {
  if (/^(blob|data):/.test(src)) return (await fetch(src)).blob();
  const busted = src + (src.includes('?') ? '&' : '?') + 'cors=1';
  let res;
  try {
    res = await fetch(busted);
  } catch {
    res = await fetch(busted, { cache: 'reload' }).catch(() => null);
  }
  if (!res || !res.ok) throw new Error('photo_load_failed');
  return res.blob();
}

async function toBitmap(src) {
  const blob = typeof src === 'string' ? await fetchPhoto(src) : src;
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

  progressListener = (m) => onProgress?.(m.type === 'progress'
    ? { stage: 'download', loaded: m.loaded, total: m.total }
    : { stage: 'working' });
  let mask;
  try {
    if (await canUseGpu()) {
      try {
        mask = await runJob('gpu', input);
        // a bad GPU driver can return garbage without an error: NaN, or one flat value
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < mask.length; i += 97) { const v = mask[i]; if (v !== v) throw new Error('gpu_bad_output'); if (v < lo) lo = v; if (v > hi) hi = v; }
        if (!(hi > lo)) throw new Error('gpu_bad_output');
      } catch (err) {
        mask = null;
        if (isNetworkError(err)) throw err; // a download problem, not the GPU's fault
        giveUpOnGpu();                      // this device's GPU path is broken: processor from now on
      }
    }
    if (!mask) mask = await runJob('cpu', input);
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
  if (/photo_load_failed/.test(m)) {
    return "Couldn't open this photo. Try again, or pick the photo again with Change.";
  }
  if (/model_http_|Failed to fetch|NetworkError|network/i.test(m)) {
    return "Couldn't download the cut-out tool. Check your connection and try again.";
  }
  if (/memory|alloc|crashed/i.test(m)) {
    return 'This phone ran out of memory. Close other apps and try again.';
  }
  return "Couldn't remove the background from this photo. Try again, or use another photo.";
}
