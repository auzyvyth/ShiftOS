import React from 'react';
import { color, radius, font } from '../../theme/tokens';

const TONES = {
  neutral: { fg: '#5B6472', bg: '#F4F5F7' },
  success: { fg: '#16A34A', bg: '#F0FDF4' },
  warning: { fg: '#D97706', bg: '#FFFBEB' },
  danger:  { fg: '#DC2626', bg: '#FEF2F2' },
  info:    { fg: '#2563EB', bg: '#EFF6FF' },
  ink:     { fg: '#FFFFFF', bg: color.ink },
};

export default function Badge({ children, tone = 'neutral', icon: Icon, style }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: font.family, fontSize: font.size.xs, fontWeight: font.weight.semibold,
      color: t.fg, background: t.bg, padding: '3px 9px', borderRadius: 999,
      lineHeight: 1.4, whiteSpace: 'nowrap', ...style,
    }}>
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}
