import React from 'react';
import { color, shadow, radius, space } from '../../theme/tokens';

// Premium surface. Separation comes from shadow + space, not borders.
// Props:
//   padding  – token step (default 5 = 20px) or any number
//   hover    – lift slightly on hover (for clickable cards)
//   muted    – sunken/secondary surface
//   as       – element/component override
export default function Card({
  children, padding = 5, hover = false, muted = false,
  as: Tag = 'div', style, className, ...rest
}) {
  const pad = typeof padding === 'number' && padding <= 12 ? space[padding] ?? padding : padding;
  const [isHover, setHover] = React.useState(false);

  return (
    <Tag
      className={className}
      onMouseEnter={hover ? () => setHover(true) : undefined}
      onMouseLeave={hover ? () => setHover(false) : undefined}
      style={{
        background: muted ? color.surfaceMuted : color.surface,
        borderRadius: radius.lg,
        boxShadow: hover && isHover ? shadow.md : shadow.sm,
        padding: pad,
        transition: 'box-shadow 0.16s ease, transform 0.16s ease',
        transform: hover && isHover ? 'translateY(-1px)' : 'none',
        cursor: hover ? 'pointer' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
