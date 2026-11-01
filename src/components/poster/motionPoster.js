// Moving loan poster (IDEA-29). Draws ONE frame at time t (seconds) onto a
// 1080x1920 canvas, so the same frames can later be recorded to MP4. Five
// designs (MOTION_DESIGNS in MotionPosterSheet.jsx). The car is always the
// seller's own photos; nothing here draws a car.
// Numbers come from loanPosterNumbers() (src/utils/loanPoster.js), never here.
import { drawCover, roundRectPath } from '../../utils/posterImage';
import { fmtRM, POSTER_COPY } from '../../utils/loanPoster';

export const MOTION_W = 1080;
export const MOTION_H = 1920;
export const MOTION_LEN = 8; // seconds; the last ~2s hold still

export const MOTION_TEMPLATES = [
  { key: 'slide', label: 'Slide in' },
  { key: 'full', label: 'Full photo' },
  { key: 'swap', label: 'Photo swap' },
];
export const TEMPLATE_LEN = { slide: 8, full: 8, swap: 8, beats: 10, wide: 10, stretch: 12.5, calc: 14 };

const RED = '#dc2626';
const INK = '#080C14';
const DISPLAY = "'Bebas Neue', 'Outfit', sans-serif";
const BODY = "'Outfit', system-ui, sans-serif";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
// 0 -> 1 between start and start + dur seconds, eased.
const ramp = (t, start, dur = 0.6) => easeOut((t - start) / dur);

// Photo with a slow drift (4% over the whole poster, like the Live presenter).
function drawDrift(ctx, img, x, y, w, h, t, r = 0, from = 1.08) {
  if (!img) {
    ctx.fillStyle = '#1f2937';
    roundRectPath(ctx, x, y, w, h, r); ctx.fill();
    return;
  }
  const s = from - (from - 1) * easeOut(t / MOTION_LEN);
  const dw = w * s, dh = h * s;
  ctx.save();
  if (r > 0) { roundRectPath(ctx, x, y, w, h, r); ctx.clip(); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  drawCover(ctx, img, x - (dw - w) / 2, y - (dh - h) / 2, dw, dh, 0);
  ctx.restore();
}

function text(ctx, str, x, y, { font, color = '#fff', align = 'left', alpha = 1, dy = 0 }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y + dy);
  ctx.restore();
}

// Fit a line into maxW by shrinking the font size.
function fitFont(ctx, str, size, maxW, family, weight = '') {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 24 && ctx.measureText(str).width > maxW) { s -= 4; ctx.font = `${weight} ${s}px ${family}`; }
  return `${weight} ${s}px ${family}`;
}

// A monthly figure counts up from 0 over `dur` seconds.
const countUp = (value, t, start, dur = 0.9) => Math.round(value * ramp(t, start, dur));

function tenureRows(ctx, rows, x, y, w, t, start, c, { dark = true } = {}) {
  const rowH = 150, gap = 18;
  rows.forEach((row, i) => {
    const s = start + i * 0.3;
    const a = ramp(t, s, 0.5);
    if (a <= 0) return;
    const yy = y + i * (rowH + gap);
    const slide = (1 - a) * 80;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.07)' : '#ffffff';
    roundRectPath(ctx, x + slide, yy, w, rowH, 28); ctx.fill();
    ctx.restore();
    text(ctx, `${row.years} ${c.tenure}`, x + 44 + slide, yy + 92, {
      font: `600 44px ${BODY}`, color: dark ? 'rgba(255,255,255,0.7)' : '#6b7280', alpha: a,
    });
    const rm = `RM ${fmtRM(countUp(row.monthly, t, s + 0.1))}`;
    text(ctx, rm, x + w - 44 + slide - 90, yy + 104, {
      font: `400 96px ${DISPLAY}`,
      color: i === 1 ? RED : (dark ? '#fff' : INK), align: 'right', alpha: a,
    });
    text(ctx, c.perMonth, x + w - 40 + slide, yy + 100, {
      font: `500 36px ${BODY}`, color: dark ? 'rgba(255,255,255,0.6)' : '#6b7280', align: 'right', alpha: a,
    });
  });
  return rows.length * (rowH + gap);
}

function sellerBar(ctx, f, t, start, y) {
  const a = ramp(t, start, 0.6);
  if (a <= 0 || !f.seller) return;
  const slide = (1 - a) * 60;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = RED;
  roundRectPath(ctx, 60, y + slide, MOTION_W - 120, 130, 65); ctx.fill();
  ctx.restore();
  text(ctx, f.seller, MOTION_W / 2, y + 84 + slide, {
    font: fitFont(ctx, f.seller, 52, MOTION_W - 220, BODY, '700'), align: 'center', alpha: a,
  });
}

function offerPill(ctx, f, t, start, y, cx = MOTION_W / 2) {
  if (!f.offer) return;
  const a = ramp(t, start, 0.5);
  if (a <= 0) return;
  // One soft pop when it lands, then still.
  const pop = 1 + 0.06 * Math.sin(Math.PI * clamp01((t - start) / 0.5));
  ctx.save();
  ctx.font = `700 44px ${BODY}`;
  const w = Math.min(Math.min(cx, MOTION_W - cx) * 2 - 80, ctx.measureText(f.offer).width + 90);
  ctx.translate(cx, y);
  ctx.scale(pop, pop);
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, -w / 2, -48, w, 96, 48); ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = fitFont(ctx, f.offer, 44, w - 60, BODY, '700');
  ctx.fillText(f.offer, 0, 16);
  ctx.restore();
}

function footnote(ctx, c, t, start) {
  text(ctx, c.disclaimer, MOTION_W / 2, MOTION_H - 50, {
    font: `400 28px ${BODY}`, color: 'rgba(255,255,255,0.5)', align: 'center', alpha: ramp(t, start, 0.8),
  });
}

// --- Template 1: photo on top, everything slides in underneath --------------
function drawSlide(ctx, t, f, imgs, c) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
  const enter = ramp(t, 0, 0.8);
  ctx.save();
  ctx.globalAlpha = enter;
  drawDrift(ctx, imgs[0], 0, -60 * (1 - enter), MOTION_W, 860, t, 0);
  ctx.restore();
  const g = ctx.createLinearGradient(0, 640, 0, 880);
  g.addColorStop(0, 'rgba(8,12,20,0)'); g.addColorStop(1, INK);
  ctx.fillStyle = g; ctx.fillRect(0, 640, MOTION_W, 240);

  const ta = ramp(t, 0.5);
  text(ctx, f.headline, 60, 830, { font: `400 34px ${BODY}`, color: RED, alpha: ta, dy: (1 - ta) * 30 });
  text(ctx, f.title, 60, 920, { font: fitFont(ctx, f.title, 96, MOTION_W - 120, DISPLAY), alpha: ta, dy: (1 - ta) * 30 });
  const pa = ramp(t, 1.0);
  text(ctx, `RM ${fmtRM(f.price)}`, 60, 1010, { font: `600 60px ${BODY}`, alpha: pa, dy: (1 - pa) * 30 });
  text(ctx, f.working, 60, 1062, { font: `400 32px ${BODY}`, color: 'rgba(255,255,255,0.55)', alpha: pa });
  tenureRows(ctx, f.rows, 60, 1110, MOTION_W - 120, t, 1.6, c);
  offerPill(ctx, f, t, 3.0, 1650);
  sellerBar(ctx, f, t, 3.4, 1720);
  footnote(ctx, c, t, 3.8);
}

// --- Template 2: full-bleed photo, one big monthly ---------------------------
function drawFull(ctx, t, f, imgs, c) {
  drawDrift(ctx, imgs[0], 0, 0, MOTION_W, MOTION_H, t, 0, 1.12);
  const g = ctx.createLinearGradient(0, MOTION_H * 0.35, 0, MOTION_H);
  g.addColorStop(0, 'rgba(8,12,20,0)'); g.addColorStop(0.45, 'rgba(8,12,20,0.85)'); g.addColorStop(1, INK);
  ctx.fillStyle = g; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
  const top = ctx.createLinearGradient(0, 0, 0, 360);
  top.addColorStop(0, 'rgba(8,12,20,0.75)'); top.addColorStop(1, 'rgba(8,12,20,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, MOTION_W, 360);

  const ta = ramp(t, 0.3);
  text(ctx, f.title, MOTION_W / 2, 170, { font: fitFont(ctx, f.title, 104, MOTION_W - 120, DISPLAY), align: 'center', alpha: ta, dy: (1 - ta) * -30 });
  text(ctx, `RM ${fmtRM(f.price)}`, MOTION_W / 2, 240, { font: `600 52px ${BODY}`, align: 'center', alpha: ramp(t, 0.7) });

  const main = f.rows[1] || f.rows[0];
  const ma = ramp(t, 1.4, 0.5);
  text(ctx, f.headline, MOTION_W / 2, 1060, { font: `600 40px ${BODY}`, color: RED, align: 'center', alpha: ma });
  if (main) {
    const big = `RM ${fmtRM(countUp(main.monthly, t, 1.5, 1.2))}`;
    text(ctx, big, MOTION_W / 2, 1280, {
      font: fitFont(ctx, `RM ${fmtRM(main.monthly)}`, 260, MOTION_W - 120, DISPLAY, '400'), align: 'center', alpha: ma, dy: (1 - ma) * 40,
    });
    text(ctx, `${c.perMonth.replace('/', '')} · ${main.years} ${c.tenure}`.toUpperCase(), MOTION_W / 2, 1350, {
      font: `600 42px ${BODY}`, color: 'rgba(255,255,255,0.7)', align: 'center', alpha: ma,
    });
  }
  // The other two tenures as small chips.
  const others = f.rows.filter((r) => r !== main);
  others.forEach((r, i) => {
    const a = ramp(t, 2.8 + i * 0.25, 0.5);
    const cx = MOTION_W / 2 + (i === 0 ? -230 : 230);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectPath(ctx, cx - 200, 1410, 400, 110, 55); ctx.fill(); ctx.restore();
    text(ctx, `${r.years} ${c.tenure}  RM ${fmtRM(r.monthly)}`, cx, 1480, { font: `600 38px ${BODY}`, align: 'center', alpha: a });
  });
  offerPill(ctx, f, t, 3.4, 1610);
  sellerBar(ctx, f, t, 3.8, 1700);
  footnote(ctx, c, t, 4.2);
}

// --- Template 3: up to 3 photos take turns, numbers card below ---------------
function drawSwap(ctx, t, f, imgs, c) {
  ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
  const pics = imgs.filter(Boolean);
  const per = 2.2, fade = 0.5;
  const box = { x: 50, y: 50, w: MOTION_W - 100, h: 800 };
  if (!pics.length) drawDrift(ctx, null, box.x, box.y, box.w, box.h, t, 40);
  pics.forEach((img, i) => {
    const start = i * per;
    const last = i === pics.length - 1;
    const aIn = i === 0 ? 1 : ramp(t, start - fade, fade);
    const aOut = last ? 1 : 1 - ramp(t, start + per - fade, fade);
    const a = Math.min(aIn, aOut);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    drawDrift(ctx, img, box.x, box.y, box.w, box.h, t - start + 1, 40, 1.06);
    ctx.restore();
  });
  // Photo dots.
  pics.forEach((_, i) => {
    const on = Math.min(pics.length - 1, Math.floor(t / per)) === i;
    ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(MOTION_W / 2 + (i - (pics.length - 1) / 2) * 34, 810, on ? 10 : 7, 0, Math.PI * 2); ctx.fill();
  });

  const ca = ramp(t, 0.4, 0.7);
  ctx.save(); ctx.globalAlpha = ca;
  ctx.fillStyle = INK;
  roundRectPath(ctx, 50, 890 + (1 - ca) * 80, MOTION_W - 100, 980, 40); ctx.fill();
  ctx.restore();
  const oy = (1 - ca) * 80;
  text(ctx, f.title, 110, 1000 + oy, { font: fitFont(ctx, f.title, 84, MOTION_W - 220, DISPLAY), alpha: ca });
  text(ctx, `RM ${fmtRM(f.price)}  ·  ${f.working}`, 110, 1060 + oy, {
    font: fitFont(ctx, `RM ${fmtRM(f.price)}  ·  ${f.working}`, 36, MOTION_W - 220, BODY, '500'),
    color: 'rgba(255,255,255,0.6)', alpha: ca,
  });
  tenureRows(ctx, f.rows, 100, 1100, MOTION_W - 200, t, 1.2, c);
  offerPill(ctx, f, t, 2.6, 1660);
  sellerBar(ctx, f, t, 3.0, 1720);
  text(ctx, c.disclaimer, MOTION_W / 2, MOTION_H - 20, {
    font: `400 24px ${BODY}`, color: '#6b7280', align: 'center', alpha: ramp(t, 3.5, 0.8),
  });
}


// --- Design 2 "Beats": one fact per screen, kept inside the TikTok safe zone --
// Scenes: hook (the monthly) -> the car + real features -> the tenure ladder on
// red -> the call to action. A red sweep cuts between them.
const SAFE = { l: 70, r: 900, t: 220, b: 1500 }; // clear of TikTok's buttons + caption
const BEATS = [0, 2.2, 4.8, 7.2, 10];
export const BEATS_LEN = 10;

function sweep(ctx, t, at) {
  const p = (t - at + 0.35) / 0.7; // runs from 0.35s before the cut to 0.35s after
  if (p <= 0 || p >= 1) return;
  const x = -MOTION_W * 1.4 + p * MOTION_W * 2.8;
  ctx.save();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(x, 0); ctx.lineTo(x + MOTION_W * 1.1, 0);
  ctx.lineTo(x + MOTION_W * 0.7, MOTION_H); ctx.lineTo(x - MOTION_W * 0.4, MOTION_H);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function dimPhoto(ctx, img, t, alpha) {
  drawDrift(ctx, img, 0, 0, MOTION_W, MOTION_H, t, 0, 1.1);
  ctx.fillStyle = `rgba(8,12,20,${alpha})`;
  ctx.fillRect(0, 0, MOTION_W, MOTION_H);
}

function slam(t, start) { // big word lands: 1.35x -> 1x in 0.35s
  const p = clamp01((t - start) / 0.35);
  return { a: p, s: 1 + 0.35 * (1 - easeOut(p)) };
}

function drawBeats(ctx, t, f, imgs, c, opts) {
  const pics = imgs.filter(Boolean);
  const pic = (i) => pics.length ? pics[i % pics.length] : null;
  const main = f.rows[1] || f.rows[0];
  const L = f.lang === 'en'
    ? { month: 'A MONTH', yrs: 'years', dep: 'deposit', price: 'Car price', msg: 'MESSAGE ME', cta: 'Ask for the full working' }
    : { month: 'SEBULAN', yrs: 'tahun', dep: 'deposit', price: 'Harga kereta', msg: 'MESEJ SAYA', cta: 'Tanya kiraan penuh' };
  const cx = (SAFE.l + SAFE.r) / 2;

  if (t < BEATS[1]) {
    // 1. Hook: the monthly, huge.
    dimPhoto(ctx, pic(0), t, 0.55);
    const h = slam(t, 0.25);
    text(ctx, f.headline, cx, 700, { font: `600 40px ${BODY}`, color: RED, align: 'center', alpha: ramp(t, 0.1, 0.4) });
    if (main) {
      ctx.save(); ctx.translate(cx, 960); ctx.scale(h.s, h.s);
      text(ctx, `RM ${fmtRM(main.monthly)}`, 0, 0, {
        font: fitFont(ctx, `RM ${fmtRM(main.monthly)}`, 300, SAFE.r - SAFE.l, DISPLAY, '400'), align: 'center', alpha: h.a,
      });
      ctx.restore();
      text(ctx, L.month, cx, 1110, { font: `400 110px ${DISPLAY}`, align: 'center', alpha: ramp(t, 0.7, 0.4), dy: (1 - ramp(t, 0.7, 0.4)) * 30 });
      text(ctx, `${main.years} ${L.yrs} · ${L.dep} RM ${fmtRM(f.deposit)}`, cx, 1190, {
        font: `500 40px ${BODY}`, color: 'rgba(255,255,255,0.75)', align: 'center', alpha: ramp(t, 1.0, 0.4),
      });
    }
  } else if (t < BEATS[2]) {
    // 2. The car, its name in three lines, then its real features one by one.
    const s = t - BEATS[1];
    drawDrift(ctx, pic(1), 0, 0, MOTION_W, MOTION_H, s + 2, 0, 1.1);
    const g = ctx.createLinearGradient(0, 0, MOTION_W, 0);
    g.addColorStop(0, 'rgba(8,12,20,0.88)'); g.addColorStop(0.75, 'rgba(8,12,20,0.2)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
    const lines = [String(f.year || ''), f.make, f.model].filter(Boolean);
    lines.forEach((ln, i) => {
      const a = ramp(s, 0.15 + i * 0.15, 0.4);
      text(ctx, ln, SAFE.l + (1 - a) * -120, 480 + i * 150, {
        font: fitFont(ctx, ln, i === 0 ? 120 : 170, SAFE.r - SAFE.l, DISPLAY, '400'), color: i === 0 ? RED : '#fff', alpha: a,
      });
    });
    (f.features || []).slice(0, 4).forEach((ft, i) => {
      const a = ramp(s, 0.9 + i * 0.3, 0.35);
      if (a <= 0) return;
      ctx.save(); ctx.font = `600 44px ${BODY}`;
      const w = ctx.measureText(ft).width + 70;
      const y = 920 + i * 120;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRectPath(ctx, SAFE.l, y, w * (0.6 + 0.4 * a), 92, 46); ctx.fill();
      ctx.restore();
      text(ctx, ft, SAFE.l + 35, y + 62, { font: `600 44px ${BODY}`, color: INK, alpha: a });
    });
  } else if (t < BEATS[3]) {
    // 3. The ladder, on red.
    const s = t - BEATS[2];
    ctx.fillStyle = RED; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
    text(ctx, `${L.price} RM ${fmtRM(f.price)}`, cx, 400, { font: `600 46px ${BODY}`, align: 'center', alpha: ramp(s, 0.1, 0.4) });
    f.rows.forEach((r, i) => {
      const a = ramp(s, 0.35 + i * 0.3, 0.4);
      const y = 640 + i * 250;
      text(ctx, `${r.years} ${c.tenure}`, cx, y, { font: `600 44px ${BODY}`, color: 'rgba(255,255,255,0.8)', align: 'center', alpha: a });
      text(ctx, `RM ${fmtRM(countUp(r.monthly, s, 0.35 + i * 0.3, 0.7))}`, cx, y + 150, {
        font: `400 170px ${DISPLAY}`, align: 'center', alpha: a, dy: (1 - a) * 50,
      });
    });
    text(ctx, c.disclaimer, cx, 1440, { font: fitFont(ctx, c.disclaimer, 28, SAFE.r - SAFE.l, BODY, '400'), color: 'rgba(255,255,255,0.85)', align: 'center', alpha: ramp(s, 1.4, 0.6) });
  } else {
    // 4. Call to action.
    const s = t - BEATS[3];
    dimPhoto(ctx, pic(2), s + 4, 0.62);
    if (f.offer) offerPill(ctx, f, s, 0.2, 620, cx);
    const h = slam(s, 0.5);
    ctx.save(); ctx.translate(cx, 900); ctx.scale(h.s, h.s);
    text(ctx, L.msg, 0, 0, { font: `400 190px ${DISPLAY}`, align: 'center', alpha: h.a });
    ctx.restore();
    if (f.seller) {
      const a = ramp(s, 0.9, 0.5);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = RED;
      roundRectPath(ctx, SAFE.l + 30, 1000 + (1 - a) * 40, SAFE.r - SAFE.l - 60, 130, 65); ctx.fill(); ctx.restore();
      text(ctx, f.seller, cx, 1084 + (1 - a) * 40, { font: fitFont(ctx, f.seller, 54, SAFE.r - SAFE.l - 140, BODY, '700'), align: 'center', alpha: a });
    }
    text(ctx, L.cta, cx, 1230, { font: `500 42px ${BODY}`, color: 'rgba(255,255,255,0.8)', align: 'center', alpha: ramp(s, 1.3, 0.5) });
  }
  BEATS.slice(1, 4).forEach((at) => sweep(ctx, t, at));
}

// What TikTok draws over a video (approximate): top bar, right-hand buttons,
// caption + sound line at the bottom. Toggle in the preview only.
export function drawSafeOverlay(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(56,189,248,0.28)';
  ctx.fillRect(0, 0, MOTION_W, 170);
  ctx.fillRect(930, 760, 150, 900);
  ctx.fillRect(0, 1540, MOTION_W, 380);
  ctx.strokeStyle = 'rgba(56,189,248,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([18, 12]);
  ctx.strokeRect(SAFE.l, SAFE.t, SAFE.r - SAFE.l, SAFE.b - SAFE.t);
  ctx.restore();
}

// --- Design 3 "Beats, wide photos": same four beats, but a landscape photo is
// shown WHOLE in a band (never cropped to fill a tall screen); the words sit
// under it. Between beats the next photo slides in from the right.
function photoBand(ctx, img, y, t, enterAt, maxH = 760) {
  const ar = img ? img.width / img.height : 4 / 3;
  const h = Math.min(maxH, Math.round(MOTION_W / Math.max(1.0, ar)));
  const p = enterAt == null ? 1 : easeOut((t - enterAt) / 0.55);
  const x = (1 - p) * MOTION_W;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y, MOTION_W, h); ctx.clip();
  drawDrift(ctx, img, x, y, MOTION_W, h, t, 0, 1.06);
  ctx.restore();
  return h;
}

function drawWide(ctx, t, f, imgs, c) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
  const pics = imgs.filter(Boolean);
  const pic = (i) => pics.length ? pics[i % pics.length] : null;
  const main = f.rows[1] || f.rows[0];
  const L = f.lang === 'en'
    ? { month: 'A MONTH', yrs: 'years', dep: 'deposit', price: 'Car price', msg: 'MESSAGE ME', cta: 'Ask for the full working' }
    : { month: 'SEBULAN', yrs: 'tahun', dep: 'deposit', price: 'Harga kereta', msg: 'MESEJ SAYA', cta: 'Tanya kiraan penuh' };
  const cx = (SAFE.l + SAFE.r) / 2;
  const top = SAFE.t + 10;
  const beat = t < BEATS[1] ? 0 : t < BEATS[2] ? 1 : t < BEATS[3] ? 2 : 3;
  const s = t - BEATS[beat];
  // Photos per beat: hook, car, ladder (small band), call to action.
  const IDX = [0, 1, 2, 0], MAXH = [700, 700, 420, 700];
  const hNew = Math.min(MAXH[beat], Math.round(MOTION_W / Math.max(1.0, pic(IDX[beat]) ? pic(IDX[beat]).width / pic(IDX[beat]).height : 4 / 3)));
  // The previous photo stays put underneath (cut to the new band) while the next slides over it.
  if (beat > 0 && s < 0.6) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, MOTION_W, hNew); ctx.clip();
    photoBand(ctx, pic(IDX[beat - 1]), top, t, null, MAXH[beat - 1]);
    ctx.restore();
  }
  const h = photoBand(ctx, pic(IDX[beat]), top, t, beat === 0 ? null : BEATS[beat], MAXH[beat]);
  const y0 = top + h + 90;
  const a0 = ramp(s, beat === 0 ? 0.3 : 0.4, 0.45);

  if (beat === 0) {
    text(ctx, f.headline, cx, y0, { font: `600 40px ${BODY}`, color: RED, align: 'center', alpha: ramp(t, 0.2, 0.4) });
    if (main) {
      const hm = slam(t, 0.45);
      ctx.save(); ctx.translate(cx, y0 + 230); ctx.scale(hm.s, hm.s);
      text(ctx, `RM ${fmtRM(main.monthly)}`, 0, 0, { font: fitFont(ctx, `RM ${fmtRM(main.monthly)}`, 250, SAFE.r - SAFE.l, DISPLAY, '400'), align: 'center', alpha: hm.a });
      ctx.restore();
      text(ctx, L.month, cx, y0 + 330, { font: `400 96px ${DISPLAY}`, align: 'center', alpha: ramp(t, 0.9, 0.4) });
      text(ctx, `${main.years} ${L.yrs} · ${L.dep} RM ${fmtRM(f.deposit)}`, cx, y0 + 400, {
        font: `500 38px ${BODY}`, color: 'rgba(255,255,255,0.75)', align: 'center', alpha: ramp(t, 1.2, 0.4),
      });
    }
  } else if (beat === 1) {
    const lines = [String(f.year || ''), `${f.make || ''} ${f.model || ''}`.trim()];
    text(ctx, lines[0], SAFE.l, y0 + 10, { font: `400 90px ${DISPLAY}`, color: RED, alpha: a0, dy: (1 - a0) * 30 });
    text(ctx, lines[1], SAFE.l, y0 + 130, { font: fitFont(ctx, lines[1], 120, SAFE.r - SAFE.l, DISPLAY, '400'), alpha: a0, dy: (1 - a0) * 30 });
    (f.features || []).slice(0, 4).forEach((ft, i) => {
      const a = ramp(s, 0.8 + i * 0.25, 0.35);
      if (a <= 0) return;
      const col = i % 2, row = Math.floor(i / 2);
      const w = (SAFE.r - SAFE.l - 24) / 2;
      const x = SAFE.l + col * (w + 24), y = y0 + 200 + row * 116;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,255,255,0.09)';
      roundRectPath(ctx, x, y + (1 - a) * 30, w, 96, 24); ctx.fill(); ctx.restore();
      text(ctx, ft, x + w / 2, y + 63 + (1 - a) * 30, { font: fitFont(ctx, ft, 44, w - 40, BODY, '600'), align: 'center', alpha: a });
    });
  } else if (beat === 2) {
    text(ctx, `${L.price} RM ${fmtRM(f.price)}`, cx, y0 - 10, { font: `600 42px ${BODY}`, color: 'rgba(255,255,255,0.8)', align: 'center', alpha: a0 });
    f.rows.forEach((r, i) => {
      const a = ramp(s, 0.4 + i * 0.3, 0.4);
      const y = y0 + 50 + i * 190;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = i === 1 ? RED : 'rgba(255,255,255,0.07)';
      roundRectPath(ctx, SAFE.l, y + (1 - a) * 40, SAFE.r - SAFE.l, 166, 30); ctx.fill(); ctx.restore();
      text(ctx, `${r.years} ${c.tenure}`, SAFE.l + 40, y + 102 + (1 - a) * 40, { font: `600 42px ${BODY}`, color: 'rgba(255,255,255,0.85)', alpha: a });
      text(ctx, `RM ${fmtRM(countUp(r.monthly, s, 0.4 + i * 0.3, 0.7))}`, SAFE.r - 40, y + 118 + (1 - a) * 40, {
        font: `400 120px ${DISPLAY}`, align: 'right', alpha: a,
      });
    });
    text(ctx, c.disclaimer, cx, y0 + 660, { font: fitFont(ctx, c.disclaimer, 28, SAFE.r - SAFE.l, BODY, '400'), color: 'rgba(255,255,255,0.55)', align: 'center', alpha: ramp(s, 1.4, 0.6) });
  } else {
    if (f.offer) offerPill(ctx, f, s, 0.3, y0 + 10, cx);
    const hm = slam(s, 0.6);
    ctx.save(); ctx.translate(cx, y0 + 200); ctx.scale(hm.s, hm.s);
    text(ctx, L.msg, 0, 0, { font: `400 170px ${DISPLAY}`, align: 'center', alpha: hm.a });
    ctx.restore();
    if (f.seller) {
      const a = ramp(s, 1.0, 0.5);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = RED;
      roundRectPath(ctx, SAFE.l + 30, y0 + 250 + (1 - a) * 40, SAFE.r - SAFE.l - 60, 124, 62); ctx.fill(); ctx.restore();
      text(ctx, f.seller, cx, y0 + 330 + (1 - a) * 40, { font: fitFont(ctx, f.seller, 52, SAFE.r - SAFE.l - 140, BODY, '700'), align: 'center', alpha: a });
    }
    text(ctx, L.cta, cx, y0 + 440, { font: `500 40px ${BODY}`, color: 'rgba(255,255,255,0.8)', align: 'center', alpha: ramp(s, 1.4, 0.5) });
  }
}

// --- Design 4 "Stretch": a light card, the photo whole across the middle, the
// space above and below filled by stretching the photo's own top and bottom
// edge, under a white wash. The words never move; the photo hard-cuts.
export const STRETCH_EVERY = 2.5;
const STRETCH_ZOOM = 0.06; // how much each photo grows before the next one

function drawStretch(ctx, t, f, imgs, c) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
  const pics = imgs.filter(Boolean);
  const img = pics.length ? pics[Math.floor(t / STRETCH_EVERY) % pics.length] : null;
  const ar = img ? img.width / img.height : 4 / 3;
  const bh = Math.round(MOTION_W / Math.max(0.9, ar));
  const by = Math.round(MOTION_H * 0.47 - bh / 2);
  if (img) {
    // Slow push-in: each photo grows 1 -> 1.06 over its 2.5s, linear (no ease),
    // so it is still moving when the next photo cuts in. The words do not move.
    const z = 1 + STRETCH_ZOOM * ((t % STRETCH_EVERY) / STRETCH_EVERY);
    const zw = MOTION_W * z, zh = bh * z;
    const zx = (MOTION_W - zw) / 2, zy = by + bh / 2 - zh / 2;
    // Stretch a thin strip of the top and bottom edge to fill the card.
    const strip = Math.max(1, Math.round(img.height * 0.01));
    ctx.drawImage(img, 0, 0, img.width, strip, 0, 0, MOTION_W, zy + 2);
    ctx.drawImage(img, 0, img.height - strip, img.width, strip, 0, zy + zh - 2, MOTION_W, MOTION_H - zy - zh + 2);
    ctx.drawImage(img, 0, 0, img.width, img.height, zx, zy, zw, zh);
  } else {
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, by, MOTION_W, bh);
  }
  // White wash: light over the top, heavy from the photo's lower edge down.
  let g = ctx.createLinearGradient(0, 0, 0, by);
  g.addColorStop(0, 'rgba(255,255,255,0.72)'); g.addColorStop(0.75, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, MOTION_W, by);
  const wy = by + bh - 170;
  g = ctx.createLinearGradient(0, wy, 0, wy + 330);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, wy, MOTION_W, 330);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, wy + 330, MOTION_W, MOTION_H);

  const x = SAFE.l + 20, w = SAFE.r - SAFE.l - 20;
  const dark = '#111827', grey = '#4b5563';
  const top = by - 250;
  text(ctx, f.tag, x, top, { font: `600 38px ${BODY}`, color: RED });
  text(ctx, f.name, x, top + 90, { font: fitFont(ctx, f.name, 66, w, BODY, '700'), color: dark });
  text(ctx, f.variant || '', x, top + 140, { font: fitFont(ctx, f.variant || '', 34, w, BODY, '600'), color: grey });

  const low = by + bh + 10;
  text(ctx, `RM${fmtRM(f.price)}`, x, low, { font: `800 104px ${BODY}`, color: dark });
  const from = f.rows.length ? Math.min(...f.rows.map((r) => r.monthly)) : 0;
  if (from) text(ctx, f.lang === 'en' ? `from RM${fmtRM(from)}/month` : `dari RM${fmtRM(from)}/bulan`, x, low + 64, { font: `700 40px ${BODY}`, color: RED });
  text(ctx, (f.features || []).filter(Boolean).join('  ·  '), x, low + 124, { font: fitFont(ctx, (f.features || []).join('  ·  '), 36, w, BODY, '600'), color: dark });
  if (f.seller) text(ctx, f.seller, x, low + 180, { font: fitFont(ctx, f.seller, 34, w, BODY, '600'), color: RED });
  text(ctx, c.disclaimer, x, low + 240, { font: fitFont(ctx, c.disclaimer, 24, w, BODY, '400'), color: '#9ca3af' });
}

// --- Design 5 "Calculator": the deposit slides 0 -> 10 -> 20 -> 30% and the
// monthly rolls down with it; then the years switch 9 -> 7 -> 5. Under it, the
// take-home pay the instalment fits, ALWAYS with its rule (35% of pay, the
// bank decides), never worded as approval. f.sweep[i] = { pct, deposit, rows }.
const CALC_STEPS = [0.9, 2.6, 4.3, 6.0];      // deposit steps
const CALC_YEARS = [7.8, 9.2, 10.6];          // 9, 7, 5 years at the seller's deposit
const roll = (from, to, t, at, dur = 0.55) => from + (to - from) * ramp(t, at, dur);

function drawCalc(ctx, t, f, imgs, c) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, MOTION_W, MOTION_H);
  const pics = imgs.filter(Boolean);
  const top = SAFE.t + 10;
  const h = photoBand(ctx, pics[0] || null, top, t, null, 560);
  const g = ctx.createLinearGradient(0, top + h - 160, 0, top + h);
  g.addColorStop(0, 'rgba(8,12,20,0)'); g.addColorStop(1, INK);
  ctx.fillStyle = g; ctx.fillRect(0, top + h - 160, MOTION_W, 160);
  const x = SAFE.l, w = SAFE.r - SAFE.l, cx = x + w / 2;
  const sw = f.sweep || [];
  if (!sw.length) return;
  const en = f.lang === 'en';
  const L = en
    ? { dep: 'Deposit', yrs: 'years', mo: 'a month', pay: 'Fits a take-home pay of about', rule: 'Instalment at 35% of take-home pay. The bank decides.', pick: 'Pick yours. Message me.' }
    : { dep: 'Deposit', yrs: 'tahun', mo: 'sebulan', pay: 'Sesuai gaji bersih sekitar', rule: 'Ansuran 35% gaji bersih. Bank yang tentukan.', pick: 'Pilih yang sesuai. Mesej saya.' };

  let y = top + h - 40;
  text(ctx, f.name || f.title, x, y, { font: fitFont(ctx, f.name || f.title, 64, w, BODY, '700') });
  text(ctx, `RM ${fmtRM(f.price)}`, x, y + 60, { font: `500 40px ${BODY}`, color: 'rgba(255,255,255,0.65)' });

  // Which deposit step and which tenure are showing now.
  let k = 0; CALC_STEPS.forEach((s0, i) => { if (t >= s0) k = i; });
  const yearPhase = t >= CALC_YEARS[0];
  const own = f.ownIdx ?? 1; // the seller's deposit row in sweep
  let yi = 0; CALC_YEARS.forEach((at, i) => { if (t >= at) yi = i; });
  // [deposit row, tenure row] now and just before; tenure rows are [9, 7, 5].
  const cur = yearPhase ? [own, yi] : [k, 1];
  const prev = yearPhase ? (yi === 0 ? [3, 1] : [own, yi - 1]) : [Math.max(0, k - 1), 1];
  const at = yearPhase ? CALC_YEARS[yi] : CALC_STEPS[k];
  const tenIdx = cur[1];
  const rowsAt = (i) => sw[i].rows;

  // Deposit slider.
  y += 140;
  const depPct = roll(sw[prev[0]].pct, sw[cur[0]].pct, t, at);
  const depRm = roll(sw[prev[0]].deposit, sw[cur[0]].deposit, t, at);
  text(ctx, L.dep, x, y, { font: `600 38px ${BODY}`, color: 'rgba(255,255,255,0.7)' });
  text(ctx, `RM ${fmtRM(depRm)}  (${Math.round(depPct)}%)`, x + w, y, { font: `700 40px ${BODY}`, align: 'right' });
  const ty = y + 40, frac = Math.min(1, depPct / 30);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRectPath(ctx, x, ty, w, 16, 8); ctx.fill();
  ctx.fillStyle = RED; roundRectPath(ctx, x, ty, Math.max(16, w * frac), 16, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + Math.max(8, w * frac), ty + 8, 24, 0, Math.PI * 2); ctx.fill();
  ['0%', '10%', '20%', '30%'].forEach((lb, i) => text(ctx, lb, x + (w * i) / 3, ty + 70, {
    font: `500 28px ${BODY}`, color: 'rgba(255,255,255,0.45)', align: i === 0 ? 'left' : i === 3 ? 'right' : 'center',
  }));

  // Years tabs.
  y = ty + 130;
  const tabW = (w - 32) / 3;
  [9, 7, 5].forEach((yr, i) => {
    const on = i === tenIdx;
    ctx.fillStyle = on ? RED : 'rgba(255,255,255,0.08)';
    roundRectPath(ctx, x + i * (tabW + 16), y, tabW, 84, 42); ctx.fill();
    text(ctx, `${yr} ${L.yrs}`, x + i * (tabW + 16) + tabW / 2, y + 56, { font: `700 36px ${BODY}`, align: 'center', color: on ? '#fff' : 'rgba(255,255,255,0.6)' });
  });

  // The monthly, rolling between values.
  const from = rowsAt(prev[0])[prev[1]].monthly, to = rowsAt(cur[0])[cur[1]].monthly;
  const m = roll(from, to, t, at);
  y += 290;
  text(ctx, `RM ${fmtRM(m)}`, cx, y, { font: fitFont(ctx, `RM ${fmtRM(Math.max(from, to))}`, 230, w, DISPLAY, '400'), align: 'center' });
  text(ctx, L.mo, cx, y + 60, { font: `600 40px ${BODY}`, color: 'rgba(255,255,255,0.7)', align: 'center' });

  // Take-home pay it fits, with the rule printed every time.
  y += 140;
  text(ctx, `${L.pay} RM ${fmtRM(Math.ceil(m / 0.35 / 100) * 100)}`, cx, y, { font: fitFont(ctx, `${L.pay} RM ${fmtRM(m / 0.35)}`, 38, w, BODY, '600'), align: 'center' });
  text(ctx, L.rule, cx, y + 46, { font: fitFont(ctx, L.rule, 28, w, BODY, '400'), color: 'rgba(255,255,255,0.5)', align: 'center' });

  // End: name.
  const a = ramp(t, 11.4, 0.5);
  if (a > 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,12,20,0.95)'; ctx.fillRect(0, 0, MOTION_W, MOTION_H); ctx.restore();
    text(ctx, L.pick, cx, 820, { font: fitFont(ctx, L.pick, 110, w, DISPLAY, '400'), align: 'center', alpha: a });
    if (f.seller) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = RED; roundRectPath(ctx, x + 30, 880, w - 60, 124, 62); ctx.fill(); ctx.restore();
      text(ctx, f.seller, cx, 962, { font: fitFont(ctx, f.seller, 52, w - 120, BODY, '700'), align: 'center', alpha: a });
    }
    if (f.offer) offerPill(ctx, f, t, 11.8, 1110, cx);
    text(ctx, c.disclaimer, cx, 1230, { font: fitFont(ctx, c.disclaimer, 26, w, BODY, '400'), color: 'rgba(255,255,255,0.55)', align: 'center', alpha: a });
  }
}

const DRAW = { slide: drawSlide, full: drawFull, swap: drawSwap, beats: drawBeats, wide: drawWide, stretch: drawStretch, calc: drawCalc };

// f = { title, headline, price, working, rows[{years, monthly}], offer, seller, lang }
export function drawMotionFrame(ctx, t, template, f, imgs) {
  const c = POSTER_COPY[f.lang] || POSTER_COPY.ms;
  ctx.clearRect(0, 0, MOTION_W, MOTION_H);
  (DRAW[template] || drawSlide)(ctx, Math.max(0, t), f, imgs || [], c);
}
