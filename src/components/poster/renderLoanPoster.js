// Draws the loan poster (POSTER-1) onto a canvas: one 1080x1350 (4:5) frame,
// the largest portrait size WhatsApp, Instagram and Facebook all show uncropped.
//
// Our own look, deliberately NOT the competitor's (SA Studio X: white card,
// navy tenure blocks side by side, navy seller band). Ours is the Drevo dark
// surface: the photo runs full width with the car name ON it (same idea as the
// live presenter), the price and its working on one line, the 9/7/5 instalments
// as a stacked list with the longest tenure highlighted, then the seller.
// Every number comes from loanPosterNumbers() (src/utils/loanPoster.js);
// nothing here does maths.
//
// preview: true draws a faint diagonal "PREVIEW" over the frame. The sheet
// shows the preview for free; the clean file is drawn only after the credit
// is claimed (claim_loan_poster).

import { fetchDataUrl, loadImg, roundRectPath, drawCover, drawCircle } from '../../utils/posterImage';
import { POSTER_COPY, fmtRM, fmtPct, posterChips, posterTitle, posterSubtitle } from '../../utils/loanPoster';

export const POSTER_W = 1080;
export const POSTER_H = 1350;

const BG = '#0b0f17';
const PANEL = '#151b26';
const WHITE = '#ffffff';
const SOFT = 'rgba(255,255,255,0.72)';
const FAINT = 'rgba(255,255,255,0.5)';
const LINE = 'rgba(255,255,255,0.10)';
const RED = '#dc2626';
const RED_SOFT = '#f87171';
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

  const W = POSTER_W, H = POSTER_H, P = 64, CW = W - P * 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = 'alphabetic';

  const text = (str, x, y, { size = 24, weight = 400, color = WHITE, align = 'left', spacing = 0 } = {}) => {
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
  const box = (x, y, w, h, r, fill) => { roundRectPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); };

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Photo, full width, fading into the background at the bottom.
  const PH_H = 640;
  if (carImg) drawCover(ctx, carImg, 0, 0, W, PH_H, 0);
  else {
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, W, PH_H);
    text(c.noPhoto, W / 2, PH_H / 2 - 40, { size: 30, weight: 600, color: FAINT, align: 'center' });
  }
  const fade = ctx.createLinearGradient(0, PH_H - 330, 0, PH_H);
  fade.addColorStop(0, 'rgba(11,15,23,0)');
  fade.addColorStop(0.55, 'rgba(11,15,23,0.78)');
  fade.addColorStop(1, BG);
  ctx.fillStyle = fade;
  ctx.fillRect(0, PH_H - 330, W, 330);

  // Kicker pill, top left on the photo.
  const kw = measure(c.kicker, 20, 700) + 40;
  box(P, 48, kw + c.kicker.length * 2, 46, 23, 'rgba(11,15,23,0.62)');
  text(c.kicker, P + 20, 79, { size: 20, weight: 700, color: WHITE, spacing: 2 });

  // Car name and facts, sitting on the faded bottom of the photo.
  const title = fit(posterTitle(car), CW, 68, 800, 40);
  text(title.str, P, PH_H - 66, { size: title.size, weight: 800 });
  const facts = [posterSubtitle(car, lang), ...posterChips(car, lang)].filter(Boolean).join('  ·  ');
  if (facts) {
    const f = fit(facts, CW, 26, 500, 18);
    text(f.str, P, PH_H - 22, { size: f.size, weight: 500, color: SOFT });
  }

  // Price, then the working on one line.
  let y = PH_H + 72;
  text(c.price.toUpperCase(), P, y - 6, { size: 18, weight: 700, color: FAINT, spacing: 2 });
  text(`RM ${fmtRM(numbers.price)}`, P, y + 62, { size: 70, weight: 800 });
  const working = `${c.deposit} RM ${fmtRM(numbers.deposit)}   ·   ${c.loan} RM ${fmtRM(numbers.loan)}   ·   ${fmtPct(numbers.rate)} ${numbers.basis === 'flat' ? 'flat' : 'EIR'}`;
  const wk = fit(working, CW, 25, 500, 18);
  text(wk.str, P, y + 108, { size: wk.size, weight: 500, color: SOFT });
  y += 140;

  // 9 / 7 / 5 as one stacked list; the longest tenure (lowest monthly) leads.
  const RH = 88;
  box(P, y, CW, RH * numbers.rows.length, 22, PANEL);
  numbers.rows.forEach((row, i) => {
    const ry = y + i * RH;
    if (i === 0) {
      ctx.save();
      roundRectPath(ctx, P, y, CW, RH * numbers.rows.length, 22); ctx.clip();
      ctx.fillStyle = 'rgba(220,38,38,0.16)'; ctx.fillRect(P, ry, CW, RH);
      ctx.restore();
    } else {
      ctx.fillStyle = LINE; ctx.fillRect(P + 28, ry, CW - 56, 2);
    }
    text(`${row.years} ${c.tenure.toLowerCase()}`, P + 32, ry + RH / 2 + 12, { size: 32, weight: 700, color: i === 0 ? WHITE : SOFT });
    const per = c.perMonth;
    const perW = measure(per, 24, 600);
    const right = P + CW - 32;
    text(per, right, ry + RH / 2 + 14, { size: 24, weight: 600, color: FAINT, align: 'right' });
    text(`RM ${fmtRM(row.monthly)}`, right - perW - 8, ry + RH / 2 + 16, { size: 46, weight: 800, color: i === 0 ? RED_SOFT : WHITE, align: 'right' });
  });
  y += RH * numbers.rows.length;

  // Seller: photo, name, role on the left; WhatsApp number on the right.
  const SY = Math.max(y + 40, H - 182);
  ctx.fillStyle = LINE; ctx.fillRect(P, SY, CW, 2);
  const avR = 38, avCx = P + avR, avCy = SY + 26 + avR;
  if (avatarImg) drawCircle(ctx, avatarImg, avCx, avCy, avR);
  else {
    ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2); ctx.fillStyle = RED; ctx.fill();
    const initial = String(seller?.full_name || '?').trim().charAt(0).toUpperCase();
    text(initial, avCx, avCy + 13, { size: 36, weight: 800, align: 'center' });
  }
  const nameX = avCx + avR + 22;
  const rightX = P + CW;
  const phone = seller?.whatsapp_number || seller?.phone || '';
  const rightW = phone ? Math.max(measure(phone, 34, 800), measure(c.contact, 16, 700) + 8) : 0;
  const nameMax = rightX - nameX - (rightW ? rightW + 28 : 0);
  const nm = fit(String(seller?.full_name || '').trim() || ' ', nameMax, 32, 800, 20);
  text(nm.str, nameX, avCy - 2, { size: nm.size, weight: 800 });
  const role = fit(String(seller?.job_title || '').trim() || c.advisor, nameMax, 22, 500, 14);
  text(role.str, nameX, avCy + 30, { size: role.size, weight: 500, color: SOFT });
  if (phone) {
    text(c.contact, rightX, avCy - 14, { size: 16, weight: 700, color: FAINT, align: 'right', spacing: 2 });
    text(phone, rightX, avCy + 26, { size: 34, weight: 800, align: 'right' });
  }

  // Footer: page link, then the bank line.
  const foot = numbers.highValue ? c.highValue : c.disclaimer;
  const link = pageUrl ? pageUrl.replace(/^https?:\/\//, '') : '';
  if (link) text(link, P, H - 46, { size: 19, weight: 700, color: SOFT });
  const ft = fit(foot, CW, 17, 500, 13);
  text(ft.str, P, H - 20, { size: ft.size, weight: 500, color: FAINT });

  if (preview) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    text(c.preview, 0, 0, { size: 150, weight: 800, color: 'rgba(255,255,255,0.09)', align: 'center', spacing: 12 });
    ctx.restore();
  }
  return canvas;
}

export const posterBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
