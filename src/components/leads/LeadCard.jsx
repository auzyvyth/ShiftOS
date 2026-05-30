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
  if (diff < 0)  return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  if (diff === 0) return { color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  return           { color: '#6b7280',  bg: '#f9fafb',  border: '#e5e7eb' };
}

const HIGHLIGHT_SOURCES = {
  drevo_enquiry: { label: 'Enquiry', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  booking:       { label: 'Booking', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
};

export default function LeadCard({ lead, onOpen }) {
  const days         = getLeadAgeDays(lead.created_at);
  const txtCls       = ageTextColor(days);
  const initials     = getInitials(lead.buyer_name);
  const avatarBg     = avatarGradient(lead.lead_source);
  const stageCfg     = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.new;
  const car          = lead.car_listing;
  const carLabel     = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const carPrice     = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString()}` : null;
  const followUp     = lead.follow_up_at;
  const fuStyle      = followUpStyle(followUp);
  const assignedName = lead.assigned_profile?.full_name;
  const highlight    = HIGHLIGHT_SOURCES[lead.lead_source];

  return (
    <div
      onClick={() => onOpen?.(lead)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 22px 18px 18px',
        background: '#ffffff',
        borderBottom: '1px solid #f1f3f5',
        borderLeft: `4px solid ${stageCfg.headerBorder}`,
        cursor: 'pointer',
        transition: 'background 0.1s',
        userSelect: 'none',
      }}
      className="group"
      onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: avatarBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 800, color: 'white',
        flexShrink: 0, letterSpacing: '-0.5px',
      }}>
        {initials}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead.buyer_name}
          </span>
          {highlight ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: highlight.color, background: highlight.bg, border: `1px solid ${highlight.border}`, borderRadius: 4, padding: '2px 8px', flexShrink: 0, letterSpacing: '0.04em' }}>
              {highlight.label}
            </span>
          ) : (
            <LeadSourceBadge source={lead.lead_source} size="xs" />
          )}
        </div>

        {carLabel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {carLabel}
            </span>
            {carPrice && (
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>
                · {carPrice}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#d1d5db' }}>No car linked</span>
        )}
      </div>

      {/* Right meta — vertical column so nothing overlaps */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
        {/* Stage pill */}
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 11px', borderRadius: 20,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
          background: stageCfg.bg,
          border: `1px solid ${stageCfg.border}`,
          color: stageCfg.headerBorder,
          whiteSpace: 'nowrap',
        }}>
          {stageCfg.label}
        </span>

        {/* Secondary row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {followUp && fuStyle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 5, background: fuStyle.bg, border: `1px solid ${fuStyle.border}` }}>
              <Calendar style={{ width: 9, height: 9, color: fuStyle.color }} />
              <span style={{ fontSize: 10, color: fuStyle.color, fontWeight: 600 }}>
                {new Date(followUp).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          )}
          {assignedName && (
            <div title={assignedName} style={{
              width: 20, height: 20, borderRadius: '50%',
              background: '#ede9fe', border: '1px solid #ddd6fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#7c3aed',
            }}>
              {assignedName[0]?.toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, minWidth: 28, textAlign: 'right' }} className={txtCls}>
            {days === 0 ? 'Today' : `${days}d`}
          </span>
          <a
            href={formatWhatsAppURL(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="WhatsApp"
            style={{
              width: 28, height: 28, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, background: '#f0fdf4', border: '1px solid #bbf7d0',
              opacity: 0, transition: 'opacity 0.12s',
            }}
            className="group-hover:!opacity-100"
          >
            <MessageCircle style={{ width: 13, height: 13, color: '#16a34a' }} />
          </a>
        </div>
      </div>
    </div>
  );
}
