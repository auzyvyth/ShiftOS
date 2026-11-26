// FRAME-1 (owner, 2026-11-26): every cut-out new-car photo uploaded in the console is redrawn
// onto ONE frame, so every model shows at the same size everywhere it appears (cards, the
// configurator, the business-card ring, the model pages). The photos arrive with any amount of
// empty margin; drawn as they came, one car was big and the next small ("looks ganjil").
//
// The frame: a 4:3 canvas (cards crop to 4:3, so nothing is cut off), the car cropped to its own
// outline, scaled to the SAME width (or less when it would be too tall), centred, tyres standing
// on the same floor line. Only see-through photos are touched: a photo with a background is
// returned as it was (null).

export const FRAME_W = 1200;
export const FRAME_H = 900;
export const CAR_MAX_W = 0.86;   // of the frame width
export const CAR_MAX_H = 0.62;   // of the frame height (a tall SUV gives way, never overflows)
export const FLOOR = 0.82;       // the tyres' line, from the top

// box = the car's opaque box in source pixels {x, y, w, h}. Returns where to draw it on the frame.
export function frameRect(box) {
  const s = Math.min((FRAME_W * CAR_MAX_W) / box.w, (FRAME_H * CAR_MAX_H) / box.h);
  const w = box.w * s;
  const h = box.h * s;
  return { x: (FRAME_W - w) / 2, y: FRAME_H * FLOOR - h, w, h, scale: s };
}

// Opaque box in pixels; tiny specks (alpha < 40) do not count, same as seeThrough.opaqueBox.
export function opaquePixels(data, w, h, alphaMin = 40) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[(row + x) * 4 + 3] >= alphaMin) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function cornersClear(data, w, h) {
  const at = (x, y) => data[(y * w + x) * 4 + 3];
  const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [Math.floor(w / 2), 0]];
  return pts.filter(([x, y]) => at(x, y) <= 16).length >= 3;
}

// Blob/File in, framed WebP (PNG where WebP cannot be written) out; null = not a cut-out.
export async function frameCutout(blob) {
  if (typeof document === 'undefined' || !blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return null;
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const d = sctx.getImageData(0, 0, W, H).data;
    if (!cornersClear(d, W, H)) return null;
    const box = opaquePixels(d, W, H);
    if (!box) return null;
    const r = frameRect(box);
    const out = document.createElement('canvas');
    out.width = FRAME_W; out.height = FRAME_H;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(src, box.x, box.y, box.w, box.h, r.x, r.y, r.w, r.h);
    const webp = await new Promise((resolve) => out.toBlob(resolve, 'image/webp', 0.9));
    if (webp && webp.type === 'image/webp') return webp;
    return await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
