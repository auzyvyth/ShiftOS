import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw, MessageCircle, Search, Download, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AmortizationSchedule from './AmortizationSchedule';
import { supabase } from '../supabaseClient';
import { estimateRoadTax } from '../utils/roadTax';
import { getDealerIdFromProfile } from '../hooks/useProfile';
import { getStorefrontUrl } from '../hooks/useTenant';
import { DEFAULT_EIR, loanTotals } from '../utils/financing';

// ─── Insurance estimate ───────────────────────────────────────────────────────
const NCD_TIERS = [0, 25, 30, 38.33, 45, 55];

const VEHICLE_TYPE_NON_SALOON_RATES = [
  { maxCc: 1400,  rate: 297 },
  { maxCc: 1650,  rate: 432 },
  { maxCc: 2200,  rate: 514 },
  { maxCc: 2500,  rate: 1280 },
  { maxCc: 3050,  rate: 1466 },
  { maxCc: 4250,  rate: 1711 },
  { maxCc: Infinity, rate: 2097 },
];

const calcSaloonGross = (sum) => {
  if (sum <= 0) return 0;
  let gross = 26.00; // first RM1,000
  const tiers = [
    { cap: 15000, rate: 0.01615 },
    { cap: 15000, rate: 0.01540 },
    { cap: 25000, rate: 0.01400 },
    { cap: 25000, rate: 0.01370 },
    { cap: 50000, rate: 0.01295 },
    { cap: 50000, rate: 0.01250 },
    { cap: Infinity, rate: 0.01220 },
  ];
  let remaining = Math.max(0, sum - 1000);
  for (const { cap, rate } of tiers) {
    if (remaining <= 0) break;
    const chunk = Math.min(remaining, cap);
    gross += chunk * rate;
    remaining -= chunk;
  }
  return gross;
};

const calcInsurance = (sum, ncd, vehicleType, cc) => {
  if (!sum || sum <= 0) return null;
  let grossRaw;
  if (vehicleType === 'Non-Saloon') {
    const ccNum = parseFloat(cc) || 0;
    const tier = VEHICLE_TYPE_NON_SALOON_RATES.find(t => ccNum <= t.maxCc);
    grossRaw = tier ? tier.rate : 2097;
  } else {
    grossRaw = calcSaloonGross(sum);
  }
  // Round each line item first, then sum the rounded values — so the
  // displayed rows (gross − NCD savings + SST + stamp duty) always foot
  // exactly to the displayed total instead of drifting by RM1.
  const gross      = Math.round(grossRaw);
  const netPremium = Math.round(gross * (1 - ncd / 100));
  const sst        = Math.round(netPremium * 0.08);
  const stampDuty  = 10;
  const total      = netPremium + sst + stampDuty;
  return {
    gross,
    netPremium,
    sst,
    stampDuty,
    total,
    net: total, // keeps existing .net usage working
  };
};

const BODY_TYPES = ['Sedan', 'Hatchback', 'Coupe', 'SUV', 'MPV', 'Pickup'];
const CC_QUICK   = [1000, 1300, 1500, 1600, 1800, 2000, 2500, 3000];

// ─── Shared styled primitives ─────────────────────────────────────────────────

const Label = ({ children }) => (
  <p style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px 0', fontFamily: "system-ui,sans-serif" }}>
    {children}
  </p>
);

const InputBase = ({ prefix, suffix, ...props }) => (
  <div style={{ position: 'relative' }}>
    {prefix && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>{prefix}</span>}
    <input
      {...props}
      style={{
        width: '100%', background: 'var(--fc-input-bg)', border: '1px solid var(--fc-input-border)',
        borderRadius: 10, color: 'var(--fc-input-color)', fontSize: 14, fontWeight: 600, outline: 'none',
        padding: prefix ? '10px 12px 10px 32px' : suffix ? '10px 32px 10px 12px' : '10px 12px',
        fontFamily: "system-ui,sans-serif", transition: 'border-color 0.15s',
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor = 'rgba(220,38,38,0.5)'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--fc-input-border)'; }}
    />
    {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 12, pointerEvents: 'none' }}>{suffix}</span>}
  </div>
);

const SelectBase = ({ children, ...props }) => (
  <div style={{ position: 'relative' }}>
    <select
      {...props}
      style={{
        width: '100%', background: 'var(--fc-input-bg)', border: '1px solid var(--fc-input-border)',
        borderRadius: 10, color: 'var(--fc-input-color)', fontSize: 14, fontWeight: 600, outline: 'none',
        padding: '10px 32px 10px 12px', appearance: 'none', cursor: 'pointer',
        fontFamily: "system-ui,sans-serif",
      }}
    >
      {children}
    </select>
    <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
  </div>
);

const ResultRow = ({ label, value, highlight, muted, borderTop }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: highlight ? '10px 12px' : '8px 0',
    background: highlight ? 'rgba(220,38,38,0.08)' : 'transparent',
    borderRadius: highlight ? 8 : 0,
    borderTop: borderTop ? '1px solid var(--fc-divider)' : 'none',
    marginTop: borderTop ? 8 : 0,
  }}>
    <span style={{ color: muted ? '#6b7280' : '#9ca3af', fontSize: 13 }}>{label}</span>
    <span style={{ color: highlight ? 'var(--fc-highlight)' : muted ? '#6b7280' : 'var(--fc-result-value)', fontWeight: highlight ? 700 : 600, fontSize: highlight ? 15 : 14 }}>
      {value}
    </span>
  </div>
);

// ─── Poster image helpers ───────────────────────────────────────────────────────
// Remote images (car photo, seller avatar) live on the Supabase CDN. A <canvas>
// can only draw a fully-loaded, same-origin-safe HTMLImageElement, so we fetch →
// dataURL → decode into an Image first (this also normalises any format, incl.
// webp). Every step is wrapped so a failed or blocked image never breaks the
// poster — that element simply doesn't render and the layout falls back.

const fetchDataUrl = (url) => new Promise((resolve) => {
  if (!url) return resolve(null);
  fetch(url, { mode: 'cors' })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('bad status'))))
    .then((blob) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    })
    .catch(() => resolve(null));
});

const loadImg = (dataUrl) => new Promise((resolve) => {
  if (!dataUrl) return resolve(null);
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = dataUrl;
});

const roundRectPath = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Cover-crop a loaded image directly into a rounded box on the poster canvas
// (the box fills, centre-crops to the box's aspect, and clips to rounded corners).
const drawCover = (ctx, img, x, y, w, h, r = 0) => {
  ctx.save();
  if (r > 0) { roundRectPath(ctx, x, y, w, h, r); ctx.clip(); }
  const ar = img.width / img.height, tar = w / h;
  let sw, sh, sx, sy;
  if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / tar; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
};

// Centre-crop a loaded image into a circle on the poster canvas.
const drawCircle = (ctx, img, cx, cy, r) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
};

// ─── Poster generation (single shareable image) ────────────────────────────────
// A social-ready quotation POSTER rendered to ONE portrait JPEG — not a PDF. PDFs
// don't preview on Instagram / WhatsApp / Facebook (they show a grey file icon or
// force a download) and the old A4 quote spilled to two pages. This is one
// 1080×1350 (4:5) frame — the largest portrait size every feed shows uncropped.
// Layout top→bottom: [car photo | name · monthly · price] hero row, then the
// seller TRUST card, then all the financing / on-road numbers. The seller block is
// data-driven: pass a salesman (Lite/Premium) or a dealer and it renders whatever
// is present, so the same poster serves every tier without change.

const generateQuotationImage = async ({ dealer, salesman, sellerPageUrl, carDetails, calc, fmt }) => {
  // Design space is 1080×1350; render at 2× so text stays crisp when downscaled.
  const W = 1080, H = 1350, P = 60, CW = W - P * 2, DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.textBaseline = 'alphabetic';

  // Palette — one red accent on white.
  const INK = '#111827', SUB = '#6b7280', FAINT = '#9ca3af';
  const RED = '#dc2626', LINE = '#e5e7eb', TINT = '#f9fafb', BIO = '#4b5563';

  const font = (size, weight = 400, italic = false) =>
    `${italic ? 'italic ' : ''}${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const text = (str, x, y, { size = 14, weight = 400, color = INK, align = 'left', italic = false } = {}) => {
    ctx.font = font(size, weight, italic);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  };
  const measure = (str, size, weight = 400) => { ctx.font = font(size, weight); return ctx.measureText(str).width; };
  // Canvas has no splitTextToSize — wrap on whole words to a max pixel width.
  const wrap = (str, maxW, size, weight = 400) => {
    ctx.font = font(size, weight);
    const out = []; let line = '';
    for (const word of String(str).split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    if (line) out.push(line);
    return out;
  };
  // Truncate to one line with a trailing ellipsis when it overruns maxW.
  const ellipsize = (str, maxW, size, weight = 400) => {
    if (!str || measure(str, size, weight) <= maxW) return str || '';
    let s = str;
    while (s.length > 1 && measure(`${s}…`, size, weight) > maxW) s = s.slice(0, -1);
    return `${s.replace(/\s+$/, '')}…`;
  };
  const rrect = (x, y, w, h, r, fill, stroke) => {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };

  // White ground.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Remote imagery loaded up front (parallel) so the draw pass is synchronous.
  const [carImg, avatarImg] = await Promise.all([
    loadImg(await fetchDataUrl(carDetails.image)),
    loadImg(await fetchDataUrl(carDetails.sellerAvatar)),
  ]);

  const brandName = dealer?.dealership || dealer?.site_name || salesman?.dealership || salesman?.site_name || null;
  const sellerName = salesman?.full_name || salesman?.name || brandName || 'XDrive.my';
  const sellerContact = salesman?.whatsapp_number || salesman?.phone || dealer?.whatsapp_number || null;
  const sellerBio = salesman?.bio || null;
  const sellerRole = salesman ? (salesman.job_title || 'Sales Consultant') : (brandName ? 'Dealership' : null);
  const sellerVerified = !!(salesman?.is_verified || dealer?.is_verified);
  const dateStr = new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Header ────────────────────────────────────────────────────────────────
  ctx.fillStyle = RED;
  ctx.fillRect(P, 58, 7, 34);
  text(brandName || 'XDRIVE.MY', P + 22, 86, { size: 33, weight: 700 });
  text(dateStr, W - P, 74, { size: 17, color: FAINT, align: 'right' });
  text('VEHICLE FINANCING QUOTATION', W - P, 98, { size: 15, weight: 700, color: RED, align: 'right' });

  // ── Hero: car photo (left) + name / monthly / price (right) ─────────────────
  const CAR_X = P, CAR_Y = 140, CAR_W = 420, CAR_H = 315;
  if (carImg && carImg.width) {
    drawCover(ctx, carImg, CAR_X, CAR_Y, CAR_W, CAR_H, 16);
    rrect(CAR_X, CAR_Y, CAR_W, CAR_H, 16, null, LINE);
  } else {
    rrect(CAR_X, CAR_Y, CAR_W, CAR_H, 16, TINT, LINE);
    text('No photo', CAR_X + CAR_W / 2, CAR_Y + CAR_H / 2 + 6, { size: 18, color: FAINT, align: 'center' });
  }

  const ix = CAR_X + CAR_W + 40;         // info column x
  const iw = W - ix - P;                 // info column width
  // Car name — shrink to fit the column, then ellipsize if still too long.
  let nm = carDetails.name || 'Vehicle';
  let nmSize = 40;
  while (measure(nm, nmSize, 700) > iw && nmSize > 26) nmSize -= 1;
  if (measure(nm, nmSize, 700) > iw) {
    while (nm.length > 4 && measure(`${nm}…`, nmSize, 700) > iw) nm = nm.slice(0, -1);
    nm = `${nm.replace(/\s+$/, '')}…`;
  }
  let iy = CAR_Y + 44;
  text(nm, ix, iy, { size: nmSize, weight: 700 });
  const metaBits = [carDetails.year, carDetails.color].filter(Boolean).join('   ·   ');
  if (metaBits) { iy += 30; text(metaBits, ix, iy, { size: 19, color: SUB }); }

  // Monthly installment — the hook, made large and red.
  iy += 66;
  text('MONTHLY INSTALLMENT', ix, iy, { size: 14, weight: 700, color: FAINT });
  iy += 46;
  const monthlyStr = `RM ${fmt(calc.monthly, 0)}`;
  text(monthlyStr, ix, iy, { size: 46, weight: 700, color: RED });
  text('/mo', ix + measure(monthlyStr, 46, 700) + 8, iy, { size: 20, weight: 600, color: FAINT });

  // Listed price.
  iy += 60;
  text('LISTED PRICE', ix, iy, { size: 14, weight: 700, color: FAINT });
  iy += 40;
  text(`RM ${fmt(carDetails.price)}`, ix, iy, { size: 32, weight: 700, color: INK });

  // ── Seller trust card (full width): avatar + info on the left, the seller's
  //    mini-page / storefront link on the right ─────────────────────────────────
  let y = Math.max(CAR_Y + CAR_H, iy + 8) + 44;   // clear the taller of photo / info
  const avR = 48, avCx = P + 34 + avR;
  const tx = avCx + avR + 28;

  // Right-side link chip — the whole reason a buyer keeps the poster: it routes
  // them back to everything else this seller has listed. Drawn as a pill so it
  // reads as "go here". Strip the scheme for a cleaner, more typeable URL. The
  // info column below is capped short of the chip so nothing collides.
  const linkText = sellerPageUrl ? sellerPageUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '') : null;
  const URL_SIZE = 19, PILL_H = 42, PILL_R = 10;
  let pillW = 0, pillX = W - P - 24;
  if (linkText) {
    pillW = measure(linkText, URL_SIZE, 700) + 32;
    pillX = W - P - 24 - pillW;
  }
  const textRight = linkText ? pillX - 24 : W - P - 30;   // info column right edge

  // Bio capped at 2 lines; ellipsis on clip so it reads as intentional.
  const allBio = sellerBio ? wrap(sellerBio, textRight - tx, 18) : [];
  const bioLines = allBio.slice(0, 2);
  if (allBio.length > 2 && bioLines.length === 2) bioLines[1] = `${bioLines[1].replace(/[\s.,]+$/, '')}…`;
  const cardH = bioLines.length ? 172 : 138;
  rrect(P, y, CW, cardH, 16, TINT, LINE);
  const avCy = y + cardH / 2;
  if (avatarImg && avatarImg.width) {
    drawCircle(ctx, avatarImg, avCx, avCy, avR);
  } else {
    ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.fillStyle = RED; ctx.fill();
    text((sellerName[0] || 'X').toUpperCase(), avCx, avCy + 12, { size: 34, weight: 700, color: '#fff', align: 'center' });
  }
  let ty = y + 44;
  text('PREPARED BY', tx, ty, { size: 13, weight: 700, color: FAINT });
  ty += 34;
  const nameStr = ellipsize(sellerName, textRight - tx - (sellerVerified ? 30 : 0), 28, 700);
  text(nameStr, tx, ty, { size: 28, weight: 700 });
  if (sellerVerified) {
    const bx = tx + measure(nameStr, 28, 700) + 18, by = ty - 9;
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fillStyle = RED; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 4.5, by + 0.5);
    ctx.lineTo(bx - 1.5, by + 4);
    ctx.lineTo(bx + 4.5, by - 4);
    ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  ty += 30;
  const contactLine = ellipsize([sellerRole, sellerContact].filter(Boolean).join('   ·   '), textRight - tx, 18);
  if (contactLine) { text(contactLine, tx, ty, { size: 18, color: SUB }); ty += 28; }
  bioLines.forEach((ln, i) => text(ln, tx, ty + i * 24, { size: 18, italic: true, color: BIO }));

  if (linkText) {
    text('VIEW ALL LISTINGS', pillX + pillW, avCy - 16, { size: 12, weight: 700, color: FAINT, align: 'right' });
    const pillY = avCy - 4;
    rrect(pillX, pillY, pillW, PILL_H, PILL_R, '#fdeaea', RED);
    text(linkText, pillX + pillW / 2, pillY + PILL_H / 2 + 6, { size: URL_SIZE, weight: 700, color: RED, align: 'center' });
  }
  y += cardH + 40;

  // ── The numbers ─────────────────────────────────────────────────────────────
  const financing = [
    ['Car Price',        `RM ${fmt(calc.carPrice)}`],
    ['Down Payment',     `RM ${fmt(calc.downPayment)} (${calc.dpPct}%)`],
    ['Loan Amount',      `RM ${fmt(calc.loanAmt)}`],
    ['Loan Tenure',      `${calc.loanTerm} years`],
    ['Interest (EIR)',   `${calc.intRate}% p.a.`],
    ['Total Interest',   `RM ${fmt(calc.interest)}`],
    ['Total Repayment',  `RM ${fmt(calc.totalLoan)}`, { strong: true }],
  ];
  const onRoad = [];
  if (calc.roadTax != null) {
    const ccLabel = calc.rtCc ? ` · ${Number(calc.rtCc).toLocaleString()}cc` : '';
    onRoad.push([`Road Tax${ccLabel}`, `RM ${fmt(Math.round(calc.roadTax))}`]);
  }
  if (calc.insCalc) {
    const ins = calc.insCalc;
    const vtLabel = calc.vehicleType === 'Non-Saloon' ? 'SUV/MPV' : 'Saloon';
    onRoad.push([`Insurance (${vtLabel})`, `RM ${fmt(ins.gross)}`]);
    // Canvas renders the real U+2212 minus fine (unlike jsPDF's Helvetica).
    onRoad.push([`NCD ${calc.insNcd}% saved`, `− RM ${fmt(ins.gross - ins.netPremium)}`, { sub: true }]);
    onRoad.push([`SST (8%)`, `RM ${fmt(ins.sst)}`, { sub: true }]);
    onRoad.push([`Stamp duty`, `RM 10`, { sub: true }]);
    onRoad.push([`Insurance total`, `RM ${fmt(ins.total)}`, { strong: true }]);
  }

  const RH = 50;
  const drawTable = (colX, startY, colW, title, rows) => {
    ctx.fillStyle = RED;
    ctx.fillRect(colX, startY, 5, 20);
    text(title, colX + 14, startY + 16, { size: 18, weight: 700 });
    let ry = startY + 34;
    rows.forEach(([label, value, opt = {}], i) => {
      if (i % 2 === 0) { ctx.fillStyle = TINT; ctx.fillRect(colX, ry, colW, RH); }
      const { strong, sub } = opt;
      const cy = ry + RH / 2 + 6;
      text(label, colX + (sub ? 22 : 12), cy, { size: 17, weight: strong ? 700 : 400, color: strong ? RED : sub ? FAINT : SUB });
      text(value, colX + colW - 12, cy, { size: strong ? 19 : 17, weight: 700, color: strong ? RED : sub ? FAINT : INK, align: 'right' });
      ry += RH;
    });
    return ry;
  };

  if (onRoad.length) {
    // Two columns side by side so all the numbers stay on one screen.
    const colGap = 34, colW = (CW - colGap) / 2;
    const leftEnd = drawTable(P, y, colW, 'FINANCING BREAKDOWN', financing);
    const rightEnd = drawTable(P + colW + colGap, y, colW, 'ON-ROAD COSTS (EST.)', onRoad);
    y = Math.max(leftEnd, rightEnd);
  } else {
    y = drawTable(P, y, CW, 'FINANCING BREAKDOWN', financing);
  }
  y += 26;

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, y); ctx.lineTo(W - P, y); ctx.stroke();
  y += 26;
  wrap('Valid for 7 days, subject to change without notice. All figures are estimates; final pricing subject to confirmation.', CW, 14, false)
    .forEach((ln, i) => text(ln, P, y + i * 20, { size: 14, italic: true, color: FAINT }));
  y += 46;
  text('Generated via XDrive.my', P, y, { size: 15, weight: 700, color: RED });
  if (sellerContact) text(`${sellerName} · ${sellerContact}`, W - P, y, { size: 15, color: SUB, align: 'right' });

  // Export the single frame as a JPEG the salesman can attach to any post.
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xdrive-quote-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, 'image/jpeg', 0.92);
  });
};

// ─── Main component ───────────────────────────────────────────────────────────

const FinancingCalculator = ({
  initialPrice = 85000, engineCc = null, bodyType = null,
  carName: carNameProp = '', carYear: carYearProp = '', carColor: carColorProp = '', carImage = null, light = false,
  // Seller context for the poster's "prepared by" / dealership header. Pass explicit
  // dealer/salesman (even null, meaning "known to have no seller") when the page
  // already knows who's selling — e.g. a specific car's dealer, or a dealer's own
  // subdomain. Leave resolveFromSession at its default only for internal tools
  // (dashboard, F&I panel) where the logged-in user IS the preparer.
  dealer = null, salesman = null, resolveFromSession = dealer === null && salesman === null,
  // Ready-made mini-page URL (salesman /s/slug or dealer subdomain) printed on the
  // poster's trust card. When null the download handler derives it from the seller.
  sellerPageUrl = null,
}) => {
  const { t } = useTranslation();

  // Financing inputs
  const [carPrice,  setCarPrice]  = useState(initialPrice);
  const [dpPct,     setDpPct]     = useState(10);
  const [loanTerm,  setLoanTerm]  = useState(7);
  // An EIR (HP (Amendment) Act 2026): interest on the reducing balance.
  const [intRate,   setIntRate]   = useState(DEFAULT_EIR);

  // Road tax inputs
  const [rtCc,   setRtCc]   = useState(engineCc ? String(engineCc) : '');
  const [rtBody, setRtBody] = useState(bodyType || 'Sedan');

  // Insurance inputs
  const [insSum, setInsSum] = useState(initialPrice);
  const [insNcd, setInsNcd] = useState(55);
  const [vehicleType, setVehicleType] = useState('Saloon'); // 'Saloon' | 'Non-Saloon'

  // Car details for the poster (pre-filled from props when coming from a listing)
  const [carName,  setCarName]  = useState(carNameProp);
  const [carYear,  setCarYear]  = useState(carYearProp);
  const [carColor, setCarColor] = useState(carColorProp);

  // Poster (image) generation state
  const [imgLoading, setImgLoading] = useState(false);

  // Compact by default: only monthly / deposit / full price / interest show.
  // Road tax, insurance, EIR, loan breakdown, the poster's car-detail fields
  // and the amortization schedule all live behind this one toggle.
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => { setCarPrice(initialPrice); setInsSum(initialPrice); }, [initialPrice]);
  useEffect(() => { if (engineCc) setRtCc(String(engineCc)); }, [engineCc]);
  useEffect(() => { if (bodyType) setRtBody(bodyType); }, [bodyType]);
  useEffect(() => { if (carNameProp)  setCarName(carNameProp); },  [carNameProp]);
  useEffect(() => { if (carYearProp)  setCarYear(carYearProp); },  [carYearProp]);
  useEffect(() => { if (carColorProp) setCarColor(carColorProp); }, [carColorProp]);

  // Calculations
  const downPayment = (carPrice * dpPct) / 100;
  const loanAmt     = Math.max(0, carPrice - downPayment);
  // Reducing balance (src/utils/financing.js) — this was a flat-rate formula.
  const loanCalc    = loanTotals(loanAmt, intRate, loanTerm * 12);
  // Banks never round installments down (they can't undercollect) — ceiling
  // to the nearest cent so the figure shown matches real HP quotes.
  const monthly     = Math.ceil(loanCalc.monthly * 100) / 100;
  const totalLoan   = monthly * loanTerm * 12;
  const interest    = Math.max(0, totalLoan - loanAmt);
  // The rate typed in IS the EIR now; kept under this name for the poster.
  const eir = intRate;

  const roadTax  = estimateRoadTax(rtCc);
  const insCalc  = calcInsurance(insSum || carPrice, insNcd, vehicleType, rtCc);

  const onRoadPrice = carPrice + (roadTax != null ? Math.round(roadTax) : 0) + (insCalc?.net || 0);

  const isValid = carPrice > 0 && downPayment < carPrice && loanTerm > 0 && intRate > 0;

  const fmt = (n, d = 0) => n != null && !Number.isNaN(n)
    ? n.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

  const reset = () => { setCarPrice(initialPrice); setDpPct(10); setLoanTerm(7); setIntRate(DEFAULT_EIR); setRtCc(engineCc ? String(engineCc) : ''); setRtBody(bodyType || 'Sedan'); setInsSum(initialPrice); setInsNcd(55); };

  // Light vs dark palette
  const c = light ? {
    cardBg:        'white',
    cardBorder:    '1px solid #DDE3EC',
    inputBg:       'white',
    inputBorder:   '1px solid #DDE3EC',
    inputColor:    '#111827',
    inputFocusBorder: 'rgba(220,38,38,0.5)',
    inputBlurBorder:  '#DDE3EC',
    sectionTitle:  '#111827',
    resultValue:   '#111827',
    resultHighlight: '#dc2626',
    divider:       '#e5e7eb',
    monthly:       '#111827',
    pillBg:        '#f3f4f6',
    pillBorder:    '#DDE3EC',
    pillColor:     '#4b5563',
    browseBg:      '#f3f4f6',
    browseBorder:  '#e5e7eb',
    browseColor:   '#374151',
    selectOption:  '#ffffff',
  } : {
    cardBg:        'linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))',
    cardBorder:    '1px solid rgba(255,255,255,0.07)',
    inputBg:       'rgba(255,255,255,0.04)',
    inputBorder:   '1px solid rgba(255,255,255,0.08)',
    inputColor:    'white',
    inputFocusBorder: 'rgba(220,38,38,0.5)',
    inputBlurBorder:  'rgba(255,255,255,0.08)',
    sectionTitle:  'white',
    resultValue:   'white',
    resultHighlight: '#f87171',
    divider:       'rgba(255,255,255,0.07)',
    monthly:       'white',
    pillBg:        'rgba(255,255,255,0.04)',
    pillBorder:    'rgba(255,255,255,0.08)',
    pillColor:     '#9ca3af',
    browseBg:      'rgba(255,255,255,0.04)',
    browseBorder:  'rgba(255,255,255,0.08)',
    browseColor:   '#9ca3af',
    selectOption:  '#0d1117',
  };

  const handleDownloadImage = async () => {
    setImgLoading(true);
    try {
      let resolvedDealer = dealer;
      let resolvedSalesman = salesman;

      // Only guess from the logged-in session when the caller didn't already
      // tell us who the seller is (internal tools like the dashboard / F&I
      // panel, where the person downloading IS the preparer). A page that
      // already knows the seller (a car's dealer, a subdomain's dealer) must
      // never be overridden by whoever happens to be logged in.
      if (resolveFromSession && !resolvedDealer && !resolvedSalesman) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('id, role, dealer_id, full_name, phone, dealership, site_name, whatsapp_number, avatar_url, bio, job_title, is_verified, slug, subdomain')
            .eq('id', user.id)
            .maybeSingle();
          if (myProfile) {
            resolvedSalesman = myProfile;
            const dealerId = getDealerIdFromProfile(myProfile);
            if (dealerId === myProfile.id) {
              resolvedDealer = myProfile; // sole dealer/agent — they ARE the brand
            } else if (dealerId) {
              const { data: dealerRow } = await supabase
                .rpc('get_dealer_profile_by_id', { p_dealer_id: dealerId })
                .maybeSingle();
              resolvedDealer = dealerRow || null;
            }
          }
        }
      }

      // The mini-page link printed on the poster. Prefer an explicit URL from a
      // caller that already knows the seller (CarDetailPage). Otherwise derive it
      // from the resolved profiles: a salesman promotes their own /s/slug mini
      // page, a dealer promotes their <subdomain>.xdrive.my storefront. Mirrors
      // CarDetailPage's sellerPageUrl and src/utils/sharePack.js buildShareUrl.
      const resolvedPageUrl = sellerPageUrl || (() => {
        if (resolvedSalesman?.role === 'salesman' && resolvedSalesman?.slug) return `https://xdrive.my/s/${resolvedSalesman.slug}`;
        if (resolvedDealer?.subdomain) return getStorefrontUrl(resolvedDealer.subdomain);
        if (resolvedDealer?.slug) return `https://xdrive.my/s/${resolvedDealer.slug}`;
        if (resolvedSalesman?.slug) return `https://xdrive.my/s/${resolvedSalesman.slug}`;
        return null;
      })();

      await generateQuotationImage({
        dealer: resolvedDealer,
        salesman: resolvedSalesman,
        sellerPageUrl: resolvedPageUrl,
        carDetails: {
          name:  carName  || `${carYear ? carYear + ' ' : ''}Vehicle`,
          year:  carYear,
          color: carColor,
          price: carPrice,
          image: carImage,
          // Face of the quote: the salesman's photo when we have one, else the
          // dealer's logo. The poster renders whichever is present.
          sellerAvatar: resolvedSalesman?.avatar_url || resolvedDealer?.avatar_url || resolvedDealer?.site_logo_url || null,
        },
        calc: {
          carPrice, downPayment, dpPct, loanAmt, loanTerm, intRate,
          interest, totalLoan, monthly, eir,
          roadTax, rtCc,
          insCalc: insCalc ?? null,
          insurance: insCalc?.net ?? null, insNcd, vehicleType,
          onRoadPrice,
        },
        fmt,
      });
    } catch (err) {
      console.error('Quotation poster generation failed:', err);
    } finally {
      setImgLoading(false);
    }
  };

  const preApprovedLink = 'https://wa.me/601111521742?text=' + encodeURIComponent("Hi! I'm interested in getting pre-approved for car financing. Can you help?");

  const card = {
    background: c.cardBg,
    border: c.cardBorder,
    borderRadius: 14,
    padding: '20px 22px',
  };

  const sectionTitle = (label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 16, background: '#dc2626', borderRadius: 2, flexShrink: 0 }} />
      <p style={{ color: c.sectionTitle, fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "system-ui,sans-serif" }}>{label}</p>
    </div>
  );

  return (
    <>
      <style>{`
        .calc-input::placeholder { color: #9ca3af; }
        .calc-input::-webkit-inner-spin-button,
        .calc-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .calc-pill { cursor:pointer; border-radius:8px; padding:7px 12px; font-size:12px; font-weight:600; transition:all 0.15s; border:1px solid ${c.pillBorder}; background:${c.pillBg}; color:${c.pillColor}; font-family:system-ui,sans-serif; }
        .calc-pill:hover { border-color:rgba(220,38,38,0.35); color:${light ? '#dc2626' : 'white'}; }
        .calc-pill.active { background:rgba(220,38,38,0.12); border-color:rgba(220,38,38,0.45); color:${light ? '#dc2626' : '#f87171'}; }
        .calc-body-pill { cursor:pointer; border-radius:6px; padding:5px 12px; font-size:11px; font-weight:600; transition:all 0.15s; border:1px solid ${c.pillBorder}; background:${c.pillBg}; color:${c.pillColor}; font-family:system-ui,sans-serif; }
        .calc-body-pill:hover { border-color:rgba(220,38,38,0.35); }
        .calc-body-pill.active { background:rgba(220,38,38,0.12); border-color:rgba(220,38,38,0.45); color:${light ? '#dc2626' : '#f87171'}; }
        select.calc-select option { background:${c.selectOption}; color:${light ? '#111827' : 'white'}; }
        @media(max-width:768px) {
          .calc-layout { flex-direction: column !important; }
          .calc-results { position: static !important; width: 100% !important; margin: 0 auto !important; }
        }
      `}</style>

      <div style={{
        fontFamily: "system-ui,sans-serif", maxWidth: 1024, margin: '0 auto',
        '--fc-input-bg': c.inputBg,
        '--fc-input-border': light ? '#DDE3EC' : 'rgba(255,255,255,0.08)',
        '--fc-input-color': c.inputColor,
        '--fc-result-value': c.resultValue,
        '--fc-divider': c.divider,
        '--fc-highlight': c.resultHighlight,
      }}>

        {/* ── Two-column layout ── */}
        {/* alignItems: 'stretch' (the flex default) so the shorter results
            column matches the inputs column's height instead of floating at
            its own, much shorter, natural height — see the card below, which
            fills that stretched height and pushes Actions to the bottom. */}
        <div className="calc-layout" style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>

          {/* ══ LEFT: Inputs ══════════════════════════════════════════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Financing section */}
            <div style={card}>
              {sectionTitle('Financing')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Car Price */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Car Price</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    prefix="RM"
                    value={carPrice || ''}
                    onChange={e => setCarPrice(parseFloat(e.target.value) || 0)}
                    placeholder="85000"
                  />
                </div>

                {/* Down Payment */}
                <div>
                  <Label>Down Payment</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    prefix="RM"
                    value={Math.round(downPayment) || ''}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; if (carPrice > 0) setDpPct((v / carPrice) * 100); }}
                    placeholder="8500"
                  />
                </div>

                <div>
                  <Label>Down %</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    suffix="%"
                    value={dpPct || ''}
                    onChange={e => setDpPct(parseFloat(e.target.value) || 0)}
                    placeholder="10"
                  />
                </div>

                {/* Slider full width */}
                <div style={{ gridColumn: '1 / -1', margin: '-4px 0 4px' }}>
                  <input type="range" min="0" max="50" step="5" value={dpPct} onChange={e => setDpPct(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#dc2626', height: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    {['0%','10%','20%','30%','40%','50%'].map(l => <span key={l} style={{ color:'#374151', fontSize:10 }}>{l}</span>)}
                  </div>
                </div>

                {/* Tenure */}
                <div>
                  <Label>Tenure</Label>
                  <SelectBase
                    className="calc-select"
                    value={loanTerm}
                    onChange={e => setLoanTerm(parseInt(e.target.value))}
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(y => (
                      <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>
                    ))}
                  </SelectBase>
                </div>

                {/* Interest Rate */}
                <div>
                  <Label>Interest Rate (EIR)</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    step="0.1"
                    suffix="% p.a."
                    value={intRate || ''}
                    onChange={e => setIntRate(parseFloat(e.target.value))}
                    placeholder={String(DEFAULT_EIR)}
                  />
                </div>

                {/* Quick term */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Quick Select Tenure</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[3, 5, 7, 9].map(y => (
                      <button key={y} className={`calc-pill${loanTerm === y ? ' active' : ''}`} onClick={() => setLoanTerm(y)} style={{ flex: 1 }}>
                        {y}yr
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Road Tax & Insurance section — advanced only */}
            {advanced && <div style={card}>
              {sectionTitle('Road Tax & Insurance')}
              {/* Vehicle Type Toggle */}
              <div style={{ marginBottom: 14 }}>
                <Label>Vehicle Type</Label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Saloon', 'Non-Saloon'].map(vt => (
                    <button
                      key={vt}
                      className={`calc-pill${vehicleType === vt ? ' active' : ''}`}
                      onClick={() => setVehicleType(vt)}
                      style={{ flex: 1 }}
                    >
                      {vt === 'Saloon' ? 'Saloon / Sedan' : 'SUV / MPV / Pickup'}
                    </button>
                  ))}
                </div>
                {vehicleType === 'Non-Saloon' && (
                  <p style={{ color: '#6b7280', fontSize: 11, margin: '6px 0 0' }}>
                    Flat rate by CC bracket (JPJ tariff)
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Engine CC */}
                <div>
                  <Label>Engine CC</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    suffix="cc"
                    value={rtCc}
                    onChange={e => setRtCc(e.target.value)}
                    placeholder="1500"
                  />
                </div>

                {/* Body Type */}
                <div>
                  <Label>Body Type</Label>
                  <SelectBase className="calc-select" value={rtBody} onChange={e => setRtBody(e.target.value)}>
                    {BODY_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </SelectBase>
                </div>

                {/* CC quick picks */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Quick CC</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CC_QUICK.map(cc => (
                      <button key={cc} className={`calc-pill${String(rtCc) === String(cc) ? ' active' : ''}`} onClick={() => setRtCc(String(cc))}>
                        {cc >= 1000 ? (cc / 1000).toFixed(1).replace('.0', '') + 'k' : cc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sum insured */}
                <div>
                  <Label>Sum Insured</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    prefix="RM"
                    value={insSum || ''}
                    onChange={e => setInsSum(parseFloat(e.target.value) || 0)}
                    placeholder={String(carPrice)}
                  />
                </div>

                {/* NCD */}
                <div>
                  <Label>NCD Tier</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {NCD_TIERS.map(n => (
                      <button key={n} className={`calc-pill${insNcd === n ? ' active' : ''}`} onClick={() => setInsNcd(n)}>
                        {n}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>}

            {/* Car Details for the quotation poster (optional) — advanced only */}
            {advanced && <div style={card}>
              {sectionTitle('Car Details (for Quotation Poster)')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Car Name / Model</Label>
                  <InputBase
                    className="calc-input"
                    type="text"
                    value={carName}
                    onChange={e => setCarName(e.target.value)}
                    placeholder="e.g. Honda Civic 1.5 TC-P"
                  />
                </div>
                <div>
                  <Label>Year</Label>
                  <InputBase
                    className="calc-input"
                    type="text"
                    value={carYear}
                    onChange={e => setCarYear(e.target.value)}
                    placeholder="2023"
                  />
                </div>
                <div>
                  <Label>Colour (optional)</Label>
                  <InputBase
                    className="calc-input"
                    type="text"
                    value={carColor}
                    onChange={e => setCarColor(e.target.value)}
                    placeholder="Platinum White"
                  />
                </div>
              </div>
            </div>}

          </div>

          {/* ══ RIGHT: Results ════════════════════════════════════════════════ */}
          {/* top: clears the site header plus an 18px breath. On CalculatorPage
              this sits under MarketplaceHeader, which auto-hides and publishes
              its live height as --mh-h, so the panel follows it up and down.
              The 70px fallback is the same bar's height, which keeps every
              other host of this component (dealer dashboard, F&I panel, car
              page — none of which set --mh-h) on exactly the 88px it has now. */}
          <div className="calc-results" style={{ width: 300, flexShrink: 0, position: 'sticky', top: 'calc(var(--mh-h, 70px) + 18px)', transition: 'top .28s ease' }}>
            <div style={{ ...card, border: `1px solid ${light ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.18)'}`, height: '100%', display: 'flex', flexDirection: 'column' }}>

              {/* Monthly installment hero */}
              <div style={{ textAlign: 'center', padding: '16px 0 18px', borderBottom: `1px solid ${c.divider}`, marginBottom: 14 }}>
                <p style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Monthly Installment</p>
                <motion.div
                  key={isValid ? fmt(monthly, 2) : 'invalid'}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <p style={{ color: isValid ? c.monthly : '#9ca3af', fontSize: 38, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                    {isValid ? <>
                      <span style={{ fontSize: 16, color: '#9ca3af', fontWeight: 600, marginRight: 3 }}>RM</span>
                      {fmt(monthly, 2)}
                      <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500, marginLeft: 3 }}>/mo</span>
                    </> : '—'}
                  </p>
                </motion.div>
              </div>

              {/* Breakdown rows — compact default: deposit, full price, interest */}
              <div style={{ marginBottom: 14 }}>
                <ResultRow label="Deposit"           value={isValid ? `RM ${fmt(downPayment)}` : '—'} />
                <ResultRow label="Full Price"         value={isValid ? `RM ${fmt(carPrice)}` : '—'} />
                <ResultRow label="Total Interest"    value={isValid ? `RM ${fmt(interest)}` : '—'} />
              </div>

              {/* Advanced toggle */}
              <button
                onClick={() => setAdvanced(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', background: 'none', border: `1px solid ${c.divider}`, borderRadius: 8,
                  color: c.pillColor, fontSize: 12, fontWeight: 600, padding: '8px', cursor: 'pointer',
                  fontFamily: "system-ui,sans-serif", marginBottom: 14,
                }}
              >
                <SlidersHorizontal size={12} />
                {advanced ? 'Hide Advanced' : 'Advanced'}
                <ChevronDown size={12} style={{ transform: advanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {advanced && <>
                {/* Loan breakdown */}
                <div style={{ marginBottom: 14 }}>
                  <ResultRow label="Loan Amount"       value={isValid ? `RM ${fmt(loanAmt)}` : '—'} />
                  <ResultRow label="Total Repayment"   value={isValid ? `RM ${fmt(totalLoan)}` : '—'} highlight />
                </div>

                {/* Road tax + insurance */}
                <div style={{ borderTop: `1px solid ${c.divider}`, paddingTop: 12, marginBottom: 14 }}>
                  <p style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>On-Road Costs</p>
                  <ResultRow
                    label={rtCc ? `Road Tax — ${Number(rtCc).toLocaleString()}cc` : 'Road Tax (annual)'}
                    value={roadTax != null ? `RM ${fmt(Math.round(roadTax))}` : 'Enter CC'}
                    muted={roadTax == null}
                  />
                  <ResultRow label={`Insurance gross`}        value={insCalc ? `RM ${fmt(insCalc.gross)}` : '—'}                      muted={!insCalc} />
                  <ResultRow label={`  NCD ${insNcd}% savings`} value={insCalc ? `− RM ${fmt(insCalc.gross - insCalc.netPremium)}` : '—'} muted />
                  <ResultRow label={`  SST (8%)`}               value={insCalc ? `RM ${fmt(insCalc.sst)}` : '—'}                          muted />
                  <ResultRow label={`  Stamp duty`}              value={`RM 10`}                                                           muted />
                  <ResultRow label={`Insurance total`}           value={insCalc ? `RM ${fmt(insCalc.total)}` : '—'}                        highlight />
                </div>

                {/* Grand total */}
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>On-Road Price</span>
                    <span style={{ color: '#f87171', fontSize: 18, fontWeight: 800 }}>RM {fmt(onRoadPrice)}</span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: 10, margin: '4px 0 0' }}>Incl. road tax + insurance est.</p>
                </div>
              </>}

              {/* Actions — marginTop: auto pins this to the bottom of the card,
                  absorbing the stretch when the inputs column runs taller
                  instead of leaving it floating right under the toggle. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                <button
                  onClick={handleDownloadImage}
                  disabled={imgLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: imgLoading ? 'rgba(220,38,38,0.3)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                    border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700,
                    padding: '11px', cursor: imgLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 12px rgba(220,38,38,0.3)', transition: 'all 0.2s',
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  <Download size={14} />
                  {imgLoading ? 'Generating…' : 'Download Quotation Poster'}
                </button>

                <a href={preApprovedLink} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                    borderRadius: 10, color: '#25D366', fontSize: 13, fontWeight: 700,
                    padding: '11px', textDecoration: 'none', transition: 'all 0.2s',
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  <MessageCircle size={14} /> Get Pre-Approved
                </a>

                <Link to={`/showroom?max_price=${Math.round(carPrice)}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: c.browseBg, border: `1px solid ${c.browseBorder}`,
                    borderRadius: 10, color: c.browseColor, fontSize: 13, fontWeight: 600,
                    padding: '11px', textDecoration: 'none', transition: 'all 0.2s',
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  <Search size={14} /> Browse Cars in Budget
                </Link>

                <button onClick={reset}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'none', border: 'none', color: '#4b5563', fontSize: 12, cursor: 'pointer',
                    padding: '6px', fontFamily: "system-ui,sans-serif",
                  }}
                >
                  <RefreshCw size={12} /> Reset All
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Amortization schedule — advanced only */}
        {advanced && isValid && loanAmt > 0 && (
          <div style={{ marginTop: 20 }}>
            <AmortizationSchedule loanAmount={loanAmt} interestRate={intRate} years={loanTerm} />
          </div>
        )}
      </div>
    </>
  );
};

export default FinancingCalculator;
