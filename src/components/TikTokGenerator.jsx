import React, { useState, useRef, useEffect, useCallback } from 'react';
const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
import {
  X, Download, Loader2, ChevronLeft, ChevronRight,
  Sparkles, Trash2, Type, Image as ImageIcon, Plus,
} from 'lucide-react';

// JSZip
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

export const FONTS = [
  { id: 'dm',         label: 'DM Sans',         stack: "'DM Sans', sans-serif",          weights: ['400','700','800'] },
  { id: 'bebas',      label: 'Bebas Neue',       stack: "'Bebas Neue', sans-serif",       weights: ['400','400','400'] },
  { id: 'oswald',     label: 'Oswald',           stack: "'Oswald', sans-serif",           weights: ['400','600','700'] },
  { id: 'montserrat', label: 'Montserrat',       stack: "'Montserrat', sans-serif",       weights: ['400','700','800'] },
  { id: 'raleway',    label: 'Raleway',          stack: "'Raleway', sans-serif",          weights: ['400','700','800'] },
  { id: 'anton',      label: 'Anton',            stack: "'Anton', sans-serif",            weights: ['400','400','400'] },
  { id: 'barlow',     label: 'Barlow Condensed', stack: "'Barlow Condensed', sans-serif", weights: ['400','600','700'] },
  { id: 'russo',      label: 'Russo One',        stack: "'Russo One', sans-serif",        weights: ['400','400','400'] },
];

const GFONTS_LOADED = new Set();
function ensureFont(fontId) {
  if (GFONTS_LOADED.has(fontId)) return;
  GFONTS_LOADED.add(fontId);
  const urls = {
    dm:         'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&display=swap',
    bebas:      'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
    oswald:     'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap',
    montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap',
    raleway:    'https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap',
    anton:      'https://fonts.googleapis.com/css2?family=Anton&display=swap',
    barlow:     'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap',
    russo:      'https://fonts.googleapis.com/css2?family=Russo+One&display=swap',
  };
  if (!urls[fontId]) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = urls[fontId];
  document.head.appendChild(link);
}

async function renderSlide(canvas, slide, watermark, fontId = 'dm') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const fontDef = FONTS.find(f => f.id === fontId) || FONTS[0];
  const stack = fontDef.stack;
  const [w3, w2, w1] = fontDef.weights;
  const img = await loadImage(slide.imageUrl);

  if (img) {
    ctx.save();
    ctx.filter = 'blur(32px)';
    const sc = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    const PAD = 40, availW = W - PAD * 2, availH = H * 0.62, topY = H * 0.06;
    const si = Math.min(availW / img.width, availH / img.height);
    const dw = img.width * si, dh = img.height * si;
    ctx.drawImage(img, (W - dw) / 2, topY + (availH - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1b2e'); g.addColorStop(1, '#071020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  const lg = ctx.createLinearGradient(0, 0, W * 0.75, 0);
  lg.addColorStop(0, 'rgba(0,0,0,0.50)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.84);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.90)');
  ctx.fillStyle = bg; ctx.fillRect(0, H * 0.55, W, H * 0.29);

  function draw(text, x, y, weight, size, colour, maxW) {
    if (!text) return;
    ctx.save();
    ctx.font = `${weight} ${size}px ${stack}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    while (ctx.measureText(text).width > maxW && size > 16) { size -= 3; ctx.font = `${weight} ${size}px ${stack}`; }
    ctx.lineWidth = Math.max(size * 0.08, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = colour; ctx.fillText(text, x, y);
    ctx.restore();
  }

  const X = 64, maxW = W * 0.62;
  const sz1 = 112, sz2 = 80, sz3 = 52;
  const anchor = H * 0.80, gap = 12;
  const y3 = anchor - sz3, y2 = y3 - sz2 - gap, y1 = y2 - sz1 - gap;
  draw(slide.headline    || '', X, y1, w1, sz1, '#ffffff',                maxW);
  draw(slide.bottomLeft  || '', X, y2, w2, sz2, '#ffffff',                maxW);
  draw(slide.bottomRight || '', X, y3, w3, sz3, 'rgba(255,255,255,0.70)', maxW);

  if (watermark) {
    ctx.save();
    ctx.font = `600 26px ${stack}`;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(watermark.toUpperCase(), W - 52, 52);
    ctx.restore();
  }
}

function buildDefaultSlides(listing, images) {
  const brand = listing?.brand || '', model = listing?.model || '', variant = listing?.variant || '';
  const year = String(listing?.year || '');
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? 'RM ' + Number(price).toLocaleString() : '';
  const mileage = listing?.mileage ? Number(listing.mileage).toLocaleString() + ' km' : '';
  const cond = { new: 'Brand New', recon: 'Recon', used: 'Used' }[listing?.condition] || listing?.condition || '';
  const trans = listing?.transmission || '', fuel = listing?.fuel_type || listing?.fuel || '';
  const color = listing?.color || '', state = listing?.state ? '📍 ' + listing.state : '';
  const engine = listing?.engine_cc ? listing.engine_cc + 'cc' : '';
  const T = [
    { headline: `${brand} ${model}`.trim(), bl: priceStr, br: [year, cond, mileage].filter(Boolean).join(' · ') },
    { headline: variant || `${brand} ${model}`.trim(), bl: priceStr, br: [trans, fuel].filter(Boolean).join(' · ') },
    { headline: priceStr || `${brand} ${model}`.trim(), bl: [year, cond].filter(Boolean).join(' · '), br: mileage },
    { headline: `${brand} ${model}`.trim(), bl: priceStr, br: [engine, fuel].filter(Boolean).join(' · ') },
    { headline: model, bl: priceStr || [year, cond].filter(Boolean).join(' · '), br: [color, state].filter(Boolean).join(' · ') },
    { headline: `${brand} ${model}`.trim(), bl: mileage || priceStr, br: [cond, trans].filter(Boolean).join(' · ') },
    { headline: priceStr || model, bl: [year, cond].filter(Boolean).join(' · '), br: [trans, fuel].filter(Boolean).join(' · ') },
    { headline: `${year} ${brand} ${model}`.trim(), bl: priceStr, br: state },
    { headline: variant || model, bl: priceStr, br: [engine, color].filter(Boolean).join(' · ') },
    { headline: 'DM for Best Price 📲', bl: `${brand} ${model}`.trim(), br: state || 'Malaysia' },
  ];
  const count = images.length > 0 ? images.length : 1;
  return Array.from({ length: count }, (_, i) => ({
    id: i, imageUrl: images[i] || null,
    headline:    T[i % T.length]?.headline    || `${brand} ${model}`.trim(),
    bottomLeft:  T[i % T.length]?.bl          || '',
    bottomRight: T[i % T.length]?.br          || '',
  }));
}

async function generateWithClaude(listing, language, hookText, slideCount) {
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? 'RM ' + Number(price).toLocaleString() : 'Ask for Price';
  const lang = language === 'bm' ? 'Bahasa Malaysia (casual dealer tone)' : 'English (punchy Malaysian car market)';
  const prompt = `Malaysian car dealer TikTok slide copywriter. Write ${slideCount} slides.
CAR: ${listing?.year||''} ${listing?.brand||''} ${listing?.model||''} ${listing?.variant||''}
Price: ${priceStr} | Mileage: ${listing?.mileage ? Number(listing.mileage).toLocaleString()+' km' : 'N/A'}
Condition: ${listing?.condition||''} | Trans: ${listing?.transmission||''} | Fuel: ${listing?.fuel_type||listing?.fuel||''}
Color: ${listing?.color||''} | Engine: ${listing?.engine_cc?listing.engine_cc+'cc':''} | Location: ${listing?.state||'Malaysia'}
${hookText ? 'Seller hook: "' + hookText + '"' : ''}
Language: ${lang}
Each slide: headline (max 5 words), bottomLeft (max 3 words), bottomRight (max 3 words).
Return ONLY valid JSON array: [{"headline":"...","bottomLeft":"...","bottomRight":"..."},...]`;
  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  let text = '';
  if (Array.isArray(data?.content)) text = data.content.map(b => b.text || '').join('');
  else if (data?.completion) text = data.completion;
  else text = JSON.stringify(data);
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

const SlideCanvas = React.memo(function SlideCanvas({ slide, watermark, fontId, width, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = width; c.height = height;
    renderSlide(c, slide, watermark, fontId).catch(() => {});
  }, [slide, watermark, fontId, width, height]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
});

const Thumb = React.memo(function Thumb({ slide, fontId, isActive, index, onClick, onDelete, showDelete }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative', flexShrink: 0, cursor: 'pointer',
      width: 48, height: 85, borderRadius: 7,
      border: isActive ? '2px solid #e53935' : '2px solid rgba(255,255,255,0.1)',
      overflow: 'hidden', transition: 'border-color 0.15s, transform 0.15s',
      transform: isActive ? 'scale(1.06)' : 'scale(1)',
    }}>
      <SlideCanvas slide={slide} watermark="" fontId={fontId} width={96} height={171} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.6)', fontSize: 9, fontWeight: 700,
        color: isActive ? '#ff6b6b' : 'rgba(255,255,255,0.5)',
        textAlign: 'center', padding: '2px 0', fontFamily: "'DM Sans', sans-serif",
      }}>{index + 1}</div>
      {showDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
          position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(239,68,68,0.85)', border: 'none', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}><X size={9} /></button>
      )}
    </div>
  );
});

export default function TikTokGenerator({ listing, onClose }) {
  const rawImages  = (listing?.images || []).filter(Boolean);
  const dealership = listing?.dealership_name || 'ShiftOS';

  const [slides,      setSlides]      = useState(() => buildDefaultSlides(listing, rawImages));
  const [active,      setActive]      = useState(0);
  const [font,        setFont]        = useState('dm');
  const [lang,        setLang]        = useState('en');
  const [hookText,    setHookText]    = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState('');
  const [downloading, setDownloading] = useState(false);
  const [dlIdx,       setDlIdx]       = useState(null);
  const [activeTab,   setActiveTab]   = useState('text');

  const slide = slides[active] || slides[0] || {};
  const total = slides.length;
  const filmRef = useRef(null);

  useEffect(() => { FONTS.forEach(f => ensureFont(f.id)); }, []);

  useEffect(() => {
    const el = filmRef.current; if (!el) return;
    const thumb = el.children[active]; if (!thumb) return;
    thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [active]);

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setActive(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActive(i => Math.min(total - 1, i + 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, total]);

  const patch = (field, value) =>
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, [field]: value } : s));

  const uploadImage = (idx, file) => {
    const reader = new FileReader();
    reader.onload = e => setSlides(prev => prev.map((s, i) => i === idx ? { ...s, imageUrl: e.target.result } : s));
    reader.readAsDataURL(file);
  };

  const addSlide = () => {
    const n = { id: Date.now(), imageUrl: null, headline: `${listing?.brand || ''} ${listing?.model || ''}`.trim(), bottomLeft: '', bottomRight: '' };
    setSlides(prev => [...prev, n]);
    setTimeout(() => setActive(slides.length), 0);
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
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    await renderSlide(c, slides[idx], dealership, font);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.93));
  }, [slides, dealership, font]);

  const saveSingle = async idx => {
    setDlIdx(idx);
    const blob = await toBlob(idx); const url = URL.createObjectURL(blob);
    if (isIOS()) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    else { const a = document.createElement('a'); a.download = `${listing?.brand || 'slide'}-${listing?.model || ''}-${idx + 1}.jpg`; a.href = url; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    setDlIdx(null);
  };

  const saveAll = async () => {
    setDownloading(true);
    if (isIOS()) {
      for (let i = 0; i < total; i++) { const blob = await toBlob(i); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 15000); await new Promise(r => setTimeout(r, 500)); }
      setDownloading(false); return;
    }
    try {
      const JSZip = await loadJSZip(); const zip = new JSZip();
      const folder = zip.folder(`${listing?.brand || 'slides'}-${listing?.model || ''}`);
      for (let i = 0; i < total; i++) folder.file(`slide-${String(i + 1).padStart(2, '0')}.jpg`, await toBlob(i));
      const zb = await zip.generateAsync({ type: 'blob' }); const url = URL.createObjectURL(zb);
      const a = document.createElement('a'); a.download = `${listing?.brand || 'slides'}-${listing?.model || ''}.zip`; a.href = url; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { for (let i = 0; i < total; i++) { await saveSingle(i); await new Promise(r => setTimeout(r, 200)); } }
    setDownloading(false);
  };

  // Reusable input style
  const inpStyle = (big) => ({
    width: '100%', padding: big ? '11px 14px' : '9px 14px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#fff', fontFamily: "'DM Sans', sans-serif",
    fontSize: big ? 15 : 13, fontWeight: big ? 700 : 400, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  });
  const focusIn  = e => e.target.style.borderColor = 'rgba(229,57,53,0.6)';
  const focusOut = e => e.target.style.borderColor = 'rgba(255,255,255,0.1)';
  const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 5, fontFamily: 'inherit' };

  const renderTextPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <ImageIcon size={13} />{slide.imageUrl ? 'Swap Photo' : 'Add Photo'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadImage(active, e.target.files[0])} />
        </label>
        {total > 1 && (
          <button onClick={() => removeSlide(active)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
            <Trash2 size={13} />Remove
          </button>
        )}
      </div>
      <div><span style={lbl}>Line 1 — Brand / Model</span><input value={slide.headline || ''} onChange={e => patch('headline', e.target.value)} placeholder="e.g. BMW M4 Competition" style={inpStyle(true)} onFocus={focusIn} onBlur={focusOut} /></div>
      <div><span style={lbl}>Line 2 — Price / Hook</span><input value={slide.bottomLeft || ''} onChange={e => patch('bottomLeft', e.target.value)} placeholder="e.g. RM 189,800" style={inpStyle(false)} onFocus={focusIn} onBlur={focusOut} /></div>
      <div><span style={lbl}>Line 3 — Specs</span><input value={slide.bottomRight || ''} onChange={e => patch('bottomRight', e.target.value)} placeholder="e.g. 2023 · Recon · 28k km" style={inpStyle(false)} onFocus={focusIn} onBlur={focusOut} /></div>
    </div>
  );

  const renderStylePanel = () => (
    <div>
      <span style={lbl}>Font</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {FONTS.map(f => (
          <button key={f.id} onClick={() => { ensureFont(f.id); setFont(f.id); }} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 10, cursor: 'pointer', width: '100%',
            border: `1px solid ${font === f.id ? '#e53935' : 'rgba(255,255,255,0.08)'}`, background: font === f.id ? 'rgba(229,57,53,0.1)' : 'rgba(255,255,255,0.03)',
            fontFamily: f.stack, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 14, color: font === f.id ? '#e53935' : 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{f.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Sans', sans-serif" }}>Aa</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderAIPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {['en', 'bm'].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${lang === l ? '#e53935' : 'rgba(255,255,255,0.1)'}`, background: lang === l ? 'rgba(229,57,53,0.1)' : 'rgba(255,255,255,0.03)', color: lang === l ? '#e53935' : 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            {l === 'en' ? '🇬🇧 English' : '🇲🇾 Bahasa'}
          </button>
        ))}
      </div>
      <input value={hookText} onChange={e => setHookText(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder={"Hook — e.g. Cleanest " + (listing?.brand || 'car') + " in Malaysia"} style={inpStyle(false)} onFocus={focusIn} onBlur={focusOut} />
      <button onClick={generate} disabled={generating} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: 'none', background: '#e53935', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1, fontFamily: 'inherit', width: '100%' }}>
        {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
        {generating ? 'Writing ' + total + ' slides…' : 'Generate All ' + total + ' Slides'}
      </button>
      {genError && <p style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{genError}</p>}
    </div>
  );

  const FilmstripRow = ({ vertical }) => (
    <div ref={vertical ? undefined : filmRef} style={{
      display: 'flex', flexDirection: vertical ? 'column' : 'row',
      gap: 8, padding: vertical ? '4px' : '4px 0',
      overflowX: vertical ? 'visible' : 'auto', overflowY: vertical ? 'auto' : 'visible',
      flex: vertical ? 1 : undefined, alignItems: vertical ? undefined : 'center',
      scrollbarWidth: 'none',
    }}>
      {slides.map((s, i) => (
        <Thumb key={s.id ?? i} slide={s} fontId={font} isActive={i === active} index={i}
          onClick={() => setActive(i)} onDelete={() => removeSlide(i)} showDelete={total > 1} />
      ))}
      <button onClick={addSlide} style={{ flexShrink: 0, width: 48, height: 85, borderRadius: 7, border: '2px dashed rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Plus size={16} />
      </button>
    </div>
  );

  const TABS = [
    { id: 'text',  label: 'Text' },
    { id: 'style', label: 'Style' },
    { id: 'ai',    label: 'AI' },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes tgIn { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
        .tg * { box-sizing:border-box; }
        .tg ::-webkit-scrollbar { display:none; }
        /* desktop */
        .tg-d { display:none!important; }
        .tg-m { display:flex!important; }
        @media(min-width:768px) { .tg-d { display:flex!important; } .tg-m { display:none!important; } }
        .tg-rtab { padding:7px 13px; border-radius:8px; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700; transition:all 0.15s; border:none; }
      `}</style>

      <div className="tg" onClick={onClose} style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(14px)', fontFamily:"'DM Sans',sans-serif" }}>

        {/* ══ DESKTOP ══ */}
        <div className="tg-d" onClick={e => e.stopPropagation()} style={{ position:'fixed', inset:0, flexDirection:'column', background:'#08080f', animation:'tgIn 0.25s ease' }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'#0c0c16', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:27, height:27, borderRadius:7, background:'#e53935', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.77 0 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.12 8.72 6.34 6.34 0 0 0 11.65-3.42V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/></svg>
              </div>
              <span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>Slide Generator</span>
              <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginLeft:4 }}>{listing?.brand} {listing?.model} · {total} slides · 1080×1920</span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => saveSingle(active)} disabled={dlIdx === active} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity: dlIdx === active ? 0.5 : 1 }}>
                {dlIdx === active ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <Download size={12} />} This slide
              </button>
              <button onClick={saveAll} disabled={downloading} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'none', background:'#e53935', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: downloading ? 0.6 : 1 }}>
                {downloading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <Download size={12} />}
                {downloading ? 'Packing…' : isIOS() ? 'Save All' : 'Export ZIP (' + total + ')'}
              </button>
              <button onClick={onClose} style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer' }}><X size={15} /></button>
            </div>
          </div>

          {/* 3-column body */}
          <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

            {/* Left: filmstrip */}
            <div style={{ width:78, background:'#060610', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', padding:'12px 15px', gap:0, overflowY:'auto', flexShrink:0 }}>
              <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.18)', marginBottom:10, marginTop:0 }}>Slides</p>
              <div ref={filmRef} style={{ display:'flex', flexDirection:'column', gap:8, overflow:'auto', flex:1, scrollbarWidth:'none' }}>
                {slides.map((s, i) => (
                  <Thumb key={s.id ?? i} slide={s} fontId={font} isActive={i === active} index={i} onClick={() => setActive(i)} onDelete={() => removeSlide(i)} showDelete={total > 1} />
                ))}
                <button onClick={addSlide} style={{ flexShrink:0, width:48, height:85, borderRadius:7, border:'2px dashed rgba(255,255,255,0.14)', background:'rgba(255,255,255,0.02)', color:'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={16} /></button>
              </div>
            </div>

            {/* Center: canvas */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#070711', gap:14, padding:'24px 20px', position:'relative' }}>
              <div style={{ aspectRatio:'9/16', height:'min(calc(100dvh - 200px), 520px)', borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', flexShrink:0 }}>
                <SlideCanvas slide={slide} watermark={dealership} fontId={font} width={540} height={960} />
              </div>
              <button onClick={() => setActive(i => Math.max(0, i-1))} disabled={active===0} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', width:34, height:34, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.55)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: active===0 ? 0.15 : 0.7 }}><ChevronLeft size={17} /></button>
              <button onClick={() => setActive(i => Math.min(total-1, i+1))} disabled={active===total-1} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', width:34, height:34, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.55)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: active===total-1 ? 0.15 : 0.7 }}><ChevronRight size={17} /></button>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', fontWeight:600 }}>Slide {active+1} of {total}</div>
            </div>

            {/* Right: edit panel */}
            <div style={{ width:310, background:'#0c0c16', borderLeft:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', flexShrink:0 }}>
              {/* Tab row */}
              <div style={{ display:'flex', gap:4, padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
                {TABS.map(({ id, label }) => (
                  <button key={id} className="tg-rtab" onClick={() => setActiveTab(id)} style={{ background: activeTab===id ? 'rgba(229,57,53,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${activeTab===id ? 'rgba(229,57,53,0.4)' : 'rgba(255,255,255,0.07)'}`, color: activeTab===id ? '#e53935' : 'rgba(255,255,255,0.38)' }}>{label}</button>
                ))}
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'18px 16px' }}>
                {activeTab === 'text'  && renderTextPanel()}
                {activeTab === 'style' && renderStylePanel()}
                {activeTab === 'ai'    && renderAIPanel()}
              </div>
            </div>

          </div>
        </div>

        {/* ══ MOBILE ══ */}
        <div className="tg-m" onClick={e => e.stopPropagation()} style={{ position:'fixed', inset:0, flexDirection:'column', background:'#08080f', animation:'tgIn 0.25s ease' }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#0c0c16', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16} /></button>
            <span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>Slide {active+1}/{total}</span>
            <button onClick={saveAll} disabled={downloading} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:8, border:'none', background:'#e53935', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: downloading ? 0.6 : 1 }}>
              {downloading ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <Download size={12} />}
              {downloading ? '…' : isIOS() ? 'Save' : 'ZIP'}
            </button>
          </div>

          {/* Canvas */}
          <div style={{ flexShrink:0, display:'flex', justifyContent:'center', alignItems:'center', background:'#060610', padding:'12px 16px', position:'relative' }}>
            <div style={{ position:'relative' }}>
              <div style={{ width:138, height:245, borderRadius:10, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.7)' }}>
                <SlideCanvas slide={slide} watermark={dealership} fontId={font} width={276} height={490} />
              </div>
              <button onClick={() => saveSingle(active)} disabled={dlIdx===active} style={{ position:'absolute', bottom:5, right:5, width:24, height:24, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {dlIdx===active ? <Loader2 size={9} style={{ animation:'spin 1s linear infinite' }} /> : <Download size={9} />}
              </button>
            </div>
            <button onClick={() => setActive(i => Math.max(0, i-1))} disabled={active===0} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', width:28, height:28, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.55)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: active===0 ? 0.15 : 0.7 }}><ChevronLeft size={14} /></button>
            <button onClick={() => setActive(i => Math.min(total-1, i+1))} disabled={active===total-1} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:28, height:28, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.55)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: active===total-1 ? 0.15 : 0.7 }}><ChevronRight size={14} /></button>
          </div>

          {/* Horizontal filmstrip */}
          <div ref={filmRef} style={{ flexShrink:0, display:'flex', gap:8, overflowX:'auto', padding:'8px 14px', background:'#060610', borderBottom:'1px solid rgba(255,255,255,0.06)', scrollbarWidth:'none', alignItems:'center' }}>
            {slides.map((s, i) => (
              <Thumb key={s.id ?? i} slide={s} fontId={font} isActive={i === active} index={i} onClick={() => setActive(i)} onDelete={() => removeSlide(i)} showDelete={total > 1} />
            ))}
            <button onClick={addSlide} style={{ flexShrink:0, width:48, height:85, borderRadius:7, border:'2px dashed rgba(255,255,255,0.14)', background:'rgba(255,255,255,0.02)', color:'rgba(255,255,255,0.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={16} /></button>
          </div>

          {/* Tab bar */}
          <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'#0c0c16', flexShrink:0 }}>
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'9px 4px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', borderBottom: activeTab===id ? '2px solid #e53935' : '2px solid transparent', color: activeTab===id ? '#e53935' : 'rgba(255,255,255,0.28)', transition:'color 0.15s' }}>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.04em' }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Scrollable panel */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 14px', overscrollBehavior:'contain' }}>
            {activeTab === 'text'  && renderTextPanel()}
            {activeTab === 'style' && renderStylePanel()}
            {activeTab === 'ai'    && renderAIPanel()}
          </div>

        </div>
      </div>
    </>
  );
}