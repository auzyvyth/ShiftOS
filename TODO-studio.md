# TikTok Studio — Fix Backlog

## 1. Image contain — car must fit inside every aspect ratio frame
**Status:** DONE  
- [x] renderBackground(): contain logic in place (dw/dh centered)
- [x] Hard canvas clip added at top of renderBackground (ctx.beginPath/rect/clip) so blurred
      background can never bleed outside the frame boundary

## 2. Corner radius — px not %
**Status:** DONE  
- [x] LayerDiv CSS: `borderRadius` changed from `${v}%` → `${v}px`
- [x] Konva Rect: `cornerRadius` changed from `(v/100)*min(lw,lh)` → `v * scale`
- [x] Both sliders: max 50→100, fmt label `%` → `px`
- [x] Badge element (CanvasElement HTML): `borderRadius: 999` → `(el.borderRadius ?? 999) * scale`
- [x] Badge element (canvas export): roundRect radius `bh/2` → `el.borderRadius ?? bh/2`

## 3. Properties parity — pre-applied texts get same controls as user-added shapes
**Status:** DONE  
- [x] ElPropsPanel: font family selector added (falls back to template default)
- [x] ElPropsPanel: background fill + clear button for text elements
- [x] ElPropsPanel: corner radius slider (0–999px) for badge elements
- [x] CanvasElement HTML: uses el.fontFamily when set (badge + text)
- [x] CanvasElement HTML (text): shows bgColor background with padding + borderRadius
- [x] renderToCanvas badge export: uses el.fontFamily, el.borderRadius
- [x] renderToCanvas text export: uses el.fontFamily, draws bgColor rect behind text
