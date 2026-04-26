import React from 'react';
import { Check } from 'lucide-react';

const STEPS = ['Upload', 'Preview & Edit', 'Import'];

export default function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8 select-none">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done ? '#dc2626' : active ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)',
                  border: done ? '1px solid #dc2626' : active ? '1px solid rgba(220,38,38,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  color: done ? '#fff' : active ? '#ef4444' : '#4b5563',
                }}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : idx}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: active ? '#f3f4f6' : done ? '#dc2626' : '#4b5563' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-3 mb-5"
                style={{ background: done ? '#dc2626' : 'rgba(255,255,255,0.06)', minWidth: 32 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
