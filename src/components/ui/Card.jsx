import React from 'react';
import { color, radius } from '../../theme/tokens';

export default function Card({
  children, padding = 20, hover = false, muted = false,
  as: Tag = 'div', style, className, ...rest
}) {
  const pad = typeof padding === 'number' && padding <= 12 ? padding * 4 : padding;
  const [isHover, setHover] = React.useState(false);

  return (
    <Tag
      className={className}
      onMouseEnter={hover ? () => setHover(true) : undefined}
      onMouseLeave={hover ? () => setHover(false) : undefined}
      style={{
        background: muted ? '#F4F5F7' : color.surface,
        borderRadius: radius.lg,
        boxShadow: hover && isHover
          ? '0 4px 8px -2px rgba(16,24,40,0.08), 0 2px 4px -2px rgba(16,24,40,0.04)'
          : '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
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
