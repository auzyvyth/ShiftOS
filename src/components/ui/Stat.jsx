import React from 'react';
import { color, radius, font, space } from '../../theme/tokens';
import Card from './Card';

// KPI tile. Label (muted, small) over a large near-black numeric value, with an
// optional delta chip and icon. The metric value uses tabular figures so tiles
// line up in a row.
//   delta     – e.g. "+12%" or "-3"
//   deltaDir  – 'up' | 'down' | 'neutral' (colors the chip)
export default function Stat({
  label, value, delta, deltaDir = 'neutral', icon: Icon, hint, style,
}) {
  const deltaColor = {
    up:      { fg: color.success, bg: color.successBg },
    down:    { fg: color.danger,  bg: color.dangerBg },
    neutral: { fg: color.textSecondary, bg: color.surfaceMuted },
  }[deltaDir];

  return (
    <Card padding={5} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] }}>
        <span style={{
          fontFamily: font.family, fontSize: font.size.sm, fontWeight: font.weight.medium,
          color: color.textMuted, letterSpacing: 0.2,
        }}>
          {label}
        </span>
        {Icon && (
          <span style={{
            width: 30, height: 30, borderRadius: radius.md, background: color.surfaceMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textSecondary,
          }}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: space[2] }}>
        <span style={{
          fontFamily: font.family, fontSize: font.size['2xl'], fontWeight: font.weight.bold,
          color: color.ink, lineHeight: 1, ...font.numeric,
        }}>
          {value}
        </span>
        {delta != null && (
          <span style={{
            fontSize: font.size.xs, fontWeight: font.weight.semibold, color: deltaColor.fg,
            background: deltaColor.bg, padding: '2px 7px', borderRadius: radius.pill, ...font.numeric,
          }}>
            {delta}
          </span>
        )}
      </div>

      {hint && (
        <div style={{
          marginTop: space[2], fontFamily: font.family, fontSize: font.size.sm, color: color.textMuted,
        }}>
          {hint}
        </div>
      )}
    </Card>
  );
}
