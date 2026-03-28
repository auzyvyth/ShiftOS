import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import LeadCard from './LeadCard';
import { Inbox } from 'lucide-react';
import { STAGE_CONFIG } from '../../lib/leadsHelpers';

export default function LeadColumn({ stage, leads, onOpenLead, onMoveNext }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new;

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden transition-all duration-200"
      style={{
        width: 280,
        background: isOver ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isOver ? cfg.border : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isOver ? `0 0 0 1px ${cfg.border}` : 'none',
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3.5 py-3 sticky top-0 z-10"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          borderTop: `3px solid ${cfg.headerBorder}`,
          background: 'rgba(11,11,15,0.9)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${cfg.color}`}
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          {leads.length}
        </span>
      </div>

      {/* Droppable cards area */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2.5 space-y-2.5 overflow-y-auto"
        style={{ minHeight: 120 }}
      >
        {leads.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 px-3 text-center"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <Inbox className="w-5 h-5 text-gray-700 mb-2" />
            <p className="text-xs text-gray-700">No leads here yet</p>
          </div>
        ) : (
          leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpen={onOpenLead}
              onMoveNext={onMoveNext}
            />
          ))
        )}
      </div>
    </div>
  );
}
