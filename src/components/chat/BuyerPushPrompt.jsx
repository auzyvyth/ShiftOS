import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { usePushNotifications, isIOS, isStandalone } from '../../hooks/usePushNotifications';

// Asks the BUYER to turn on notifications, inside the conversation, after they
// have sent their first message.
//
// Why this exists: a seller's reply already fires a push (chat_after_message
// calls push_to_users on sender_role='seller'), but that only lands if the buyer
// has a push_subscriptions row — and nothing in the app had ever asked a buyer
// for one. PushToggle is rendered on every seller panel and on no buyer surface.
// So chat was a channel the seller could answer on and the buyer never heard
// back through: a guest who closed the tab simply never learned there was a
// reply. This is the missing half.
//
// It is deliberately NOT PushToggle. That component is a settings card with a
// title, a blurb, an on/off state and a test-send button — right for a Settings
// page, wrong for a line above a message box. Both share the part that matters,
// `usePushNotifications`, which owns every browser trap (permission gestures,
// iOS install requirement, denied dead ends, browser/database drift).
//
// Timing: after their first message, not on open. Someone who has just opened a
// chat and typed nothing has not asked for anything yet, and a permission prompt
// there is the kind users reflexively block — and a denied permission is a dead
// end no later prompt can recover.

const DISMISS_KEY = 'xd_buyer_push_dismissed';

export default function BuyerPushPrompt({ t }) {
  const [userId, setUserId] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [justEnabled, setJustEnabled] = useState(false);
  const [note, setNote] = useState(null);

  // A guest buyer is signed in anonymously, which is still a real auth.uid() —
  // push_subscriptions is RLS'd on auth.uid() = user_id, so their row saves like
  // anyone else's.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data?.user?.id || null);
    });
    return () => { cancelled = true; };
  }, []);

  const { supported, configured, permission, subscribed, busy, enable } = usePushNotifications(userId);

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode — ask again next visit */ }
  };

  const handleEnable = async () => {
    setNote(null);
    const res = await enable();
    if (res.ok) { setJustEnabled(true); return; }
    setNote(res.reason === 'denied'
      ? 'Your browser is blocking notifications for this site. You can turn them back on in its site settings.'
      : 'Could not turn notifications on. You will still see the reply here.');
  };

  if (justEnabled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${t.border}`, background: t.panel, padding: '9px 12px', flexShrink: 0 }}>
        <Bell size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
          Done. We will notify you when the seller replies, even with this page closed.
        </p>
      </div>
    );
  }

  // iOS refuses web push outside an installed PWA, so the button could never
  // succeed there — show nothing rather than a dead end. InstallPrompt already
  // handles the add-to-home-screen case.
  const iosBlocked = isIOS() && !isStandalone();
  if (dismissed || !userId || !supported || !configured || subscribed
      || permission === 'denied' || iosBlocked) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', borderTop: `1px solid ${t.border}`, background: t.panel, padding: '9px 12px', flexShrink: 0 }}>
      <Bell size={13} style={{ color: t.sub, flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, lineHeight: 1.5, color: t.sub }}>
        {note || 'Get notified when the seller replies — no need to keep this open.'}
      </p>
      {!note && (
        <button type="button" onClick={handleEnable} disabled={busy}
          style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'system-ui,sans-serif' }}>
          {busy ? 'Turning on…' : 'Turn on'}
        </button>
      )}
      <button type="button" onClick={close} aria-label="Not now"
        style={{ flexShrink: 0, background: 'none', border: 'none', color: t.sub, cursor: 'pointer', padding: 2, display: 'flex' }}>
        <X size={13} />
      </button>
    </div>
  );
}
