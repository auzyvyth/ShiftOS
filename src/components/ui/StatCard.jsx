// Summary stat tile used in marketplace/analytics headers.
// color: optional background color for the icon circle (defaults to red accent).
export default function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '20px 28px', background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px',
      flex: '1', minWidth: '160px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: color || 'rgba(220,38,38,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color ? '#fff' : '#dc2626'} />
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  );
}
