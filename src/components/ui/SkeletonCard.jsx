if (typeof document !== 'undefined') {
  const STYLE_ID = 'sk-shimmer-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '@keyframes sk-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}';
    document.head.appendChild(s);
  }
}

// Skeleton for vertical CarCard — mirrors cc-body structure exactly.
// variant: 'dark'  — dark page backgrounds (CarsPage)
// variant: 'light' — white page backgrounds (MarketplacePage grid)
export default function SkeletonCard({ variant = 'dark' }) {
  const dark   = variant === 'dark';
  const stripe1 = dark ? '#111827' : '#e8e6e0';
  const stripe2 = dark ? '#1f2937' : '#f0eeea';
  const bar     = dark ? '#1f2937' : '#e8e6e0';
  const s       = 'sk-shimmer 1.5s infinite';

  return (
    <div style={{
      background:   dark ? '#0d1117' : '#ffffff',
      border:       dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E2E8F0',
      borderRadius: 16,
      overflow:     'hidden',
      boxShadow:    dark ? 'none' : '0 1px 3px rgba(15,23,42,0.08)',
    }}>
      {/* Image — 170px matches CarCard */}
      <div style={{
        height:          170,
        background:      `linear-gradient(90deg,${stripe1} 25%,${stripe2} 50%,${stripe1} 75%)`,
        backgroundSize:  '200% 100%',
        animation:       s,
      }} />
      {/* Body — matches padding: 11px 13px 13px */}
      <div style={{ padding: '11px 13px 13px' }}>
        {/* Name */}
        <div style={{ height: 13, width: '78%', background: bar, borderRadius: 4, marginBottom: 4, animation: s }} />
        {/* Sub line */}
        <div style={{ height: 10, width: '50%', background: bar, borderRadius: 4, marginBottom: 17, animation: s, animationDelay: '0.05s' }} />
        {/* Strikethrough row — 16px reserved */}
        <div style={{ height: 16 }} />
        {/* Main price */}
        <div style={{ height: 22, width: '65%', background: bar, borderRadius: 5, marginBottom: 5, animation: s, animationDelay: '0.07s' }} />
        {/* Monthly pill */}
        <div style={{ height: 20, width: '55%', background: bar, borderRadius: 20, marginBottom: 10, animation: s, animationDelay: '0.1s' }} />
        {/* 2×2 spec grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 6, columnGap: 8, marginBottom: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 13, background: bar, borderRadius: 4, animation: s, animationDelay: `${0.1 + i * 0.04}s` }} />
          ))}
        </div>
        {/* Divider */}
        <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', marginBottom: 8 }} />
        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
          <div style={{ height: 10, width: '45%', background: bar, borderRadius: 4, animation: s, animationDelay: '0.18s' }} />
          <div style={{ height: 28, width: 32, background: bar, borderRadius: 10, animation: s, animationDelay: '0.18s' }} />
        </div>
      </div>
    </div>
  );
}
