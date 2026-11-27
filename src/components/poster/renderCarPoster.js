// Draws the poster styles (POSTER-6) onto a canvas. One entry point,
// renderPoster(), picks the style; "kiraan" is the original loan poster.
//
// The preview and the downloaded file go through this SAME function with the
// same inputs, so the file is exactly what the seller saw. Only two things
// differ, and both are deliberate: the preview carries a faint diagonal
// "PREVIEW" word, and the download is drawn at twice the pixel density.
//
// Every number comes from loanPosterNumbers(); every fact from the listing row
// through src/utils/posterStyles.js. Nothing here does maths or invents words.
// Layout is Drevo's own (see docs/POSTER_TEMPLATES_PLAN.md).

import { roundRectPath, drawCover, drawCircle } from '../../utils/posterImage';
import { POSTER_COPY, fmtRM, fmtPct } from '../../utils/loanPoster';
import {
  mixHex, fitInside, styleOf, paletteOf, RIBBON_TEXT, photosOf, featureStrip, specParts, photoPlan, tintFromRgb, CARD_FALLBACK_TINT, styleAvailable,
} from '../../utils/posterStyles';
import { renderLoanPoster, cachedImage, ensureFonts } from './renderLoanPoster';
import { cutoutBounds, placeCar, drawCarShadow } from '../studio/backdrops';

const FAMILY = "'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const DISPLAY = "'Bebas Neue', 'Outfit', Impact, sans-serif";
const SLANT = 0.16;

function kit(ctx) {
  const setFont = (size, weight, family) => { ctx.font = `${weight} ${size}px ${family || FAMILY}`; };
  const spacingOn = (px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };
  const measure = (str, size, weight = 400, family, spacing = 0) => {
    setFont(size, weight, family); spacingOn(spacing);
    const w = ctx.measureText(str).width; spacingOn(0); return w;
  };
  // align left | center | right. A letter-spaced string carries one trailing
  // space of tracking, so centred text is nudged back by half of it.
  const text = (str, x, y, { size = 24, weight = 400, color = '#fff', align = 'left', spacing = 0, family, slant = 0 } = {}) => {
    ctx.save();
    setFont(size, weight, family); spacingOn(spacing);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
    ctx.translate(x + dx, y);
    if (slant) ctx.transform(1, 0, -slant, 1, 0, 0);
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
  const fit = (str, max, size, weight, min, family, spacing = 0) => {
    let s = size;
    while (s > min && measure(str, s, weight, family, spacing) > max) s -= 2;
    let out = str;
    while (out.length > 1 && measure(out, s, weight, family, spacing) > max) out = `${out.slice(0, -2)}…`;
    return { str: out, size: s };
  };
  const poly = (pts, fill, stroke, lw = 2) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  const box = (x, y, w, h, r, fill) => { roundRectPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); };
  const vfade = (x, y, w, h, from, to) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, from); g.addColorStop(1, to);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  };
  return { text, measure, fit, poly, box, vfade };
}

const initialOf = (seller) => String(seller?.full_name || '?').trim().charAt(0).toUpperCase();

// Seller bar: photo, name, role + page link on the left, WhatsApp on the right.
function sellerBar(ctx, k, { y, h, W, P, seller, copy, pageUrl, accent, scale = 1, avatarImg }) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, y, W, 2);
  const r = Math.round(28 * scale), cx = P + r, cy = y + h / 2;
  if (avatarImg) drawCircle(ctx, avatarImg, cx, cy, r);
  else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
    k.text(initialOf(seller), cx, cy + 9 * scale, { size: 26 * scale, weight: 800, align: 'center' });
  }
  const phone = seller?.whatsapp_number || seller?.phone || '';
  const rightW = phone ? Math.max(k.measure(phone, 31 * scale, 800), 140) : 0;
  const nameX = cx + r + 18 * scale, maxW = W - P - nameX - (rightW ? rightW + 24 : 0);
  const name = k.fit(String(seller?.full_name || '').trim() || ' ', maxW, 25 * scale, 800, 16);
  k.text(name.str, nameX, cy - 2 * scale, { size: name.size, weight: 800 });
  const link = pageUrl ? pageUrl.replace(/^https?:\/\//, '') : '';
  const sub = k.fit([String(seller?.job_title || '').trim() || copy.advisor, link].filter(Boolean).join(' · '), maxW, 18 * scale, 500, 13);
  k.text(sub.str, nameX, cy + 24 * scale, { size: sub.size, weight: 500, color: 'rgba(255,255,255,0.62)' });
  if (phone) {
    k.text(copy.contact, W - P, cy - 14 * scale, { size: 14 * scale, weight: 700, color: 'rgba(255,255,255,0.55)', align: 'right', spacing: 3 });
    k.text(phone, W - P, cy + 24 * scale, { size: 31 * scale, weight: 800, align: 'right' });
  }
}

const previewMark = (ctx, k, W, H, word) => {
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 6);
  k.text(word, 0, 0, { size: 150, weight: 800, color: 'rgba(255,255,255,0.09)', align: 'center', spacing: 12 });
  ctx.restore();
};

const money = (n) => `RM ${fmtRM(n)}`;
const termsLine = (c, numbers) => {
  const main = numbers.rows[0];
  return c.terms(fmtRM(numbers.deposit), main.years, fmtPct(numbers.rate), numbers.basis);
};

// ───────────────────────── Showroom 1080x1350 ─────────────────────────
function drawShowroom(ctx, k, o) {
  const { car, seller, numbers, c, lang, pageUrl, palette, ribbon, photos, avatarImg } = o;
  const W = 1080, H = 1350, pal = paletteOf(palette);
  const plan = photoPlan('showroom', photos.length);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 540, 0, W / 2, 540, 540);
  glow.addColorStop(0, pal.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 150, W, 700);

  // right-hand wedge sits BEHIND the photo, like the glow
  ctx.save(); ctx.globalAlpha = 0.4; k.poly([[W, 300], [W, 660], [W - 150, 660]], pal.accent); ctx.restore();
  // Hero. A cut-out car stands on the glow with its shadow; otherwise the photo
  // fills the band (and fades into the page top and bottom).
  const HY = 300, HH = 480;
  if (o.cutout) {
    const place = placeCar({ bounds: cutoutBounds(o.cutout), W, H, zone: { x: 4, y: (HY / H) * 100, w: 92, h: (HH / H) * 100 }, fit: { size: 1, lift: 0 } });
    drawCarShadow(ctx, place);
    ctx.save(); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(o.cutout, place.sx, place.sy, place.sw, place.sh, place.dx, place.dy, place.dw, place.dh);
    ctx.restore();
  } else {
    if (photos[0]) drawCover(ctx, photos[0], 0, HY, W, HH, 0);
    else { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, HY, W, HH); k.text(c.noPhoto, W / 2, HY + HH / 2, { size: 30, weight: 600, color: 'rgba(255,255,255,0.5)', align: 'center' }); }
    k.vfade(0, HY, W, 150, pal.bg, 'rgba(0,0,0,0)');
    const bottomFade = ctx.createLinearGradient(0, HY + HH - 200, 0, HY + HH);
    bottomFade.addColorStop(0, 'rgba(0,0,0,0)'); bottomFade.addColorStop(1, pal.bg);
    ctx.fillStyle = bottomFade; ctx.fillRect(0, HY + HH - 200, W, 200);
  }

  // corner wedge, top left (over the photo's fade)
  ctx.save(); ctx.globalAlpha = 0.9; k.poly([[0, 0], [210, 0], [0, 150]], pal.accent); ctx.restore();

  // header: brand small, model + variant big and slanted, spec line
  const brand = String(car?.brand || '').toUpperCase();
  if (brand) k.text(brand, W / 2, 64, { size: 24, weight: 700, color: 'rgba(255,255,255,0.75)', align: 'center', spacing: 10 });
  const model = String(car?.model || car?.brand || 'CAR').toUpperCase();
  const variant = String(car?.variant || '').toUpperCase();
  const full = variant ? `${model} ${variant}` : model;
  const t = k.fit(full, 960, 140, 400, 60, DISPLAY);
  const modelW = k.measure(model, t.size, 400, DISPLAY), spaceW = k.measure(' ', t.size, 400, DISPLAY);
  const totalW = k.measure(full, t.size, 400, DISPLAY);
  const tx = (W - totalW) / 2;
  k.text(model, tx, 180, { size: t.size, weight: 400, family: DISPLAY, slant: SLANT });
  if (variant) k.text(variant, tx + modelW + spaceW, 180, { size: t.size, weight: 400, family: DISPLAY, color: pal.accent, slant: SLANT });
  const parts = specParts(car);
  if (parts.length) {
    const size = 26, sp = 7, gap = 22, dot = 9;
    const widths = parts.map((p) => k.measure(p, size, 600, FAMILY, sp));
    const total = widths.reduce((a, b) => a + b, 0) + (parts.length - 1) * (gap * 2 + dot);
    let x = (W - total) / 2;
    parts.forEach((p, i) => {
      k.text(p, x, 238, { size, weight: 600, spacing: sp });
      x += widths[i];
      if (i < parts.length - 1) { ctx.beginPath(); ctx.arc(x + gap + dot / 2, 229, dot / 2, 0, Math.PI * 2); ctx.fillStyle = pal.accent; ctx.fill(); x += gap * 2 + dot; }
    });
  }

  // feature strip
  const feats = featureStrip(car, lang);
  const SY = 778;
  if (feats.length) {
    ctx.fillStyle = pal.accent; ctx.fillRect(36, SY, W - 72, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(36, SY + 70, W - 72, 2);
    const cw = (W - 72) / feats.length;
    feats.forEach((f, i) => {
      const fx = k.fit(f.toUpperCase(), cw - 30, 20, 700, 13, FAMILY, 2);
      k.text(fx.str, 36 + cw * i + cw / 2, SY + 45, { size: fx.size, weight: 700, align: 'center', spacing: 2 });
      if (i) { ctx.fillStyle = pal.accent; ctx.fillRect(36 + cw * i, SY + 16, 2, 40); }
    });
  }

  // thumbs (parallelograms with an accent edge)
  const TH = ribbon && ribbon !== 'none' ? 176 : 226, TY = 866;
  const slots = plan.thumbs;
  if (slots.length) {
    const gap = 18, totalW = W - 48, w = (totalW - gap * (slots.length - 1)) / slots.length, s = 34;
    slots.forEach((idx, i) => {
      const x = 24 + i * (w + gap);
      k.poly([[x + s, TY], [x + w, TY], [x + w - s, TY + TH], [x, TY + TH]], pal.accent);
      ctx.save();
      ctx.beginPath(); [[x + s - 1 + 4, TY + 4], [x + w - 4, TY + 4], [x + w - s + 1 - 4, TY + TH - 4], [x + 4, TY + TH - 4]].forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.clip();
      drawCover(ctx, photos[idx], x, TY, w, TH, 0);
      ctx.restore();
    });
  }

  // ribbon
  if (ribbon && ribbon !== 'none' && RIBBON_TEXT[lang]?.[ribbon]) {
    const rx = 120, rw = W - 240, ry = 1054, rh = 54;
    const g = ctx.createLinearGradient(rx, 0, rx + rw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.12, pal.accent); g.addColorStop(0.88, pal.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle = g; k.poly([[rx + 14, ry], [rx + rw + 14, ry], [rx + rw - 14, ry + rh], [rx - 14, ry + rh]], g); ctx.restore();
    k.text(RIBBON_TEXT[lang][ribbon].toUpperCase(), W / 2, ry + 37, { size: 28, weight: 800, align: 'center', spacing: 2, slant: SLANT });
  }

  // price plates: cash, and from / month on the longest tenure
  const PY = 1150, PH = 90, pw = (W - 72 - 30) / 2, sk = 19;
  const plate = (x, label, drawValue) => {
    k.poly([[x + sk, PY], [x + pw + sk, PY], [x + pw, PY + PH], [x, PY + PH]], pal.plate, pal.accent, 2);
    const lw = k.measure(label.toUpperCase(), 19, 800, FAMILY, 2) + 40;
    k.poly([[x + sk + 6 + 8, PY - 24], [x + sk + 6 + lw + 8, PY - 24], [x + sk + 6 + lw, PY], [x + 6, PY]], pal.accent);
    k.text(label.toUpperCase(), x + sk + 6 + 24, PY - 5, { size: 19, weight: 800, spacing: 2 });
    drawValue(x + 26 + sk / 2);
  };
  plate(36, c.cash, (x) => {
    const f = k.fit(money(numbers.price), pw - 50, 56, 800, 30);
    k.text(f.str, x, PY + 66, { size: f.size, weight: 800, color: pal.plateText });
  });
  plate(36 + pw + 30, c.fromMonth, (x) => {
    const mo = fmtRM(numbers.rows[0].monthly);
    k.text('RM', x, PY + 66, { size: 40, weight: 800, color: pal.plateText });
    const rmW = k.measure('RM', 40, 800) + 8;
    k.text(mo, x + rmW, PY + 66, { size: 56, weight: 800, color: pal.plateText });
    k.text(c.perMonth, x + rmW + k.measure(mo, 56, 800) + 6, PY + 66, { size: 24, weight: 700, color: 'rgba(255,255,255,0.8)' });
  });

  const fine = k.fit(`${termsLine(c, numbers)}. ${numbers.highValue ? c.highValue : c.disclaimer}`, W - 72, 16, 500, 11);
  k.text(fine.str, W / 2, 1256, { size: fine.size, weight: 500, color: 'rgba(255,255,255,0.5)', align: 'center' });
  sellerBar(ctx, k, { y: H - 86, h: 86, W, P: 36, seller, copy: c, pageUrl, accent: pal.accent, avatarImg });
}

// ───────────────────────── Story collage 1080x1920 ─────────────────────────
function drawStory(ctx, k, o) {
  const { car, seller, numbers, c, lang, pageUrl, ribbon, photos, avatarImg } = o;
  const W = 1080, H = 1920, FOOT = 146, GAP = 4, GH = H - FOOT;
  const plan = photoPlan('story', photos.length);
  ctx.fillStyle = '#0d0d0f'; ctx.fillRect(0, 0, W, H);
  const rows = [['top', 360], ['hero', 470], ['split', 450], ...(plan.bottom != null ? [['bottom', 478]] : [])];
  const sum = rows.reduce((a, r) => a + r[1], 0), scale = (GH - GAP * (rows.length - 1)) / sum;
  let y = 0;
  const half = (W - GAP) / 2;
  rows.forEach(([kind, base]) => {
    const h = Math.round(base * scale);
    if (kind === 'top') { drawCover(ctx, photos[plan.top[0]], 0, y, half, h); drawCover(ctx, photos[plan.top[1]], half + GAP, y, half, h); }
    if (kind === 'hero') drawCover(ctx, photos[plan.hero], 0, y, W, h);
    if (kind === 'bottom') drawCover(ctx, photos[plan.bottom], 0, y, W, h);
    if (kind === 'split') {
      let px = 0, pw = W;
      if (plan.split != null) { drawCover(ctx, photos[plan.split], 0, y, half, h); px = half + GAP; pw = half; }
      ctx.fillStyle = '#0d0d0f'; ctx.fillRect(px, y, pw, h);
      textPanel(ctx, k, { x: px, y, w: pw, h, car, numbers, c, lang, ribbon });
    }
    y += h + GAP;
  });
  const fine = k.fit(`${termsLine(c, numbers)}. ${numbers.highValue ? c.highValue : c.disclaimer}`, W - 40, 17, 500, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, GH - 34, W, 34);
  k.text(fine.str, W / 2, GH - 11, { size: fine.size, weight: 500, color: 'rgba(255,255,255,0.6)', align: 'center' });
  ctx.fillStyle = '#000'; ctx.fillRect(0, GH, W, FOOT);
  sellerBar(ctx, k, { y: GH, h: FOOT, W, P: 44, seller, copy: c, pageUrl, accent: '#e11d2a', scale: 1.35, avatarImg });
}

function textPanel(ctx, k, { x, y, w, h, car, numbers, c, lang, ribbon }) {
  const inner = w - 68, cx = x + w / 2;
  const tag = ribbon && ribbon !== 'none' && RIBBON_TEXT[lang]?.[ribbon] ? RIBBON_TEXT[lang][ribbon] : c.forSale;
  const name = [car?.year, car?.brand, car?.model].filter(Boolean).join(' ') || 'Car';
  const sub = [car?.variant, specParts(car).filter((p) => /KM$/i.test(p))[0]?.toLowerCase()].filter(Boolean).join(' · ');
  const feats = featureStrip(car, lang, 2).join(' · ');
  const lines = [];
  lines.push({ h: 26, draw: (yy) => k.text(tag.toUpperCase(), cx, yy + 22, { size: 24, weight: 700, color: '#e11d2a', align: 'center', spacing: 6 }) });
  const nm = k.fit(name, inner, 38, 700, 22);
  lines.push({ h: 48, draw: (yy) => k.text(nm.str, cx, yy + 38, { size: nm.size, weight: 700, align: 'center' }) });
  [sub, feats].filter(Boolean).forEach((t) => {
    const f = k.fit(t, inner, 22, 500, 14);
    lines.push({ h: 32, draw: (yy) => k.text(f.str, cx, yy + 24, { size: f.size, weight: 500, color: 'rgba(255,255,255,0.7)', align: 'center' }) });
  });
  const pr = k.fit(money(numbers.price), inner - 40, 50, 800, 28);
  lines.push({ h: 78, gap: 12, draw: (yy) => { ctx.fillStyle = '#fff'; ctx.fillRect(x + 34, yy, inner, 66); k.text(pr.str, cx, yy + 50, { size: pr.size, weight: 800, color: '#0d0d0f', align: 'center' }); } });
  const mo = `${c.fromMonth.split(' / ')[0]} ${money(numbers.rows[0].monthly)}${c.perMonth}`;
  lines.push({ h: 34, gap: 4, draw: (yy) => k.text(mo, cx, yy + 26, { size: 26, weight: 600, color: 'rgba(255,255,255,0.75)', align: 'center' }) });
  const total = lines.reduce((a, l) => a + l.h + (l.gap || 6), 0);
  let yy = y + Math.max(8, (h - total) / 2);
  lines.forEach((l) => { l.draw(yy); yy += l.h + (l.gap || 6); });
}

// ───────────────────────── Card 1080x1920 ─────────────────────────
function averageTint(img) {
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 8;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, 8, 8);
    const d = cx.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return tintFromRgb(r / n, g / n, b / n);
  } catch { return CARD_FALLBACK_TINT; }
}

function drawCard(ctx, k, o) {
  const { car, seller, numbers, c, lang, photos } = o;
  const W = 1080, H = 1920, PX = 119, PW = 842;
  const tint = photos[0] ? averageTint(photos[0]) : CARD_FALLBACK_TINT;
  // The card's own gradient, built from its colour so the hue stays rich: a lift
  // at the top, the colour itself in the middle, a deeper tone at the foot.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mixHex(tint, '#ffffff', 0.10)); bg.addColorStop(0.42, tint); bg.addColorStop(1, mixHex(tint, '#000000', 0.35));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // seller name with a red dot on top
  const who = String(seller?.full_name || '').trim().toUpperCase();
  if (who) {
    const f = k.fit(who, 700, 30, 700, 18, FAMILY, 2);
    const tw = k.measure(f.str, f.size, 700, FAMILY, 2), x0 = (W - (tw + 52)) / 2;
    ctx.beginPath(); ctx.arc(x0 + 22, 62, 22, 0, Math.PI * 2); ctx.fillStyle = '#dc2626'; ctx.fill();
    k.text(f.str, x0 + 52, 73, { size: f.size, weight: 700, spacing: 2 });
  }

  // The car. Never cropped: a cut-out stands on the colour with a shadow, a
  // plain photo is shown whole (contain) on a soft card. The photo + the name
  // and facts under it are one block, centred between the top bar and the price.
  const REGION_Y = 130, REGION_H = 1440, GAPN = 56, TEXTH = 96;
  const src = o.cutout || photos[0];
  const cb = o.cutout ? cutoutBounds(o.cutout) : null;
  const iw = cb ? cb.w : (src?.naturalWidth || src?.width || 0), ih = cb ? cb.h : (src?.naturalHeight || src?.height || 0);
  const maxH = REGION_H - GAPN - TEXTH;
  const fitSz = o.cutout ? fitInside(iw, ih, 960, Math.min(maxH, 760)) : fitInside(iw, ih, PW, maxH);
  const blockH = fitSz.h + GAPN + TEXTH;
  const by = REGION_Y + Math.max(0, (REGION_H - blockH) / 2);
  const bx = (W - fitSz.w) / 2;
  if (src && fitSz.w) {
    if (o.cutout) {
      const spot = ctx.createRadialGradient(W / 2, by + fitSz.h * 0.55, 0, W / 2, by + fitSz.h * 0.55, 620);
      const glowHex = mixHex(tint, '#ffffff', 0.32);
      spot.addColorStop(0, `${glowHex}99`); spot.addColorStop(1, `${glowHex}00`);
      ctx.fillStyle = spot; ctx.fillRect(0, by - 200, W, fitSz.h + 500);
      drawCarShadow(ctx, { dx: bx, dw: fitSz.w, dh: fitSz.h, floorY: by + fitSz.h });
      ctx.save(); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(o.cutout, cb.x, cb.y, cb.w, cb.h, bx, by, fitSz.w, fitSz.h);
      ctx.restore();
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
      k.box(bx, by, fitSz.w, fitSz.h, 8, tint); ctx.restore();
      ctx.save(); roundRectPath(ctx, bx, by, fitSz.w, fitSz.h, 8); ctx.clip();
      ctx.drawImage(src, bx, by, fitSz.w, fitSz.h);
      // the photo melts into the card at its foot (and is a touch darker at the top)
      const sheen = ctx.createLinearGradient(0, by, 0, by + fitSz.h);
      sheen.addColorStop(0, 'rgba(0,0,0,0.12)'); sheen.addColorStop(0.3, 'rgba(0,0,0,0)'); sheen.addColorStop(0.6, 'rgba(0,0,0,0)'); sheen.addColorStop(1, tint);
      ctx.fillStyle = sheen; ctx.fillRect(bx, by, fitSz.w, fitSz.h);
      ctx.restore();
    }
  }

  // grade: only a recon car with a grade the seller typed, worded as theirs
  const recon = car?.is_recon === true || String(car?.condition || '').toLowerCase() === 'recon';
  if (recon && car?.auction_grade) {
    const gxx = Math.max(PX, Math.min(PX + PW, bx + fitSz.w) - 170 - 24), gy = by + 24;
    k.box(gxx, gy, 170, 112, 20, 'rgba(8,10,14,0.72)');
    ctx.save(); roundRectPath(ctx, gxx, gy, 170, 112, 20); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke(); ctx.restore();
    k.text(c.auctionGrade, gxx + 85, gy + 34, { size: 17, weight: 700, color: 'rgba(255,255,255,0.7)', align: 'center', spacing: 3 });
    const gv = k.fit(String(car.auction_grade).trim(), 140, 64, 800, 28);
    k.text(gv.str, gxx + 85, gy + 92, { size: gv.size, weight: 800, align: 'center' });
  }

  // name + facts
  const nm = k.fit([car?.year, car?.brand, car?.model].filter(Boolean).join(' ') || 'Car', W - 80, 50, 700, 28);
  k.text(nm.str, W / 2, by + fitSz.h + GAPN, { size: nm.size, weight: 700, align: 'center' });
  const facts = [car?.variant, ...specParts(car).filter((p) => /KM$/i.test(p)).map((p) => p.toLowerCase())].filter(Boolean).join(' · ');
  if (facts) { const f = k.fit(facts, W - 120, 30, 500, 18); k.text(f.str, W / 2, by + fitSz.h + GAPN + 52, { size: f.size, weight: 500, color: 'rgba(255,255,255,0.7)', align: 'center' }); }

  // red wash at the foot, then the monthly
  k.vfade(0, H - 576, W, 576, 'rgba(140,20,30,0)', 'rgba(140,20,30,0.55)');
  k.text(c.fromMonth.split(' / ')[0], PX, 1640, { size: 28, weight: 600, color: 'rgba(255,255,255,0.65)' });
  const mo = fmtRM(numbers.rows[0].monthly);
  const mf = k.fit(`RM ${mo}`, PW - 120, 124, 800, 64);
  k.text(mf.str, PX, 1640 + 20 + mf.size * 0.82, { size: mf.size, weight: 800 });
  k.text(c.perMonth, PX + k.measure(mf.str, mf.size, 800) + 8, 1640 + 20 + mf.size * 0.82, { size: 44, weight: 600, color: 'rgba(255,255,255,0.85)' });
  const l1 = k.fit(`${money(numbers.price)} · ${termsLine(c, numbers)}`, PW, 24, 500, 15);
  k.text(l1.str, PX, 1806, { size: l1.size, weight: 500, color: 'rgba(255,255,255,0.62)' });
  const l2 = k.fit(numbers.highValue ? c.highValue : c.disclaimer, PW, 22, 500, 14);
  k.text(l2.str, PX, 1836, { size: l2.size, weight: 500, color: 'rgba(255,255,255,0.55)' });
  if (Number(car?.warranty_months) > 0) k.text(c.warranty(Number(car.warranty_months)), PX, 1884, { size: 28, weight: 700, color: '#f5d68a' });
  const phone = seller?.whatsapp_number || seller?.phone || '';
  if (phone) k.text(phone, PX + PW, 1884, { size: 28, weight: 700, align: 'right' });
}

// Cut-outs made this session, by photo URL, so reopening the sheet (or changing
// style) never runs the 30 to 80 second job twice. Memory only, never uploaded.
const cutCache = new Map();
export const cachedCutout = (url) => cutCache.get(url) || null;
export const rememberCutout = (url, img) => { if (url && img) cutCache.set(url, img); };

// ───────────────────────── entry point ─────────────────────────
// opts: { cutout (an Image with a clear background, Showroom + Card only), style, palette, ribbon, car, seller, numbers, lang, pageUrl, preview, dpr }
export async function renderPoster(canvas, opts) {
  const style = styleOf(opts.style);
  if (style.id === 'kiraan') return renderLoanPoster(canvas, opts);
  const urls = photosOf(opts.car).slice(0, 5);
  if (!styleAvailable(style.id, urls.length)) throw new Error('not_enough_photos');
  const c = POSTER_COPY[opts.lang] || POSTER_COPY.ms;
  const [, ...loaded] = await Promise.all([ensureFonts(), ...urls.map(cachedImage), cachedImage(opts.seller?.avatar_url || null)]);
  const avatarImg = loaded.pop();
  const photos = loaded.filter(Boolean);
  // a photo that would not load must not shift the layout: drop it, keep going
  if (!styleAvailable(style.id, photos.length)) throw new Error('not_enough_photos');

  const { w: W, h: H } = style, dpr = opts.dpr || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = kit(ctx);
  const o = { ...opts, c, photos, avatarImg };
  if (style.id === 'showroom') drawShowroom(ctx, k, o);
  else if (style.id === 'story') drawStory(ctx, k, o);
  else drawCard(ctx, k, o);
  if (opts.preview) previewMark(ctx, k, W, H, c.preview);
  return canvas;
}

