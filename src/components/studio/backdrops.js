// ─── Poster backdrops behind a cut-out car (Studio, Salesman Premium only) ───
// After Remove BG the car used to sit on a flat colour with a blurred copy of
// itself behind it. These scenes are DRAWN (no AI, no server, no cost), and only
// ever BEHIND the car: the car's pixels stay the seller's own photo (CUTOUT-1).
// Pure geometry (alphaBounds, placeCar) is unit-tested: npm run test:backdrops.

export const BACKDROPS = [
  { id: "studio", name: "Studio" },
  { id: "spotlight", name: "Spotlight" },
  { id: "stripes", name: "Stripes" },
  { id: "brand", name: "Brand" },
  { id: "dusk", name: "Dusk" },
  { id: "light", name: "Light" },
];
export const DEFAULT_BACKDROP = "studio";
export const DEFAULT_CAR_FIT = { size: 1, lift: 0 };

// Where the car stands when the slide has no template car zone (fractions of
// the canvas). The floor line sits a third up from the bottom so the caption
// and price below it stay clear.
const DEFAULT_BOX = { x: 0.04, w: 0.92, h: 0.36, floor: 0.66 };

// Bounding box of the opaque pixels in RGBA data, or null when fully clear.
export function alphaBounds(data, w, h, threshold = 24) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// The car's box inside a cut-out PNG, in the image's own pixels. Measured on a
// small copy (the PNG is the full photo size, mostly clear) and cached per image.
const BOUNDS_CACHE = new WeakMap();
export function cutoutBounds(img) {
  if (BOUNDS_CACHE.has(img)) return BOUNDS_CACHE.get(img);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  let box = { x: 0, y: 0, w: iw, h: ih };
  try {
    const k = Math.min(1, 320 / Math.max(iw, ih));
    const sw = Math.max(1, Math.round(iw * k));
    const sh = Math.max(1, Math.round(ih * k));
    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0, sw, sh);
    const b = alphaBounds(cx.getImageData(0, 0, sw, sh).data, sw, sh);
    if (b) {
      // Scale back up, padded one small pixel each side so no edge is clipped.
      const x0 = Math.max(0, Math.floor((b.x - 1) / k));
      const y0 = Math.max(0, Math.floor((b.y - 1) / k));
      const x1 = Math.min(iw, Math.ceil((b.x + b.w + 1) / k));
      const y1 = Math.min(ih, Math.ceil((b.y + b.h + 1) / k));
      box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
  } catch {
    // A tainted canvas cannot be read: fall back to the whole image.
  }
  BOUNDS_CACHE.set(img, box);
  return box;
}

// Where to draw the car. `bounds` = the car inside the image; `zone` = the
// template's car zone in canvas PERCENT (or null); `fit` = { size, lift } from
// the seller's sliders (lift is a fraction of the canvas height, + = up).
// The car is fitted inside the box, centred, standing on the box's bottom edge.
export function placeCar({ bounds, W, H, zone, fit }) {
  const box = zone
    ? { x: (zone.x / 100) * W, y: (zone.y / 100) * H, w: (zone.w / 100) * W, h: (zone.h / 100) * H }
    : { x: DEFAULT_BOX.x * W, y: (DEFAULT_BOX.floor - DEFAULT_BOX.h) * H, w: DEFAULT_BOX.w * W, h: DEFAULT_BOX.h * H };
  const size = Math.min(1.6, Math.max(0.4, Number(fit?.size) || 1));
  const lift = Math.min(0.4, Math.max(-0.4, Number(fit?.lift) || 0));
  const k = Math.min(box.w / bounds.w, box.h / bounds.h) * size;
  const dw = bounds.w * k;
  const dh = bounds.h * k;
  const floorY = box.y + box.h - lift * H;
  return {
    sx: bounds.x, sy: bounds.y, sw: bounds.w, sh: bounds.h,
    dx: box.x + (box.w - dw) / 2,
    dy: floorY - dh,
    dw,
    dh,
    floorY,
  };
}

function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  const n = m ? parseInt(m[1], 16) : 0xdc2626;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const shade = (c, f) => c.map((v) => Math.round(v * f));

function vertical(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, col]) => g.addColorStop(at, col));
  return g;
}

function glow(ctx, x, y, r, inner, sy = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, inner.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// A wall above the floor line and a floor below it, softly joined.
function room(ctx, W, H, floorY, wall, floor) {
  ctx.fillStyle = vertical(ctx, 0, floorY, wall);
  ctx.fillRect(0, 0, W, floorY);
  ctx.fillStyle = vertical(ctx, floorY, H, floor);
  ctx.fillRect(0, floorY, W, H - floorY);
  // Soften the seam so it reads as a curved studio floor, not a hard edge.
  const band = H * 0.025;
  ctx.fillStyle = vertical(ctx, floorY - band, floorY + band, [[0, wall[wall.length - 1][1]], [1, floor[0][1]]]);
  ctx.fillRect(0, floorY - band, W, band * 2);
}

// Paints the whole canvas. `floorY` is where the car's wheels touch down.
export function drawBackdrop(ctx, id, W, H, floorY, accentHex) {
  const a = rgb(accentHex);
  ctx.save();
  if (id === "studio") {
    room(ctx, W, H, floorY,
      [[0, "#24272e"], [1, "#101216"]],
      [[0, "#1b1d22"], [1, "#050608"]]);
    glow(ctx, W / 2, floorY - H * 0.18, W * 0.62, "rgba(255,255,255,0.10)");
    glow(ctx, W / 2, floorY, W * 0.7, "rgba(255,255,255,0.07)", 0.12);
  } else if (id === "spotlight") {
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W / 2, floorY - H * 0.1, W * 0.68, rgba(a, 0.5));
    glow(ctx, W / 2, floorY, W * 0.6, "rgba(255,255,255,0.10)", 0.14);
  } else if (id === "stripes") {
    ctx.fillStyle = vertical(ctx, 0, H, [[0, "#14161b"], [1, "#050608"]]);
    ctx.fillRect(0, 0, W, H);
    const band = (top, thick, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(W, top);
      ctx.lineTo(W, top + thick);
      ctx.lineTo(0, top + thick + H * 0.2);
      ctx.lineTo(0, top + H * 0.2);
      ctx.closePath();
      ctx.fill();
    };
    band(floorY - H * 0.36, H * 0.13, rgba(a, 0.92));
    band(floorY - H * 0.2, H * 0.025, "rgba(255,255,255,0.10)");
    ctx.fillStyle = vertical(ctx, floorY, H, [[0, "rgba(5,6,8,0.55)"], [1, "rgba(5,6,8,0.95)"]]);
    ctx.fillRect(0, floorY, W, H - floorY);
  } else if (id === "brand") {
    room(ctx, W, H, floorY,
      [[0, rgba(shade(a, 0.55), 1)], [1, rgba(shade(a, 0.3), 1)]],
      [[0, rgba(shade(a, 0.22), 1)], [1, rgba(shade(a, 0.06), 1)]]);
    glow(ctx, W / 2, floorY - H * 0.14, W * 0.6, "rgba(255,255,255,0.14)");
  } else if (id === "dusk") {
    room(ctx, W, H, floorY,
      [[0, "#141217"], [0.7, "#3a2420"], [1, "#6b3a26"]],
      [[0, "#1d1716"], [1, "#070606"]]);
    glow(ctx, W / 2, floorY, W * 0.8, "rgba(255,170,100,0.22)", 0.18);
  } else if (id === "light") {
    room(ctx, W, H, floorY,
      [[0, "#f4f4f5"], [1, "#e2e2e5"]],
      [[0, "#d6d6da"], [1, "#a3a3aa"]]);
    glow(ctx, W / 2, floorY - H * 0.16, W * 0.6, "rgba(255,255,255,0.7)");
  }
  ctx.restore();
}

// Soft ground shadow under the car's wheels, so it stands instead of floating.
export function drawCarShadow(ctx, place, light = false) {
  const cx = place.dx + place.dw / 2;
  const y = place.floorY - place.dh * 0.015;
  const strong = light ? 0.42 : 0.6;
  glow(ctx, cx, y, place.dw * 0.52, `rgba(0,0,0,${strong})`, 0.07);
  glow(ctx, cx, y, place.dw * 0.42, `rgba(0,0,0,${strong})`, 0.03);
}
