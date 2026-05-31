import React from 'react';
import { color, radius, font } from '../../theme/tokens';

const SIZES = {
  sm: { padding: '6px 12px', fontSize: font.size.sm, height: 32 },
  md: { padding: '9px 16px', fontSize: font.size.base, height: 40 },
};

export default function Button({
  children, variant = 'primary', size = 'md',
  icon: Icon, disabled, style, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const sz = SIZES[size] ?? SIZES.md;

  const variants = {
    primary: {
      background: hover ? '#1E293B' : color.ink,
      color: '#FFFFFF',
      border: '1px solid transparent',
      boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
    },
    secondary: {
      background: hover ? '#F4F5F7' : color.surface,
      color: color.ink,
      border: '1px solid #D1D5DB',
      boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
    },
    ghost: {
      background: hover ? '#F4F5F7' : 'transparent',
      color: color.textMuted,
      border: '1px solid transparent',
    },
    danger: {
      background: hover ? '#B91C1C' : color.accent,
      color: '#FFFFFF',
      border: '1px solid transparent',
      boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
    },
  };

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        fontFamily: font.family, fontWeight: font.weight.semibold,
        borderRadius: radius.md, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'background 0.14s ease',
        whiteSpace: 'nowrap', ...sz, ...variants[variant], ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.2} />}
      {children}
    </button>
  );
}
