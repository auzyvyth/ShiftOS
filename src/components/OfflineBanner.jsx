import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wifi, WifiOff } from 'lucide-react';

// "Pops up and begone": shows the instant the browser loses its connection,
// disappears the instant it's back. This is the live, mid-session case — the
// user is already in the app and a fetch is about to start failing. The other
// half of offline handling is public/offline.html, the service-worker
// fallback for a COLD navigation with no network (see vite.config.js
// runtimeCaching) — that page has no React to render into, so it's a
// separate static file, not this component.
const RECONNECT_FLASH_MS = 2500;

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let flashTimer;
    function goOffline() {
      clearTimeout(flashTimer);
      setOnline(false);
      setShowReconnected(false);
    }
    function goOnline() {
      setOnline(true);
      setShowReconnected(true);
      flashTimer = setTimeout(() => setShowReconnected(false), RECONNECT_FLASH_MS);
    }
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      clearTimeout(flashTimer);
    };
  }, []);

  if (online && !showReconnected) return null;

  return createPortal(
    <>
      <style>{`@keyframes xdriveOfflineIn{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', top: 'max(10px, env(safe-area-inset-top, 10px))', left: '50%',
          zIndex: 99998, pointerEvents: 'none', animation: 'xdriveOfflineIn 200ms ease-out',
          transform: 'translate(-50%,0)',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#111118', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999, padding: '9px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 600,
            color: online ? '#4ade80' : '#f87171', whiteSpace: 'nowrap',
          }}
        >
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}
          {online ? 'Back online' : "You're offline — changes won't save until you reconnect"}
        </div>
      </div>
    </>,
    document.body,
  );
}
