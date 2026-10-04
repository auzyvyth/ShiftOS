import React, { useState, useRef } from 'react';

/* ── Damage type config (Japanese auction-sheet codes) ───── */
const DAMAGE_TYPES = [
  { code: 'A',  label: 'Scratch',        color: '#fbbf24' },
  { code: 'U',  label: 'Dent',           color: '#f87171' },
  { code: 'Y',  label: 'Rust',           color: '#fb923c' },
  { code: 'XX', label: 'Replaced panel', color: '#a78bfa' },
];
const SEVERITY = { 1: 'Small', 2: 'Medium', 3: 'Large' };

const typeCfg = (code) => DAMAGE_TYPES.find(t => t.code === code) || DAMAGE_TYPES[0];
const markerR = (sev) => 5 + (sev || 1) * 2;

/* ── Surface palettes. The map sits on light AND dark surfaces
      (CarForm + dealer dashboard + XDrive car page are light, dealer
      storefront car page + platform review are dark), so the caller says
      which one via `theme`. ─────────────────────────────────────────── */
const PALETTES = {
  light: {
    line: '#6b7280', body: '#ffffff', seam: '#9ca3af', glass: '#e0ecf8', glassLine: '#94a3b8',
    lamp: '#fef3c7', tail: '#fecaca', label: '#6b7280', muted: '#9ca3af',
    text: '#111827', panelBg: '#f9fafb', panelLine: '#e5e7eb', markerRing: '#111827',
  },
  dark: {
    line: '#9ca3af', body: '#0d1117', seam: '#4b5563', glass: '#1e293b', glassLine: '#475569',
    lamp: '#3f3a26', tail: '#3f1d1d', label: '#9ca3af', muted: '#6b7280',
    text: '#f9fafb', panelBg: '#0d1117', panelLine: '#1f2937', markerRing: '#030712',
  },
};

/* ── Geometry ────────────────────────────────────────────────
   Auction-sheet "unfolded car": top view in the middle (front up), both
   sides folded out flat, wheels on the outer edges. Marks are stored as
   { x, y } in % of this viewBox plus the panel name, with v: 2. */
const VW = 320;
const VH = 432;
const FONT = 'var(--xd-font-body, system-ui, sans-serif)';

// Marks saved on the old single top-down drawing (200x420, no `v`) are
// re-projected onto the top view of this one, so they stay on the same
// part of the car instead of drifting into a side flap.
function toCurrent(m) {
  if (m.v === 2) return m;
  const clamp = (n) => Math.min(1, Math.max(0, n));
  const ox = (m.x / 100) * 200;
  const oy = (m.y / 100) * 420;
  const nx = 116 + clamp((ox - 42) / 116) * 88;
  const ny = 18 + clamp((oy - 28) / 367) * 386;
  // Stamped v: 2 so the converted mark is never re-projected once it is saved back.
  return { ...m, x: +((nx / VW) * 100).toFixed(1), y: +((ny / VH) * 100).toFixed(1), v: 2 };
}

// Name the panel a point (viewBox units) falls on. The left flap is drawn
// in its own coordinates; the right flap is that mirrored, so it reads from
// the same rules with x flipped.
function panelAt(view, x, y) {
  const near = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  if (view === 'left' || view === 'right') {
    if (view === 'right') x = VW - x;
    const side = view === 'left' ? 'Left side' : 'Right side';
    let p;
    if (near(56, 108, 20)) p = 'front tyre / rim';
    else if (near(56, 330, 20)) p = 'rear tyre / rim';
    else if (x < 62 && y >= 140 && y <= 304) p = 'sill';
    else if (y < 140) p = 'front fender';
    else if (y < 222) p = 'front door';
    else if (y < 298) p = 'rear door';
    else p = 'rear quarter panel';
    return `${side}, ${p}`;
  }
  const lr = x < VW / 2 ? 'Left' : 'Right';
  if (near(137, 40, 8) || near(183, 40, 8)) return `${lr} headlight`;
  if (y < 30) return 'Front bumper';
  if (y < 122) return 'Bonnet';
  if (y < 150) return 'Windscreen';
  if (y < 298) return 'Roof';
  if (y < 330) return 'Rear windscreen';
  if (y >= 379 && y <= 390 && (x < 144 || x > 176)) return `${lr} tail light`;
  if (y < 392) return 'Boot lid';
  return 'Rear bumper';
}

const viewAt = (x) => (x < 116 ? 'left' : x > 204 ? 'right' : 'top');
const panelOf = (m) => m.panel || panelAt(viewAt((m.x / 100) * VW), (m.x / 100) * VW, (m.y / 100) * VH);

/* One side, unfolded flat off the roof edge. Drawn as the LEFT side; the
   right side is this mirrored. Hinge (shared edge with the top view) at x=116. */
function Flap({ p, mirror }) {
  const s = { stroke: p.seam, strokeWidth: 1, fill: 'none' };
  const dash = { ...s, strokeDasharray: '3 2.5' };
  return (
    <g transform={mirror ? `translate(${VW} 0) scale(-1 1)` : undefined}>
      <path d="M116 128 L102 44 Q84 38 64 40 L62 86.8 A22 22 0 0 1 62 129.2 L62 140 L40 140 L40 304 L62 304 L62 308.8 A22 22 0 0 1 62 351.2 L62 372 Q80 380 108 378 L116 360 Z"
        fill={p.body} stroke={p.line} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M116 150 L68 150 L68 282 Q70 298 86 298 L116 298" {...dash} />
      <path d="M62 222 L116 222" {...dash} />
      <path d="M62 140 L62 304" {...s} />
      <circle cx="56" cy="108" r="18" fill={p.body} stroke={p.line} strokeWidth="1.6" />
      <circle cx="56" cy="108" r="9" {...s} />
      <circle cx="56" cy="330" r="18" fill={p.body} stroke={p.line} strokeWidth="1.6" />
      <circle cx="56" cy="330" r="9" {...s} />
    </g>
  );
}

function CarOutline({ p }) {
  const s = { stroke: p.seam, strokeWidth: 1, fill: 'none' };
  const dash = { ...s, strokeDasharray: '3 2.5' };
  const outline = { fill: p.body, stroke: p.line, strokeWidth: 1.6, strokeLinejoin: 'round' };
  const glass = { fill: p.glass, stroke: p.glassLine, strokeWidth: 1 };
  const lbl = { fill: p.label, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', fontFamily: FONT, style: { pointerEvents: 'none' } };
  return (
    <>
      <text x="160" y="10" textAnchor="middle" {...lbl}>FRONT</text>
      <text x="160" y="428" textAnchor="middle" {...lbl}>REAR</text>
      <text x="18" y="222" textAnchor="middle" transform="rotate(-90 18 222)" {...lbl}>LEFT · PASSENGER</text>
      <text x="302" y="222" textAnchor="middle" transform="rotate(90 302 222)" {...lbl}>RIGHT · DRIVER</text>

      <g data-view="left"><Flap p={p} /></g>
      <g data-view="right"><Flap p={p} mirror /></g>

      {/* Top view, front up */}
      <g data-view="top">
        <path d="M116 34 Q116 30 122 30 L198 30 Q204 30 204 34 L204 392 L116 392 Z" {...outline} />
        <path d="M110 18 Q160 12 210 18 L210 30 L110 30 Z" {...outline} />
        <path d="M110 392 L210 392 L210 404 Q160 410 110 404 Z" {...outline} />
        <circle cx="137" cy="40" r="6" fill={p.lamp} stroke={p.line} strokeWidth="0.9" />
        <circle cx="183" cy="40" r="6" fill={p.lamp} stroke={p.line} strokeWidth="0.9" />
        <path d="M116 52 Q160 47 204 52" {...s} />
        <path d="M128 124 Q160 113 192 124 L186 147 Q160 142 134 147 Z" {...glass} />
        <rect x="128" y="152" width="64" height="144" rx="6" {...dash} />
        <path d="M116 222 L204 222" {...dash} />
        <path d="M132 300 Q160 295 188 300 L192 326 Q160 332 128 326 Z" {...glass} strokeDasharray="3 2.5" />
        <path d="M116 334 Q160 330 204 334" {...s} />
        <rect x="122" y="381" width="20" height="7" rx="2" fill={p.tail} stroke={p.line} strokeWidth="0.9" />
        <rect x="178" y="381" width="20" height="7" rx="2" fill={p.tail} stroke={p.line} strokeWidth="0.9" />
      </g>
    </>
  );
}

/**
 * DamageMap — auction-sheet style car diagram with tappable damage markers.
 *
 * Props:
 *   value     array   [{ x, y, type, severity, panel, v }] (x/y as % of the viewBox)
 *   onChange  fn      Called with the new array (edit mode)
 *   readOnly  bool    Hides editing controls
 *   theme     'light' | 'dark'   The surface the map sits on
 */
export default function DamageMap({ value = [], onChange, readOnly = false, theme = 'light' }) {
  const p = PALETTES[theme] || PALETTES.light;
  const [pending, setPending] = useState(null); // { x, y, panel }
  const [selType, setSelType] = useState('U');
  const [selSev, setSelSev] = useState(1);
  const svgRef = useRef(null);

  const marks = (Array.isArray(value) ? value : []).map(toCurrent);

  const handleSvgClick = (e) => {
    if (readOnly) return;
    const marker = e.target.closest('[data-mark]');
    if (marker) { removeMarker(Number(marker.dataset.mark)); return; }
    const view = e.target.closest('[data-view]');
    if (!view) return; // tapped off the car
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    setPending({
      x: +((pt.x / VW) * 100).toFixed(1),
      y: +((pt.y / VH) * 100).toFixed(1),
      panel: panelAt(view.dataset.view, pt.x, pt.y),
    });
  };

  const confirmMarker = () => {
    if (!pending) return;
    onChange([...marks, { ...pending, type: selType, severity: selSev, v: 2 }]);
    setPending(null);
  };

  const removeMarker = (idx) => onChange(marks.filter((_, i) => i !== idx));

  const chip = (active) => ({
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${active ? '#dc2626' : p.panelLine}`,
    background: active ? 'rgba(220,38,38,0.08)' : 'transparent',
    color: active ? '#dc2626' : p.label,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ fontFamily: FONT, userSelect: 'none', minWidth: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        onClick={handleSvgClick}
        role="img"
        aria-label="Car condition diagram"
        style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block', margin: '0 auto', cursor: readOnly ? 'default' : 'crosshair', touchAction: 'manipulation' }}
      >
        <CarOutline p={p} />

        {marks.map((m, i) => {
          const c = typeCfg(m.type);
          const r = markerR(m.severity);
          const cx = (m.x / 100) * VW;
          const cy = (m.y / 100) * VH;
          return (
            <g key={i} data-mark={i} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
              <circle cx={cx} cy={cy} r={r + 3} fill={c.color} opacity="0.25" />
              <circle cx={cx} cy={cy} r={r} fill={c.color} stroke={p.markerRing} strokeWidth="1" />
              <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="10" fontWeight="800" fill="#111827"
                fontFamily={FONT} style={{ pointerEvents: 'none' }}>
                {i + 1}
              </text>
            </g>
          );
        })}

        {pending && (
          <circle cx={(pending.x / 100) * VW} cy={(pending.y / 100) * VH} r={markerR(selSev)}
            fill={typeCfg(selType).color} opacity="0.5" stroke={typeCfg(selType).color}
            strokeWidth="1.5" strokeDasharray="3 2" style={{ pointerEvents: 'none' }} />
        )}
      </svg>

      {!readOnly && !pending && (
        <p style={{ fontSize: 12, color: p.muted, margin: '10px 0 0', textAlign: 'center' }}>
          {marks.length === 0 ? 'Tap the car where the damage is' : 'Tap the car to add more, tap a mark to remove it'}
        </p>
      )}

      {/* ── New marker picker ── */}
      {pending && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: p.panelBg, border: `1px solid ${p.panelLine}` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: '0 0 10px' }}>{pending.panel}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {DAMAGE_TYPES.map(t => (
              <button key={t.code} type="button" onClick={() => setSelType(t.code)} style={chip(selType === t.code)}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[1, 2, 3].map(s => (
              <button key={s} type="button" onClick={() => setSelSev(s)} style={chip(selSev === s)}>
                {SEVERITY[s]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={confirmMarker}
              style={{ flex: 1, padding: 9, background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Add mark
            </button>
            <button type="button" onClick={() => setPending(null)}
              style={{ padding: '9px 12px', background: 'transparent', border: `1px solid ${p.panelLine}`, borderRadius: 8, color: p.label, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Marked areas, numbered to match the diagram ── */}
      {marks.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {marks.map((m, i) => {
            const c = typeCfg(m.type);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: p.panelBg, border: `1px solid ${p.panelLine}`, minWidth: 0 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: c.color, color: '#111827', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, color: p.text, minWidth: 0 }}>
                  <b style={{ fontWeight: 700 }}>{c.label}</b>
                  <span style={{ color: p.label }}> · {panelOf(m)} · {(SEVERITY[m.severity] || 'Small').toLowerCase()}</span>
                </span>
                {!readOnly && (
                  <button type="button" onClick={() => removeMarker(i)} aria-label="Remove mark"
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: p.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend. Suppressed on a read-only map with no markers: a key listing
          scratch, dent, rust and replaced panel under a clean car reads as a
          defect list. */}
      {(!readOnly || marks.length > 0) && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {DAMAGE_TYPES.map(t => (
            <span key={t.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: p.label }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
