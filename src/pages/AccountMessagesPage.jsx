import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBuyerGuard } from '../hooks/useBuyerGuard';
import BuyerInbox from '../components/chat/BuyerInbox';

// Full-page buyer inbox at /account/messages. Used to live embedded inside
// AccountPage — pulled out to its own page so a chat thread gets real room to
// breathe instead of fighting Saved Cars and Saved Searches for scroll space,
// and so /account can show just a strip + unread count.
export default function AccountMessagesPage() {
  useEffect(() => { document.title = 'Messages | XDrive'; }, []);
  const { checking } = useBuyerGuard();

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: "system-ui,sans-serif", fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "system-ui,sans-serif", color: '#111827' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 700, margin: '0 auto' }}>
          <Link to="/account" style={{ color: '#374151', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Account
          </Link>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginLeft: 4 }}>Messages</span>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 60px' }}>
        <BuyerInbox />
      </div>
    </div>
  );
}
