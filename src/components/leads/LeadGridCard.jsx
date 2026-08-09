import React from 'react';
import { MapPin } from 'lucide-react';
import {
  getInitials, avatarGradient, getLeadAgeDays, ageTextColor, isLeadStale, canonicalStage,
} from '../../lib/leadsHelpers';

// Compact, info-only lead card for the pipeline grid.
// No action buttons/links — clicking opens LeadDrawer where all actions live.
// Shows: name, car model, owner (assigned salesman), car price, date created.
export default function LeadGridCard({ lead, onOpen }) {
  const car        = lead.car_listing;
  const carLabel   = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const carPrice   = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString()}` : null;
  const ownerName  = lead.assigned_profile?.full_name || lead.salesman_profile?.full_name;
  const ownerFirst = ownerName ? ownerName.split(' ')[0] : null;
  const initials   = getInitials(lead.buyer_name);
  const avatarBg   = avatarGradient(lead.lead_source);
  const days       = getLeadAgeDays(lead.created_at);
  const txtCls     = ageTextColor(days);
  const needsPing  = isLeadStale(lead);
  // SF-2b: a lead at deposit_taken has reserved its linked car. Surface who.
  const isReserved = canonicalStage(lead.stage) === 'deposit_taken' && !!car;
  const created    = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })
    : null;

  return (
    <div
      onClick={() => onOpen?.(lead)}
      style={{
        background: '#ffffff',
        border: '1px solid #eceef1',
        borderRadius: 10,
        padding: '10px 11px',
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'pan-y',
        WebkitTapHighlightColor: 'transparent',
        transition: 'box-shadow 0.12s, border-color 0.12s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = '#dcdfe4'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#eceef1'; }}
    >
      {/* Row 1: avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: avatarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0, letterSpacing: '-0.5px',
        }}>
          {initials}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#111827', minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {lead.buyer_name || 'Unnamed lead'}
        </span>
        {needsPing && (
          <span
            title="Overdue for follow-up"
            style={{
              flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em',
              color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 20, padding: '1px 7px',
            }}
          >
            Follow up
          </span>
        )}
      </div>

      {/* Row 2: car model */}
      <div style={{
        fontSize: 11.5, color: carLabel ? '#4b5563' : '#cbd0d6',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
      }}>
        {carLabel || 'No car linked'}
      </div>

      {/* Row 2b: buyer state */}
      {lead.buyer_state && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: '#6b7280', marginBottom: 6 }}>
          <MapPin style={{ width: 10, height: 10, flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.buyer_state}</span>
        </div>
      )}

      {/* Row 3: price */}
      {carPrice && (
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#dc2626', marginBottom: 8 }}>
          {carPrice}
        </div>
      )}

      {/* Reserved-by attribution (deposit_taken locks the car) */}
      {isReserved && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, color: '#0d9488',
          background: '#f0fdfa', border: '1px solid #99f6e4',
          borderRadius: 6, padding: '2px 7px', marginBottom: 8,
        }}>
          Reserved{ownerFirst ? ` by ${ownerFirst}` : ''}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: '#f1f3f5', margin: carPrice ? '0 0 8px' : '6px 0 8px' }} />

      {/* Row 4: owner + date created */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        {ownerName ? (
          <div title={`Lead by ${ownerName}`} style={{
            display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
            padding: '1px 7px 1px 2px', borderRadius: 20,
            background: '#ede9fe', border: '1px solid #ddd6fe',
          }}>
            <div style={{
              width: 15, height: 15, borderRadius: '50%', background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {ownerName[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ownerFirst}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>Unassigned</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {created && <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>{created}</span>}
          <span style={{ fontSize: 10, fontWeight: 600 }} className={txtCls}>
            {days === 0 ? 'New' : `${days}d`}
          </span>
        </div>
      </div>
    </div>
  );
}
