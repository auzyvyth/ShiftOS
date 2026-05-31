import React from 'react';
import { color, font, space } from '../../theme/tokens';

// Page / section title with optional subtitle and right-aligned actions.
export default function SectionHeader({ title, subtitle, actions, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: space[4], marginBottom: space[5], ...style,
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
            margin: `${space[1]}px 0 0`, fontFamily: font.family,
            fontSize: font.size.md, color: color.textSecondary,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: space[2], flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
