import React from 'react';
import { color, font } from '../../theme/tokens';

export default function SectionHeader({ title, subtitle, actions, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, marginBottom: 20, ...style,
    }}>
      <div>
        <h2 style={{
          margin: 0, fontFamily: font.family, fontSize: font.size.xl,
          fontWeight: font.weight.bold, color: color.ink, letterSpacing: -0.2,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{
            margin: '4px 0 0', fontFamily: font.family,
            fontSize: font.size.base, color: color.textMuted,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
