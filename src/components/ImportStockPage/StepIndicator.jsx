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
                  background: done ? '#dc2626' : active ? '#111827' : '#e3e6ea',
                  border: 'none',
                  color: done || active ? '#fff' : '#6b7280',
                }}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : idx}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: active ? '#111827' : done ? '#b91c1c' : '#6b7280' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-3 mb-5"
                style={{ background: done ? '#dc2626' : '#f5f6f8', minWidth: 32 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
