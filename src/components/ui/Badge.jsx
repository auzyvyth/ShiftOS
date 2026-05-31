import React from 'react';
import { color, radius, font } from '../../theme/tokens';

// Small status pill. Tones are low-saturation tinted backgrounds.
const TONES = {
  neutral: { fg: color.textSecondary, bg: color.surfaceMuted },
  success: { fg: color.success, bg: color.successBg },
  warning: { fg: color.warning, bg: color.warningBg },
  danger:  { fg: color.danger,  bg: color.dangerBg },
  info:    { fg: color.info,    bg: color.infoBg },
  ink:     { fg: color.primaryText, bg: color.primary },
};

export default function Badge({ children, tone = 'neutral', icon: Icon, style }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: font.family, fontSize: font.size.xs, fontWeight: font.weight.semibold,
      color: t.fg, background: t.bg, padding: '3px 9px', borderRadius: radius.pill,
      lineHeight: 1.4, whiteSpace: 'nowrap', ...style,
    }}>
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}
