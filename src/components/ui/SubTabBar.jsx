import React from 'react';
import { color, font } from '../../theme/tokens';

export default function SubTabBar({ tabs, active, onChange, style }) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 20,
      borderBottom: '1px solid #EAECF0', ...style,
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
