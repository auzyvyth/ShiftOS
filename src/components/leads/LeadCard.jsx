import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MessageCircle, ChevronUp, ChevronDown, Calendar } from 'lucide-react';
import LeadSourceBadge from './LeadSourceBadge';
import {
  getInitials, avatarGradient, getLeadAgeDays,
  ageDotColor, ageTextColor, formatWhatsAppURL, STAGE_ORDER,
} from '../../lib/leadsHelpers';

function followUpStyle(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d     = new Date(dateStr); d.setHours(0,0,0,0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < 0)  return { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.22)' }; // overdue
  if (diff === 0) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.22)'  }; // today
  return           { color: '#6b7280',  bg: 'rgba(107,114,128,0.08)',  border: 'rgba(107,114,128,0.18)'  }; // future
}

export default function LeadCard({ lead, onOpen, onMoveNext, onMovePrev }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.9 : 1,
    rotate: isDragging ? '1.5deg' : '0deg',
    zIndex: isDragging ? 9999 : 'auto',
    transition: isDragging ? 'none' : 'box-shadow 0.15s, border-color 0.15s',
  };

  const days    = getLeadAgeDays(lead.created_at);
  const dotCls  = ageDotColor(days);
  const txtCls  = ageTextColor(days);
  const initials  = getInitials(lead.buyer_name);
  const avatarBg  = avatarGradient(lead.lead_source);
  const stageIdx    = STAGE_ORDER.indexOf(lead.stage);
  const canMoveNext = stageIdx < STAGE_ORDER.length - 1;
  const canMovePrev = stageIdx > 0;

  const car      = lead.car_listing;
  const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const carPrice = car?.selling_price ? `RM ${car.selling_price.toLocaleString()}` : null;

  const followUp   = lead.follow_up_at;
  const fuStyle    = followUpStyle(followUp);
  const assignedName = lead.assigned_profile?.full_name;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        border: isDragging ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 12,
        cursor: 'grab',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: isDragging ? '0 12px 40px rgba(0,0,0,0.5)' : undefined,
      }}
      className="group active:cursor-grabbing"
      onClick={() => onOpen?.(lead)}
      {...listeners}
      {...attributes}
    >
      {/* Row 1: avatar + name + source badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div
          style={{ width: 32, height: 32, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0, marginTop: 1 }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
            {lead.buyer_name}
          </p>
          <div style={{ marginTop: 3 }}>
            <LeadSourceBadge source={lead.lead_source} size="xs" />
          </div>
        </div>

        {/* WhatsApp quick action */}
        <a
          href={formatWhatsAppURL(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Chat on WhatsApp"
          style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.18)', opacity: 0, transition: 'opacity 0.15s' }}
          className="group-hover:!opacity-100"
        >
          <MessageCircle style={{ width: 13, height: 13, color: '#34d399' }} />
        </a>
      </div>

      {/* Row 2: car of interest */}
      {carLabel && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{carLabel}</p>
          {carPrice && <p style={{ fontSize: 11, fontWeight: 600, color: 'white', flexShrink: 0, margin: 0 }}>{carPrice}</p>}
        </div>
      )}

      {/* Row 3: age + follow-up + assignee + move-next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} className={dotCls} />
          <span style={{ fontSize: 11, fontWeight: 500 }} className={txtCls}>
            {days === 0 ? 'Today' : `${days}d`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {followUp && fuStyle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: fuStyle.bg, border: `1px solid ${fuStyle.border}` }}>
              <Calendar style={{ width: 9, height: 9, color: fuStyle.color }} />
              <span style={{ fontSize: 10, color: fuStyle.color }}>
                {new Date(followUp).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          )}

          {assignedName && (
            <div
              title={assignedName}
              style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#a78bfa' }}
            >
              {assignedName[0]?.toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', gap: 3 }}>
            <button
              onClick={e => { e.stopPropagation(); onMovePrev?.(lead); }}
              disabled={!canMovePrev}
              style={{
                width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: canMovePrev ? 'rgba(107,114,128,0.14)' : 'transparent',
                border: canMovePrev ? '1px solid rgba(107,114,128,0.22)' : '1px solid transparent',
                cursor: canMovePrev ? 'pointer' : 'default',
                opacity: canMovePrev ? 1 : 0.2,
                transition: 'background 0.15s',
              }}
              title="Move to previous stage"
            >
              <ChevronUp style={{ width: 12, height: 12, color: '#9ca3af' }} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onMoveNext?.(lead); }}
              disabled={!canMoveNext}
              style={{
                width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: canMoveNext ? 'rgba(220,38,38,0.12)' : 'transparent',
                border: canMoveNext ? '1px solid rgba(220,38,38,0.2)' : '1px solid transparent',
                cursor: canMoveNext ? 'pointer' : 'default',
                opacity: canMoveNext ? 1 : 0.2,
                transition: 'background 0.15s',
              }}
              title="Move to next stage"
            >
              <ChevronDown style={{ width: 12, height: 12, color: '#f87171' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
