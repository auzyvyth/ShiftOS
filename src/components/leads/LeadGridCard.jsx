import React from 'react';
import { MapPin } from 'lucide-react';
import { isOpenLead } from '../../utils/carBuyers';
import { BrokerChip } from '../brokers/BrokerCredit';
import {
  getInitials, getLeadAgeDays, isLeadStale, canonicalStage,
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
  const avatarBg   = '#374151';
  const days       = getLeadAgeDays(lead.created_at);
  const txtCls     = days >= 30 ? 'text-red-700' : 'text-gray-500';
  const needsPing  = isLeadStale(lead);
  // SF-2b: a lead at deposit_taken has reserved its linked car. Surface who.
  const isReserved = canonicalStage(lead.stage) === 'deposit_taken' && !!car;
  // SOLD-1: another seller sold this lead's car; the drawer offers another car.
  const carSoldToOther = car?.status === 'sold' && isOpenLead(lead);
  // Loan check from the dealer's own site: its answers are the first lines of the note
  // (api/enquiry.js, loanEnquiryNote). The lead source stays "enquiry", so the note is the only marker.
  const fromLoanCheck = /(^|\n)(\[\d{4}-\d{2}-\d{2}\] )?Loan check:/.test(lead.notes || '');
  const created    = lead.created_at
    ? new Date(lead.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })
    : null;

  return (
    <div
      onClick={() => onOpen?.(lead)}
      style={{
        background: '#f5f6f8',
        border: 'none',
        borderRadius: 12,
        padding: '12px 13px',
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'pan-y',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#eceef1'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#f5f6f8'; }}
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
              color: '#b91c1c', background: '#fff', border: 'none',
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
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
          {carPrice}
        </div>
      )}

      {/* Reserved-by attribution (deposit_taken locks the car) */}
      {isReserved && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, color: '#047857',
          background: '#fff', border: 'none',
          borderRadius: 6, padding: '2px 7px', marginBottom: 8,
        }}>
          Reserved{ownerFirst ? ` by ${ownerFirst}` : ''}
        </div>
      )}

      {carSoldToOther && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, color: '#b91c1c',
          background: '#fff', border: 'none',
          borderRadius: 6, padding: '2px 7px', marginBottom: 8,
        }}>
          Car sold by another seller
        </div>
      )}

      {fromLoanCheck && (
        <div title="This buyer used Check my loan on your site. Their answers are in Notes." style={{
          display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#374151',
          background: '#fff', border: 'none', borderRadius: 6, padding: '2px 7px', marginBottom: 8, marginRight: 6,
        }}>
          Loan check
        </div>
      )}

      {lead.broker_credit && <div style={{ marginBottom: 8 }}><BrokerChip credit={lead.broker_credit} /></div>}
      {lead.won_requested_at && lead.stage !== 'won' && lead.stage !== 'closed_won' && (
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#f5f6f8', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>Broker says sold: confirm</div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(17,24,39,0.06)', margin: carPrice ? '0 0 8px' : '6px 0 8px' }} />

      {/* Row 4: owner + date created */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        {ownerName ? (
          <div title={`Lead by ${ownerName}`} style={{
            display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
            padding: '1px 7px 1px 2px', borderRadius: 20,
            background: '#fff', border: 'none',
          }}>
            <div style={{
              width: 15, height: 15, borderRadius: '50%', background: '#374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {ownerName[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ownerFirst}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{lead.broker_credit ? 'Broker\'s lead' : 'Unassigned'}</span>
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
