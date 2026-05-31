import React from 'react';
import { color, font, space } from '../../theme/tokens';

// Underline sub-tab switcher (light theme). Active = ink text + ink underline.
//   tabs: [{ id, label }]
export default function SubTabBar({ tabs, active, onChange, style }) {
  return (
    <div style={{
      display: 'flex', gap: space[1], marginBottom: space[5],
      borderBottom: `1px solid ${color.border}`, ...style,
    }}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '9px 12px', marginBottom: -1, background: 'transparent',
              border: 'none', borderBottom: `2px solid ${on ? color.ink : 'transparent'}`,
              fontFamily: font.family, fontSize: font.size.base,
              fontWeight: on ? font.weight.semibold : font.weight.medium,
              color: on ? color.ink : color.textMuted, cursor: 'pointer',
              transition: 'color 0.14s ease',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
