import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Loader2, ChevronLeft, ChevronRight, Sparkles, Plus, Maximize2, Trash2 } from 'lucide-react';

// ── JSZip ─────────────────────────────────────────────────────────────────────
let _zip = null;
function loadJSZip() {
  if (!_zip) _zip = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => res(window.JSZip); s.onerror = rej;
    document.head.appendChild(s);
  });
  return _zip;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ── Image cache ───────────────────────────────────────────────────────────────
const IMG_CACHE = new Map();
function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!IMG_CACHE.has(url)) {
    const p = new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });
    IMG_CACHE.set(url, p);
  }
  return IMG_CACHE.get(url);
}

// ── Dominant colour from image ────────────────────────────────────────────────
function dominantDark(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 6; c.height = 6;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, 6, 6);
    const d = x.getImageData(0, 0, 6, 6).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
    const n = d.length / 4;
    return `rgb(${Math.floor(r/n*0.28)},${Math.floor(g/n*0.28)},${Math.floor(b/n*0.28)})`;
  } catch { return '#0d1520'; }
}

// ── Font definitions ──────────────────────────────────────────────────────────
export const FONTS = [
  { id: 'dm',       label: 'DM Sans',         stack: "'DM Sans', sans-serif",            weights: ['400','700','800'] },
  { id: 'bebas',    label: 'Bebas Neue',       stack: "'Bebas Neue', sans-serif",          weights: ['400','400','400'] },
  { id: 'oswald',   label: 'Oswald',           stack: "'Oswald', sans-serif",              weights: ['400','600','700'] },
  { id: 'montserrat',label:'Montserrat',       stack: "'Montserrat', sans-serif",          weights: ['400','700','800'] },
  { id: 'raleway',  label: 'Raleway',          stack: "'Raleway', sans-serif",             weights: ['400','700','800'] },
  { id: 'anton',    label: 'Anton',            stack: "'Anton', sans-serif",               weights: ['400','400','400'] },
  { id: 'barlow',   label: 'Barlow Condensed', stack: "'Barlow Condensed', sans-serif",    weights: ['400','600','700'] },
  { id: 'russo',    label: 'Russo One',        stack: "'Russo One', sans-serif",           weights: ['400','400','400'] },
];

// Pre-load Google Fonts once
const GFONTS_LOADED = new Set();
function ensureFont(fontId) {
  if (GFONTS_LOADED.has(fontId)) return;
  GFONTS_LOADED.add(fontId);
  const urls = {
    dm:          'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&display=swap',
    bebas:       'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
    oswald:      'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap',
    montserrat:  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap',
    raleway:     'https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap',
    anton:       'https://fonts.googleapis.com/css2?family=Anton&display=swap',
    barlow:      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap',
    russo:       'https://fonts.googleapis.com/css2?family=Russo+One&display=swap',
  };
  if (!urls[fontId]) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = urls[fontId];
  document.head.appendChild(link);
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
// Layout:
//   • Blurred cover bg — same image, heavily blurred, fills canvas
//   • Car photo — contained (letterboxed), centred on top of blur
//   • Bottom-left gradient darkens text zone
//   • Text block: Line1 (brand/model big) → Line2 (price) → Line3 (specs)
async function renderSlide(canvas, slide, watermark, fontId = 'dm') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const fontDef = FONTS.find(f => f.id === fontId) || FONTS[0];
  const stack = fontDef.stack;
  const [w3, w2, w1] = fontDef.weights; // w1=headline, w2=price, w3=specs

  const img = await loadImage(slide.imageUrl);

  if (img) {
    // ── Step 1: blurred full-cover background from same image ──
    ctx.save();
    ctx.filter = 'blur(32px)';
    const sc = Math.max(W / img.width, H / img.height);
    const bw = img.width * sc, bh = img.height * sc;
    ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.restore();

    // Darken blur layer so it doesn't compete with photo
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);

    // ── Step 2: contained photo centred ──
    const PAD = 40;
    const availW = W - PAD * 2;
    const availH = H * 0.62;
    const topY   = H * 0.06;
    const si = Math.min(availW / img.width, availH / img.height);
    const dw = img.width * si, dh = img.height * si;
    const dx = (W - dw) / 2, dy = topY + (availH - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    // No image fallback
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1b2e'); g.addColorStop(1, '#071020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ── Gradient: left-side + bottom scoop for text zone ──
  const lg = ctx.createLinearGradient(0, 0, W * 0.75, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0.50)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.84);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,0.90)');
  ctx.fillStyle = bg; ctx.fillRect(0, H * 0.55, W, H * 0.29);

  // ── Text draw helper ──
  function draw(text, x, y, weight, size, colour, maxW) {
    if (!text) return;
    ctx.save();
    ctx.font = `${weight} ${size}px ${stack}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    while (ctx.measureText(text).width > maxW && size > 16) {
      size -= 3;
      ctx.font = `${weight} ${size}px ${stack}`;
    }
    ctx.lineWidth = Math.max(size * 0.08, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Text block — bottom-left stacked ──
  const X = 64, maxW = W * 0.62;
  const sz1 = 112, sz2 = 80, sz3 = 52;
  const anchor = H * 0.80, gap = 12;
  const y3 = anchor - sz3;
  const y2 = y3 - sz2 - gap;
  const y1 = y2 - sz1 - gap;

  draw(slide.headline    || '', X, y1, w1, sz1, '#ffffff',               maxW);
  draw(slide.bottomLeft  || '', X, y2, w2, sz2, '#ffffff',               maxW);
  draw(slide.bottomRight || '', X, y3, w3, sz3, 'rgba(255,255,255,0.70)', maxW);

  // ── Watermark ──
  if (watermark) {
    ctx.save();
    ctx.font = `600 26px ${stack}`;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(watermark.toUpperCase(), W - 52, 52);
    ctx.restore();
  }
}

// ── Default slide templates ───────────────────────────────────────────────────
function buildDefaultSlides(listing, images) {
  const brand  = listing?.brand  || '';
  const model  = listing?.model  || '';
  const variant= listing?.variant|| '';
  const year   = String(listing?.year || '');
  const price  = listing?.selling_price || listing?.price;
  const priceStr = price ? 'RM ' + Number(price).toLocaleString() : '';
  const mileage = listing?.mileage ? Number(listing.mileage).toLocaleString() + ' km' : '';
  const cond   = { new: 'Brand New', recon: 'Recon', used: 'Used' }[listing?.condition] || listing?.condition || '';
  const trans  = listing?.transmission || '';
  const fuel   = listing?.fuel_type || listing?.fuel || '';
  const color  = listing?.color  || '';
  const state  = listing?.state  ? '📍 ' + listing.state : '';
  const engine = listing?.engine_cc ? listing.engine_cc + 'cc' : '';

  const T = [
    { headline: `${brand} ${model}`.trim(),            bl: priceStr,                                   br: [year, cond, mileage].filter(Boolean).join(' · ') },
    { headline: variant || `${brand} ${model}`.trim(), bl: priceStr,                                   br: [trans, fuel].filter(Boolean).join(' · ') },
    { headline: priceStr || `${brand} ${model}`.trim(),bl: [year, cond].filter(Boolean).join(' · '),   br: mileage },
    { headline: `${brand} ${model}`.trim(),            bl: priceStr,                                   br: [engine, fuel].filter(Boolean).join(' · ') },
    { headline: model,                                 bl: priceStr || [year, cond].filter(Boolean).join(' · '), br: [color, state].filter(Boolean).join(' · ') },
    { headline: `${brand} ${model}`.trim(),            bl: mileage || priceStr,                        br: [cond, trans].filter(Boolean).join(' · ') },
    { headline: priceStr || model,                     bl: [year, cond].filter(Boolean).join(' · '),   br: [trans, fuel].filter(Boolean).join(' · ') },
    { headline: `${year} ${brand} ${model}`.trim(),    bl: priceStr,                                   br: state },
    { headline: variant || model,                      bl: priceStr,                                   br: [engine, color].filter(Boolean).join(' · ') },
    { headline: 'DM for Best Price 📲',                bl: `${brand} ${model}`.trim(),                 br: state || 'Malaysia' },
  ];

  // Only create slides for images that actually exist.
  // If no images at all, create one blank placeholder so the UI isn't empty.
  const count = images.length > 0 ? images.length : 1;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    imageUrl:    images[i] || null,
    headline:    T[i % T.length]?.headline    || `${brand} ${model}`.trim(),
    bottomLeft:  T[i % T.length]?.bl         || '',
    bottomRight: T[i % T.length]?.br         || '',
  }));
}

// ── Claude AI ─────────────────────────────────────────────────────────────────
async function generateWithClaude(listing, language, hookText, slideCount) {
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? 'RM ' + Number(price).toLocaleString() : 'Ask for Price';
  const lang = language === 'bm' ? 'Bahasa Malaysia (casual dealer tone)' : 'English (punchy Malaysian car market)';

  const prompt = `Malaysian car dealer TikTok slide copywriter. Write ${slideCount} slides.
CAR: ${listing?.year||''} ${listing?.brand||''} ${listing?.model||''} ${listing?.variant||''}
Price: ${priceStr} | Mileage: ${listing?.mileage ? Number(listing.mileage).toLocaleString()+' km' : 'N/A'}
Condition: ${listing?.condition||''} | Trans: ${listing?.transmission||''} | Fuel: ${listing?.fuel_type||listing?.fuel||''}
Color: ${listing?.color||''} | Engine: ${listing?.engine_cc?listing.engine_cc+'cc':''} | Location: ${listing?.state||'Malaysia'}
${hookText ? `Seller hook: "${hookText}"` : ''}
Language: ${lang}
Each slide: headline (max 5 words, bold/punchy), bottomLeft (max 3 words), bottomRight (max 3 words).
Vary focus: price, condition, mileage, specs, location, CTA. Last slide = CTA.
Return ONLY valid JSON array, no markdown: [{"headline":"...","bottomLeft":"...","bottomRight":"..."},...]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  const text = data.content?.map(b => b.text || '').join('') || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ── SlideCanvas ───────────────────────────────────────────────────────────────
const SlideCanvas = React.memo(function SlideCanvas({ slide, watermark, fontId, width, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = width; c.height = height;
    renderSlide(c, slide, watermark, fontId).catch(() => {});
  }, [slide, watermark, fontId, width, height]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TikTokGenerator({ listing, onClose }) {
  const rawImages = (listing?.images || []).filter(Boolean);
  const dealership = listing?.dealership_name || 'ShiftOS';

  const [slides, setSlides] = useState(() => buildDefaultSlides(listing, rawImages));
  const [active, setActive] = useState(0);
  const [font, setFont] = useState('dm');
  const [lang, setLang] = useState('en');
  const [hookText, setHookText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlIdx, setDlIdx] = useState(null);

  // Always read fresh from slides array — avoid stale closure
  const slide = slides[active] || slides[0] || {};
  const total = slides.length;

  // Load all fonts upfront
  useEffect(() => { FONTS.forEach(f => ensureFont(f.id)); }, []);

  // Keyboard nav
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') { if (fullscreen) setFullscreen(false); else onClose(); }
      if (e.key === 'ArrowLeft')  setActive(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActive(i => Math.min(total - 1, i + 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fullscreen, onClose, total]);

  // Patch a field on the currently active slide — always uses fresh index
  const patch = (field, value) => {
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, [field]: value } : s));
  };

  const uploadImage = (idx, file) => {
    const reader = new FileReader();
    reader.onload = e => setSlides(prev => prev.map((s, i) => i === idx ? { ...s, imageUrl: e.target.result } : s));
    reader.readAsDataURL(file);
  };

  const addSlide = () => {
    const n = { id: Date.now(), imageUrl: null,
      headline: `${listing?.brand||''} ${listing?.model||''}`.trim(),
      bottomLeft: '', bottomRight: '' };
    setSlides(prev => [...prev, n]);
    setActive(slides.length);
  };

  const removeSlide = idx => {
    if (total <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setActive(i => Math.min(i, total - 2));
  };

  const generate = async () => {
    setGenerating(true); setGenError('');
    try {
      const results = await generateWithClaude(listing, lang, hookText, total);
      setSlides(prev => prev.map((s, i) => ({
        ...s,
        headline:    results[i]?.headline    ?? s.headline,
        bottomLeft:  results[i]?.bottomLeft  ?? s.bottomLeft,
        bottomRight: results[i]?.bottomRight ?? s.bottomRight,
      })));
    } catch { setGenError('AI failed — edit manually.'); }
    setGenerating(false);
  };

  const toBlob = useCallback(async idx => {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    await renderSlide(c, slides[idx], dealership, font);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.93));
  }, [slides, dealership, font]);

  const saveSingle = async idx => {
    setDlIdx(idx);
    const blob = await toBlob(idx);
    const url = URL.createObjectURL(blob);
    if (isIOS()) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    else {
      const a = document.createElement('a');
      a.download = `${listing?.brand||'slide'}-${listing?.model||''}-${idx+1}.jpg`;
      a.href = url; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setDlIdx(null);
  };

  const saveAll = async () => {
    setDownloading(true);
    if (isIOS()) {
      for (let i = 0; i < total; i++) {
        const blob = await toBlob(i); const url = URL.createObjectURL(blob);
        window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 15000);
        await new Promise(r => setTimeout(r, 500));
      }
      setDownloading(false); return;
    }
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const folder = zip.folder(`${listing?.brand||'slides'}-${listing?.model||''}`);
      for (let i = 0; i < total; i++)
        folder.file(`slide-${String(i+1).padStart(2,'0')}.jpg`, await toBlob(i));
      const zb = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zb);
      const a = document.createElement('a');
      a.download = `${listing?.brand||'slides'}-${listing?.model||''}.zip`;
      a.href = url; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      for (let i = 0; i < total; i++) { await saveSingle(i); await new Promise(r => setTimeout(r, 200)); }
    }
    setDownloading(false);
  };

  // ── Design tokens ──────────────────────────────────────────────────────────
  const C = {
    bg:      '#0a0a10',
    surface: '#0f0f18',
    card:    '#141420',
    border:  'rgba(255,255,255,0.07)',
    bHover:  'rgba(255,255,255,0.13)',
    accent:  '#e53935',
    text:    '#ffffff',
    muted:   'rgba(255,255,255,0.38)',
    dim:     'rgba(255,255,255,0.18)',
  };

  const inp = (big) => ({
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${C.border}`,
    borderRadius: '9px',
    color: C.text,
    fontSize: big ? '15px' : '13px',
    fontWeight: big ? 600 : 400,
    fontFamily: 'inherit',
    padding: big ? '10px 14px' : '8px 12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

  const btn = (variant = 'ghost', extra = {}) => {
    const base = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '8px', fontFamily: 'inherit', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s', padding: '8px 14px' };
    if (variant === 'primary') return { ...base, background: C.accent, border: 'none', color: '#fff', ...extra };
    if (variant === 'white')   return { ...base, background: '#fff', border: 'none', color: '#0a0a10', ...extra };
    if (variant === 'danger')  return { ...base, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', ...extra };
    return { ...base, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, ...extra };
  };

  const lbl = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, display: 'block', marginBottom: '6px' };

  const focusBorder = e => e.target.style.borderColor = 'rgba(229,57,53,0.55)';
  const blurBorder  = e => e.target.style.borderColor = C.border;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {/* ── Modal ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '16px', width: '100%', maxWidth: '1180px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.85)' }}
        >

          {/* ══ HEADER ══ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.77 0 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.12 8.72 6.34 6.34 0 0 0 11.65-3.42V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/></svg>
              </div>
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: '13px' }}>Slide Generator</div>
                <div style={{ color: C.muted, fontSize: '11px' }}>{listing?.brand} {listing?.model}{listing?.variant ? ' · ' + listing.variant : ''} · {total} slides · 1080×1920</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={saveAll} disabled={downloading} style={{ ...btn('white'), opacity: downloading ? 0.6 : 1, padding: '7px 14px' }}>
                {downloading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
                {downloading ? 'Packing…' : isIOS() ? 'Save All' : `Export ZIP (${total})`}
              </button>
              <button onClick={onClose} style={{ ...btn('ghost'), padding: '7px 9px' }}><X size={14} /></button>
            </div>
          </div>

          {/* ══ MAIN AREA: preview LEFT | edit RIGHT ══ */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

            {/* ── LEFT: preview + slider ── */}
            <div style={{ flex: '0 0 auto', width: '340px', background: '#080810', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', gap: '12px', borderRight: `1px solid ${C.border}` }}>

              {/* Slide counter — big, obvious */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: C.text, lineHeight: 1 }}>{active + 1}</span>
                <span style={{ fontSize: '14px', color: C.muted, fontWeight: 400 }}>/ {total}</span>
              </div>

              {/* 9:16 preview */}
              <div
                onClick={() => setFullscreen(true)}
                style={{ width: '260px', aspectRatio: '9/16', borderRadius: '12px', overflow: 'hidden', cursor: 'zoom-in', position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,0.7)', flexShrink: 0 }}
              >
                <SlideCanvas slide={slide} watermark={dealership} fontId={font} width={540} height={960} />
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', borderRadius: '5px', padding: '4px 6px', display: 'flex' }}>
                  <Maximize2 size={10} color="rgba(255,255,255,0.55)" />
                </div>
              </div>

              {/* Slider */}
              <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="range"
                  min={0}
                  max={total - 1}
                  value={active}
                  onChange={e => setActive(Number(e.target.value))}
                  style={{ width: '100%', accentColor: C.accent, cursor: 'pointer', height: '4px' }}
                />
                {/* Dot indicators below slider */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setActive(i)}
                      style={{ width: i === active ? 18 : 6, height: 6, borderRadius: 3, background: i === active ? C.accent : 'rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                    />
                  ))}
                </div>
              </div>

              {/* Prev / Next */}
              <div style={{ display: 'flex', gap: '8px', width: '260px' }}>
                <button onClick={() => setActive(i => Math.max(0, i-1))} disabled={active===0} style={{ ...btn('ghost'), flex: 1, opacity: active===0 ? 0.2 : 1, padding: '8px' }}><ChevronLeft size={15} /></button>
                <button onClick={() => setActive(i => Math.min(total-1, i+1))} disabled={active===total-1} style={{ ...btn('ghost'), flex: 1, opacity: active===total-1 ? 0.2 : 1, padding: '8px' }}><ChevronRight size={15} /></button>
              </div>

              {/* Save this slide */}
              <button onClick={() => saveSingle(active)} disabled={dlIdx===active} style={{ ...btn('ghost'), width: '260px', fontSize: '11px', padding: '7px' }}>
                {dlIdx===active ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={11} />}
                Save slide #{active + 1}
              </button>
            </div>

            {/* ── RIGHT: Edit panel ── */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0', minWidth: 0 }}>

              {/* ── Edit current slide ── */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Slide #{active + 1}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {/* Photo swap */}
                    <label style={{ ...btn('ghost'), fontSize: '11px', padding: '6px 12px', cursor: 'pointer' }}>
                      {slide.imageUrl ? '↻ Swap photo' : '+ Photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadImage(active, e.target.files[0])} />
                    </label>
                    {total > 1 && (
                      <button onClick={() => removeSlide(active)} style={{ ...btn('danger'), padding: '6px 10px' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Line 1 — Headline */}
                <div style={{ marginBottom: '10px' }}>
                  <span style={lbl}>Line 1 — Brand / Model (biggest)</span>
                  <input
                    key={`hl-${active}`}
                    defaultValue={slide.headline || ''}
                    onChange={e => patch('headline', e.target.value)}
                    onFocus={focusBorder} onBlur={blurBorder}
                    placeholder="e.g. BMW M4 Competition"
                    style={inp(true)}
                  />
                </div>

                {/* Line 2 — Price */}
                <div style={{ marginBottom: '10px' }}>
                  <span style={lbl}>Line 2 — Price / Hook (medium)</span>
                  <input
                    key={`bl-${active}`}
                    defaultValue={slide.bottomLeft || ''}
                    onChange={e => patch('bottomLeft', e.target.value)}
                    onFocus={focusBorder} onBlur={blurBorder}
                    placeholder="e.g. RM 189,800"
                    style={inp(false)}
                  />
                </div>

                {/* Line 3 — Specs */}
                <div style={{ marginBottom: '16px' }}>
                  <span style={lbl}>Line 3 — Specs (small, muted)</span>
                  <input
                    key={`br-${active}`}
                    defaultValue={slide.bottomRight || ''}
                    onChange={e => patch('bottomRight', e.target.value)}
                    onFocus={focusBorder} onBlur={blurBorder}
                    placeholder="e.g. 2023 · Recon · 28k km"
                    style={inp(false)}
                  />
                </div>

                {/* Font selector */}
                <div>
                  <span style={lbl}>Font (global)</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {FONTS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { ensureFont(f.id); setFont(f.id); }}
                        style={{
                          padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                          border: `1px solid ${font===f.id ? C.accent : C.border}`,
                          background: font===f.id ? 'rgba(229,57,53,0.1)' : 'rgba(255,255,255,0.03)',
                          color: font===f.id ? C.accent : C.muted,
                          fontSize: '12px', fontFamily: f.stack, fontWeight: 600,
                          transition: 'all 0.15s',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── AI Generate ── */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>AI Copy Generation</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {['en', 'bm'].map(l => (
                    <button key={l} onClick={() => setLang(l)} style={{ padding: '5px 14px', borderRadius: '7px', border: `1px solid ${lang===l ? C.accent : C.border}`, background: lang===l ? 'rgba(229,57,53,0.1)' : 'transparent', color: lang===l ? C.accent : C.muted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {l === 'en' ? '🇬🇧 English' : '🇲🇾 Bahasa M'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={hookText}
                    onChange={e => setHookText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                    onFocus={focusBorder} onBlur={blurBorder}
                    placeholder={`Hook — e.g. "Cleanest ${listing?.brand||'car'} in ${listing?.state||'Malaysia'}"`}
                    style={{ ...inp(false), flex: 1 }}
                  />
                  <button onClick={generate} disabled={generating} style={{ ...btn('primary'), opacity: generating ? 0.65 : 1, padding: '8px 16px' }}>
                    {generating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                    {generating ? 'Writing…' : 'Generate'}
                  </button>
                </div>
                {genError && <div style={{ marginTop: '8px', fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '7px', padding: '7px 10px' }}>{genError}</div>}
              </div>

              {/* ── All slides text list ── */}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>All Slides</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {slides.map((s, i) => (
                    <div
                      key={s.id ?? i}
                      onClick={() => setActive(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '9px', border: `1px solid ${active===i ? C.accent : C.border}`, background: active===i ? 'rgba(229,57,53,0.06)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      <span style={{ fontSize: '10px', fontWeight: 700, color: active===i ? C.accent : C.dim, minWidth: '22px' }}>#{i+1}</span>
                      <span style={{ fontSize: '12px', color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.headline || '—'}</span>
                      <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[s.bottomLeft, s.bottomRight].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ══ FULLSCREEN ══ */}
      {fullscreen && (
        <div onClick={() => setFullscreen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          <button onClick={() => setFullscreen(false)} style={{ position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
          <button onClick={e => { e.stopPropagation(); setActive(i => Math.max(0, i-1)); }} disabled={active===0} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: active===0 ? 0.2 : 1 }}><ChevronLeft size={20} /></button>
          <button onClick={e => { e.stopPropagation(); setActive(i => Math.min(total-1, i+1)); }} disabled={active===total-1} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: active===total-1 ? 0.2 : 1 }}><ChevronRight size={20} /></button>

          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0, aspectRatio: '9/16', maxHeight: 'calc(100vh - 80px)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.9)' }}>
              <SlideCanvas slide={slide} watermark={dealership} fontId={font} width={1080} height={1920} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', minWidth: '36px' }}>{active+1}/{total}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {slides.map((_, i) => (
                  <div key={i} onClick={() => setActive(i)} style={{ width: i===active ? 18 : 5, height: 5, borderRadius: 3, background: i===active ? C.accent : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.2s' }} />
                ))}
              </div>
              <button onClick={() => saveSingle(active)} disabled={dlIdx===active} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {dlIdx===active ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={11} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}