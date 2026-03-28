import React from 'react';
import { SOURCE_CONFIG } from '../../lib/leadsHelpers';

export default function LeadSourceBadge({ source, size = 'sm' }) {
  const cfg = SOURCE_CONFIG[source] || { label: source, bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-700' };
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${cfg.bg} ${cfg.text} ${cfg.border} ${pad}`}>
      {cfg.label}
    </span>
  );
}
