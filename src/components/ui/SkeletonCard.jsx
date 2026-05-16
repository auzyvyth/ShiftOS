// Inject the shimmer keyframe once when this module is first loaded.
// This makes the component self-contained — no parent <style> tag required.
if (typeof document !== 'undefined') {
  const STYLE_ID = 'sk-shimmer-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '@keyframes sk-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}';
    document.head.appendChild(s);
  }
}

// Loading skeleton for vertical car listing cards.
// variant: 'dark' (default) — for dark page backgrounds (e.g. CarsPage)
// variant: 'light'          — for white page backgrounds (e.g. MarketplacePage)
export default function SkeletonCard({ variant = 'dark' }) {
  const dark = variant === 'dark';
  const stripe1 = dark ? '#111827' : '#e8e6e0';
  const stripe2 = dark ? '#1f2937' : '#f0eeea';
  const bar     = dark ? '#1f2937' : '#e8e6e0';

  return (
    <div style={{
      background: dark ? '#0d1117' : '#ffffff',
      border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
      borderRadius: '16px', overflow: 'hidden',
      boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        height: dark ? '190px' : '200px',
        background: `linear-gradient(90deg,${stripe1} 25%,${stripe2} 50%,${stripe1} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'sk-shimmer 1.5s infinite',
      }} />
      <div style={{ padding: '16px' }}>
        {(dark ? [75, 55, 90, 100] : [80, 55, 95, 70]).map((w, i) => (
          <div
            key={i}
            style={{
              height: dark ? '11px' : '12px',
              width: `${w}%`,
              background: bar,
              borderRadius: '6px',
              marginBottom: dark ? '9px' : '10px',
              animation: 'sk-shimmer 1.5s infinite',
              animationDelay: dark ? undefined : `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
