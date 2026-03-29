import React, { useState, useRef } from 'react';

/* ── Damage type config ──────────────────────────────────── */
const DAMAGE_TYPES = [
  { code: 'A',  label: 'Scratch',        color: '#fbbf24' },
  { code: 'U',  label: 'Dent',           color: '#f87171' },
  { code: 'Y',  label: 'Rust',           color: '#fb923c' },
  { code: 'XX', label: 'Replaced Panel', color: '#a78bfa' },
];

const typeCfg = (code) => DAMAGE_TYPES.find(t => t.code === code) || DAMAGE_TYPES[0];
const markerR  = (sev) => sev === 1 ? 8 : sev === 2 ? 12 : 16;

/* ── SVG dimensions ─────────────────────────────────────── */
const VW = 200;
const VH = 420;

/**
 * DamageMap — top-down car SVG with clickable damage markers.
 *
 * Props:
 *   value     array   Array of { x, y, type, severity } (x/y as % of SVG)
 *   onChange  fn      Called with new array (edit mode)
 *   readOnly  bool    Hides editing controls
 */
export default function DamageMap({ value = [], onChange, readOnly = false }) {
  const [pending, setPending]   = useState(null); // { x, y }
  const [selType, setSelType]   = useState('A');
  const [selSev,  setSelSev]    = useState(1);
  const svgRef = useRef(null);

  const handleSvgClick = (e) => {
    if (readOnly) return;
    if (e.target.closest('.dm-popover')) return; // ignore clicks inside popover
    const rect = svgRef.current.getBoundingClientRect();
    const x = parseFloat(((e.clientX - rect.left) / rect.width  * 100).toFixed(1));
    const y = parseFloat(((e.clientY - rect.top)  / rect.height * 100).toFixed(1));
    setPending({ x, y });
    setSelType('A');
    setSelSev(1);
  };

  const confirmMarker = () => {
    if (!pending) return;
    onChange([...value, { x: pending.x, y: pending.y, type: selType, severity: selSev }]);
    setPending(null);
  };

  const removeMarker = (idx, e) => {
    e?.stopPropagation();
    onChange(value.filter((_, i) => i !== idx));
  };

  const tc   = typeCfg(selType);
  const pCx  = pending ? (pending.x / 100) * VW : 0;
  const pCy  = pending ? (pending.y / 100) * VH : 0;

  /* ── Wrapper style helpers ─────────────────────────────── */
  const pill = (active, color) => ({
    flex: '1 1 auto',
    padding: '5px 0',
    textAlign: 'center',
    background: active ? `${color}22` : 'transparent',
    border: active ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: active ? color : '#6b7280',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'DM Sans',sans-serif",
    transition: 'all 0.15s',
  });

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", userSelect: 'none' }}>
      {/* ── Container (SVG + popover side-by-side on desktop) ── */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* SVG */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            onClick={handleSvgClick}
            style={{
              width: '160px',
              display: 'block',
              cursor: readOnly ? 'default' : 'crosshair',
            }}
          >
            {/* ── Car body ── */}
            {/* Main silhouette */}
            <path
              d="M 65 55 Q 100 38 135 55 L 152 115 L 158 300 Q 158 390 100 395 Q 42 390 42 300 L 48 115 Z"
              fill="#0d1117" stroke="#374151" strokeWidth="2"
            />
            {/* Front bumper */}
            <path
              d="M 68 55 Q 100 42 132 55 L 140 40 Q 100 28 60 40 Z"
              fill="#111827" stroke="#4b5563" strokeWidth="1.5"
            />
            {/* Rear bumper */}
            <path
              d="M 52 340 L 48 368 Q 100 382 152 368 L 148 340 Z"
              fill="#111827" stroke="#4b5563" strokeWidth="1.5"
            />
            {/* Windshield front */}
            <path
              d="M 68 118 L 62 168 L 138 168 L 132 118 Z"
              fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" strokeWidth="1"
            />
            {/* Windshield rear */}
            <path
              d="M 62 228 L 68 278 Q 100 290 132 278 L 138 228 Z"
              fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.25)" strokeWidth="1"
            />
            {/* Roof/cabin */}
            <path
              d="M 68 168 L 62 228 L 138 228 L 132 168 Z"
              fill="#1f2937" stroke="#374151" strokeWidth="1"
            />
            {/* Hood crease */}
            <path d="M 72 90 Q 100 82 128 90" fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="5,3"/>
            {/* Boot crease */}
            <path d="M 56 318 Q 100 310 144 318" fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="5,3"/>

            {/* Wheels — front */}
            <rect x="16" y="85"  width="26" height="68" rx="9" fill="#111827" stroke="#6b7280" strokeWidth="1.5"/>
            <rect x="158" y="85" width="26" height="68" rx="9" fill="#111827" stroke="#6b7280" strokeWidth="1.5"/>
            {/* Wheels — rear */}
            <rect x="16" y="267"  width="26" height="68" rx="9" fill="#111827" stroke="#6b7280" strokeWidth="1.5"/>
            <rect x="158" y="267" width="26" height="68" rx="9" fill="#111827" stroke="#6b7280" strokeWidth="1.5"/>

            {/* Zone labels */}
            <text x="100" y="22"  textAnchor="middle" fill="#4b5563" fontSize="9" fontFamily="DM Sans,sans-serif">FRONT</text>
            <text x="100" y="410" textAnchor="middle" fill="#4b5563" fontSize="9" fontFamily="DM Sans,sans-serif">REAR</text>
            <text x="10"  y="200" fill="#4b5563" fontSize="8" fontFamily="DM Sans,sans-serif"
              transform="rotate(-90,10,200)" textAnchor="middle">LEFT</text>
            <text x="190" y="200" fill="#4b5563" fontSize="8" fontFamily="DM Sans,sans-serif"
              transform="rotate(90,190,200)" textAnchor="middle">RIGHT</text>

            {/* ── Existing markers ── */}
            {value.map((m, i) => {
              const mc   = typeCfg(m.type);
              const r    = markerR(m.severity);
              const cx   = (m.x / 100) * VW;
              const cy   = (m.y / 100) * VH;
              const fSz  = r < 10 ? '7' : '8';
              return (
                <g key={i} style={{ cursor: readOnly ? 'default' : 'pointer' }}
                  onClick={e => !readOnly && removeMarker(i, e)}>
                  <circle cx={cx} cy={cy} r={r + 3} fill="transparent"/>
                  <circle cx={cx} cy={cy} r={r} fill={mc.color} opacity="0.88"/>
                  <text x={cx} y={cy + parseFloat(fSz) / 2} textAnchor="middle"
                    fill="rgba(0,0,0,0.8)" fontSize={fSz} fontWeight="800"
                    fontFamily="DM Sans,sans-serif" style={{ pointerEvents: 'none' }}>
                    {m.type}
                  </text>
                </g>
              );
            })}

            {/* ── Pending preview ── */}
            {pending && (
              <circle cx={pCx} cy={pCy} r={markerR(selSev)}
                fill={tc.color} opacity="0.45"
                stroke={tc.color} strokeWidth="1.5" strokeDasharray="4,2"
              />
            )}
          </svg>
        </div>

        {/* ── Popover for new marker ── */}
        {pending && (
          <div className="dm-popover" style={{
            background: 'linear-gradient(145deg,#111827,#0d1117)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            padding: '14px',
            minWidth: '180px',
            maxWidth: '210px',
            flex: '1 1 180px',
          }}>
            <p style={{ color: 'white', fontSize: '12px', fontWeight: '700', margin: '0 0 10px' }}>
              New Damage Marker
            </p>

            {/* Type */}
            <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
              Type
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
              {DAMAGE_TYPES.map(t => (
                <button key={t.code} onClick={e => { e.stopPropagation(); setSelType(t.code); }}
                  style={{
                    textAlign: 'left', padding: '6px 10px',
                    background: selType === t.code ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                    border: selType === t.code ? `1px solid ${t.color}44` : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px',
                    color: selType === t.code ? t.color : '#6b7280',
                    fontSize: '12px', cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                  <span style={{ fontWeight: '800', marginRight: '6px' }}>({t.code})</span>{t.label}
                </button>
              ))}
            </div>

            {/* Severity */}
            <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
              Severity
            </p>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
              {[
                { level: 1, label: '1 · Small'  },
                { level: 2, label: '2 · Med'    },
                { level: 3, label: '3 · Large'  },
              ].map(s => (
                <button key={s.level} onClick={e => { e.stopPropagation(); setSelSev(s.level); }}
                  style={pill(selSev === s.level, '#dc2626')}>
                  {s.level}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={e => { e.stopPropagation(); confirmMarker(); }}
                style={{ flex: 1, padding: '8px', background: '#dc2626', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                Add
              </button>
              <button onClick={e => { e.stopPropagation(); setPending(null); }}
                style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#9ca3af', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Placeholder tip when no markers and not editing */}
        {!pending && !readOnly && value.length === 0 && (
          <div style={{
            flex: '1 1 180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4b5563',
            fontSize: '12px',
            textAlign: 'center',
            padding: '16px',
          }}>
            Click anywhere on the car to mark damage
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        {DAMAGE_TYPES.map(t => (
          <span key={t.code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: t.color, flexShrink: 0 }}/>
            <span style={{ color: '#9ca3af', fontSize: '11px' }}>({t.code}) {t.label}</span>
          </span>
        ))}
        {!readOnly && (
          <span style={{ color: '#4b5563', fontSize: '10px', marginLeft: 'auto' }}>
            Click marker to remove
          </span>
        )}
      </div>

      {/* ── Marker list (summary) ── */}
      {value.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {value.map((m, i) => {
            const mc = typeCfg(m.type);
            return (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: `${mc.color}14`,
                border: `1px solid ${mc.color}40`,
                borderRadius: '7px',
                padding: '3px 9px',
                color: mc.color,
                fontSize: '11px',
              }}>
                ({m.type}) {mc.label} — Sev {m.severity}
                {!readOnly && (
                  <button onClick={e => removeMarker(i, e)}
                    style={{ background: 'none', border: 'none', color: mc.color, cursor: 'pointer', padding: 0, fontSize: '13px', lineHeight: 1, marginLeft: '2px' }}>
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
