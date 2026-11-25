// The seller's HERO photo (PAGE-HERO, 2026-11-25): the big picture on a Premium
// page. Usually a see-through cut-out made on the phone (cutOutBackground),
// trimmed to the person so they fill the hero instead of floating in empty
// space, and saved as WebP (keeps the see-through pixels; a JPG would paint them
// black). A plain photo is saved as JPG and the page shows it in a frame.
// Browser only (canvas). Stored at avatars/<uid>/hero.<ext>; the URL is written
// by set_my_hero_photo, which checks it is the caller's own file.

export const HERO_MAX = 1400;   // longest side saved (the hero shows it ~600px tall, 2x screens)
const ALPHA_MIN = 24;           // a pixel this see-through or more counts as background

async function toImage(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try { const img = new Image(); img.src = url; await img.decode(); return img; }
  finally { URL.revokeObjectURL(url); }
}

const toBlob = (canvas, type, q) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('hero_encode_failed'))), type, q);
});

// Box around the pixels that are not background, plus a small margin. Exported
// for the test: `data` is RGBA bytes, w x h.
export function opaqueBounds(data, w, h, alphaMin = ALPHA_MIN) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= alphaMin) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // nothing kept: the cut-out found no person
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  return { x: Math.max(0, x0 - m), y: Math.max(0, y0 - m), w: Math.min(w, x1 + m + 1) - Math.max(0, x0 - m), h: Math.min(h, y1 + m + 1) - Math.max(0, y0 - m) };
}

// A cut-out PNG -> trimmed WebP (PNG where the browser cannot write WebP).
// Throws 'hero_empty' when the cut-out kept (almost) nothing.
export async function prepareCutout(pngBlob) {
  const img = await toImage(pngBlob);
  const src = document.createElement('canvas');
  src.width = img.width; src.height = img.height;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const box = opaqueBounds(sctx.getImageData(0, 0, src.width, src.height).data, src.width, src.height);
  if (!box || box.w * box.h < src.width * src.height * 0.03) throw new Error('hero_empty');
  const k = Math.min(1, HERO_MAX / Math.max(box.w, box.h));
  const out = document.createElement('canvas');
  out.width = Math.round(box.w * k); out.height = Math.round(box.h * k);
  out.getContext('2d').drawImage(src, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  const webp = await toBlob(out, 'image/webp', 0.9);
  if (webp.type === 'image/webp') return webp;
  return toBlob(out, 'image/png');
}

// A plain photo -> JPG, longest side HERO_MAX.
export async function preparePlain(file) {
  const img = await toImage(file);
  const k = Math.min(1, HERO_MAX / Math.max(img.width, img.height));
  const out = document.createElement('canvas');
  out.width = Math.round(img.width * k); out.height = Math.round(img.height * k);
  out.getContext('2d').drawImage(img, 0, 0, out.width, out.height);
  return toBlob(out, 'image/jpeg', 0.85);
}

export const heroExt = (blob) => (blob?.type === 'image/webp' ? 'webp' : blob?.type === 'image/png' ? 'png' : 'jpg');

// Words for a refused save (set_my_hero_photo's exceptions) and other failures.
export function heroErrorText(err) {
  const m = String(err?.message || err || '');
  if (/hero_empty/.test(m)) return "Couldn't find you in this photo. Try one where you stand out from the background.";
  if (/set_my_hero_photo|function .* does not exist|PGRST202/.test(m)) return 'Hero photos switch on after tonight\'s update. Try again tomorrow.';
  if (/bad_hero_url|not_a_seller|not_signed_in/.test(m)) return "Couldn't save this photo. Sign in again and retry.";
  return "Couldn't save the photo. Check your connection and try again.";
}
