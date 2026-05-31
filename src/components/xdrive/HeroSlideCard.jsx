import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const BADGE_STYLES = {
  'HOT DEAL':    { bg: '#fef2f2',  border: '#fca5a5',  color: '#dc2626' },
  'RARE FIND':   { bg: '#f5f3ff', border: '#ddd6fe', color: '#7c3aed' },
  'NEW ARRIVAL': { bg: '#ecfdf5', border: '#6ee7b7', color: '#059669' },
};

export default function HeroSlideCard({ slide, onEdit, onDelete, onToggle }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const rootStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    position: 'relative',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    fontFamily: "'DM Sans',sans-serif",
    zIndex: isDragging ? 10 : 'auto',
  };

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(slide.id, !slide.active);
    setToggling(false);
  };

  const badge = slide.badge && slide.badge !== 'None' ? slide.badge : null;
  const badgeStyle = badge ? BADGE_STYLES[badge] : null;
  const statCount = Array.isArray(slide.stats) ? slide.stats.length : 0;

  return (
    <div ref={setNodeRef} style={rootStyle}>

      {/* ── Thumbnail ── */}
      <div style={{
        width: 80, height: 80, borderRadius: 10, overflow: 'hidden',
        flexShrink: 0, background: '#f3f4f6',
        border: '1px solid #e5e7eb',
      }}>
        {slide.image_url ? (
          <img
            src={slide.image_url}
            alt={slide.car_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#374151',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/>
              <circle cx="16.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── Info (flex-1) ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            color: '#111827', fontWeight: 600, fontSize: 14,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {slide.car_name || '—'}
          </span>
          {slide.year && (
            <span style={{ color: '#6b7280', fontSize: 13, flexShrink: 0 }}>{slide.year}</span>
          )}
        </div>

        {badge && badgeStyle && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: badgeStyle.bg, border: `1px solid ${badgeStyle.border}`,
            color: badgeStyle.color, borderRadius: 20, fontSize: 11,
            fontWeight: 700, padding: '2px 8px', marginBottom: 5,
            letterSpacing: '0.04em',
          }}>
            {badge}
          </span>
        )}

        <p style={{ color: '#4b5563', fontSize: 12, margin: 0 }}>
          {statCount} stat{statCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

        {/* Active dot + toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: slide.active ? '#22c55e' : '#374151',
            boxShadow: slide.active ? '0 0 6px rgba(34,197,94,0.55)' : 'none',
            transition: 'all 0.2s',
          }} />
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={slide.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            style={{
              position: 'relative', width: 36, height: 18, borderRadius: 9,
              background: slide.active ? '#dc2626' : '#d1d5db',
              border: 'none', cursor: toggling ? 'not-allowed' : 'pointer',
              padding: 0, transition: 'background 0.2s', opacity: toggling ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: slide.active ? 20 : 2,
              width: 14, height: 14, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }} />
          </button>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 32, background: '#e5e7eb' }} />

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className="xd-icon-btn"
          style={{
            background: 'none', border: 'none', cursor: isDragging ? 'grabbing' : 'grab',
            color: '#4b5563', padding: '5px', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
          onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5.5" cy="3.5" r="1.2"/>
            <circle cx="10.5" cy="3.5" r="1.2"/>
            <circle cx="5.5" cy="8"   r="1.2"/>
            <circle cx="10.5" cy="8"  r="1.2"/>
            <circle cx="5.5" cy="12.5" r="1.2"/>
            <circle cx="10.5" cy="12.5" r="1.2"/>
          </svg>
        </button>

        {/* Edit */}
        <button
          onClick={() => onEdit(slide)}
          title="Edit slide"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4b5563', padding: '5px', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s, background 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.background = 'rgba(56,189,248,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.background = 'none'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* Delete / inline confirm */}
        {confirmDelete ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 9, padding: '5px 10px',
          }}>
            <span style={{ color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>
              Remove this slide?
            </span>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb',
                color: '#6b7280', borderRadius: 6, padding: '2px 9px', fontSize: 12,
                cursor: 'pointer', transition: 'color 0.12s, border-color 0.12s',
                fontFamily: "'DM Sans',sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(slide.id)}
              style={{
                background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none',
                color: 'white', borderRadius: 6, padding: '2px 9px',
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Confirm
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete slide"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4b5563', padding: '5px', borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.background = 'none'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
