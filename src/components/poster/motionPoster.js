// Moving loan poster (IDEA-29 prototype). Draws ONE frame at time t (seconds)
// onto a 1080x1920 canvas, so the same frames can later be recorded to MP4.
// The car is always the seller's own photos; nothing here draws a car.
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

function offerPill(ctx, f, t, start, y) {
  if (!f.offer) return;
  const a = ramp(t, start, 0.5);
  if (a <= 0) return;
  // One soft pop when it lands, then still.
  const pop = 1 + 0.06 * Math.sin(Math.PI * clamp01((t - start) / 0.5));
  ctx.save();
  ctx.font = `700 44px ${BODY}`;
  const w = Math.min(MOTION_W - 160, ctx.measureText(f.offer).width + 90);
  ctx.translate(MOTION_W / 2, y);
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

const DRAW = { slide: drawSlide, full: drawFull, swap: drawSwap };

// f = { title, headline, price, working, rows[{years, monthly}], offer, seller, lang }
export function drawMotionFrame(ctx, t, template, f, imgs) {
  const c = POSTER_COPY[f.lang] || POSTER_COPY.ms;
  ctx.clearRect(0, 0, MOTION_W, MOTION_H);
  (DRAW[template] || drawSlide)(ctx, Math.max(0, t), f, imgs || [], c);
}
