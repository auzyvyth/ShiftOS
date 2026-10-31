import React from 'react';
import { coachCopy } from './coachCopy';

// The one "next step" line on a car card (COACH-1), shared by Lite and
// Premium. The panel passes its own colours so each keeps its theme, and its
// own handler: onAction(action, car) with action = answer | edit | share | tour.
export default function CarNextStep({ step, car, lang, colors, onAction }) {
  if (!step) return null;
  const copy = coachCopy(lang);
  const text = copy.line[step.kind]?.(step);
  if (!text) return null;
  const btn = step.action ? copy.btn[step.action] : null;
  const strong = step.kind === 'question' || step.kind === 'silent';
  return (
    <div
      data-coach-kind={step.kind}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px',
        padding: '8px 10px', borderRadius: 10, background: colors.soft,
      }}
    >
      <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, color: strong ? colors.text : colors.sub }}>
        {text}
      </p>
      {btn && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction(step.action, car); }}
          style={{
            flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: strong ? colors.accent : 'transparent',
            color: strong ? colors.onAccent : colors.text,
            boxShadow: strong ? 'none' : `inset 0 0 0 1px ${colors.line}`,
          }}
        >
          {btn}
        </button>
      )}
    </div>
  );
}
