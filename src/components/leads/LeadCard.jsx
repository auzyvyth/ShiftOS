import React from 'react';
import { MessageCircle, Calendar } from 'lucide-react';
import LeadSourceBadge from './LeadSourceBadge';
import {
  getInitials, avatarGradient, getLeadAgeDays,
  ageTextColor, formatWhatsAppURL, STAGE_CONFIG,
} from '../../lib/leadsHelpers';

function followUpStyle(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0)  return { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.22)' };
  if (diff === 0) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.22)'  };
  return           { color: '#6b7280',  bg: 'rgba(107,114,128,0.08)',  border: 'rgba(107,114,128,0.18)'  };
}

export default function LeadCard({ lead, onOpen }) {
  const days       = getLeadAgeDays(lead.created_at);
  const txtCls     = ageTextColor(days);
  const initials   = getInitials(lead.buyer_name);
  const avatarBg   = avatarGradient(lead.lead_source);
  const stageCfg   = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.new;

  const car        = lead.car_listing;
  const carLabel   = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const carPrice   = car?.selling_price ? `RM ${car.selling_price.toLocaleString()}` : null;

  const followUp   = lead.follow_up_at;
  const fuStyle    = followUpStyle(followUp);
  const assignedName = lead.assigned_profile?.full_name;

  return (
    <div
      onClick={() => onOpen?.(lead)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: 'transparent',
        transition: 'background 0.12s',
        userSelect: 'none',
      }}
      className="group"
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: avatarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: 'white',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: name + source badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead.buyer_name}
          </span>
          <LeadSourceBadge source={lead.lead_source} size="xs" />
        </div>

        {/* Row 2: car + price */}
        {carLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {carLabel}
            </span>
            {carPrice && (
              <span style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 500, flexShrink: 0 }}>
                {carPrice}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side: age, follow-up, assigned, stage, WA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Age text */}
        <span style={{ fontSize: 11, fontWeight: 500 }} className={txtCls}>
          {days === 0 ? 'Today' : `${days}d`}
        </span>

        {/* Follow-up chip */}
        {followUp && fuStyle && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '2px 6px', borderRadius: 4,
            background: fuStyle.bg, border: `1px solid ${fuStyle.border}`,
          }}>
            <Calendar style={{ width: 9, height: 9, color: fuStyle.color }} />
            <span style={{ fontSize: 10, color: fuStyle.color }}>
              {new Date(followUp).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}

        {/* Assigned avatar */}
        {assignedName && (
          <div
            title={assignedName}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#a78bfa',
            }}
          >
            {assignedName[0]?.toUpperCase()}
          </div>
        )}

        {/* HP dot placeholder */}
        {lead.hp_count > 0 && (
          <div
            title={`${lead.hp_count} HP submission${lead.hp_count > 1 ? 's' : ''}`}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#a78bfa', flexShrink: 0,
            }}
          />
        )}

        {/* Stage pill */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 20,
          fontSize: 10, fontWeight: 600,
          background: stageCfg.bg,
          border: `1px solid ${stageCfg.border}`,
          color: stageCfg.headerBorder,
          whiteSpace: 'nowrap',
        }}>
          {stageCfg.label}
        </span>

        {/* WhatsApp button */}
        <a
          href={formatWhatsAppURL(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Chat on WhatsApp"
          style={{
            width: 28, height: 28, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.18)',
            opacity: 0, transition: 'opacity 0.15s',
          }}
          className="group-hover:!opacity-100"
        >
          <MessageCircle style={{ width: 13, height: 13, color: '#34d399' }} />
        </a>
      </div>
    </div>
  );
}
