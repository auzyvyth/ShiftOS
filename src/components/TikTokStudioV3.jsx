import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const AI_LIMIT = 100;

const SUGGESTION_POOL = [
  "make price bigger","center the hook","price in red",
  "rotate headline -5deg","make hook smaller","gold accent",
  "move price to top","bold the headline","hide watermark",
  "make it minimal","add hot deal badge","increase opacity",
];

// ─── CSS animations ───────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("ttsv3-styles")) {
  const s = document.createElement("style");
  s.id = "ttsv3-styles";
  s.textContent = `
    @keyframes ttsv3-spin { to { transform: rotate(360deg); } }
    @keyframes ttsv3-highlight { 0%,100%{ box-shadow:none; } 40%{ box-shadow:0 0 0 4px rgba(220,38,38,0.7); } }
  `;
  document.head.appendChild(s);
}

// ─── roundRect polyfill ───────────────────────────────────────────────────────
(function () {
  if (typeof CanvasRenderingContext2D === "undefined") return;
  if (CanvasRenderingContext2D.prototype.roundRect) return;
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === "number" ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + r, y); this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
})();

// ─── Utils ────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
  return String(val).split(",").map(s => s.trim()).filter(Boolean);
}
function calcMonthly(price) {
  if (!price) return null;
  const loan = price * 0.9;
  return Math.round((loan + (3.5 / 100) * loan * 9) / (9 * 12));
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
const IMG_CACHE = new Map();
function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!IMG_CACHE.has(url)) {
    IMG_CACHE.set(url, new Promise(res => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => res(img); img.onerror = () => res(null); img.src = url;
    }));
  }
  return IMG_CACHE.get(url);
}
let _zip = null;
function loadJSZip() {
  if (!_zip) _zip = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => res(window.JSZip); s.onerror = rej;
    document.head.appendChild(s);
  });
  return _zip;
}

// ─── Fonts ────────────────────────────────────────────────────────────────────
const FONTS = [
  { id:"dm",         label:"DM Sans",          stack:"'DM Sans',sans-serif",         url:"https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&display=swap" },
  { id:"bebas",      label:"Bebas Neue",        stack:"'Bebas Neue',sans-serif",       url:"https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" },
  { id:"oswald",     label:"Oswald",            stack:"'Oswald',sans-serif",           url:"https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&display=swap" },
  { id:"montserrat", label:"Montserrat",        stack:"'Montserrat',sans-serif",       url:"https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap" },
  { id:"anton",      label:"Anton",             stack:"'Anton',sans-serif",            url:"https://fonts.googleapis.com/css2?family=Anton&display=swap" },
  { id:"barlow",     label:"Barlow Condensed",  stack:"'Barlow Condensed',sans-serif", url:"https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap" },
  { id:"russo",      label:"Russo One",         stack:"'Russo One',sans-serif",        url:"https://fonts.googleapis.com/css2?family=Russo+One&display=swap" },
  { id:"raleway",    label:"Raleway",           stack:"'Raleway',sans-serif",          url:"https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap" },
];
const GFONTS_LOADED = new Set();
function ensureFont(fontId) {
  if (GFONTS_LOADED.has(fontId)) return;
  GFONTS_LOADED.add(fontId);
  const f = FONTS.find(f => f.id === fontId);
  if (!f?.url) return;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = f.url;
  document.head.appendChild(l);
}

// ─── Style Presets ────────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  { id:"dark-luxury", label:"Dark Luxury", dots:["#0d0d0d","#c9a84c"], theme:{ accentColor:"#c9a84c", bgColor:"#0d0d0d", overlayOpacity:0.55 } },
  { id:"street-red",  label:"Street Bold", dots:["#0a0a0a","#e53935"], theme:{ accentColor:"#e53935", bgColor:"#0a0a0a", overlayOpacity:0.45 } },
  { id:"neon-blue",   label:"Neon Blue",   dots:["#020918","#00d4ff"], theme:{ accentColor:"#00d4ff", bgColor:"#020918", overlayOpacity:0.50 } },
  { id:"clean-white", label:"Clean White", dots:["#f5f5f5","#1a1a1a"], theme:{ accentColor:"#1a1a1a", bgColor:"#f0f0f0", overlayOpacity:0.30 } },
  { id:"emerald",     label:"Emerald",     dots:["#021a0d","#00c853"], theme:{ accentColor:"#00c853", bgColor:"#021a0d", overlayOpacity:0.50 } },
  { id:"purple-haze", label:"Purple Haze", dots:["#0d0520","#8b5cf6"], theme:{ accentColor:"#8b5cf6", bgColor:"#0d0520", overlayOpacity:0.52 } },
];

// ─── Templates ────────────────────────────────────────────────────────────────
const SLIDE_TEMPLATES = [
  { id:"hype",            label:"Hype",    icon:"🔥" },
  { id:"hero-hook",       label:"Hook",    icon:"⚡" },
  { id:"specs-breakdown", label:"Specs",   icon:"📋" },
  { id:"pricing",         label:"Pricing", icon:"💰" },
  { id:"cta",             label:"CTA",     icon:"📲" },
  { id:"story",           label:"Story",   icon:"✨" },
  { id:"minimal",         label:"Minimal", icon:"🖤" },
];

// ─── Default Theme ────────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  accentColor:"#dc2626", bgColor:"#060910", overlayOpacity:0.45,
  overlayStyle:"dark", textColor:"#ffffff",
  watermarkText:"", watermarkOpacity:0.14, watermarkPos:"top-right",
  logoUrl:null, logoSize:80, showAccentBar:true,
  showConditionBadge:false, showHotDealBadge:false,
  customBadgeText:"", badgeColor:"#dc2626",
};

// ─── Default elements builder ─────────────────────────────────────────────────
function buildDefaultElements(listing, theme, dealerName) {
  const brand = listing?.brand || "", model = listing?.model || "";
  const variant = listing?.variant || "", year = String(listing?.year || "");
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
  const mileage = listing?.mileage ? Number(listing.mileage).toLocaleString() + " km" : "";
  const trans = listing?.transmission || "", fuel = listing?.fuel_type || listing?.fuel || "";
  const acc = theme?.accentColor || "#dc2626";
  return [
    { id:"hook",      type:"text",
      content:"POV: You just found your dream car 🚗",
      x:540, y:110, fontSize:38, fontWeight:"600",
      color:"#ffffff", rotation:0, opacity:0.92, align:"center", visible:true, locked:false },
    { id:"headline",  type:"text",
      content:[`${year} ${brand} ${model}`, variant].filter(Boolean).join(" ").trim() || "Your Car",
      x:60, y:1480, fontSize:72, fontWeight:"800",
      color:"#ffffff", rotation:0, opacity:1, align:"left", visible:true, locked:false },
    { id:"price",     type:"text",
      content:priceStr || "Price on Request",
      x:60, y:1590, fontSize:52, fontWeight:"700",
      color:acc, rotation:0, opacity:1, align:"left", visible:true, locked:false },
    { id:"stats",     type:"text",
      content:[mileage, trans, fuel].filter(Boolean).join(" · ") || "",
      x:60, y:1665, fontSize:30, fontWeight:"400",
      color:"rgba(255,255,255,0.65)", rotation:0, opacity:1, align:"left", visible:true, locked:false },
    { id:"watermark", type:"text",
      content:dealerName || "XDrive",
      x:1020, y:72, fontSize:24, fontWeight:"400",
      color:"rgba(255,255,255,0.35)", rotation:0, opacity:0.5, align:"right", visible:true, locked:true },
  ];
}

// ─── Build default slides ─────────────────────────────────────────────────────
function buildDefaultSlides(listing, images, features, dealerName, whatsapp) {
  const brand = listing?.brand || "", model = listing?.model || "", variant = listing?.variant || "";
  const year = String(listing?.year || "");
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "";
  const mileage = listing?.mileage ? Number(listing.mileage).toLocaleString() + " km" : "";
  const cond = listing?.condition || "";
  const condLabel = { new:"Brand New", recon:"Recon", used:"Used" }[cond] || cond;
  const statsLine = [year, condLabel, mileage].filter(Boolean).join(" · ");
  const makeSlide = (img, template) => ({
    id:uid(), imageUrl:img || null, template,
    carName:`${year} ${brand} ${model}${variant ? " " + variant : ""}`.trim(),
    priceStr, priceNum:price || 0, statsLine, hookText:"",
    features, condition:cond, dealerName:dealerName || "", whatsapp:whatsapp || "",
    monthly:calcMonthly(price),
    elements:buildDefaultElements(listing, DEFAULT_THEME, dealerName),
  });
  if (!images.length) return [makeSlide(null, "hype")];
  const tpls = ["hype","story","specs-breakdown","pricing","cta","minimal","hype"];
  return images.slice(0, 7).map((img, i) => makeSlide(img, tpls[i] || "hype"));
}

// ─── AI: rate limiting via Supabase ai_usage ──────────────────────────────────
async function getAIUsage(dealerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("ai_usage")
    .select("count").eq("dealer_id", dealerId).eq("date", today).maybeSingle();
  return data?.count || 0;
}
async function incrementAIUsage(dealerId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("ai_usage")
    .select("id,count").eq("dealer_id", dealerId).eq("date", today).maybeSingle();
  if (data) {
    await supabase.from("ai_usage").update({ count:data.count + 1 }).eq("id", data.id);
    return data.count + 1;
  }
  await supabase.from("ai_usage").insert({ dealer_id:dealerId, date:today, count:1 });
  return 1;
}

// ─── AI: canvas edit command ──────────────────────────────────────────────────
async function applyAICommand(command, elements, theme, selectedElementId) {
  const system = `You are a canvas design AI for TikTok car listing slides. Canvas is 1080x1920px. Return ONLY valid JSON: {"elements":[only changed elements with id + changed fields],"theme":{only changed theme fields}}. Never return unchanged items. x:0-1080, y:0-1920, fontSize:20-200.`;
  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      model:"claude-sonnet-4-6", max_tokens:800, system,
      messages:[{ role:"user", content:JSON.stringify({ command, elements, selectedElementId, theme }) }],
    }),
  });
  if (!res.ok) throw new Error("AI error");
  const data = await res.json();
  const text = Array.isArray(data?.content) ? data.content.map(b => b.text || "").join("") : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── AI: generate slide copy ──────────────────────────────────────────────────
async function generateSlidesCopy(listing, slideCount, language, hookText) {
  const price = listing?.selling_price || listing?.price;
  const priceStr = price ? "RM " + Number(price).toLocaleString() : "N/A";
  const lang = language === "bm"
    ? "Bahasa Malaysia (casual dealer tone)"
    : "English (punchy Malaysian car market)";
  const prompt = `Malaysian car dealer TikTok copywriter. Write ${slideCount} slides.
CAR: ${listing?.year || ""} ${listing?.brand || ""} ${listing?.model || ""} ${listing?.variant || ""}
Price: ${priceStr} | Mileage: ${listing?.mileage ? Number(listing.mileage).toLocaleString() + " km" : "N/A"}
Condition: ${listing?.condition || ""} | Trans: ${listing?.transmission || ""} | Fuel: ${listing?.fuel_type || ""}
${hookText ? 'Hook: "' + hookText + '"' : ""} | Language: ${lang}
Return ONLY JSON array: [{"hookText":"max 6 words ALL CAPS","headline":"full car title"}]`;
  const res = await fetch(`${SERVER_URL}/ai/messages`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000,
      messages:[{ role:"user", content:prompt }] }),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  const text = Array.isArray(data?.content) ? data.content.map(b => b.text || "").join("") : "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── Export: render slide to HTML5 canvas ─────────────────────────────────────
async function renderToCanvas(canvas, slide, theme, fontId = "dm") {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const fontObj = FONTS.find(f => f.id === fontId) || FONTS[0];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = theme.bgColor || "#060910";
  ctx.fillRect(0, 0, W, H);
  if (slide.imageUrl) {
    const img = await loadImage(slide.imageUrl);
    if (img) {
      ctx.save(); ctx.filter = "blur(18px) brightness(0.4)";
      ctx.drawImage(img, 0, 0, W, H); ctx.restore();
      ctx.save();
      const ar = img.naturalWidth / img.naturalHeight;
      let dw = W, dh = W / ar;
      if (dh > H) { dh = H; dw = H * ar; }
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    }
  }
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(6,9,16,0.95)");
  grad.addColorStop(0.28, "rgba(6,9,16,0.08)");
  grad.addColorStop(0.52, "rgba(6,9,16,0.05)");
  grad.addColorStop(0.66, "rgba(6,9,16,0.82)");
  grad.addColorStop(1, "rgba(6,9,16,1)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  if (theme.showAccentBar !== false) {
    ctx.fillStyle = theme.accentColor || "#dc2626"; ctx.fillRect(0, 0, W, 6);
  }
  const fstack = fontObj.stack.replace(/'/g, "");
  for (const el of (slide.elements || [])) {
    if (!el.visible) continue;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = el.color || "#fff";
    ctx.font = `${el.fontWeight || "400"} ${el.fontSize || 32}px ${fstack}`;
    ctx.textAlign = el.align || "left";
    ctx.textBaseline = "top";
    ctx.fillText(el.content || "", 0, 0);
    ctx.restore();
  }
}

// ─── CanvasElement ────────────────────────────────────────────────────────────
function CanvasElement({ el, scale, selected, highlighted, fontStack,
    onSelect, onStartDrag, onStartResize, onStartRotate, onDoubleClick }) {
  if (!el.visible) return null;
  const H = Math.max(8, 10 / scale);
  const hBase = {
    position:"absolute", width:H, height:H,
    background:"#dc2626", border:`${2 / scale}px solid #fff`,
    borderRadius:2, boxSizing:"border-box", zIndex:2,
  };
  return (
    <div
      style={{
        position:"absolute",
        left:el.x * scale,
        top:el.y * scale,
        fontSize:el.fontSize * scale,
        fontWeight:el.fontWeight,
        color:el.color,
        opacity:el.opacity ?? 1,
        transform:`rotate(${el.rotation || 0}deg)`,
        transformOrigin:"top left",
        textAlign:el.align,
        fontFamily:fontStack,
        lineHeight:1.2,
        whiteSpace:"nowrap",
        cursor:el.locked ? "default" : selected ? "move" : "pointer",
        userSelect:"none",
        zIndex:selected ? 20 : 10,
        outline:selected ? `${2 / scale}px solid #dc2626` : "none",
        outlineOffset:`${3 / scale}px`,
        animation:highlighted ? "ttsv3-highlight 0.6s ease" : "none",
      }}
      onMouseDown={e => { if (el.locked) return; e.stopPropagation(); onStartDrag(e, el.id); }}
      onTouchStart={e => { if (el.locked) return; e.stopPropagation(); onStartDrag(e, el.id); }}
      onClick={e => { e.stopPropagation(); onSelect(el.id); }}
      onDoubleClick={() => !el.locked && onDoubleClick(el.id)}
    >
      {el.content}
      {selected && !el.locked && (
        <>
          {/* Rotate handle */}
          <div
            style={{
              position:"absolute", top:-(H * 2.8), left:"50%",
              transform:"translateX(-50%)",
              width:H, height:H, background:"#dc2626",
              border:`${2 / scale}px solid #fff`,
              borderRadius:"50%", cursor:"grab", zIndex:3,
            }}
            onMouseDown={e => { e.stopPropagation(); onStartRotate(e, el.id); }}
            onTouchStart={e => { e.stopPropagation(); onStartRotate(e, el.id); }}
          />
          <div style={{
            position:"absolute", top:-(H * 1.8), left:"50%",
            transform:"translateX(-50%)",
            width:1 / scale, height:H * 1.8,
            background:"rgba(220,38,38,0.5)",
          }} />
          {/* Corner resize handles */}
          {[
            { pos:"nw", s:{ top:-H/2,    left:-H/2,    cursor:"nw-resize" } },
            { pos:"ne", s:{ top:-H/2,    right:-H/2,   cursor:"ne-resize" } },
            { pos:"sw", s:{ bottom:-H/2, left:-H/2,    cursor:"sw-resize" } },
            { pos:"se", s:{ bottom:-H/2, right:-H/2,   cursor:"se-resize" } },
          ].map(({ pos, s }) => (
            <div key={pos} style={{ ...hBase, ...s }}
              onMouseDown={e => { e.stopPropagation(); onStartResize(e, el.id, pos); }}
              onTouchStart={e => { e.stopPropagation(); onStartResize(e, el.id, pos); }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── ElementToolbar ───────────────────────────────────────────────────────────
function ElementToolbar({ el, scale, canvasW, onUpdate, onDuplicate, onDelete }) {
  if (!el) return null;
  const left = Math.max(0, Math.min(el.x * scale, canvasW - 240));
  const top  = Math.max(4, el.y * scale - 46);
  return (
    <div style={{
      position:"absolute", top, left,
      display:"flex", alignItems:"center", gap:3, zIndex:50,
      background:"rgba(13,17,23,0.97)", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:8, padding:"3px 6px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.6)", pointerEvents:"all",
    }}>
      <label title="Color" style={{ display:"flex", cursor:"pointer" }}>
        <div style={{
          width:20, height:20, borderRadius:4, background:el.color,
          border:"1px solid rgba(255,255,255,0.2)",
          overflow:"hidden", position:"relative",
        }}>
          <input type="color" value={el.color} onChange={e => onUpdate({ color:e.target.value })}
            style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer", width:"100%", height:"100%" }} />
        </div>
      </label>
      <TBSep />
      <TBBtn title="Bold" active={el.fontWeight === "800" || el.fontWeight === "700"}
        onClick={() => onUpdate({ fontWeight:el.fontWeight === "800" ? "400" : "800" })}>
        <b style={{ fontSize:11 }}>B</b>
      </TBBtn>
      <TBBtn title="Align"
        onClick={() => onUpdate({ align:el.align==="left"?"center":el.align==="center"?"right":"left" })}>
        <span style={{ fontSize:9 }}>{el.align==="left"?"◀":el.align==="center"?"■":"▶"}</span>
      </TBBtn>
      <TBSep />
      <TBBtn title="Toggle visibility" onClick={() => onUpdate({ visible:!el.visible })}>
        <span style={{ fontSize:10 }}>{el.visible ? "👁" : "○"}</span>
      </TBBtn>
      <TBBtn title="Duplicate" onClick={onDuplicate}>
        <span style={{ fontSize:10 }}>⧉</span>
      </TBBtn>
      <TBBtn title="Delete" danger onClick={onDelete}>
        <span style={{ fontSize:10 }}>✕</span>
      </TBBtn>
    </div>
  );
}
function TBSep() {
  return <div style={{ width:1, height:16, background:"rgba(255,255,255,0.1)", margin:"0 2px" }} />;
}
function TBBtn({ children, onClick, active, danger, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width:24, height:24, border:"none", borderRadius:4, cursor:"pointer",
      background:active ? "rgba(220,38,38,0.25)" : danger ? "rgba(239,68,68,0.12)" : "transparent",
      color:danger ? "#f87171" : active ? "#dc2626" : "rgba(255,255,255,0.65)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>{children}</button>
  );
}

// ─── InlineEditor ─────────────────────────────────────────────────────────────
function InlineEditor({ el, scale, onCommit, onCancel }) {
  const [val, setVal] = useState(el.content);
  return (
    <div style={{
      position:"absolute", left:el.x * scale, top:el.y * scale, zIndex:60,
      transform:`rotate(${el.rotation || 0}deg)`, transformOrigin:"top left",
    }}>
      <textarea autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCommit(val); }
        }}
        onBlur={() => onCommit(val)}
        style={{
          fontSize:el.fontSize * scale, fontWeight:el.fontWeight,
          color:el.color, fontFamily:"inherit",
          background:"rgba(0,0,0,0.8)", border:"2px solid #dc2626",
          borderRadius:4, padding:4, outline:"none",
          resize:"both", minWidth:80, lineHeight:1.2,
        }} />
    </div>
  );
}

// ─── CanvasPreview ────────────────────────────────────────────────────────────
function CanvasPreview({ slide, theme, scale, fontStack, selectedId, highlightIds,
    aiLoading, onSelectElement, onDeselectAll, onStartDrag, onStartResize, onStartRotate,
    onDoubleClickElement, editingId, onCommitEdit, onCancelEdit,
    selectedEl, onUpdateSelected, onDuplicateSelected, onDeleteSelected, innerRef }) {
  const acc = theme.accentColor || "#dc2626";
  const W = CANVAS_W * scale, H = CANVAS_H * scale;
  return (
    <div ref={innerRef} onClick={onDeselectAll}
      style={{ position:"relative", width:W, height:H, overflow:"hidden", userSelect:"none", flexShrink:0 }}>
      {/* Background */}
      <div style={{ position:"absolute", inset:0, background:theme.bgColor || "#060910" }} />
      {/* Blurred bg + car image */}
      {slide.imageUrl && <>
        <img src={slide.imageUrl} alt="" style={{
          position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", filter:"blur(18px) brightness(0.4)",
          transform:"scale(1.06)", transformOrigin:"center",
        }} />
        <img src={slide.imageUrl} alt="" style={{
          position:"absolute", left:0, top:"50%",
          transform:"translateY(-50%)", width:"100%",
          objectFit:"contain", opacity:0.92, zIndex:1,
        }} />
      </>}
      {/* Gradient */}
      <div style={{
        position:"absolute", inset:0, zIndex:2,
        background:"linear-gradient(to bottom,rgba(6,9,16,0.95) 0%,rgba(6,9,16,0.08) 28%,rgba(6,9,16,0.05) 52%,rgba(6,9,16,0.82) 66%,rgba(6,9,16,1) 100%)",
      }} />
      {/* Accent bar */}
      {theme.showAccentBar !== false &&
        <div style={{ position:"absolute", top:0, left:0, right:0, height:6 * scale, background:acc, zIndex:5 }} />}
      {/* Badges */}
      {(theme.showConditionBadge || theme.showHotDealBadge || theme.customBadgeText) && (
        <div style={{ position:"absolute", top:CANVAS_H * 0.55 * scale, left:60 * scale, display:"flex", gap:12 * scale, zIndex:6 }}>
          {theme.showConditionBadge && slide.condition && (
            <div style={{ padding:`${8*scale}px ${16*scale}px`, borderRadius:6*scale, background:acc, color:"#fff", fontSize:22*scale, fontWeight:700 }}>
              {{ new:"Brand New", recon:"Recon", used:"Used" }[slide.condition] || slide.condition}
            </div>
          )}
          {theme.showHotDealBadge && (
            <div style={{ padding:`${8*scale}px ${16*scale}px`, borderRadius:6*scale, background:"#f59e0b", color:"#000", fontSize:22*scale, fontWeight:800 }}>🔥 HOT DEAL</div>
          )}
          {theme.customBadgeText && (
            <div style={{ padding:`${8*scale}px ${16*scale}px`, borderRadius:6*scale, background:theme.badgeColor || acc, color:"#fff", fontSize:22*scale, fontWeight:700 }}>
              {theme.customBadgeText}
            </div>
          )}
        </div>
      )}
      {/* Logo */}
      {theme.logoUrl && (
        <img src={theme.logoUrl} alt="" style={{
          position:"absolute", bottom:180*scale, right:60*scale,
          width:(theme.logoSize||80)*scale, height:(theme.logoSize||80)*scale,
          objectFit:"contain", opacity:0.8, zIndex:7,
        }} />
      )}
      {/* AI skeleton overlay */}
      {aiLoading && (
        <div style={{
          position:"absolute", inset:0, zIndex:40,
          background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{ textAlign:"center" }}>
            <div style={{
              width:36*scale, height:36*scale, margin:"0 auto 10px",
              border:`${3*scale}px solid rgba(220,38,38,0.3)`,
              borderTop:`${3*scale}px solid #dc2626`,
              borderRadius:"50%", animation:"ttsv3-spin 0.8s linear infinite",
            }} />
            <p style={{ color:"rgba(255,255,255,0.65)", fontSize:12*scale }}>AI is editing…</p>
          </div>
        </div>
      )}
      {/* Elements layer */}
      <div style={{ position:"absolute", inset:0, zIndex:10 }}>
        {(slide.elements || []).map(el => (
          <React.Fragment key={el.id}>
            {editingId === el.id
              ? <InlineEditor el={el} scale={scale}
                  onCommit={v => onCommitEdit(el.id, v)} onCancel={onCancelEdit} />
              : <CanvasElement el={el} scale={scale}
                  selected={selectedId === el.id}
                  highlighted={(highlightIds || []).includes(el.id)}
                  fontStack={fontStack}
                  onSelect={onSelectElement}
                  onStartDrag={onStartDrag}
                  onStartResize={onStartResize}
                  onStartRotate={onStartRotate}
                  onDoubleClick={onDoubleClickElement} />}
          </React.Fragment>
        ))}
      </div>
      {/* Floating toolbar */}
      {selectedEl && selectedId && !editingId && (
        <ElementToolbar el={selectedEl} scale={scale} canvasW={W}
          onUpdate={onUpdateSelected}
          onDuplicate={onDuplicateSelected}
          onDelete={onDeleteSelected} />
      )}
    </div>
  );
}

// ─── FilmThumb ────────────────────────────────────────────────────────────────
const FilmThumb = React.memo(function FilmThumb({ slide, idx, active, onSelect, onDelete }) {
  return (
    <div onClick={() => onSelect(idx)} style={{
      position:"relative", width:44, height:78, flexShrink:0,
      borderRadius:5, overflow:"hidden", cursor:"pointer", background:"#111827",
      border:`2px solid ${active ? "#dc2626" : "rgba(255,255,255,0.07)"}`,
      transition:"border-color 0.15s",
    }}>
      {slide.imageUrl && <img src={slide.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.65 }} />}
      <div style={{ position:"absolute", bottom:2, left:0, right:0, textAlign:"center", fontSize:8, color:"rgba(255,255,255,0.4)" }}>{idx+1}</div>
      {active && (
        <button onClick={e => { e.stopPropagation(); onDelete(idx); }}
          style={{
            position:"absolute", top:2, right:2, width:13, height:13,
            borderRadius:"50%", background:"rgba(239,68,68,0.9)", border:"none",
            color:"#fff", cursor:"pointer", fontSize:8, padding:0,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>✕</button>
      )}
    </div>
  );
});

// ─── ImagePicker ──────────────────────────────────────────────────────────────
function ImagePicker({ images, current, onSelect, onClose }) {
  return (
    <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.97)", zIndex:30, display:"flex", flexDirection:"column" }}>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.07)", flexShrink:0,
      }}>
        <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.1em" }}>
          Choose Photo · {images.length} available
        </span>
        <button onClick={onClose} style={{
          width:26, height:26, borderRadius:"50%",
          border:"1px solid rgba(255,255,255,0.12)",
          background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer",
        }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:10, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
        {images.map((url, i) => (
          <div key={i} onClick={() => { onSelect(url); onClose(); }} style={{
            position:"relative", aspectRatio:"4/3", borderRadius:8, overflow:"hidden",
            cursor:"pointer", border:current===url ? "2px solid #dc2626" : "2px solid transparent",
          }}>
            <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            {current === url && (
              <div style={{
                position:"absolute", inset:0, background:"rgba(220,38,38,0.25)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, color:"#fff",
              }}>✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
function ColorRow({ label, value, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontFamily:"monospace" }}>{value}</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width:30, height:30, border:"none", borderRadius:8, cursor:"pointer", padding:2, background:"transparent" }} />
      </div>
    </div>
  );
}
function SliderRow({ label, value, min, max, step=0.01, onChange, fmt }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{label}</span>
        <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:600 }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:"100%", accentColor:"#dc2626" }} />
    </div>
  );
}
function Toggle({ value, onChange, label }) {
  return (
    <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
      <div onClick={() => onChange(!value)} style={{
        width:36, height:20, borderRadius:999,
        background:value ? "#dc2626" : "rgba(255,255,255,0.08)",
        position:"relative", transition:"background 0.2s", flexShrink:0,
      }}>
        <div style={{
          position:"absolute", top:2, left:value ? 18 : 2,
          width:16, height:16, borderRadius:"50%",
          background:"#fff", transition:"left 0.2s",
        }} />
      </div>
      <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{label}</span>
    </label>
  );
}
function SectionHead({ label }) {
  return (
    <p style={{
      fontSize:9, fontWeight:700, letterSpacing:"0.13em", textTransform:"uppercase",
      color:"rgba(255,255,255,0.18)", margin:"18px 0 9px", paddingBottom:6,
      borderBottom:"1px solid rgba(255,255,255,0.05)",
    }}>{label}</p>
  );
}
function PInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{
        width:"100%", padding:"9px 12px",
        background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:10, color:"#fff", fontFamily:"'DM Sans',sans-serif",
        fontSize:12, outline:"none", boxSizing:"border-box",
      }}
      onFocus={e => e.target.style.borderColor = "rgba(220,38,38,0.45)"}
      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TikTokStudioV3({ listing, onClose }) {
  const [slides, setSlides]           = useState([]);
  const [active, setActive]           = useState(0);
  const [selectedId, setSelectedId]   = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [activeTab, setActiveTab]     = useState("slide");
  const [theme, setTheme]             = useState(DEFAULT_THEME);
  const [font, setFont]               = useState("dm");
  const [aiCmd, setAiCmd]             = useState("");
  const [applyingCmd, setApplyingCmd] = useState(false);
  const [aiUsage, setAiUsage]         = useState({ count:0, loaded:false });
  const [highlightIds, setHighlightIds] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [dlIdx, setDlIdx]             = useState(null);
  const [savedBrand, setSavedBrand]   = useState(false);
  const [genError, setGenError]       = useState(null);
  const [language, setLanguage]       = useState("en");
  const [hookText, setHookText]       = useState("");
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [scale, setScale]             = useState(0.3);
  const [isMobile, setIsMobile]       = useState(false);
  const [userId, setUserId]           = useState(null);
  const [cmdHistory, setCmdHistory]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("ttsv3_ai_history") || "[]"); } catch { return []; }
  });
  const [suggestions] = useState(() =>
    [...SUGGESTION_POOL].sort(() => Math.random() - 0.5).slice(0, 6));

  // Interaction state via refs (avoids re-render during drag)
  const dragging  = useRef(null);
  const resizing  = useRef(null);
  const rotating  = useRef(null);
  const canvasInnerRef = useRef(null);
  const aiInputRef     = useRef(null);

  // Derived
  const slide      = useMemo(() => slides[active] || null, [slides, active]);
  const total      = slides.length;
  const rawImages  = useMemo(() => {
    const p = parseList(listing?.photos || listing?.images);
    return p.length ? p : listing?.image_url ? [listing.image_url] : [];
  }, [listing]);
  const features   = useMemo(() => parseList(listing?.features || listing?.extras || listing?.accessories), [listing]);
  const fontObj    = useMemo(() => FONTS.find(f => f.id === font) || FONTS[0], [font]);
  const selectedEl = useMemo(() => slide?.elements?.find(e => e.id === selectedId) || null, [slide, selectedId]);
  const aiAtLimit  = aiUsage.count >= AI_LIMIT;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user } }) => {
      if (!user) return;
      setUserId(user.id);
      getAIUsage(user.id).then(count => setAiUsage({ count, loaded:true }));
      supabase.from("profiles")
        .select("brand_color,font_choice,watermark_text,logo_url")
        .eq("id", user.id).maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setTheme(t => ({
            ...t,
            ...(data.brand_color    ? { accentColor:data.brand_color }      : {}),
            ...(data.watermark_text ? { watermarkText:data.watermark_text } : {}),
            ...(data.logo_url       ? { logoUrl:data.logo_url }              : {}),
          }));
          if (data.font_choice) setFont(data.font_choice);
        });
    });
  }, []);

  useEffect(() => {
    if (slides.length) return;
    const dealerName = listing?.dealer_name || "";
    setSlides(buildDefaultSlides(listing, rawImages, features, dealerName, listing?.whatsapp_number || ""));
    ensureFont("dm");
  }, [listing, rawImages, features]);

  // ── Scale ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      setIsMobile(vw < 768);
      const sidePanels = vw < 768 ? 0 : 56 + 320 + 40;
      const maxW = Math.max(100, vw - sidePanels);
      const maxH = vh - 52 - 16;
      setScale(Math.min(maxW / CANVAS_W, maxH / CANVAS_H, 1));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const h = e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") { selectedId ? setSelectedId(null) : onClose(); }
      if (e.key === "ArrowLeft")  setActive(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActive(i => Math.min(total - 1, i + 1));
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) deleteSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedId) { e.preventDefault(); duplicateSelected(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, total, selectedId]);

  // ── Element helpers ──────────────────────────────────────────────────────
  const updateElement = useCallback((id, patch) => {
    setSlides(ss => ss.map((s, i) => i !== active ? s : {
      ...s, elements:s.elements.map(e => e.id === id ? { ...e, ...patch } : e),
    }));
  }, [active]);

  const updateSelectedElement = useCallback(patch => {
    if (selectedId) updateElement(selectedId, patch);
  }, [selectedId, updateElement]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setSlides(ss => ss.map((s, i) => i !== active ? s : {
      ...s, elements:s.elements.filter(e => e.id !== selectedId),
    }));
    setSelectedId(null);
  }, [selectedId, active]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId || !slide) return;
    const el = slide.elements.find(e => e.id === selectedId);
    if (!el) return;
    const dup = { ...el, id:uid(), x:el.x + 30, y:el.y + 30, locked:false };
    setSlides(ss => ss.map((s, i) => i !== active ? s : { ...s, elements:[...s.elements, dup] }));
    setSelectedId(dup.id);
  }, [selectedId, slide, active]);

  const addTextElement = useCallback(() => {
    const el = {
      id:uid(), type:"text", content:"New Text",
      x:200, y:600, fontSize:48, fontWeight:"700",
      color:"#ffffff", rotation:0, opacity:1,
      align:"left", visible:true, locked:false,
    };
    setSlides(ss => ss.map((s, i) => i !== active ? s : { ...s, elements:[...s.elements, el] }));
    setSelectedId(el.id);
  }, [active]);

  // ── Drag / Resize / Rotate via document events ───────────────────────────
  const onStartDrag = useCallback((e, id) => {
    if (id !== selectedId) { setSelectedId(id); return; }
    const el = slide?.elements?.find(el => el.id === id);
    if (!el) return;
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    dragging.current = { id, startX:cx, startY:cy, origX:el.x, origY:el.y };
    e.preventDefault();
  }, [selectedId, slide]);

  const onStartResize = useCallback((e, id, handle) => {
    const el = slide?.elements?.find(el => el.id === id);
    if (!el) return;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    resizing.current = { id, handle, startY:cy, origFontSize:el.fontSize };
    e.preventDefault(); e.stopPropagation();
  }, [slide]);

  const onStartRotate = useCallback((e, id) => {
    const el = slide?.elements?.find(el => el.id === id);
    if (!el || !canvasInnerRef.current) return;
    const rect = canvasInnerRef.current.getBoundingClientRect();
    const centerX = rect.left + el.x * scale;
    const centerY = rect.top  + el.y * scale;
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    rotating.current = {
      id, centerX, centerY,
      startAngle:Math.atan2(cy - centerY, cx - centerX) * (180 / Math.PI),
      origRotation:el.rotation || 0,
    };
    e.preventDefault(); e.stopPropagation();
  }, [slide, scale]);

  useEffect(() => {
    const onMove = e => {
      const cx = e.touches?.[0]?.clientX ?? e.clientX;
      const cy = e.touches?.[0]?.clientY ?? e.clientY;
      if (dragging.current) {
        const { id, startX, startY, origX, origY } = dragging.current;
        updateElement(id, {
          x:Math.max(0, Math.min(CANVAS_W, origX + (cx - startX) / scale)),
          y:Math.max(0, Math.min(CANVAS_H, origY + (cy - startY) / scale)),
        });
      }
      if (resizing.current) {
        const { id, startY, origFontSize } = resizing.current;
        updateElement(id, { fontSize:Math.round(Math.max(16, Math.min(200, origFontSize + (startY - cy) / scale * 0.5))) });
      }
      if (rotating.current) {
        const { id, centerX, centerY, startAngle, origRotation } = rotating.current;
        const angle = Math.atan2(cy - centerY, cx - centerX) * (180 / Math.PI);
        updateElement(id, { rotation:Math.round((origRotation + angle - startAngle + 360) % 360) });
      }
    };
    const onUp = () => { dragging.current = null; resizing.current = null; rotating.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive:false });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [scale, updateElement]);

  const onCommitEdit = useCallback((id, value) => {
    updateElement(id, { content:value }); setEditingId(null);
  }, [updateElement]);

  // ── AI command ───────────────────────────────────────────────────────────
  const runAICommand = useCallback(async () => {
    if (!aiCmd.trim() || applyingCmd || aiAtLimit) return;
    const cmd = aiCmd.trim();
    setApplyingCmd(true); setAiCmd(""); setGenError(null);
    try {
      if (userId) {
        const newCount = await incrementAIUsage(userId);
        setAiUsage(u => ({ ...u, count:newCount }));
      }
      const result = await applyAICommand(cmd, slide?.elements || [], theme, selectedId);
      if (result.elements?.length) {
        setSlides(ss => ss.map((s, i) => i !== active ? s : {
          ...s, elements:s.elements.map(el => {
            const changed = result.elements.find(c => c.id === el.id);
            return changed ? { ...el, ...changed } : el;
          }),
        }));
        const ids = result.elements.map(e => e.id);
        setHighlightIds(ids);
        setTimeout(() => setHighlightIds([]), 700);
      }
      if (result.theme) setTheme(t => ({ ...t, ...result.theme }));
      setCmdHistory(h => {
        const n = [cmd, ...h.filter(c => c !== cmd)].slice(0, 5);
        localStorage.setItem("ttsv3_ai_history", JSON.stringify(n));
        return n;
      });
    } catch {
      setGenError("AI command failed. Try again.");
      setTimeout(() => setGenError(null), 4000);
    }
    setApplyingCmd(false);
  }, [aiCmd, applyingCmd, aiAtLimit, userId, slide, theme, selectedId, active]);

  // ── Brand Kit save ───────────────────────────────────────────────────────
  const saveBranding = useCallback(async () => {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({
      brand_color:theme.accentColor, font_choice:font,
      watermark_text:theme.watermarkText, logo_url:theme.logoUrl,
    }).eq("id", user.id);
    setSavedBrand(true);
    setTimeout(() => setSavedBrand(false), 2500);
  }, [theme, font]);

  // ── Slide management ─────────────────────────────────────────────────────
  const patchSlide = useCallback(patch => {
    setSlides(ss => ss.map((s, i) => i === active ? { ...s, ...patch } : s));
  }, [active]);

  const addSlide = useCallback(() => {
    const s = {
      id:uid(), imageUrl:rawImages[0] || null, template:"hype",
      carName:`${listing?.brand||""} ${listing?.model||""}`.trim(),
      priceStr:listing?.selling_price ? "RM " + Number(listing.selling_price).toLocaleString() : "",
      priceNum:listing?.selling_price || 0, statsLine:"", hookText:"",
      features, condition:listing?.condition || "",
      dealerName:slide?.dealerName || "", whatsapp:slide?.whatsapp || "",
      monthly:calcMonthly(listing?.selling_price),
      elements:buildDefaultElements(listing, theme, slide?.dealerName || ""),
    };
    setSlides(ss => [...ss, s]);
    setTimeout(() => setActive(slides.length), 0);
  }, [slides.length, listing, rawImages, features, slide, theme]);

  const duplicateSlide = useCallback(() => {
    if (!slide) return;
    const dup = { ...slide, id:uid(), elements:slide.elements.map(e => ({ ...e, id:uid() })) };
    setSlides(ss => [...ss, dup]);
    setTimeout(() => setActive(slides.length), 0);
  }, [slide, slides.length]);

  const removeSlide = useCallback(idx => {
    if (total <= 1) return;
    setSlides(ss => ss.filter((_, i) => i !== idx));
    setActive(i => Math.min(i, total - 2));
    setSelectedId(null);
  }, [total]);

  // ── Export ───────────────────────────────────────────────────────────────
  const exportName = idx => {
    const d = (theme.watermarkText || listing?.dealer_name || "XDrive").replace(/\s+/g, "");
    const c = `${listing?.brand||""}${listing?.model||""}`.replace(/\s+/g, "");
    const dt = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${d}_${c}_${dt}_${String(idx + 1).padStart(2, "0")}.jpg`;
  };

  const toBlob = useCallback(async idx => {
    const c = document.createElement("canvas");
    c.width = CANVAS_W; c.height = CANVAS_H;
    await renderToCanvas(c, slides[idx], theme, font);
    return new Promise(res => c.toBlob(res, "image/jpeg", 0.93));
  }, [slides, theme, font]);

  const saveSingle = useCallback(async idx => {
    setDlIdx(idx);
    const blob = await toBlob(idx), url = URL.createObjectURL(blob);
    if (isIOS()) { window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    else {
      const a = document.createElement("a"); a.download = exportName(idx); a.href = url; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setDlIdx(null);
  }, [toBlob]);

  const saveAll = useCallback(async () => {
    setDownloading(true);
    if (isIOS()) {
      for (let i = 0; i < total; i++) {
        const blob = await toBlob(i), url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        await new Promise(r => setTimeout(r, 600));
      }
      setDownloading(false); return;
    }
    const JSZip = await loadJSZip(), zip = new JSZip();
    for (let i = 0; i < total; i++) zip.file(exportName(i), await toBlob(i));
    const out = await zip.generateAsync({ type:"blob" });
    const url = URL.createObjectURL(out);
    const d = (theme.watermarkText||"XDrive").replace(/\s+/g,"");
    const c = `${listing?.brand||""}${listing?.model||""}`.replace(/\s+/g,"");
    const dt = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const a = document.createElement("a"); a.download = `${d}_${c}_${dt}.zip`; a.href = url; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setDownloading(false);
  }, [total, toBlob, theme, listing]);

  if (!slide) return null;

  // ── Tab panels ────────────────────────────────────────────────────────────
  const SlidePanel = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <SectionHead label="Image" />
      <button onClick={() => setShowImagePicker(true)} style={{
        width:"100%", padding:"9px 0", borderRadius:10,
        border:"1px dashed rgba(255,255,255,0.14)", background:"transparent",
        color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:12,
      }}>📷 Change photo</button>
      <SectionHead label="Template" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
        {SLIDE_TEMPLATES.map(t => (
          <button key={t.id} onClick={() => patchSlide({ template:t.id })} style={{
            padding:"7px 4px", borderRadius:8, cursor:"pointer",
            border:`1px solid ${slide.template===t.id?"rgba(220,38,38,0.5)":"rgba(255,255,255,0.07)"}`,
            background:slide.template===t.id?"rgba(220,38,38,0.1)":"transparent",
            color:slide.template===t.id?"#dc2626":"rgba(255,255,255,0.45)",
            display:"flex", flexDirection:"column", alignItems:"center", gap:2,
          }}>
            <span style={{ fontSize:14 }}>{t.icon}</span>
            <span style={{ fontSize:9 }}>{t.label}</span>
          </button>
        ))}
      </div>
      <SectionHead label="Elements" />
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {slide.elements.map(el => (
          <div key={el.id} onClick={() => setSelectedId(el.id)} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"7px 10px", borderRadius:8, cursor:"pointer",
            background:selectedId===el.id?"rgba(220,38,38,0.08)":"rgba(255,255,255,0.025)",
            border:`1px solid ${selectedId===el.id?"rgba(220,38,38,0.28)":"rgba(255,255,255,0.05)"}`,
          }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.65)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {el.content || "(empty)"}
            </span>
            <div style={{ display:"flex", gap:5, flexShrink:0 }}>
              <button onClick={e => { e.stopPropagation(); updateElement(el.id, { visible:!el.visible }); }}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:el.visible?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.2)" }}>
                {el.visible ? "👁" : "○"}
              </button>
              <button onClick={e => { e.stopPropagation(); updateElement(el.id, { locked:!el.locked }); }}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:el.locked?"#dc2626":"rgba(255,255,255,0.25)" }}>
                {el.locked ? "🔒" : "🔓"}
              </button>
            </div>
          </div>
        ))}
        <button onClick={addTextElement} style={{
          padding:"8px 0", borderRadius:8, border:"1px dashed rgba(255,255,255,0.1)",
          background:"transparent", color:"rgba(255,255,255,0.28)", cursor:"pointer", fontSize:11,
        }}>+ Add text element</button>
      </div>
    </div>
  );

  const DesignPanel = () => (
    <div>
      <SectionHead label="Style Preset" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:14 }}>
        {STYLE_PRESETS.map(p => (
          <button key={p.id} onClick={() => setTheme(t => ({ ...t, ...p.theme }))} style={{
            padding:"7px 6px", borderRadius:8, cursor:"pointer",
            border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.03)",
            display:"flex", alignItems:"center", gap:5,
          }}>
            <div style={{ display:"flex", gap:3 }}>
              {p.dots.map((c, i) => <div key={i} style={{ width:11, height:11, borderRadius:"50%", background:c }} />)}
            </div>
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.45)" }}>{p.label}</span>
          </button>
        ))}
      </div>
      <SectionHead label="Colors" />
      <ColorRow label="Accent"     value={theme.accentColor} onChange={v => setTheme(t => ({ ...t, accentColor:v }))} />
      <ColorRow label="Background" value={theme.bgColor}     onChange={v => setTheme(t => ({ ...t, bgColor:v }))} />
      <SectionHead label="Font" />
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {FONTS.map(f => (
          <button key={f.id} onClick={() => { setFont(f.id); ensureFont(f.id); }} style={{
            padding:"8px 12px", borderRadius:8, textAlign:"left", cursor:"pointer",
            border:`1px solid ${font===f.id?"rgba(220,38,38,0.45)":"rgba(255,255,255,0.06)"}`,
            background:font===f.id?"rgba(220,38,38,0.07)":"transparent",
            color:"rgba(255,255,255,0.7)", fontFamily:f.stack, fontSize:13,
          }}>{f.label}</button>
        ))}
      </div>
      <SectionHead label="Overlay" />
      <SliderRow label="Opacity" value={theme.overlayOpacity} min={0} max={1} step={0.01}
        onChange={v => setTheme(t => ({ ...t, overlayOpacity:v }))} fmt={v => `${Math.round(v*100)}%`} />
      <SectionHead label="Options" />
      <Toggle value={theme.showAccentBar !== false}
        onChange={v => setTheme(t => ({ ...t, showAccentBar:v }))} label="Top accent bar" />
    </div>
  );

  const BrandPanel = () => (
    <div>
      <SectionHead label="Watermark" />
      <PInput value={theme.watermarkText} placeholder="Your brand name"
        onChange={e => setTheme(t => ({ ...t, watermarkText:e.target.value }))} />
      <div style={{ display:"flex", gap:5, marginTop:7 }}>
        {["top-right","top-left","bottom-right","bottom-left"].map(p => (
          <button key={p} onClick={() => setTheme(t => ({ ...t, watermarkPos:p }))} style={{
            flex:1, padding:"5px 2px", borderRadius:6, cursor:"pointer", fontSize:8,
            border:`1px solid ${theme.watermarkPos===p?"rgba(220,38,38,0.4)":"rgba(255,255,255,0.08)"}`,
            background:theme.watermarkPos===p?"rgba(220,38,38,0.08)":"transparent",
            color:"rgba(255,255,255,0.4)",
          }}>{p.replace("-", "\n")}</button>
        ))}
      </div>
      <div style={{ marginTop:10 }}>
        <SliderRow label="Watermark opacity" value={theme.watermarkOpacity} min={0} max={1} step={0.01}
          onChange={v => setTheme(t => ({ ...t, watermarkOpacity:v }))} fmt={v => `${Math.round(v*100)}%`} />
      </div>
      <SectionHead label="Logo" />
      <PInput value={theme.logoUrl || ""} placeholder="Logo image URL"
        onChange={e => setTheme(t => ({ ...t, logoUrl:e.target.value || null }))} />
      {theme.logoUrl && (
        <div style={{ marginTop:10 }}>
          <SliderRow label="Logo size" value={theme.logoSize||80} min={40} max={200} step={4}
            onChange={v => setTheme(t => ({ ...t, logoSize:v }))} fmt={v => `${v}px`} />
        </div>
      )}
      <button onClick={saveBranding} style={{
        width:"100%", padding:"11px 0", marginTop:12, borderRadius:10, border:"none",
        background:savedBrand?"rgba(34,197,94,0.85)":"rgba(220,38,38,0.85)",
        color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, transition:"background 0.3s",
      }}>{savedBrand ? "✓ Saved!" : "Save Brand Kit"}</button>
    </div>
  );

  const BadgesPanel = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionHead label="Badges" />
      <Toggle value={theme.showConditionBadge}
        onChange={v => setTheme(t => ({ ...t, showConditionBadge:v }))}
        label={`Condition (${({ new:"Brand New", recon:"Recon", used:"Used" })[listing?.condition||""] || "N/A"})`} />
      <Toggle value={theme.showHotDealBadge}
        onChange={v => setTheme(t => ({ ...t, showHotDealBadge:v }))} label="🔥 Hot Deal badge" />
      <SectionHead label="Custom badge" />
      <PInput value={theme.customBadgeText} placeholder="Badge text (empty = hidden)"
        onChange={e => setTheme(t => ({ ...t, customBadgeText:e.target.value }))} />
      <ColorRow label="Badge color" value={theme.badgeColor||"#dc2626"}
        onChange={v => setTheme(t => ({ ...t, badgeColor:v }))} />
    </div>
  );

  const aiPct  = Math.round((aiUsage.count / AI_LIMIT) * 100);
  const aiNear = aiUsage.count >= 90;

  const AIPanel = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Usage meter */}
      <div style={{ background:"rgba(220,38,38,0.05)", border:"1px solid rgba(220,38,38,0.15)", borderRadius:12, padding:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#dc2626", textTransform:"uppercase", letterSpacing:"0.06em" }}>✦ AI Canvas Edit</span>
          <span style={{ fontSize:11, color:aiNear?"#f97316":"rgba(255,255,255,0.35)" }}>
            {aiUsage.loaded ? `${aiUsage.count}/${AI_LIMIT} today` : "…"}
          </span>
        </div>
        <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
          <div style={{
            height:"100%", width:`${Math.min(100, aiPct)}%`, borderRadius:2,
            background:aiAtLimit?"#ef4444":aiNear?"#f97316":"#dc2626",
            transition:"width 0.3s",
          }} />
        </div>
        {aiNear && !aiAtLimit && <p style={{ fontSize:10, color:"#f97316", marginTop:5 }}>Almost at daily limit</p>}
        {aiAtLimit && <p style={{ fontSize:10, color:"#ef4444", marginTop:5 }}>Daily limit reached. Resets tomorrow.</p>}
      </div>
      {/* Command input */}
      <div style={{ display:"flex", gap:6 }}>
        <input ref={aiInputRef} value={aiCmd} onChange={e => setAiCmd(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runAICommand()} disabled={aiAtLimit}
          placeholder="e.g. make price bigger, red accent…"
          style={{
            flex:1, padding:"10px 13px", background:"rgba(0,0,0,0.3)",
            border:"1px solid rgba(220,38,38,0.22)", borderRadius:9, color:"#fff",
            fontFamily:"'DM Sans',sans-serif", fontSize:12, outline:"none",
            opacity:aiAtLimit ? 0.4 : 1,
          }} />
        <button onClick={runAICommand} disabled={applyingCmd||!aiCmd.trim()||aiAtLimit} style={{
          padding:"10px 14px", borderRadius:9, border:"none",
          background:applyingCmd?"rgba(220,38,38,0.45)":"#dc2626",
          color:"#fff", cursor:applyingCmd||aiAtLimit?"default":"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          {applyingCmd
            ? <div style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"ttsv3-spin 0.8s linear infinite" }} />
            : "⚡"}
        </button>
      </div>
      {genError && <p style={{ fontSize:11, color:"#f87171" }}>{genError}</p>}
      {/* Suggestion chips */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => { setAiCmd(s); setTimeout(() => aiInputRef.current?.focus(), 0); }} style={{
            padding:"4px 9px", borderRadius:999, border:"1px solid rgba(220,38,38,0.2)",
            background:"transparent", color:"rgba(220,38,38,0.65)",
            fontSize:9, fontWeight:700, cursor:"pointer",
            fontFamily:"inherit", textTransform:"uppercase", letterSpacing:"0.06em",
          }}>{s}</button>
        ))}
      </div>
      {/* Command history */}
      {cmdHistory.length > 0 && (
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:8 }}>
          <p style={{ fontSize:9, color:"rgba(255,255,255,0.2)", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.08em" }}>Recent</p>
          {cmdHistory.map((c, i) => (
            <button key={i} onClick={() => setAiCmd(c)} style={{
              display:"block", width:"100%", textAlign:"left", padding:"5px 0",
              background:"none", border:"none", color:"rgba(255,255,255,0.32)",
              fontSize:11, cursor:"pointer", fontFamily:"inherit",
              borderBottom:i<cmdHistory.length-1?"1px solid rgba(255,255,255,0.04)":"none",
            }}>↺ {c}</button>
          ))}
        </div>
      )}
      {/* Generate slide copy */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:14 }}>
        <SectionHead label="Generate slide text" />
        <div style={{ display:"flex", gap:6, marginBottom:8 }}>
          {["en","bm"].map(l => (
            <button key={l} onClick={() => setLanguage(l)} style={{
              flex:1, padding:"6px 0", borderRadius:8, cursor:"pointer", fontSize:11, fontWeight:600,
              border:`1px solid ${language===l?"rgba(220,38,38,0.4)":"rgba(255,255,255,0.07)"}`,
              background:language===l?"rgba(220,38,38,0.1)":"transparent",
              color:language===l?"#dc2626":"rgba(255,255,255,0.35)",
            }}>{l === "en" ? "English" : "Bahasa M"}</button>
          ))}
        </div>
        <PInput value={hookText} placeholder="Your hook idea (optional)"
          onChange={e => setHookText(e.target.value)} />
        <button onClick={async () => {
          setApplyingCmd(true);
          try {
            const res = await generateSlidesCopy(listing, total, language, hookText);
            if (Array.isArray(res)) {
              setSlides(ss => ss.map((s, i) => {
                const d = res[i]; if (!d) return s;
                return {
                  ...s, elements:s.elements.map(el =>
                    el.id === "hook"     ? { ...el, content:d.hookText  || el.content } :
                    el.id === "headline" ? { ...el, content:d.headline  || el.content } : el
                  ),
                };
              }));
            }
          } catch { setGenError("Generation failed."); }
          setApplyingCmd(false);
        }} style={{
          width:"100%", padding:"10px 0", marginTop:8, borderRadius:9, border:"none",
          background:"rgba(220,38,38,0.75)", color:"#fff", fontWeight:700,
          cursor:applyingCmd?"wait":"pointer", fontSize:12,
        }}>{applyingCmd ? "Generating…" : "Generate All Slides"}</button>
      </div>
    </div>
  );

  // ── Tab bar + routing ────────────────────────────────────────────────────
  const TABS = [
    { id:"slide",  label:"Slide"  },
    { id:"design", label:"Design" },
    { id:"brand",  label:"Brand"  },
    { id:"badges", label:"Badges" },
    { id:"ai",     label:"✦ AI"  },
  ];
  const renderTab = () => {
    if (activeTab === "slide")  return <SlidePanel />;
    if (activeTab === "design") return <DesignPanel />;
    if (activeTab === "brand")  return <BrandPanel />;
    if (activeTab === "badges") return <BadgesPanel />;
    if (activeTab === "ai")     return <AIPanel />;
  };
  const tabBar = (
    <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
          flex:1, padding:"10px 4px", border:"none", fontFamily:"'DM Sans',sans-serif",
          borderBottom:`2px solid ${activeTab===t.id?"#dc2626":"transparent"}`,
          background:"transparent",
          color:activeTab===t.id?"#dc2626":"rgba(255,255,255,0.32)",
          cursor:"pointer", fontSize:11, fontWeight:600, transition:"all 0.15s",
        }}>{t.label}</button>
      ))}
    </div>
  );

  // Shared props for CanvasPreview
  const previewProps = {
    slide, theme, fontStack:fontObj.stack,
    selectedId, highlightIds, aiLoading:applyingCmd,
    onSelectElement:id => { setSelectedId(id); setEditingId(null); },
    onDeselectAll:() => { setSelectedId(null); setEditingId(null); },
    onStartDrag, onStartResize, onStartRotate,
    onDoubleClickElement:id => setEditingId(id),
    editingId, onCommitEdit, onCancelEdit:() => setEditingId(null),
    selectedEl, onUpdateSelected:updateSelectedElement,
    onDuplicateSelected:duplicateSelected,
    onDeleteSelected:deleteSelected,
    innerRef:canvasInnerRef,
  };

  // ── Mobile layout ────────────────────────────────────────────────────────
  if (isMobile) {
    const mobScale = (window.innerWidth * 0.5) / CANVAS_W;
    return (
      <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#080C14", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ height:46, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:"0.05em", color:"#fff" }}>TT STUDIO V3</span>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={saveAll} disabled={downloading} style={{ padding:"5px 12px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:700 }}>
              {downloading ? "…" : "Export"}
            </button>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer" }}>✕</button>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 10px", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <CanvasPreview {...previewProps} scale={mobScale} />
            {active > 0 && <button onClick={() => setActive(i => i-1)} style={{ position:"absolute", left:-10, top:"50%", transform:"translateY(-50%)", width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"#fff", cursor:"pointer" }}>‹</button>}
            {active < total-1 && <button onClick={() => setActive(i => i+1)} style={{ position:"absolute", right:-10, top:"50%", transform:"translateY(-50%)", width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", color:"#fff", cursor:"pointer" }}>›</button>}
          </div>
          <div style={{ flex:1, overflowX:"auto", display:"flex", gap:5, alignItems:"center" }}>
            {slides.map((s, i) => (
              <FilmThumb key={s.id} slide={s} idx={i} active={i===active}
                onSelect={i => { setActive(i); setSelectedId(null); }} onDelete={removeSlide} />
            ))}
            <button onClick={addSlide} style={{ width:36, height:64, flexShrink:0, borderRadius:6, border:"1px dashed rgba(255,255,255,0.14)", background:"transparent", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:18 }}>+</button>
          </div>
        </div>
        {tabBar}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>{renderTab()}</div>
        {activeTab !== "ai" && (
          <div style={{ padding:"8px 12px", borderTop:"1px solid rgba(255,255,255,0.06)", background:"rgba(8,12,20,0.97)", display:"flex", gap:6, flexShrink:0 }}>
            <input value={aiCmd} onChange={e => setAiCmd(e.target.value)}
              onKeyDown={e => e.key==="Enter"&&runAICommand()} disabled={aiAtLimit}
              placeholder="AI edit…"
              style={{ flex:1, padding:"8px 12px", background:"rgba(0,0,0,0.4)", border:"1px solid rgba(220,38,38,0.18)", borderRadius:8, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:12, outline:"none" }} />
            <button onClick={runAICommand} disabled={applyingCmd||!aiCmd.trim()||aiAtLimit}
              style={{ padding:"8px 12px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>
              {applyingCmd ? "…" : "⚡"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#080C14", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ height:52, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:"0.05em", color:"#fff" }}>TIKTOK STUDIO</span>
          <span style={{ fontSize:9, background:"#dc2626", color:"#fff", padding:"2px 6px", borderRadius:999, fontWeight:700 }}>V3</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => saveSingle(active)} disabled={dlIdx===active} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(255,255,255,0.65)", cursor:"pointer", fontSize:12 }}>
            ↓ Save slide
          </button>
          <button onClick={saveAll} disabled={downloading} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", cursor:downloading?"wait":"pointer", fontSize:12, fontWeight:700 }}>
            {downloading ? "Exporting…" : "Export all"}
          </button>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer", fontSize:16 }}>✕</button>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* Film strip */}
        <div style={{ width:56, background:"rgba(0,0,0,0.25)", borderRight:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0", gap:6, overflowY:"auto", flexShrink:0 }}>
          {slides.map((s, i) => (
            <FilmThumb key={s.id} slide={s} idx={i} active={i===active}
              onSelect={i => { setActive(i); setSelectedId(null); }}
              onDelete={removeSlide} />
          ))}
          <button onClick={addSlide} style={{ width:40, height:40, marginTop:4, borderRadius:8, border:"1px dashed rgba(255,255,255,0.14)", background:"transparent", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
        </div>

        {/* Canvas area */}
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
          {showImagePicker ? (
            <div style={{ position:"relative", width:CANVAS_W*scale, height:CANVAS_H*scale }}>
              <ImagePicker images={rawImages} current={slide.imageUrl}
                onSelect={url => patchSlide({ imageUrl:url })}
                onClose={() => setShowImagePicker(false)} />
            </div>
          ) : (
            <CanvasPreview {...previewProps} scale={scale} />
          )}
        </div>

        {/* Right panel */}
        <div style={{ width:320, background:"#0d1117", borderLeft:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
          {tabBar}
          <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>{renderTab()}</div>
        </div>
      </div>
    </div>
  );
}
