import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MessageCircle, ChevronRight, Clock, Calendar } from 'lucide-react';
import LeadSourceBadge from './LeadSourceBadge';
import {
  getInitials, avatarGradient, getLeadAgeDays,
  ageDotColor, ageTextColor, formatWhatsAppURL, STAGE_ORDER,
} from '../../lib/leadsHelpers';

export default function LeadCard({ lead, onOpen, onMoveNext }) {
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

  const days = getLeadAgeDays(lead.created_at);
  const dotCls = ageDotColor(days);
  const txtCls = ageTextColor(days);
  const initials = getInitials(lead.buyer_name);
  const avatarBg = avatarGradient(lead.lead_source);
  const canMoveNext = STAGE_ORDER.indexOf(lead.stage) < STAGE_ORDER.length - 1;

  const car = lead.car_listing;
  const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : null;
  const carPrice = car?.selling_price ? `RM ${car.selling_price.toLocaleString()}` : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border cursor-grab active:cursor-grabbing select-none group transition-all ${isDragging ? 'shadow-2xl border-gray-600' : 'border-gray-800 hover:border-gray-600 hover:shadow-lg'}`}
      onClick={() => onOpen?.(lead)}
      {...listeners}
      {...attributes}
    >
      <div className="p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.025)' }}>
        {/* Top row: avatar + name + source */}
        <div className="flex items-start gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-0.5"
            style={{ background: avatarBg }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">{lead.buyer_name}</p>
            <div className="mt-1">
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
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.2)' }}
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
          </a>
        </div>

        {/* Car of interest */}
        {carLabel && (
          <div
            className="rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-xs text-gray-400 truncate">{carLabel}</p>
            {carPrice && <p className="text-xs font-semibold text-white flex-shrink-0">{carPrice}</p>}
          </div>
        )}

        {/* Bottom row: age + assignee + move-next */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
            <span className={`text-xs font-medium ${txtCls}`}>
              {days === 0 ? 'Today' : `${days}d`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {lead.followup_date && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-amber-400"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}
              >
                <Calendar className="w-2.5 h-2.5" />
                {new Date(lead.followup_date).toLocaleDateString('en-MY', { day:'numeric', month:'short' })}
              </div>
            )}

            {lead.assigned_profile?.full_name && (
              <span className="text-xs text-gray-600 truncate max-w-[70px]">
                {lead.assigned_profile.full_name.split(' ')[0]}
              </span>
            )}

            {canMoveNext && (
              <button
                onClick={e => { e.stopPropagation(); onMoveNext?.(lead); }}
                className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.2)' }}
                title="Move to next stage"
              >
                <ChevronRight className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
