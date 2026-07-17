import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080C14' }}>
      <div className="text-center max-w-sm">
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 96, lineHeight: 1, color: '#dc2626', letterSpacing: 2 }}>404</p>
        <h1 style={{ fontFamily: "system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 8 }}>Page not found</h1>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 10, marginBottom: 28 }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" style={{ display: 'inline-block', padding: '11px 24px', background: '#dc2626', color: '#fff', borderRadius: 10, textDecoration: 'none', fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 600 }}>
          Back to XDrive
        </Link>
      </div>
    </div>
  );
}
