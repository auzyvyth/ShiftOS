import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { STAGE_ORDER, STAGE_CONFIG } from '../../lib/leadsHelpers';

export default function StagePill({ stage, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new;

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${cfg.color} ${disabled ? 'cursor-default opacity-70' : 'hover:opacity-80 cursor-pointer'}`}
        style={{ background: cfg.bg, borderColor: cfg.border }}
      >
        {cfg.label}
        {!disabled && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-50 rounded-xl overflow-hidden py-1 min-w-[160px]"
          style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}
        >
          {STAGE_ORDER.map(s => {
            const c = STAGE_CONFIG[s];
            const active = s === stage;
            return (
              <button
                key={s}
                onClick={() => { onChange?.(s); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-all flex items-center gap-2 ${c.color} ${active ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                style={{ background: active ? c.bg : 'transparent' }}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.headerBorder }} />}
                {!active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-0" />}
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
