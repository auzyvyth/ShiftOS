// Draws the loan poster (POSTER-1) onto a canvas: one 1080x1350 (4:5) frame,
// the largest portrait size WhatsApp, Instagram and Facebook all show uncropped.
//
// Layout top to bottom: kicker + car name + year/condition, the car photo,
// spec chips, the price table, the 9/7/5 instalment strip, the seller band,
// and the "bank decides" line. Every number comes from loanPosterNumbers()
// (src/utils/loanPoster.js); nothing here does maths.
//
// preview: true draws a faint diagonal "PREVIEW" over the frame. The sheet
// shows the preview for free; the clean file is drawn only after the credit
// is claimed (claim_loan_poster).

import { fetchDataUrl, loadImg, roundRectPath, drawCover, drawCircle } from '../../utils/posterImage';
import { POSTER_COPY, fmtRM, fmtPct, posterChips, posterTitle, posterSubtitle } from '../../utils/loanPoster';

export const POSTER_W = 1080;
export const POSTER_H = 1350;

const INK = '#0f172a';
const NAVY = '#13213d';
const SUB = '#64748b';
const LINE = '#e2e8f0';
const TINT = '#f1f5f9';
const RED = '#dc2626';
const FAMILY = "'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

const font = (size, weight = 400) => `${weight} ${size}px ${FAMILY}`;

// Image cache across re-renders of the same sheet: the preview redraws on
// every keystroke and must not refetch the photo each time.
const imgCache = new Map();
function cachedImage(url) {
  if (!url) return Promise.resolve(null);
  if (!imgCache.has(url)) imgCache.set(url, fetchDataUrl(url).then(loadImg).catch(() => null));
  return imgCache.get(url);
}

let fontsReady = null;
function ensureFonts() {
  if (!fontsReady) {
    const loads = typeof document !== 'undefined' && document.fonts
      ? Promise.all(['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Outfit`)))
      : Promise.resolve();
    // A slow font must never block the poster: fall back after 1.5s.
    fontsReady = Promise.race([loads, new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  }
  return fontsReady;
}

export async function renderLoanPoster(canvas, { car, seller, numbers, lang = 'ms', pageUrl, preview = false, dpr = 1 }) {
  const c = POSTER_COPY[lang] || POSTER_COPY.ms;
  const [, carImg, avatarImg] = await Promise.all([
    ensureFonts(),
    cachedImage(Array.isArray(car?.images) ? car.images[0] : null),
    cachedImage(seller?.avatar_url || null),
  ]);

  const W = POSTER_W, H = POSTER_H, P = 56, CW = W - P * 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = 'alphabetic';

  const text = (str, x, y, { size = 24, weight = 400, color = INK, align = 'left', spacing = 0 } = {}) => {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };
  const measure = (str, size, weight) => { ctx.font = font(size, weight); return ctx.measureText(str).width; };
  // Shrink to fit one line, floor at `min`, then ellipsis.
  const fit = (str, max, size, weight, min) => {
    let s = size;
    while (s > min && measure(str, s, weight) > max) s -= 2;
    let out = str;
    while (out.length > 1 && measure(out, s, weight) > max) out = `${out.slice(0, -2)}…`;
    return { str: out, size: s };
  };
  const box = (x, y, w, h, r, fill, stroke) => {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header
  text(c.kicker, P, 76, { size: 22, weight: 700, color: SUB, spacing: 3 });
  ctx.fillStyle = RED;
  ctx.fillRect(P, 90, 48, 5);
  const title = fit(posterTitle(car), CW, 66, 800, 40);
  text(title.str, P, 170, { size: title.size, weight: 800, color: INK });
  const sub = posterSubtitle(car, lang);
  if (sub) text(sub, P, 212, { size: 24, weight: 700, color: SUB, spacing: 2 });

  // Photo
  const PH_Y = 240, PH_H = 450;
  if (carImg) drawCover(ctx, carImg, P, PH_Y, CW, PH_H, 24);
  else {
    box(P, PH_Y, CW, PH_H, 24, TINT);
    text(c.noPhoto, W / 2, PH_Y + PH_H / 2 + 10, { size: 28, weight: 600, color: SUB, align: 'center' });
  }

  // Spec chips
  let y = PH_Y + PH_H + 24;
  const chips = posterChips(car, lang);
  if (chips.length) {
    let x = P;
    chips.forEach((chip) => {
      const w = measure(chip, 24, 600) + 40;
      if (x + w > P + CW) return;
      box(x, y, w, 50, 25, TINT);
      text(chip, x + 20, y + 33, { size: 24, weight: 600, color: INK });
      x += w + 12;
    });
    y += 50 + 22;
  } else {
    y += 8;
  }

  // Price table
  const rows = [
    [c.price, `RM ${fmtRM(numbers.price)}`],
    [c.deposit, `RM ${fmtRM(numbers.deposit)}`],
    [c.loan, `RM ${fmtRM(numbers.loan)}`],
    [c.rate(numbers.basis), fmtPct(numbers.rate)],
  ];
  const RH = chips.length ? 54 : 60;
  box(P, y, CW, rows.length * RH + 16, 20, '#ffffff', LINE);
  rows.forEach(([label, value], i) => {
    const ry = y + 8 + i * RH;
    if (i > 0) { ctx.fillStyle = LINE; ctx.fillRect(P + 28, ry, CW - 56, 2); }
    text(label, P + 28, ry + RH / 2 + 9, { size: 26, weight: 500, color: SUB });
    text(value, P + CW - 28, ry + RH / 2 + 10, { size: 30, weight: 800, color: INK, align: 'right' });
  });
  y += rows.length * RH + 16 + 22;

  // 9 / 7 / 5 strip
  const GAP = 16, TW = (CW - GAP * 2) / 3, TH = 118;
  numbers.rows.forEach((row, i) => {
    const x = P + i * (TW + GAP);
    box(x, y, TW, TH, 18, '#ffffff', LINE);
    // navy tenure block on the left
    ctx.save();
    roundRectPath(ctx, x, y, TW, TH, 18); ctx.clip();
    ctx.fillStyle = NAVY; ctx.fillRect(x, y, 74, TH);
    ctx.restore();
    text(String(row.years), x + 37, y + 66, { size: 46, weight: 800, color: '#ffffff', align: 'center' });
    text(c.tenure, x + 37, y + 92, { size: 15, weight: 700, color: 'rgba(255,255,255,0.75)', align: 'center', spacing: 1 });
    const amt = `${fmtRM(row.monthly)}`;
    const avail = TW - 74 - 24;
    const big = fit(amt, avail - 40, 44, 800, 26);
    const rmW = measure('RM', 20, 800);
    const ax = x + 74 + 14;
    text('RM', ax, y + 64, { size: 20, weight: 800, color: RED });
    text(big.str, ax + rmW + 4, y + 66, { size: big.size, weight: 800, color: RED });
    text(c.perMonth, ax, y + 96, { size: 20, weight: 600, color: SUB });
  });
  y += TH + 24;

  // Seller band, anchored to the bottom so any slack sits above it.
  const BH = 110;
  y = Math.max(y, H - 58 - BH);
  box(P, y, CW, BH, 20, NAVY);
  const avR = 36, avCx = P + 24 + avR, avCy = y + BH / 2;
  ctx.beginPath(); ctx.arc(avCx, avCy, avR + 3, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  if (avatarImg) drawCircle(ctx, avatarImg, avCx, avCy, avR);
  else {
    ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2); ctx.fillStyle = '#334155'; ctx.fill();
    const initial = String(seller?.full_name || '?').trim().charAt(0).toUpperCase();
    text(initial, avCx, avCy + 12, { size: 34, weight: 800, color: '#ffffff', align: 'center' });
  }
  const nameX = avCx + avR + 20;
  const right = P + CW - 24;
  const phone = seller?.whatsapp_number || seller?.phone || '';
  const rightW = phone ? Math.max(measure(phone, 30, 800), measure(c.contact, 15, 700) + 8) : 0;
  const nameMax = right - nameX - (rightW ? rightW + 28 : 0);
  const nm = fit(String(seller?.full_name || '').trim() || ' ', nameMax, 30, 800, 20);
  text(nm.str, nameX, avCy - 2, { size: nm.size, weight: 800, color: '#ffffff' });
  const role = fit(String(seller?.job_title || '').trim() || c.advisor, nameMax, 20, 500, 14);
  text(role.str, nameX, avCy + 28, { size: role.size, weight: 500, color: 'rgba(255,255,255,0.7)' });
  if (phone) {
    text(c.contact, right, avCy - 14, { size: 15, weight: 700, color: 'rgba(255,255,255,0.6)', align: 'right', spacing: 2 });
    text(phone, right, avCy + 22, { size: 30, weight: 800, color: '#ffffff', align: 'right' });
  }
  y += BH;

  // Footer: the seller's page link, then the bank line
  const foot = numbers.highValue ? c.highValue : c.disclaimer;
  const link = pageUrl ? pageUrl.replace(/^https?:\/\//, '') : '';
  if (link) text(link, W / 2, y + 26, { size: 18, weight: 700, color: INK, align: 'center' });
  const ft = fit(foot, CW, 17, 500, 13);
  text(ft.str, W / 2, y + (link ? 48 : 34), { size: ft.size, weight: 500, color: SUB, align: 'center' });

  if (preview) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    text(c.preview, 0, 0, { size: 150, weight: 800, color: 'rgba(15,23,42,0.07)', align: 'center', spacing: 12 });
    ctx.restore();
  }
  return canvas;
}

export const posterBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
