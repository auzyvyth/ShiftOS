/**
 * LayerCanvas — Canva-style layer editor overlay for TikTok Studio V3
 *
 * Architecture:
 *   TikTokStudioV3 wraps CanvasPreview + LayerCanvas together in a
 *   position:relative container. LayerCanvas is position:absolute, inset:0
 *   with pointer-events:none on its root so clicks on empty space fall
 *   through to CanvasPreview (which handles text/badge element deselection).
 *   pointer-events:auto is set on individual layer divs and handles.
 *
 * Exports:
 *   default          LayerCanvas           — canvas overlay
 *   named            LayerToolbar          — vertical left toolbar strip
 *   named            LayerStack            — horizontal bottom layer chips
 *   named            LayerPropertiesPanel  — right panel tab
 *   named            renderLayersToCanvas  — for toBlob export extension
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─── Constants ─────────────────────────────────────────────────────────────────
const HANDLE_SIZE = 8;       // px, resize handle box
const ROTATE_OFFSET = 20;    // px above selection box
const SNAP_THRESHOLD = 2;    // % of canvas dimension
const ROTATION_SNAP = 15;    // degrees

// ─── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function pxToPercX(px, containerW) { return (px / containerW) * 100; }
function pxToPercY(px, containerH) { return (px / containerH) * 100; }
function percToPxX(perc, containerW) { return (perc / 100) * containerW; }
function percToPxY(perc, containerH) { return (perc / 100) * containerH; }

function deg2rad(d) { return (d * Math.PI) / 180; }

function hexToRgba(hex, opacity) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity / 100})`;
}

function getAngle(cx, cy, ex, ey) {
  return Math.atan2(ey - cy, ex - cx) * (180 / Math.PI) + 90;
}

function snapRotation(deg) {
  const snapped = Math.round(deg / ROTATION_SNAP) * ROTATION_SNAP;
  return Math.abs(deg - snapped) < ROTATION_SNAP / 2 ? snapped : deg;
}

// ─── Layer shape renderer (CSS-based) ─────────────────────────────────────────
function LayerDiv({ layer, scale, isSelected, onPointerDown, onDoubleClick }) {
  const displayX = percToPxX(layer.x, 100) * scale;  // will be set via style
  // We convert % to px relative to the scaled canvas container
  const cw = scale; // passed externally but we use % positioning

  const borderStyle = {
    borderWidth: layer.borderWidth,
    borderStyle: layer.borderStyle || 'solid',
    borderColor: hexToRgba(layer.borderColor || '#ffffff', layer.borderOpacity ?? 100),
    borderRadius: layer.type === 'circle' ? '50%' : `${layer.borderRadius || 0}%`,
  };

  const commonStyle = {
    position: 'absolute',
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.width}%`,
    height: `${layer.height}%`,
    transform: `rotate(${layer.rotation || 0}deg)`,
    transformOrigin: 'center center',
    opacity: (layer.opacity ?? 100) / 100,
    mixBlendMode: layer.blendMode || 'normal',
    pointerEvents: layer.locked ? 'none' : 'auto',
    cursor: layer.locked ? 'not-allowed' : 'move',
    zIndex: (layer.zIndex ?? 0) + 1,
    boxSizing: 'border-box',
    userSelect: 'none',
    visibility: layer.visible === false ? 'hidden' : 'visible',
  };

  if (layer.type === 'image') {
    return (
      <div
        style={commonStyle}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
      >
        {layer.src ? (
          <img
            src={layer.src}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%',
              objectFit: layer.objectFit || 'cover',
              borderRadius: `${layer.borderRadius || 0}%`,
              pointerEvents: 'none',
              display: 'block',
              ...borderStyle,
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.08)',
            ...borderStyle,
          }}>
            <span style={{ fontSize: '24px', opacity: 0.4 }}>🖼</span>
          </div>
        )}
      </div>
    );
  }

  if (layer.type === 'triangle') {
    // CSS triangle via clip-path
    return (
      <div
        style={{
          ...commonStyle,
          background: hexToRgba(layer.fill || '#f59e0b', layer.fillOpacity ?? 100),
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          ...borderStyle,
        }}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  // rect, circle, text, or default shape
  return (
    <div
      style={{
        ...commonStyle,
        background: hexToRgba(layer.fill || '#e63946', layer.fillOpacity ?? 100),
        ...borderStyle,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {layer.text && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: layer.textAlign || 'center',
          padding: '4px 6px',
          fontSize: `${(layer.fontSize || 24) * scale}px`,
          fontWeight: layer.fontWeight || 'bold',
          color: layer.textColor || '#ffffff',
          overflow: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {layer.text}
        </div>
      )}
    </div>
  );
}

// ─── Selection overlay ─────────────────────────────────────────────────────────
const HANDLES = ['nw','n','ne','e','se','s','sw','w'];

function SelectionBox({ layer, scale, containerW, containerH, onHandleDown, onRotateDown, onDelete }) {
  const x = percToPxX(layer.x, containerW);
  const y = percToPxY(layer.y, containerH);
  const w = percToPxX(layer.width, containerW);
  const h = percToPxY(layer.height, containerH);

  const hs = HANDLE_SIZE;

  const handlePos = {
    nw: [-hs/2,     -hs/2],
    n:  [w/2-hs/2,  -hs/2],
    ne: [w-hs/2,    -hs/2],
    e:  [w-hs/2,    h/2-hs/2],
    se: [w-hs/2,    h-hs/2],
    s:  [w/2-hs/2,  h-hs/2],
    sw: [-hs/2,     h-hs/2],
    w:  [-hs/2,     h/2-hs/2],
  };

  const cursor = { nw:'nwse-resize', n:'ns-resize', ne:'nesw-resize', e:'ew-resize',
                   se:'nwse-resize', s:'ns-resize', sw:'nesw-resize', w:'ew-resize' };

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y, width: w, height: h,
      transform: `rotate(${layer.rotation || 0}deg)`,
      transformOrigin: 'center center',
      pointerEvents: 'none',
      zIndex: 50,
    }}>
      {/* Border */}
      <div style={{
        position: 'absolute', inset: 0,
        border: '1.5px solid #dc2626',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }} />

      {/* Resize handles */}
      {HANDLES.map(h => (
        <div
          key={h}
          onPointerDown={e => { e.stopPropagation(); onHandleDown(e, h); }}
          style={{
            position: 'absolute',
            left: handlePos[h][0], top: handlePos[h][1],
            width: hs, height: hs,
            background: '#fff',
            border: '1.5px solid #dc2626',
            borderRadius: 2,
            cursor: cursor[h],
            pointerEvents: 'auto',
            zIndex: 51,
          }}
        />
      ))}

      {/* Rotate handle */}
      <div
        onPointerDown={e => { e.stopPropagation(); onRotateDown(e); }}
        style={{
          position: 'absolute',
          left: w/2 - hs/2, top: -ROTATE_OFFSET - hs/2,
          width: hs, height: hs,
          background: '#dc2626',
          borderRadius: '50%',
          cursor: 'crosshair',
          pointerEvents: 'auto',
          zIndex: 51,
        }}
        title="Rotate"
      />

      {/* Rotate line */}
      <div style={{
        position: 'absolute',
        left: w/2 - 0.5, top: -ROTATE_OFFSET,
        width: 1, height: ROTATE_OFFSET,
        background: 'rgba(220,38,38,0.5)',
        pointerEvents: 'none',
      }} />

      {/* Delete button */}
      <div
        onPointerDown={e => { e.stopPropagation(); onDelete(); }}
        style={{
          position: 'absolute',
          right: -10, top: -10,
          width: 18, height: 18,
          background: '#ef4444',
          borderRadius: '50%',
          cursor: 'pointer',
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 700,
          zIndex: 51,
        }}
        title="Delete layer"
      >
        ✕
      </div>
    </div>
  );
}

// ─── Snap guides ───────────────────────────────────────────────────────────────
function SnapGuides({ snapH, snapV, containerW, containerH }) {
  return (
    <>
      {snapH && (
        <div style={{
          position: 'absolute',
          left: 0, top: percToPxY(50, containerH) - 0.5,
          width: containerW, height: 1,
          background: '#dc2626',
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 60,
        }} />
      )}
      {snapV && (
        <div style={{
          position: 'absolute',
          left: percToPxX(50, containerW) - 0.5, top: 0,
          width: 1, height: containerH,
          background: '#dc2626',
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 60,
        }} />
      )}
    </>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ text, x, y }) {
  if (!text) return null;
  return (
    <div style={{
      position: 'absolute',
      left: x + 10, top: y + 10,
      background: 'rgba(0,0,0,0.75)',
      color: '#fff', fontSize: 10,
      padding: '3px 7px', borderRadius: 4,
      pointerEvents: 'none', zIndex: 70,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </div>
  );
}

// ─── LayerCanvas (default export) ─────────────────────────────────────────────
export default function LayerCanvas({
  layers = [],
  selectedIds = [],
  scale = 1,
  canvasW,
  canvasH,
  onSelectLayer,
  onClearSelection,
  onUpdateLayer,
  onCommitHistory,
  onDeleteLayer,
}) {
  const containerRef = useRef(null);
  const interactRef = useRef(null);

  const [snapH, setSnapH] = useState(false);
  const [snapV, setSnapV] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Scaled container dimensions
  const cW = (canvasW || 1080) * scale;
  const cH = (canvasH || 1920) * scale;

  // ── Pointer event helpers ──────────────────────────────────────────────────
  const getContainerRect = () => containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

  const startDrag = useCallback((e, layerId) => {
    e.stopPropagation();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const rect = getContainerRect();
    interactRef.current = {
      type: 'drag', layerId,
      startX: e.clientX, startY: e.clientY,
      origX: layer.x, origY: layer.y,
    };
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [layers]);

  const startResize = useCallback((e, layerId, handle) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const rect = getContainerRect();
    interactRef.current = {
      type: 'resize', layerId, handle,
      startX: e.clientX, startY: e.clientY,
      origX: layer.x, origY: layer.y,
      origW: layer.width, origH: layer.height,
    };
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [layers]);

  const startRotate = useCallback((e, layerId) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const rect = getContainerRect();
    const centerX = rect.left + percToPxX(layer.x + layer.width / 2, cW);
    const centerY = rect.top + percToPxY(layer.y + layer.height / 2, cH);
    interactRef.current = {
      type: 'rotate', layerId,
      centerX, centerY,
      origRotation: layer.rotation || 0,
      startAngle: getAngle(centerX, centerY, e.clientX, e.clientY),
    };
  }, [layers, cW, cH]);

  // ── Document-level pointer tracking ───────────────────────────────────────
  useEffect(() => {
    function onMove(e) {
      const ia = interactRef.current;
      if (!ia) return;
      const rect = getContainerRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (ia.type === 'drag') {
        const dx = pxToPercX(e.clientX - ia.startX, cW);
        const dy = pxToPercY(e.clientY - ia.startY, cH);
        const layer = layers.find(l => l.id === ia.layerId);
        if (!layer) return;

        let newX = clamp(ia.origX + dx, 0, 100 - layer.width);
        let newY = clamp(ia.origY + dy, 0, 100 - layer.height);

        // Snap to center
        const centerX = newX + layer.width / 2;
        const centerY = newY + layer.height / 2;
        const sv = Math.abs(centerX - 50) < SNAP_THRESHOLD;
        const sh = Math.abs(centerY - 50) < SNAP_THRESHOLD;
        if (sv) newX = 50 - layer.width / 2;
        if (sh) newY = 50 - layer.height / 2;
        setSnapV(sv); setSnapH(sh);

        onUpdateLayer(ia.layerId, { x: newX, y: newY }, true);
        setTooltip(`${Math.round(newX)}%, ${Math.round(newY)}%`);

      } else if (ia.type === 'resize') {
        const layer = layers.find(l => l.id === ia.layerId);
        if (!layer) return;
        const dx = pxToPercX(e.clientX - ia.startX, cW);
        const dy = pxToPercY(e.clientY - ia.startY, cH);

        let { x, y, width: w, height: h } = {
          x: ia.origX, y: ia.origY, width: ia.origW, height: ia.origH
        };

        const h_ = ia.handle;
        if (h_.includes('e')) w = Math.max(2, ia.origW + dx);
        if (h_.includes('s')) h = Math.max(2, ia.origH + dy);
        if (h_.includes('w')) { w = Math.max(2, ia.origW - dx); x = ia.origX + dx; }
        if (h_.includes('n')) { h = Math.max(2, ia.origH - dy); y = ia.origY + dy; }

        onUpdateLayer(ia.layerId, { x, y, width: w, height: h }, true);
        setTooltip(`${Math.round(w)}% × ${Math.round(h)}%`);

      } else if (ia.type === 'rotate') {
        const angle = getAngle(ia.centerX, ia.centerY, e.clientX, e.clientY);
        let rotation = ia.origRotation + (angle - ia.startAngle);
        rotation = snapRotation(((rotation % 360) + 360) % 360);
        onUpdateLayer(ia.layerId, { rotation }, true);
        setTooltip(`${Math.round(rotation)}°`);
      }
    }

    function onUp() {
      if (!interactRef.current) return;
      interactRef.current = null;
      setSnapH(false); setSnapV(false);
      setTooltip(null);
      onCommitHistory?.();
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [layers, cW, cH, onUpdateLayer, onCommitHistory]);

  const selectedLayer = layers.find(l => selectedIds.includes(l.id));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {/* Shape / image layers */}
      {layers.map(layer => (
        <LayerDiv
          key={layer.id}
          layer={layer}
          scale={scale}
          isSelected={selectedIds.includes(layer.id)}
          onPointerDown={e => {
            if (layer.locked) return;
            e.stopPropagation();
            onSelectLayer(layer.id, e.shiftKey || e.metaKey);
            startDrag(e, layer.id);
          }}
          onDoubleClick={e => e.stopPropagation()}
        />
      ))}

      {/* Selection box with handles */}
      {selectedLayer && !selectedLayer.locked && (
        <SelectionBox
          layer={selectedLayer}
          scale={scale}
          containerW={cW}
          containerH={cH}
          onHandleDown={(e, handle) => startResize(e, selectedLayer.id, handle)}
          onRotateDown={e => startRotate(e, selectedLayer.id)}
          onDelete={() => onDeleteLayer?.(selectedLayer.id)}
        />
      )}

      {/* Snap guides */}
      <SnapGuides snapH={snapH} snapV={snapV} containerW={cW} containerH={cH} />

      {/* Tooltip */}
      {tooltip && <Tooltip text={tooltip} x={tooltipPos.x} y={tooltipPos.y} />}
    </div>
  );
}

// ─── LayerToolbar ──────────────────────────────────────────────────────────────
export function LayerToolbar({ onAddShape, onAddImage, canUndo, canRedo, onUndo, onRedo }) {
  const inputRef = useRef(null);

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onAddImage(url);
    e.target.value = '';
  }

  const btn = (label, title, onClick, disabled) => (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 34, height: 34,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4,
      padding: '6px 4px',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      background: '#0d1117',
      flexShrink: 0,
      width: 44,
    }}>
      <div style={{
        fontSize: 8, color: 'rgba(255,255,255,0.2)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 4,
      }}>Layers</div>

      {btn('▭', 'Add Rectangle', () => onAddShape('rect'))}
      {btn('●', 'Add Circle', () => onAddShape('circle'))}
      {btn('▲', 'Add Triangle', () => onAddShape('triangle'))}

      {/* Image upload */}
      <button
        title="Add Image"
        onClick={() => inputRef.current?.click()}
        style={{
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontSize: 13,
        }}
      >
        🖼
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

      <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

      {btn('↩', 'Undo', onUndo, !canUndo)}
      {btn('↪', 'Redo', onRedo, !canRedo)}
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
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      gap: 4, padding: '4px 8px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: '#0d1117',
      overflowX: 'auto', flexShrink: 0,
      minHeight: 40,
    }}>
      <span style={{
        fontSize: 9, color: 'rgba(255,255,255,0.25)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        flexShrink: 0,
      }}>Layers:</span>

      {[...layers].reverse().map(layer => {
        const selected = selectedIds.includes(layer.id);
        return (
          <div
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 7px',
              borderRadius: 5,
              background: selected ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selected ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', flexShrink: 0,
              fontSize: 10, color: 'rgba(255,255,255,0.7)',
              userSelect: 'none',
            }}
          >
            {/* Visibility toggle */}
            <span
              title={layer.visible === false ? 'Show' : 'Hide'}
              onClick={e => { e.stopPropagation(); onUpdateLayer(layer.id, { visible: !layer.visible }); }}
              style={{ opacity: layer.visible === false ? 0.3 : 0.6, cursor: 'pointer', fontSize: 11 }}
            >👁</span>

            {/* Lock toggle */}
            <span
              title={layer.locked ? 'Unlock' : 'Lock'}
              onClick={e => { e.stopPropagation(); onUpdateLayer(layer.id, { locked: !layer.locked }); }}
              style={{ opacity: layer.locked ? 1 : 0.3, cursor: 'pointer', fontSize: 10 }}
            >{layer.locked ? '🔒' : '🔓'}</span>

            {/* Label */}
            <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {layer.label || layer.type}
            </span>

            {/* Z shift */}
            <span
              title="Bring forward"
              onClick={e => { e.stopPropagation(); onShiftZ(layer.id, 'up'); }}
              style={{ cursor: 'pointer', opacity: 0.5, fontSize: 9 }}
            >↑</span>
            <span
              title="Send back"
              onClick={e => { e.stopPropagation(); onShiftZ(layer.id, 'down'); }}
              style={{ cursor: 'pointer', opacity: 0.5, fontSize: 9 }}
            >↓</span>

            {/* Delete */}
            <span
              title="Delete layer"
              onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
              style={{ cursor: 'pointer', opacity: 0.4, fontSize: 9, color: '#ef4444' }}
            >✕</span>
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

function ColorInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 5, padding: '4px 8px', color: '#fff', fontSize: 11, fontFamily: 'monospace' }} />
    </div>
  );
}

function SliderInput({ label, value, min, max, step = 1, onChange, fmt }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#dc2626' }} />
    </div>
  );
}

function NumInput({ value, onChange, min, max, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="number" value={Math.round(value * 10) / 10} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          flex: 1, background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 5, padding: '4px 6px',
          color: '#fff', fontSize: 11, width: '100%',
        }} />
      {suffix && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{suffix}</span>}
    </div>
  );
}

export function LayerPropertiesPanel({ layer, onUpdate, onCommit, onDelete, onDuplicate }) {
  if (!layer) {
    return (
      <div style={{ padding: 16, color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
        Select a layer to edit its properties
      </div>
    );
  }

  const u = (patch) => onUpdate(layer.id, patch);
  const uc = (patch) => { onUpdate(layer.id, patch); onCommit?.(); };

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ▣ {layer.label || layer.type}
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => onDuplicate?.(layer.id)}
            style={{ padding: '3px 8px', fontSize: 9, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer' }}>
            Copy
          </button>
          <button onClick={() => onDelete?.(layer.id)}
            style={{ padding: '3px 8px', fontSize: 9, background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, color: '#ef4444',
              cursor: 'pointer' }}>
            Delete
          </button>
        </div>
      </div>

      {/* Label */}
      <PropRow label="Label">
        <input value={layer.label || ''}
          onChange={e => u({ label: e.target.value })}
          onBlur={() => onCommit?.()}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5,
            padding: '5px 8px', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} />
      </PropRow>

      {/* Transform */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
        Transform
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>X %</div>
          <NumInput value={layer.x} min={0} max={100} onChange={v => u({ x: v })} />
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>Y %</div>
          <NumInput value={layer.y} min={0} max={100} onChange={v => u({ y: v })} />
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>W %</div>
          <NumInput value={layer.width} min={1} max={100} onChange={v => u({ width: v })} />
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>H %</div>
          <NumInput value={layer.height} min={1} max={100} onChange={v => u({ height: v })} />
        </div>
      </div>

      <SliderInput label="Rotation" value={layer.rotation || 0} min={-180} max={180}
        onChange={v => u({ rotation: v })} fmt={v => `${v}°`} />
      <SliderInput label="Opacity" value={layer.opacity ?? 100} min={0} max={100}
        onChange={v => u({ opacity: v })} fmt={v => `${v}%`} />

      {/* Fill */}
      {layer.type !== 'image' && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>
            Fill
          </div>
          <PropRow label="Color">
            <ColorInput value={layer.fill || '#e63946'} onChange={v => u({ fill: v })} />
          </PropRow>
          <SliderInput label="Opacity" value={layer.fillOpacity ?? 100} min={0} max={100}
            onChange={v => u({ fillOpacity: v })} fmt={v => `${v}%`} />
          {layer.type === 'rect' && (
            <SliderInput label="Corner Radius" value={layer.borderRadius || 0} min={0} max={50}
              onChange={v => u({ borderRadius: v })} fmt={v => `${v}%`} />
          )}
        </>
      )}

      {/* Image source */}
      {layer.type === 'image' && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>
            Image
          </div>
          <PropRow label="URL or upload">
            <input value={layer.src || ''} placeholder="https://..."
              onChange={e => u({ src: e.target.value })}
              onBlur={() => onCommit?.()}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5,
                padding: '5px 8px', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} />
          </PropRow>
          <PropRow label="Object Fit">
            <select value={layer.objectFit || 'cover'}
              onChange={e => uc({ objectFit: e.target.value })}
              style={{ width: '100%', background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5, padding: '5px 8px', color: '#fff', fontSize: 11 }}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
            </select>
          </PropRow>
          <SliderInput label="Corner Radius" value={layer.borderRadius || 0} min={0} max={50}
            onChange={v => u({ borderRadius: v })} fmt={v => `${v}%`} />
        </>
      )}

      {/* Border */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>
        Border
      </div>
      <SliderInput label="Width" value={layer.borderWidth ?? 0} min={0} max={20}
        onChange={v => u({ borderWidth: v })} fmt={v => `${v}px`} />
      {(layer.borderWidth || 0) > 0 && (
        <>
          <PropRow label="Color">
            <ColorInput value={layer.borderColor || '#ffffff'} onChange={v => u({ borderColor: v })} />
          </PropRow>
          <SliderInput label="Opacity" value={layer.borderOpacity ?? 100} min={0} max={100}
            onChange={v => u({ borderOpacity: v })} fmt={v => `${v}%`} />
          <PropRow label="Style">
            <select value={layer.borderStyle || 'solid'}
              onChange={e => uc({ borderStyle: e.target.value })}
              style={{ width: '100%', background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5, padding: '5px 8px', color: '#fff', fontSize: 11 }}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </PropRow>
        </>
      )}

      {/* Blend mode */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 8px' }}>
        Layer
      </div>
      <PropRow label="Blend Mode">
        <select value={layer.blendMode || 'normal'}
          onChange={e => uc({ blendMode: e.target.value })}
          style={{ width: '100%', background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, padding: '5px 8px', color: '#fff', fontSize: 11 }}>
          {['normal','multiply','screen','overlay','darken','lighten',
            'color-dodge','color-burn','hard-light','soft-light',
            'difference','exclusion','hue','saturation','color','luminosity'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </PropRow>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <input type="checkbox" checked={layer.locked || false}
            onChange={e => uc({ locked: e.target.checked })} />
          Locked
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <input type="checkbox" checked={layer.visible !== false}
            onChange={e => uc({ visible: e.target.checked })} />
          Visible
        </label>
      </div>
    </div>
  );
}

// ─── renderLayersToCanvas ──────────────────────────────────────────────────────
// Called inside toBlob to composite layers onto the export canvas.
// Must be called AFTER renderBackground/renderToCanvas.
export async function renderLayersToCanvas(canvas, layers, CW, CH) {
  if (!layers?.length) return;
  const ctx = canvas.getContext('2d');

  for (const layer of layers) {
    if (layer.visible === false) continue;

    const x = (layer.x / 100) * CW;
    const y = (layer.y / 100) * CH;
    const w = (layer.width / 100) * CW;
    const h = (layer.height / 100) * CH;

    ctx.save();

    // Transform
    ctx.globalAlpha = (layer.opacity ?? 100) / 100;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';

    // Rotate around center
    const cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(deg2rad(layer.rotation || 0));
    ctx.translate(-cx, -cy);

    if (layer.type === 'image' && layer.src) {
      try {
        const img = await loadImg(layer.src);
        const r = ((layer.borderRadius || 0) / 100) * Math.min(w, h);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, layer.type === 'circle' ? w / 2 : r);
        ctx.clip();
        if (layer.objectFit === 'contain') {
          const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const sw = img.naturalWidth * scale, sh = img.naturalHeight * scale;
          ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
        } else {
          // cover
          const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
          const sw = img.naturalWidth * scale, sh = img.naturalHeight * scale;
          ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
        }
      } catch {}
    } else if (layer.type === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(layer.fill || '#f59e0b', layer.fillOpacity ?? 100);
      ctx.fill();
    } else if (layer.type !== 'image') {
      // rect / circle
      const r = layer.type === 'circle'
        ? Math.min(w, h) / 2
        : ((layer.borderRadius || 0) / 100) * Math.min(w, h);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = hexToRgba(layer.fill || '#e63946', layer.fillOpacity ?? 100);
      ctx.fill();

      if ((layer.borderWidth || 0) > 0) {
        ctx.strokeStyle = hexToRgba(layer.borderColor || '#ffffff', layer.borderOpacity ?? 100);
        ctx.lineWidth = layer.borderWidth;
        const bs = layer.borderStyle || 'solid';
        if (bs === 'dashed') ctx.setLineDash([layer.borderWidth * 3, layer.borderWidth * 2]);
        else if (bs === 'dotted') ctx.setLineDash([layer.borderWidth, layer.borderWidth * 1.5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }
}

// ── Image loader (cached) ──────────────────────────────────────────────────────
const _imgCache = new Map();
function loadImg(src) {
  if (_imgCache.has(src)) return _imgCache.get(src);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
  _imgCache.set(src, p);
  return p;
}
