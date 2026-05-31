import React from 'react';
import { color, radius, font } from '../../theme/tokens';
import Card from './Card';

const deltaColors = {
  up:      { fg: '#16A34A', bg: '#F0FDF4' },
  down:    { fg: '#DC2626', bg: '#FEF2F2' },
  neutral: { fg: '#9AA1AD', bg: '#F4F5F7' },
};

export default function Stat({ label, value, delta, deltaDir = 'neutral', icon: Icon, hint, style }) {
  const dc = deltaColors[deltaDir] ?? deltaColors.neutral;

  return (
    <Card padding={20} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontFamily: font.family, fontSize: font.size.sm, fontWeight: font.weight.medium,
          color: color.textMuted, letterSpacing: 0.2,
        }}>
          {label}
        </span>
        {Icon && (
          <span style={{
            width: 30, height: 30, borderRadius: radius.md, background: '#F4F5F7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textMuted,
          }}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily: font.family, fontSize: font.size['2xl'], fontWeight: font.weight.bold,
          color: color.ink, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"',
        }}>
          {value}
        </span>
        {delta != null && (
          <span style={{
            fontSize: font.size.xs, fontWeight: font.weight.semibold, color: dc.fg,
            background: dc.bg, padding: '2px 7px', borderRadius: 999,
            fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"',
          }}>
            {delta}
          </span>
        )}
      </div>

      {hint && (
        <div style={{ marginTop: 8, fontFamily: font.family, fontSize: font.size.sm, color: color.textMuted }}>
          {hint}
        </div>
      )}
    </Card>
  );
}
