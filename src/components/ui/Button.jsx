import React from 'react';
import { color, radius, font, shadow } from '../../theme/tokens';

// Variants:
//   primary   – calm near-black, the single main action per view
//   secondary – white with hairline border
//   ghost     – text-only, low emphasis
//   danger    – red, reserved for destructive actions
// Sizes: sm | md
const SIZES = {
  sm: { padding: '6px 12px', fontSize: font.size.sm, height: 32 },
  md: { padding: '9px 16px', fontSize: font.size.md, height: 40 },
};

export default function Button({
  children, variant = 'primary', size = 'md',
  icon: Icon, disabled, style, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const sz = SIZES[size] ?? SIZES.md;

  const variants = {
    primary: {
      background: hover ? color.primaryHover : color.primary,
      color: color.primaryText,
      border: '1px solid transparent',
      boxShadow: shadow.xs,
    },
    secondary: {
      background: hover ? color.surfaceMuted : color.surface,
      color: color.ink,
      border: `1px solid ${color.borderStrong}`,
      boxShadow: shadow.xs,
    },
    ghost: {
      background: hover ? color.surfaceMuted : 'transparent',
      color: color.textSecondary,
      border: '1px solid transparent',
    },
    danger: {
      background: hover ? '#B91C1C' : color.danger,
      color: '#FFFFFF',
      border: '1px solid transparent',
      boxShadow: shadow.xs,
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
