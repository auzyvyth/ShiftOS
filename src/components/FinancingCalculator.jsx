import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw, MessageCircle, Search, Download, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AmortizationSchedule from './AmortizationSchedule';
import { supabase } from '../supabaseClient';
import { estimateRoadTax } from '../utils/roadTax';
import { getDealerIdFromProfile } from '../hooks/useProfile';

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

// ─── Flat rate → EIR (reducing balance) ────────────────────────────────────
// Malaysian HP loans are quoted as a flat rate but banks charge on a reducing
// balance; the true annualized rate (EIR) solves:
//   (1 - (1+i)^-n) / i = n / (1 + rFlat * n/12)
// i (monthly rate) has no closed form, so solve it with Newton-Raphson then
// annualize: EIR = (1+i)^12 - 1.
const calcEIR = (flatRatePct, months) => {
  const rFlat = flatRatePct / 100;
  const n = months;
  if (n <= 0 || rFlat <= 0) return 0;
  const Pf = 1 + rFlat * (n / 12);
  let i = rFlat / 12; // initial guess: nominal monthly rate
  for (let iter = 0; iter < 100; iter++) {
    const f      = 1 - Math.pow(1 + i, -n) - (n * i) / Pf;
    const fPrime = n * Math.pow(1 + i, -(n + 1)) - n / Pf;
    if (fPrime === 0) break;
    const iNext = i - f / fPrime;
    if (!Number.isFinite(iNext) || iNext <= -1) break;
    if (Math.abs(iNext - i) < 1e-10) { i = iNext; break; }
    i = iNext;
  }
  return +(((Math.pow(1 + i, 12) - 1) * 100).toFixed(2));
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

// ─── PDF image helpers ─────────────────────────────────────────────────────────
// Remote images (car photo, seller avatar) live on the Supabase CDN. jsPDF can't
// take a URL — it needs raw image data — so we fetch → dataURL → redraw onto a
// canvas. Redrawing does three jobs at once: (a) normalises any format (incl.
// webp) to a jsPDF-safe JPEG/PNG, (b) cover-crops to the exact box we want, and
// (c) rounds corners / clips to a circle. Every step is wrapped so a failed or
// blocked image never breaks the quotation — the block simply doesn't render.

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

// Cover-crop an image into a wMm x hMm box (rendered at ~300dpi), rounded corners
// drawn on a white ground so corners blend into the white page. Returns a JPEG
// dataURL ready for doc.addImage.
const coverImage = async (url, wMm, hMm, radiusMm = 0) => {
  const img = await loadImg(await fetchDataUrl(url));
  if (!img || !img.width || !img.height) return null;
  const PX = 12; // px per mm ≈ 300dpi
  const W = Math.round(wMm * PX), H = Math.round(hMm * PX), R = radiusMm * PX;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (R > 0) { roundRectPath(ctx, 0, 0, W, H, R); ctx.clip(); }
  const ar = img.width / img.height, tar = W / H;
  let sw, sh, sx, sy;
  if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / tar; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return canvas.toDataURL('image/jpeg', 0.9);
};

// Centre-crop an image into a circle of the given diameter. Returns JPEG on a
// white ground (corners = white, invisible over the white card).
const circleImage = async (url, diamMm) => {
  const img = await loadImg(await fetchDataUrl(url));
  if (!img || !img.width || !img.height) return null;
  const PX = 12;
  const D = Math.round(diamMm * PX);
  const canvas = document.createElement('canvas');
  canvas.width = D; canvas.height = D;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, D, D);
  ctx.beginPath();
  ctx.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, D, D);
  return canvas.toDataURL('image/jpeg', 0.9);
};

// ─── PDF generation ───────────────────────────────────────────────────────────
// Clean-white quotation. Beyond the numbers it carries TRUST signals — the car
// photo, the seller's face, name, contact and bio — so a buyer who receives it
// can see exactly who prepared it. The seller block is data-driven: pass a
// salesman (Lite/Premium) or a dealer and it renders whatever is present, so the
// same layout serves every tier without change.

const generateQuotationPDF = async ({ dealer, salesman, carDetails, calc, fmt }) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });

  const PW = 210, MARGIN = 16, CW = PW - MARGIN * 2;

  // Palette — one red accent on white.
  const INK = [17, 24, 39], SUB = [107, 114, 128], FAINT = [156, 163, 175];
  const RED = [220, 38, 38], LINE = [229, 231, 235], TINT = [249, 250, 251];

  const setFont = (size, weight = 'normal', color = INK) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', weight);
    doc.setTextColor(...color);
  };

  const BANNER_H = 48;
  // Load remote imagery up front (parallel) so the rest of the layout is sync.
  const [carImg, avatarImg] = await Promise.all([
    coverImage(carDetails.image, CW, BANNER_H, 3),
    circleImage(carDetails.sellerAvatar, 20),
  ]);

  let y = 16;

  // ── Header: brand wordmark + quotation label + date ────────────────────────
  const brandName = dealer?.dealership || dealer?.site_name || salesman?.dealership || salesman?.site_name || null;
  doc.setFillColor(...RED);
  doc.rect(MARGIN, y - 4, 2, 7, 'F');
  setFont(14, 'bold', INK);
  doc.text(brandName || 'XDRIVE.MY', MARGIN + 5, y + 2);
  setFont(8, 'normal', FAINT);
  const dateStr = new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr, PW - MARGIN, y - 1, { align: 'right' });
  setFont(8, 'bold', RED);
  doc.text('VEHICLE FINANCING QUOTATION', PW - MARGIN, y + 3.5, { align: 'right' });
  y += 10;

  // ── Car photo banner ───────────────────────────────────────────────────────
  if (carImg) {
    doc.addImage(carImg, 'JPEG', MARGIN, y, CW, BANNER_H);
    doc.setDrawColor(...LINE);
    doc.roundedRect(MARGIN, y, CW, BANNER_H, 3, 3, 'S');
    y += BANNER_H + 6;
  }

  // Car name + listed price strip
  setFont(13, 'bold', INK);
  doc.text(carDetails.name || 'Vehicle', MARGIN, y);
  const metaBits = [carDetails.year, carDetails.color].filter(Boolean).join('  ·  ');
  if (metaBits) {
    setFont(9, 'normal', SUB);
    doc.text(metaBits, MARGIN, y + 5);
  }
  setFont(8, 'bold', FAINT);
  doc.text('LISTED PRICE', PW - MARGIN, y - 1.5, { align: 'right' });
  setFont(14, 'bold', RED);
  doc.text(`RM ${fmt(carDetails.price)}`, PW - MARGIN, y + 4, { align: 'right' });
  y += metaBits ? 12 : 9;

  // ── Seller trust card ──────────────────────────────────────────────────────
  const sellerName = salesman?.full_name || salesman?.name || brandName || 'XDrive.my';
  const sellerContact = salesman?.whatsapp_number || salesman?.phone || dealer?.whatsapp_number || null;
  const sellerBio = salesman?.bio || null;
  const sellerRole = salesman ? (salesman.job_title || 'Sales Consultant') : (brandName ? 'Dealership' : null);
  const sellerVerified = !!(salesman?.is_verified || dealer?.is_verified);
  const bioLines = sellerBio ? doc.splitTextToSize(`"${sellerBio}"`, CW - 34).slice(0, 2) : [];
  const cardH = Math.max(26, 16 + bioLines.length * 4);

  doc.setFillColor(...TINT);
  doc.setDrawColor(...LINE);
  doc.roundedRect(MARGIN, y, CW, cardH, 3, 3, 'FD');

  const av = MARGIN + 4, avD = 20, avCy = y + cardH / 2;
  if (avatarImg) {
    doc.addImage(avatarImg, 'JPEG', av, avCy - avD / 2, avD, avD);
  } else {
    doc.setFillColor(...RED);
    doc.circle(av + avD / 2, avCy, avD / 2, 'F');
    setFont(12, 'bold', [255, 255, 255]);
    doc.text((sellerName[0] || 'X').toUpperCase(), av + avD / 2, avCy + 1.5, { align: 'center' });
  }

  const tx = av + avD + 5;
  let ty = y + 7;
  setFont(7, 'bold', FAINT);
  doc.text('PREPARED BY', tx, ty);
  ty += 5;
  setFont(12, 'bold', INK);
  doc.text(sellerName, tx, ty);
  const nameW = doc.getTextWidth(sellerName);
  if (sellerVerified) {
    const bx = tx + nameW + 3.8, by = ty - 1.4;
    doc.setFillColor(...RED);
    doc.circle(bx, by, 2, 'F');
    // White tick drawn as two strokes — cleaner and more trustworthy than "OK".
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(bx - 1, by + 0.1, bx - 0.3, by + 0.9);
    doc.line(bx - 0.3, by + 0.9, bx + 1.1, by - 0.9);
    doc.setLineWidth(0.2);
  }
  ty += 4.5;
  setFont(8.5, 'normal', SUB);
  const contactLine = [sellerRole, sellerContact].filter(Boolean).join('   ·   ');
  if (contactLine) { doc.text(contactLine, tx, ty); ty += 4.5; }
  if (bioLines.length) {
    setFont(8.5, 'italic', [75, 85, 99]);
    doc.text(bioLines, tx, ty);
  }
  y += cardH + 8;

  // ── Hero: the two figures that matter, made large ──────────────────────────
  const heroH = 24, halfW = CW / 2;
  doc.setDrawColor(...LINE);
  doc.roundedRect(MARGIN, y, CW, heroH, 3, 3, 'S');
  doc.setDrawColor(...LINE);
  doc.line(MARGIN + halfW, y + 4, MARGIN + halfW, y + heroH - 4);

  setFont(8, 'bold', FAINT);
  doc.text('MONTHLY INSTALLMENT', MARGIN + halfW / 2, y + 8, { align: 'center' });
  setFont(22, 'bold', INK);
  doc.text(`RM ${fmt(calc.monthly, 2)}`, MARGIN + halfW / 2, y + 18, { align: 'center' });

  setFont(8, 'bold', FAINT);
  doc.text('EST. ON-ROAD PRICE', MARGIN + halfW + halfW / 2, y + 8, { align: 'center' });
  setFont(22, 'bold', RED);
  doc.text(`RM ${fmt(calc.onRoadPrice)}`, MARGIN + halfW + halfW / 2, y + 18, { align: 'center' });
  y += heroH + 9;

  // ── Table renderer ─────────────────────────────────────────────────────────
  const RH = 6.4; // row height
  // Break to a fresh page before a block that wouldn't fit, so a car photo plus
  // a full insurance breakdown never clips the footer off the bottom edge.
  const ensure = (need) => { if (y + need > 290) { doc.addPage(); y = 16; } };
  const sectionTitle = (label) => {
    setFont(9, 'bold', INK);
    doc.setFillColor(...RED);
    doc.rect(MARGIN, y - 3.2, 1.6, 4.2, 'F');
    doc.text(label, MARGIN + 4, y);
    y += 6;
  };
  const tableRows = (data) => {
    data.forEach(([label, value, opt = {}], i) => {
      const rowY = y + i * RH;
      if (i % 2 === 0) {
        doc.setFillColor(...TINT);
        doc.rect(MARGIN, rowY - 4.6, CW, RH, 'F');
      }
      const sub = opt.sub;
      const strong = opt.strong;
      setFont(9, strong ? 'bold' : 'normal', strong ? RED : sub ? FAINT : SUB);
      doc.text(label, MARGIN + (sub ? 7 : 3), rowY);
      setFont(9, strong ? 'bold' : 'bold', strong ? RED : sub ? FAINT : INK);
      doc.text(value, PW - MARGIN - 3, rowY, { align: 'right' });
    });
    y += data.length * RH + 6;
  };

  // ── Financing breakdown ────────────────────────────────────────────────────
  sectionTitle('FINANCING BREAKDOWN');
  tableRows([
    ['Car Price',            `RM ${fmt(calc.carPrice)}`],
    ['Down Payment',         `RM ${fmt(calc.downPayment)} (${calc.dpPct}%)`],
    ['Loan Amount',          `RM ${fmt(calc.loanAmt)}`],
    ['Loan Tenure',          `${calc.loanTerm} years`],
    ['Interest Rate (flat)', `${calc.intRate}% p.a.`],
    ['EIR (est.)',           `${calc.eir}% p.a.`],
    ['Total Interest',       `RM ${fmt(calc.interest)}`],
    ['Total Loan Repayment', `RM ${fmt(calc.totalLoan)}`, { strong: true }],
  ]);

  // ── On-road costs ──────────────────────────────────────────────────────────
  if (calc.roadTax != null || calc.insCalc != null) {
    ensure(6 + 6 * RH + 6);
    sectionTitle('ON-ROAD COSTS (ESTIMATE)');
    const onRoad = [];
    if (calc.roadTax != null) {
      const ccLabel = calc.rtCc ? ` — ${Number(calc.rtCc).toLocaleString()}cc` : '';
      onRoad.push([`Road Tax (annual)${ccLabel}`, `RM ${fmt(Math.round(calc.roadTax))}`]);
    }
    if (calc.insCalc) {
      const ins = calc.insCalc;
      const vtLabel = calc.vehicleType === 'Non-Saloon' ? 'SUV/MPV/Pickup' : 'Saloon/Sedan';
      onRoad.push([`Insurance gross (${vtLabel})`, `RM ${fmt(ins.gross)}`]);
      // Plain ASCII hyphen — jsPDF's Helvetica lacks the U+2212 minus glyph and
      // renders it as garbage, corrupting the amount that follows.
      onRoad.push([`NCD ${calc.insNcd}% savings`, `- RM ${fmt(ins.gross - ins.netPremium)}`, { sub: true }]);
      onRoad.push([`SST (8%)`, `RM ${fmt(ins.sst)}`, { sub: true }]);
      onRoad.push([`Stamp duty`, `RM 10`, { sub: true }]);
      onRoad.push([`Insurance total`, `RM ${fmt(ins.total)}`, { strong: true }]);
    }
    tableRows(onRoad);
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  // The two-up hero already states the monthly + on-road figures large; no need
  // to restate them in a third band. Close with the validity note + credit.
  ensure(15);
  doc.setDrawColor(...LINE);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 5;
  setFont(7.5, 'italic', FAINT);
  doc.text('Valid for 7 days, subject to change without notice. All figures are estimates; final pricing subject to confirmation.', MARGIN, y);
  y += 7;
  setFont(8, 'bold', RED);
  doc.text('Generated via XDrive.my', MARGIN, y);
  if (sellerContact) {
    setFont(8, 'normal', SUB);
    doc.text(`Questions? Contact ${sellerName} · ${sellerContact}`, PW - MARGIN, y, { align: 'right' });
  }

  doc.save(`quotation-${Date.now()}.pdf`);
};

// ─── Main component ───────────────────────────────────────────────────────────

const FinancingCalculator = ({
  initialPrice = 85000, engineCc = null, bodyType = null,
  carName: carNameProp = '', carYear: carYearProp = '', carColor: carColorProp = '', carImage = null, light = false,
  // Seller context for the PDF's "prepared by" / dealership header. Pass explicit
  // dealer/salesman (even null, meaning "known to have no seller") when the page
  // already knows who's selling — e.g. a specific car's dealer, or a dealer's own
  // subdomain. Leave resolveFromSession at its default only for internal tools
  // (dashboard, F&I panel) where the logged-in user IS the preparer.
  dealer = null, salesman = null, resolveFromSession = dealer === null && salesman === null,
}) => {
  const { t } = useTranslation();

  // Financing inputs
  const [carPrice,  setCarPrice]  = useState(initialPrice);
  const [dpPct,     setDpPct]     = useState(10);
  const [loanTerm,  setLoanTerm]  = useState(7);
  const [intRate,   setIntRate]   = useState(3.5);

  // Road tax inputs
  const [rtCc,   setRtCc]   = useState(engineCc ? String(engineCc) : '');
  const [rtBody, setRtBody] = useState(bodyType || 'Sedan');

  // Insurance inputs
  const [insSum, setInsSum] = useState(initialPrice);
  const [insNcd, setInsNcd] = useState(55);
  const [vehicleType, setVehicleType] = useState('Saloon'); // 'Saloon' | 'Non-Saloon'

  // Car details for PDF (pre-filled from props when coming from a listing)
  const [carName,  setCarName]  = useState(carNameProp);
  const [carYear,  setCarYear]  = useState(carYearProp);
  const [carColor, setCarColor] = useState(carColorProp);

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => { setCarPrice(initialPrice); setInsSum(initialPrice); }, [initialPrice]);
  useEffect(() => { if (engineCc) setRtCc(String(engineCc)); }, [engineCc]);
  useEffect(() => { if (bodyType) setRtBody(bodyType); }, [bodyType]);
  useEffect(() => { if (carNameProp)  setCarName(carNameProp); },  [carNameProp]);
  useEffect(() => { if (carYearProp)  setCarYear(carYearProp); },  [carYearProp]);
  useEffect(() => { if (carColorProp) setCarColor(carColorProp); }, [carColorProp]);

  // Calculations
  const downPayment = (carPrice * dpPct) / 100;
  const loanAmt     = Math.max(0, carPrice - downPayment);
  const interest    = loanAmt * (intRate / 100) * loanTerm;
  const totalLoan   = loanAmt + interest;
  // Banks never round installments down (they can't undercollect) — ceiling
  // to the nearest cent so the figure shown matches real HP quotes.
  const monthlyRaw  = loanTerm > 0 ? totalLoan / (loanTerm * 12) : 0;
  const monthly     = Math.ceil(monthlyRaw * 100) / 100;

  const eir = calcEIR(intRate, loanTerm * 12);

  const roadTax  = estimateRoadTax(rtCc);
  const insCalc  = calcInsurance(insSum || carPrice, insNcd, vehicleType, rtCc);

  const onRoadPrice = carPrice + (roadTax != null ? Math.round(roadTax) : 0) + (insCalc?.net || 0);

  const isValid = carPrice > 0 && downPayment < carPrice && loanTerm > 0 && intRate > 0;

  const fmt = (n, d = 0) => n != null && !Number.isNaN(n)
    ? n.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

  const reset = () => { setCarPrice(initialPrice); setDpPct(10); setLoanTerm(7); setIntRate(3.5); setRtCc(engineCc ? String(engineCc) : ''); setRtBody(bodyType || 'Sedan'); setInsSum(initialPrice); setInsNcd(55); };

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

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
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
            .select('id, role, dealer_id, full_name, phone, dealership, site_name, whatsapp_number, avatar_url, bio, job_title, is_verified')
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

      await generateQuotationPDF({
        dealer: resolvedDealer,
        salesman: resolvedSalesman,
        carDetails: {
          name:  carName  || `${carYear ? carYear + ' ' : ''}Vehicle`,
          year:  carYear,
          color: carColor,
          price: carPrice,
          image: carImage,
          // Face of the quote: the salesman's photo when we have one, else the
          // dealer's logo. The PDF renders whichever is present.
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
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const preApprovedLink = 'https://wa.me/60174155191?text=' + encodeURIComponent("Hi! I'm interested in getting pre-approved for car financing. Can you help?");

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
        .calc-body-pill { cursor:pointer; border-radius:20px; padding:5px 12px; font-size:11px; font-weight:600; transition:all 0.15s; border:1px solid ${c.pillBorder}; background:${c.pillBg}; color:${c.pillColor}; font-family:system-ui,sans-serif; }
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
        <div className="calc-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

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
                  <Label>Interest Rate</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    step="0.1"
                    suffix="% p.a."
                    value={intRate || ''}
                    onChange={e => setIntRate(parseFloat(e.target.value))}
                    placeholder="3.5"
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

            {/* Road Tax & Insurance section */}
            <div style={card}>
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
            </div>

            {/* Car Details for PDF (optional) */}
            <div style={card}>
              {sectionTitle('Car Details (for Quotation PDF)')}
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
            </div>

          </div>

          {/* ══ RIGHT: Results ════════════════════════════════════════════════ */}
          <div className="calc-results" style={{ width: 300, flexShrink: 0, position: 'sticky', top: 88 }}>
            <div style={{ ...card, border: `1px solid ${light ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.18)'}` }}>

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

              {/* Breakdown rows */}
              <div style={{ marginBottom: 14 }}>
                <ResultRow label="Loan Amount"       value={isValid ? `RM ${fmt(loanAmt)}` : '—'} />
                <ResultRow label="Down Payment"      value={isValid ? `RM ${fmt(downPayment)}` : '—'} />
                <ResultRow label="Total Interest"    value={isValid ? `RM ${fmt(interest)}` : '—'} />
                <ResultRow label="Total Repayment"   value={isValid ? `RM ${fmt(totalLoan)}` : '—'} highlight />
                <ResultRow label="EIR (est.)"        value={isValid ? `${eir}% p.a.` : '—'}         muted />
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

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: pdfLoading ? 'rgba(220,38,38,0.3)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                    border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700,
                    padding: '11px', cursor: pdfLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 12px rgba(220,38,38,0.3)', transition: 'all 0.2s',
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  <Download size={14} />
                  {pdfLoading ? 'Generating…' : 'Download Quotation PDF'}
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

        {/* Amortization schedule */}
        {isValid && loanAmt > 0 && (
          <div style={{ marginTop: 20 }}>
            <AmortizationSchedule loanAmount={loanAmt} interestRate={intRate} years={loanTerm} />
          </div>
        )}
      </div>
    </>
  );
};

export default FinancingCalculator;
