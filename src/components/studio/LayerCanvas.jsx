/**
 * LayerCanvas — Canva-style layer editor overlay for TikTok Studio V3
 * v2: fixed drag (useRef + document listeners), touch + pinch, filters,
 *     overflow:hidden containment, light-chrome UI.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, Copy,
  Square, Circle, Triangle, ImagePlus,
  Undo2, Redo2, MoveUp, MoveDown, RotateCcw,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────────
const HANDLE_SIZE = 9;
const ROTATE_OFFSET = 22;
const SNAP_THRESHOLD = 2;       // % of dimension
const ROTATION_SNAP = 15;       // degrees

const FILTER_DEFAULTS = {
  brightness: 100, contrast: 100, saturation: 100,
  blur: 0, opacity: 100, hue: 0, sepia: 0, preset: null,
};

const FILTER_PRESETS = {
  moody: { brightness: 85,  contrast: 110, saturation: 75,  hue: 0,   sepia: 0  },
  vivid: { brightness: 110, contrast: 120, saturation: 140, hue: 0,   sepia: 0  },
  faded: { brightness: 110, contrast: 85,  saturation: 70,  hue: 0,   sepia: 15 },
  bw:    { brightness: 100, contrast: 110, saturation: 0,   hue: 0,   sepia: 0  },
  warm:  { brightness: 105, contrast: 100, saturation: 110, hue: 15,  sepia: 10 },
  cool:  { brightness: 100, contrast: 105, saturation: 90,  hue: 200, sepia: 0  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function deg2rad(d) { return (d * Math.PI) / 180; }
function hexToRgba(hex, opacity) {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${(opacity ?? 100) / 100})`;
}
function getAngle(cx, cy, ex, ey) {
  return Math.atan2(ey - cy, ex - cx) * (180 / Math.PI) + 90;
}
function buildFilterStr(f = {}) {
  const ff = { ...FILTER_DEFAULTS, ...f };
  return `brightness(${ff.brightness}%) contrast(${ff.contrast}%) saturate(${ff.saturation}%) blur(${ff.blur}px) hue-rotate(${ff.hue}deg) sepia(${ff.sepia}%)`;
}

// ─── Layer shape renderer (CSS-based) ─────────────────────────────────────────
function LayerDiv({ layer, isSelected, onMouseDown, onTouchStart }) {
  const f = { ...FILTER_DEFAULTS, ...layer.filters };
  const filterStr = buildFilterStr(f);

  const borderStyle = {
    borderWidth: layer.borderWidth || 0,
    borderStyle: layer.borderStyle || 'solid',
    borderColor: hexToRgba(layer.borderColor || '#ffffff', layer.borderOpacity ?? 100),
    borderRadius: layer.type === 'circle' ? '50%'
      : layer.type === 'image' ? `${layer.borderRadius || 0}%`
      : `${layer.borderRadius || 0}%`,
  };

  const base = {
    position: 'absolute',
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.width}%`,
    height: `${layer.height}%`,
    transform: `rotate(${layer.rotation || 0}deg)`,
    transformOrigin: 'center center',
    filter: filterStr,
    opacity: f.opacity / 100,
    mixBlendMode: layer.blendMode || 'normal',
    pointerEvents: layer.locked ? 'none' : 'auto',
    cursor: 'move',
    zIndex: (layer.zIndex ?? 0) + 1,
    boxSizing: 'border-box',
    userSelect: 'none',
    visibility: layer.visible === false ? 'hidden' : 'visible',
    touchAction: 'none',
  };

  if (layer.type === 'image') {
    return (
      <div style={base} onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
        {layer.src ? (
          <img src={layer.src} alt="" draggable={false} style={{
            width: '100%', height: '100%', objectFit: layer.objectFit || 'cover',
            ...borderStyle, pointerEvents: 'none', display: 'block',
          }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.08)', ...borderStyle }}>
            <ImagePlus size={24} style={{ opacity: 0.35 }} />
          </div>
        )}
      </div>
    );
  }

  if (layer.type === 'triangle') {
    return (
      <div style={{
        ...base,
        background: hexToRgba(layer.fill || '#f59e0b', layer.fillOpacity ?? 100),
        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
        ...borderStyle,
      }} onMouseDown={onMouseDown} onTouchStart={onTouchStart} />
    );
  }

  return (
    <div style={{
      ...base,
      background: hexToRgba(layer.fill || '#e63946', layer.fillOpacity ?? 100),
      ...borderStyle,
    }} onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
      {layer.text && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: layer.textAlign || 'center',
          padding: '4px 6px', fontSize: layer.fontSize || 24,
          fontWeight: layer.fontWeight || 'bold',
          color: layer.textColor || '#ffffff', overflow: 'hidden',
          pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{layer.text}</div>
      )}
    </div>
  );
}

// ─── Selection overlay ─────────────────────────────────────────────────────────
const HANDLES = ['nw','n','ne','e','se','s','sw','w'];
const CURSOR  = { nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',
                   se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize' };

function SelectionBox({ layer, containerW, containerH, onHandleMouseDown, onHandleTouchStart,
                        onRotateMouseDown, onRotateTouchStart, onDelete }) {
  const hs = HANDLE_SIZE;
  const x = (layer.x / 100) * containerW;
  const y = (layer.y / 100) * containerH;
  const w = (layer.width / 100) * containerW;
  const h = (layer.height / 100) * containerH;

  const handlePos = {
    nw:[-hs/2,-hs/2], n:[w/2-hs/2,-hs/2], ne:[w-hs/2,-hs/2], e:[w-hs/2,h/2-hs/2],
    se:[w-hs/2,h-hs/2], s:[w/2-hs/2,h-hs/2], sw:[-hs/2,h-hs/2], w:[-hs/2,h/2-hs/2],
  };

  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      transform: `rotate(${layer.rotation || 0}deg)`, transformOrigin: 'center center',
      pointerEvents: 'none', zIndex: 50,
    }}>
      <div style={{ position: 'absolute', inset: 0, border: '1.5px solid #3b82f6',
        pointerEvents: 'none', boxSizing: 'border-box' }} />

      {HANDLES.map(hk => (
        <div key={hk}
          onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, hk); }}
          onTouchStart={e => { e.stopPropagation(); onHandleTouchStart(e, hk); }}
          style={{
            position: 'absolute', left: handlePos[hk][0], top: handlePos[hk][1],
            width: hs, height: hs, background: '#fff', border: '1.5px solid #3b82f6',
            borderRadius: 2, cursor: CURSOR[hk], pointerEvents: 'auto', zIndex: 51,
            touchAction: 'none',
          }} />
      ))}

      {/* Rotate handle */}
      <div
        onMouseDown={e => { e.stopPropagation(); onRotateMouseDown(e); }}
        onTouchStart={e => { e.stopPropagation(); onRotateTouchStart(e); }}
        style={{
          position: 'absolute', left: w/2-hs/2, top: -ROTATE_OFFSET-hs/2,
          width: hs, height: hs, background: '#3b82f6', borderRadius: '50%',
          cursor: 'crosshair', pointerEvents: 'auto', zIndex: 51, touchAction: 'none',
        }} title="Rotate" />
      <div style={{
        position: 'absolute', left: w/2-0.5, top: -ROTATE_OFFSET,
        width: 1, height: ROTATE_OFFSET, background: 'rgba(59,130,246,0.5)',
        pointerEvents: 'none',
      }} />

      {/* Delete */}
      <div
        onMouseDown={e => { e.stopPropagation(); onDelete(); }}
        style={{
          position: 'absolute', right: -10, top: -10, width: 18, height: 18,
          background: '#ef4444', borderRadius: '50%', cursor: 'pointer',
          pointerEvents: 'auto', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 51, touchAction: 'none',
        }}>
        <Trash2 size={9} color="#fff" />
      </div>
    </div>
  );
}

// ─── Snap guides ───────────────────────────────────────────────────────────────
function SnapGuides({ snapH, snapV, w, h }) {
  return (
    <>
      {snapH && <div style={{ position:'absolute', left:0, top:'50%', width:'100%', height:1,
        background:'#3b82f6', opacity:0.8, pointerEvents:'none', zIndex:60, transform:'translateY(-50%)' }} />}
      {snapV && <div style={{ position:'absolute', left:'50%', top:0, width:1, height:'100%',
        background:'#3b82f6', opacity:0.8, pointerEvents:'none', zIndex:60, transform:'translateX(-50%)' }} />}
    </>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text, x, y }) {
  if (!text) return null;
  return (
    <div style={{
      position: 'absolute', left: x + 12, top: y + 12,
      background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 10,
      padding: '3px 7px', borderRadius: 4, pointerEvents: 'none',
      zIndex: 70, whiteSpace: 'nowrap',
    }}>{text}</div>
  );
}

// ─── LayerCanvas (default export) ─────────────────────────────────────────────
export default function LayerCanvas({
  layers = [], selectedIds = [], scale = 1, canvasW, canvasH,
  onSelectLayer, onClearSelection, onUpdateLayer, onCommitHistory, onDeleteLayer,
}) {
  const containerRef = useRef(null);
  const dragRef      = useRef(null);   // { type:'drag'|'resize'|'rotate', id, ... }
  const pinchRef     = useRef(null);   // { id, startDist, origW, origH }

  const [snapH, setSnapH]           = useState(false);
  const [snapV, setSnapV]           = useState(false);
  const [tooltip, setTooltip]       = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const cW = (canvasW || 1080) * scale;
  const cH = (canvasH || 1920) * scale;

  const getRect = () => containerRef.current?.getBoundingClientRect() || { left:0,top:0,width:1,height:1 };

  // ── Mouse drag logic ──────────────────────────────────────────────────────
  const handleDragStart = (e, layerId) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.locked) return;
    const rect = getRect();
    dragRef.current = {
      type: 'drag', id: layerId,
      startX: e.clientX, startY: e.clientY,
      origX: layer.x, origY: layer.y,
      layerW: layer.width, layerH: layer.height,
    };
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleResizeStart = (e, layerId, handle) => {
    e.preventDefault();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const rect = getRect();
    dragRef.current = {
      type: 'resize', id: layerId, handle,
      startX: e.clientX, startY: e.clientY,
      origX: layer.x, origY: layer.y,
      origW: layer.width, origH: layer.height,
    };
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleRotateStart = (e, layerId) => {
    e.preventDefault();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const rect = getRect();
    const cx = rect.left + ((layer.x + layer.width / 2) / 100) * cW;
    const cy = rect.top  + ((layer.y + layer.height / 2) / 100) * cH;
    dragRef.current = {
      type: 'rotate', id: layerId,
      centerX: cx, centerY: cy,
      origRotation: layer.rotation || 0,
      startAngle: getAngle(cx, cy, e.clientX, e.clientY),
    };
  };

  const applyMove = useCallback((clientX, clientY) => {
    const ia = dragRef.current;
    if (!ia) return;
    const rect = getRect();
    setTooltipPos({ x: clientX - rect.left, y: clientY - rect.top });

    if (ia.type === 'drag') {
      const dx = ((clientX - ia.startX) / cW) * 100;
      const dy = ((clientY - ia.startY) / cH) * 100;
      let nx = clamp(ia.origX + dx, 0, 100 - ia.layerW);
      let ny = clamp(ia.origY + dy, 0, 100 - ia.layerH);
      const sv = Math.abs(nx + ia.layerW / 2 - 50) < SNAP_THRESHOLD;
      const sh = Math.abs(ny + ia.layerH / 2 - 50) < SNAP_THRESHOLD;
      if (sv) nx = 50 - ia.layerW / 2;
      if (sh) ny = 50 - ia.layerH / 2;
      setSnapV(sv); setSnapH(sh);
      onUpdateLayer(ia.id, { x: nx, y: ny }, true);
      setTooltip(`${Math.round(nx)}%, ${Math.round(ny)}%`);

    } else if (ia.type === 'resize') {
      const dx = ((clientX - ia.startX) / cW) * 100;
      const dy = ((clientY - ia.startY) / cH) * 100;
      let { x, y, width: w, height: h } = { x:ia.origX, y:ia.origY, width:ia.origW, height:ia.origH };
      const hk = ia.handle;
      if (hk.includes('e')) w = Math.max(2, ia.origW + dx);
      if (hk.includes('s')) h = Math.max(2, ia.origH + dy);
      if (hk.includes('w')) { w = Math.max(2, ia.origW - dx); x = ia.origX + (ia.origW - w); }
      if (hk.includes('n')) { h = Math.max(2, ia.origH - dy); y = ia.origY + (ia.origH - h); }
      onUpdateLayer(ia.id, { x, y, width: w, height: h }, true);
      setTooltip(`${Math.round(w)}% × ${Math.round(h)}%`);

    } else if (ia.type === 'rotate') {
      const angle = getAngle(ia.centerX, ia.centerY, clientX, clientY);
      let r = ia.origRotation + (angle - ia.startAngle);
      r = ((r % 360) + 360) % 360;
      const snapped = Math.round(r / ROTATION_SNAP) * ROTATION_SNAP;
      if (Math.abs(r - snapped) < ROTATION_SNAP / 2) r = snapped;
      onUpdateLayer(ia.id, { rotation: r }, true);
      setTooltip(`${Math.round(r)}°`);
    }
  }, [cW, cH, onUpdateLayer]);

  const endInteraction = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    pinchRef.current = null;
    setSnapH(false); setSnapV(false);
    setTooltip(null);
    onCommitHistory?.();
  }, [onCommitHistory]);

  // ── Document-level mouse listeners ────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = e => applyMove(e.clientX, e.clientY);
    const onMouseUp   = () => endInteraction();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, [applyMove, endInteraction]);

  // ── Touch handlers ────────────────────────────────────────────────────────
  const handleTouchStart = (e, layerId) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      const layer = layers.find(l => l.id === layerId);
      if (!layer || layer.locked) return;
      const t = e.touches[0];
      const rect = getRect();
      dragRef.current = {
        type: 'drag', id: layerId,
        startX: t.clientX, startY: t.clientY,
        origX: layer.x, origY: layer.y,
        layerW: layer.width, layerH: layer.height,
      };
      setTooltipPos({ x: t.clientX - rect.left, y: t.clientY - rect.top });
    } else if (e.touches.length === 2) {
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      pinchRef.current = { id: layerId, startDist: dist, origW: layer.width, origH: layer.height };
      dragRef.current = null;
    }
  };

  const handleResizeTouchStart = (e, layerId, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const t = e.touches[0];
    dragRef.current = {
      type: 'resize', id: layerId, handle,
      startX: t.clientX, startY: t.clientY,
      origX: layer.x, origY: layer.y,
      origW: layer.width, origH: layer.height,
    };
  };

  const handleRotateTouchStart = (e, layerId) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const rect = getRect();
    const t = e.touches[0];
    const cx = rect.left + ((layer.x + layer.width / 2) / 100) * cW;
    const cy = rect.top  + ((layer.y + layer.height / 2) / 100) * cH;
    dragRef.current = {
      type: 'rotate', id: layerId,
      centerX: cx, centerY: cy,
      origRotation: layer.rotation || 0,
      startAngle: getAngle(cx, cy, t.clientX, t.clientY),
    };
  };

  // ── Touch move / end via document listeners (passive:false) ─────────────
  useEffect(() => {
    const onTouchMove = e => {
      if (!dragRef.current && !pinchRef.current) return;
      if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault();
        applyMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const sc = dist / pinchRef.current.startDist;
        const nw = clamp(pinchRef.current.origW * sc, 5, 100);
        const nh = clamp(pinchRef.current.origH * sc, 5, 100);
        onUpdateLayer(pinchRef.current.id, { width: nw, height: nh }, true);
      }
    };
    const onTouchEnd = () => endInteraction();

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [applyMove, endInteraction, onUpdateLayer]);

  const selectedLayer = layers.find(l => selectedIds.includes(l.id));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {layers.map(layer => (
        <LayerDiv
          key={layer.id}
          layer={layer}
          isSelected={selectedIds.includes(layer.id)}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            onSelectLayer?.(layer.id, e.shiftKey || e.metaKey);
            handleDragStart(e, layer.id);
          }}
          onTouchStart={e => {
            e.stopPropagation();
            onSelectLayer?.(layer.id);
            handleTouchStart(e, layer.id);
          }}
        />
      ))}

      {selectedLayer && !selectedLayer.locked && (
        <SelectionBox
          layer={selectedLayer}
          containerW={cW}
          containerH={cH}
          onHandleMouseDown={(e, hk) => handleResizeStart(e, selectedLayer.id, hk)}
          onHandleTouchStart={(e, hk) => handleResizeTouchStart(e, selectedLayer.id, hk)}
          onRotateMouseDown={e => handleRotateStart(e, selectedLayer.id)}
          onRotateTouchStart={e => handleRotateTouchStart(e, selectedLayer.id)}
          onDelete={() => onDeleteLayer?.(selectedLayer.id)}
        />
      )}

      <SnapGuides snapH={snapH} snapV={snapV} w={cW} h={cH} />
      {tooltip && <Tooltip text={tooltip} x={tooltipPos.x} y={tooltipPos.y} />}
    </div>
  );
}

// ─── LayerToolbar ──────────────────────────────────────────────────────────────
export function LayerToolbar({ onAddShape, onAddImage, canUndo, canRedo, onUndo, onRedo }) {
  const inputRef = useRef(null);

  const btn = (content, title, onClick, disabled) => (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7,
        color: disabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
    >
      {content}
    </button>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '6px 5px', borderRight: '1px solid rgba(255,255,255,0.07)', background: '#1a2035',
      flexShrink: 0, width: 44,
    }}>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 4, textAlign: 'center', lineHeight: 1 }}>
        Layers
      </div>
      {btn(<Square size={14} />, 'Add Rectangle', () => onAddShape('rect'))}
      {btn(<Circle size={14} />, 'Add Circle', () => onAddShape('circle'))}
      {btn(<Triangle size={14} />, 'Add Triangle', () => onAddShape('triangle'))}
      {btn(<ImagePlus size={14} />, 'Add Image', () => inputRef.current?.click())}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onAddImage(URL.createObjectURL(f));
          e.target.value = '';
        }} />
      <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
      {btn(<Undo2 size={13} />, 'Undo', onUndo, !canUndo)}
      {btn(<Redo2 size={13} />, 'Redo', onRedo, !canRedo)}
    </div>
  );
}

// ─── LayerStack ────────────────────────────────────────────────────────────────
export function LayerStack({
  layers = [], selectedIds = [],
  onSelectLayer, onUpdateLayer, onDeleteLayer, onDuplicateLayer, onShiftZ,
}) {
  if (!layers.length) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
      borderTop: '1px solid rgba(255,255,255,0.06)', background: '#141a28',
      overflowX: 'auto', flexShrink: 0, minHeight: 40,
    }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
        letterSpacing: '0.08em', flexShrink: 0 }}>Layers:</span>

      {[...layers].reverse().map(layer => {
        const sel = selectedIds.includes(layer.id);
        return (
          <div key={layer.id} onClick={() => onSelectLayer(layer.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 7px', borderRadius: 5, cursor: 'pointer', flexShrink: 0,
              background: sel ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${sel ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
              fontSize: 10, color: sel ? '#60a5fa' : 'rgba(255,255,255,0.6)',
              transition: 'all 0.1s',
            }}>
            <span onClick={e => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
              style={{ cursor: 'pointer', opacity: layer.visible === false ? 0.4 : 1, display:'flex' }}>
              {layer.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
            </span>
            <span onClick={e => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }}
              style={{ cursor: 'pointer', opacity: layer.locked ? 1 : 0.3, display:'flex' }}>
              {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
            </span>
            <span style={{ maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {layer.label || layer.type}
            </span>
            <span onClick={e => { e.stopPropagation(); onShiftZ(layer.id, 'up'); }}
              style={{ cursor: 'pointer', opacity: 0.5, display:'flex' }} title="Bring forward">
              <MoveUp size={9} />
            </span>
            <span onClick={e => { e.stopPropagation(); onShiftZ(layer.id, 'down'); }}
              style={{ cursor: 'pointer', opacity: 0.5, display:'flex' }} title="Send back">
              <MoveDown size={9} />
            </span>
            <span onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
              style={{ cursor: 'pointer', color: '#ef4444', opacity: 0.7, display:'flex' }} title="Delete">
              <Trash2 size={9} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── LayerPropertiesPanel ──────────────────────────────────────────────────────
function PropRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function LColorInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: '1px solid rgba(255,255,255,0.1)', background: 'none',
          borderRadius: 6, cursor: 'pointer', padding: 2 }} />
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, padding: '4px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11,
          fontFamily: 'monospace', outline: 'none' }} />
    </div>
  );
}

function LSlider({ label, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6' }} />
    </div>
  );
}

function LNumInput({ value, onChange, min, max }) {
  return (
    <input type="number" value={Math.round(value * 10) / 10} min={min} max={max}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6, padding: '4px 6px', color: 'rgba(255,255,255,0.8)', fontSize: 11,
        outline: 'none', boxSizing: 'border-box' }} />
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
      letterSpacing: '0.1em', margin: '12px 0 8px', paddingBottom: 4,
      borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  );
}

export function LayerPropertiesPanel({ layer, onUpdate, onCommit, onDelete, onDuplicate }) {
  if (!layer) {
    return (
      <div style={{ padding: 16, color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center' }}>
        Select a layer to edit its properties
      </div>
    );
  }

  const u  = patch => onUpdate(layer.id, patch);
  const uc = patch => { onUpdate(layer.id, patch); onCommit?.(); };

  const f = { ...FILTER_DEFAULTS, ...layer.filters };

  const applyPreset = name => {
    const preset = FILTER_PRESETS[name];
    if (!preset) return;
    uc({ filters: { ...f, ...preset, preset: name } });
  };

  const filterStr = buildFilterStr(f);

  return (
    <div style={{ overflowY: 'auto', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, padding: '4px 0' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ▣ {layer.label || layer.type}
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => onDuplicate?.(layer.id)}
            style={{ padding: '3px 8px', fontSize: 9, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3 }}>
            <Copy size={10} /> Copy
          </button>
          <button onClick={() => onDelete?.(layer.id)}
            style={{ padding: '3px 8px', fontSize: 9, background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#f87171', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3 }}>
            <Trash2 size={10} /> Delete
          </button>
        </div>
      </div>

      {/* Label */}
      <PropRow label="Label">
        <input value={layer.label || ''} onChange={e => u({ label: e.target.value })}
          onBlur={() => onCommit?.()}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11,
            outline: 'none', boxSizing: 'border-box' }} />
      </PropRow>

      <SectionLabel>Transform</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[['X %', layer.x, v => u({ x: v }), 0, 100],
          ['Y %', layer.y, v => u({ y: v }), 0, 100],
          ['W %', layer.width, v => u({ width: v }), 1, 100],
          ['H %', layer.height, v => u({ height: v }), 1, 100]].map(([lbl, val, fn, lo, hi]) => (
          <div key={lbl}>
            <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 3 }}>{lbl}</div>
            <LNumInput value={val} onChange={fn} min={lo} max={hi} />
          </div>
        ))}
      </div>
      <LSlider label="Rotation" value={layer.rotation || 0} min={-180} max={180}
        onChange={v => u({ rotation: v })} fmt={v => `${v}°`} />

      {/* Fill */}
      {layer.type !== 'image' && (
        <>
          <SectionLabel>Fill</SectionLabel>
          <PropRow label="Color">
            <LColorInput value={layer.fill || '#e63946'} onChange={v => u({ fill: v })} />
          </PropRow>
          <LSlider label="Fill Opacity" value={layer.fillOpacity ?? 100} min={0} max={100}
            onChange={v => u({ fillOpacity: v })} fmt={v => `${v}%`} />
          {(layer.type === 'rect' || layer.type === 'circle') && (
            <LSlider label="Corner Radius" value={layer.borderRadius || 0} min={0} max={50}
              onChange={v => u({ borderRadius: v })} fmt={v => `${v}%`} />
          )}
        </>
      )}

      {/* Image source */}
      {layer.type === 'image' && (
        <>
          <SectionLabel>Image</SectionLabel>
          <PropRow label="URL">
            <input value={layer.src || ''} placeholder="https://…"
              onChange={e => u({ src: e.target.value })} onBlur={() => onCommit?.()}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11,
                outline: 'none', boxSizing: 'border-box' }} />
          </PropRow>
          <PropRow label="Fit">
            <select value={layer.objectFit || 'cover'} onChange={e => uc({ objectFit: e.target.value })}
              style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 6, padding: '5px 8px', color: '#111827', fontSize: 11, outline: 'none' }}>
              {['cover','contain','fill','none'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </PropRow>
          <LSlider label="Corner Radius" value={layer.borderRadius || 0} min={0} max={50}
            onChange={v => u({ borderRadius: v })} fmt={v => `${v}%`} />
        </>
      )}

      {/* Border */}
      <SectionLabel>Border</SectionLabel>
      <LSlider label="Width" value={layer.borderWidth ?? 0} min={0} max={20}
        onChange={v => u({ borderWidth: v })} fmt={v => `${v}px`} />
      {(layer.borderWidth || 0) > 0 && (
        <>
          <PropRow label="Color">
            <LColorInput value={layer.borderColor || '#ffffff'} onChange={v => u({ borderColor: v })} />
          </PropRow>
          <LSlider label="Border Opacity" value={layer.borderOpacity ?? 100} min={0} max={100}
            onChange={v => u({ borderOpacity: v })} fmt={v => `${v}%`} />
        </>
      )}

      {/* ── Filters ── */}
      <SectionLabel>Filters</SectionLabel>

      {/* Preset grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 10 }}>
        {Object.keys(FILTER_PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name)}
            style={{
              padding: '5px 4px', fontSize: 9, fontWeight: 600, borderRadius: 6,
              border: `1px solid ${f.preset === name ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: f.preset === name ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
              color: f.preset === name ? '#60a5fa' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>
            {name}
          </button>
        ))}
      </div>

      {/* Filter preview strip */}
      <div style={{ marginBottom: 10, fontSize: 9, color: 'rgba(255,255,255,0.3)',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6,
        padding: '4px 8px', fontFamily: 'monospace', overflow: 'hidden',
        whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {filterStr}
      </div>

      <LSlider label="Brightness" value={f.brightness} min={0} max={200}
        onChange={v => u({ filters: { ...f, brightness: v, preset: null } })} fmt={v => `${v}%`} />
      <LSlider label="Contrast" value={f.contrast} min={0} max={200}
        onChange={v => u({ filters: { ...f, contrast: v, preset: null } })} fmt={v => `${v}%`} />
      <LSlider label="Saturation" value={f.saturation} min={0} max={200}
        onChange={v => u({ filters: { ...f, saturation: v, preset: null } })} fmt={v => `${v}%`} />
      <LSlider label="Blur" value={f.blur} min={0} max={20}
        onChange={v => u({ filters: { ...f, blur: v, preset: null } })} fmt={v => `${v}px`} />
      <LSlider label="Opacity" value={f.opacity} min={0} max={100}
        onChange={v => u({ filters: { ...f, opacity: v, preset: null } })} fmt={v => `${v}%`} />
      <LSlider label="Hue Rotate" value={f.hue} min={0} max={360}
        onChange={v => u({ filters: { ...f, hue: v, preset: null } })} fmt={v => `${v}°`} />
      <LSlider label="Sepia" value={f.sepia} min={0} max={100}
        onChange={v => u({ filters: { ...f, sepia: v, preset: null } })} fmt={v => `${v}%`} />

      <button onClick={() => uc({ filters: { ...FILTER_DEFAULTS } })}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
          fontSize: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, color: 'rgba(255,255,255,0.45)', cursor: 'pointer', marginTop: 4 }}>
        <RotateCcw size={11} /> Reset filters
      </button>

      {/* Blend / layer */}
      <SectionLabel>Layer</SectionLabel>
      <PropRow label="Blend Mode">
        <select value={layer.blendMode || 'normal'} onChange={e => uc({ blendMode: e.target.value })}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11, outline: 'none' }}>
          {['normal','multiply','screen','overlay','darken','lighten',
            'color-dodge','color-burn','hard-light','soft-light',
            'difference','exclusion','hue','saturation','color','luminosity'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </PropRow>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        {[['locked', 'Locked'], ['visible', 'Visible']].map(([key, lbl]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={key === 'visible' ? layer.visible !== false : !!layer[key]}
              onChange={e => uc(key === 'visible' ? { visible: e.target.checked } : { [key]: e.target.checked })} />
            {lbl}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── renderLayersToCanvas ──────────────────────────────────────────────────────
export async function renderLayersToCanvas(canvas, layers, CW, CH) {
  if (!layers?.length) return;
  const ctx = canvas.getContext('2d');

  for (const layer of layers) {
    if (layer.visible === false) continue;
    const x = (layer.x / 100) * CW;
    const y = (layer.y / 100) * CH;
    const w = (layer.width  / 100) * CW;
    const h = (layer.height / 100) * CH;

    ctx.save();
    ctx.globalAlpha = ((layer.filters?.opacity ?? 100)) / 100;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    // Apply CSS-equivalent filter
    const f = { ...FILTER_DEFAULTS, ...layer.filters };
    ctx.filter = buildFilterStr(f);

    // Rotate around centre
    const cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(deg2rad(layer.rotation || 0));
    ctx.translate(-cx, -cy);

    if (layer.type === 'image' && layer.src) {
      try {
        const img = await _loadImg(layer.src);
        const rr = layer.type === 'circle' ? w / 2 : ((layer.borderRadius || 0) / 100) * Math.min(w, h);
        ctx.beginPath(); ctx.roundRect(x, y, w, h, rr); ctx.clip();
        const sc = layer.objectFit === 'contain'
          ? Math.min(w / img.naturalWidth, h / img.naturalHeight)
          : Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const sw = img.naturalWidth * sc, sh = img.naturalHeight * sc;
        ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
      } catch {}
    } else if (layer.type === 'triangle') {
      ctx.beginPath(); ctx.moveTo(x + w/2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
      const ff = hexToRgba(layer.fill || '#f59e0b', layer.fillOpacity ?? 100);
      ctx.fillStyle = ff; ctx.fill();
    } else if (layer.type !== 'image') {
      const rr = layer.type === 'circle'
        ? Math.min(w, h) / 2
        : ((layer.borderRadius || 0) / 100) * Math.min(w, h);
      ctx.beginPath(); ctx.roundRect(x, y, w, h, rr);
      ctx.fillStyle = hexToRgba(layer.fill || '#e63946', layer.fillOpacity ?? 100);
      ctx.fill();
      if ((layer.borderWidth || 0) > 0) {
        ctx.strokeStyle = hexToRgba(layer.borderColor || '#ffffff', layer.borderOpacity ?? 100);
        ctx.lineWidth = layer.borderWidth;
        if (layer.borderStyle === 'dashed') ctx.setLineDash([layer.borderWidth * 3, layer.borderWidth * 2]);
        else if (layer.borderStyle === 'dotted') ctx.setLine